# Agent 图像工具设计

本文档记录 Agent 接入第一批图像能力的产品行为和技术抽象。当前目标不是让 Agent 直接绕过用户生成图片，而是让 Agent 能创建可审批的生成任务，并在任务完成后把结果回传给 Agent，形成可继续推理的循环。

## 目标

- 给 Agent 增加第一批图像工具：`GenImage` 和 `ReadImage`。
- Agent 调用 `GenImage` 时创建生图任务，而不是立即静默生成。
- 生图任务默认进入待审批状态，用户可以在 Agent 对话和 Output Panel 中查看任务参数并选择「取消」或「生成」。
- Agent 输入区提供「自动通过」开关；开启后，Agent 创建的任务自动通过审批并进入生成队列。
- Agent 能引用用户上传的参考图和历史生成图，通过 `ReadImage` 读取图片内容、来源、参考图和生成提示词。
- Agent 能为生成图声明语义化 `image_id`，系统负责冲突改名并把真实保存 ID 告诉 Agent。
- 当一批 Agent 创建的生图任务全部终结后，应用回调 Agent：插入一条带 `<system>` XML 标签的 User Message，让 Agent 理解这是系统事件并继续下一轮响应。

## `GenImage` 工具

工具名：`GenImage`

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

字段说明：

| 字段                  | 说明                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `image_id`            | Agent 期望的输出图片 ID，也是语义化图片名。系统会把它规范化并用于保存生成图；如果冲突，会自动添加后缀。 |
| `prompt`              | 生成提示词。必填，非空。                                                                                |
| `model`               | 模型 ID。应映射到 `MODEL_CONFIGS` 中的 `ModelConfig.id`。                                               |
| `resolution`          | 分辨率。必须是目标模型支持的值；无效时可规范化到模型默认值并在任务卡片中展示实际值。                    |
| `ratio`               | 宽高比。对应现有 `aspectRatio`。必须是目标模型支持的值；无效时可规范化到模型默认值。                    |
| `n`                   | 生成数量。必须限制在 `1..model.maxBatchCount`。                                                         |
| `reference_image_ids` | 参考图片 ID 列表。可引用用户在 Agent 对话中上传的图片，也可引用历史生成图。                             |

工具执行行为：

1. 校验并规范化参数。
2. 根据 `image_id` 和 `n` 预留真实输出图片 ID。
3. 解析 `reference_image_ids` 为可用于生成的 `PlaygroundImage[]`。
4. 创建待审批的 Agent 生图任务。
5. 工具立即返回成功结果，例如：`任务已经提交，等待用户审批。`
6. 如果「自动通过」已开启，任务直接进入生成队列，工具结果可返回：`任务已经提交并自动开始生成。`

注意：`GenImage` 工具本身是异步工具，但它的异步边界只到“任务创建成功”。真实图片生成由队列继续处理，不阻塞本次工具调用。

### 输出图片 ID 规则

不再单独引入 `image_name`。`image_id` 同时承担“Agent 想要的语义名”和“后续引用 ID”的职责，避免一个图片同时存在 name/id 两套称呼。

规则：

- `image_id` 必填，建议 Agent 使用短且可读的语义名，例如 `苹果海报`、`雨夜赛博猫`。
- 系统会对 `image_id` 做轻量规范化：去掉首尾空白，把内部连续空白压成 `_`，过滤明显不适合作为 ID 的控制字符。
- 如果 `n = 1`，优先使用规范化后的 `image_id` 作为真实保存 ID。
- 如果 `n > 1`，第一张优先使用 `image_id`，后续使用 `image_id_2`、`image_id_3`。
- 如果任一 ID 已存在于图片 registry / IndexedDB / 当前预留集合中，自动递增后缀直到可用，例如 `苹果` 已存在时保存为 `苹果_2`；如果 `苹果_2` 也存在，则保存为 `苹果_3`。
- ID 在创建任务时就预留；这样工具结果可以立即告诉 Agent 未来图片会保存成哪些 ID。
- 如果用户拒绝任务，预留 ID 释放；最终回调 Agent 时说明这些 ID 没有产出图片。
- 如果任务已通过但生成失败，预留 ID 不生成图片；最终回调 Agent 时说明失败原因。

