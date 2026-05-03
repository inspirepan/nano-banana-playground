# Agent package guidelines

本目录承载本项目的 Agent 领域逻辑。凡是和 Agent 会话、Agent 工具、图片任务审批、Agent 图片 registry、Agent Web 搜索/抓取相关的代码，都优先放在 `src/agent/`，再由 `usePlayground` 和组件层调用。

## 当前依赖语境

本项目当前直接依赖：

- `@mariozechner/pi-agent`
- `@mariozechner/pi-ai`

不要按 `pi-coding-agent` 或 `pi-agent-core` 的 API 写实现。可以借鉴它们的分层思想，但这里实际可用的是 `@mariozechner/pi-agent` 暴露的 API：

- `new Agent({ transport, initialState, messageTransformer?, queueMode? })`
- `agent.state`: `systemPrompt`、`model`、`thinkingLevel`、`tools`、`messages`、`isStreaming`、`streamMessage`、`pendingToolCalls`、`error`
- `agent.prompt(input: string, attachments?: Attachment[])`
- `agent.queueMessage(message: AppMessage)`
- `agent.setTools(tools)` / `agent.state.tools = tools`
- `agent.subscribe(listener)`
- `agent.waitForIdle()`
- `agent.abort()`
- `agent.replaceMessages(messages)` / `agent.appendMessage(message)`

`agent.prompt(...)` 接收字符串和附件，不接收完整 user message object。当前 `@mariozechner/pi-agent` 内部按顺序执行同一轮 tool call；不要依赖并行 tool dispatch。长耗时、待审批、可恢复的业务流程不要用永不落盘的 Promise resolver 挂住 tool execution。

## 分层原则

- `@mariozechner/pi-agent` 的 `Agent` 只当作通用 LLM loop：消息、工具、streaming、事件订阅。
- 本目录负责项目语义：Agent 会话状态、图片 ID registry、`GenImage` / `ReadImage` / `AskUserQuestion` / `WebSearch` / `WebFetch` 工具、Agent 图片任务审批、Agent 问卷审批。
- React 组件只渲染状态和触发 handler，不直接实现工具业务逻辑。
- `useAgentPlayground` 持有当前 Agent runtime、当前会话 sidecar、附件、图片 registry、任务审批和工具执行逻辑。
- `usePlayground` 只负责主编辑器、URL 同步、参考图、历史和真实生成队列，再把必要能力注入 `useAgentPlayground`。
- `useGenerationQueue` 只负责真实图片生成队列，不理解 Agent 审批语义。

## 当前代码结构

```txt
src/agent/
  useAgentPlayground.ts   # Agent orchestration hook: runtime/session/attachments/tasks/tools bridge
  agentChat.ts            # AppMessage/attachment parsing helpers for UI and runtime inputs
  compaction.ts           # token estimation, cut point, generateSummary, compact orchestrator
  imageTasks.ts           # AgentImageTask, registry types, image_id reservation, prompt line formatting
  sessionStore.ts         # IndexedDB-backed Agent session log + sidecar persistence
  sessionTypes.ts         # Persisted/hydrated Agent session records and sidecar shapes
  systemPrompt.ts         # Bundled system prompt loader
  tools/
    index.ts              # createAgentTools composition
    genImage.ts           # GenImage schema normalization and runtime tool wrapper
    readImage.ts          # ReadImage schema normalization and runtime tool wrapper
    askUserQuestion.ts    # AskUserQuestion schema, arg normalization, result formatting
    webSearch.ts          # WebSearch schema normalization and provider-backed runtime wrapper
    webFetch.ts           # WebFetch schema normalization and provider/default runtime wrapper
    webProviderClients.ts # Exa / Tavily HTTP adapters
    shared.ts             # shared runtime tool result/types
```

### `useAgentPlayground`

`useAgentPlayground` 是 Agent 领域状态机和主 playground 之间的唯一 React hook 边界。它从 `usePlayground` 接收：

