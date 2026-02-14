import { randomUUID } from 'node:crypto';

type RequestFrame = { type: 'req'; id: string; method: string; params?: unknown };
type ResponseFrame = { ok: boolean; id: string; payload?: unknown; error?: { message: string } };
type EventFrame = { type: 'event'; event: string; payload?: unknown };

const READ_ONLY_METHODS = new Set([
  'sessions.list',
  'health',
  'status',
  'channels.status',
  'usage.status',
  'cron.list',
  'cron.status',
]);

export class GatewayRPC {
  private ws: WebSocket | null = null;
  private url: string;
  private token?: string;
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private connected = false;
  private connectNonce: string | null = null;

  constructor(url = 'ws://127.0.0.1:18789', token = process.env.OPENCLAW_TOKEN) {
    this.url = url;
    this.token = token;
  }

  connect() {
    this.connected = false;
    this.connectNonce = null;
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));

        // Handle events (connect.challenge, etc.)
        if (msg.type === 'event') {
          const evt = msg as EventFrame;
          if (evt.event === 'connect.challenge') {
            const payload = evt.payload as { nonce?: string } | undefined;
            if (payload?.nonce) {
              this.connectNonce = payload.nonce;
              this.sendConnect();
            }
          }
          return;
        }

        // Handle response frames
        if ('ok' in msg && 'id' in msg) {
          const res = msg as ResponseFrame;
          const p = this.pending.get(res.id);
          if (!p) return;

          // "connect" response → mark connected
          if (res.ok && !this.connected) {
            this.connected = true;
          }

          this.pending.delete(res.id);
          if (res.ok) {
            p.resolve(res.payload);
          } else {
            p.reject(new Error(res.error?.message ?? 'unknown RPC error'));
          }
        }
      } catch { /* ignore parse errors */ }
    };

    this.ws.onclose = () => {
      this.connected = false;
      // Reject all pending
      for (const [id, p] of this.pending) {
        p.reject(new Error('connection closed'));
        this.pending.delete(id);
      }
      this.scheduleReconnect();
    };
    this.ws.onerror = () => {};
  }

  private sendConnect() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const id = randomUUID();
    const params: Record<string, unknown> = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'openclaw-control-ui',
        displayName: 'OpenClaw Dashboard',
        version: '0.1.0',
        platform: process.platform,
        mode: 'ui',
      },
      caps: [],
      role: 'operator',
      scopes: ['operator.admin'],
    };
    if (this.token) {
      params.auth = { token: this.token };
    }
    const frame: RequestFrame = { type: 'req', id, method: 'connect', params };
    const p = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('connect timeout'));
        }
      }, 5000);
    });
    this.ws.send(JSON.stringify(frame));
    p.catch(() => {}); // suppress unhandled
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    }, this.reconnectDelay);
  }

  async call(method: string, params?: unknown): Promise<unknown> {
    if (!READ_ONLY_METHODS.has(method)) throw new Error(`Method not allowed: ${method}`);
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.connected) {
      throw new Error('Gateway RPC not connected');
    }

    const id = randomUUID();
    const frame: RequestFrame = { type: 'req', id, method, params };
    const p = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`RPC timeout: ${method}`));
        }
      }, 3000);
    });
    this.ws.send(JSON.stringify(frame));
    return p;
  }

  isConnected() {
    return this.connected;
  }

  close() {
    this.ws?.close();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }
}

export { READ_ONLY_METHODS };
