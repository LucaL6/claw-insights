import { useCallback } from 'react';
import { useCanvas } from './useCanvas';
import { PAD } from './chart-utils';

interface HourlyData { hour: number; gatewayUp: boolean; restartEvent: boolean }

export function UptimeStrip({ data }: { data: HourlyData[] }) {
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const plotW = w - PAD.left - PAD.right;
    const cellW = plotW / 24;
    const y = 14;
    const cellH = h - 20;

    for (const d of data) {
      const x = PAD.left + d.hour * cellW;
      if (d.restartEvent) {
        ctx.fillStyle = '#fbbf24';
      } else if (d.gatewayUp) {
        ctx.fillStyle = '#065f46';
      } else {
        ctx.fillStyle = '#7f1d1d';
      }
      ctx.fillRect(x + 0.5, y, cellW - 1, cellH);
    }

    // Hour labels
    ctx.fillStyle = '#52525b';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < 24; i += 6) {
      ctx.fillText(`${i}`, PAD.left + i * cellW + cellW / 2, h - 2);
    }
  }, [data]);

  const ref = useCanvas(draw);
  return <canvas ref={ref} className="w-full h-full" />;
}
