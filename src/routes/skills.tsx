import { Suspense, lazy } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import BackendUnavailableState from '@/components/backend-unavailable-state'
import { getUnavailableReason } from '@/lib/feature-gates'
import { useFeatureAvailable } from '@/hooks/use-feature-available'

const SkillsScreen = lazy(async () => {
  const module = await import('@/screens/skills/skills-screen')
  return { default: module.SkillsScreen }
})

function SkillsPending() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent-500 border-r-transparent mb-3" />
        <p className="text-sm text-primary-500">Loading skills...</p>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/skills')({
  ssr: false,
  component: SkillsRoute,
})

function SkillsRoute() {
  if (!useFeatureAvailable('skills')) {
    return (
      <BackendUnavailableState
        feature="Skills"
        description={getUnavailableReason('Skills')}
      />
    )
  }
  return (
    <Suspense fallback={<SkillsPending />}>
      <SkillsScreen />
    </Suspense>
  )
}
