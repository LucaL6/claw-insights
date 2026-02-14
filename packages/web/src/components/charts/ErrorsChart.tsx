import { useCallback } from 'react';
import { useCanvas } from './useCanvas';
import { drawYAxis, drawXAxis, PAD } from './chart-utils';

interface HourlyData { hour: number; errors: number; restartEvent: boolean }

export function ErrorsChart({ data }: { data: HourlyData[] }) {
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const plotW = w - PAD.left - PAD.right;
    const plotH = h - PAD.top - PAD.bottom;
    const max = Math.max(1, ...data.map(d => d.errors));
    const barW = plotW / 24;

    drawYAxis(ctx, PAD.left, h, max, 4, PAD);
    drawXAxis(ctx, h - PAD.bottom, PAD.left, plotW);

    for (const d of data) {
      const barH = (d.errors / max) * plotH;
      const x = PAD.left + d.hour * barW + 1;
      const y = PAD.top + plotH - barH;
      ctx.fillStyle = d.errors > 0 ? '#ef4444' : '#27272a';
      ctx.fillRect(x, y, barW - 2, barH || 1);

      // Restart marker
      if (d.restartEvent) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        const cx = x + barW / 2;
        ctx.beginPath();
        ctx.moveTo(cx, PAD.top);
        ctx.lineTo(cx, PAD.top + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
        // Triangle marker
        ctx.fillStyle = '#fbbf24';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⟲', cx, PAD.top - 2);
      }
    }
  }, [data]);

  const ref = useCanvas(draw);
  return <canvas ref={ref} className="w-full h-full" />;
}
