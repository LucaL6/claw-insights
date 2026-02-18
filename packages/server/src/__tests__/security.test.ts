import { describe, it, expect } from 'vitest';
import { redact } from '../sources/collectors/log-tailer';

describe('Security (NFR-3)', () => {
  // NFR-3.3 Sensitive data redaction
  describe('NFR-3.3: log redaction', () => {
    it('should redact Bearer tokens', () => {
      expect(redact('Authorization: Bearer sk-abc123')).not.toContain('sk-abc123');
    });
    it('should redact API keys', () => {
      expect(redact('api_key=xoxb-12345-abcdef')).not.toContain('xoxb-12345'); // gitleaks:allow
    });
    it('should redact password fields', () => {
      expect(redact('password=mysecretpassword')).not.toContain('mysecretpassword');
    });
    it('should redact secret fields', () => {
      expect(redact('client_secret=super-secret-val')).not.toContain('super-secret-val');
    });
    it('should not redact normal messages', () => {
      const msg = 'run completed successfully with 5000 tokens used';
      expect(redact(msg)).toBe(msg);
    });
  });

  // NFR-3.1 Localhost binding
  describe('NFR-3.1: localhost binding', () => {
    it('server index.ts binds to 127.0.0.1', async () => {
      const { readFileSync } = await import('fs');
      const { fileURLToPath } = await import('url');
      const { dirname, join } = await import('path');
      const __dir = dirname(fileURLToPath(import.meta.url));
      const src = readFileSync(join(__dir, '..', 'index.ts'), 'utf-8');
      expect(src).toContain('127.0.0.1');
    });
  });
});
