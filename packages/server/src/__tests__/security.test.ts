import { describe, it, expect } from 'bun:test';
import { redact } from '../sources/log-tailer';
import { READ_ONLY_METHODS } from '../sources/gateway-rpc';

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

  // NFR-3.5 RPC allowlist
  describe('NFR-3.5: RPC allowlist', () => {
    it('should only contain read-only methods', () => {
      for (const m of READ_ONLY_METHODS) {
        expect(m).not.toContain('restart');
        expect(m).not.toContain('update');
        expect(m).not.toContain('delete');
        expect(m).not.toContain('write');
        expect(m).not.toContain('apply');
      }
    });

    it('should not include dangerous methods', () => {
      const dangerous = ['config.apply', 'gateway.restart', 'sessions.delete', 'update.run'];
      for (const d of dangerous) {
        expect(READ_ONLY_METHODS.has(d)).toBe(false);
      }
    });
  });

  // NFR-3.1 Localhost binding
  describe('NFR-3.1: localhost binding', () => {
    it('server index.ts binds to 127.0.0.1', async () => {
      const src = await Bun.file(import.meta.dir + '/../index.ts').text();
      expect(src).toContain('127.0.0.1');
    });
  });
});