工具结果应包含请求 ID 和真实预留 ID 的映射：

```json
{
  "status": "pending_approval",
  "requested_image_id": "苹果",
  "reserved_image_ids": ["苹果_2", "苹果_3"],
  "renamed": true,
  "message": "任务已经提交，等待用户审批。image_id 与已有图片冲突，已预留为 苹果_2、苹果_3。"
}
```

真实生成成功后，生成图的 `PlaygroundImage.id` 使用预留 ID，并写入 IndexedDB。非 Agent 直接生成仍可继续使用 UUID；只有 Agent 指定 `image_id` 的任务走语义 ID。

## `ReadImage` 工具

工具名：`ReadImage`

参数：

```ts
type ReadImageToolArgs = {
  image_id: string
  offset?: number
  limit?: number
}
```

字段说明：

| 字段       | 说明                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| `image_id` | 要读取的图片 ID。可以是用户附件图、当前参考图、历史图、生成图，或 `GenImage` 工具返回的真实保存 ID。 |
| `offset`   | 可选。提示词起始行号。默认不填；只要传入 `offset > 0`，工具就进入“只读提示词续段”模式。              |
| `limit`    | 可选。读取提示词行数。不填时命中和标准 Read 工具一致的最大 2000 行限制。                             |

工具执行行为：

1. 根据 `image_id` 在统一图片 registry 中查找图片。
2. 如果图片不存在，返回工具错误，提示 Agent 使用可用 ID。
3. 如果图片存在但尚未生成完成，返回工具错误或结构化状态：`not_ready`。
4. 如果 `offset` 未提供或小于等于 `0`，进入默认看图模式：返回图片元信息、生成上下文、提示词编号行文本和 image content block。
5. 如果 `offset > 0`，进入提示词续读模式：只返回提示词编号行文本，不重复发送 image content block，避免浪费上下文。

工具描述需要明确告诉 Agent：

- 第一次查看图片时，不传 `offset`；这样可以获得图片 base64、来源、参考图 ID，以及从第 1 行开始的提示词内容。
- 如果提示词被 2000 行或字符上限截断，需要继续读提示词，再传 `offset` 和 `limit`。
- 一旦传入 `offset > 0`，工具不会再次返回图片，只返回提示词文本片段。

### 默认看图模式

默认看图模式返回给 LLM 的 tool result 是一个文本 block，加一个 image content block。文本 block 先给图片来源和生成上下文，再给生成提示词的编号行文本；image block 让视觉模型真正看图。

成功返回时的 tool result content：

```ts
type ReadImageDefaultResultContent = [
  {
    type: 'text'
    text: string // summary JSON + optional prompt numbered lines
  },
  {
    type: 'image'
    data: string // base64
    mimeType: string
  },
]

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

`prompt_preview` 固定取生成提示词前 100 个字符。`prompt_output_text` 使用 Read 风格编号行，默认从第 1 行开始读取，最多命中 2000 行和全局字符上限。超出时追加截断提示。Agent 如果需要继续读取，从截断提示里的行号继续用 `offset/limit` 调用 `ReadImage`；这时不会再次收到图片。

### 提示词续读模式

当 `offset > 0` 时，`ReadImage` 只读取生成提示词，不返回 image content block。`offset` 是 1-indexed 起始行号，`limit` 是读取行数；`limit` 不提供时命中默认 2000 行限制。输出使用和标准 Read 工具一致的编号行格式：

```txt
     1→第一行提示词
     2→第二行提示词
