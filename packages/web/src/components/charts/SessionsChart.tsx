import { useCallback } from 'react';
import { useCanvas } from './useCanvas';
import { drawYAxis, drawXAxis, PAD } from './chart-utils';

interface HourlyData { hour: number; sessions: number }

export function SessionsChart({ data }: { data: HourlyData[] }) {
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const plotW = w - PAD.left - PAD.right;
    const plotH = h - PAD.top - PAD.bottom;
    const max = Math.max(1, ...data.map(d => d.sessions));
    const barW = plotW / 24;

    drawYAxis(ctx, PAD.left, h, max, 4, PAD);
    drawXAxis(ctx, h - PAD.bottom, PAD.left, plotW);

    for (const d of data) {
      const barH = (d.sessions / max) * plotH;
      const x = PAD.left + d.hour * barW + 1;
      const y = PAD.top + plotH - barH;
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(x, y, barW - 2, barH);
    }
  }, [data]);

  const ref = useCanvas(draw);
  return <canvas ref={ref} className="w-full h-full" />;
}
