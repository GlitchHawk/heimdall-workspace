import { Suspense, lazy } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import BackendUnavailableState from '@/components/backend-unavailable-state'
import { getUnavailableReason } from '@/lib/feature-gates'
import { useFeatureAvailable } from '@/hooks/use-feature-available'

const McpScreen = lazy(async () => {
  const module = await import('@/screens/mcp/mcp-screen')
  return { default: module.McpScreen }
})

function McpPending() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent-500 border-r-transparent mb-3" />
        <p className="text-sm text-primary-500">Loading MCP servers...</p>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/mcp')({
  ssr: false,
  component: McpRoute,
})

function McpRoute() {
  const native = useFeatureAvailable('mcp')
  const fallback = useFeatureAvailable('mcpFallback')
  if (!native && !fallback) {
    return (
      <BackendUnavailableState
        feature="MCP Servers"
        description={getUnavailableReason('mcp')}
      />
    )
  }
  return (
    <Suspense fallback={<McpPending />}>
      <McpScreen />
    </Suspense>
  )
}