```

如果输出被限制截断，追加提示行：

```txt
… (12 more lines truncated due to 2000 line limit, prompt has 3200 lines total, use offset/limit to read other parts)
```

如果 `offset` 超过提示词总行数，返回类似：

```txt
<system-reminder>Warning: the prompt exists but is shorter than the provided offset (120). The prompt has 43 lines.</system-reminder>
```

如果图片不存在或不是生成图，返回标准工具错误文本：

```txt
<tool_use_error>Image does not exist.</tool_use_error>
```

```txt
<tool_use_error>Image prompt is only available for generated images.</tool_use_error>
```

如果 Agent 需要确认提示词来源和参考图，`ReadImage` 可以在编号行之前追加一行短 header，但仍保持纯文本输出：

```txt
[prompt] image_id=苹果海报_2 references=ref_a,ref_b total_lines=12
     1→第一行提示词
     2→第二行提示词
```

行为：

1. 根据 `image_id` 查找图片。
2. 如果图片不存在，返回 `<tool_use_error>Image does not exist.</tool_use_error>`。
3. 如果图片不是生成图，返回 `<tool_use_error>Image prompt is only available for generated images.</tool_use_error>`。
4. 如果是生成图，把完整 prompt 当成虚拟文本文件，按换行拆成行。
5. `limit < 0` 时按 `0` 处理。
6. 返回编号行文本；如果超过行数或字符上限，用截断提示告诉 Agent 继续使用 `offset/limit` 读取其它部分。

## 任务状态抽象

现有 `src/hooks/useGenerationQueue.ts` 已经负责真实生成队列。Agent 任务需要增加一个审批层，建议拆成两层：

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
  createdAt: number
  status: AgentImageTaskStatus
  request: {
    prompt: string
    requestedImageId: string
    reservedImageIds: string[]
    model: ModelConfig
    resolution: string
    aspectRatio: string
    batchCount: number
    referenceImageIds: string[]
    referenceImages: PlaygroundImage[]
    options: Record<string, unknown>
  }
  generationJobId?: string
  resultImageIds: string[]
  renamedImageIds: boolean
  error?: string
}
```

建议原则：

- `AgentImageTask` 表示 Agent 工具调用创建的“意图”和审批状态。
- `requestedImageId` 是 Agent 请求的语义 ID；`reservedImageIds` 是系统实际预留、最终写入 IndexedDB 的图片 ID。
- `GenerationJob` 继续表示真正进入生成队列后的执行状态。
- 审批前不要把任务塞进 active generation queue；否则 Output Panel 会把它当成排队/运行任务处理。
- 审批通过后再调用 `enqueueGenerationJob` 创建真实 `GenerationJob`，并把 `generationJobId` 记录回 `AgentImageTask`。
- 用户拒绝任务时，`AgentImageTask.status = 'rejected'`，不创建 `GenerationJob`。
- 如果用户取消已经通过的任务，则同时取消对应 `GenerationJob`。

## UI 行为

### Agent 对话

Agent 调用 `GenImage` 后，对话区需要出现轻量任务摘要卡片。对话区不承载完整任务管理，避免聊天流被大块参数卡片打断。

摘要卡片展示：

- 图片 ID / 任务名
- 当前状态
- 操作按钮：
  - `取消`：拒绝待审批任务，或取消已进入队列的生成任务。
  - `生成`：审批通过并创建真实生成队列任务。

摘要卡片交互：

- 点击卡片主体时，滚动到 Output Panel 中对应的完整任务卡片。
- 目标 Output 卡片需要短暂高亮，便于用户建立“聊天摘要 ↔ 生成任务”的对应关系。
- 如果对应任务已经被清理或不存在，对话卡片保留状态文案，不执行滚动。

完整参数展示放在 Output Panel，对话摘要只保留决策所需信息。Output 完整卡片展示：

