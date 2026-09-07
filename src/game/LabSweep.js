/** Segment versus a (possibly expanded) axis-aligned box. Allocation is limited
 * to a returned contact; no dependency on renderer or clocks. */
export function sweepBox(from, to, min, max) {
  let enter = -Infinity, leave = Infinity, axis = null, sign = 0;
  for (const key of ['x', 'y', 'z']) {
    const d = to[key] - from[key];
    if (Math.abs(d) < 1e-12) {
      if (from[key] < min[key] || from[key] > max[key]) return null;
      continue;
    }
    let a = (min[key] - from[key]) / d, b = (max[key] - from[key]) / d;
    const n = d > 0 ? -1 : 1;
    if (a > b) [a, b] = [b, a];
    if (a > enter) { enter = a; axis = key; sign = n; }
    leave = Math.min(leave, b);
    if (enter > leave) return null;
  }
  if (!axis || enter < -1e-6 || enter > 1 || leave < 0) return null;
  return { t: Math.max(0, enter), axis, sign };
}
