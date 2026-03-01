import { type ReactNode, useEffect, useRef, useState } from 'react';

export interface TruncatedContentProps {
  children: ReactNode;
  maxHeight?: number;
  expandLabel?: string;
  collapseLabel?: string;
  className?: string;
}

export function TruncatedContent({
  children,
  maxHeight = 72,
  expandLabel = '↓ show more',
  collapseLabel = '↑ show less',
  className,
}: TruncatedContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) {
      return;
    }

    const check = () => {
      setOverflows(el.scrollHeight > maxHeight);
    };
    check();

    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [maxHeight]);

  const needsTruncation = overflows && !expanded;

  return (
    <div className={className} style={{ position: 'relative' }}>
      <div
        ref={contentRef}
        style={{
          maxHeight: expanded ? undefined : maxHeight,
          overflow: 'hidden',
          transition: 'max-height 0.3s ease',
          ...(needsTruncation
            ? {
                maskImage: 'linear-gradient(to bottom, black 60%, transparent)',
                WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent)',
              }
            : {}),
        }}
      >
        {children}
      </div>
      {overflows && (
        <button
          type="button"
          onClick={() => {
            setExpanded((e) => !e);
          }}
          className="font-mono"
          style={{
            display: 'block',
            border: 'none',
            background: 'none',
            padding: '2px 0 0',
            fontSize: '10px',
            color: 'var(--dr-orange)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          {expanded ? collapseLabel : expandLabel}
        </button>
      )}
    </div>
  );
}
