import { $, start, cleanup } from './atlas-common.js';
import { mount } from './atlas-shell.js';
const query=new URLSearchParams(location.search);
// This atlas depicts the primary campaign. Archived editions and special
// modes retain their original controls and independent save namespaces.
const primaryCampaign=(!query.has('edition')||query.get('edition')==='foundation')&&!query.has('mode');
if(primaryCampaign&&start&&!document.documentElement.dataset.interfaceVersion){
 document.documentElement.classList.add('atlas-enabled');
 document.documentElement.dataset.interfaceVersion='v51-atlas';
 // Loading labels and the progress value remain exclusively engine-driven.
 const loading=$('#loading');
 if(loading){
  loading.classList.add('atlas-loading');
  const ornament=document.createElement('div');ornament.className='atlas-load-portal';ornament.innerHTML='<i></i><i></i><span></span>';ornament.setAttribute('aria-hidden','true');loading.prepend(ornament);
  const card=$('.loading-card',loading);if(card){const note=document.createElement('p');note.className='atlas-load-foot';note.textContent='ДВА ПОРТАЛА. ОДНА ИСТОРИЯ.';card.append(note);}
 }
 if(!mount()){
  const boot=new MutationObserver(()=>{if(mount())boot.disconnect();});
  boot.observe(document.documentElement,{attributes:true,attributeFilter:['data-runtime-state']});cleanup.push(()=>boot.disconnect());
 }
 addEventListener('pagehide',event=>{if(!event.persisted){for(const dispose of cleanup)dispose();cleanup.length=0;}});
}
