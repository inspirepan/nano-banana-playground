import type { AppMessage as AgentMessage } from '@mariozechner/pi-agent'

import type { AgentChatAttachment } from './agentChat'
import type { AgentImageRegistryEntry } from './imageTasks'
import type {
  AgentSessionMessageEntry,
  AgentSessionRecord,
  AgentSessionSidecarRecord,
  CreateAgentSessionParams,
  HydratedAgentSession,
  HydratedAgentSessionSidecar,
  PersistedAgentChatAttachment,
  PersistedAgentImageRegistryEntry,
  PersistedAgentMessage,
  SaveAgentSessionSidecarParams,
} from './sessionTypes'
import { translate } from '../i18n'
import {
  AGENT_SESSION_ENTRY_STORE,
  AGENT_SESSION_SIDECAR_STORE,
  AGENT_SESSION_STORE,
  IMAGE_BLOB_STORE,
  openNanoBananaDB,
} from '../lib/db'

function defaultSessionTitle() {
  return translate('configLib.agent.defaultSessionTitle')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function requestToPromise<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

async function saveBlobRef(id: string, data: string): Promise<string> {
  const db = await openNanoBananaDB()
  const tx = db.transaction(IMAGE_BLOB_STORE, 'readwrite')
  tx.objectStore(IMAGE_BLOB_STORE).put({ id, data })
  await transactionDone(tx)
  return id
}

async function loadBlobRef(id: string): Promise<string> {
  const db = await openNanoBananaDB()
  const tx = db.transaction(IMAGE_BLOB_STORE, 'readonly')
  const record = await requestToPromise<{ data?: unknown } | undefined>(tx.objectStore(IMAGE_BLOB_STORE).get(id))
  return typeof record?.data === 'string' ? record.data : ''
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .flatMap((part) => (isRecord(part) && part.type === 'text' && typeof part.text === 'string' ? [part.text] : []))
    .join('\n')
}

function extractMessageText(message: AgentMessage): string {
  return isRecord(message) ? textFromContent(message.content) : ''
}

function titleFromText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return defaultSessionTitle()
  return normalized.length > 28 ? `${normalized.slice(0, 28)}…` : normalized
}

async function persistMessageValue(value: unknown, blobPrefix: string): Promise<unknown> {
  if (Array.isArray(value)) {
    return Promise.all(value.map((item, index) => persistMessageValue(item, `${blobPrefix}:${index}`)))
  }
  if (!isRecord(value)) return value

  const next: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (key === 'data' && value.type === 'image' && typeof child === 'string') {
      next.dataRef = await saveBlobRef(`${blobPrefix}:data`, child)
      continue
    }
    if (key === 'content' && value.type === 'image' && typeof child === 'string') {
      next.contentRef = await saveBlobRef(`${blobPrefix}:content`, child)
      continue
    }
    next[key] = await persistMessageValue(child, `${blobPrefix}:${key}`)
  }
  return next
}

async function hydrateMessageValue(value: unknown): Promise<unknown> {
  if (Array.isArray(value)) return Promise.all(value.map((item) => hydrateMessageValue(item)))
  if (!isRecord(value)) return value

  const next: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (key === 'dataRef' && value.type === 'image' && typeof child === 'string') {
      next.data = await loadBlobRef(child)
      continue
    }
    if (key === 'contentRef' && value.type === 'image' && typeof child === 'string') {
      next.content = await loadBlobRef(child)
      continue
    }
    next[key] = await hydrateMessageValue(child)
  }
  return next
}

async function persistAgentMessage(
  sessionId: string,
  entryId: string,
  message: AgentMessage,
): Promise<PersistedAgentMessage> {
  const persisted = await persistMessageValue(message, `agent-message:${sessionId}:${entryId}`)
  return isRecord(persisted) ? persisted : {}
}

async function hydrateAgentMessage(message: PersistedAgentMessage): Promise<AgentMessage> {
  return (await hydrateMessageValue(message)) as AgentMessage
}

async function persistAttachment(
  sessionId: string,
  scope: string,
  attachment: AgentChatAttachment,
): Promise<PersistedAgentChatAttachment> {
  const dataRef = await saveBlobRef(`agent-attachment:${sessionId}:${scope}:${attachment.id}`, attachment.data)
  return {
    id: attachment.id,
    dataRef,
    mimeType: attachment.mimeType,
    fileName: attachment.fileName,
    size: attachment.size,
  }
}

async function hydrateAttachment(attachment: PersistedAgentChatAttachment): Promise<AgentChatAttachment> {
  return {
    id: attachment.id,
    data: await loadBlobRef(attachment.dataRef),
    mimeType: attachment.mimeType,
    fileName: attachment.fileName,
    size: attachment.size,
  }
}

