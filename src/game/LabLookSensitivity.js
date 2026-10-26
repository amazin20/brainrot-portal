export const LOOK_SENSITIVITY = Object.freeze({ min: .25, max: 2, default: 1 });

// Old saves and direct game fixtures retain the original mouse/touch response.
export function normalizeLookSensitivity(value) {
  return Number.isFinite(value)
    ? Math.min(LOOK_SENSITIVITY.max, Math.max(LOOK_SENSITIVITY.min, value))
    : LOOK_SENSITIVITY.default;
}
