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
    this.lastUnlockedMotion = null;
    this.pendingLockRebound = null;
    this.pointerLocked = doc.pointerLockElement === this.canvas;
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
    this.listen(doc, 'pointerlockchange', event => {
      this.observePointerLock(event.timeStamp);
    });
    this.listen(scope, 'mousemove', event => {
      // The property can change before Chromium dispatches pointerlockchange.
      // Arm the recenter filter at either observation, exactly once per lock.
      if (!this.observePointerLock(event.timeStamp)) {
        if (event.movementX || event.movementY) {
          this.lastUnlockedMotion = {
            x: event.movementX, y: event.movementY,
            clientX: event.clientX, clientY: event.clientY,
          };
        }
        return;
      }
      // Chromium can report the move to the Play button again in reverse when
      // pointer lock centers the cursor. Rendering can delay that first event
      // for seconds, so an unchanged cursor position also confirms the rebound.
      // Consume the candidate once, including while gameplay is paused.
      const rebound = this.pendingLockRebound;
      if (rebound && (event.movementX || event.movementY)) {
        this.pendingLockRebound = null;
        const unchangedPosition = Number.isFinite(rebound.clientX) && Number.isFinite(rebound.clientY) &&
          event.clientX === rebound.clientX && event.clientY === rebound.clientY;
        if (event.movementX === -rebound.x && event.movementY === -rebound.y &&
            (unchangedPosition || Math.abs(event.timeStamp - rebound.lockedAt) < 250)) return;
      }
      if (!this.active) return;
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

  observePointerLock(timeStamp) {
    const locked = this.document.pointerLockElement === this.canvas;
    if (locked !== this.pointerLocked) {
      this.pointerLocked = locked;
      this.pendingLockRebound = locked && this.lastUnlockedMotion
        ? { ...this.lastUnlockedMotion, lockedAt: timeStamp } : null;
      this.lastUnlockedMotion = null;
    }
    return locked;
  }

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
