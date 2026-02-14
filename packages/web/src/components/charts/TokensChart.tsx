import { useCallback } from 'react';
import { useCanvas } from './useCanvas';
import { drawYAxis, drawXAxis, PAD } from './chart-utils';

interface HourlyData { hour: number; tokensK: number }

export function TokensChart({ data }: { data: HourlyData[] }) {
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const plotW = w - PAD.left - PAD.right;
    const plotH = h - PAD.top - PAD.bottom;

    // Cumulative
    let cum = 0;
    const cumData = data.map(d => { cum += d.tokensK; return { hour: d.hour, cumK: cum }; });
    const max = Math.max(1, cum);
    const stepX = plotW / 24;

    drawYAxis(ctx, PAD.left, h, max, 4, PAD);
    drawXAxis(ctx, h - PAD.bottom, PAD.left, plotW);

    // Area fill
    ctx.beginPath();
    ctx.moveTo(PAD.left, PAD.top + plotH);
    for (const d of cumData) {
      const x = PAD.left + d.hour * stepX + stepX / 2;
      const y = PAD.top + plotH - (d.cumK / max) * plotH;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(PAD.left + 23 * stepX + stepX / 2, PAD.top + plotH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
    ctx.fill();

    // Line
    ctx.beginPath();
    for (const d of cumData) {
      const x = PAD.left + d.hour * stepX + stepX / 2;
      const y = PAD.top + plotH - (d.cumK / max) * plotH;
      d.hour === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [data]);

  const ref = useCanvas(draw);
  return <canvas ref={ref} className="w-full h-full" />;
}
