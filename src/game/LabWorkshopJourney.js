import * as THREE from 'three';
/** Positive playthroughs issue the same movement, aim and E interactions as a
 * player. No actor/body transform, mechanism state or success flag is assigned. */
export async function runWorkshopJourney(d){
 const {game,level,walk,wait,aim,until,pickup,enter,mark,frame,worldMove,stop}=d;
 const k=level.workshop,s=k.state,p=level.panels,index=game.levelIndex;
 const assert=(ok,text)=>{if(!ok)throw Error(text);};
 const faceNorth=()=>{for(let i=0;i<10;i++){worldMove(0,-.18);frame();}stop();wait(.2);};
 function put(x,z){assert(game.heldCube,'Put requires the same held friend');walk(x,z+1.05);faceNorth();game.interact();wait(1.1);assert(!game.heldCube,'Release failed');}
 function collect(){const c=game.cargo.position.clone(),a=game.playerPosition.clone().sub(c);a.y=0;if(a.length()<.1)a.z=1;a.normalize().multiplyScalar(1.3);walk(c.x+a.x,c.z+a.z);pickup();}
 function lever(name,settle=1){const t=s[name+'Control'];assert(t,'Missing lever '+name);const a=game.playerPosition.clone().sub(t.position);a.y=0;if(a.length()<.1)a.z=1;a.normalize().multiplyScalar(1.4);walk(t.position.x+a.x,t.position.z+a.z);wait(.2);game.interact();wait(settle);}
 function shot(i,name){const f=p[name].getFrame(),point=f.center.clone();if(name==='work-front')point.y-=.20;aim(i,point);}
 function floorFeed(name,watch=null){const f=p[name].getFrame();collect();put(f.center.x,f.center.z);walk(f.center.x+3.2,f.center.z+3.0);shot(0,name);if(watch)lookAt(watch);else wait(.8);}
 function portTo(name){shot(0,'work-front');shot(1,name);enter(p['work-front']);}
 function groundExit(){walk(game.playerPosition.x,-9.5);walk(0,-9.5);walk(0,-16);}
 function lookAt(point){
  stop();for(let n=0;n<100;n++){
   game.scene.updateMatrixWorld(true);
   if(point.clone().sub(game.camera.position).dot(game.camera.getWorldDirection(new THREE.Vector3()))<0){game.yaw+=.18;frame();continue;}
   const ndc=point.clone().project(game.camera);
   game.yaw-=THREE.MathUtils.clamp(ndc.x,-1,1)*.22;
   game.pitch=THREE.MathUtils.clamp(game.pitch+THREE.MathUtils.clamp(ndc.y,-1,1)*.19,-1.15,1.15);frame();
  }
 }
 if(index===8){
  shot(1,'drop-ceiling');floorFeed('loading-floor',new THREE.Vector3(0,2,-5));until(()=>s.piston.latched,7,'Piston did not catch impact');mark('gravity compressed the physical spring');
  // Inspect the supplied horizontal ram and its linkage from the rear aisle
  // using ordinary walking and camera controls before collecting the friend.
  walk(2.6,-2);walk(2.6,-8.9);walk(-3,-8.9);
  lookAt(new THREE.Vector3(-3.2,1.35,-5));mark('inspected spring linkage and guard slot');
  walk(2.6,-8.9);walk(2.6,-2);
  walk(-4,-2);walk(game.cargo.position.x,-2.7);walk(game.cargo.position.x,-3.32);pickup();
  walk(2.6,-2.7);walk(2.6,-7.6);groundExit();
 }else if(index===9){
  collect();walk(-9.5,11);walk(-9.5,5.6);walk(-5.4,5.6);walk(-2.9,4.7);put(-1.55,1.5);walk(-2.9,4.7);
  lever('dispatch',.1);lookAt(new THREE.Vector3(.5,2,1.5));until(()=>s['dock-lock'].engaged,10,'Loaded bridge did not latch dock');mark('same cargo carried by the extending deck');
  // Step clear of the dispatch console before sighting across the room: the
  // persistent shoulder camera must obey its foreground collision too.
  walk(-2.8,4.7);shot(1,'unloading-dock');
  walk(-5.4,5.6);walk(-8.2,5.6);walk(-9.7,4.2);
  shot(0,'loading-dock');enter(p['loading-dock']);collect();
  walk(5.2,4.2);lookAt(new THREE.Vector3(7.6,1.84,.5));mark('inspected the receiver cable across the bank');
  walk(7,-2.5);wait(1);groundExit();
 }else if(index===10){
  shot(0,'wind-intake');shot(1,'wind-outlet');lever('fan-switch',8);
  until(()=>s.ratchet.engaged,15,'Wind did not do mechanical work');mark('air spun flywheel and lifted ratchet');collect();groundExit();
 }else if(index===11){
  shot(0,'work-front');shot(1,'carousel');lever('rotation',3);enter(p['work-front']);mark('moving portal served cargo balcony');collect();enter(p.carousel);put(-5,10);
  lever('rotation',3);collect();enter(p['work-front']);walk(0,-9);
 }else if(index===12){
  shot(0,'work-front');shot(1,'brake-lift');collect();put(7,5);until(()=>s['brake-lift'].progress>.99,9,'Weight did not raise lift');enter(p['work-front']);
  walk(-6,-3.5);lever('brake');assert(s['brake-lift'].locked,'Brake did not hold');mark('mechanical brake holds height while pair is repurposed');
  walk(-4,-2.2);aim(0,p.weight.getFrame().center);wait(3);walk(-7,-3.5);walk(-7,-.8);collect();walk(-7,-3.5);walk(-4,-7);
 }else if(index===13){
  walk(-7,9.5);portTo('operator');lever('crane-handle',3);assert(s.crane.attached,'Claw missed friend');mark('claw grips the original body');
  lever('crane-handle',3);lever('crane-handle',5);lever('crane-handle',3);
  until(()=>s['cup-lock'].engaged,5,'Cargo did not reach receiver');mark('crane deposited friend without teleport');
  enter(p.operator);walk(7,-3);collect();groundExit();
 }else if(index===14){
  shot(0,'wind-intake');walk(-8,2);walk(-3.7,2);walk(-3.7,-.2);walk(0,-.2);shot(1,'duct-mouth');lever('fan-switch');lever('shutter-0');walk(-7,1);walk(-7,-9.5);walk(7,-9.5);lever('shutter-1',8);
  until(()=>s['duct-lock'].engaged,15,'Shutters still obstruct airflow');mark('both real shutters clear the duct');walk(8,5);collect();walk(8,8);walk(8,-9.5);groundExit();
 }else if(index===15){
  shot(0,'work-front');shot(1,'drawbridge');lever('bridge-drive',9);collect();enter(p['work-front']);put(0,4);
  walk(-1.6,1);shot(1,'bridge-wall');shot(0,'drawbridge');collect();enter(p.drawbridge);walk(5,-7);
 }else if(index===16){
  shot(0,'supply');shot(1,'rail-air');collect();put(-7.5,2);lever('sail-fan',.2);collect();
  assert(game.playerPosition.y>3.15&&Math.abs(game.playerPosition.x-s.sail.position.x)<1.8,'Missed boarding');
  until(()=>s.sail.progress>.98,45,'Wind ferry did not reach dock');mark('sailboat moved under sustained air force');walk(9,2);walk(9,-4);
 }else if(index===17){
  lever('sort-angle');walk(-5,6);walk(5,6);lever('sort-motor');shot(1,'feed');floorFeed('load-floor');until(()=>s['sort-lock'].engaged,8,'Rollers missed receiving tray');mark('turned conveyor physically delivered the friend');walk(-7,7);walk(-7,-7.5);walk(0,-7.5);wait(2);collect();groundExit();
 }else if(index===18){
  shot(1,'ceiling-drop');floorFeed('feed-floor');until(()=>s.rebound.latched,8,'Rebound did not reach upper plunger');mark('physical rebound compressed the overhead catcher');wait(4);collect();groundExit();
 }else if(index===19){
  shot(0,'wind-intake');walk(6,-4);shot(1,'power-route');lever('power-switch');lever('drive-clutch');until(()=>s['foundry-lift'].progress>.99,16,'Foundry lift did not rise');
  shot(0,'work-front');walk(10,-5.8);walk(10,3.5);shot(1,'foundry-lift');enter(p['work-front']);walk(-6,-5);lever('foundry-brake');mark('powered lift secured by upper brake');
  walk(-7,-4);enter(p['foundry-lift']);collect();enter(p['work-front']);walk(-7,-4.8);walk(1,-9);
 }
}
