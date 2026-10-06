import {CAMPAIGN_THEMES,campaignTheme} from './LabCampaignThemes.js';
/** Accessible map of the actual campaign. No fake locks, stars or collectibles.
 * Selecting a node does not launch or reset a room. Only Play does that. */
export function createCampaignMenu({root,select,availableRooms,spec,preferences,onChoose}) {
 let activeSector=-1;
 const tabs=root.querySelector('.sector-tabs'),nodes=root.querySelector('.sector-nodes');
 const name=root.querySelector('.sector-name'),range=root.querySelector('.sector-range');
 const sectors=CAMPAIGN_THEMES.map((s,index)=>({...s,index,rooms:availableRooms.filter(i=>i>=s.from&&i<=s.to)})).filter(s=>s.rooms.length);
 nodes.id='campaign-sector-panel';nodes.setAttribute('role','tabpanel');
 const stateText=index=>preferences.value.completed.includes(index)?'ПРОЙДЕНО':index===40?'ОДИН ЗАХОД':'ИССЛЕДОВАТЬ';
 function selectSector(index,{focus=false}={}){
  const sector=sectors.find(s=>s.index===index)||sectors[0];if(!sector)return;
  const changed=activeSector!==sector.index;activeSector=sector.index;
  root.style.setProperty('--sector-accent',sector.color);root.dataset.theme=sector.id;
  name.textContent=sector.name;
  range.textContent=`${String(sector.rooms[0]+1).padStart(2,'0')} — ${String(sector.rooms.at(-1)+1).padStart(2,'0')}`;
  const subtitle=root.querySelector('.sector-subtitle');if(subtitle)subtitle.textContent=sector.subtitle;
  tabs.querySelectorAll('button').forEach(b=>{const active=Number(b.dataset.sector)===sector.index;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
  nodes.setAttribute('aria-labelledby',`campaign-sector-${sector.index}`);
  if(changed){
   nodes.replaceChildren();nodes.classList.toggle('sector-nodes--castle',sector.rooms.length===1);
   for(const [order,roomIndex]of sector.rooms.entries()){
    const button=document.createElement('button'),room=spec(roomIndex),completed=preferences.value.completed.includes(roomIndex);
    button.type='button';button.className='room-node';button.dataset.level=String(roomIndex+1);
    button.style.setProperty('--node-order',String(order));
    button.setAttribute('aria-label',`Комната ${roomIndex+1}: ${room.title}${completed?', пройдена':''}`);
    button.setAttribute('aria-pressed',String(Number(select.value)===roomIndex));
    const number=document.createElement('span');number.className='room-node-number';number.textContent=String(roomIndex+1).padStart(2,'0');
    const title=document.createElement('span');title.className='room-node-title';title.textContent=room.title;
    const state=document.createElement('span');state.className='room-node-state';state.textContent=stateText(roomIndex);
    button.classList.toggle('room-node--completed',completed);button.append(number,title,state);
    button.addEventListener('click',()=>{select.value=String(roomIndex);sync();onChoose(roomIndex);});nodes.append(button);
   }
  }
  if(focus)tabs.querySelector(`[data-sector="${activeSector}"]`)?.focus();
 }
 for(const sector of sectors){
  const button=document.createElement('button');button.type='button';button.dataset.sector=sector.index;button.id=`campaign-sector-${sector.index}`;
  button.setAttribute('role','tab');button.setAttribute('aria-controls',nodes.id);
  button.setAttribute('aria-label',`${sector.name}, комнаты ${sector.rooms[0]+1}–${sector.rooms.at(-1)+1}`);
  const number=document.createElement('span');number.className='chapter-tab-number';number.textContent=sector.symbol;
  const label=document.createElement('span');label.textContent=sector.short;
  button.append(number,label);button.addEventListener('click',()=>selectSector(sector.index));tabs.append(button);
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
  event.preventDefault();const cols=getComputedStyle(nodes).gridTemplateColumns.split(' ').length;
  const step=event.key==='ArrowUp'?-cols:event.key==='ArrowDown'?cols:event.key==='ArrowLeft'?-1:1;
  const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,at+step));
  buttons[next].focus(); // Focus is exploration; Enter/Space explicitly selects.
 });
 function sync({reveal=false}={}){
  const index=Number(select.value),sector=sectors.find(s=>s.rooms.includes(index))||sectors[0],room=spec(index);
  if(!sector||!room)return;
  if(activeSector<0||reveal||activeSector===sector.index)selectSector(sector.index);
  nodes.querySelectorAll('.room-node').forEach(button=>{
   const nodeIndex=Number(button.dataset.level)-1,completed=preferences.value.completed.includes(nodeIndex);
   button.setAttribute('aria-pressed',String(nodeIndex===index));button.classList.toggle('room-node--completed',completed);
   button.setAttribute('aria-label',`Комната ${nodeIndex+1}: ${spec(nodeIndex).title}${completed?', пройдена':''}`);
   button.querySelector('.room-node-state').textContent=stateText(nodeIndex);
  });
  document.querySelector('#selected-room-number').textContent=`КОМНАТА ${String(index+1).padStart(2,'0')}`;
  document.querySelector('#selected-room-title').textContent=room.title;
  document.querySelector('#selected-room-description').textContent=room.description?.split(/(?<=\.)\s+/)[0]||'Исследуй пространство и доберись до выхода вместе с другом.';
  document.querySelector('#selected-room-status').textContent=preferences.value.completed.includes(index)?'✓ Пройдено · можно повторить':index===40?'Без контрольных точек':'Порталы · физика · исследование';
  document.querySelector('.hero-index').textContent=String(index+1).padStart(2,'0');
  const detail=document.querySelector('.mission-panel');if(detail){detail.dataset.theme=sector.id;detail.style.setProperty('--mission-accent',sector.color);}
  const themeLabel=document.querySelector('#selected-theme');if(themeLabel)themeLabel.textContent=sector.name;
  const number=document.querySelector('#mission-illustration-number');if(number)number.textContent=String(index+1).padStart(2,'0');
  const count=document.querySelector('#campaign-completed');if(count)count.textContent=`${availableRooms.filter(i=>preferences.value.completed.includes(i)).length} из ${availableRooms.length} пройдено`;
  const loadingChapter=document.querySelector('#loading-chapter');if(loadingChapter)loadingChapter.textContent=`${sector.name} · комната ${index+1}`;
 }
 sync({reveal:true});return{sync};
}
