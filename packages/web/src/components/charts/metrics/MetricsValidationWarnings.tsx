import type { ValidationMessage } from './useMetricsValidation';

interface Props {
  warnings: ValidationMessage[];
}

export function MetricsValidationWarnings({ warnings }: Props) {
  if (warnings.length === 0) {
    return null;
  }
  return (
    <div className="mb-2 space-y-1">
      {warnings.map((w, i) => (
        <div
          key={i}
          className={`text-xs flex items-center gap-1 ${w.level === 'warn' ? 'text-amber' : 'text-fg-muted'}`}
        >
          <span>{w.level === 'warn' ? '⚠️' : 'ℹ️'}</span> {w.text}
        </div>
      ))}
    </div>
  );
}
