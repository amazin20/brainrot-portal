import { $, $$, start, reduced, ranges, sectorNames, sector, node, cleanup, listen } from './atlas-common.js';
export function installMap({map,nodes,tabs,select,chapterLabel,count,previewLabel,previewImg,detail,prev,next,play,closeDialog,syncSound}) {
 const paths = $('.atlas-paths', map);
 function goSector(delta) { const all = $$('button[data-sector]', tabs), i = all.findIndex(b => b.getAttribute('aria-selected') === 'true'); all[(i + delta + all.length) % all.length]?.click(); }
 listen(prev, 'click', () => goSector(-1)); listen(next, 'click', () => goSector(1));
 let frame = 0, lastLevel = -1, lastNodes = '', lastSelection = '', stopped = false;
 const schedule = () => { if (!frame && !stopped) frame = requestAnimationFrame(update); };
 function drawPaths() {
  const r = nodes.getBoundingClientRect(); if (r.width === 0 || r.height === 0) return;
  const positions = $$('.room-node-number', nodes).map(e => { const p = e.getBoundingClientRect(); return [p.x-r.x+p.width/2,p.y-r.y+p.height/2]; });
  paths.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
  const line = positions.map((p,i) => `${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  paths.innerHTML = positions.length > 1 ? `<path class="atlas-route-track" d="${line}"/><path class="atlas-route-energy" d="${line}"/>` : '<circle class="atlas-castle-orbit" cx="50%" cy="45%" r="110"/>';
 }
 function update() {
  frame = 0; if (!start.classList.contains('screen--active')) return;
  const all = $$('button[data-sector]', tabs);
  for (const b of all) if (!b.dataset.atlasTab) { const name=b.textContent,i=Number(b.dataset.sector);b.dataset.atlasTab='1';b.replaceChildren(node('span','atlas-tab-index',`0${i+1}`),node('strong','',name),node('small','',ranges[i])); }
  const visible=$$('button.room-node',nodes),activeTab=$('[aria-selected="true"]',tabs);
  count.textContent=`${Number(activeTab?.dataset.sector||0)+1} / ${all.length}`;
  visible.forEach((b,i)=>{b.style.setProperty('--atlas-node',String(i));b.tabIndex=b.getAttribute('aria-pressed')==='true'?0:-1;});
  if(visible.length&&!visible.some(b=>b.tabIndex===0))visible[0].tabIndex=0;
  const level=Number(select.value)+1;
  chapterLabel.textContent=`СЕКТОР 0${sector(level)+1} / ${sectorNames[sector(level)]}`;
  $('.atlas-completed',map).textContent=`${$$('option',select).filter(o=>o.textContent.includes('✓')).length} завершено`;
  if(level!==lastLevel){
   lastLevel=level;
   const expected=`./walkthroughs/level-${String(level).padStart(2,'0')}.jpg`;
   previewLabel.firstElementChild.textContent='ВНУТРИ ИСПЫТАНИЯ';
   previewImg.onerror=()=>{previewImg.onerror=null;previewImg.src='./art/portal-laboratory-menu.webp';previewLabel.firstElementChild.textContent='ЛАБОРАТОРИЯ';};
   previewImg.src=expected;previewImg.alt=`Комната ${level}: ${$('#selected-room-title').textContent}`;
   if(!reduced.matches)detail.animate([{opacity:.55,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'ease-out'});
  }
  const signature=visible.map(b=>b.dataset.level).join(','),selection=visible.find(b=>b.getAttribute('aria-pressed')==='true')?.dataset.level||'';
  if(signature!==lastNodes||selection!==lastSelection){lastNodes=signature;lastSelection=selection;requestAnimationFrame(drawPaths);}
 }
 listen(tabs,'click',e=>{if(!e.target.closest('button[data-sector]'))return;const current=$('.room-node[aria-pressed="true"]',nodes);if(!current)$('.room-node',nodes)?.click();schedule();});
 // Only map-focused arrow keys are handled; gameplay keys are untouched.
 listen(nodes,'keydown',e=>{
  const list=$$('button.room-node',nodes),current=e.target.closest('.room-node'),i=list.indexOf(current);
  if(i<0||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
  e.preventDefault();let target;
  if(e.key==='Home')target=0;else if(e.key==='End')target=list.length-1;
  else if(e.key==='ArrowUp'||e.key==='ArrowDown')target=list.length>5?Math.min(list.length-1,9-i):i;
  else{const lower=i>=5,delta=(e.key==='ArrowRight'?1:-1)*(lower?-1:1);target=(i+delta+list.length)%list.length;}
  list[target].click();list[target].focus({preventScroll:true});schedule();
 });
 listen(nodes,'animationend',e=>{if(e.target.matches('.room-node'))drawPaths();});
 listen(map,'click',schedule);listen(select,'change',schedule);
 const observe=new MutationObserver(schedule);
 observe.observe(nodes,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-pressed']});
 observe.observe(tabs,{subtree:true,attributes:true,attributeFilter:['aria-selected']});
 observe.observe(select,{childList:true,subtree:true,characterData:true});
 const resize=new ResizeObserver(()=>requestAnimationFrame(drawPaths));resize.observe(nodes);
 const state=new MutationObserver(()=>{if(document.documentElement.dataset.runtimeState!=='ready')closeDialog();else{schedule();syncSound();}});
 state.observe(document.documentElement,{attributes:true,attributeFilter:['data-runtime-state']});
 const warp=node('div','atlas-warp');warp.setAttribute('aria-hidden','true');document.body.append(warp);
 listen(play,'click',()=>{if(!reduced.matches&&!document.hidden)warp.animate([{opacity:0,transform:'scale(.15)'},{opacity:.65,offset:.4},{opacity:0,transform:'scale(2.8)'}],{duration:420,easing:'cubic-bezier(.2,.8,.2,1)'});});
 const visibility=()=>document.documentElement.classList.toggle('atlas-hidden',document.hidden);
 listen(document,'visibilitychange',visibility);visibility();
 cleanup.push(()=>{stopped=true;cancelAnimationFrame(frame);observe.disconnect();resize.disconnect();state.disconnect();});
 update();
}
