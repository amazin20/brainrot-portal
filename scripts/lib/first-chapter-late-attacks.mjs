/** Finite ordinary-input attacks against the active foundation rooms 6–10.
 * A failed attack is evidence for this exact route only, never a statement
 * that a room has no exploits. Neither actor poses nor puzzle state are set.
 * Run inside runV8Journey's scenario so original-body/reset checks stay live. */
const check=(value,message)=>{if(!value)throw Error(message);};

export const FIRST_CHAPTER_LATE_ATTACKS=Object.freeze([
 {id:'optical-dark-left',index:5,kind:'dark-perimeter',side:-1},
 {id:'optical-dark-center',index:5,kind:'dark-perimeter',side:0},
 {id:'optical-dark-right',index:5,kind:'dark-perimeter',side:1},
 {id:'optical-cabin-jump-slot',index:5,kind:'cabin-slot'},
 {id:'balance-tower-roof',index:6,kind:'tower-roof'},
 {id:'balance-unloaded-diagonal',index:6,kind:'rocker-jump'},
 {id:'air-unpowered-pair',index:7,kind:'unpowered-pair'},
 {id:'air-unrouted-live-fan',index:7,kind:'unrouted-fan'},
 {id:'air-founded-column-cargo-step',index:7,kind:'column-cargo-step'},
 {id:'spring-carried-guard-jumps',index:8,kind:'spring-guard',cargoStep:false},
 {id:'spring-original-cargo-step',index:8,kind:'spring-guard',cargoStep:true},
 {id:'dock-receiver-before-extension',index:9,kind:'dock-before-extension'},
 {id:'dock-empty-roof-hatch',index:9,kind:'dock-roof'},
].map(Object.freeze));

function collect(d){
 const p=d.game.cargo.position.clone();d.walk(p.x,p.z+1.1);d.pickup();
}

function drive(d,report,{x=0,z=0,frames=360,jumpEvery=12,sprint=true}={}){
 if(!report.samples){const p=d.game.playerPosition;
  Object.assign(report,{minX:p.x,maxX:p.x,minZ:p.z,maxZ:p.z,maxY:p.y});
 }
 if(sprint)d.game.input.keys.add('ShiftLeft');
 for(let n=0;n<frames&&d.game.state==='playing';n++){
  if(jumpEvery&&n%jumpEvery===0)d.game.input.jumpQueued=true;
  d.worldMove(x,z);d.frame();
  const p=d.game.playerPosition,c=d.game.cargo.position;
  report.samples++;report.maxY=Math.max(report.maxY,p.y);
  report.minX=Math.min(report.minX,p.x);report.maxX=Math.max(report.maxX,p.x);
  report.minZ=Math.min(report.minZ,p.z);report.maxZ=Math.max(report.maxZ,p.z);
  if(d.game.playerGrounded&&Math.hypot(p.x-c.x,p.z-c.z)<1.1&&p.y>c.y+.15)
   report.originalCargoStepSamples++;
  report.goalReached||=d.game.playerGrounded&&d.level.goal.contains(p);
  if(report.index===9&&!d.level.workshop.state['dock-lock'].engaged&&p.x>0&&p.x<7.6&&p.z>.3&&p.z<2.7&&p.y<3.18)
   report.closedHoodEntered=true;
 }
 d.stop();
}

