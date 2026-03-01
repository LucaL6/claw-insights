import { useI18n } from '../../i18n/context';
import { TruncatedContent } from '../ui/TruncatedContent';

export interface SpawnPromptBoxProps {
  prompt: string;
}

export function SpawnPromptBox({ prompt }: SpawnPromptBoxProps) {
  const { t } = useI18n();

  return (
    <div
      className="rounded-md p-2.5"
      style={{
        border: '1px solid var(--dr-amber-border)',
        backgroundColor: 'var(--dr-amber-bg)',
      }}
    >
      <div className="mb-1.5 font-mono text-[11px] font-medium" style={{ color: 'var(--dr-amber)' }}>
        🎯 {t('drawer.spawnPrompt.label')}
      </div>
      <TruncatedContent maxHeight={80} expandLabel={t('drawer.spawnPrompt.expand')}>
        <div className="whitespace-pre-wrap font-mono text-[12px]" style={{ color: 'var(--dr-fg2)' }}>
          {prompt}
        </div>
      </TruncatedContent>
    </div>
  );
}
