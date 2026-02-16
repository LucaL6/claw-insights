import { useMemo, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { buildEChartsTheme, DARK_THEME } from './echarts-theme';
import { useTheme } from '../../theme/context';
import type { EChartsOption } from 'echarts';

// Register initial theme
echarts.registerTheme('ocDynamic', DARK_THEME);

interface Props {
  option: EChartsOption;
  height?: number;
  testId?: string;
  onEvents?: Record<string, (params: any) => void>;
}

export function BaseChart({ option, height = 160, testId, onEvents }: Props) {
  const { theme } = useTheme();

  // Re-register ECharts theme when CSS vars change
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      echarts.registerTheme('ocDynamic', buildEChartsTheme());
    });
    return () => cancelAnimationFrame(id);
  }, [theme]);

  const mergedOption = useMemo(() => ({
    animation: true,
    animationDuration: 300,
    ...option,
  }), [option]);

  return (
    <div data-testid={testId} style={{ height: `${height}px` }}>
      <ReactECharts
        key={theme}
        option={mergedOption}
        theme="ocDynamic"
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'canvas' }}
        onEvents={onEvents}
        notMerge
      />
    </div>
  );
}
