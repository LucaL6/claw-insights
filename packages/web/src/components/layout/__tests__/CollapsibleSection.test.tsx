import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { CollapsibleSection } from '../CollapsibleSection';

afterEach(cleanup);

describe('CollapsibleSection', () => {
  it('F6.1: renders title and children when open', () => {
    const { getByText } = render(<CollapsibleSection title="Test">Content here</CollapsibleSection>);
    expect(getByText('Test')).toBeDefined();
    expect(getByText('Content here')).toBeDefined();
  });

  it('F6.1.2: toggles collapsed state on click', () => {
    const { getByRole, container } = render(
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
    const { getByText } = render(
      <CollapsibleSection title="Sessions" badge={42}>
        Content
      </CollapsibleSection>,
    );
    expect(getByText('42')).toBeDefined();
  });

  it('starts collapsed when defaultOpen=false', () => {
    const { container } = render(
      <CollapsibleSection title="Closed" defaultOpen={false}>
        <span>Hidden</span>
      </CollapsibleSection>,
    );
    const gridWrapper = container.querySelector('.grid');
    expect(gridWrapper?.className).toContain('grid-rows-[0fr]');
  });
});
