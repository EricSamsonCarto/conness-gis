export function BootError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error)

  return (
    <div className="flex h-dvh w-screen items-center justify-center bg-surface p-8">
      <div className="max-w-2xl">
        <p className="mb-3 text-large font-medium text-danger">
          This app failed to start.
        </p>
        {import.meta.env.DEV ? (
          <pre className="whitespace-pre-wrap rounded border border-danger/30 bg-panelBg p-4 text-large text-text">
            {message}
          </pre>
        ) : (
          <p className="text-large text-text">
            Something went wrong loading this app. Check the browser console
            for details.
          </p>
        )}
      </div>
    </div>
  )
}