- Google / OpenAI API key hooks，用于 Agent LLM 和工具触发的生图模型鉴权。
- 当前参考图、历史图片 metadata、正在运行的 `GenerationJob[]`。
- `getProviderCredentials`、`invalidateGenerationKey`。
- `enqueueGenerationJob`、`cancelGenerationJob`、`dismissGenerationJob`。

它对外返回组件需要的 Agent 状态和 handler：

```ts
type UseAgentPlaygroundReturn = {
  agentModels: AgentModelConfig[]
  agentModel: AgentModelConfig
  agentThinkingLevel: AgentThinkingLevel
  agentMessages: AppMessage[]
  agentStreamingMessage: AppMessage | null
  agentIsStreaming: boolean
  agentError: string | null
  agentDraft: string
  agentAttachments: AgentChatAttachment[]
  agentAttachmentError: string | null
  agentSessions: AgentSessionSummary[]
  currentAgentSessionId: string | null
  agentSessionsLoading: boolean
  autoApproveImageTasks: boolean
  agentImageTasks: AgentImageTask[]
  // plus setters/session actions/message actions/task actions
}
```

内部保持一个 `Agent` 实例和当前会话 refs：`imageTasks`、`imageRegistry`、`turnCallbacks`、`currentAgentTurnId`、`leafEntryId`。这些运行期结构会通过 `sessionStore` 保存为 session sidecar，页面刷新或切换会话时可恢复；刷新中断的非终结生图任务会恢复为 `canceled`。

### 上下文压缩

`compaction.ts` 参考 `pi-coding-agent` 的做法，提供阈值触发的上下文压缩：

- 在每次 `agent_end` 事件后检查最新 assistant message 的 `usage`，按 `model.contextWindow - reserveTokens` 与 `DEFAULT_COMPACTION_SETTINGS` 判断是否需要压缩。
- `findCutPoint` 从尾部往前累加 token，达到 `keepRecentTokens` 后吸附到最近的 `user` / `assistant` 消息（`toolResult` 永远不会作为切点，避免割裂 toolCall + toolResult 配对）。
- 通过 `completeSimple` 用同模型 + 同 apiKey 调用一次额外的 LLM 完成，按结构化模板（Goal / Progress / Generated Images / Next Steps 等）生成 summary；如果存在上一次的 summary，则用 update 模板做增量更新。
- 压缩成功后把 `agent.state.messages` 替换为 `[synthesizedSummaryUserMsg, ...keptMessages]`；synthesized summary 是一条 `role: 'user'` 的 `<system>` 包裹文本，对模型相当于可读的检查点。
- 持久化：`runtime.lastCompaction = { summary, firstKeptEntryId, tokensBefore, createdAt }` 写进 session sidecar；session 入库的 message entries 不删，刷新时按 `firstKeptEntryId` 切片，前面再补一条 synthesized summary。
- `runtime.messageEntryIds: WeakMap<AgentMessage, entryId>` 跟踪每条消息的持久化 ID，让我们能在运行期定位 `firstKeptEntryId`；无 ID 的消息（synthesized summary、abandoned tool result）自动跳过，不会被当作 cut point。
- 压缩进行期间 `runtime.isCompacting=true`，`syncRuntimeSnapshot` 把它和 `agent.state.isStreaming` OR 起来对外暴露，`sendAgentMessage` 会拒绝新输入，`removeAgentSession` / 切换会话会 abort 进行中的压缩。
- 失败不破坏会话：异常时仅把错误投到 `runtime.error`，不替换消息；下一次 `agent_end` 还会再尝试。

设置：当前为常量 `DEFAULT_COMPACTION_SETTINGS = { enabled: true, reserveTokens: 8192, keepRecentTokens: 16384 }`。如果需要做成可配置（per-session / 全局开关），把它接到 settings 层。

### 会话持久化

LLM transcript 中的 `toolCall` 保持 provider 原生形状；审批、生成队列、registry 等项目状态作为 sidecar 按 `toolCallId` / `agentTurnId` join，不直接塞进 `toolCall` content block。图片二进制继续走 IndexedDB 图片存储，session sidecar 只保存 ID 引用或 Agent 附件的 dataRef。

