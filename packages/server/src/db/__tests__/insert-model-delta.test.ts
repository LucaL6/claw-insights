import { describe, expect,it } from 'vitest';

import { initDatabase } from '../init.js';
import { insertModelSample } from '../metric-queries.js';

describe('insertModelSample with tokenDeltaK', () => {
  it('should write token_delta_k to model_token_samples', () => {
    const db = initDatabase(':memory:');
    insertModelSample(db, { model: 'claude-opus-4-6', totalTokensK: 150, tokenDeltaK: 12.5 });
    const row = db.prepare('SELECT token_delta_k, total_tokens_k FROM model_token_samples LIMIT 1').get() as {
      token_delta_k: number;
      total_tokens_k: number;
    };
    expect(row.total_tokens_k).toBe(150);
    expect(row.token_delta_k).toBe(12.5);
    db.close();
  });

  it('should default tokenDeltaK to 0 if not provided', () => {
    const db = initDatabase(':memory:');
    insertModelSample(db, { model: 'gpt-4o', totalTokensK: 80 });
    const row = db.prepare('SELECT token_delta_k FROM model_token_samples LIMIT 1').get() as {
      token_delta_k: number;
    };
    expect(row.token_delta_k).toBe(0);
    db.close();
  });
});
