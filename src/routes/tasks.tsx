import { Suspense, lazy } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const TasksScreen = lazy(async () => {
  const module = await import('@/screens/tasks/tasks-screen')
  return { default: module.TasksScreen }
})

const searchSchema = z.object({
  assignee: z.string().optional(),
})

function TasksPending() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent-500 border-r-transparent mb-3" />
        <p className="text-sm text-primary-500">Loading tasks...</p>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/tasks')({
  ssr: false,
  validateSearch: searchSchema,
  component: TasksRoute,
  pendingComponent: TasksPending,
})

function TasksRoute() {
  return (
    <Suspense fallback={<TasksPending />}>
      <TasksScreen />
    </Suspense>
  )
}
