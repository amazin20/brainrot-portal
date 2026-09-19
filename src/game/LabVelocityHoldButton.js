// A held touch button owns one pointer. Capture can be unavailable while a
// browser transitions out of pointer lock, so release also has a window path.
export function bindVelocityHoldButton(button, {
  key, getInput, isActive, scope = globalThis.window, document: doc = globalThis.document,
}) {
  let owner = null, disposed = false;
  const listeners = [];
  const listen = (target, type, callback) => {
    target.addEventListener(type, callback);
    listeners.push([target, type, callback]);
  };
  const expectedCaptureError = error => ['NotFoundError', 'InvalidStateError'].includes(error.name);
  const reset = () => {
    const pointer = owner; owner = null;
    getInput()?.keys.delete(key);
    if (pointer === null) return;
    try {
      if (!button.hasPointerCapture || button.hasPointerCapture(pointer)) button.releasePointerCapture?.(pointer);
    } catch (error) { if (!expectedCaptureError(error)) throw error; }
  };
  const release = event => { if (event.pointerId === owner) reset(); };
  listen(button, 'pointerdown', event => {
    if (disposed || !isActive() || owner !== null) return;
    event.preventDefault(); owner = event.pointerId;
    try { button.setPointerCapture?.(owner); }
    catch (error) {
      // Keep the genuine held pointer usable if capture alone was denied.
      // Window pointerup/cancel still releases exactly this gesture.
      if (!expectedCaptureError(error)) { reset(); throw error; }
    }
    getInput()?.keys.add(key);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(button, type, release);
  for (const type of ['pointerup', 'pointercancel']) listen(scope, type, release);
  listen(scope, 'blur', reset);
  listen(doc, 'visibilitychange', () => { if (doc.hidden) reset(); });
  return {
    reset,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const [target, type, callback] of listeners) target.removeEventListener(type, callback);
      reset();
    },
  };
}
