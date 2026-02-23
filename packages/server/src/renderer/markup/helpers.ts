export type SatoriNode = { type: string; props: { style: Record<string, unknown>; children?: unknown } };

export function div(style: Record<string, unknown>, children?: unknown): SatoriNode {
  return { type: 'div', props: { style: { display: 'flex', ...style }, children } };
}

export function span(style: Record<string, unknown>, text: string): SatoriNode {
  return { type: 'div', props: { style: { display: 'flex', ...style }, children: text } };
}

export function Tag(text: string, bg: string, color: string, borderColor: string): SatoriNode {
  return span({
    padding: '2px 6px', fontSize: 10, borderRadius: 4, fontWeight: 500,
    backgroundColor: bg, color, border: `1px solid ${borderColor}`,
  }, text);
}

export function StatusBadge(isUp: boolean, colors: { emerald: string; emeraldBg: string; red: string; redBg: string }): SatoriNode {
  return div({
    alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 12,
    backgroundColor: isUp ? colors.emeraldBg : colors.redBg,
    color: isUp ? colors.emerald : colors.red,
    fontSize: 11, fontWeight: 500,
  }, [
    div({ width: 6, height: 6, borderRadius: '50%', backgroundColor: isUp ? colors.emerald : colors.red }),
    span({}, isUp ? 'UP' : 'DOWN'),
  ]);
}

export function Sparkline(points: number[], color: string, height = 40): SatoriNode {
  const max = Math.max(...points, 1);
  return div(
    { alignItems: 'flex-end', gap: 2, height },
    points.map((v, i) => div({
      width: 4, borderRadius: 1,
      height: `${Math.max(8, (v / max) * 100)}%`,
      backgroundColor: color, opacity: i === points.length - 1 ? 0.9 : 0.6,
    }))
  );
}

export function UptimeStrip(states: ('up' | 'degraded' | 'down')[], colorMap: Record<string, string>, height = 40): SatoriNode {
  return div(
    { alignItems: 'flex-end', gap: 2, height },
    states.map(s => div({ flex: 1, borderRadius: 1, height: '100%', backgroundColor: colorMap[s], opacity: 0.6 }))
  );
}
