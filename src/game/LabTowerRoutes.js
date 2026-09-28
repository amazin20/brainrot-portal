/**
 * Authored input routes for the eighteen Tower machines. Coordinates are local
 * to the wing: s runs away from the shared hub, n runs toward its left wall.
 * These are ordinary controller commands for LabTowerJourney. They do not
 * change actor positions, set mechanism flags, or unlock a reactor directly.
 *
 * The short names below are only a route-writing vocabulary. Each exported
 * route is a distinct causal solution, in the same way a recorded human route
 * can contain repeated E presses without making every puzzle the same puzzle.
 */

// Offset reactor alcoves are physical destinations, not a hidden victory
// condition. LabTowerLayout places the visible plate and LabTowerLevel tests
// the actual grounded traveller and original companion at that plate.
export const TOWER_ROUTE_REACTORS=Object.freeze({
 prism:3.0,freight:-3.0,exchange:-2.6,turbine:3.0,
 'double-prism':3.0,levitator:-2.6,battery:-3.0,windway:3.0,
 vault:-3.0,magnet:2.6,press:3.0,refraction:-3.0,
 storm:3.0,relay:-3.0,balance:2.6,confluence:3.0,
 'crown-drive':-3.0,'last-aperture':0,
});

// Solid transverse baffles leave a >=4m side channel. Their locations start
// after the beam/turbine receiving field so they cannot merely intercept an
// optical source. A two-baffle room has a change of side between physical
// openings; there is no invisible gate or teleport in these passages.
const DIVERTS=Object.freeze({
 prism:[[26.2,4.4]],freight:[[26.2,-4.4]],
 exchange:[[24.4,4.4],[26.8,-4.4]],
 turbine:[[26.2,4.4]],'double-prism':[[24.4,-4.4],[26.8,4.4]],
 battery:[[26.2,-4.4]],windway:[[26.2,4.4]],vault:[[26.2,-4.4]],
 press:[[26.2,4.4]],refraction:[[24.4,-4.4],[26.8,4.4]],
 storm:[[26.2,4.4]],relay:[[24.4,4.4],[26.8,-4.4]],
 confluence:[[26.2,4.4]],'crown-drive':[[24.4,-4.4],[26.8,4.4]],
 'last-aperture':[[24.4,4.4],[26.8,-4.4]],
});
export const TOWER_ROUTE_OBSTACLES=Object.freeze(Object.fromEntries(
 Object.entries(DIVERTS).map(([id,diverts])=>[id,Object.freeze(diverts.map(([s,gap])=>Object.freeze({
  s,n:gap>0?-1.8:1.8,along:.55,across:8,height:7.4,
 })))]),
));

function point(stage,s,n=0,y=stage.baseY){
 const [dx,dz]=stage.direction;
 return Object.freeze([
  stage.entry[0]+dx*(s-2)-dz*n,
  y,
  stage.entry[2]+dz*(s-2)+dx*n,
 ]);
}

function author(stage){
 const actions=[];
 const diverts=DIVERTS[stage.id]??[];
 const reactorN=stage.reactorN??TOWER_ROUTE_REACTORS[stage.id]??0;
 const add=(kind,s,n=0,details={})=>{
  actions.push(Object.freeze({kind,target:point(stage,s,n),...details}));
 };
 const route={
  walk:(s,n=0,details={})=>add('walk',s,n,details),
  drop:()=>add('drop',0),
  pickup:()=>add('pickup',0),
  use:()=>add('use',0),
  pause:(seconds=.45)=>add('wait',0,0,{seconds}),
  jump:(s,n=0)=>add('jump',s,n),
  // A waist-height aperture admits the player's capsule. The projector and
  // receivers remain above it, within their actual optical acceptance cones.
  shot:(slot,panel)=>add('shoot',0,0,{slot,aim:point(stage,panel==='input'?8:panel==='A'?14:20,panel==='input'?6.04:-6.04,stage.baseY+2.0)}),
  // The outlet is on the negative-n wall. `enter` approaches from its
  // positive-n (room) side and advances toward the wall through the aperture.
  enter:()=>add('enter',14,-6.04,{normal:Object.freeze([-stage.direction[1],0,stage.direction[0]]),seconds:4}),
  out:()=>{
   for(const [s,gap]of diverts){add('walk',s-1.2,gap);add('walk',s+.85,gap);}
   add('walk',30,reactorN);add('walk',38,reactorN);
  },
  socket:(s,n=0)=>{
   for(const [at,gap]of diverts){add('walk',at-1.2,gap);add('walk',at+.85,gap);}
   add('walk',29,0);add('walk',s,n);
  },
  home:()=>{
   // The late confluence gallery has a live feed beacon beside its return
   // aisle. Keep the physical companion outside that pedestal on the way in.
   if(stage.id==='confluence')add('walk',33,4.4);
   for(const [s,gap]of [...diverts].reverse()){
    add('walk',s+.85,gap);add('walk',s-1.2,gap);
   }
   add('walk',4,0);
  },
 };
 return {actions,route};
}

