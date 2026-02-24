const CLAUDE_PATTERN = /^(?:anthropic\/)?claude-(\w+)-(\d+)(?:-(\d+))?(?:-\d{8})?$/;
const GPT_PATTERN = /^(?:openai\/)?gpt-([\d.]+)-?(.*)$/;

export function formatModel(raw: string): string {
  if (!raw) {return '';}
  const claude = raw.match(CLAUDE_PATTERN);
  if (claude) {
    const family = claude[1].charAt(0).toUpperCase() + claude[1].slice(1);
    const version = claude[3] ? `${claude[2]}.${claude[3]}` : claude[2];
    return `${family} ${version}`;
  }
  const gpt = raw.match(GPT_PATTERN);
  if (gpt) {
    const suffix = gpt[2] ? ` ${gpt[2].charAt(0).toUpperCase() + gpt[2].slice(1)}` : '';
    return `GPT ${gpt[1]}${suffix}`;
  }
  return raw;
}
