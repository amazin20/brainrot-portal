import * as THREE from 'three';

export class InputController {
  constructor({ joystick, joystickKnob, jumpButton, isActive = () => true }) {
    this.isActive = isActive;
    this.disposed = false;
    this.keys = new Set();
    this.mobileMove = new THREE.Vector2();
    this.jumpQueued = false;
    this.restartQueued = false;
    this.pauseQueued = false;
    this.joystick = joystick;
    this.joystickKnob = joystickKnob;
    this.jumpButton = jumpButton;
    this.joystickPointer = null;
    this.listeners = [];

    this.onKeyDown = (event) => {
      if (this.disposed || !this.isActive()) return;
      // A held key must be released and pressed again after a reset.
      if (event.repeat && !this.keys.has(event.code)) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
      if (event.code === 'Space' && !event.repeat) this.jumpQueued = true;
      if (event.code === 'KeyR' && !event.repeat) this.restartQueued = true;
      if (event.code === 'Escape' && !event.repeat) this.pauseQueued = true;
    };
    this.onKeyUp = (event) => this.keys.delete(event.code);
    this.onBlur = () => this.reset();
    this.onVisibilityChange = () => { if (document.hidden) this.reset(); };
    this.listen(window, 'keydown', this.onKeyDown, { passive: false });
    this.listen(window, 'keyup', this.onKeyUp);
    this.listen(window, 'blur', this.onBlur);
    this.listen(document, 'visibilitychange', this.onVisibilityChange);

    this.setupTouch();
  }

  listen(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    this.listeners.push({ target, type, listener, options });
  }

  resetStick() {
    const pointer = this.joystickPointer;
    // Clear ownership first: release can synchronously trigger lostpointercapture.
    this.joystickPointer = null;
    this.mobileMove.set(0, 0);
    this.joystickKnob.style.transform = 'translate(0, 0)';
    if (pointer === null) return;
    try {
      if (!this.joystick.hasPointerCapture || this.joystick.hasPointerCapture(pointer)) {
        this.joystick.releasePointerCapture?.(pointer);
      }
    } catch (error) {
      // A cancelled pointer may already have been removed by the browser.
      if (error.name !== 'NotFoundError' && error.name !== 'InvalidStateError') throw error;
    }
  }

  reset() {
    this.keys.clear();
    this.jumpQueued = this.restartQueued = this.pauseQueued = false;
    this.resetStick();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const { target, type, listener, options } of this.listeners) {
      target.removeEventListener(type, listener, options);
    }
    this.listeners.length = 0;
    this.reset();
  }

  setupTouch() {
    const updateStick = (event) => {
      const rect = this.joystick.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const max = rect.width * 0.31;
      // Hidden/resizing controls must not introduce NaN into player movement.
      if (!(max > 0)) { this.resetStick(); return; }
      let dx = event.clientX - centerX;
      let dy = event.clientY - centerY;
      const length = Math.hypot(dx, dy) || 1;
      if (length > max) { dx = dx / length * max; dy = dy / length * max; }
      this.mobileMove.set(dx / max, dy / max);
      this.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const endStick = (event) => {
      if (this.joystickPointer !== event.pointerId) return;
      this.resetStick();
    };
    this.listen(this.joystick, 'pointerdown', (event) => {
      if (this.disposed || !this.isActive() || this.joystickPointer !== null) return;
      this.joystickPointer = event.pointerId;
      try { this.joystick.setPointerCapture?.(event.pointerId); }
      catch (error) {
        this.resetStick();
        if (!['NotFoundError', 'InvalidStateError'].includes(error.name)) throw error;
        return;
      }
      updateStick(event);
    });
    this.listen(this.joystick, 'pointermove', (event) => {
      if (this.disposed || !this.isActive()) { this.resetStick(); return; }
      if (this.joystickPointer === event.pointerId) updateStick(event);
    });
    this.listen(this.joystick, 'pointerup', endStick);
    this.listen(this.joystick, 'pointercancel', endStick);
    this.listen(this.joystick, 'lostpointercapture', endStick);
    this.listen(this.jumpButton, 'pointerdown', (event) => {
      if (this.disposed || !this.isActive()) return;
      event.preventDefault();
      this.jumpQueued = true;
    });
  }

  getMove() {
    if (this.disposed || !this.isActive()) return new THREE.Vector2();
    const x = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0)
      - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) + this.mobileMove.x;
    const z = (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0)
      - (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) + this.mobileMove.y;
    const move = new THREE.Vector2(x, z);
    if (move.lengthSq() > 1) move.normalize();
    return move;
  }

  consumeJump() { const queued = this.jumpQueued; this.jumpQueued = false; return queued && !this.disposed && this.isActive(); }
  consumeRestart() { const queued = this.restartQueued; this.restartQueued = false; return queued && !this.disposed && this.isActive(); }
  consumePause() { const queued = this.pauseQueued; this.pauseQueued = false; return queued && !this.disposed && this.isActive(); }
}
