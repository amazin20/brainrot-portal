import * as THREE from 'three';
import {installPreciseLateAim,aimLateSurface} from './LabLateCampaignAim.js';
const V=(...p)=>new THREE.Vector3(...p),check=(v,m)=>{if(!v)throw Error(m);};
export function support17Service(d){d.walk(-24,18);d.walk(-24,49.5);d.walk(-18,49.5);d.walk(-18,-11);}
export function support17Departure(d){d.walk(-18,52);d.walk(-24,52);d.walk(-24,18);}
export function prepareSupport17(d,{swapColours=false,stopAfter=null,route='upper-branch'}={}){
 installPreciseLateAim(d);const {game:g,level:l}=d,c0=swapColours?1:0,c1=1-c0;
 support17Service(d);aimLateSurface(d,c1,l.mouth);support17Departure(d);
 d.walk(g.cargo.position.x-1.3,g.cargo.position.z);d.pickup();d.walk(-16,13.0);d.look(V(-16,7,0));d.stop();d.wait(.3);check(g.interact()&&!g.heldCube,'Original endpoint release rejected');d.wait(.8);
 d.walk(-11,16);aimLateSurface(d,c0,l.feed.surface,g.cargo.position.clone().setY(l.feed.surface.getFrame().center.y));
 d.until(()=>g.physics.portalTransports>0&&g.cargo.position.y<-8,8,'Original endpoint did not enter the protected anchor');d.wait(1.2);d.mark('original free endpoint reaches the real ground anchor');
 if(stopAfter==='delivered')return;
 support17Service(d);d.walk(-18,3);aimLateSurface(d,c1,l.anchor);support17Departure(d);
 d.walk(-12,12);aimLateSurface(d,c0,route==='lower-branch'?l.lowLead:l.highLead);
 if(route==='lower-branch'){d.until(()=>l.beam.angle<-.32&&l.beam.angle>-.50&&l.beam.tension>30,12,'Lower current cable did not form the independent descent');d.wait(2);d.mark('current lower branch forms a separate descending route');}
 else{d.until(()=>l.beam.angle>-.04&&l.beam.tension>30,12,'Current upper cable did not support the architectural floor');d.mark('current upper branch supports the free architectural end');}
}
export function runCreative17(d,{route='upper-branch',alternative=null,swapColours=false,stopAfter=null,recovery=false}={}){
 if(alternative)route=alternative;check(['upper-branch','lower-branch'].includes(route),'Unknown support route');
 const {game:g,level:l}=d,c0=swapColours?1:0,c1=1-c0;
 prepareSupport17(d,{swapColours,stopAfter,route});if(stopAfter==='delivered')return;
 if(stopAfter==='supported')return;
 if(recovery){
  aimLateSurface(d,c0,l.feed.surface);d.until(()=>l.beam.angle<-.65,12,'Replacing the support charge did not drop the floor');d.walk(-6,0);d.walk(0,6);d.until(()=>g.playerGrounded&&g.playerPosition.y<-9.9,8,'Dry service landing missed');d.mark('support loss returns through the same dry floor without resetting either body');support17Departure(d);d.walk(-12,12);aimLateSurface(d,c0,route==='lower-branch'?l.lowLead:l.highLead);d.until(()=>l.beam.tension>30&&l.beam.angle>-.50,12,'Restored current pair did not recover support');d.wait(2);
 }
 d.walk(-10,0);d.walk(-7,0);
 if(route==='lower-branch'){
  g.input.keys.add('ShiftLeft');let landed=false;for(let f=0;f<360&&!landed;f++){if(g.playerPosition.x>4.5&&g.playerPosition.x<9&&f%3===0)g.input.jumpQueued=true;d.worldMove(1,0);d.frame();landed=g.playerGrounded&&g.playerPosition.x>12.4&&Math.abs(g.playerPosition.y+1.2)<.3;}d.stop();check(landed,'Independent lower permanent landing missed at '+g.playerPosition.toArray()+' angle '+l.beam.angle);d.mark('observer leaves the live ramp onto the permanent lower gallery');d.walk(16,20);d.walk(24,20);d.walk(24,4);d.walk(24,0);
 }else{d.walk(11,0);d.until(()=>g.playerGrounded&&g.playerPosition.x>10.1&&Math.abs(g.playerPosition.y-6)<.3,4,'Permanent upper landing missed');d.mark('observer leaves the live bridge onto permanent upper ground');d.walk(23,0);}
 if(stopAfter==='permanent')return;
 // Both colours are re-fired through actual controls. No stage bit preserves
 // the old support; its spring plungers physically return the free endpoint.
 d.walk(20,0);aimLateSurface(d,c1,l.cargoReceiver);d.until(()=>l.beam.angle<-.62,12,'Removing current support failed to return the original endpoint onto its clear floor');d.walk(16,16);d.walk(12.6,-3);d.until(()=>g.cargo.velocity.length()<.1,8,'The same returned endpoint did not settle on its actual support');aimLateSurface(d,c0,l.retrieval,g.cargo.position.clone().setY(l.retrieval.getFrame().center.y));
 d.until(()=>g.physics.portalTransports>1&&g.cargo.position.x>20&&g.cargo.position.y>6,8,'Original endpoint was not reclaimed through its actual floor');
 d.until(()=>l.beam.angle<-.62,12,'Borrowing the same pair failed to remove actual architectural support');d.mark('the unsupported floor falls behind the permanent landing');
 d.walk(16,20);d.walk(24,20);d.walk(24,4);d.walk(g.cargo.position.x-1.25,g.cargo.position.z);if(g.state==='playing')d.pickup();d.walk(24,0);d.until(()=>g.state==='won',4,'Both original travellers did not reunite at the receiving gallery');d.mark('same original endpoint and observer leave together');
}
