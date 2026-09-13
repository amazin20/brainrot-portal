import { CAMERA_PITCH_MIN, CAMERA_PITCH_MAX } from './LabCamera.js';

const clampPitch = pitch => Math.min(CAMERA_PITCH_MAX, Math.max(CAMERA_PITCH_MIN, pitch));

/** Owns camera/action events for one game instance, not for one room.
 * Touch ownership is independent from the movement joystick. A pause cancels
 * the gesture; moving a finger left on the glass never resumes an old drag. */
export class LabControls {
  constructor(game, { scope = globalThis.window, document: doc = globalThis.document } = {}) {
    this.game = game;
    this.scope = scope;
    this.document = doc;
    this.canvas = game.renderer.domElement;
    this.listeners = [];
    this.lookPointer = null;
    this.disposed = false;
    const canvas = this.canvas;

    this.listen(canvas, 'contextmenu', event => event.preventDefault());
    this.listen(canvas, 'pointerdown', event => {
      if (!this.active) return;
      if (event.pointerType === 'touch') {
        if (this.lookPointer) return;
        this.lookPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
        try { canvas.setPointerCapture?.(event.pointerId); }
        catch (error) {
          this.lookPointer = null;
          if (!['NotFoundError', 'InvalidStateError'].includes(error.name)) throw error;
        }
        return;
      }
      if (doc.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.()?.catch?.(() => {});
        return;
      }
      if (event.button === 0 || event.button === 2) game.firePortal(event.button === 0 ? 0 : 1);
    });
    this.listen(scope, 'mousemove', event => {
      if (!this.active || doc.pointerLockElement !== canvas) return;
      game.yaw -= event.movementX * .002;
      game.pitch = clampPitch(game.pitch - event.movementY * .0018);
    });
    this.listen(canvas, 'pointermove', event => {
      if (!this.active) { this.reset(); return; }
      const pointer = this.lookPointer;
      if (!pointer || pointer.id !== event.pointerId) return;
      game.yaw -= (event.clientX - pointer.x) * .005;
      game.pitch = clampPitch(game.pitch - (event.clientY - pointer.y) * .004);
      pointer.x = event.clientX; pointer.y = event.clientY;
    });
    const endLook = event => {
      if (this.lookPointer?.id === event.pointerId) this.reset();
    };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this.listen(canvas, type, endLook);
    // Fallback for browsers without capture; ownership makes bubbling harmless.
    for (const type of ['pointerup', 'pointercancel']) this.listen(scope, type, endLook);
    this.listen(scope, 'keydown', event => {
      if (event.repeat || !this.active) return;
      if (event.code === 'KeyE') game.interactQueued = true;
      if (event.code === 'KeyV') {
        game.animator?.trigger?.('celebrate'); game.companionAnimator?.trigger?.('celebrate');
      }
    });
    const loseFocus = () => {
      game.resetInput();
      if (game.state === 'playing') game.togglePause(true);
    };
    this.listen(scope, 'blur', loseFocus);
    this.listen(doc, 'visibilitychange', () => { if (doc.hidden) loseFocus(); });
  }

  get active() { return !this.disposed && this.game.state === 'playing' && !this.game.externalBlocked; }

  listen(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    this.listeners.push({ target, type, listener, options });
  }

  reset() {
    const pointer = this.lookPointer;
    this.lookPointer = null; // Release may synchronously notify lost capture.
    if (!pointer) return;
    try {
      if (!this.canvas.hasPointerCapture || this.canvas.hasPointerCapture(pointer.id)) {
        this.canvas.releasePointerCapture?.(pointer.id);
      }
    } catch (error) {
      if (!['NotFoundError', 'InvalidStateError'].includes(error.name)) throw error;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const { target, type, listener, options } of this.listeners) target.removeEventListener(type, listener, options);
    this.listeners.length = 0;
    this.reset();
  }
}
