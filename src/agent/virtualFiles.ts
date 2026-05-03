import { formatTextSegment, textSegmentLineCount, type TextSegmentDetails } from './textSegments'
import { AGENT_VIRTUAL_FILE_STORE, openNanoBananaDB } from '../lib/db'

export type AgentVirtualFileKind = 'tool_output' | 'web_fetch' | 'web_search'

export type AgentVirtualFileRecord = {
  id: string
  sessionId: string
  path: string
  kind: AgentVirtualFileKind
  toolCallId?: string
  toolName?: string
  title?: string
  sourceUrl?: string
  content: string
  contentType: 'text/plain' | 'text/markdown' | 'application/json'
  originalChars: number
  lineCount: number
  createdAt: number
}

export type SaveAgentVirtualFileParams = {
  sessionId: string
  path: string
  kind: AgentVirtualFileKind
  content: string
  contentType?: AgentVirtualFileRecord['contentType']
  toolCallId?: string
  toolName?: string
  title?: string
  sourceUrl?: string
}

export type ReadAgentVirtualFileSegment = {
  text: string
  details: TextSegmentDetails & { status: 'ready'; path: string; kind: AgentVirtualFileKind }
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

function virtualFileId(sessionId: string, path: string): string {
  return `${sessionId}:${path}`
}

export function agentToolOutputVirtualPath(toolCallId: string): string {
  return `agent://tool-output/${encodeURIComponent(toolCallId)}.txt`
}

export function agentWebFetchVirtualPath(toolCallId: string): string {
  return `agent://web-fetch/${encodeURIComponent(toolCallId)}.md`
}

export function agentVirtualFileLineCount(content: string): number {
  return textSegmentLineCount(content)
}

export async function saveAgentVirtualFile(params: SaveAgentVirtualFileParams): Promise<AgentVirtualFileRecord> {
  const record: AgentVirtualFileRecord = {
    id: virtualFileId(params.sessionId, params.path),
    sessionId: params.sessionId,
    path: params.path,
    kind: params.kind,
    toolCallId: params.toolCallId,
    toolName: params.toolName,
    title: params.title,
    sourceUrl: params.sourceUrl,
    content: params.content,
    contentType: params.contentType ?? 'text/plain',
    originalChars: params.content.length,
    lineCount: agentVirtualFileLineCount(params.content),
    createdAt: Date.now(),
  }
  const db = await openNanoBananaDB()
  const tx = db.transaction(AGENT_VIRTUAL_FILE_STORE, 'readwrite')
  tx.objectStore(AGENT_VIRTUAL_FILE_STORE).put(record)
  await transactionDone(tx)
  return record
}

export async function loadAgentVirtualFile(
  sessionId: string,
  path: string,
): Promise<AgentVirtualFileRecord | undefined> {
  const db = await openNanoBananaDB()
  const tx = db.transaction(AGENT_VIRTUAL_FILE_STORE, 'readonly')
  return requestToPromise<AgentVirtualFileRecord | undefined>(
    tx.objectStore(AGENT_VIRTUAL_FILE_STORE).get(virtualFileId(sessionId, path)),
  )
}

export function formatAgentVirtualFileSegment(
  file: AgentVirtualFileRecord,
  offset?: number,
  limit?: number,
): ReadAgentVirtualFileSegment {
  const segment = formatTextSegment(file.content, offset, limit)
  return {
    text: segment.text,
    details: {
      ...segment.details,
      status: 'ready',
      path: file.path,
      kind: file.kind,
    },
  }
}