export async function runFirstChapterLateAttack(d,attack){
 check(FIRST_CHAPTER_LATE_ATTACKS.includes(attack),'Use an explicitly catalogued late-chapter attack');
 const {game:g,level:l}=d;
 check(g.chamberEdition==='foundation'&&l.index===attack.index,'Attack booted the wrong active room');
 const cargo=g.cargo,body=g.physics.cargoBody;
 const r={id:attack.id,index:l.index,samples:0,maxY:g.playerPosition.y,
  minX:g.playerPosition.x,maxX:g.playerPosition.x,minZ:g.playerPosition.z,maxZ:g.playerPosition.z,
  closedHoodEntered:false,
  originalCargoStepSamples:0,goalReached:false,won:false,teleportsBefore:g.teleportCount};

 if(attack.kind==='dark-perimeter'){
  collect(d);const x=attack.side*10.7;
  // The side approach stays outside the mirror and its receiver: these are
  // fresh gate/outer-wall attacks without ever powering the optical door.
  d.walk(8,0);d.walk(8,-10.3);d.walk(x,-10.3);
  drive(d,r,{z:-1,frames:420,jumpEvery:7});
  check(!l.state.lit&&!l.state.pilotLit&&!l.state.door.open,'Dark attack accidentally solved the optical circuit');
  r.requiredCause={receiverLit:l.state.lit,doorProgress:l.state.door.progress};
 }else if(attack.kind==='cabin-slot'){
  collect(d);d.walk(-3,0);d.walk(-3,-4.5);
  drive(d,r,{x:-1,frames:480,jumpEvery:5});
  r.cabinEntered=r.minX< -5.5;
  check(l.state.mirror===0&&!g.portals.ready,'Cabin slot attack must not turn the mirror or use a portal');
 }else if(attack.kind==='tower-roof'){
  collect(d);d.walk(-11.7,8);d.walk(-15.5,8);d.walk(-15.5,5.8);d.walk(-15.5,-11.1);
  d.walk(-11.7,-11.25);
  drive(d,r,{x:1,frames:420,jumpEvery:9});
  r.towerWallCrossed=r.maxX> -8.9;
  check(!g.portals.ready&&!l.state.braked,'Tower attempt must not prepare the real gravity-flight route');
 }else if(attack.kind==='rocker-jump'){
  collect(d);d.walk(8,11.5);d.walk(8,5.8);d.walk(8,5.25);d.walk(2.3,5.25);d.walk(2.3,3.55);
  g.input.jumpQueued=true;d.walk(0,3.55);
  drive(d,r,{x:.14,z:1,frames:600,jumpEvery:3});
  check(!g.portals.ready&&!l.state.braked,'Rocker attack cannot borrow the gravity route or upper brake');
  r.requiredCause={looseLoad:l.state.loaded,angle:l.state.angle};
 }else if(attack.kind==='unpowered-pair'){
  d.aim(0,l.panels['air-intake'].getFrame().center);d.walk(0,3);
  d.aim(1,l.panels['air-up'].getFrame().center);collect(d);d.walk(0,4);d.walk(0,1.3);
  const before=g.teleportCount;
  for(let n=0;n<180&&g.teleportCount===before;n++){d.worldMove(0,-.4);d.frame();}d.stop();
  check(g.teleportCount>before,'Unpowered attack did not actually traverse its floor-to-wall portal');
  drive(d,r,{z:-1,frames:720,jumpEvery:5});
  check(!l.state.enabled&&l.state.fanSpeed===0,'Unpowered portal loop accidentally enabled the fan');
  r.requiredCause={fanEnabled:l.state.enabled,fanSpeed:l.state.fanSpeed};
 }else if(attack.kind==='unrouted-fan'){
  d.walk(6,10);check(g.interact(),'Fan switch inaccessible');d.wait(2);collect(d);
  d.walk(0,4);d.walk(0,1.3);
  drive(d,r,{z:-1,frames:600,jumpEvery:7});
  check(l.state.enabled&&!g.portals.ready,'Unrouted fan attack must have live fan but no aperture pair');
  r.requiredCause={fanEnabled:l.state.enabled,pairReady:g.portals.ready};
 }else if(attack.kind==='column-cargo-step'){
  collect(d);d.walk(6,0);d.walk(6,-5.5);d.walk(5.2,-5.5);
  for(let n=0;n<8;n++){d.worldMove(-.18,0);d.frame();}d.stop();d.wait(.2);
  check(g.interact()&&!g.heldCube,'Could not release the original companion beside the real column');d.wait(.8);
  drive(d,r,{x:-1,frames:720,jumpEvery:3});
  check(!g.portals.ready&&!l.state.enabled,'Column attack must not use the live air route');
  r.requiredCause={fanEnabled:l.state.enabled,pairReady:g.portals.ready};
 }else if(attack.kind==='spring-guard'){
  collect(d);d.walk(0,4);d.walk(0,-1.3);
  if(attack.cargoStep){
   for(let n=0;n<8;n++){d.worldMove(0,-.18);d.frame();}d.stop();d.wait(.2);
   check(g.interact()&&!g.heldCube,'Could not release original cargo as the attempted step');d.wait(.8);
  }
  drive(d,r,{z:-1,frames:720,jumpEvery:5});
  r.cupEntered=r.minZ< -3.8;
  r.requiredCause={latched:l.workshop.state.piston.latched,compression:l.workshop.state.piston.compression};
  check(!g.portals.ready,'Spring guard attack must not use the intended falling portal');
 }else if(attack.kind==='dock-before-extension'){
  // Legitimate cargo hatch, deliberately wrong action order: a real arrival
  // must not open the hood while the freight deck is still in its cassette.
  d.aim(1,l.panels['dock-feed-ceiling'].getFrame().center.clone().add({x:.4,y:0,z:-.3}));
  d.aim(0,l.panels['dock-feed-floor'].getFrame().center.clone().add({x:-.65,y:0,z:0}));
  d.walk(-5.5,9.5);d.pickup();d.walk(-4.28,9.5);d.wait(.2);
  check(g.interact()&&!g.heldCube,'Could not release the real cargo for the premature delivery');
  drive(d,r,{frames:300,jumpEvery:0,sprint:false});
  const s=l.workshop.state;r.cargoArrived=g.cargo.position.x>1&&g.cargo.position.y<3;
  r.requiredCause={bridgeProgress:s.freight.progress,locked:s['dock-lock'].engaged};
  check(s.freight.progress===0,'Wrong-order delivery moved the bridge');
 }else if(attack.kind==='dock-roof'){
  d.walk(-9.5,11);d.walk(-9.5,5.6);d.walk(-5.4,5.6);d.walk(-5.4,4.7);
  check(g.interact(),'Empty bridge dispatch inaccessible');d.wait(5);
  d.walk(-2.8,4.7);d.walk(-1.55,2);
  drive(d,r,{x:1,frames:600,jumpEvery:3});
  // Jumping onto the glass roof is a permissible failed attempt; opening the
  // hood or reaching the final door with no original load would be a bypass.
  r.requiredCause={bridgeProgress:l.workshop.state.freight.progress,locked:l.workshop.state['dock-lock'].engaged};
 }
 r.won=g.state==='won';r.player=g.playerPosition.toArray();r.cargo=g.cargo.position.toArray();r.cargoHeld=g.heldCube===g.cargo;
 r.teleports=g.teleportCount-r.teleportsBefore;r.originalCargo=g.cargo===cargo&&g.physics.cargoBody===body;
 check(r.originalCargo,'Attack replaced the original companion');
 d.mark(`attack:${r.id}`);return r;
}