/** Each wing's route is written separately so its sequence can be reviewed
 * against its actual machine, rather than inferred from a requirement list.
 * The paired portal shots create a live beam, airflow or crossing; an output
 * retarget is a separate physical shot at a different panel.
 */
export function towerRoute(stage){
 const {actions,route:r}=author(stage);
 switch(stage.id){
  case 'prism':
   // Rotate the mirror first, then illuminate its two-segment receiver.
   r.walk(4.2);r.drop();r.walk(5,-2);r.use();
   r.walk(10,1.8);r.shot(0,'input');r.walk(11,-.7);r.shot(1,'A');
   r.pause(.8);r.walk(4.2);r.pickup();r.out();r.home();break;

  case 'freight':
   // The counterweight has to rest in its catch tray while the hoist is armed.
   r.walk(.4);r.walk(4.3);r.pause(.3);r.drop();r.pause(.8);r.walk(5,-2);r.use();
   r.walk(5.1);r.pickup();r.walk(19,-2.4);r.walk(24.7,-4.4);
   r.out();r.home();break;

  case 'exchange':
   // Light must enter the first portal before the player follows it back.
   r.walk(4.2);r.drop();r.walk(10,1.3);r.shot(0,'input');
   r.walk(11,-.6);r.shot(1,'A');r.pause(.55);
   r.walk(14,-4.5);r.enter();r.walk(8,2.7);
   r.walk(4.2);r.pickup();r.out();r.home();break;

  case 'turbine':
   // Spin up the vent with a portal pair before loading its catch tray.
   r.walk(4.2);r.drop();r.walk(10.8,1.2);r.shot(0,'input');
   r.walk(12,-.4);r.shot(1,'A');r.pause(.8);
   r.walk(4.2);r.pickup();r.walk(.4);r.walk(4.3);r.pause(.3);r.drop();r.pause(.8);
   r.pickup();r.walk(22,3.8);r.walk(24.7,4.4);r.out();r.home();break;

  case 'double-prism':
   // Two receivers share a source, but cannot share the destination portal.
   r.walk(4.2);r.drop();r.walk(11,0);r.shot(0,'input');
   r.shot(1,'A');r.pause(.55);r.walk(16,1.1);r.shot(1,'B');
   r.pause(.6);r.walk(4.2);r.pickup();r.out();r.home();break;

  case 'levitator':
   // The upper cargo sensor has to trip before the field is shut down.
   r.walk(.4);r.walk(4.3);r.pause(.3);r.drop();r.pause(2.0);r.walk(5,-2);r.use();
   r.pause(.9);r.walk(5.1);r.pickup();r.walk(19,2.8);
   r.walk(26,2.8);r.out();r.home();break;

  case 'battery':
   // Cargo powers the source, whose beam then passes through the portal pair.
   r.walk(.4);r.walk(4.3);r.pause(.3);r.drop();r.pause(.8);r.walk(11,1);
   r.shot(0,'input');r.walk(12,-1);r.shot(1,'A');r.pause(.6);
   r.walk(5.1);r.pickup();r.out();r.home();break;

  case 'windway':
   // The open air channel must be stable before the outlet is traversed.
   r.walk(4.2);r.drop();r.walk(11,1);r.shot(0,'input');
   r.shot(1,'A');r.pause(.8);r.walk(14,-4.5);r.enter();
   r.walk(4.2);r.pickup();r.walk(24,3.7);r.out();r.home();break;

  case 'vault':
   // Source charge opens a run-up; the kinetic trigger needs forward motion.
   r.walk(4.2);r.drop();r.walk(11,.7);r.shot(0,'input');
   r.shot(1,'A');r.pause(.6);r.walk(4.2);r.pickup();
   r.walk(12,0);r.walk(16,0);r.walk(23,0);r.out();r.home();break;

  case 'magnet':
   // Hoist the companion into the induction coil, then focus its beam.
   r.walk(.4);r.walk(4.3);r.pause(.3);r.drop();r.pause(2.0);r.walk(10,1.2);
   r.shot(0,'input');r.walk(12,-.8);r.shot(1,'A');
   r.pause(.9);r.walk(5.1);r.pickup();r.out();r.home();break;

  case 'press':
   // The weighted press must be loaded before the floor's acceleration run.
   r.walk(.4);r.walk(4.3);r.pause(.3);r.drop();r.pause(.8);r.walk(5.1);r.pickup();
   r.walk(12,-1);r.walk(17,-1);r.walk(23,0);
   r.walk(24.7,4.4);r.out();r.home();break;

  case 'refraction':
   // Rotate the prism, fill its first receiver, then redirect to the second.
   r.walk(4.2);r.drop();r.walk(5,-2);r.use();
   r.walk(10,1);r.shot(0,'input');r.walk(12,-1);r.shot(1,'A');
   r.pause(.65);r.walk(17,.5);r.shot(1,'B');
   r.pause(.65);r.walk(4.2);r.pickup();r.out();r.home();break;

  case 'storm':
   // The vent wakes at outlet A; the same inlet later feeds receiver B.
   r.walk(4.2);r.drop();r.walk(11,0);r.shot(0,'input');
   r.shot(1,'A');r.pause(.8);r.walk(16,2.3);
   r.shot(1,'B');r.pause(.55);r.walk(4.2);r.pickup();
   r.walk(25,3.8);r.out();r.home();break;

  case 'relay':
   // Traverse first; only then deliver the same companion to the cargo tray.
   r.walk(4.2);r.drop();r.walk(11,1);r.shot(0,'input');
   r.shot(1,'A');r.walk(14,-4.5);r.enter();
   r.walk(4.2);r.pickup();r.walk(.4);r.walk(4.3);r.pause(.3);r.drop();r.pause(.8);
   r.walk(5,-2);r.use();r.walk(5.1);r.pickup();r.out();r.home();break;

  case 'balance':
   // Set the tray before gravity carries its weight into the upper contact.
   r.walk(.4);r.walk(4.3);r.pause(.3);r.drop();r.pause(2.0);
   r.walk(5.1);r.pickup();r.walk(18,-2.8);
   r.walk(25,2.8);r.out();r.home();break;

  case 'confluence':
   // An oriented reflector feeds the light receiver; the vent joins last.
   r.walk(4.2);r.drop();r.walk(5,-2);r.use();
   r.walk(10,1.5);r.shot(0,'input');r.walk(12,-.5);r.shot(1,'A');
   r.pause(.85);r.walk(16,-1.5);r.walk(19,3.4);
   r.walk(16,-1.5);r.walk(4.2);r.pickup();
   r.walk(16,-1.5);r.walk(25,3.4);r.out();r.home();break;

  case 'crown-drive':
   // Mass starts the drive; a redirection and kinetic passage finish it.
   r.walk(.4);r.walk(4.3);r.pause(.3);r.drop();r.pause(.8);r.walk(11,.8);
   r.shot(0,'input');r.shot(1,'A');r.pause(.5);
   r.walk(16,-.8);r.shot(1,'B');r.pause(.6);
   r.walk(5.1);r.pickup();r.walk(12,0);r.walk(17,0);
   r.walk(23,0);r.out();r.home();break;

  case 'last-aperture':
   // Weight in the coil, a crossing, then the living turbine at the crown.
   r.walk(.4);r.walk(4.3);r.pause(.3);r.drop();r.pause(2.0);r.walk(11,1);
   r.shot(0,'input');r.shot(1,'A');
   r.walk(14,-4.5);r.enter();r.walk(4.2);r.pause(.6);
   r.walk(5.1);r.pickup();r.walk(23,3.8);r.out();r.home();break;

  default:throw new Error(`No authored Tower route for ${stage.id}`);
 }
 return Object.freeze(actions);
}

