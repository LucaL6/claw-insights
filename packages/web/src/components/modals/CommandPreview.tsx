interface Props {
  lines: string[];
}

export function CommandPreview({ lines }: Props) {
  return (
    <div
      className="rounded-lg p-3 mb-4 font-mono text-xs"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-secondary)',
      }}
    >
      {lines.map((line, i) => (
        <div key={i} style={line.startsWith('#') ? { color: 'var(--text-dim)', marginTop: i > 0 ? '4px' : 0 } : undefined}>{line}</div>
      ))}
    </div>
  );
}