`sessionStore.ts` 负责：

- 创建、删除、列出 Agent session summary。
- append message entry，并维护当前 leaf entry。
- 保存 / 加载 sidecar：草稿、附件、任务、registry、turn callbacks、当前 turn id。

## 工具命名

当前 Agent 工具集合：

- `GenImage`
- `ReadAgentFile`
- `ReadImage`
- `AskUserQuestion`
- `WebSearch`
- `WebFetch`

不要再引入 `image_gen`、`read_image`、`read_image_prompt` 这组旧命名。提示词读取能力并入 `ReadImage`；引导用户决策走 `AskUserQuestion`。
Web 搜索和抓取能力走 `WebSearch` / `WebFetch`，不要引入 `web_search` / `web_fetch` 这类 snake_case 工具名。长工具输出和 WebFetch 全文通过 `ReadAgentFile` 读取，不要把它命名成通用本地文件读取工具。

## Agent 虚拟文件

长工具结果保存到 IndexedDB 的 `agent_virtual_files` store，路径形如 `agent://tool-output/{toolCallId}.txt` 或 `agent://web-fetch/{toolCallId}.md`。这些路径是当前 Agent session 内的虚拟文件，不映射到用户本机文件系统。

- 通用工具结果 offload 由 `toolResultOffload.ts` 负责：超过 40000 字符或 2000 行时保存完整 text output，并返回 head/tail 预览。
- `WebFetch` 会在有 session/toolCallId 时保存完整 processed content；短内容也会提示 `[Full content saved to ...]`，长内容返回预览。
- `ReadAgentFile` 读取当前 session 的 `agent://...` 文件，支持 1-indexed `offset` 和行数 `limit`，输出带行号。
- 删除 Agent session 时必须同步删除该 session 的虚拟文件，不要把大工具输出塞进 session sidecar。

## Web 工具后端

Web 工具后端分两类抽象：

- `WebSearchProvider`: `none` / `exa` / `tavily`。
- `WebFetchProvider`: `default` / `exa` / `tavily`。

用户在 `SettingsDialog` 的 Web 工具区配置 API Key 和分别选择 `WebSearch` / `WebFetch` 后端。没有配置搜索后端时，`WebSearch` 返回未配置错误；没有配置抓取后端时，`WebFetch` 使用浏览器 direct fetch，并在 CORS 失败时自动 fallback 到 Jina Reader。Brave Search API 和 Parallel API 当前不支持本项目这种纯前端浏览器直连，已从可选后端中移除。

真实网络调用测试使用根目录脚本：

```bash
npm run test:network
```

这组测试只在对应环境变量存在时执行：`EXA_API_KEY` 覆盖 Exa search/fetch，`TAVILY_API_KEY` 覆盖 Tavily search/fetch。不要把真实网络测试并入默认 `npm test`。

## `GenImage` 工具准则

`GenImage` 是可恢复的非阻塞 workflow 入口：工具调用只创建 `AgentImageTask` sidecar 状态并立即返回，真实生成在用户审批或自动通过后继续进行。任务终结状态包括 `completed`、`failed`、`rejected`、`canceled`。

参数：

```ts
type GenImageToolArgs = {
  image_id: string
  prompt: string
  model: string
  resolution: string
  ratio: string
  n: number
  reference_image_ids: string[]
}
```

行为：

1. 校验并规范化参数。
2. 根据 `image_id` 和 `n` 预留真实输出图片 ID。
3. 解析 `reference_image_ids`，只把引用 ID 写入 task；运行时需要图片对象时再从 registry / 历史 / IndexedDB 解析。
4. 创建 `AgentImageTask`，状态为 `pending_approval`；如 `autoApproveImageTasks` 开启则直接进入生成队列。
5. 工具立即返回一个 text content block，包含 `status` / `task_id` / `requested_image_id` / `reserved_image_ids` / `message`。
6. 任务终结后通过按 `agentTurnId` 分组的系统事件唤醒 Agent，告知最终 `status` / `image_ids` / `error`。

