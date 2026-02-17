interface TreeConnectorProps {
  isLast: boolean;
  children: React.ReactNode;
}

export function TreeConnector({ isLast, children }: TreeConnectorProps) {
  return (
    <div className="relative flex">
      <div
        className={`absolute left-0 top-0 ${isLast ? 'h-4' : 'bottom-0'} w-px`}
        style={{ backgroundColor: 'var(--tree-line)' }}
      />
      <div className="absolute left-0 top-4 w-3 h-px bg-[var(--tree-line)]" />
      <div className="ml-4 flex-1">{children}</div>
    </div>
  );
}
