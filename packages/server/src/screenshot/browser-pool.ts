import { chromium, type Browser } from 'playwright';

export interface BrowserPoolOptions {
  idleTimeoutMs?: number;
  maxConcurrent?: number;
}

export class BrowserPool {
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly idleTimeoutMs: number;
  private activeCaptures = 0;
  private readonly maxConcurrent: number;

  constructor(options: BrowserPoolOptions = {}) {
    this.idleTimeoutMs = options.idleTimeoutMs ?? 5 * 60 * 1000;
    this.maxConcurrent = options.maxConcurrent ?? 3;
  }

  canCapture(): boolean {
    return this.activeCaptures < this.maxConcurrent;
  }

  beginCapture(): void {
    this.activeCaptures++;
  }

  endCapture(): void {
    this.activeCaptures = Math.max(0, this.activeCaptures - 1);
  }

  async acquire(): Promise<Browser> {
    this.resetIdleTimer();

    if (this.browser?.isConnected()) {
      return this.browser;
    }

    if (this.launching) {
      return this.launching;
    }

    this.launching = chromium.launch({ headless: true }).then((browser) => {
      this.browser = browser;
      this.launching = null;

      browser.on('disconnected', () => {
        if (this.browser === browser) {
          this.browser = null;
        }
      });

      return browser;
    }).catch((err) => {
      this.launching = null;
      throw err;
    });

    return this.launching;
  }

  async shutdown(): Promise<void> {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.launching) {
      try {
        const browser = await this.launching;
        await browser.close();
      } catch {
        // launch failed, nothing to close
      }
      this.launching = null;
    }
    if (this.browser) {
      const browser = this.browser;
      this.browser = null;
      if (browser.isConnected()) {
        await browser.close();
      }
    }
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      this.shutdown();
    }, this.idleTimeoutMs);
  }
}