function registryImageAsAttachment(entry: AgentImageRegistryEntry): AgentChatAttachment | null {
  const image = entry.image
  if (!image || entry.source !== 'agent_attachment') return null
  if (!('fileName' in image) || !('size' in image) || !('data' in image)) return null
  if (typeof image.fileName !== 'string' || typeof image.size !== 'number' || typeof image.data !== 'string')
    return null
  return image as AgentChatAttachment
}

async function persistRegistryEntry(
  sessionId: string,
  entry: AgentImageRegistryEntry,
): Promise<PersistedAgentImageRegistryEntry> {
  const attachment = registryImageAsAttachment(entry)
  return {
    id: entry.id,
    source: entry.source,
    status: entry.status,
    createdAt: entry.createdAt,
    attachment: attachment ? await persistAttachment(sessionId, `registry:${entry.id}`, attachment) : undefined,
  }
}

async function hydrateRegistryEntry(entry: PersistedAgentImageRegistryEntry): Promise<AgentImageRegistryEntry> {
  return {
    id: entry.id,
    source: entry.source,
    status: entry.status,
    createdAt: entry.createdAt,
    image: entry.attachment ? await hydrateAttachment(entry.attachment) : undefined,
  }
}

function emptySidecar(): HydratedAgentSessionSidecar {
  return {
    draft: '',
    attachments: [],
    imageTasks: [],
    imageRegistry: [],
    turnCallbacks: [],
    currentAgentTurnId: null,
    pendingQuestions: [],
  }
}

export async function createAgentSession(params: CreateAgentSessionParams): Promise<AgentSessionRecord> {
  const now = Date.now()
  const record: AgentSessionRecord = {
    id: crypto.randomUUID(),
    title: defaultSessionTitle(),
    createdAt: now,
    updatedAt: now,
    modelId: params.modelId,
    thinkingLevel: params.thinkingLevel,
    autoApproveImageTasks: params.autoApproveImageTasks,
    leafEntryId: null,
    messageCount: 0,
    firstUserText: '',
    previewText: '',
  }
  const db = await openNanoBananaDB()
  const tx = db.transaction(AGENT_SESSION_STORE, 'readwrite')
  tx.objectStore(AGENT_SESSION_STORE).put(record)
  await transactionDone(tx)
  return record
}

export async function listAgentSessions(): Promise<AgentSessionRecord[]> {
  const db = await openNanoBananaDB()
  const tx = db.transaction(AGENT_SESSION_STORE, 'readonly')
  const store = tx.objectStore(AGENT_SESSION_STORE)
  const records = await requestToPromise<AgentSessionRecord[]>(store.getAll())
  return records.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function appendAgentSessionMessage(params: {
  sessionId: string
  parentId: string | null
  message: AgentMessage
}): Promise<{ entryId: string; record: AgentSessionRecord }> {
  const entryId = crypto.randomUUID()
  const now = Date.now()
  const message = await persistAgentMessage(params.sessionId, entryId, params.message)
  const text = extractMessageText(params.message)
  const db = await openNanoBananaDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([AGENT_SESSION_STORE, AGENT_SESSION_ENTRY_STORE], 'readwrite')
    const sessionStore = tx.objectStore(AGENT_SESSION_STORE)
    const entryStore = tx.objectStore(AGENT_SESSION_ENTRY_STORE)
    const getReq = sessionStore.get(params.sessionId) as IDBRequest<AgentSessionRecord | undefined>
    let nextRecord: AgentSessionRecord | null = null

    getReq.onsuccess = () => {
      const record = getReq.result
      if (!record) {
        tx.abort()
        reject(new Error('Agent session does not exist.'))
        return
      }
      const entry: AgentSessionMessageEntry = {
        type: 'message',
        id: entryId,
        sessionId: params.sessionId,
        parentId: params.parentId,
        timestamp: now,
        message,
      }
      const isUser = isRecord(params.message) && params.message.role === 'user'
      nextRecord = {
        ...record,
        title: !record.firstUserText && isUser ? titleFromText(text) : record.title,
        firstUserText: record.firstUserText || (isUser ? text : ''),
        previewText: text || record.previewText,
        updatedAt: now,
        leafEntryId: entryId,
        messageCount: record.messageCount + 1,
      }
      entryStore.put(entry)
      sessionStore.put(nextRecord)
    }
    getReq.onerror = () => reject(getReq.error)
    tx.oncomplete = () => {
      if (nextRecord) resolve({ entryId, record: nextRecord })
    }
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => {
      if (!nextRecord) return
      reject(tx.error)
    }
  })
}

