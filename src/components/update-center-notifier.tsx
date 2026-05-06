'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowUp02Icon,
  Cancel01Icon,
  Loading03Icon,
  Tick01Icon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/toast'

type ProductId = 'workspace' | 'agent'
type ProductUpdateStatus = {
  id: ProductId
  label: string
  installKind: 'git' | 'desktop' | 'docker' | 'unknown'
  version: string
  path: string | null
  repoPath: string | null
  branch: string | null
  currentHead: string | null
  latestHead: string | null
  updateAvailable: boolean
  canUpdate: boolean
  state: 'current' | 'available' | 'blocked' | 'unsupported' | 'error'
  reason: string | null
  blockingFiles?: Array<string>
  updateMode: string
}

type UpdateStatus = {
  ok: true
  checkedAt: number
  products: Record<ProductId, ProductUpdateStatus>
  updateAvailable: boolean
  pendingReleaseNotes?: Array<ReleaseNoteSection>
}

type ReleaseNoteSection = {
  product: ProductId
  label: string
  from: string | null
  to: string | null
  commits: Array<string>
}

type ApplyUpdateResult = {
  ok: boolean
  product: ProductId
  output?: string
  restartRequired?: boolean
  status?: ProductUpdateStatus
  releaseNotes?: Array<ReleaseNoteSection>
  error?: string
}

type Phase = 'idle' | 'updating' | 'done' | 'error'
type Notes = {
  id: string
  sections: Array<ReleaseNoteSection>
  updatedAt: number
}

const CHECK_INTERVAL_MS = 30 * 60 * 1000
const DISMISS_PREFIX = 'hermes-update-v2-dismissed:'
const NOTES_KEY = 'hermes-update-v2-release-notes'
const NOTES_SEEN_KEY = 'hermes-update-v2-release-notes-seen'

function shortSha(value: string | null | undefined): string {
  return value ? value.slice(0, 7) : 'unknown'
}

function productDismissKey(product: ProductUpdateStatus): string {
  return `${product.id}:${product.latestHead ?? product.version ?? 'unknown'}`
}

function notesId(sections: Array<ReleaseNoteSection>): string {
  return sections
    .map((section) => `${section.product}:${section.from}:${section.to}`)
    .sort()
    .join('|')
}

function storeNotes(sections: Array<ReleaseNoteSection>): Notes | null {
  if (!sections.length) return null
  const notes = { id: notesId(sections), sections, updatedAt: Date.now() }
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
  localStorage.removeItem(NOTES_SEEN_KEY)
  return notes
}

