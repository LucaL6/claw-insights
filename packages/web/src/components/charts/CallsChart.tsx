import { useCallback } from 'react';
import { useCanvas } from './useCanvas';
import { drawYAxis, drawXAxis, PAD } from './chart-utils';

interface HourlyData { hour: number; apiCalls: number; toolCalls: number }

export function CallsChart({ data }: { data: HourlyData[] }) {
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const plotW = w - PAD.left - PAD.right;
    const plotH = h - PAD.top - PAD.bottom;
    const max = Math.max(1, ...data.map(d => Math.max(d.apiCalls, d.toolCalls)));
    const barW = plotW / 24;

    drawYAxis(ctx, PAD.left, h, max, 4, PAD);
    drawXAxis(ctx, h - PAD.bottom, PAD.left, plotW);

    for (const d of data) {
      const halfBar = (barW - 3) / 2;
      const x = PAD.left + d.hour * barW + 1;

      // API calls (left bar)
      const apiH = (d.apiCalls / max) * plotH;
      ctx.fillStyle = '#8b5cf6';
      ctx.fillRect(x, PAD.top + plotH - apiH, halfBar, apiH);

      // Tool calls (right bar)
      const toolH = (d.toolCalls / max) * plotH;
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(x + halfBar + 1, PAD.top + plotH - toolH, halfBar, toolH);
    }

  }, [data]);

  const ref = useCanvas(draw);
  return <canvas ref={ref} className="w-full h-full" />;
}
