import * as THREE from 'three';
import {CAMERA_PITCH_MIN,CAMERA_PITCH_MAX} from './LabCamera.js';
import {installRoom21Aim} from './LabRoom21Journey.js';
const check=(c,m)=>{if(!c)throw new Error(m);};
const collect=d=>{const p=d.game.cargo.position.clone(),side=d.game.playerPosition.clone().sub(p);side.y=0;if(side.length()<.01)side.z=1;side.normalize().multiplyScalar(1.4);d.walk(p.x+side.x,p.z+side.z);d.pickup();};
const wallTarget=p=>p.getFrame().center.clone().addScaledVector(p.getFrame().up,-.85);
export function runOpenOrbital(d,{route='portal-first',recover=false}={}){
 installRoom21Aim(d);
 const {game:g,level:l,walk,wait,until,pickup,enter,mark,frame,worldMove,stop}=d;
 const aim=(i,p)=>d.aim(i,p),car=l.car,[low,high]=l.loadPads;
 if(recover){walk(-20,31);until(()=>g.playerGrounded,5,'Recovery foundation missed');check(g.playerPosition.y<-8,'Did not actually fall');walk(30,31);walk(39,12.2);walk(39,44);walk(0,46);walk(-5,33);mark('wide lower promenade returns without any reset');}
 const place=(x,z)=>{walk(x,z+1.2);for(let i=0;i<15;i++){worldMove(0,-.15);frame();}stop();wait(.4);g.interact();wait(1.4);};
 aim(1,wallTarget(car.panel));aim(0,wallTarget(l.panels.departure));
 walk(-2,32.3);pickup();place(9,31);check(low.loaded(),'Departure pad not loaded');mark('one physical load selects the western address');
 walk(route==='ride-first'?-2.5:-4,route==='ride-first'?17:18.8);check(g.interact(),'Departure release missed');
 until(()=>car.at(1),12,'Carriage did not reach western pier');wait(.5);
 if(route!=='ride-first')enter(l.panels.departure);
 check(g.playerPosition.y>9.9,'Western carriage missed');mark('the portal and carriage arrive at the western pier');
 walk(-30,5);walk(-36.5,7);g.interact();wait(.3);check(car.braked,'Western brake missed');
 walk(-30,22);walk(-17.5,22);aim(0,low.surface.getFrame().center);until(()=>g.cargo.position.y>10,5,'Ground cargo retrieval failed');wait(1.3);
 mark('cargo returns through the moving address while the brake holds it');
 walk(-30,8);aim(0,wallTarget(l.panels['west-return']));
 walk(-30,-3);collect(d);walk(-30,5);place(-23,14);check(high.loaded(),'Western pad not loaded');
 walk(-36.5,7);g.interact();wait(.2);check(!car.braked,'Brake did not release');until(()=>car.at(2),12,'Carriage did not reach east pier');g.interact();wait(.2);check(car.braked,'Final brake missed');
 mark('same load sends the same carriage across the atrium');
 walk(-30,12);aim(0,high.surface.getFrame().center);until(()=>g.cargo.position.y>24,5,'Western cargo retrieval failed');wait(1.3);
 aim(0,wallTarget(l.panels['west-return']));enter(l.panels['west-return']);
 check(g.playerPosition.y>23.9,'Final carriage missed');collect(d);walk(30,-2);
 until(()=>g.state==='won',3,'Joint arrival at east pier failed');mark('both original travellers reach the final open terrace');
}
export function runOpenJourney(d,options={}){
 if(d.level.id==='open-horizon-rewire')return runOpenLaunch(d,options);
 if(d.level.id==='open-communicating-lifts')return runOpenHydraulics(d,options);
 if(d.level.id==='open-orbital-post')return runOpenOrbital(d,options);
 throw new Error('No reviewed route for '+d.level.id);
}