function readNotes(): Notes | null {
  try {
    const raw = localStorage.getItem(NOTES_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Notes
    if (!parsed?.id || !Array.isArray(parsed.sections)) return null
    if (localStorage.getItem(NOTES_SEEN_KEY) === parsed.id) return null
    return parsed
  } catch {
    return null
  }
}

export function UpdateCenterNotifier() {
  const queryClient = useQueryClient()
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const [phases, setPhases] = useState<Record<ProductId, Phase>>({
    workspace: 'idle',
    agent: 'idle',
  })
  const [errors, setErrors] = useState<Record<ProductId, string>>({
    workspace: '',
    agent: '',
  })
  const [notes, setNotes] = useState<Notes | null>(null)

  useEffect(() => {
    const values = new Set<string>()
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(DISMISS_PREFIX))
        values.add(localStorage.getItem(key) || '')
    }
    setDismissed(values)
    setNotes(readNotes())
  }, [])

  const { data } = useQuery({
    queryKey: ['update-status-v2'],
    queryFn: async () => {
      const res = await fetch('/api/update/status')
      if (!res.ok) return null
      return res.json() as Promise<UpdateStatus>
    },
    refetchInterval: CHECK_INTERVAL_MS,
    staleTime: CHECK_INTERVAL_MS,
    retry: false,
  })

  useEffect(() => {
    if (!data?.pendingReleaseNotes?.length) return
    const stored = storeNotes(data.pendingReleaseNotes)
    if (stored) setNotes((current) => current ?? stored)
  }, [data?.pendingReleaseNotes])

  const visibleProducts = useMemo(() => {
    const products = data ? [data.products.workspace, data.products.agent] : []
    return products.filter((product) => {
      // Product decision: only show the top-of-app update banner when a
      // one-click update is actually safe. Dirty checkouts, non-main branches,
      // and blocked/conflicting states still exist, but they belong in an
      // advanced update center view rather than a disruptive banner. See
      // Eric feedback 2026-05-04.
      if (!product.updateAvailable) return false
      if (!product.canUpdate) return false
      if (phases[product.id] === 'done') return false
      return !dismissed.has(productDismissKey(product))
    })
  }, [data, dismissed, phases])

  function dismiss(product: ProductUpdateStatus) {
    const key = productDismissKey(product)
    localStorage.setItem(`${DISMISS_PREFIX}${product.id}`, key)
    setDismissed((prev) => new Set([...prev, key]))
  }

  async function update(product: ProductUpdateStatus) {
    if (!product.canUpdate) return
    setPhases((prev) => ({ ...prev, [product.id]: 'updating' }))
    setErrors((prev) => ({ ...prev, [product.id]: '' }))
    try {
      const res = await fetch(
        `/api/update/${product.id === 'workspace' ? 'workspace' : 'agent'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      )
      const result = (await res.json()) as ApplyUpdateResult
      if (!res.ok || !result.ok) {
        setPhases((prev) => ({ ...prev, [product.id]: 'error' }))
        setErrors((prev) => ({
          ...prev,
          [product.id]: result.error || `${product.label} update failed`,
        }))
        return
      }
      setPhases((prev) => ({ ...prev, [product.id]: 'done' }))
      dismiss(product)
      const stored = result.releaseNotes?.length
        ? storeNotes(result.releaseNotes)
        : null
      if (stored) setNotes(stored)
      await queryClient.invalidateQueries({ queryKey: ['update-status-v2'] })
      toast(`${product.label} updated. Restart may be required.`, {
        type: 'success',
        duration: 7000,
      })
    } catch (err) {
      setPhases((prev) => ({ ...prev, [product.id]: 'error' }))
      setErrors((prev) => ({
        ...prev,
        [product.id]: err instanceof Error ? err.message : String(err),
      }))
    }
  }

  function closeNotes() {
    if (notes) localStorage.setItem(NOTES_SEEN_KEY, notes.id)
    setNotes(null)
  }

  // Auto-dismiss timer: fade away after 15s if not hovered
  const [autoDismissed, setAutoDismissed] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset timer whenever hovered state changes or visible products change
  useEffect(() => {
    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    // If hovered, don't auto-dismiss
    if (isHovered) {
      setAutoDismissed(false)
      return
    }

    // If there are visible products, start the 15s timer
    if (visibleProducts.length > 0 && !autoDismissed) {
      timerRef.current = setTimeout(() => {
        setAutoDismissed(true)
      }, 15000)
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [visibleProducts, isHovered, autoDismissed])

  // When auto-dismissed, actually dismiss all products after fade animation
  useEffect(() => {
    if (!autoDismissed || visibleProducts.length === 0) return

    // Wait for fade animation to complete (0.5s) then dismiss
    const dismissTimer = setTimeout(() => {
      visibleProducts.forEach((product) => dismiss(product))
      setAutoDismissed(false)
    }, 500)

    return () => clearTimeout(dismissTimer)
  }, [autoDismissed, visibleProducts])

  return (
    <>
      <ReleaseNotes notes={notes} onClose={closeNotes} />
      <div
        className="pointer-events-none fixed right-4 top-[calc(var(--titlebar-h,0px)+1rem)] z-[9998] flex w-[92vw] max-w-[380px] flex-col gap-3"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <AnimatePresence>
          {visibleProducts.map((product) => (
            <UpdateCard
              key={product.id}
              product={product}
              phase={phases[product.id]}
              error={errors[product.id]}
              onDismiss={() => dismiss(product)}
              onUpdate={() => update(product)}
              autoDismissed={autoDismissed}
            />
          ))}
        </AnimatePresence>
      </div>
    </>
  )
}

function UpdateCard({
  product,
  phase,
  error,
  onDismiss,
  onUpdate,
  autoDismissed,
}: {
  product: ProductUpdateStatus
  phase: Phase
  error: string
  onDismiss: () => void
  onUpdate: () => void
  autoDismissed: boolean
}) {
  const updating = phase === 'updating'
  const blocked = product.updateAvailable && !product.canUpdate
  const subtitle =
    phase === 'error'
      ? error
      : blocked
        ? product.reason || 'Update requires manual review.'
        : `${shortSha(product.currentHead)} → ${shortSha(product.latestHead)} · ${product.installKind}`

  return (
    <motion.div
      initial={{ opacity: 0, y: -24, scale: 0.96 }}
      animate={{ opacity: autoDismissed ? 0 : 1, y: autoDismissed ? -24 : 0, scale: autoDismissed ? 0.96 : 1 }}
      exit={{ opacity: 0, y: -24, scale: 0.96 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      // Firefox/Linux right-clicks on this card were intermittently eaten by
      // the surrounding motion/backdrop layers, making the modal feel
      // unresponsive and preventing copy/open-in-new-tab actions. Let the
      // native context menu open on the card itself and keep the event from
      // bubbling to the backdrop. See #286.
      onContextMenu={(event) => event.stopPropagation()}
      className="pointer-events-auto overflow-hidden rounded-2xl shadow-2xl select-text"
      style={{
        background: 'var(--theme-card)',
        border: '1px solid var(--theme-border)',
        color: 'var(--theme-text)',
        boxShadow: 'var(--theme-shadow-3)',
      }}
    >
      {updating ? (
        <div
          className="h-0.5 animate-pulse"
          style={{ background: 'var(--theme-accent)' }}
        />
      ) : null}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <div
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-xl',
            blocked || phase === 'error' ? 'bg-amber-500/15' : '',
          )}
          style={
            !blocked && phase !== 'error'
              ? {
                  background:
                    'color-mix(in srgb, var(--theme-accent) 14%, transparent)',
                }
              : undefined
          }
        >
          <HugeiconsIcon
            icon={
              updating
                ? Loading03Icon
                : phase === 'done'
                  ? Tick01Icon
                  : ArrowUp02Icon
            }
            size={16}
            strokeWidth={2}
            className={updating ? 'animate-spin' : undefined}
            style={{
              color:
                blocked || phase === 'error'
                  ? '#f59e0b'
                  : 'var(--theme-accent)',
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-[0.8em] font-semibold"
            style={{ color: 'var(--theme-text)' }}
          >
            {blocked
              ? `${product.label} update blocked`
              : `${product.label} update available`}
          </p>
          <p
            className={cn('text-[0.7em]', blocked ? '' : 'truncate')}
            style={{ color: 'var(--theme-muted)' }}
          >
            {subtitle}
          </p>
          {blocked && product.repoPath ? (
            <p
              className="mt-0.5 truncate font-mono text-[0.65em]"
              style={{ color: 'var(--theme-muted)' }}
              title={product.repoPath}
            >
              {product.repoPath}
            </p>
          ) : null}
          {blocked && product.blockingFiles && product.blockingFiles.length > 0 ? (
            <ul className="mt-1 max-h-20 overflow-auto pr-1">
              {product.blockingFiles.slice(0, 8).map((file) => (
                <li
                  key={file}
                  className="truncate font-mono text-[0.65em]"
                  style={{ color: 'var(--theme-muted)' }}
                  title={file}
                >
                  {file}
                </li>
              ))}
              {product.blockingFiles.length > 8 ? (
                <li
                  className="text-[0.65em] italic"
                  style={{ color: 'var(--theme-muted)' }}
                >
                  …and {product.blockingFiles.length - 8} more
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {product.canUpdate ? (
            <button
              type="button"
              onClick={onUpdate}
              disabled={updating}
              className="rounded-lg px-3 py-1 text-[0.75em] font-semibold text-gray-900 transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: 'var(--theme-accent)' }}
            >
              {updating ? 'Updating' : 'Update'}
            </button>
          ) : (
            <span
              className="rounded-lg px-2.5 py-1 text-[0.75em] font-semibold"
              style={{
                background: 'var(--theme-card2)',
                color: 'var(--theme-muted)',
              }}
            >
              Review required
            </span>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg p-1 transition-opacity hover:opacity-80"
            style={{ color: 'var(--theme-muted)' }}
            aria-label={`Dismiss ${product.label} update`}
          >
            <HugeiconsIcon icon={Cancel01Icon} size={12} strokeWidth={2} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function ReleaseNotes({
  notes,
  onClose,
}: {
  notes: Notes | null
  onClose: () => void
}) {
  if (!notes) return null
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[10000] flex items-start justify-center bg-black/45 px-4 pt-[calc(var(--titlebar-h,0px)+1.5rem)] backdrop-blur-sm sm:items-center sm:pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl select-text"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          onContextMenu={(event) => event.stopPropagation()}
          style={{
            background: 'var(--theme-card)',
            border: '1px solid var(--theme-border)',
            color: 'var(--theme-text)',
            boxShadow: 'var(--theme-shadow-3)',
          }}
        >
          <div className="flex items-start gap-3 px-5 py-4">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                background:
                  'color-mix(in srgb, var(--theme-accent) 14%, transparent)',
              }}
            >
              <HugeiconsIcon
                icon={Tick01Icon}
                size={20}
                strokeWidth={2}
                style={{ color: 'var(--theme-accent)' }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold">Hermes updated</p>
              <p className="text-sm" style={{ color: 'var(--theme-muted)' }}>
                What changed in this update.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 transition-opacity hover:opacity-80"
              style={{ color: 'var(--theme-muted)' }}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
            </button>
          </div>
          <div className="max-h-[60vh] space-y-4 overflow-auto px-5 pb-5">
            {notes.sections.map((section) => (
              <section key={`${section.product}:${section.to}`}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">{section.label}</h3>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[11px]"
                    style={{
                      background: 'var(--theme-card2)',
                      color: 'var(--theme-muted)',
                    }}
                  >
                    {shortSha(section.from)} → {shortSha(section.to)}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {(section.commits.length
                    ? section.commits
                    : ['Updated to the latest available version.']
                  ).map((commit, index) => (
                    <li
                      key={`${section.product}-${index}-${commit}`}
                      className="rounded-xl px-3 py-2 text-sm"
                      style={{ background: 'var(--theme-card2)' }}
                    >
                      {commit}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <div
            className="flex justify-end border-t px-5 py-3"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ background: 'var(--theme-accent)' }}
            >
              Continue
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
