import * as THREE from 'three';
import {installPreciseLateAim,aimLateSurface} from './LabLateCampaignAim.js';
const V=(...p)=>new THREE.Vector3(...p),check=(v,s)=>{if(!v)throw Error(s);};
export function runPuzzleProgression51(d,{missFirst=false,stopAfter=null,swapColours=false,leaveCargo=false}={}){
 installPreciseLateAim(d);const {game:g,level:l}=d,a=l.apparatus,sourceColour=swapColours?1:0,outColour=1-sourceColour;
 check(l.puzzleProgression51,'Wrong mechanical echo room');
 d.walk(-9,16);aimLateSurface(d,0,l.cargoInput.surface);d.walk(8,14);aimLateSurface(d,1,l.freight);d.walk(-7,24.5);d.pickup();d.walk(-6,23.5);d.look(l.cargoInput.surface.getFrame().center);d.walk(-6,22.35);check(g.interact()&&!g.heldCube,'Original weight was not released');
 d.until(()=>a.powered(),10,'Original weight failed to load the physical weighing cup');d.mark('Original companion reaches the closed live weighing well');if(stopAfter==='loaded')return;
 d.walk(-1,14.7);aimLateSurface(d,sourceColour,l.source);aimLateSurface(d,outColour,l.long);d.mark('The same pair addresses source and long free-flight branch');
 const press=()=>{const before=a.impactCount;check(g.interact(),'Striker terminal inaccessible');d.until(()=>a.impactCount>before,4,'Released real spring striker did not strike its head');};
 press();d.mark('Actual striker contact emits first finite packet');
 d.until(()=>l.field.packets.some(p=>p.portalCrossings>0),3,'First packet failed to depart the portal');const id=l.field.packets.find(p=>p.portalCrossings>0).id;
 aimLateSurface(d,outColour,l.short);d.mark('A departed packet survives ordinary retargeting of the single pair');if(stopAfter==='retargeted')return;
 if(missFirst){d.until(()=>l.field.arrivals.some(e=>e.packet===id),6,'First long packet never reached its moving receiver');d.wait(4);check(!a.opened,'Serial lone arrival may not pass the other real stop');d.mark('A missed overlap returns by physical springs');aimLateSurface(d,outColour,l.long);d.until(()=>a.ready&&a.powered(),5,'Live cargo failed to rewind striker');press();d.until(()=>l.field.packets.some(p=>p.portalCrossings>0),3,'Recovery packet failed to depart');const p=l.field.packets.find(p=>p.portalCrossings>0);aimLateSurface(d,outColour,l.short);d.until(()=>l.field.packets.some(q=>q.id===p.id&&q.position.z>1),6,'Recovery long packet missed sight hoop');}
 else d.until(()=>l.field.packets.some(p=>p.id===id&&p.position.z>1),6,'Long packet did not reach its visible second sight hoop');
 if(stopAfter==='departed'){d.wait(5);return;}
 d.until(()=>a.ready&&a.powered(),5,'Cargo-powered real rewind failed');press();d.mark('Rewound striker sends the short second pulse');
 d.until(()=>a.opened,8,'The two physical contact stops never released the counterweighted door');d.mark('Actual receiver pushrods and counterweight open the physical door');if(stopAfter==='door')return;
 d.walk(0,10);d.walk(0,-8);d.look(V(0,3,-22));d.walk(0,-16);d.mark('First crossing reveals the original well return from the service court');
 d.walk(5,-15.6);check(g.interact(),'Service return handle inaccessible');check(l.returnField.enabled,'Physical cargo return did not start');
 d.walk(0,-17);aimLateSurface(d,0,l.freight);aimLateSurface(d,1,l.returnPad.surface);
 d.until(()=>g.cargo.position.z<-14,15,'Same original companion failed to return through the freight pair');d.mark('Single pair returns the live source load to the new court');if(stopAfter==='returned')return;
 if(!leaveCargo){d.walk(g.cargo.position.x+1,g.cargo.position.z);d.pickup();}
 d.walk(12,-18);d.walk(0,-18);d.look(V(0,2.8,-28));d.walk(0,-25);if(leaveCargo){d.wait(1);check(g.state!=='won','Player alone may not complete the return court');return;}
 d.until(()=>g.state==='won',4,'Original travellers failed to reunite');d.mark('Original player and original companion reunite at the physical exit');
}
