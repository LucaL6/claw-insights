/**
 * Node.js runtime compatibility helpers for claw-insights CLI.
 *
 * Centralises version checks and flag logic so both the daemon spawner
 * and the root/release CLI entry-points share a single policy.
 */

const MIN_SUPPORTED_MAJOR = 22;
const SQLITE_BUILTIN_MAJOR = 23; // Node 23+ ships stable built-in sqlite

export function parseNodeMajor(version: string): number {
  const cleaned = version.startsWith('v') ? version.slice(1) : version;
  const major = Number.parseInt(cleaned.split('.')[0], 10);
  if (Number.isNaN(major)) {
    throw new Error(`Cannot parse Node version: ${version}`);
  }
  return major;
}

export function assertSupportedNodeVersion(version: string): void {
  const major = parseNodeMajor(version);
  if (major < MIN_SUPPORTED_MAJOR) {
    throw new Error(`Node ${major}.x is not supported. Node 22+ is required to run claw-insights.`);
  }
}

/**
 * Build the argument list for spawning the claw-insights server process.
 *
 * On Node 22.x the built-in sqlite module is behind --experimental-sqlite;
 * on Node 23+ it is available without flags.
 */
export function buildNodeArgsForServer(serverEntry: string, version: string = process.versions.node): string[] {
  const major = parseNodeMajor(version);
  if (major < SQLITE_BUILTIN_MAJOR) {
    return ['--experimental-sqlite', serverEntry];
  }
  return [serverEntry];
}
