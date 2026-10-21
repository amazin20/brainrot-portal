const paths = {
  portal: '<ellipse cx="12" cy="12" rx="6.5" ry="9"/><path d="M9 6.5c-2 2.4-2 8.6 0 11M15 6.5c2 2.4 2 8.6 0 11" opacity=".45"/>',
  interact: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V12m0-1a1.5 1.5 0 0 1 3 0v2m0-.5a1.5 1.5 0 0 1 3 0V16c0 3-2 5-5 5h-2c-2 0-3-.8-4-2l-5-6a1.5 1.5 0 0 1 2-2l3 3"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
  jump: '<path d="m6 10 6-6 6 6M12 4v12M5 20h14"/>',
  sprint: '<circle cx="15" cy="4" r="2"/><path d="m8 11 4-4 4 3 4 1M12 7l-2 7 5 3-2 5M10 14l-4 5H2M2 8h4M1 12h3"/>',
};

export function touchButtonContent(kind, label, number = '') {
  if (!paths[kind]) throw new Error('Unknown touch icon: ' + kind);
  return `<svg class="touch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[kind]}</svg>`
    + (number ? `<span class="touch-channel" aria-hidden="true">${number}</span>` : '')
    + `<span class="touch-label" aria-hidden="true">${label}</span>`;
}

/** Each finger owns its own visual feedback. Pointer cancellation, pause and
 * focus loss clear it; CSS :active alone cannot represent a multi-touch chord. */
export function bindTouchFeedback(owner, targets, scope = window) {
  const pointers = new Map();
  const reset = () => { pointers.clear(); for (const target of targets) target.removeAttribute('data-pressed'); };
  const release = event => {
    const target = pointers.get(event.pointerId);
    pointers.delete(event.pointerId);
    if (target && ![...pointers.values()].includes(target)) target.removeAttribute('data-pressed');
  };
  for (const target of targets) {
    owner.listen(target, 'pointerdown', event => {
      if (!owner.active) return;
      pointers.set(event.pointerId, target); target.setAttribute('data-pressed', 'true');
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) owner.listen(target, type, release);
  }
  for (const type of ['pointerup', 'pointercancel']) owner.listen(scope, type, release);
  owner.listen(scope, 'blur', reset);
  return { reset };
}
