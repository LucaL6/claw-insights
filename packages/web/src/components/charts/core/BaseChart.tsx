import type { EChartsOption } from 'echarts';
import * as echarts from 'echarts';
import ReactECharts from 'echarts-for-react';
import { useMemo } from 'react';

import { useTheme } from '../../../theme/context';
import { buildEChartsTheme, DARK_THEME } from './echarts-theme';

// Register initial theme
echarts.registerTheme('ocDynamic', DARK_THEME);

interface Props {
  option: EChartsOption;
  height?: number;
  testId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEvents?: Record<string, (params: any) => void>;
}

export function BaseChart({ option, height = 160, testId, onEvents }: Props) {
  const { theme } = useTheme();

  // Re-register ECharts theme synchronously before re-mount (key={theme}).
  // buildEChartsTheme reads CSS variables that change when theme toggles,
  // so theme in the dep array is intentional (triggers re-registration).
  const _themeRef = theme; // capture to satisfy exhaustive-deps
  useMemo(() => {
    void _themeRef; // used to trigger re-registration on theme change
    echarts.registerTheme('ocDynamic', buildEChartsTheme());
  }, [_themeRef]);

  const mergedOption = useMemo(
    () => ({
      animation: true,
      animationDuration: 300,
      ...option,
    }),
    [option],
  );

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
        autoResize
      />
    </div>
  );
}
