import { $, start, reduced, node, button, listen } from './atlas-common.js';
export function installControls({settingsPanel,controls,sound,settingsTop,settingsButton,helpButton,mapButton,map,tabs}) {
 const dialog = node('dialog', 'atlas-dialog'); dialog.id = 'atlas-dialog';
 const dialogHead = node('div', 'atlas-dialog-head', '<div><span class="atlas-eyebrow">ПОД ТЕБЯ</span><h2 id="atlas-dialog-title">Настройки</h2></div>');
 const close = button('atlas-icon', '×', 'Закрыть окно'); dialogHead.append(close);
 const dialogBody = node('div', 'atlas-dialog-body'); dialog.append(dialogHead, dialogBody);
 dialog.setAttribute('aria-labelledby', 'atlas-dialog-title'); document.body.append(dialog);
 const settingsHome = settingsPanel.parentNode, settingsNext = settingsPanel.nextSibling;
 let returnFocus = null;
 const restoreSettings = () => { if (settingsPanel.parentNode === dialogBody) settingsHome.insertBefore(settingsPanel, settingsNext?.parentNode === settingsHome ? settingsNext : null); };
 const closeDialog = () => { if (dialog.open) dialog.close(); };
 function openDialog(kind, trigger) {
  if (document.documentElement.dataset.runtimeState !== 'ready') return;
  restoreSettings(); dialogBody.replaceChildren(); returnFocus = trigger;
  $('#atlas-dialog-title').textContent = kind === 'settings' ? 'Настройки' : 'По обе стороны';
  if (kind === 'settings') dialogBody.append(settingsPanel);
  else { const instructions = controls?.cloneNode(true); if (instructions) { instructions.open = true; $('summary', instructions)?.remove(); dialogBody.append(instructions); } }
  dialog.showModal(); close.focus();
 }
 listen(close, 'click', closeDialog);
 listen(dialog, 'close', () => { restoreSettings(); returnFocus?.focus({preventScroll:true}); });
 listen(dialog, 'click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog(); } });
 listen(settingsTop, 'click', () => openDialog('settings', settingsTop));
 listen(settingsButton, 'click', () => openDialog('settings', settingsButton));
 listen(helpButton, 'click', () => openDialog('help', helpButton));
 listen(mapButton, 'click', () => { map.scrollIntoView({behavior: reduced.matches ? 'instant' : 'smooth', block:'center'}); $('[aria-selected="true"]', tabs)?.focus({preventScroll:true}); });
 function syncSound() { const muted = $('#mute-toggle').checked; sound.setAttribute('aria-pressed', String(muted)); sound.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук'); sound.classList.toggle('is-muted', muted); }
 listen(sound, 'click', () => { const mute = $('#mute-toggle'); mute.checked = !mute.checked; mute.dispatchEvent(new Event('change', {bubbles:true})); syncSound(); });
 listen($('#mute-toggle'), 'change', syncSound); syncSound();
 return {closeDialog,syncSound};
}
