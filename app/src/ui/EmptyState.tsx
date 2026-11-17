import type { ReactNode } from 'react'

export function EmptyState({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <div className="px-4 py-7 text-center text-text">
      <p className="mb-1 text-large font-medium">{title}</p>
      {hint && <p className="text-medium">{hint}</p>}
    </div>
  )
}