/** Immutable current gate for the closed group captured by the native runner.
 * The wrapper supplies the enclosing ordinary journey's counters. Keep it
 * independent of filesystem, browser globals and the mutable live game. */
export function assertFirstChapterLateAttacks(report){
 const need=(condition,label)=>{if(!condition)throw Error(`first-chapter-later: ${label}`);};
 const finite=(value,label)=>need(typeof value==='number'&&Number.isFinite(value),label);
 const vector=(value,label)=>need(Array.isArray(value)&&value.length===3&&value.every(v=>typeof v==='number'&&Number.isFinite(v)),label);
 const samples={'dark-perimeter':420,'cabin-slot':480,'tower-roof':420,'rocker-jump':600,
  'unpowered-pair':720,'unrouted-fan':600,'column-cargo-step':720,'spring-guard':720,
  'dock-before-extension':300,'dock-roof':600};
 need(report&&report.group==='later'&&report.edition==='foundation','wrong active edition/group');
 need(Array.isArray(report.cases)&&report.cases.length===FIRST_CHAPTER_LATE_ATTACKS.length,'incomplete attack set');
 for(const [i,a] of FIRST_CHAPTER_LATE_ATTACKS.entries()){
  const r=report.cases[i];need(r&&r.id===a.id&&r.index===a.index,`case ${i} identity/order`);
  need(r.originalCargo===true&&r.won===false&&r.goalReached===false,`${a.id} cargo/goal verdict`);
  const held=!['column-cargo-step','dock-before-extension','dock-roof'].includes(a.kind)&&!(a.kind==='spring-guard'&&a.cargoStep);
  need(r.cargoHeld===held,`${a.id} held/loose original cargo`);
  need(r.closedHoodEntered===false,`${a.id} closed enclosure entered`);
  need(r.samples===samples[a.kind],`${a.id} truncated attack`);
  need(Number.isSafeInteger(r.originalCargoStepSamples)&&r.originalCargoStepSamples>=0&&r.originalCargoStepSamples<=r.samples,`${a.id} cargo-step samples`);
  for(const key of ['maxY','minX','maxX','minZ','maxZ'])finite(r[key],`${a.id} ${key}`);
  need(r.minX<=r.maxX&&r.minZ<=r.maxZ,`${a.id} inverted observed bounds`);
  vector(r.player,`${a.id} final player`);vector(r.cargo,`${a.id} final cargo`);
  need(r.teleportsBefore===0&&Number.isSafeInteger(r.teleports)&&r.teleports>=0&&r.teleports<=32,`${a.id} portal count`);
  const j=r.journey;need(j&&j.pass===true&&j.resets===0&&j.respawns===0,`${a.id} journey/reset verdict`);
  need(Number.isSafeInteger(j.frames)&&j.frames>=r.samples&&j.frames<=100000,`${a.id} journey frame coverage`);
  const c=r.requiredCause;
  if(a.kind==='dark-perimeter'){
   need(c&&c.receiverLit===false,`${a.id} exit receiver powered`);finite(c.doorProgress,`${a.id} door progress`);
   need(c.doorProgress>=0&&c.doorProgress<.01,`${a.id} dark door opened`);
  }else if(a.kind==='cabin-slot')need(r.cabinEntered===false&&r.minX>=-5.5,`${a.id} cabin entered`);
  else if(a.kind==='tower-roof')need(r.towerWallCrossed===false&&r.maxX<=-8.9,`${a.id} tower wall crossed`);
  else if(a.kind==='rocker-jump'){
   need(c&&c.looseLoad===false,`${a.id} original loose rocker load`);finite(c.angle,`${a.id} rocker angle`);
   need(Math.abs(c.angle)<=1.6,`${a.id} impossible rocker angle`);
  }else if(a.kind==='unpowered-pair')need(c&&c.fanEnabled===false&&c.fanSpeed===0&&r.teleports>0,`${a.id} fan powered or aperture never traversed`);
  else if(a.kind==='unrouted-fan')need(c&&c.fanEnabled===true&&c.pairReady===false,`${a.id} fan/pair mismatch`);
  else if(a.kind==='column-cargo-step')need(c&&c.fanEnabled===false&&c.pairReady===false,`${a.id} borrowed powered route`);
  else if(a.kind==='spring-guard'){
   need(r.cupEntered===false&&c&&c.latched===false,`${a.id} guarded cup/latch`);
   finite(c.compression,`${a.id} compression`);need(c.compression>=0&&c.compression<.72,`${a.id} compression escaped unlatch range`);
  }else if(a.kind==='dock-before-extension'){
   need(r.cargoArrived===true&&r.cargo[0]>1&&r.cargo[1]<3,`${a.id} cargo did not arrive`);
   need(c&&c.bridgeProgress===0&&c.locked===false,`${a.id} premature receiving latch`);
  }else if(a.kind==='dock-roof')need(c&&c.bridgeProgress>.98&&c.bridgeProgress<=1&&c.locked===false,`${a.id} empty dock opened`);
 }
 return {pass:true,group:'later',edition:'foundation',cases:report.cases.length,
  scope:'Thirteen finite ordinary-input attacks in active rooms 6–10; no universal exploit-free claim.'};
}
