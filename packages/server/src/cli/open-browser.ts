import { execFile } from 'node:child_process';

const COMMANDS: Record<string, string> = {
  darwin: 'open',
  linux: 'xdg-open',
  win32: 'start',
};

/** Returns the platform-specific open command, or null if unsupported. */
export function getOpenCommand(platform: string): string | null {
  return COMMANDS[platform] ?? null;
}

/**
 * Open a URL in the system default browser.
 * Silently ignores failures (best-effort).
 */
export function openBrowser(url: string): void {
  const cmd = getOpenCommand(process.platform);
  if (!cmd) {return;}

  if (cmd === 'start') {
    // Windows: start requires shell, use cmd /c start "" "url"
    execFile('cmd', ['/c', 'start', '""', url], () => {});
  } else {
    execFile(cmd, [url], () => {});
  }
}
