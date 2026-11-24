export function StatusLegend({ showUnknown }: { showUnknown: boolean }) {
  const item = (cls: string, mark: string, label: string) => (
    <span className="flex items-center gap-1.5">
      <span className={`flex h-4 w-4 items-center justify-center rounded-[3px] text-[10px] ${cls}`}>{mark}</span>
      {label}
    </span>
  );
  return (
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {item("bg-available-bg text-available-fg", "✓", "Available")}
      {item("bg-unavailable-bg text-unavailable-fg", "–", "Unavailable")}
      {showUnknown && item("bg-unknown-bg text-unknown-fg", "?", "Unknown")}
      {item("bg-past-bg", "", "Past")}
    </div>
  );
}
