import { Suspense, lazy } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'

const HermesWorldEmbed = lazy(async () => {
  const module = await import('@/screens/playground/hermes-world-embed')
  return { default: module.HermesWorldEmbed }
})

function PlaygroundPending() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent-500 border-r-transparent mb-3" />
        <p className="text-sm text-primary-500">Loading playground...</p>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/playground')({
  ssr: false,
  component: PlaygroundRoute,
  pendingComponent: PlaygroundPending,
})

function PlaygroundRoute() {
  usePageTitle('HermesWorld')
  return (
    <Suspense fallback={<PlaygroundPending />}>
      <HermesWorldEmbed />
    </Suspense>
  )
}