工具结果示例（创建成功）：

```json
{
  "status": "pending_approval",
  "task_id": "task_uuid",
  "requested_image_id": "苹果",
  "reserved_image_ids": ["苹果_2", "苹果_3"],
  "renamed": true,
  "message": "任务已经提交，等待用户审批。"
}
```

完成后 Agent 会收到一条 user-role system event：

```txt
<system>
tool GenImage call xxx has been finished.
status: completed
requested_image_id: 苹果
reserved_image_ids: 苹果_2, 苹果_3
image_ids: 苹果_2, 苹果_3
</system>
```

如果未来 `pi-agent` 暴露无新增 user message 的 continue-from-tool-results API，再把终结事件从 system event 升级为 append final `toolResult` + continue turn。

### 图片 ID 规则

- `image_id` 必填，作为 Agent 声明的语义图片名和后续引用 ID。
- 不要再增加单独的 `image_name`。
- 系统应规范化 `image_id`：去首尾空白、把连续空白压成 `_`、过滤明显不适合作为 ID 的控制字符。
- `n = 1` 时优先使用规范化后的 `image_id`。
- `n > 1` 时使用 `image_id`、`image_id_2`、`image_id_3`。
- 如果 ID 已存在于 registry / IndexedDB / 当前预留集合中，递增后缀直到可用，例如 `苹果`、`苹果_2`、`苹果_3`。
- ID 在创建任务时预留；工具结果必须告诉 Agent 最终会保存成哪些 ID。
- 用户拒绝或部分失败时，未产出图片的预留 ID 释放回 registry，可被后续任务重新使用。
- 工具创建结果文本里 `reserved_image_ids` 是创建任务时的预留集合；任务终结事件里的 `image_ids` 是真正成功落盘的子集。

## `ReadImage` 工具准则

`ReadImage` 同时负责读取图片、图片来源、引用关系和生成提示词。不要再做独立 `ReadImagePrompt` / `read_image_prompt` 工具。

参数：

```ts
type ReadImageToolArgs = {
  image_id: string
  offset?: number
  limit?: number
}
```

字段语义：

- `image_id`: 要读取的图片 ID。可以是 Agent 附件、当前参考图、历史图、生成图，或 `GenImage` 返回的真实保存 ID。
- `offset`: 可选，提示词起始行号。默认不填；只要 `offset > 0`，工具进入“只读提示词续段”模式。
- `limit`: 可选，读取提示词行数。不填时命中标准 Read 风格的最大 2000 行限制。

### 默认看图模式

当 `offset` 未提供或 `offset <= 0` 时，返回：

- 一个 text block，包含图片元信息、来源、引用、生成上下文、提示词预览和提示词编号行文本。
- 一个 image content block，包含 base64 图片内容和 MIME type。

文本摘要要包含：

```ts
type ReadImageDefaultTextResult = {
  image_id: string
  status: 'ready'
  source: 'agent_attachment' | 'reference' | 'history' | 'generated'
  mime_type: string
  width?: number
  height?: number
  generated?: {
    model_id: string
    model_name: string
    prompt_preview: string
    prompt_length: number
    prompt_total_lines: number
    prompt_truncated: boolean
    prompt_output_text: string
    reference_image_ids: string[]
    resolution: string
    ratio: string
    created_at: number
  }
  message: string
}
```

`prompt_preview` 固定取生成提示词前 100 个字符。`prompt_output_text` 使用 Read 风格编号行，默认从第 1 行开始读取，最多命中 2000 行和全局字符上限。超出时追加截断提示。

### 提示词续读模式

当 `offset > 0` 时，`ReadImage` 只读取生成提示词，不返回 image content block，避免重复发送图片浪费上下文。

续读模式必须对齐标准 Read 工具风格：

- `offset` 是 1-indexed 起始行号。
- `limit` 是读取行数。
- `limit < 0` 时按 `0` 处理。
- 输出为编号行文本。
- 截断通过文本提示表达。
- 不返回 `has_next`、`has_more`、`next_offset`、`prompt_slice` 这类分页字段。

