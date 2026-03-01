import { cleanup, fireEvent, render, type RenderOptions } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { I18nProvider } from '../../../i18n/context';
import { CollapsibleSection } from '../CollapsibleSection';

function renderWithI18n(ui: React.ReactElement, options?: RenderOptions) {
  return render(<I18nProvider>{ui}</I18nProvider>, options);
}

afterEach(cleanup);

describe('CollapsibleSection', () => {
  it('F6.1: renders title and children when open', () => {
    const { getByText } = renderWithI18n(<CollapsibleSection title="Test">Content here</CollapsibleSection>);
    expect(getByText('Test')).toBeDefined();
    expect(getByText('Content here')).toBeDefined();
  });

  it('F6.1.2: toggles collapsed state on click', () => {
    const { getByRole, container } = renderWithI18n(
      <CollapsibleSection title="Toggle">
        <span>Collapsible content</span>
      </CollapsibleSection>,
    );
    const gridWrapper = container.querySelector('.grid');
    // Initially open (defaultOpen=true) — grid-rows-[1fr]
    expect(gridWrapper?.className).toContain('grid-rows-[1fr]');

    // Click to collapse — grid-rows-[0fr]
    fireEvent.click(getByRole('button'));
    expect(gridWrapper?.className).toContain('grid-rows-[0fr]');
  });

  it('renders badge when provided', () => {
    const { getByText } = renderWithI18n(
      <CollapsibleSection title="Sessions" badge={42}>
        Content
      </CollapsibleSection>,
    );
    expect(getByText('42')).toBeDefined();
  });

  it('content wrapper has min-w-0 to prevent overflow', () => {
    const { container } = renderWithI18n(<CollapsibleSection title="Test">Content</CollapsibleSection>);
    const gridWrapper = container.querySelector('.grid');
    const contentDiv = gridWrapper?.querySelector('div');
    expect(contentDiv?.className).toContain('min-w-0');
  });

  it('starts collapsed when defaultOpen=false', () => {
    const { container } = renderWithI18n(
      <CollapsibleSection title="Closed" defaultOpen={false}>
        <span>Hidden</span>
      </CollapsibleSection>,
    );
    const gridWrapper = container.querySelector('.grid');
    expect(gridWrapper?.className).toContain('grid-rows-[0fr]');
  });
});
