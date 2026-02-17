import { render, type RenderOptions } from '@testing-library/react';
import { I18nProvider } from '../../../i18n/context';

export function renderWithI18n(ui: React.ReactElement, options?: RenderOptions) {
  return render(<I18nProvider>{ui}</I18nProvider>, options);
}
