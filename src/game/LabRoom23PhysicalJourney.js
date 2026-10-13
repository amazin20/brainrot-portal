import * as THREE from 'three';
import {installRoom21Aim} from './LabRoom21Journey.js';

/** Complete ordinary-input route for the explicitly enabled physical Room23.
 * Camera, movement, jump and E inputs are the only route controls. The original
 * cargo and traveller are never replaced or assigned poses, forces or targets.
 * Native browser acceptance remains separate from this route adapter. */
export async function runRoom23PhysicalJourney(d,{onPhase=()=>{},handoff={z:2.75,move:.9,releaseX:-3.05}}={}){
 const g=d.game,m=d.level.balance,original=g.physics.cargoBody,shape=original.shapes[0];
 if(!d.level.room23PhysicalPrototype)throw Error('Physical Room23 route needs the explicit physical builder');
installRoom21Aim(d);if(g.firstLevel.puzzleGeometry.declaredInitialComponentFixture)throw Error('Normal route cannot use a declared initial component fixture');
 onPhase('real-high-freight-charge');d.walk(-17,2.7);d.wait(2);d.aim(1,new THREE.Vector3(1.2,21.2,-1.5));
 onPhase('walk-to-original');d.walk(-6.5,8);d.walk(-4.2,8);d.walk(-4.2,3.5);
 onPhase('real-floor-charge');d.wait(2);d.aim(0,new THREE.Vector3(-4.2,0,2.3));d.pickup();d.walk(-4.2,3.1);d.worldMove(0,-.1);for(let n=0;n<60;n++)d.frame();d.stop();d.wait(5);
 onPhase('real-held-jump-and-release');g.input.jumpQueued=true;d.until(()=>g.playerVelocity.y<-.01,2,'Actual held jump apex was not reached');if(!g.interact())throw Error('E release failed');
 onPhase('actual-free-cargo-delivery');d.until(()=>m.diagnostics().east.normalLoad>50,8,'Real original did not load the raised east pan');d.wait(3);if(m.diagnostics().east.normalLoad<50)throw Error('Delivered original did not remain a real raised pan load');d.mark('normal-spawn original loads actual raised east freight pan');
 onPhase('ordinary-ground-clutch-and-boarding');d.walk(-7.5,5.6);if(!g.interact())throw Error('Actual ground clutch E missed');d.wait(6);
 d.walk(-8.5,3);d.walk(-8.5,-1);d.walk(-5.5,-1);d.walk(-5.5,1);if(!g.interact())throw Error('Actual aboard ground brake E missed');
 onPhase('first-real-massive-passenger-ascent');d.until(()=>g.playerPosition.y>9.9,20,'Real west passenger did not ascend');d.wait(2);d.mark('normal-spawn same original descends while real west passenger reaches dock');
 onPhase('ordinary-common-brake-at-dock');d.walk(5.5,1);d.walk(5.5,4.5);if(!g.interact())throw Error('Actual common brake E missed');d.wait(2);
 if(m.diagnostics().brakeNormal<1000)throw Error('Common real brake was not contacted');d.mark('actual common brake holds both real cabins at docking');
 onPhase('real-original-pickup-and-direct-adjacent-handoff');d.walk(3.1,3);d.pickup();d.walk(5.5,3);d.wait(6);
 d.walk(5.5,1);d.walk(-5.5,1);d.walk(-5.5,handoff.z);d.walk(-4.2,handoff.z);d.wait(4);
 d.worldMove(handoff.move,0);for(let n=0;n<240&&g.playerPosition.x<handoff.releaseX;n++)d.frame();if(!g.interact())throw Error('Actual moving E release failed');d.stop();d.wait(4);
 if(m.diagnostics().west.normalLoad<50)throw Error('Moving handoff did not settle the original on the west pan');d.mark('same original transfers directly and rests on actual opposite pan');
 onPhase('ordinary-east-boarding-and-brake-release');d.walk(-3.1,1);d.walk(3.1,1);d.walk(5.5,4.5);if(!g.interact())throw Error('Actual return brake E missed');
 onPhase('second-real-massive-passenger-return');d.until(()=>g.playerPosition.y>19.9,20,'Real east passenger return failed');d.wait(2);d.walk(5.5,8.2);d.mark('same original descends to ground while real east passenger reaches upper exit');
 onPhase('upper-return-receiver-charge');d.walk(10,8.2);d.walk(10,-20);d.walk(0,-20);d.aim(1,g.firstLevel.panels['high-return'].getFrame().center);
 onPhase('upper-inspection-walk-and-real-pan-charge');d.walk(10,-20);d.walk(10,-15);d.walk(-17,-15);d.walk(-16.2,0);d.wait(2);
 const pan=g.firstLevel.panels['west-load-car-pan'];d.aim(0,pan.getFrame().center.clone().setX(original.position.x).setZ(original.position.z));
 onPhase('actual-original-upper-retrieval');d.until(()=>original.position.y>20,8,'Same original did not traverse the actual pan aperture');d.wait(2);d.mark('same original physically retrieved through pan and high receiver');
 onPhase('joint-goal-arrival');d.walk(-17,0);d.walk(-17,-15);d.walk(10,-15);d.walk(10,-20);d.walk(0,-20);
 if(g.state==='playing'){d.walk(original.position.x+.9,original.position.z);d.pickup();d.walk(0,-20);}d.until(()=>g.state==='won',6,'Same-original joint goal was not reached');d.mark('normal-spawn joint WON with both real bodies');

 if(g.physics.cargoBody!==original||original.shapes[0]!==shape||original.mass!==3.2||!m.ownershipValid())throw Error('The complete route lost its original owned cargo');
 return{normalAuthoredSpawn:true,sameOriginal:true,state:g.state,fullOrdinaryRouteAccepted:false,nativeAccepted:false};
}
