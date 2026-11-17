import { widgetSettings } from '@/core/widgetSettings'
import { about, type TemplateSettings } from './settings'

// `mobile` is true in the phone view (Widget.mobile.tsx). to show one view
// everywhere, drop the prop, that file and the manifest's mobileComponent
export function TemplateWidget({ mobile = false }: { mobile?: boolean }) {
  // widgets.template in settings.json, declared in ./settings.ts
  const greeting = widgetSettings<TemplateSettings>(about.id)?.greeting ?? 'Hello!'
  return (
    <div className={mobile ? 'p-3' : 'p-4'}>
      <h2 className="mb-2 text-title font-semibold text-strongText">{greeting}</h2>
      <p className="text-large text-text">
        This is the body of your widget. Edit{' '}
        <code className="rounded bg-surface px-1">Widget.tsx</code> to
        build it out.
      </p>
    </div>
  )
}
