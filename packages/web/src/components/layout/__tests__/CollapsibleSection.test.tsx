import { describe, it, expect, afterEach } from 'bun:test';
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
    const { getByRole, getByText } = render(<CollapsibleSection title="Toggle"><span>Collapsible content</span></CollapsibleSection>);
    fireEvent.click(getByRole('button'));
    expect(getByText('Collapsible content').parentElement!.className).toContain('max-h-0');
  });

  it('renders badge when provided', () => {
    const { getByText } = render(<CollapsibleSection title="Sessions" badge={42}>Content</CollapsibleSection>);
    expect(getByText('42')).toBeDefined();
  });

  it('starts collapsed when defaultOpen=false', () => {
    const { getByText } = render(<CollapsibleSection title="Closed" defaultOpen={false}><span>Hidden</span></CollapsibleSection>);
    expect(getByText('Hidden').parentElement!.className).toContain('max-h-0');
  });
});