export async function updateAgentSessionConfig(
  sessionId: string,
  patch: Partial<Pick<AgentSessionRecord, 'modelId' | 'thinkingLevel' | 'autoApproveImageTasks' | 'title'>>,
): Promise<AgentSessionRecord | null> {
  const db = await openNanoBananaDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AGENT_SESSION_STORE, 'readwrite')
    const store = tx.objectStore(AGENT_SESSION_STORE)
    const getReq = store.get(sessionId) as IDBRequest<AgentSessionRecord | undefined>
    let next: AgentSessionRecord | null = null
    let missing = false

    getReq.onsuccess = () => {
      const record = getReq.result
      if (!record) {
        missing = true
        return
      }
      next = { ...record, ...patch, updatedAt: Date.now() }
      store.put(next)
    }
    getReq.onerror = () => reject(getReq.error)
    tx.oncomplete = () => resolve(missing ? null : next)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function saveAgentSessionSidecar(params: SaveAgentSessionSidecarParams): Promise<void> {
  const attachments = await Promise.all(
    params.attachments.map((attachment) => persistAttachment(params.sessionId, 'draft', attachment)),
  )
  const imageRegistry = await Promise.all(
    params.imageRegistry.map((entry) => persistRegistryEntry(params.sessionId, entry)),
  )
  const record: AgentSessionSidecarRecord = {
    sessionId: params.sessionId,
    updatedAt: Date.now(),
    draft: params.draft,
    attachments,
    imageTasks: params.imageTasks,
    imageRegistry,
    turnCallbacks: params.turnCallbacks,
    currentAgentTurnId: params.currentAgentTurnId,
    pendingQuestions: params.pendingQuestions,
  }
  const db = await openNanoBananaDB()
  const tx = db.transaction(AGENT_SESSION_SIDECAR_STORE, 'readwrite')
  tx.objectStore(AGENT_SESSION_SIDECAR_STORE).put(record)
  await transactionDone(tx)
}

export async function loadAgentSession(sessionId: string): Promise<HydratedAgentSession | null> {
  const db = await openNanoBananaDB()
  const tx = db.transaction([AGENT_SESSION_STORE, AGENT_SESSION_ENTRY_STORE, AGENT_SESSION_SIDECAR_STORE], 'readonly')
  const recordReq = tx.objectStore(AGENT_SESSION_STORE).get(sessionId) as IDBRequest<AgentSessionRecord | undefined>
  const entriesReq = tx.objectStore(AGENT_SESSION_ENTRY_STORE).index('sessionId').getAll(sessionId) as IDBRequest<
    AgentSessionMessageEntry[]
  >
  const sidecarReq = tx.objectStore(AGENT_SESSION_SIDECAR_STORE).get(sessionId) as IDBRequest<
    AgentSessionSidecarRecord | undefined
  >
  const [record, entries, sidecarRecord] = await Promise.all([
    requestToPromise(recordReq),
    requestToPromise(entriesReq),
    requestToPromise(sidecarReq),
  ])
  if (!record) return null
  const messages = await Promise.all(
    entries.sort((a, b) => a.timestamp - b.timestamp).map((entry) => hydrateAgentMessage(entry.message)),
  )
  const sidecar = sidecarRecord
    ? {
        draft: sidecarRecord.draft,
        attachments: await Promise.all(sidecarRecord.attachments.map((attachment) => hydrateAttachment(attachment))),
        imageTasks: sidecarRecord.imageTasks,
        imageRegistry: await Promise.all(sidecarRecord.imageRegistry.map((entry) => hydrateRegistryEntry(entry))),
        turnCallbacks: sidecarRecord.turnCallbacks,
        currentAgentTurnId: sidecarRecord.currentAgentTurnId,
        pendingQuestions: sidecarRecord.pendingQuestions ?? [],
      }
    : emptySidecar()
  return { record, messages, sidecar }
}

export async function deleteAgentSession(sessionId: string): Promise<void> {
  const db = await openNanoBananaDB()
  const tx = db.transaction(
    [AGENT_SESSION_STORE, AGENT_SESSION_ENTRY_STORE, AGENT_SESSION_SIDECAR_STORE, IMAGE_BLOB_STORE],
    'readwrite',
  )
  tx.objectStore(AGENT_SESSION_STORE).delete(sessionId)
  tx.objectStore(AGENT_SESSION_SIDECAR_STORE).delete(sessionId)
  const entryStore = tx.objectStore(AGENT_SESSION_ENTRY_STORE)
  const index = entryStore.index('sessionId')
  const cursorReq = index.openCursor(IDBKeyRange.only(sessionId))
  cursorReq.onsuccess = () => {
    const cursor = cursorReq.result
    if (!cursor) return
    cursor.delete()
    cursor.continue()
  }
  const blobCursorReq = tx.objectStore(IMAGE_BLOB_STORE).openCursor()
  blobCursorReq.onsuccess = () => {
    const cursor = blobCursorReq.result
    if (!cursor) return
    const key = typeof cursor.primaryKey === 'string' ? cursor.primaryKey : ''
    if (key.startsWith(`agent-message:${sessionId}:`) || key.startsWith(`agent-attachment:${sessionId}:`)) {
      cursor.delete()
    }
    cursor.continue()
  }
  await transactionDone(tx)
}
