import { Suspense, lazy } from 'react'
import { createFileRoute } from '@tanstack/react-router'

const Conductor = lazy(async () => {
  const module = await import('@/screens/gateway/conductor')
  return { default: module.Conductor }
})

function ConductorRoute() {
  return (
    <Suspense fallback={<ConductorPending />}>
      <Conductor />
    </Suspense>
  )
}

function ConductorPending() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent-500 border-r-transparent mb-3" />
        <p className="text-sm text-primary-500">Loading conductor...</p>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/conductor')({
  component: ConductorRoute,
})
