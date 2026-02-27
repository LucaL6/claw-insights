import clsx from 'clsx';

import { useI18n } from '../../../i18n/context';
import { getModelColor,shortModelName } from '../core/echarts-theme';

interface ModelSelectorProps {
  models: string[];
  selected: string | null;
  onChange: (model: string | null) => void;
}

const BASE = 'text-xs px-1.5 py-0.5 rounded transition-colors';
// inline: component-specific toggle tokens (not registered in @theme)
const ACTIVE_STYLE = {
  backgroundColor: 'var(--toggle-sort-bg)',
  color: 'var(--toggle-sort-text)',
  border: '1px solid var(--toggle-sort-border)',
};

export function ModelSelector({ models, selected, onChange }: ModelSelectorProps) {
  const { t } = useI18n();

  if (models.length <= 1) {return null;}

  return (
    <div className="flex gap-0.5">
      <button
        onClick={() => { onChange(null); }}
        className={clsx(BASE, selected !== null && 'text-fg-dim')}
        style={selected === null ? ACTIVE_STYLE : undefined}
      >
        {t('metrics.modelAll')}
      </button>
      {models.map((m) => {
        const label = shortModelName(m);
        const dotColor = getModelColor(m);
        const isActive = selected === m;

        return (
          <button
            key={m}
            onClick={() => { onChange(isActive ? null : m); }}
            className={clsx(BASE, 'inline-flex items-center gap-1', !isActive && 'text-fg-dim')}
            style={isActive ? ACTIVE_STYLE : undefined}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }}>
              {/* inline: dynamic runtime color */}
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
