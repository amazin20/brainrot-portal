/** The numbered sector map is a view of the existing campaign registry.
 * It never owns progress or starts a level without the explicit Play action. */
const SECTORS = [
  {name:'Первый контакт',short:'Открытие',color:'#75e0e6',from:0,to:9},
  {name:'В движении',short:'Движение',color:'#ffd179',from:10,to:19},
  {name:'Связи пространства',short:'Связи',color:'#96caff',from:20,to:29},
  {name:'Сложные системы',short:'Системы',color:'#f2a784',from:30,to:39},
  {name:'Складчатый замок',short:'Замок',color:'#dcc3ff',from:40,to:40},
  {name:'За пределами',short:'Новая глава',color:'#aff0c5',from:41,to:50},
];
export function createCampaignMenu({root,select,availableRooms,spec,preferences,onChoose}) {
  let activeSector=-1;
  const tabs=root.querySelector('.sector-tabs'),nodes=root.querySelector('.sector-nodes');
  const name=root.querySelector('.sector-name'),range=root.querySelector('.sector-range');
  nodes.id='campaign-sector-panel';nodes.setAttribute('role','tabpanel');
  const sectors=SECTORS.map((s,index)=>({...s,index,rooms:availableRooms.filter(i=>i>=s.from&&i<=s.to)})).filter(s=>s.rooms.length);
  function selectSector(index,{focus=false}={}){
    const sector=sectors.find(s=>s.index===index)||sectors[0];
    const changed=activeSector!==sector.index;
    activeSector=sector.index;root.style.setProperty('--sector-accent',sector.color);
    name.textContent=sector.name;
    range.textContent=`${String(sector.rooms[0]+1).padStart(2,'0')} — ${String(sector.rooms.at(-1)+1).padStart(2,'0')}`;
    tabs.querySelectorAll('button').forEach(b=>{const active=Number(b.dataset.sector)===sector.index;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
    nodes.setAttribute('aria-labelledby',`campaign-sector-${sector.index}`);
    if(!changed){if(focus)tabs.querySelector(`[data-sector="${activeSector}"]`)?.focus();return;}
    nodes.replaceChildren();nodes.classList.toggle('sector-nodes--castle',sector.rooms.length===1);
    for(const [order,index]of sector.rooms.entries()){
      const button=document.createElement('button'),room=spec(index),completed=preferences.value.completed.includes(index);
      button.type='button';button.className='room-node';button.dataset.level=String(index+1);
      button.style.setProperty('--node-order',String(order));
      button.setAttribute('aria-label',`Комната ${index+1}: ${room.title}${completed?', пройдена':''}`);
      button.setAttribute('aria-pressed',String(Number(select.value)===index));
      const number=document.createElement('span');number.className='room-node-number';number.textContent=String(index+1).padStart(2,'0');
      const title=document.createElement('span');title.className='room-node-title';title.textContent=room.title;
      const state=document.createElement('span');state.className='room-node-state';state.textContent=completed?'ПРОЙДЕНО':index>=41?'НОВАЯ КОМНАТА':index===40?'БЕЗ ЧЕКПОИНТОВ':'ИССЛЕДОВАТЬ';
      button.classList.toggle('room-node--completed',completed);button.append(number,title,state);
      button.addEventListener('click',()=>{select.value=String(index);sync();onChoose(index);});nodes.append(button);
    }
    if(focus)tabs.querySelector(`[data-sector="${activeSector}"]`)?.focus();
  }
  for(const sector of sectors){
    const button=document.createElement('button');button.type='button';button.dataset.sector=sector.index;button.id=`campaign-sector-${sector.index}`;button.setAttribute('role','tab');button.setAttribute('aria-controls',nodes.id);
    button.textContent=sector.short;button.addEventListener('click',()=>selectSector(sector.index));tabs.append(button);
  }
  tabs.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();let index=sectors.findIndex(s=>s.index===activeSector);
    index=event.key==='Home'?0:event.key==='End'?sectors.length-1:(index+(event.key==='ArrowRight'?1:-1)+sectors.length)%sectors.length;
    selectSector(sectors[index].index,{focus:true});
  });
  function sync({reveal=false}={}){
    const index=Number(select.value),sector=sectors.find(s=>s.rooms.includes(index))||sectors[0],room=spec(index);
    if(activeSector<0||reveal||activeSector===sector.index)selectSector(sector.index);
    nodes.querySelectorAll('.room-node').forEach(button=>{
      const nodeIndex=Number(button.dataset.level)-1,completed=preferences.value.completed.includes(nodeIndex);
      button.setAttribute('aria-pressed',String(nodeIndex===index));
      button.classList.toggle('room-node--completed',completed);
      button.setAttribute('aria-label',`Комната ${nodeIndex+1}: ${spec(nodeIndex).title}${completed?', пройдена':''}`);
      button.querySelector('.room-node-state').textContent=completed?'ПРОЙДЕНО':nodeIndex>=41?'НОВАЯ КОМНАТА':nodeIndex===40?'БЕЗ ЧЕКПОИНТОВ':'ИССЛЕДОВАТЬ';
    });
    document.querySelector('#selected-room-number').textContent=`КОМНАТА ${String(index+1).padStart(2,'0')}`;
    document.querySelector('#selected-room-title').textContent=room.title;
    document.querySelector('#selected-room-description').textContent=room.description?.split(/(?<=\.)\s+/)[0]||'Исследуй пространство и доберись до выхода вместе с другом.';
    document.querySelector('#selected-room-status').textContent=preferences.value.completed.includes(index)?'Пройдено · можно повторить':index>=41?'Новая глава исследований':index===40?'Один непрерывный заход':'Порталы · физика · исследование';
    document.querySelector('.hero-index').textContent=String(index+1).padStart(2,'0');
  }
  sync({reveal:true});return{sync};
}
