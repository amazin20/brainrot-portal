import {installPreciseLateAim,aimLateSurface} from './LabLateCampaignAim.js';
const check=(v,s)=>{if(!v)throw Error(s);};
export function recoverPuzzleProgression49(d){
 const {game:g}=d;
 d.walk(-33,18);d.walk(-33,-23);d.walk(-26,-23);
 d.until(()=>g.playerGrounded&&g.playerPosition.y<-3.8,6,'Missed western support must reach the real dry floor');
 d.walk(-41,-13);d.walk(-41,15);d.walk(-33,15);d.walk(-28,25);d.wait(.6);
 check(g.playerGrounded&&Math.abs(g.playerPosition.y-8)<.04,'Physical return ramp must regain the departure court');
 d.mark('Dry service floor and separate broad ramp recover the missed support');
}
export function runPuzzleProgression49(d,{stopAfter=null,noCargo=false,recover=false,leaveCargo=false,cargoReleaseOffset=0,sourceAimOffset=0}={}){
 installPreciseLateAim(d);const {game:g,level:l}=d,p=l.panels;
 check(l.puzzleProgression49,'Wrong optical transfer room');
 if(recover)recoverPuzzleProgression49(d);
 d.walk(-17,23);aimLateSurface(d,0,p['cargo-feed']);aimLateSurface(d,1,p['mirror-freight']);d.walk(-31,24);if(!noCargo)d.pickup();d.walk(-29,23);
 if(!noCargo){d.look(p['cargo-feed'].getFrame().center);d.walk(-29+cargoReleaseOffset,23.5);d.walk(-29+cargoReleaseOffset,20.72);d.wait(.6);check(g.interact()&&!g.heldCube,'Cannot release original weight into optical delivery');d.until(()=>l.mirror.loaded(),9,'The original weight did not contact its real mirror cradle');d.wait(4);}
 d.mark('Original weight tilts the true hinged mirror');if(stopAfter==='loaded')return;
 d.walk(-33,18);d.walk(-33,-1);aimLateSurface(d,0,p['optical-source'],p['optical-source'].getFrame().center.clone().addScaledVector(p['optical-source'].getFrame().right,sourceAimOffset));aimLateSurface(d,1,p['optical-branch-a']);
 if(noCargo){d.wait(3);check(!l.receiverA.lit&&!l.receiverB.lit,'Unweighted mirror must reject both intended optical directions');d.mark('Unweighted physical mirror does not power either addressed receiver');return;}
 d.until(()=>l.receiverA.lit,4,'Actual reflected first optical receiver stayed dark');d.mark('Directional receiver sees the actual first reflected optical branch');if(stopAfter==='optical-a')return;
 d.walk(-33,15);d.walk(-24,15);d.walk(-24,10);d.walk(-24,5.4);check(g.interact(),'Initial onboard rail brake inaccessible');d.wait(.3);check(!l.carriage.braked,'Initial rail brake did not release');d.until(()=>l.carriage.position.x>-.1,30,'The actual light motor did not move the first carriage stroke');
 d.walk(-2,5.4);d.walk(-2,-4);d.mark('Physical rail motion reaches the permanent observation gallery');if(stopAfter==='gallery')return;
 d.walk(4,-8.6);check(g.interact(),'Mirror clamp inaccessible');d.wait(.4);check(l.mirror.clamped,'Real hinge clamp failed');
 d.walk(4,-6.4);check(g.interact(),'Rail brake inaccessible');d.wait(.5);check(l.carriage.braked,'Actual carriage brake did not engage');d.mark('Mechanical mirror and rail clamps retain actual rigid poses');if(stopAfter==='clamped')return;
 d.walk(0,-8.6);check(g.interact(),'Freight field handle inaccessible');d.wait(.3);check(l.field.enabled,'Actual reverse freight field failed');
 aimLateSurface(d,0,p['carriage-freight']);d.walk(-3.5,-3.5);aimLateSurface(d,1,p['mirror-freight']);
 if(!noCargo)d.until(()=>g.cargo.position.z>3&&g.cargo.position.x>-6,15,'The original weight did not leave the clamped mirror through the freight pair');
 d.mark('The same pair extracts the original weight into the physical carriage');if(stopAfter==='extracted')return;
 d.walk(0,-8.6);check(g.interact(),'Freight field shutdown inaccessible');d.wait(.3);check(!l.field.enabled,'Freight field must shut down for settled load');
 d.walk(8.5,-12.3);d.walk(8.5,-10);aimLateSurface(d,0,p['gallery-passenger']);d.walk(8.5,-12.3);d.walk(-2.5,-12.3);d.walk(-2.5,-5);aimLateSurface(d,1,p.passenger);d.walk(-2.5,-12.3);d.walk(8.5,-12.3);d.enter(p['gallery-passenger']);d.mark('The moving passenger aperture admits the original player to the closed carriage');if(stopAfter==='aboard')return;
 d.walk(4,1.5);aimLateSurface(d,0,p['optical-source'],p['optical-source'].getFrame().center.clone().addScaledVector(p['optical-source'].getFrame().right,sourceAimOffset));d.walk(-4,6);aimLateSurface(d,1,p['optical-branch-b']);d.until(()=>l.receiverB.lit,4,'The second actual reflected directional receiver stayed dark');
 d.walk(0,5.4);check(g.interact(),'Onboard rail brake linkage inaccessible');d.wait(.3);check(!l.carriage.braked,'Onboard linkage did not release actual rail brake');
 d.until(()=>l.carriage.position.x>23.8,30,'Second real optical stroke did not reach dock');d.mark('Second optical direction powers the released physical carriage to the final dock');

 if(!noCargo&&!leaveCargo){d.walk(g.cargo.position.x+1,g.cargo.position.z);d.pickup();}
 d.walk(27,10.5);d.walk(27,15);d.walk(31,15);d.walk(31,7);if(noCargo||leaveCargo){d.wait(2);check(g.state!=='won','Player alone may not complete joint dock');return;}
 d.until(()=>g.state==='won',4,'Original actors did not share the final optical dock');d.mark('Both original travellers reach the joint physical optical dock');
}
