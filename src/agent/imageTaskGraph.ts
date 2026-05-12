import { isTerminalAgentImageTaskStatus, type AgentImageTask } from './imageTasks'

export type AgentImageTaskDependency = {
  imageId: string
  task: AgentImageTask
}

export type BlockedAgentImageTask = {
  task: AgentImageTask
  dependency: AgentImageTaskDependency
}

export function agentImageTaskOutputIds(task: AgentImageTask): string[] {
  return Array.from(new Set([...task.request.reservedImageIds, ...task.resultImageIds]))
}

export function buildAgentImageTaskOutputIndex(tasks: AgentImageTask[]): Map<string, AgentImageTask> {
  const outputIndex = new Map<string, AgentImageTask>()
  for (const task of tasks) {
    for (const id of agentImageTaskOutputIds(task)) {
      if (!outputIndex.has(id)) outputIndex.set(id, task)
    }
  }
  return outputIndex
}

export function findAgentImageTaskDependencies(
  tasks: AgentImageTask[],
  task: AgentImageTask,
): AgentImageTaskDependency[] {
  const outputIndex = buildAgentImageTaskOutputIndex(tasks)
  const seenDependencyKeys = new Set<string>()
  const dependencies: AgentImageTaskDependency[] = []
  for (const imageId of task.request.referenceImageIds) {
    const dependencyTask = outputIndex.get(imageId)
    const dependencyKey = dependencyTask ? `${dependencyTask.id}\u0000${imageId}` : ''
    if (!dependencyTask || dependencyTask.id === task.id || seenDependencyKeys.has(dependencyKey)) continue
    seenDependencyKeys.add(dependencyKey)
    dependencies.push({ imageId, task: dependencyTask })
  }
  return dependencies
}

export function findActiveAgentImageTaskDependencies(
  tasks: AgentImageTask[],
  task: AgentImageTask,
): AgentImageTaskDependency[] {
  return findAgentImageTaskDependencies(tasks, task).filter(
    (dependency) =>
      !isTerminalAgentImageTaskStatus(dependency.task.status) &&
      !dependency.task.resultImageIds.includes(dependency.imageId),
  )
}

export function findUnfulfilledAgentImageTaskDependency(
  tasks: AgentImageTask[],
  task: AgentImageTask,
): AgentImageTaskDependency | null {
  const outputIndex = buildAgentImageTaskOutputIndex(tasks)
  for (const imageId of task.request.referenceImageIds) {
    const dependencyTask = outputIndex.get(imageId)
    if (!dependencyTask || dependencyTask.id === task.id) continue
    if (!isTerminalAgentImageTaskStatus(dependencyTask.status)) continue
    if (dependencyTask.resultImageIds.includes(imageId)) continue
    return { imageId, task: dependencyTask }
  }
  return null
}

export function findBlockedWaitingAgentImageTasks(tasks: AgentImageTask[]): BlockedAgentImageTask[] {
  const blocked: BlockedAgentImageTask[] = []
  for (const task of tasks) {
    if (task.status !== 'waiting_dependencies') continue
    const dependency = findUnfulfilledAgentImageTaskDependency(tasks, task)
    if (dependency) blocked.push({ task, dependency })
  }
  return blocked
}

export function findStartableWaitingAgentImageTasks(tasks: AgentImageTask[]): AgentImageTask[] {
  const startable: AgentImageTask[] = []
  for (const task of tasks) {
    if (task.status !== 'waiting_dependencies') continue
    if (findActiveAgentImageTaskDependencies(tasks, task).length > 0) continue
    if (findUnfulfilledAgentImageTaskDependency(tasks, task)) continue
    startable.push(task)
  }
  return startable
}

export function findAgentImageTaskDependencyCycle(tasks: AgentImageTask[], startTaskId?: string): string[] | null {
  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const path: string[] = []

  const visit = (taskId: string): string[] | null => {
    if (visiting.has(taskId)) {
      const startIndex = path.indexOf(taskId)
      return startIndex >= 0 ? [...path.slice(startIndex), taskId] : [taskId, taskId]
    }
    if (visited.has(taskId)) return null
    const task = taskById.get(taskId)
    if (!task) return null

    visiting.add(taskId)
    path.push(taskId)
    for (const dependency of findAgentImageTaskDependencies(tasks, task)) {
      const cycle = visit(dependency.task.id)
      if (cycle) return cycle
    }
    path.pop()
    visiting.delete(taskId)
    visited.add(taskId)
    return null
  }

  if (startTaskId) return visit(startTaskId)
  for (const task of tasks) {
    const cycle = visit(task.id)
    if (cycle) return cycle
  }
  return null
}