编号行格式：

```txt
     1→第一行提示词
     2→第二行提示词
```

截断提示示例：

```txt
… (12 more lines truncated due to 2000 line limit, prompt has 3200 lines total, use offset/limit to read other parts)
```

offset 超界示例：

```txt
<system-reminder>Warning: the prompt exists but is shorter than the provided offset (120). The prompt has 43 lines.</system-reminder>
```

错误文本示例：

```txt
<tool_use_error>Image does not exist.</tool_use_error>
```

```txt
<tool_use_error>Image prompt is only available for generated images.</tool_use_error>
```

## `AskUserQuestion` 工具准则

`AskUserQuestion` 用于让 Agent 在继续行动之前，向用户用一份小问卷问清关键决策（风格、用途、模型选择等）。和 `GenImage` 不同：它是**阻塞**的，Promise 会一直挂到用户提交或跳过；不要在这里再做长耗时业务，仅用于人机决策。

参数：

```ts
type AskUserQuestionToolArgs = {
  questions: {
    question: string
    header: string
    options: { label: string; description?: string }[]
    multi_select: boolean
  }[]
}
```

行为：

1. 校验 `questions`，保留至少有 2 个 option 的题目。
2. 在 `useAgentPlayground` 里登记一个 `AgentPendingQuestion` sidecar 状态，并把 resolver 存进 `agentQuestionResolversRef`，UI 渲染表单。
3. 用户提交后，Agent 收到一个 `toolResult`，文本格式按问题逐条展开，每题包含 `Question` / `Answer` / 可选 `Note` 三段，多个问题之间用 `\n---\n` 分隔。
4. 用户点“全部你来定”时，问卷以 `decide_for_me` 状态 resolve，文本提示 Agent 代用户做合理创意选择并继续；会话切换/刷新等中断仍以 `cancelled` 状态 resolve，文本提示用户没有作答。
5. 页面刷新会丢掉运行期 resolver；`useAgentPlayground` 在 `loadAgentSessionIntoRuntime` 时会扫描 transcript，给所有缺 `toolResult` 的工具调用注入一条系统占位结果，避免下一轮 LLM 请求里出现悬空 toolCall。

UI 规范：

- 全部问题平铺渲染，不使用 tab 分页。
- 每题展示 header chip、问题、多/单选标记、所有 option；description 可省略，适合比例、数量、是否这类 label 已经足够清楚的简单问卷。
- 每题底部固定一条自由备注 textarea；不要再让 LLM 自己加“其他”选项，备注就是用户表达自由回答的入口。
- 至少在每题里勾了一个 option 或写了备注，提交按钮才可用；右上角“全部你来定”按钮调用 `cancelAgentQuestion`，语义是让 Agent 代用户决定，不是取消任务。

`AgentPendingQuestion`：

```ts
type AgentPendingQuestion = {
  toolCallId: string
  agentTurnId: string
  questions: AskUserQuestionItem[]
  createdAt: number
}
```

不要把 resolver 存进会话 sidecar 或 `AgentPendingQuestion`；Promise resolver 仅活在内存里。

## Agent 图片任务

`AgentImageTask` 表示 Agent 工具调用创建的“意图”和审批状态。真实生成仍由 `GenerationJob` 表示。

```ts
type AgentImageTaskStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'canceled'

type AgentImageTask = {
  id: string
  toolCallId: string
  agentTurnId: string
  createdAt: number
  status: AgentImageTaskStatus
  request: {
    prompt: string
    requestedImageId: string
    reservedImageIds: string[]
    modelId: ModelConfig['id']
    resolution: string
    aspectRatio: string
    batchCount: number
    referenceImageIds: string[]
    options: Record<string, unknown>
    stackId?: string
    parentImageId?: string
  }
  generationJobId?: string
  resultImageIds: string[]
  renamedImageIds: boolean
  error?: string
}
```

原则：

