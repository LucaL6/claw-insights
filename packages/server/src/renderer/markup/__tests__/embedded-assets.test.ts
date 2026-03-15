import { describe, expect, it } from 'vitest';

import {
  getFooterLogoDataUri,
  getLobsterLogoDataUri,
  ICON_DARK_DATA_URI,
  ICON_LIGHT_DATA_URI,
  LOBSTER_DATA_URI,
} from '../embedded-assets.js';

describe('embedded-assets', () => {
  it('exports valid data URIs for all brand SVGs', () => {
    for (const uri of [ICON_DARK_DATA_URI, ICON_LIGHT_DATA_URI, LOBSTER_DATA_URI]) {
      expect(uri).toMatch(/^data:image\/svg\+xml;base64,/);
      const decoded = Buffer.from(uri.replace('data:image/svg+xml;base64,', ''), 'base64').toString('utf8');
      expect(decoded).toContain('<svg');
      expect(decoded).toContain('</svg>');
    }
  });
  it('icon-dark is a valid SVG with viewBox', () => {
    const decoded = Buffer.from(ICON_DARK_DATA_URI.replace('data:image/svg+xml;base64,', ''), 'base64').toString(
      'utf8',
    );
    expect(decoded).toContain('viewBox');
  });
  it('icon-light is a valid SVG with viewBox', () => {
    const decoded = Buffer.from(ICON_LIGHT_DATA_URI.replace('data:image/svg+xml;base64,', ''), 'base64').toString(
      'utf8',
    );
    expect(decoded).toContain('viewBox');
  });
  it('icon-dark and icon-light are distinct assets', () => {
    expect(ICON_DARK_DATA_URI).not.toBe(ICON_LIGHT_DATA_URI);
  });
  it('lobster is a valid SVG with viewBox', () => {
    const decoded = Buffer.from(LOBSTER_DATA_URI.replace('data:image/svg+xml;base64,', ''), 'base64').toString('utf8');
    expect(decoded).toContain('viewBox');
  });
  it('getFooterLogoDataUri returns dark icon for dark theme', () => {
    expect(getFooterLogoDataUri('dark')).toBe(ICON_DARK_DATA_URI);
  });
  it('getFooterLogoDataUri returns light icon for light theme', () => {
    expect(getFooterLogoDataUri('light')).toBe(ICON_LIGHT_DATA_URI);
  });
  it('getLobsterLogoDataUri returns the lobster', () => {
    expect(getLobsterLogoDataUri()).toBe(LOBSTER_DATA_URI);
  });
});
