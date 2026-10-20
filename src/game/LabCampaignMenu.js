import {CAMPAIGN_THEMES,campaignTheme} from './LabCampaignThemes.js';
import {deriveCampaignAccess} from './LabCampaignAccess.js';
/** Accessible map of the actual campaign and its saved completion frontier.
 * Selecting a node does not launch or reset a room. Only Play does that. */
export function createCampaignMenu({root,select,availableRooms,spec,preferences,onChoose,number=index=>index+1,theme=campaignTheme,isAccessible}) {
 let activeSector=-1;
 const tabs=root.querySelector('.sector-tabs'),nodes=root.querySelector('.sector-nodes');
 const name=root.querySelector('.sector-name'),range=root.querySelector('.sector-range');
 const sectors=CAMPAIGN_THEMES.map((s,index)=>({...s,index,rooms:availableRooms.filter(i=>theme(i).id===s.id)})).filter(s=>s.rooms.length);
 nodes.id='campaign-sector-panel';nodes.setAttribute('role','tabpanel');
 const access=()=>deriveCampaignAccess(preferences.value,availableRooms);
 const canChoose=index=>availableRooms.includes(index)&&(isAccessible?isAccessible(index):access().accessibleIndices.includes(index));
 const completed=index=>preferences.value.completed.includes(index);
 const lockText=()=>{const next=access().nextIndex;return next===null||next===undefined?'Откроется по ходу кампании':`Сначала пройди комнату ${String(number(next)).padStart(2,'0')}`;};
 const stateText=index=>completed(index)?'ПРОЙДЕНО':!canChoose(index)?'ЗАКРЫТО':index===40?'ФИНАЛ · ОДИН ЗАХОД':'ДОСТУПНО';
 function syncNode(button,index){
  const locked=!canChoose(index),passed=completed(index);
  button.disabled=locked;button.setAttribute('aria-disabled',String(locked));
  button.setAttribute('aria-pressed',String(!locked&&Number(select.value)===index));
  button.classList.toggle('room-node--completed',passed);button.classList.toggle('room-node--locked',locked);
  button.setAttribute('aria-label',`Комната ${number(index)}: ${spec(index).title}${passed?', пройдена':locked?`, закрыта. ${lockText()}`:', доступна'}`);
  button.title=locked?lockText():passed?'Можно пройти ещё раз':'Начни новое испытание';
  button.querySelector('.room-node-state').textContent=stateText(index);
  button.querySelector('.room-node-lock').hidden=!locked;
 }
 function syncSectorStatus(){
  tabs.querySelectorAll('button').forEach(button=>{
   const sector=sectors.find(s=>s.index===Number(button.dataset.sector)),locked=!sector.rooms.some(canChoose);
   button.classList.toggle('chapter-tab--locked',locked);
   button.setAttribute('aria-label',`${sector.name}, комнаты ${number(sector.rooms[0])}–${number(sector.rooms.at(-1))}${locked?', пока закрыты':''}`);
  });
  const sector=sectors.find(s=>s.index===activeSector),footer=root.querySelector('.map-footer');
  if(footer)footer.textContent=sector&&!sector.rooms.some(canChoose)?`${lockText()}. Пройденные комнаты всегда можно повторить.`:'Пройди испытание, чтобы открыть следующее. Пройденные комнаты можно повторять.';
 }
 function selectSector(index,{focus=false}={}){
  const sector=sectors.find(s=>s.index===index)||sectors[0];if(!sector)return;
  const changed=activeSector!==sector.index;activeSector=sector.index;
  root.style.setProperty('--sector-accent',sector.color);root.dataset.theme=sector.id;
  name.textContent=sector.name;
  range.textContent=`${String(number(sector.rooms[0])).padStart(2,'0')} — ${String(number(sector.rooms.at(-1))).padStart(2,'0')}`;
  const subtitle=root.querySelector('.sector-subtitle');if(subtitle)subtitle.textContent=sector.subtitle;
  tabs.querySelectorAll('button').forEach(b=>{const active=Number(b.dataset.sector)===sector.index;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
  nodes.setAttribute('aria-labelledby',`campaign-sector-${sector.index}`);
  if(changed){
   nodes.replaceChildren();nodes.classList.toggle('sector-nodes--castle',sector.rooms.length===1);
   for(const [order,roomIndex]of sector.rooms.entries()){
    const button=document.createElement('button'),room=spec(roomIndex);
    button.type='button';button.className='room-node';button.dataset.level=String(number(roomIndex));button.dataset.roomIndex=String(roomIndex);
    button.style.setProperty('--node-order',String(order));
    const numeral=document.createElement('span');numeral.className='room-node-number';numeral.textContent=String(number(roomIndex)).padStart(2,'0');
    const lock=document.createElement('span');lock.className='room-node-lock';lock.setAttribute('aria-hidden','true');numeral.append(lock);
    const title=document.createElement('span');title.className='room-node-title';title.textContent=room.title;
    const state=document.createElement('span');state.className='room-node-state';state.textContent=stateText(roomIndex);
    button.append(numeral,title,state);syncNode(button,roomIndex);
    button.addEventListener('click',()=>{if(!canChoose(roomIndex))return;select.value=String(roomIndex);sync();onChoose(roomIndex);});nodes.append(button);
   }
  }
  syncSectorStatus();
  if(focus)tabs.querySelector(`[data-sector="${activeSector}"]`)?.focus();
 }
 for(const sector of sectors){
  const button=document.createElement('button');button.type='button';button.dataset.sector=sector.index;button.id=`campaign-sector-${sector.index}`;
  button.setAttribute('role','tab');button.setAttribute('aria-controls',nodes.id);
  button.setAttribute('aria-label',`${sector.name}, комнаты ${number(sector.rooms[0])}–${number(sector.rooms.at(-1))}`);
  const symbol=document.createElement('span');symbol.className='chapter-tab-number';symbol.textContent=sector.symbol;
  const label=document.createElement('span');label.textContent=sector.short;
  button.append(symbol,label);button.addEventListener('click',()=>selectSector(sector.index));tabs.append(button);
 }
 tabs.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();let i=sectors.findIndex(s=>s.index===activeSector);
  i=event.key==='Home'?0:event.key==='End'?sectors.length-1:(i+(event.key==='ArrowRight'?1:-1)+sectors.length)%sectors.length;
  selectSector(sectors[i].index,{focus:true});
 });
 nodes.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
  const buttons=[...nodes.querySelectorAll('.room-node')],at=buttons.indexOf(document.activeElement);if(at<0)return;
  const enabled=buttons.filter(button=>!button.disabled);if(!enabled.length)return;
  event.preventDefault();const cols=getComputedStyle(nodes).gridTemplateColumns.split(' ').length;
  let next;
  if(event.key==='Home'||event.key==='End')next=event.key==='Home'?enabled[0]:enabled.at(-1);
  else{
   const direction=['ArrowUp','ArrowLeft'].includes(event.key)?-1:1;
   const step=['ArrowUp','ArrowDown'].includes(event.key)?cols:1,target=at+direction*step;
   const candidates=enabled.filter(button=>(buttons.indexOf(button)-at)*direction>0);
   next=candidates.reduce((nearest,button)=>!nearest||Math.abs(buttons.indexOf(button)-target)<Math.abs(buttons.indexOf(nearest)-target)?button:nearest,null);
  }
  next?.focus(); // Locked nodes never receive keyboard focus or selection.
 });
 function sync({reveal=false}={}){
  let index=Number(select.value);
  if(!canChoose(index)){
   const next=access().nextIndex;index=canChoose(next)?next:availableRooms.find(canChoose);
   if(index===undefined)return;select.value=String(index);
  }
  const sector=sectors.find(s=>s.rooms.includes(index))||sectors[0],room=spec(index);
  if(!sector||!room)return;
  if(activeSector<0||reveal||activeSector===sector.index)selectSector(sector.index);
  nodes.querySelectorAll('.room-node').forEach(button=>syncNode(button,Number(button.dataset.roomIndex)));
  syncSectorStatus();
  document.querySelector('#selected-room-number').textContent=`КОМНАТА ${String(number(index)).padStart(2,'0')}`;
  document.querySelector('#selected-room-title').textContent=room.title;
  document.querySelector('#selected-room-description').textContent=room.description?.split(/(?<=\.)\s+/)[0]||'Исследуй пространство и доберись до выхода вместе с другом.';
  document.querySelector('#selected-room-status').textContent=completed(index)?'✓ Пройдено · можно повторить':index===40?'Финал · один заход без контрольных точек':'Следующее испытание · доступно';
  document.querySelector('.hero-index').textContent=String(number(index)).padStart(2,'0');
  const detail=document.querySelector('.mission-panel');if(detail){detail.dataset.theme=sector.id;detail.style.setProperty('--mission-accent',sector.color);}
  const themeLabel=document.querySelector('#selected-theme');if(themeLabel)themeLabel.textContent=sector.name;
  const illustrationNumber=document.querySelector('#mission-illustration-number');if(illustrationNumber)illustrationNumber.textContent=String(number(index)).padStart(2,'0');
  const count=document.querySelector('#campaign-completed');if(count)count.textContent=`${availableRooms.filter(i=>preferences.value.completed.includes(i)).length} из ${availableRooms.length} пройдено`;
  const loadingChapter=document.querySelector('#loading-chapter');if(loadingChapter)loadingChapter.textContent=`${sector.name} · комната ${number(index)}`;
 }
 sync({reveal:true});return{sync};
}