- 审批前不要创建真实 `GenerationJob`。
- 审批通过后再进入 `useGenerationQueue`。
- 用户拒绝任务时，不创建 `GenerationJob`。
- 用户取消已通过任务时，同时取消对应 `GenerationJob`。
- `generationJobId` 是 Agent session 和真实生成队列之间的桥。
- `AgentImageTask` 必须保持可序列化：不要存 `ModelConfig` 对象、`PlaygroundImage.data`、Promise resolver、AbortController。只存 `modelId`、图片 ID、状态、错误和队列 linkage。

## 任务并发与 abort

- 同一轮 Agent 回复中可能有多个 `GenImage`。因为工具立即返回，即便底层 tool execution 是串行的，也能快速创建所有 task。
- 用户在审批界面取消 pending task 时，直接把 sidecar task 置为 `rejected` 并释放未产出的预留 ID。
- 用户取消已进入队列的 task 时，同时取消对应 `GenerationJob`，保留已成功的 `resultImageIds` 子集，并释放未产出的预留 ID。
- `agent.abort()` 只中断当前 LLM loop；已创建的 `AgentImageTask` 是 session sidecar 状态，不因 abort 自动丢失。需要清空会话时再清理 task 和 turn callback state。

## UI 行为

### Agent 对话

`GenImage` 工具调用直接渲染为对话流里的富卡片，是审批和状态展示的唯一入口；不再使用浮层或在 Output Panel 镜像。

卡片展示：

- 预留图片 ID 列表
- 模型 / 分辨率 / 比例 / 数量
- 参考图 ID
- 当前状态徽章（待审批 / 排队中 / 生成中 / 已完成 / 失败 / 已取消）
- 提示词（折叠）
- 完成后展示结果缩略图
- 错误信息（失败时）
- `生成` / `取消` 操作按钮（按状态显隐）

其它工具（`ReadImage` 等）仍走紧凑行样式。

### Output Panel

Output Panel 不再单独渲染 `AgentImageTask` 卡片；agent 生成的图片走和直接生成相同的 stack 渲染路径，在图库里出现。

### 图片 ID 展示

`src/components/StackItemThumb.tsx` 最终需要在左上角编号 `#1` 下面展示图片 ID / 名字。

- Agent 生成图展示语义 ID，例如 `苹果海报_2`。
- 非 Agent 直接生成图继续展示当前 UUID / 短 ID。
- slot 占位项如果已经有预留 ID，也应显示预留图片 ID。

## 图片 registry

Agent 需要统一图片 ID 语义，维护运行期图片索引：

```ts
type AgentImageRegistryEntry = {
  id: string
  image?: PlaygroundImage | PlaygroundImageMeta | AgentChatAttachment
  source: 'agent_attachment' | 'reference' | 'history' | 'generated'
  status: 'ready' | 'reserved' | 'failed' | 'rejected'
  createdAt: number
}
```

`GenImage.reference_image_ids` 可以引用：

- Agent 对话附件图
- 当前参考图区图片
- 历史生成图
- Agent 刚生成完成并回传的图片

registry 不应该把大对象写入 localStorage。图片二进制继续走 IndexedDB / blob cache。

## 演进方向

- `useAgentPlayground.ts` 目前是 Agent 领域 orchestration 的主入口；继续新增 Agent 会话、工具、图片任务或 registry 行为时，优先在这里或本目录的领域模块内落地，不要把逻辑搬回 `usePlayground`。
- 如果 `useAgentPlayground.ts` 继续膨胀，下一步按真实边界拆成 `useAgentSessions`、`useAgentImageTasks`、`useAgentRuntime` 等内部 hook，但仍保留 `useAgentPlayground` 作为组件层和 `usePlayground` 的单一入口。
- 工具 schema normalization 保持在 `src/agent/tools/*`；涉及 IndexedDB、generation queue、API key、blob cache 的 orchestration 保持在 `useAgentPlayground`。
- `useGenerationQueue` 继续只接收真实生成请求和取消请求，不反向依赖 Agent 类型或审批语义。
