import { useI18n } from '../../i18n/context';

export function AuthErrorScreen() {
  const { t } = useI18n();
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      <div className="text-center max-w-md px-6">
        <div className="text-4xl mb-4">🔒</div>
        <h1 className="text-xl font-semibold mb-2">{t('auth.error.title')}</h1>
        <p className="text-fg-muted text-sm mb-6">{t('auth.error.description')}</p>
        <p className="text-fg-muted text-xs mb-2">{t('auth.error.instruction')}</p>
        <code className="block bg-elevated rounded-lg px-4 py-3 text-sm mono text-emerald mb-6">
          {t('auth.error.command')}
        </code>
        <button
          onClick={() => { window.location.reload(); }}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-base)' }}
        >
          {t('auth.error.reload')}
        </button>
      </div>
    </div>
  );
}