- 提示词
- 请求图片 ID / 实际预留图片 ID
- 模型
- 分辨率
- 宽高比
- 数量
- 参考图 ID 或缩略图
- 当前状态
- 操作按钮：
  - `取消`：拒绝待审批任务，或取消已进入队列的生成任务。
  - `生成`：审批通过并创建真实生成队列任务。

对话输入区需要增加「自动通过」按钮：

- 按钮点击后在启用 / 停用之间切换。
- 状态应放在 `usePlayground`，因为移动端和桌面端共用同一个 Agent 会话。
- 开启后，Agent 创建的任务不再停留在 `pending_approval`，而是直接调用 `enqueueGenerationJob`。
- UI 上需要明确显示当前是否自动通过，避免用户误以为 Agent 只是提出建议。

### Output Panel

Output Panel 也需要展示 Agent 创建的待审批任务：

- 待审批任务应展示在图库/队列顶部或对应 stack 中。
- 卡片内容展示完整参数：提示词、模型、分辨率、宽高比、数量、参考图、请求 ID、真实预留 ID。
- 操作按钮同样是「取消」和「生成」。
- 审批通过后，卡片状态切换为真实生成队列状态，后续沿用现有队列展示。
- Output 任务卡片需要支持被外部定位：Agent 对话摘要点击后滚动到该卡片，并触发短暂高亮。

### Output 缩略图图片 ID

`src/components/StackItemThumb.tsx` 在 Output Panel 中需要展示图片 ID，也就是图片名字。

展示规则：

- 对图片项，在左上角编号 `#1` 下面展示 `image.id`。
- 对 Agent 生成图，这个 ID 通常是 Agent 声明并经系统去重后的语义化 ID，例如 `苹果海报_2`。
- 对非 Agent 直接生成图，仍展示当前 UUID/短 ID；后续可以再做显示截断。
- 文案保持紧凑，最多一行截断，不抢占缩略图主体。
- slot 占位项如果已经有 `reservedImageIds[slot.index]`，也应显示预留图片 ID；否则只显示 `#n`。

## Agent 工具时序

`GenImage` 的关键点是“工具调用先闭环，图片生成后再用事件回调唤醒 Agent”。它不是一个等待图片全部生成后才返回的长阻塞工具。

```mermaid
sequenceDiagram
  autonumber
  participant U as 用户
  participant A as Agent
  participant S as AgentSession
  participant Q as useGenerationQueue
  participant UI as Agent 对话 / Output Panel

  U->>A: 发送消息
  A->>S: 调用 GenImage(image_id, prompt, model, resolution, ratio, n, reference_image_ids)
  S->>S: 校验参数、解析参考图、预留真实 image_ids
  S->>UI: 创建 AgentImageTask
  alt 自动通过关闭
    UI-->>U: 显示待审批卡片
    S-->>A: 工具结果：任务已提交，等待用户审批，返回 reserved_image_ids
    U->>UI: 点击「生成」或「取消」
  else 自动通过开启
    S->>Q: enqueueGenerationJob(..., reservedImageIds)
    S-->>A: 工具结果：任务已提交并自动开始生成，返回 reserved_image_ids
  end
  alt 用户批准
    UI->>S: approve task
    S->>Q: enqueueGenerationJob(..., reservedImageIds)
    Q-->>S: slot 成功 / 失败 / 取消事件
  else 用户拒绝
    UI->>S: reject task
  end
  S->>S: 等待同一 agentTurnId 下所有 GenImage 任务终结
  S->>A: 插入 User Message：&lt;system&gt;tool GenImage finished...&lt;/system&gt;
  A->>A: 继续下一轮推理；如需看图则调用 ReadImage(image_id)
```

事件周转原则：

1. Agent 一轮回复中可以并行调用多个 `GenImage`。
2. 每个工具调用立即创建 `AgentImageTask` 并返回工具结果。
3. 真实生成完成、拒绝、取消或失败都算任务终结。
4. 同一个 `agentTurnId` 下所有 `GenImage` 任务都终结后，应用插入一条 User Message 触发 Agent 继续。
5. 这条消息内容使用 `<system>` 标签，但消息角色仍是 user；不要修改 Agent 的 system prompt。

