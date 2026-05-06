import { Suspense, lazy, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

const ProfilesScreen = lazy(async () => {
  const module = await import('@/screens/profiles/profiles-screen')
  return { default: module.ProfilesScreen }
})

const CrewScreen = lazy(async () => {
  const module = await import('@/screens/crew/crew-screen')
  return { default: module.CrewScreen }
})

function ProfilesPending() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent-500 border-r-transparent mb-3" />
        <p className="text-sm text-primary-500">Loading profiles...</p>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/profiles')({
  ssr: false,
  component: ProfilesRoute,
})

function ProfilesRoute() {
  const [tab, setTab] = useState<'profiles' | 'monitoring'>('profiles')

  return (
    <Suspense fallback={<ProfilesPending />}>
      <div className="min-h-full overflow-y-auto bg-surface text-ink">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-5 flex gap-1 rounded-lg border border-primary-200 bg-primary-50/85 p-1 backdrop-blur-xl">
            <button
              onClick={() => setTab('profiles')}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'profiles'
                  ? 'bg-primary-100 text-ink shadow-sm dark:bg-neutral-800'
                  : 'text-primary-500 hover:text-ink'
              }`}
            >
              Profiles
            </button>
            <button
              onClick={() => setTab('monitoring')}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'monitoring'
                  ? 'bg-primary-100 text-ink shadow-sm dark:bg-neutral-800'
                  : 'text-primary-500 hover:text-ink'
              }`}
            >
              Monitoring
            </button>
          </div>
          {tab === 'profiles' ? <ProfilesScreen /> : <CrewScreen />}
        </div>
      </div>
    </Suspense>
  )
}
