export function ErrorMessage({ title, detail, onRetry }: { title: string; detail?: string; onRetry?: () => void }) {
  return (
    <div className="mt-8 rounded-xl border border-line bg-surface p-5 text-center" role="alert">
      <p className="font-medium">{title}</p>
      {detail && <p className="mt-1 text-sm text-muted">{detail}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-4 h-11 rounded-[10px] bg-accent px-5 text-sm font-semibold text-bg active:opacity-80">
          Try again
        </button>
      )}
    </div>
  );
}
