const CLAUDE_PATTERN = /^(?:anthropic\/)?claude-(\w+)-(\d+)(?:-(\d+))?(?:-\d{8})?$/;
const GPT_PATTERN = /^(?:openai(?:-codex)?\/)?gpt-([a-z\d.]+)(?:-([a-z\d-]+))?$/i;

function titleWords(input: string): string {
  return input
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatModel(raw: string): string {
  if (!raw) {
    return '';
  }
  const claude = raw.match(CLAUDE_PATTERN);
  if (claude) {
    const family = claude[1].charAt(0).toUpperCase() + claude[1].slice(1);
    const version = claude[3] ? `${claude[2]}.${claude[3]}` : claude[2];
    return `${family} ${version}`;
  }
  const gpt = raw.match(GPT_PATTERN);
  if (gpt) {
    if (gpt[2] && gpt[2].toLowerCase().startsWith('codex')) {
      const codexSuffix = gpt[2].replace(/^codex-?/i, '');
      const codexTail = codexSuffix ? ` ${titleWords(codexSuffix)}` : '';
      return `Codex ${gpt[1]}${codexTail}`;
    }
    const suffix = gpt[2] ? ` ${titleWords(gpt[2])}` : '';
    return `GPT ${gpt[1]}${suffix}`;
  }
  return raw;
}
