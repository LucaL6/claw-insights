import type { SnapshotData } from '../../services/snapshot-types.js';
import { getAppVersion } from '../../version.js';
import { t } from '../i18n/index.js';
import type { ColorScheme } from './colors.js';
import type { BrandTheme } from './embedded-assets.js';
import { getFooterLogoDataUri } from './embedded-assets.js';
import type { SatoriNode } from './helpers.js';
import { div, span } from './helpers.js';

export function renderFooter(
  data: SnapshotData,
  c: ColorScheme,
  theme: BrandTheme = 'dark',
  locale: string = 'en',
): SatoriNode {
  const datetime = data.timestamp.slice(0, 16).replace('T', ' ') + ' UTC';
  const logoSrc = getFooterLogoDataUri(theme);

  return div(
    {
      justifyContent: 'space-between',
      padding: '8px 20px 12px',
      borderTop: `1px solid ${c.border}`,
      alignItems: 'center',
    },
    [
      div({ alignItems: 'center', gap: 6 }, [
        {
          type: 'img',
          props: {
            src: logoSrc,
            width: 14,
            height: 14,
            style: { display: 'flex', width: 14, height: 14, borderRadius: 3 },
          },
        },
        span({ color: c.textDim, fontSize: 11 }, t('footer.version', locale, { version: getAppVersion() })),
      ]),
      span({ color: c.textDim, fontSize: 11, fontFamily: 'JetBrains Mono' }, datetime),
    ],
  );
}
