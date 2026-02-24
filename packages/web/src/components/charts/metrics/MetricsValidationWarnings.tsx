interface Props {
  warnings: string[];
}

export function MetricsValidationWarnings({ warnings }: Props) {
  if (warnings.length === 0) {return null;}
  return (
    <div className="mb-2 space-y-1">
      {warnings.map((w, i) => (
        <div key={i} className="text-[9px] flex items-center gap-1 text-amber">
          <span>⚠️</span> {w}
        </div>
      ))}
    </div>
  );
}
