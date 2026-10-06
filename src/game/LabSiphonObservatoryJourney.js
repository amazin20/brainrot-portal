import * as THREE from 'three';
import {installPreciseLateAim,aimLateSurface} from './LabLateCampaignAim.js';
const check=(ok,msg)=>{if(!ok)throw Error(msg);};
export async function runSiphonObservatory(d,{route='load-then-ride',stopAfter=null,swapColours=false}={}){
 check(['load-then-ride','miss-lift-and-recirculate'].includes(route),'Retired spring route does not belong to the siphon');
 installPreciseLateAim(d);const {game:g,level:l}=d,a=swapColours?1:0,b=1-a;
 d.walk(4,19);if(route==='miss-lift-and-recirculate')aimLateSurface(d,b,l.drop);aimLateSurface(d,a,l.loading);
 d.mark('dry crest and real hydraulic ram observed');if(stopAfter==='dry')return;
 d.walk(11,16.8);d.pickup();d.walk(13,23.8);d.look(new THREE.Vector3(13,1,16));d.walk(13,22.1);d.wait(.3);
 check(g.interact()&&!g.heldCube,'Could not release the original load');
 if(route==='load-then-ride'){d.wait(.7);d.walk(8,14);d.walk(3.3,11);d.walk(3.3,9);aimLateSurface(d,b,l.drop);d.mark('passenger boards before completing the cargo connection');}
 d.until(()=>l.getDisplacement()>.25,10,'Original body did not submerge in the header');
 d.until(()=>l.circuit.primed,6,'Displaced water failed to flood the crest');d.mark('cargo displacement fills the dry siphon');
 if(stopAfter==='primed')return;
 // Clear the original pair through the game's normal clear-pair action.
 // The freed connection has no authority over a column already full of water.
 g.clearPortals();d.mark('the pair is freed while the column keeps draining');
 if(route==='miss-lift-and-recirculate'){d.wait(4);d.walk(8,11);d.walk(6.8,9);check(g.interact(),'Service pump unavailable');
 d.until(()=>l.lift.position.y<.05,30,'Service pump did not return the hydraulic platform');
 d.walk(3.3,11);d.walk(3.3,9);
 check(g.interact()&&!l.circuit.returning,'Could not stop service pump from the boarded lift');d.mark('missed lift recovered by pumping conserved water, without a reset');}
 d.until(()=>l.lift.position.y>10.17,35,'Hydraulic column did not raise the actual passenger deck');
 check(g.playerPosition.y>10,'Observer did not ride the real ram');d.mark('finite conserved water lifts the observer');if(stopAfter==='upper')return;
 d.walk(-13,7);d.walk(-23,4);d.walk(-23,-14);d.walk(-23,-17);check(g.interact(),'Basket control inaccessible');d.until(()=>l.basket.height>13.93,6,'Inspection basket did not rise');d.walk(-19,-16);d.wait(.6);
 const side=g.cargo.position.x>-16?-14.0:-17.8;d.walk(side,-17.5);d.walk(side,g.cargo.position.z);
 d.look(g.cargo.position);check(g.interact()&&g.heldCube,'Could not recover the original submerged body');d.mark('same original companion reclaimed after the water level falls');
 d.walk(-22,-18);d.look(new THREE.Vector3(-21,14.5,-21));d.wait(.3);check(g.interact()&&!g.heldCube,'Could not leave cargo safely on upper floor');d.wait(.8);
 d.walk(-23,-20);aimLateSurface(d,a,l.passage);aimLateSurface(d,b,l.arrival);
 const p=g.cargo.position.clone();d.walk(p.x-1.2,p.z);d.pickup();d.enter(l.passage);d.walk(20,-20);
 d.until(()=>g.state==='won',4,'Both travellers did not arrive in the separated archive');d.mark('same pair now joins the separated upper archive');
}
