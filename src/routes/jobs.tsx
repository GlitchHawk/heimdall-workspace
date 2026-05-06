import { Suspense, lazy } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import BackendUnavailableState from '@/components/backend-unavailable-state'
import { getUnavailableReason } from '@/lib/feature-gates'
import { useFeatureAvailable } from '@/hooks/use-feature-available'

const JobsScreen = lazy(async () => {
  const module = await import('@/screens/jobs/jobs-screen')
  return { default: module.JobsScreen }
})

function JobsPending() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent-500 border-r-transparent mb-3" />
        <p className="text-sm text-primary-500">Loading jobs...</p>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/jobs')({
  ssr: false,
  component: function JobsRoute() {
    if (!useFeatureAvailable('jobs')) {
      return (
        <BackendUnavailableState
          feature="Jobs"
          description={getUnavailableReason('Jobs')}
        />
      )
    }
    return (
      <Suspense fallback={<JobsPending />}>
        <JobsScreen />
      </Suspense>
    )
  },
  pendingComponent: JobsPending,
})
