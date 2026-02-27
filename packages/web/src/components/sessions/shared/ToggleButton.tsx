interface ToggleButtonProps {
  active: boolean;
  variant?: 'filter' | 'sort';
  onClick: () => void;
  children: React.ReactNode;
}

const STYLE_MAP = {
  filter: {
    active: {
      backgroundColor: 'var(--toggle-active-bg)',
      color: 'var(--toggle-active-text)',
      border: '1px solid var(--toggle-active-border)',
    },
    inactive: {
      backgroundColor: 'var(--toggle-inactive-bg)',
      color: 'var(--toggle-inactive-text)',
      border: '1px solid var(--toggle-inactive-border)',
    },
  },
  sort: {
    active: {
      backgroundColor: 'var(--toggle-sort-bg)',
      color: 'var(--toggle-sort-text)',
      border: '1px solid var(--toggle-sort-border)',
    },
    inactive: {
      backgroundColor: 'var(--toggle-inactive-bg)',
      color: 'var(--toggle-inactive-text)',
      border: '1px solid var(--toggle-inactive-border)',
    },
  },
} as const;

export function ToggleButton({ active, variant = 'filter', onClick, children }: ToggleButtonProps) {
  const styles = STYLE_MAP[variant];
  return (
    <button
      onClick={onClick}
      className="px-2 py-0.5 text-xs rounded transition-colors"
      style={active ? styles.active : styles.inactive}
    >
      {children}
    </button>
  );
}
