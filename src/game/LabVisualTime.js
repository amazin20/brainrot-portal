// The frame owner decides how much visual time is allowed, including pause and
// focus recovery. Consumers must not each silently discard a different amount.
export const LAB_VISUAL_MAX_FRAME_SECONDS = .1;
export const LAB_POSE_SUBSTEP_SECONDS = 1 / 240;

export function visualSeconds(value, fallback = 0) {
  return Number.isFinite(value ?? fallback) ? Math.max(0, value ?? fallback) : 0;
}

export function permittedVisualSeconds(value, active = true) {
  return active ? Math.min(LAB_VISUAL_MAX_FRAME_SECONDS, visualSeconds(value)) : 0;
}

export function poseSubsteps(seconds) {
  const count = Math.max(1, Math.ceil(visualSeconds(seconds) / LAB_POSE_SUBSTEP_SECONDS - 1e-9));
  return { count, seconds: visualSeconds(seconds) / count };
}
