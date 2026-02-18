interface Props {
  lines: string[];
}

export function CommandPreview({ lines }: Props) {
  return (
    <div className="rounded-lg p-3 mb-4 font-mono text-xs bg-elevated border border-edge-subtle text-fg-secondary">
      {lines.map((line, i) => (
        <div
          key={i}
          className={line.startsWith('#') ? `text-fg-dim${i > 0 ? ' mt-1' : ''}` : undefined}
        >
          {line}
        </div>
      ))}
    </div>
  );
}