## Agent 回调循环

Agent 可能在一轮回复中并行调用多个 `GenImage` 工具。例如：

- 工具调用 A：`n = 2`
- 工具调用 B：`n = 2`
- 工具调用 C：`n = 2`

这代表一共 6 张图的生成意图。应用需要等待这一组工具任务全部终结，再回调 Agent。

终结状态包括：

- 用户拒绝
- 用户取消
- 生成失败
- 生成成功

当同一批工具任务全部终结后，应用向 Agent 插入一条 User Message，并触发下一轮 Agent task。消息内容用 `<system>` XML tag 标明这是应用系统事件。示例：

```txt
<system>
tool GenImage call xxx1 has been finished.
status: completed
image_ids: img_abc, img_def

tool GenImage call xxx2 has been finished.
status: rejected
image_ids:

tool GenImage call xxx3 has been finished.
status: failed
error: OpenAI API Key is missing
image_ids:
</system>
```

注意：这里不是修改 `systemPrompt`，也不是插入 LLM 原生 system role。它应该进入 Agent 消息流，形态类似：

```ts
const text = '<system>...</system>'

if (agent.state.isStreaming) {
  await agent.queueMessage({
    role: 'user',
    content: [{ type: 'text', text }],
    timestamp: Date.now(),
  })
} else {
  await agent.prompt(text)
}
```

`@mariozechner/pi-agent` 的 `prompt(...)` 接收字符串和附件，不接收完整 user message object。回调发生时如果 Agent 仍在 streaming，就用 `queueMessage(...)` 把这条 user message 排到后续 turn；不要把它拼进 `systemPrompt`。

这样做的原因：

- Agent 能在普通对话上下文里看见任务结果。
- 不污染长期 system prompt。
- 后续多会话持久化时，任务完成事件可以作为会话消息恢复。

实现建议：

- 为每轮 Agent 工具调用建立一个 batch/group ID。
- 每个 `AgentImageTask` 记录 `toolCallId` 和 `agentTurnId`。
- `GenImage` 工具立即返回“任务已提交”，让当前工具调用闭环。
- 真实生成结果完成后，不直接修改已完成的工具结果，而是通过 `agent.prompt(text)` / `agent.queueMessage(userMessage)` 插入带 `<system>` 标签的 User Message。
- 插入事件消息后触发新的 Agent prompt/task，让 Agent 基于图片 ID 继续决策。

## Agent 会话状态内聚

虽然当前不做 Agent 持久化，但状态需要先按会话内聚，避免继续把 Agent 相关状态散落在 `usePlayground` 顶层。建议引入 `AgentSession` 或同等 hook 内部模型，先单会话运行，后续自然扩展成多会话。

```ts
type AgentSession = {
  id: string
  agent: Agent
  messages: AgentMessage[]
  draft: string
  attachments: AgentChatAttachment[]
  autoApproveImageTasks: boolean
  imageTasks: AgentImageTask[]
  imageRegistry: Map<string, AgentImageRegistryEntry>
  pendingTurnCallbacks: Map<string, AgentTurnCallbackState>
}

type AgentTurnCallbackState = {
  agentTurnId: string
  taskIds: string[]
  callbackQueued: boolean
}
```

归属建议：

- `AgentSession` 拥有 Agent 实例、消息、附件、自动通过开关、图片 registry、Agent 创建的生图任务。
- `usePlayground` 只持有当前 session 或 session 列表，并把必要字段/handler 透传给 UI。
- `useGenerationQueue` 仍只负责真实生成执行，不关心 Agent 会话。
- `AgentImageTask.generationJobId` 是 Agent session 与真实生成队列之间的桥。
- 后续多对话时，只需要把 `currentAgentSessionId` 切换到另一份 session；任务和图片 ID 不会混在全局散状态里。

