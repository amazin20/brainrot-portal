import {installPreciseLateAim,aimLateSurface} from './LabLateCampaignAim.js';
const check=(ok,message)=>{if(!ok)throw Error(message);};
function use(d,x,z,message){d.walk(x,z);check(d.game.interact(),message);d.wait(.3);}
function collect(d){for(let i=0;i<6;i++){const p=d.game.cargo.position.clone();d.walk(p.x+.85,p.z);if(d.game.interact()&&d.game.heldCube){d.wait(.55);return;}d.wait(.3);}throw Error('Could not collect the same original free rail cargo');}
function release(d){d.stop();check(d.game.interact()&&!d.game.heldCube,'Original rail cargo could not be released');d.wait(.65);}
/** Every causal operation uses ordinary camera shots, movement and E input.
 * No actor, force target, mechanism transform or completion state is assigned. */
export function runPuzzleProgression48(d,{stopAfter=null,recover=false}={}){
 installPreciseLateAim(d);const {game:g,level:l}=d,m=l.machine,p=l.panels;check(l.puzzleProgression48,'Wrong physical rail room');
 use(d,-20,18,'Magnetic winding switch inaccessible');
 d.until(()=>m.x>11.98&&g.cargo.position.x>9.3,18,'Original cargo contact did not drive the dynamic spring carriage');
 check(m.contacts.cargoCarriage>0,'Magnetic drive had no actual cargo-carriage contact');
 d.mark('Magnet pulls the original free companion against the real dynamic rail shoe');
 if(stopAfter==='driven')return;
 d.walk(-18,20);aimLateSurface(d,0,p.departure);d.walk(12,15);aimLateSurface(d,1,p['moving-address']);d.walk(-18,20);d.enter(p.departure);
 d.until(()=>g.playerGrounded&&g.playerPosition.y>7.9,5,'The first rail dock missed its permanent gallery');
 d.walk(12,-7);d.walk(21,1);d.mark('The moving address delivers the player to the permanent inspection gallery');
 if(stopAfter==='gallery')return;
 d.walk(27.8,-6);d.walk(27.8,-21.5);d.walk(23,-23);d.walk(19,-23);use(d,18,-24,'Transverse contact pin switch inaccessible');
 d.until(()=>m.pinExtension>4.7&&m.roofOpen,6,'The genuine pin did not enter the aligned shoe notch');
 d.mark('Insert a real transverse pin and open its physical freight inspection roof');
 if(stopAfter==='pinned')return;
 // Prepare the ordinary cargo aperture while the real field still supports
 // the free weight. Cutting the coil then makes gravity feed the same pair.
 d.walk(23,-24);aimLateSurface(d,1,p['gallery-reunion']);d.walk(20,-30);d.walk(10.3,-30);d.walk(10.3,-26.1);
 aimLateSurface(d,0,p['original-cargo-window'],p['original-cargo-window'].getFrame().center);
 d.walk(10.3,-30);d.walk(23,-30);use(d,26,-26,'Upper coil switch inaccessible');
 d.until(()=>g.cargo.position.y>8.35&&g.cargo.position.z<-17,7,'Pin-opened gravity window did not recover the same original companion');
 d.until(()=>Math.abs(m.body.velocity.x)<.04&&m.contacts.pinCarriage>0,4,'The inserted contact pin did not retain the spring carriage');
 check(m.x>11.4,'The real pin failed to retain the first dock after the original weight left');
 d.walk(23,-23);d.mark('Cut magnetic support: gravity feeds the original cargo through the prepared window while the real pin retains the shoe');
 if(stopAfter==='retrieved')return;
 // The front socket is separated from the magnetic drive groove. Its rear
 // wall is an ordinary solid, never a scripted attachment to the cargo body.
 use(d,26,-23,'Solid shore socket back control inaccessible');d.until(()=>m.stopBody.position.y>4.15,3,'Actual rear socket wall failed to rise');
 d.walk(20,-30);d.walk(3.8,-30);d.walk(3.8,-26.1);aimLateSurface(d,1,p['socket-mouth']);
 d.walk(3.8,-30);d.walk(23,-30);d.walk(23,-24);aimLateSurface(d,0,p['gallery-reunion']);d.wait(1.2);if(g.cargo.position.y>5){d.until(()=>g.physics.grounded&&g.physics.cargoBody.velocity.length()<.3,6,'Upper cargo did not settle on its actual receiving floor');collect(d);d.walk(20,-23);d.wait(.6);d.worldMove(0,1);for(let i=0;i<180&&g.playerPosition.z<-20.75;i++)d.frame();release(d);}
 d.until(()=>g.cargo.position.y<5&&g.cargo.position.x>3&&g.cargo.position.x<5.1,6,'The original free companion missed the solid-backed shore stop');
 d.mark('Send the same free companion into the separate physical return-stop socket');
 if(stopAfter==='socket')return;
 d.walk(27.8,-23);d.walk(18,-23);use(d,18,-24,'Transverse pin release inaccessible');
 d.until(()=>m.pinExtension<.2&&m.x>4.8&&m.x<6.5&&Math.abs(m.body.velocity.x)<.06&&m.contacts.cargoStop>0,20,'Original cargo and rear wall did not arrest the spring return by contact');
 check(m.contacts.cargoCarriage>0,'Return socket had no original cargo contact');
 d.mark('Retract the real pin; the spring returns until the original cargo and rear socket stop the carriage');
 if(stopAfter==='stopped')return;
 // The view over the rear finger survives after the old pair is repurposed.
 d.walk(27.8,-16);d.walk(22.1,-14);
 // Walk off the ordinary gallery into the service floor and address the same
 // retained moving portal from the initial court. A missed edge is recoverable.
 d.walk(27.8,-21);d.walk(27.8,-6);d.walk(29,-6);d.until(()=>g.playerPosition.y<3,5,'Leave the upper gallery');d.walk(28.2,-6);d.until(()=>g.playerGrounded&&g.playerPosition.y<.3,5,'Physical lower rail recovery missed');
 d.walk(28.2,5.5);d.walk(-16,5.5);d.walk(-16,-7);d.walk(-22,-7);d.walk(-22,14);d.walk(-18,20);aimLateSurface(d,0,p.departure);d.walk(5.6,15);aimLateSurface(d,1,p['moving-address']);d.walk(-18,20);d.enter(p.departure);
 d.until(()=>g.playerGrounded&&g.playerPosition.y>7.9&&g.playerPosition.x<8,5,'The stopped moving address did not reach the separate final shore');
 d.mark('The contact-retained moving address opens the second physical dock');
 if(stopAfter==='final')return;
 // Retrieve the live contact weight only after standing on the permanent
 // final shore; the emptied carriage actually returns to its covered home.
 d.walk(5.6,-7.5);d.walk(-20,-7.5);d.walk(-20,-21);d.walk(-14,-21);aimLateSurface(d,1,p['final-address']);
 d.walk(-20,-21);d.walk(-20,-7.5);use(d,5.5,-5,'Physical cargo support release inaccessible');
 d.until(()=>m.trapBody.position.y<2.2,4,'The real receiving support did not lower');
 d.walk(2.5,-5);d.walk(2.5,2);use(d,5.5,2,'Final shore socket-back release inaccessible');
 d.until(()=>m.stopBody.position.y<1.6,3,'Actual socket back did not lower out of the cargo window');d.until(()=>g.cargo.position.y<3.5,5,'Removing both actual supports did not release the contact weight');d.until(()=>m.x<.5,20,'Empty carriage did not return clear of the final freight window');
 d.walk(2.5,2);d.walk(2.5,-7.5);d.walk(6.6,-7.5);d.walk(6.6,-11.5);d.walk(5.4,-11.5);aimLateSurface(d,0,p['shore-stop']);
 d.until(()=>g.cargo.position.y>8.35&&g.cargo.position.x<-10&&g.cargo.position.z<-17.5,7,'Final shore could not recover its original contact weight');
 d.walk(6.6,-11.5);d.walk(6.6,-7.5);d.walk(-20,-7.5);d.until(()=>m.x<.15,8,'Empty rail carriage must physically return home');
 d.mark('Recover the same contact weight from the permanent final shore; its abandoned address returns home');
 d.walk(-20,-7.5);d.walk(-20,-21);collect(d);d.walk(-20,-21);d.walk(-20,-7.5);d.walk(0,1);d.until(()=>g.state==='won',3,'Both original travellers did not reach the joint physical goal');
 d.mark('Both original travellers finish without a reset, checkpoint or replacement');
}
