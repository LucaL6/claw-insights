import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { DARK_THEME } from './echarts-theme';
import type { EChartsOption } from 'echarts';

// Register theme once
echarts.registerTheme('ocDark', DARK_THEME);

interface Props {
  option: EChartsOption;
  height?: number;
  testId?: string;
}

export function BaseChart({ option, height = 160, testId }: Props) {
  const mergedOption = useMemo(() => ({
    animation: true,
    animationDuration: 300,
    ...option,
  }), [option]);

  return (
    <div data-testid={testId} style={{ height: `${height}px` }}>
      <ReactECharts
        option={mergedOption}
        theme="ocDark"
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge
      />
    </div>
  );
}
