import { useI18n } from '../../i18n/context';
import { BrandLogo } from './BrandLogo';

export function AuthErrorScreen() {
  const { t } = useI18n();
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      <div className="text-center max-w-md px-6">
        {/* Product identity */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <BrandLogo size={30} className="opacity-90" />
          <div className="text-xs font-semibold tracking-wider uppercase text-fg-dim">{t('auth.error.brand')}</div>
        </div>

        <div className="text-4xl mb-4">🔒</div>
        <h1 className="text-xl font-semibold mb-2">{t('auth.error.title')}</h1>
        <p className="text-fg-muted text-sm mb-5">{t('auth.error.description')}</p>

        {/* Possible causes */}
        <div className="text-left bg-elevated/40 rounded-lg border border-edge-subtle px-4 py-3 mb-5">
          <p className="text-xs font-medium text-fg-secondary mb-2">{t('auth.error.causes')}</p>
          <ul className="text-xs text-fg-muted space-y-1">
            <li>• {t('auth.error.cause1')}</li>
            <li>• {t('auth.error.cause2')}</li>
          </ul>
        </div>

        {/* Recovery steps */}
        <div className="text-left bg-elevated/40 rounded-lg border border-edge-subtle px-4 py-3 mb-6">
          <p className="text-xs font-medium text-fg-secondary mb-2">{t('auth.error.howToFix')}</p>
          <ol className="text-xs text-fg-muted space-y-1.5 list-decimal list-inside">
            <li>{t('auth.error.step1')}</li>
            <li>{t('auth.error.step2')}</li>
            <li>{t('auth.error.step3')}</li>
          </ol>
          <code className="block bg-elevated rounded-lg px-4 py-3 text-sm mono text-emerald mt-3">
            {t('auth.error.command')}
          </code>
        </div>

        <button
          onClick={() => {
            window.location.reload();
          }}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-base)' }}
        >
          {t('auth.error.reload')}
        </button>
      </div>
    </div>
  );
}
