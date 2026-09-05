/** Deterministic solution using ordinary controls, never actor transforms. */
export async function runExtendedStages(d){
 const {game,level,walk,wait,aim,until,pickup,enter,mark,frame,worldMove,stop}=d;
 const assert=(v,m)=>{if(!v)throw Error(m);};
 function drop(){if(game.heldCube){wait(.3);game.interact();wait(1);}}
 function collect(){const c=game.cargo.position;walk(c.x,c.z+1.05);pickup();}
 function at(p){walk(p.x,p.z);}
 function maze(stage,back=false){
  const z=stage.z,offset=stage.type==='lift'?6:0;
  const pts=back?[[-5,z-6-offset],[5,z-6-offset],[5,z-2.8-offset]]:[[5,z-2.8-offset],[5,z-6-offset],[-5,z-6-offset],[-5,z-11-offset]];
  for(const [x,zz]of pts)walk(x,zz);
 }
 for(const [number,stage]of level.stages.entries()){
  if(stage.type==='gate'){
   walk(3,stage.z+11);drop();game.clearPortals();
   aim(0,stage.pad.mechanism.getPortalFrame().center);collect();walk(-4,stage.z+8);walk(-4,stage.z+6);drop();wait(1);
   assert(stage.pad.pressed,`Stage ${number+1} pad unweighted`);mark(`gate ${number+1}: live weight`);
   walk(0,stage.z+2);walk(0,stage.z-2.8);maze(stage);
   aim(1,stage.receiver.getFrame().center);wait(1.6);assert(!stage.pad.pressed,'Removing the load must close the gate');
   collect();at(stage.end);mark(`gate ${number+1}: recovered the same friend`);
  }else if(stage.type==='lift'){
   walk(3,stage.z+11);drop();game.clearPortals();
   aim(0,stage.entry.getFrame().center);aim(1,stage.lift.panel.getFrame().center);
   collect();walk(-4,stage.z+10);walk(-4,stage.z+8);drop();until(()=>stage.lift.y>4.98,10,'Weight-driven lift did not rise');
   enter(stage.entry);assert(game.playerPosition.y>4.9,'Exit did not follow the lift');mark(`lift ${number+1}: borrowed height`);
   walk(0,stage.z-8.8);maze(stage);aim(1,stage.receiver.getFrame().center);maze(stage,true);
   walk(7,stage.z-8.5);
   aim(0,stage.pad.mechanism.getPortalFrame().center.clone().add({x:0,y:0,z:-.1}));wait(2);
   assert(!stage.pad.pressed&&stage.lift.y<4.5,`Weight removal must lower the lift: cargo ${game.cargo.position.toArray()}; portals ${game.portals.portals.map(p=>p?.position.toArray())}`);
   maze(stage);collect();at(stage.end);mark(`lift ${number+1}: returned the load to stable ground`);
  }else{
   const p=stage.point;
   at(p(-5,5,-1));drop();game.clearPortals();at(p(-6,5,2.4));aim(0,stage.input.getFrame().center);
   at(p(-6.7,5,-3.65));game.interact();until(()=>stage.rotator.progress>.99,5,'Tilt did not finish');
   aim(1,stage.rotator.mechanism.getPortalFrame().center);mark(`fling ${number+1}: reconfigured pair and angle`);
   collect();at(p(-6,5,1));at(p(-6,5,2.65));const before=game.teleportCount;
   for(let n=0;n<180&&game.playerGrounded;n++){worldMove(0,stage.reverse?-1:1);frame();}
   stop();until(()=>game.teleportCount>before,4,'Gravity well entry missed');
   until(()=>game.playerGrounded,5,'Ballistic landing missed');
   assert(Math.abs(game.playerPosition.y-stage.landingY)<.1,'Did not reach the high island');
   at(stage.end);mark(`fling ${number+1}: landed with preserved companion`);
  }
 }
}
