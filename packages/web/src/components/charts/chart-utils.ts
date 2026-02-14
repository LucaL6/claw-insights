/** Compute nice Y-axis ticks that avoid duplicate labels */
function computeYTicks(max: number, desiredSteps: number): number[] {
  if (max <= 0) return [0];
  // For small values, use integer steps
  if (max <= desiredSteps) {
    const intMax = Math.ceil(max);
    const ticks: number[] = [];
    for (let i = 0; i <= intMax; i++) ticks.push(i);
    return ticks;
  }
  // Normal case: nice step size
  const rawStep = max / desiredSteps;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  let niceStep: number;
  if (residual <= 1.5) niceStep = magnitude;
  else if (residual <= 3) niceStep = 2 * magnitude;
  else if (residual <= 7) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;

  const ticks: number[] = [];
  for (let v = 0; v <= max + niceStep * 0.01; v += niceStep) {
    ticks.push(Math.round(v));
  }
  // Ensure max is included
  if (ticks[ticks.length - 1] < max) ticks.push(Math.ceil(max));
  return ticks;
}

/** Format Y value: use k suffix for large numbers */
function formatYValue(val: number): string {
  if (val >= 1000) return (val / 1000).toFixed(val >= 10000 ? 0 : 1) + 'k';
  return String(val);
}

/** Draw Y-axis labels */
export function drawYAxis(ctx: CanvasRenderingContext2D, x: number, h: number, max: number, steps: number, pad: { top: number; bottom: number }) {
  const ticks = computeYTicks(max, steps);
  const tickMax = ticks[ticks.length - 1] || 1;
  ctx.fillStyle = '#52525b';
  ctx.font = '9px monospace';
  ctx.textAlign = 'right';
  const plotH = h - pad.top - pad.bottom;

  for (const val of ticks) {
    const ratio = val / tickMax;
    const y = pad.top + plotH - plotH * ratio;
    ctx.fillText(formatYValue(val), x - 4, y + 3);
    // Grid line
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 1000, y);
    ctx.stroke();
  }
}

/** Draw X-axis hour labels */
export function drawXAxis(ctx: CanvasRenderingContext2D, y: number, left: number, plotW: number, hours: number = 24) {
  ctx.fillStyle = '#52525b';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  const step = plotW / hours;
  for (let h = 0; h < hours; h += 3) {
    ctx.fillText(`${h}h`, left + h * step + step / 2, y + 12);
  }
}

/** Common chart padding */
export const PAD = { top: 16, right: 12, bottom: 20, left: 32 };

export { computeYTicks };
