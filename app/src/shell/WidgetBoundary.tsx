import { Fragment, Suspense, type ReactNode } from 'react'
import { settings } from '@user/settings'
import { EmptyState } from '@/ui/EmptyState'
import { Spinner } from '@/ui/Spinner'
import { WidgetIdContext } from '@/ui/widgetContext'
import { ErrorBoundary } from './ErrorBoundary'

// keyed by its settings, so live changes remount it, Draw and Measure
// set themselves up once
export function WidgetBoundary({ id, children }: { id: string; children: ReactNode }) {
  return (
    <WidgetIdContext.Provider value={id}>
      <ErrorBoundary
        fallback={
          // chromeless widgets (search) have no card behind them
          <div className="rounded bg-panelBg">
            <EmptyState title="This widget couldn't load" hint="See the browser console for details." />
          </div>
        }
      >
        <Suspense
          fallback={
            <div role="status" aria-label="Loading" aria-busy="true" className="flex justify-center rounded bg-panelBg p-4">
              <Spinner size={18} />
            </div>
          }
        >
          <Fragment key={JSON.stringify(settings.widgets?.[id] ?? null)}>{children}</Fragment>
        </Suspense>
      </ErrorBoundary>
    </WidgetIdContext.Provider>
  )
}