/** The three powered wings feed one central, physical keystone per deck. These
 * inputs are used before the stair route; completion belongs to the live
 * keystone mechanisms. Positions are in the shared hub's world coordinates.
 */
export function towerDeckRoute(deck,spec={}){
 if(!Number.isInteger(deck)||deck<0||deck>5)throw new RangeError(`Invalid Tower deck ${deck}`);
 const y=deck*8,actions=[];
 const position=(x,z,height=0)=>Object.freeze([x,y+height,z]);
 const add=(kind,x=0,z=0,extra={})=>actions.push(Object.freeze({kind,target:position(x,z),...extra}));
 const r={
  walk:(x,z,extra={})=>add('walk',x,z,extra),
  drop:()=>add('drop'),pickup:()=>add('pickup'),use:()=>add('use'),
  pause:(seconds=.4)=>add('wait',0,0,{seconds}),
  shot:(slot,panel)=>add('shoot',0,0,{slot,aim:position(panel==='input'?-6:6,panel==='B'?3:-3,2.0)}),
  enter:(panel='A')=>add('enter',6,panel==='B'?3:-3,{normal:Object.freeze([-1,0,0]),seconds:4}),
 };
 const modes=spec.feedModes??[],stages=spec.stages??[];
 if(modes.length&&!stages.length)throw new Error(`Deck ${deck+1} socket route needs its three stage descriptors`);
 for(const feed of modes){
  const wing=stages.find(s=>s.branch===feed.branch);
  if(!wing)throw new Error(`Missing branch ${feed.branch} on deck ${deck+1}`);
  // Branch mouths share the central hub, not a diagonal tunnel between
  // outer wings. Return to its clear centre before choosing another mouth.
  r.walk(0,0);
  const {actions:wingActions,route:w}=author(wing);
  // A socket is live only with its actual source powered. The solution visits
  // different branches, in the keystone's authored order, to reconfigure that
  // source. Its center is then touched by the grounded player, never assigned.
  switch(feed.mode){
   case 'beamA':case 'beamB':case 'airA':
    w.walk(4.2);w.drop();w.walk(11,0);
    w.shot(0,'input');w.shot(1,feed.mode==='beamB'?'B':'A');
    w.pause(feed.mode==='airA'?.8:.55);
    if(wing.id==='confluence')w.walk(16,-1.5);
    w.socket(feed.s,feed.n??0);w.home();w.pickup();break;
   case 'cargo':case 'gravityCargo':
    w.walk(.4);w.walk(4.3);w.pause(.3);w.drop();
    w.pause(feed.mode==='gravityCargo'?2.0:.8);
    w.socket(feed.s,feed.n??0);w.home();w.pickup();break;
   case 'transit':
    w.walk(4.2);w.drop();w.walk(11,0);
    w.shot(0,'input');w.shot(1,'A');w.walk(14,-4.5);w.enter();
    w.pickup();w.socket(feed.s,feed.n??0);w.home();break;
   case 'kinetic':
    w.walk(18,0);w.socket(feed.s+1.2,feed.n??0);w.home();break;
   default:throw new Error(`Unknown Tower socket mode ${feed.mode}`);
  }
  actions.push(...wingActions);
 }
 // All six hub mechanisms are different after their branch socket prerequisites.
 switch(deck){
  case 0: // Spectrum: fill the lower receiver, then retarget the outlet.
   r.walk(0,0);r.drop();r.walk(0,-1.2);
   r.shot(0,'input');r.shot(1,'A');r.pause(.6);
   r.walk(0,1);r.shot(1,'B');r.pause(.6);
   r.pickup();r.walk(0,7);break;

  case 1: // Counterweight: one actor loads a tray, the other occupies a plate.
   r.walk(0,0);r.walk(0,-3);r.walk(0,-4.8);r.pause(.3);
   r.drop();r.pause(.7);r.walk(0,2.4);r.walk(0,5.5);
   r.walk(4,0);r.use();r.walk(0,-4.2);r.pickup();
   r.walk(0,7);break;

  case 2: // Wind machine: a real portal drives the impeller and acceleration.
   r.walk(0,4.1);r.drop();r.walk(0,-1.2);
   r.shot(0,'input');r.shot(1,'A');r.pause(.8);
   r.walk(4,-3.0);r.walk(2.6,-3.0,{sprint:false});
   r.walk(-4,-3.0);r.walk(0,4.1);r.pickup();r.walk(0,7);break;

  case 3: // Magnetic lift plus physical traversal, then vent and recovery.
   r.walk(0,2.4);r.walk(0,.7);r.pause(.3);r.drop();
   r.pause(2.0);r.walk(0,-1.2);r.shot(0,'input');r.shot(1,'A');
   // Four solid magnet pillars remain collidable. Approach the aperture along
   // its south aisle; after crossing, return along the opposite outer aisle.
   r.walk(0,-3.2);r.walk(4.5,-3);r.enter('A');
   r.walk(-5.3,0);r.walk(0,4.2);
   r.use();r.pause(.8);r.pickup();r.walk(0,7);break;

  case 4: // Mirror braid: mechanical orientation then two receiver circuits.
   r.walk(0,1.4);r.drop();r.walk(0,4.2);r.use();
   r.walk(0,-1.2);r.shot(0,'input');r.shot(1,'A');r.pause(.8);
   r.walk(0,1);r.shot(1,'B');r.pause(.6);
   r.pickup();r.walk(0,7);break;

  case 5: // Crown: mass, light, airflow, momentum, portal and final actuator.
   r.walk(0,0);r.walk(0,-3);r.walk(0,-4.8);r.pause(.3);
   r.drop();r.pause(.75);r.walk(0,-1.2);
   r.shot(0,'input');r.shot(1,'A');r.pause(.65);
   r.walk(0,1);r.shot(1,'B');r.pause(.8);
   r.walk(4,3);r.walk(2.7,3,{sprint:false});r.walk(-4,3);
   r.walk(4.5,3);r.enter('B');r.walk(0,4.2);r.use();
   r.pickup();r.walk(0,7);break;
 }
 return Object.freeze(actions);
}
