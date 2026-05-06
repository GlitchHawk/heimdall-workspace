import { Suspense, lazy } from 'react'
import { createFileRoute } from '@tanstack/react-router'

const DashboardScreen = lazy(async () => {
  const module = await import('@/screens/dashboard/dashboard-screen')
  return { default: module.DashboardScreen }
})

function DashboardPending() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent-500 border-r-transparent mb-3" />
        <p className="text-sm text-primary-500">Loading dashboard...</p>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/dashboard')({
  ssr: false,
  component: DashboardRoute,
})

function DashboardRoute() {
  return (
    <Suspense fallback={<DashboardPending />}>
      <DashboardScreen />
    </Suspense>
  )
}
