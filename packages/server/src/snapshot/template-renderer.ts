import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SnapshotData } from './data-service';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, 'templates');

type TemplateName = 'mobile-compact' | 'mobile-standard' | 'mobile-full' | 'desktop';

const templateCache = new Map<string, string>();

function loadTemplate(name: TemplateName): string {
  if (templateCache.has(name)) return templateCache.get(name)!;
  const path = join(TEMPLATES_DIR, `${name}.html`);
  const content = readFileSync(path, 'utf-8');
  templateCache.set(name, content);
  return content;
}

export function renderTemplate(
  name: TemplateName,
  data: SnapshotData,
  opts: { theme: string; lang: string },
): string {
  const template = loadTemplate(name);
  const dataJson = JSON.stringify(data);
  const html = template
    .replace('{{lang}}', opts.lang)
    .replace('{{theme}}', opts.theme)
    .replace('"__SNAPSHOT_DATA_PLACEHOLDER__"', dataJson);
  return html;
}
