import clsx from 'clsx';

import { useI18n } from '../../../i18n/context';

export type RoleFilter = 'all' | 'user' | 'assistant';

interface RoleSelectorProps {
  selected: RoleFilter;
  onChange: (role: RoleFilter) => void;
}

const BASE = 'text-xs px-1.5 py-0.5 rounded transition-colors inline-flex items-center gap-1';
const ACTIVE_STYLE = {
  backgroundColor: 'var(--toggle-sort-bg)',
  color: 'var(--toggle-sort-text)',
  border: '1px solid var(--toggle-sort-border)',
};

const USER_COLOR = '#2dd4bf'; // teal-400
const ASSISTANT_COLOR = '#fb7185'; // rose-400

const ROLES: Array<{ key: RoleFilter; i18nKey: string; dot?: string }> = [
  { key: 'all', i18nKey: 'metrics.roleAll' },
  { key: 'user', i18nKey: 'metrics.roleUser', dot: USER_COLOR },
  { key: 'assistant', i18nKey: 'metrics.roleAssistant', dot: ASSISTANT_COLOR },
];

export function RoleSelector({ selected, onChange }: RoleSelectorProps) {
  const { t } = useI18n();

  return (
    <div className="flex gap-0.5">
      {ROLES.map(({ key, i18nKey, dot }) => {
        const isActive = selected === key;
        return (
          <button
            key={key}
            onClick={() => {
              onChange(key);
            }}
            className={clsx(BASE, !isActive && 'text-fg-dim')}
            style={isActive ? ACTIVE_STYLE : undefined}
          >
            {dot && (
              <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dot }} />
            )}
            {t(i18nKey)}
          </button>
        );
      })}
    </div>
  );
}
