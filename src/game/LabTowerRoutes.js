import {towerCourse} from './LabTowerCourses.js';

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
 const course=towerCourse(stage);
 const add=(kind,s,n=0,details={})=>{
  actions.push(Object.freeze({kind,target:point(stage,s,n),...details}));
 };
 const route={
  walk:(s,n=0,details={})=>add('walk',s,n,details),
  high:(s,n,height)=>add('walk',s,n,{target:point(stage,s,n,stage.baseY+height)}),
  fling:(s,n=0)=>add('fling',s,n,{direction:Object.freeze([...stage.direction]),wingIndex:stage.index}),
  elevated:(s,n,y,details={})=>add('walk',s,n,{target:point(stage,s,n,stage.baseY+y),...details}),
  drop:()=>add('drop',0),
  pickup:()=>add('pickup',0),
  use:()=>add('use',0),
  pause:(seconds=.45)=>add('wait',0,0,{seconds}),
  until:(field,value=true,seconds=4)=>add('until',0,0,{field,value,seconds}),
  jump:(s,n=0)=>add('jump',s,n),
  // A waist-height aperture admits the player's capsule. The projector and
  // receivers remain above it, within their actual optical acceptance cones.
  shot:(slot,panel)=>add('shoot',0,0,{slot,aim:stage.id==='exchange'
   ?point(stage,panel==='input'?18:24,panel==='input'?0:-6.04,stage.baseY+(panel==='input'?.025:4.5))
   :point(stage,panel==='input'?8:panel==='A'?14:20,panel==='input'?6.04:-6.04,stage.baseY+2.0)}),
  // The outlet is on the negative-n wall. `enter` approaches from its
  // positive-n (room) side and advances toward the wall through the aperture.
  enter:()=>add('enter',14,-6.04,{normal:Object.freeze([-stage.direction[1],0,stage.direction[0]]),seconds:4}),
  out:()=>{
   for(const {s,n,y,kind}of course.waypoints)add(kind,s,n,{target:point(stage,s,n,stage.baseY+y)});
  },
  home:()=>{
   if(stage.id==='windway'){
    // After the flight lands, the return shutter opens along the right wall.
    // This path cannot serve as an outward shortcut before airLanding.
    for(const {s,n,y,kind}of course.returnWaypoints)add(kind,s,n,{target:point(stage,s,n,stage.baseY+y)});
    add('walk',23,4.75);add('walk',19.35,4.75);add('walk',17.4,4.75);
    add('walk',13.1,4.75);add('walk',4,0);return;
   }
   if(stage.id==='refraction'){
    for(const {s,n,y,kind}of course.returnWaypoints)add(kind,s,n,{target:point(stage,s,n,stage.baseY+y)});
    // The ray window retracts only after the second receiver is powered.
    add('walk',21.0,1.4);add('walk',15.5,1.4);add('walk',4,0);return;
   }
   for(const {s,n,y,kind}of course.returnWaypoints)add(kind,s,n,{target:point(stage,s,n,stage.baseY+y)});
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
   // The lower tray powers the warehouse. Send the same rigid companion up
   // the open freight shaft; the player takes one stair, recovers it on the
   // receiving deck, then leaves by the other. Either stair also accepts a
   // manually carried load as a physical alternate solution.
   r.walk(.4);r.walk(4.3);r.pause(.3);r.drop();r.pause(.8);r.walk(5,-2);r.use();
   r.walk(5.1);r.pickup();r.walk(12,0);r.walk(15.5,0);
   r.walk(15.5,5.0);r.walk(16.0,8.0);r.walk(16.0,12.9);
   r.drop();r.until('freightArmed',true,2.5);
   r.walk(16.0,6.85);r.walk(13.0,6.85);
   for(const [n,y]of [[11,1],[15,2],[19,3],[23,4]])r.elevated(13.0,n,y);
   r.elevated(17.0,23.7,4);r.elevated(21.55,23.7,4);
   r.elevated(21.55,17.7,4);r.until('freightDelivered',true,2.5);
   r.elevated(21.55,16.0,4);r.pickup();
   r.elevated(21.55,23.7,4);r.elevated(25.5,23.7,4);
   for(const [n,y]of [[19,3],[15,2],[11,1],[7.5,.25]])r.elevated(25.5,n,y);
   r.walk(25.5,6.8);r.walk(25.5,4.7);r.walk(27.0,0);
   r.out();r.home();break;

  case 'exchange':
   // Climb with the original companion, aim at both real faces, then turn
   // gravity into horizontal speed. Ordinary running through the exit lands
   // beneath the receiving shelf.
   r.walk(4.2);r.pause(.5);r.drop();r.walk(11,0);r.shot(0,'input');r.shot(1,'A');
   r.walk(4.2);r.pickup();
   r.walk(4,4.7);r.high(14.4,4.7,4);
   r.high(14.4,-4.7,4);r.high(2.5,-4.7,5);
   r.high(3,0,5);r.high(8,0,5);
   r.high(14.2,0,5);r.fling(18);
   r.high(27.2,4.7,2.05);r.high(30,4.7,2.05);
   r.high(31.3,3.45,1.845);r.walk(34.5,3.45);
   r.walk(38,stage.reactorN);r.home();break;

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
   // The original companion charges the upper source. Its real portal beam
   // raises a missing bridge, letting the same body reach the output socket.
   // That socket powers a second receiver only after the outlet is retargeted;
   // the player then retrieves the body and crosses the bridge again.
   r.walk(18.5,0);r.walk(20.45,4.9);r.walk(20.45,6.3);
   for(const [n,y]of [[7.2,.3],[8.7,.6],[10.2,.9],[11.7,1.2],[13.2,1.2],[14.35,1.2]])
    r.high(20.45,n,y);
   r.drop();r.pause(.8);
   r.high(20.45,13.2,1.2);
   for(const [n,y]of [[11.7,1.2],[10.2,.9],[8.7,.6],[7.2,.3],[6.3,0]])r.high(20.45,n,y);
   r.walk(20.45,4.9);r.walk(11,1);r.shot(0,'input');r.walk(12,-1);r.shot(1,'A');
   r.walk(20.45,4.9);r.walk(20.45,6.3);
   for(const [n,y]of [[7.2,.3],[8.7,.6],[10.2,.9],[11.7,1.2],[13.2,1.2]])r.high(20.45,n,y);
   r.high(20.45,14.35,1.2);r.pickup();
   for(const s of [22.35,25.5,28.8,29.85])r.high(s,15.15,1.2);
   r.drop();r.pause(.8);
   for(const s of [28.8,25.5,22.35,20.45])r.high(s,15.15,1.2);
   r.high(20.45,13.2,1.2);
   for(const [n,y]of [[11.7,1.2],[10.2,.9],[8.7,.6],[7.2,.3],[6.3,0]])r.high(20.45,n,y);
   r.walk(20.45,4.9);r.walk(16,1.1);r.shot(1,'B');
   r.walk(20.45,4.9);r.walk(20.45,6.3);
   for(const [n,y]of [[7.2,.3],[8.7,.6],[10.2,.9],[11.7,1.2],[13.2,1.2]])r.high(20.45,n,y);
   for(const s of [22.35,25.5,28.8,29.85])r.high(s,15.15,1.2);
   r.pickup();
   for(const s of [28.8,25.5,22.35,20.45])r.high(s,15.15,1.2);
   r.high(20.45,13.2,1.2);
   for(const [n,y]of [[11.7,1.2],[10.2,.9],[8.7,.6],[7.2,.3],[6.3,0]])r.high(20.45,n,y);
   r.walk(20.45,4.9);r.walk(26,0);r.out();r.home();break;

  case 'windway':
   // The open air channel must be stable before the outlet is traversed.
   // After the crossing, its angled duct carries the original companion and
   // player over the solid spillway; landing beyond it powers the wing gate.
   r.walk(4.2,0,{sprint:false});r.pause(.5);r.drop();r.walk(11,1);r.shot(0,'input');
   r.shot(1,'A');r.pause(.8);r.walk(14,-4.5);r.enter();
   r.walk(4.2);r.pickup();r.walk(11.8,0,{sprint:false});r.jump(12.0,0);
   r.walk(23,0);r.walk(24,3.7);r.out();r.home();break;

  case 'vault':
   // Source charge opens a run-up; the kinetic trigger needs forward motion.
   r.walk(4.2);r.drop();r.walk(11,.7);r.shot(0,'input');
   r.shot(1,'A');r.pause(.6);r.walk(4.2);r.pickup();
   r.walk(12,0);r.walk(16,0);r.walk(23,0);r.out();r.home();break;

  case 'magnet':
   // Charge the hoist, carry its original load around two solid machine banks,
   // and place it on the raised outer dock while A still illuminates the coil.
   // Returning alone to redirect B opens a second, raised passage back to it.
   r.walk(.4);r.walk(4.3);r.pause(.3);r.drop();r.pause(2.0);r.walk(10,1.2);
   r.shot(0,'input');r.walk(12,-.8);r.shot(1,'A');
   r.pause(.9);r.walk(5.1);r.pickup();
   r.walk(17.75,4.8);r.walk(17.75,8.0);r.walk(18.35,12.25);
   r.walk(20.65,12.25);r.walk(21.65,8.1);r.walk(23.15,8.1);
   r.high(23.85,8.1,.30);r.high(24.65,8.1,.60);
   r.high(25.45,8.1,.90);r.high(26.30,8.1,1.20);
   r.drop();r.until('cargoDock',true,4.5);
   r.high(25.45,8.1,.90);r.high(24.65,8.1,.60);
   r.high(23.85,8.1,.30);r.walk(21.65,8.1);
   r.walk(20.65,12.25);r.walk(18.35,12.25);r.walk(17.75,8.0);
   r.walk(17.75,4.8);r.walk(19.25,0);r.shot(1,'B');r.pause(.8);
   r.walk(26.9,2.2);r.high(26.9,3.35,.30);r.high(26.9,4.15,.60);
   r.high(26.9,4.95,.90);r.high(26.9,5.75,1.20);
   r.high(26.9,6.9,1.20);r.high(27.1,8.1,1.20);r.pickup();
   r.high(26.9,6.9,1.20);r.high(26.9,5.75,1.20);
   r.high(26.9,4.95,.90);r.high(26.9,4.15,.60);
   r.high(26.9,3.35,.30);r.walk(26.9,2.2);
   r.out();r.home();break;

  case 'press':
   // The weighted press must be loaded before the floor's acceleration run.
   r.walk(.4);r.walk(4.3);r.pause(.3);r.drop();r.pause(.8);r.walk(5.1);r.pickup();
   r.walk(12,-1);r.walk(17,-1);r.walk(23,0);
   r.walk(24.7,4.4);r.out();r.home();break;

  case 'refraction':
   // The first reflected ray crosses a sealed optical pane. Carry the same
   // companion through the bent side gallery into the second chamber, leave
   // it there for the retargeted shot, then retrieve it before the reactor.
   r.walk(4.2);r.drop();r.walk(5,-2);r.use();
   r.walk(10,1);r.shot(0,'input');r.walk(12,-1);r.shot(1,'A');
   r.pause(.65);r.walk(4.2);r.pickup();
   r.walk(14.1,4.9);r.walk(14.1,8.0);r.walk(16.0,7.6);
   r.walk(18.8,7.6);r.walk(19.4,10.5);r.walk(22.6,10.5);
   r.walk(22.8,8.0);r.walk(22.8,4.4);r.walk(22.0,1.8);
   r.drop();r.walk(20.0,-2.5);r.shot(1,'B');r.pause(.65);
   r.pickup();r.out();r.home();break;

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
   // The released companion reaches the upper coil. The player escorts it
   // from the safe inner aisle while its original rigid body flies through
   // the side aperture to the elevated exterior catch, then back for pickup.
   r.walk(.4);r.walk(4.3);r.pause(.3);r.drop();r.pause(2.0);
   r.walk(7.2,-3.5,{sprint:false});r.walk(9.3,-3.5,{sprint:false});
   r.walk(11.0,-3.5,{sprint:false});r.until('bridgeCatch',true,4);
   r.until('bridgeReturned',true,4);r.walk(10,-2.1);r.pickup();r.walk(18,-2.8);
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

/** The upper warehouse is also reachable while carrying the original body.
 * This second ordinary-input solution uses the first stair for both actors
 * and the second stair for the return, bypassing the magnetic transfer rail. */
export function towerFreightCarryRoute(stage){
 if(stage?.id!=='freight')throw new Error('The carry route belongs to the freight wing');
 const {actions,route:r}=author(stage);
 r.walk(.4);r.walk(4.3);r.pause(.3);r.drop();r.pause(.8);r.walk(5,-2);r.use();
 r.walk(5.1);r.pickup();r.walk(12,0);r.walk(13,5.0);r.walk(13,6.85);
 for(const [n,y]of [[11,1],[15,2],[19,3],[23,4]])r.elevated(13,n,y);
 r.elevated(17,23.7,4);r.elevated(21.55,23.7,4);
 r.elevated(21.6,13.3,4);r.elevated(22.9,13.3,4);r.elevated(22.9,14.7,4);
 r.drop();r.until('freightDelivered',true,2.5);r.pickup();
 r.elevated(21.55,23.7,4);r.elevated(25.5,23.7,4);
 for(const [n,y]of [[19,3],[15,2],[11,1],[7.5,.25]])r.elevated(25.5,n,y);
 r.walk(25.5,6.8);r.walk(25.5,4.7);r.walk(27,0);r.out();r.home();
 return Object.freeze(actions);
}

/** The three solved wings feed one central, physical keystone per deck. The
 * wing's live signals are captured at its reactor, so the central route never
 * sends the player through a cleared corridor a second time. Positions are
 * in the shared hub's world coordinates.
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
  until:(field,value=true,seconds=.5)=>add('until',0,0,{field,value,seconds}),
  shot:(slot,panel)=>add('shoot',0,0,{slot,aim:position(panel==='input'?-6:6,panel==='B'?3:-3,2.0)}),
  enter:(panel='A')=>add('enter',6,panel==='B'?3:-3,{normal:Object.freeze([-1,0,0]),seconds:4}),
 };
 // All six hub mechanisms are different after the three branch reactors.
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
   // Put the companion behind the centre lane before using the console. A
   // forward throw from z=1.4 can roll into the console interaction radius
   // and cause E to pick it up instead of turning the mirror.
   r.walk(0,-4,{sprint:false});r.pause(.4);r.drop();r.pause(.4);
   r.walk(-3,-4);r.walk(-3,4.2);r.walk(0,4.2);r.use();r.until('controlOn');
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