### `@mariozechner/pi-agent` 语境

本项目实际依赖的是 `@mariozechner/pi-agent`，不是 `pi-coding-agent`。Agent 相关实现应按当前 API 组织：

- `Agent` 通过 `new Agent({ transport, initialState, messageTransformer?, queueMode? })` 创建。
- `agent.state` 持有 `systemPrompt`、`model`、`thinkingLevel`、`tools`、`messages`、`isStreaming`、`streamMessage`、`pendingToolCalls`、`error`。
- 用户输入用 `agent.prompt(input: string, attachments?: Attachment[])`。
- 运行中的后续 user message 用 `agent.queueMessage(message: AppMessage)` 排队。
- 工具通过 `agent.setTools(...)` 或 `agent.state.tools = tools` 注入。
- UI 用 `agent.subscribe(...)` 同步事件和快照。
- `agent.waitForIdle()` 可用于等待当前 prompt 结束。

本项目可以对应成：

- `@mariozechner/pi-agent` 继续只做 LLM loop，不认识图片任务审批。
- 新增 `AgentSession` / `useAgentSession`，拥有 `Agent` 实例、messages、draft、attachments、`autoApproveImageTasks`、`imageTasks`、`imageRegistry`、`pendingTurnCallbacks`。
- `GenImage` / `ReadImage` 以工具工厂创建，闭包读取 `AgentSession` 的 registry 和 task handlers；UI 不直接实现工具逻辑。
- `usePlayground` 保留全局生成参数、历史、`useGenerationQueue` 桥接函数，只把当前 `AgentSession` 和必要 handler 传给面板。
- Agent 对话和 Output Panel 订阅/读取同一份 session 状态：聊天里显示轻量摘要，Output Panel 显示完整任务卡；点击摘要只发起定位，不复制任务状态。
- 后续要做多 chat 或持久化时，只替换当前 session 或保存 session snapshot，不需要把散落在组件里的状态重新收编。

## 图片 ID 与 `ReadImage`

为了让 Agent 能自由引用图片，需要统一图片 ID 语义：

- 用户在 Agent 对话中上传的参考图必须有稳定 ID。
- 历史生成图已经有 `PlaygroundImageMeta.id`，可直接作为可引用 ID。
- Agent 生成图优先使用 Agent 声明的语义化 `image_id`；冲突时使用系统返回的真实保存 ID。
- `GenImage.reference_image_ids` 可以同时引用：
  - Agent 对话附件图
  - 当前参考图区图片
  - 历史生成图
  - Agent 刚生成完成并回传的图片

建议维护一个运行期图片索引：

```ts
type AgentImageRegistryEntry = {
  id: string
  image: PlaygroundImage | PlaygroundImageMeta | AgentChatAttachment
  source: 'agent_attachment' | 'reference' | 'history' | 'generated'
  status: 'ready' | 'reserved' | 'failed' | 'rejected'
  createdAt: number
}
```

这个 registry 不应该把大对象写入 localStorage。图片二进制继续走 IndexedDB/blob cache；Agent 对话附件如果需要跨刷新恢复，再单独设计持久化。

## 推荐实现边界

建议分阶段落地：

1. 建立 `AgentImageTask` 状态和审批 UI，不接真实 Agent 工具。
2. 建立图片 registry 和语义化 `image_id` 预留 / 冲突后缀逻辑。
3. 接入 `GenImage` 工具，让工具调用创建待审批任务。
4. 打通审批通过到 `useGenerationQueue.enqueueGenerationJob`。
5. 接入 `ReadImage` 工具，让 Agent 能读取用户附件图、生成图和生成提示词。
6. 实现任务完成后的 Agent 回调消息。

这样可以保持现有生成队列稳定，同时让 Agent 工具能力逐步接入。
