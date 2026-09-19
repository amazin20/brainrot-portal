const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function epicSpeedIntensity(speed) {
  const t = clamp01((speed - 8) / 28);
  return t * t * (3 - 2 * t);
}

/** Deterministic screen-edge segments. The central 60% stays empty, including
 * the reticle and portal placement surface; there is no camera or world blur. */
export function sampleEpicStreak(index, time, amount) {
  const intensity = clamp01(amount), angle = index * 2.399963229728653;
  const phase = ((time * (.55 + intensity * 1.15) + index * .61803398875) % 1 + 1) % 1;
  const from = .68 + phase * .64;
  const to = from + .025 + intensity * .16;
  return {
    x0: Math.cos(angle) * from, y0: Math.sin(angle) * from,
    x1: Math.cos(angle) * to, y1: Math.sin(angle) * to,
    alpha: Math.sin(phase * Math.PI) ** 2 * intensity * .36,
  };
}

/** Original graphic echoes inspired by the reference's contour / scale cuts.
 * All coordinates live outside the aiming ellipse, even during the impact. */
export function sampleEpicImpact(index, age, strength = 1) {
  const t = clamp01(age / .48), angle = index * 2.399963229728653 + .24;
  const radius = .72 + t * .56 + (index % 3) * .035;
  const length = (.12 + (index % 4) * .055) * (1 - t) * clamp01(strength);
  return {
    x0: Math.cos(angle) * radius, y0: Math.sin(angle) * radius,
    x1: Math.cos(angle) * (radius + length), y1: Math.sin(angle) * (radius + length),
    alpha: (age < 0 || age > .48 ? 0 : (1 - t) ** 2) * clamp01(strength) * .72,
    width: 1 + (index % 4) * 1.6,
  };
}

/** Render-only feel for the optional velocity course. The main render loop
 * owns time and lifecycle: this class creates no RAF, listener or timer. */
export class LabEpicDirector {
  constructor({ container = null, audio = null, options = {} } = {}) {
    this.container = container;
    this.audio = audio;
    const prefersReduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    this.options = { speedLines: true, reducedMotion: prefersReduced, sound: true, ...options };
    this.enabled = false;
    this.active = false;
    this.amount = 0;
    this.time = 0;
    this.portalPulse = 0;
    this.landingPulse = 0;
    this.crossings = 0;
    this.impactAge = 1;
    this.impactStrength = 0;
    this.canvas = null;
    this.context = null;
    this.width = this.height = 0;
    this.disposed = false;
    if (container?.appendChild && globalThis.document?.createElement) {
      const canvas = document.createElement('canvas');
      canvas.className = 'lab-epic-motion';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:3;pointer-events:none;display:none;';
      try { this.context = canvas.getContext('2d', { alpha: true }); } catch { /* Headless and unsupported canvases are optional. */ }
      if (this.context) { this.canvas = canvas; container.appendChild(canvas); }
    }
  }

  configure(options = {}) {
    Object.assign(this.options, options);
    if (this.options.reducedMotion || !this.options.speedLines) this.clear();
    if (!this.options.sound) this.audio?.resetEpicMotion?.();
  }

  update({ dt = 0, velocity = null, grounded = true, active = true, enabled = false } = {}) {
    if (this.disposed) return;
    this.enabled = !!enabled;
    this.active = !!active;
    if (!this.enabled || !this.active) { this.reset(); return; }
    const step = Number.isFinite(dt) ? Math.max(0, Math.min(.1, dt)) : 0;
    const speed = Math.hypot(...['x', 'y', 'z'].map(axis => Number.isFinite(velocity?.[axis]) ? velocity[axis] : 0));
    this.audio?.epicMotion?.(speed, { dt: step, grounded, enabled: this.options.sound, active: step > 0 });
    // A paused visual update must not continue an effect or hold a stale flash.
    if (step === 0) { this.clear(); return; }
    this.time += step;
    this.impactAge += step;
    const target = epicSpeedIntensity(speed);
    this.amount += (target - this.amount) * (1 - Math.exp(-(target > this.amount ? 7 : 11) * step));
    this.portalPulse *= Math.exp(-7 * step);
    this.landingPulse *= Math.exp(-10 * step);
    if (this.options.reducedMotion || !this.options.speedLines) { this.clear(); return; }
    this.draw();
  }

  portal(speed = 0, chain = this.crossings + 1) {
    if (!this.enabled || !this.active || this.disposed) return;
    this.portalPulse = .35 + epicSpeedIntensity(speed) * .65;
    this.crossings = Number.isFinite(chain) ? Math.max(1, chain) : this.crossings + 1;
    this.impactAge = 0;
    this.impactStrength = .55 + epicSpeedIntensity(speed) * .3 + Math.min(3, this.crossings) * .05;
    if (this.options.sound) this.audio?.epicPassage?.(speed, this.crossings);
  }

  land(strength = 0) {
    if (!this.enabled || !this.active || this.disposed) return;
    this.landingPulse = clamp01((strength - 7) / 22) * .5;
  }

