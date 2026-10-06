/* Shared presentation utilities; no game state or storage access. */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const start = $('#start-screen');
export const reduced = matchMedia('(prefers-reduced-motion: reduce)');
export const ranges = ['01—10', '11—20', '21—30', '31—40', '41', '42—51'];
export const sectorNames = ['Первый контакт', 'В движении', 'Связи пространства', 'Сложные системы', 'Складчатый замок', 'За пределами'];
export const sector = n => n <= 10 ? 0 : n <= 20 ? 1 : n <= 30 ? 2 : n <= 40 ? 3 : n === 41 ? 4 : 5;
const icons = {
 map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15m6-12v15"/>',
 settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
 help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.1"/>',
 gallery: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m3 16 5-5 5 5 3-3 5 5"/><circle cx="16" cy="9" r="1"/>',
 sound: '<path d="m11 4-6 5H2v6h3l6 5ZM15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
 portal: '<ellipse cx="12" cy="12" rx="6" ry="10"/><path d="M12 6v12M8 12h8"/>'
};
export const icon = key => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[key]}</svg>`;
export const node = (tag, cls, html) => { const e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; return e; };
export const button = (cls, html, label) => { const e = node('button', cls, html); e.type = 'button'; if (label) e.setAttribute('aria-label', label); return e; };
export const cleanup = [];
export function listen(target, type, fn, options) { target.addEventListener(type, fn, options); cleanup.push(() => target.removeEventListener(type, fn, options)); }
