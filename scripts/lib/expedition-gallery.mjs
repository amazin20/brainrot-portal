import assert from 'node:assert/strict';
import {safeRelative} from './expedition-proof.mjs';

// Migrate the preserved gallery application without replacing its responsive
// layout, historical-record notices or existing media/link behavior.
export function expeditionGalleryScript(source){
 const replace=(before,after)=>{assert.equal(source.split(before).length-1,1,'Unexpected previous gallery structure: '+before.slice(0,70));source=source.replace(before,after);};
 replace('const TOTAL = 41;','const TOTAL = 51;');
 source=source.replace('one of our 41 packaged files','one of our 51 packaged files');
 replace("    next: document.querySelector('#next-level'),","    next: document.querySelector('#next-level'),\n    alternate: document.querySelector('#alternate-route'),");
 replace('  let loaded = false;',"  let loaded = false;\n  const initialAlternative = new URLSearchParams(location.search).get('route') === 'alternate';");
 replace('  function safeEntry(value) {',`  function safeAlternative(value, level) {
    const ids = {48: 'staged-cargo', 49: 'unlit-mirror', 50: 'free-cargo-bridge', 51: 'prearmed-relay'};
    const stem = 'walkthroughs/level-' + String(level).padStart(2, '0') + '-alternate';
    if (!value || value.level !== level || value.alternative !== ids[level] || !ids[level] || value.src !== stem + '.mp4' || value.poster !== stem + '.jpg') return null;
    return {level, title: value.title, src: value.src, poster: value.poster, durationSeconds: Number(value.durationSeconds)};
  }

  function safeEntry(value) {`);
 replace('      durationSeconds: Number(value.durationSeconds),','      durationSeconds: Number(value.durationSeconds),\n      alternative: safeAlternative(value.alternative, value.level),');
 replace('  function select(level, play = false) {\n    selected = level;\n    const entry = entries.get(level);',`  function select(level, play = false, alternative = false) {
    selected = level;
    const canonical = entries.get(level);
    alternative = !!(alternative && canonical?.alternative);
    const entry = alternative ? canonical.alternative : canonical;
    nodes.alternate.hidden = !canonical?.alternative;
    nodes.alternate.dataset.variant = alternative ? 'alternate' : 'canonical';
    nodes.alternate.textContent = alternative ? 'Смотреть основной маршрут' : 'Смотреть альтернативный маршрут';`);
 replace('      if (play) nodes.video.play().catch(() => {});',"      if (alternative) nodes.message.textContent = 'Альтернативное прохождение комнаты ' + level + ' через обычное управление и физику игры.';\n      if (play) nodes.video.play().catch(() => {});");
 replace("    url.searchParams.set('level', String(level));","    url.searchParams.set('level', String(level));\n    if (alternative) url.searchParams.set('route', 'alternate'); else url.searchParams.delete('route');");
 replace("  nodes.next.addEventListener('click',", "  nodes.alternate.addEventListener('click', () => select(selected, true, nodes.alternate.dataset.variant !== 'alternate'));\n\n  nodes.next.addEventListener('click',");
 replace('      select(selected);\n    })', '      select(selected, false, initialAlternative);\n    })');
 // Parsing here catches a broken migration before any public file is written.
 new Function(source);
 return source;
}
export function expeditionGalleryHTML(source,{recordings,alternatives}={}){
 assert.equal(source.split('<button id="copy-link"').length-1,1,'Expected existing gallery copy-link control');
 return source.replace('Видеопрохождения 40 комнат и финальной Башни','Видеопрохождения всех 51 комнат текущей версии')
 .replace('40 КОМНАТ + БАШНЯ','51 КОМНАТА')
 .replace('Архив записей и новое прохождение финала.','Сохранённый архив, '+recordings+' новых записей текущей версии и '+alternatives+' альтернативных маршрута. <a href="walkthroughs/history.html">41 запись предыдущих версий</a>.')
 .replace('0 / 41','0 / 51')
 .replace('<button id="copy-link"','<button id="alternate-route" class="subtle-button" type="button" hidden>Смотреть альтернативный маршрут</button>\n          <button id="copy-link"');
}
export function expeditionHistoricalVideoHTML(entries,publicationSource){
 assert.match(publicationSource,/^[a-f0-9]{40}$/);assert.deepEqual(entries.map(entry=>entry.level),Array.from({length:41},(_,i)=>i+1));
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const rows=entries.map(entry=>{safeRelative(entry.archivedSrc);safeRelative(entry.archivedPoster);assert.match(entry.sourceCommit,/^[a-f0-9]{40}$/);return `<li><a href="../${escape(entry.archivedSrc)}">${entry.level}. ${escape(entry.title)}</a> · <a href="../${escape(entry.archivedPoster)}">Кадр</a><br><small>Исходная запись: ${escape(entry.sourceCommit)} · SHA256: ${escape(entry.sha256)}</small></li>`;}).join('');
 return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Архив 41 видеопрохождения</title><style>body{background:#0e1c27;color:#e8f0ef;font:17px/1.6 system-ui;margin:0}main{max-width:1000px;margin:auto;padding:32px 24px}a{color:#8debdc}li{margin:16px 0}small{overflow-wrap:anywhere;color:#b7ccd4}</style></head><body><main><h1>Архив 41 видеопрохождения</h1><p>Точные файлы предыдущей публикации ${publicationSource}. У каждой записи сохранена её собственная исходная версия. Совместимость этих исторических маршрутов с текущими задачами комнат не заявлена.</p><p><a href="../walkthroughs.html">Все 51 прохождения текущей версии</a> · <a href="../publication-history/${publicationSource}/">Предыдущая игра с 41 комнатой</a></p><ol>${rows}</ol></main></body></html>`;
}
