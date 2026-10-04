import {aimLateSurface} from './LabLateCampaignAim.js';
import {installRoom21Aim} from './LabRoom21Journey.js';
const check=(v,m)=>{if(!v)throw Error(m);};
export function runThermalMemory(d,{route='heat-then-route',recover=false,stopBeforeHeat=false,stopBeforeDiversion=false}={}){
 installRoom21Aim(d);check(['heat-then-route','receiver-first','companion-first','scout-first'].includes(route),'Unknown thermal route');
 const {game:g,level:l,walk,until,mark}=d,p=l.panels;
 const prepare=()=>{walk(-4,10);aimLateSurface(d,1,p['thermal-remote-mouth']);};
 if(route==='receiver-first'||route==='scout-first')prepare();
 if(stopBeforeHeat)return;
 until(()=>l.thermal.temperature>430,20,'The source did not heat the real collector and expanding rod');
 check(l.first.progress>.98&&!l.thermal.remote,'Stored heat should open only the first door');mark('A terminating ray stores thermal energy and extends the visible rod');
 if(route!=='receiver-first'&&route!=='scout-first')prepare();
 walk(-4,14);const axis=p['thermal-collector'].getFrame().center.clone();axis.y=3.2;aimLateSurface(d,0,l.heater,axis);
 until(()=>l.thermal.remote&&l.second.progress>.93,4,'Diverted source failed the distant physical receiver');
 check(!l.thermal.powered,'Routing power away must stop material heating');
 mark('The same source leaves the cooling rod to open a remote door');
 if(stopBeforeDiversion)return;
 if(recover){
  const hot=l.thermal.temperature;d.wait(15);check(l.thermal.temperature<hot&&l.first.progress<.65,'The heat store did not lose energy');
  walk(-4,14);const top=l.heater.getFrame().center.clone();top.y=5.5;aimLateSurface(d,0,l.heater,top);
  until(()=>l.thermal.temperature>430&&l.thermal.powered,20,'Raising the portal did not restore material heating');
  const axis=l.heater.getFrame().center.clone();axis.y=3.2;aimLateSurface(d,0,l.heater,axis);until(()=>l.thermal.remote,3,'The restored heat was not borrowed again');mark('A failed thermal charge is recovered by ordinary portal aiming');
 }
 walk(g.cargo.position.x+1.25,g.cargo.position.z);d.pickup();walk(0,10);walk(0,-3);walk(0,-16);walk(0,-21);
 until(()=>g.state==='won',3,'Original pair did not use stored expansion before cooling closed it');mark('Both original travellers cross the continuous thermal mechanism');
}
