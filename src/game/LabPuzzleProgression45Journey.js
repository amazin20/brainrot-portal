import * as THREE from 'three';
import {installPreciseLateAim,aimLateSurface} from './LabLateCampaignAim.js';
const check=(ok,message)=>{if(!ok)throw Error(message);};
function collect(d){for(let i=0;i<8;i++){const p=d.game.cargo.position;d.walk(p.x-1.25,p.z);if(d.game.playerPosition.distanceTo(d.game.cargo.position)<2.2){d.pickup();return;}}throw Error('Original countercurrent cargo cannot be collected');}
function release(d){d.stop();d.wait(.25);check(d.game.interact()&&!d.game.heldCube,'Original cargo could not be released');d.wait(.7);}
function reverseAtSource(d,want){d.walk(-14.4,23);d.walk(-14.4,25);if(d.level.field.reversed!==want){check(d.game.interact(),'Real reversal handle inaccessible');d.wait(.2);}check(d.level.field.reversed===want,'Reversal handle did not change force direction');}
/** Uses public walking, camera shots, pickup/release and the actual reverse
 * handle. Actor coordinates, velocities, field targets and goal flags are never
 * assigned. Phase stops belong only to the verification driver. */
export function runPuzzleProgression45(d,{stopAfter=null,recover=false,wrongReverse=false}={}){
 installPreciseLateAim(d);const {game:g,level:l}=d,p=l.panels;check(l.puzzleProgression45,'Wrong countercurrent variant');
 reverseAtSource(d,true);d.walk(-9,23);aimLateSurface(d,0,p.source);
 d.walk(-25,23);d.walk(-25,8);d.walk(-18,8);aimLateSurface(d,1,p.freight,p.freight.getFrame().center.clone().add(new THREE.Vector3(0,.6,0)));
 d.walk(-25,8);d.walk(-25,23);d.walk(-22,23);
 const transports=g.physics.portalTransports;
 d.until(()=>g.cargo.position.z>15&&g.cargo.position.x<-20,15,'Reversed flow did not extract the original cargo');
 d.mark('Reverse the actual routed stream to pull original cargo through the low freight throat');
 if(stopAfter==='extracted')return;
 // Walk around the current before approaching the free original body.
 d.walk(-25.5,23);for(let i=0;i<180&&g.playerPosition.distanceTo(g.cargo.position)>1.8;i++){d.worldMove(0,-1);d.frame();}d.stop();d.pickup();for(let i=0;i<360&&g.playerPosition.z<22.2;i++){d.worldMove(0,1);d.frame();}d.stop();
 d.walk(-22,23.4);d.look(p.weight.getFrame().center.clone().add(new THREE.Vector3(0,2,0)));d.walk(-22,22.72);release(d);
 d.until(()=>l.load.loaded()&&l.door.progress>.98,4,'Original live cargo did not withdraw the physical air valve');
 d.mark('The recovered original weight opens the rising air branch');
 if(stopAfter==='weighted')return;
 reverseAtSource(d,false);d.walk(-12,13);aimLateSurface(d,0,p.source);aimLateSurface(d,1,p.shaft);
 if(wrongReverse){reverseAtSource(d,true);d.walk(-12,9);d.wait(2);check(g.playerPosition.y<1,'Reverse flow unexpectedly ascended');d.walk(-12,13);reverseAtSource(d,false);}
 d.walk(-12,9);const rising=l.field.segments.find(s=>s.direction.y>.9);check(rising,'The open air valve has no vertical routed stream');const axis=rising.a;
 for(let i=0;i<900&&g.playerPosition.y<15.7;i++){const q=g.playerPosition;d.worldMove(THREE.MathUtils.clamp((axis.x-q.x)*2,-1,1),THREE.MathUtils.clamp((axis.z-q.z)*2,-1,1));d.frame();}d.stop();check(g.playerPosition.y>15.7,'The forward stream did not raise the player');
 for(let i=0;i<240&&g.playerPosition.z>5;i++){d.worldMove(0,-1);d.frame();}d.stop();
 d.until(()=>g.playerGrounded&&g.playerPosition.y>13.9,6,'Permanent gallery missed');d.walk(-23,5);
 check(l.load.loaded()&&g.cargo.position.y<1,'The original cargo remains as the live lower valve weight');
 d.mark('Forward the same stream into the shaft and retain the new upper viewpoint');
 if(stopAfter==='gallery')return;
 d.walk(-24,-5);d.walk(-28,-5);d.walk(-28,-11);d.walk(-24,-20);aimLateSurface(d,1,p.reunion);
 // The west edge gives a genuine downward sightline past the retained deck.
 d.walk(-28,-11);d.walk(-28,-5);d.walk(-24,9);d.wait(1);d.walk(-24,11.1);d.wait(.7);aimLateSurface(d,0,p.weight,p.weight.getFrame().center.clone().add(new THREE.Vector3(0,0,2.5)));
 d.until(()=>g.cargo.position.y>14.3&&g.cargo.position.z<-15,7,'The new viewpoint did not recover the original live weight');
 d.until(()=>l.door.progress<.02,4,'Removing weight must close the actual rising air valve');
 d.mark('Recover the same original weight through the upper reunion address; its unused air valve closes');
 if(stopAfter==='recovered')return;
 d.walk(-28,-5);d.walk(-28,-11);d.walk(-24,-20);aimLateSurface(d,1,p.crossing);collect(d);
 d.walk(-28,-11);d.walk(-28,-5);d.walk(-22,5);release(d);d.walk(-16.6,9);d.wait(.7);aimLateSurface(d,0,p.source);collect(d);
 if(recover){d.walk(-28,-5);d.walk(-28,-11);d.walk(-24,-20);d.walk(-18,-22);d.until(()=>g.playerGrounded&&g.playerPosition.y<2.3,6,'Cargo recovery fall did not reach the real freight berth');d.walk(-22.25,-22);d.walk(-22.25,-28);d.until(()=>g.playerGrounded&&g.playerPosition.y<1.4,6,'Freight berth rear service incline missed');d.walk(28,-28);d.walk(28,23);d.mark('An ordinary missed edge and the east service passage return both original travellers to the source');}
 else {d.walk(-24,11);d.walk(-24,14);d.until(()=>g.playerGrounded&&g.playerPosition.y<.3,6,'Physical service descent failed');}
 d.walk(-25,23);d.walk(-12,23);
 // Enter the visible source stream upstream of its ordinary portal.
 d.walk(18,23);d.walk(20,20.1);const before=g.teleportCount;
 for(let i=0;i<360&&g.teleportCount===before;i++){d.worldMove(.25,-.7);d.frame();}d.stop();
 check(g.teleportCount>before,'Joint entry to the high transverse current missed');
 d.until(()=>g.playerPosition.x>17,12,'The high current did not carry both original travellers');
 check(g.heldCube===g.cargo&&g.playerPosition.y>16.9,'Both original travellers must be physically suspended above the low exit');
 d.mark('The same pair carries both travellers into the narrow suspended receiving bay');
 if(stopAfter==='suspended')return;
 // Release the original body inside the real collector before the camera
 // addresses its low end wall. No field object attaches or positions the cargo.
 release(d);aimLateSurface(d,0,p.release);
 d.until(()=>g.playerGrounded&&g.playerPosition.y>14.9&&g.playerPosition.y<15.2,6,'Releasing the emitter pair did not lower the player into the bay');
 d.until(()=>g.physics.grounded&&g.cargo.position.y>15.3&&g.cargo.position.y<15.8,6,'Released original cargo did not settle in the same physical bay');
 d.mark('Free the emitter pair and descend together below the real low side exit');
 collect(d);d.walk(20.5,-16);d.walk(20.5,-12);d.walk(20,-8);d.until(()=>g.state==='won',4,'Original travellers did not reach the joint physical exit');
 d.mark('Both original travellers reach the visible exit with no reset or checkpoint');
 check(g.physics.portalTransports>transports,'Extraction must transport the original free cargo');
}