  resize() {
    if (!this.canvas) return false;
    const width = Math.max(1, Math.round(this.container.clientWidth || this.canvas.clientWidth || 1));
    const height = Math.max(1, Math.round(this.container.clientHeight || this.canvas.clientHeight || 1));
    const dpr = Math.min(1.25, Math.max(1, globalThis.devicePixelRatio || 1));
    if (width !== this.width || height !== this.height || dpr !== this.dpr) {
      this.width = width; this.height = height; this.dpr = dpr;
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
      this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return width > 1 && height > 1;
  }

  draw() {
    if (!this.context || !this.resize()) return;
    const ctx = this.context, w = this.width, h = this.height;
    ctx.clearRect(0, 0, w, h);
    if (this.amount < .005 && this.portalPulse < .005 && this.landingPulse < .005) {
      this.canvas.style.display = 'none'; return;
    }
    this.canvas.style.display = 'block';
    ctx.lineCap = 'butt';
    ctx.lineWidth = .7 + this.amount * 1.2;
    for (let i = 0; i < 28; i++) {
      const streak = sampleEpicStreak(i, this.time, this.amount);
      ctx.globalAlpha = streak.alpha;
      ctx.strokeStyle = i % 11 === 0 ? '#8fedff' : '#f5f7ff';
      ctx.beginPath();
      ctx.moveTo((streak.x0 + 1) * w * .5, (streak.y0 + 1) * h * .5);
      ctx.lineTo((streak.x1 + 1) * w * .5, (streak.y1 + 1) * h * .5);
      ctx.stroke();
    }
    this.drawImpact(ctx, w, h);
    // Short, bounded edge accents acknowledge a crossing or heavy landing.
    // They never flash the full frame or move the lens / aiming point.
    if (this.portalPulse > .005) {
      ctx.globalAlpha = this.portalPulse * .24;
      ctx.strokeStyle = '#82edff';
      ctx.lineWidth = 3 + this.portalPulse * 20;
      ctx.strokeRect(-2, -2, w + 4, h + 4);
    }
    if (this.landingPulse > .005) {
      ctx.globalAlpha = this.landingPulse * .28;
      ctx.strokeStyle = '#ffd6ad'; ctx.lineWidth = 3 + this.landingPulse * 12;
      ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w, h); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawImpact(ctx, w, h) {
    if (this.impactAge > .48) return;
    // A brief ink edge followed by white contour echoes creates a distinct
    // anticipation -> release beat without hiding the world or pausing input.
    const ink = Math.max(0, 1 - this.impactAge / .07);
    if (ink > 0) {
      ctx.globalAlpha = ink * .6;
      ctx.strokeStyle = '#020207';
      ctx.lineWidth = Math.min(w, h) * .085;
      ctx.strokeRect(0, 0, w, h);
    }
    for (let i = 0; i < 24; i++) {
      const line = sampleEpicImpact(i, this.impactAge, this.impactStrength);
      ctx.globalAlpha = line.alpha;
      ctx.strokeStyle = i % 8 === 0 ? '#97f0ff' : '#ffffff';
      ctx.lineWidth = line.width;
      ctx.beginPath();
      ctx.moveTo((line.x0 + 1) * w * .5, (line.y0 + 1) * h * .5);
      ctx.lineTo((line.x1 + 1) * w * .5, (line.y1 + 1) * h * .5);
      ctx.stroke();
    }
    // Two offset outlines echo the repeated contours in the edit. Each ring
    // starts outside the reticle and expands out of frame in under half a second.
    for (let echo = 0; echo < 2; echo++) {
      const t = this.impactAge / .48, radius = .74 + t * .58 + echo * .07;
      ctx.globalAlpha = (1 - t) ** 2 * this.impactStrength * (echo ? .16 : .28);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = echo ? 1 : 2;
      ctx.beginPath(); ctx.ellipse(w * .5, h * .5, w * .5 * radius, h * .5 * radius, -.04, 0, Math.PI * 2); ctx.stroke();
    }
    const captionAlpha = Math.max(0, 1 - this.impactAge / .4) * this.impactStrength;
    ctx.globalAlpha = captionAlpha; ctx.fillStyle = '#ffffff';
    ctx.font = `italic 900 ${Math.round(Math.min(40, w * .04, h * .07))}px system-ui, sans-serif`;
    ctx.fillText('БЫСТРЕ', Math.max(20, w * .045), h * .86);
  }

  clear() {
    if (this.canvas) {
      this.context.clearRect(0, 0, this.width, this.height);
      this.canvas.style.display = 'none';
    }
  }

  reset() {
    this.amount = this.time = this.portalPulse = this.landingPulse = 0;
    this.crossings = this.impactStrength = 0; this.impactAge = 1;
    this.audio?.resetEpicMotion?.();
    this.clear();
  }

  dispose() {
    if (this.disposed) return;
    this.reset(); this.disposed = true;
    this.canvas?.remove(); this.canvas = this.context = this.container = this.audio = null;
  }
}