export function runOpenHydraulics(d,{route='equal-head',interrupt=false}={}){
 installRoom21Aim(d);const {game:g,level:l,walk,wait,until,pickup,mark}=d,p=l.panels,[a,b]=l.floats;
 const aim=(i,s)=>d.aim(i,wallTarget(s));
 walk(12,11.4);pickup();walk(14,-9);g.interact();wait(1.5);
 aim(0,p['west-low']);aim(1,p[route==='full-east'?'east-high':'east-low']);
 if(interrupt){wait(.5);g.clearPortals();const before=[...l.tides.levels];wait(2);check(before.every((v,i)=>v===l.tides.levels[i]),'Disconnected water moved');aim(0,p['west-low']);aim(1,p[route==='full-east'?'east-high':'east-low']);}
 until(()=>b.position.y>(route==='full-east'?7.7:3.98),30,'East hydraulic deck did not rise');wait(.5);mark('visible level gauges follow the real transferred water');
 collect(d);walk(14,-3);walk(5,-3);walk(-5,-3);walk(-14,-3);until(()=>g.playerGrounded,5,'West reservoir landing failed');
 walk(-14,-9);g.interact();wait(1.3);aim(1,p['east-low']);aim(0,p['west-high']);
 until(()=>a.position.y>7.7,30,'West hydraulic deck did not rise');wait(.5);mark('flow reverses and raises the exit-side reservoir');
 collect(d);walk(-24,-4);until(()=>g.state==='won',4,'Joint hydraulic exit failed');
 mark('both original travellers leave via the raised western deck');
}

export function runOpenLaunch(d){
 installRoom21Aim(d);const {game:g,level:l,walk,wait,until,frame,worldMove,stop,mark}=d,p=l.panels;
 walk(-31,29.6);check(g.interact()&&g.velocityCompanion.connected,'Original companion not connected');
 walk(-18,16.15);d.aim(0,p['fall-court'].getFrame().center);
 walk(-45,20);walk(-46,-49,30);walk(-34,-49);walk(-34,8,30);walk(-26,17.65);d.aim(1,p['inclined-outlet'].getFrame().center);mark('two prepared apertures share the real falling impulse');walk(-26,3);wait(.6);
 const airShot=(index,point)=>{
  let aligned=false,previousYaw=null,previousPitch=null;d.stop();
  for(let n=0;n<100;n++){
   g.scene.updateMatrixWorld(true);
   if(g.portalShots.captureTarget(index).distanceTo(point)<.45){aligned=true;break;}
   const inverse=g.cameraRig.portalOrientation.clone().invert();
   const desired=point.clone().sub(g.camera.position).normalize().applyQuaternion(inverse);
   const actual=g.camera.getWorldDirection(new THREE.Vector3()).applyQuaternion(inverse);
   const targetYaw=Math.atan2(-desired.x,-desired.z),actualYaw=Math.atan2(-actual.x,-actual.z);
   const targetPitch=Math.asin(THREE.MathUtils.clamp(desired.y,-1,1)),actualPitch=Math.asin(THREE.MathUtils.clamp(actual.y,-1,1));
   const deltaYaw=Math.atan2(Math.sin(targetYaw-actualYaw),Math.cos(targetYaw-actualYaw));
   const leadYaw=previousYaw===null?0:Math.atan2(Math.sin(targetYaw-previousYaw),Math.cos(targetYaw-previousYaw));
   const leadPitch=previousPitch===null?0:targetPitch-previousPitch;
   g.yaw+=THREE.MathUtils.clamp(deltaYaw*.65+leadYaw,-.24,.24);
   g.pitch=THREE.MathUtils.clamp(g.pitch+(targetPitch-actualPitch)*.65+leadPitch,CAMERA_PITCH_MIN,CAMERA_PITCH_MAX);
   previousYaw=targetYaw;previousPitch=targetPitch;frame();
  }
  check(aligned,'Airborne target never entered reticle '+g.playerPosition.toArray());check(!g.playerGrounded,'Airborne shot happened after landing');check(g.firePortal(index),'Airborne shot input rejected');
  until(()=>!g.portalShots.queue.length&&!g.portalShots.active.length,1,'Airborne shot unresolved');check(g.portalShots.lastImpact?.valid,'Airborne shot impact '+JSON.stringify(g.portalShots.lastImpact));
 };
 const before=g.teleportCount;
 for(let i=0;i<480&&g.playerGrounded;i++){worldMove(0,-.12);frame();}stop();
 until(()=>g.teleportCount>before,5,'Falling portal missed');mark('54-metre fall exits the inclined dish');
 airShot(0,p['far-catch'].getFrame().center);
 until(()=>g.playerPosition.x>33,4,'The outside face was not reached');
 airShot(1,wallTarget(p['terminal-outlet']));mark('both endpoints rewired with ordinary airborne shots');
 until(()=>g.teleportCount>before+1,4,'Far catch missed');mark('distant screen transfers the same two travellers');
 until(()=>g.playerGrounded,4,'Upper receiving plaza missed');wait(1.1);walk(64,-20);until(()=>g.state==='won',4,'Upper joint arrival failed');
}
