import {installRoom21Aim} from './LabRoom21Journey.js';
const check=(ok,text)=>{if(!ok)throw Error(text);};
export async function runEchoHorizon(d,{missFirst=false,stopBeforeCoincidence=false,swapColours=false,alternative=null}={}){
 check(alternative===null||alternative==='missed-echo-recovery','The retired relay route does not belong to the new room');
 missFirst ||= alternative==='missed-echo-recovery';
 const {game:g,level:l}=d;installRoom21Aim(d);const sourceColour=swapColours?1:0,outColour=1-sourceColour;
 d.walk(-1,14.7);d.aim(sourceColour,l.intake.getFrame().center);d.aim(outColour,l.long.getFrame().center);
 d.until(()=>l.charge.value>.99,5,'Original load did not restore striker pressure');
 check(l.cargoLoaded(),'The source load must be the original loose companion');
 const press=()=>{const before=l.field.emitted;check(g.interact(),'Striker terminal not accessible');check(l.field.emitted===before+1,'Striker did not launch a new physical pulse');};
 press();d.mark('first pressure packet launched');
 // Move only the camera, then issue a normal charged projectile. The packet
 // itself continues through updatePlaying; no destination or state is set.
 d.until(()=>l.field.packets.some(p=>p.portalCrossings>0),3,'Packet did not cross the source aperture');
 const first=l.field.packets.find(p=>p.portalCrossings>0);const id=first.id;
 d.mark('first packet is free of the portal');
 d.aim(outColour,l.short.getFrame().center);
 if(missFirst){
  d.until(()=>l.field.arrivals.some(e=>e.packet===id),6,'Long membrane was not actually reached');d.wait(1.4);
  check(!l.coincidence.latched,'One expired hit must not unlock the exit');
  d.mark('missed coincidence decays without a checkpoint');
  return runEchoHorizon(d,{stopBeforeCoincidence,swapColours});
 }
 if(stopBeforeCoincidence){d.wait(5);return;}
 // Fire based on observed current travel, with the difference arising from
 // geometric remaining lengths. This is route assistance, not game logic.
 d.until(()=>l.field.packets.some(p=>p.id===id&&p.position.z>2.7),6,'Long packet did not reach the second sight hoop');
 d.until(()=>l.charge.value>.99,3,'Striker did not recharge');press();d.mark('same portal pair sends the short second packet');
 d.until(()=>l.coincidence.latched,7,'Two arriving membranes never overlapped');
 check(l.field.arrivals.some(a=>a.receiver==='long')&&l.field.arrivals.some(a=>a.receiver==='short'),'Both physical receivers must have been reached');
 d.mark('both live membranes move the common latch');
 d.walk(8,14);
 // Observe and approach the actual free companion; do not assume a scripted
 // pose after a missed cycle or shove it with the walking capsule.
 for(let attempt=0;attempt<4&&!g.heldCube;attempt++){
  const p=g.cargo.position.clone();d.walk(p.x,p.z-1.4);g.interact();d.wait(.2);
 }
 check(g.heldCube,'Original companion was not recovered through ordinary E');
 d.walk(8,12);d.walk(0,9);d.walk(0,-24);
 d.until(()=>g.state==='won',4,'The original companion did not reach the exit');
}
