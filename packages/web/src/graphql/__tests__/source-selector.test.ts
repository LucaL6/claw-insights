import { describe, expect, it } from 'vitest';

import type { SourceSelector } from '../../generated/graphql';
import { getDashboardSourceSelector } from '../source-selector';

describe('getDashboardSourceSelector', () => {
  it('returns fixed A-prime selector id agent:main', () => {
    const selector = getDashboardSourceSelector();
    const typed: SourceSelector = selector;

    expect(typed).toEqual({ id: 'agent:main' });
  });
});
