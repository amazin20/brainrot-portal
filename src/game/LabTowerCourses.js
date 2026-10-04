/**
 * Physical routes beyond each wing's existing gate. Coordinates use the same
 * local axes as towerPoint: s advances from the hub, n points left, and y is
 * above this deck's floor. The normal wing is -6.25 <= n <= 6.25.
 *
 * Integration contract:
 *   localBox(room, ...solid fields, materialFor(solid.role));
 *   localFloor(room, ...floor fields);
 *   replace the ordinary side wall over each wallGap with two jambs/openings;
 *   walk the waypoints after the gate, then reverse through returnWaypoints.
 * All other existing walls, portal panels (s <= 22), the gate (s = 28), and
 * the reactor at s = 38 stay where they are. No invisible collider is needed.
 */

const freezePoints=points=>Object.freeze(points.map(([s,n,y=0,kind='walk'])=>Object.freeze({s,n,y,kind})));
const freezeBoxes=boxes=>Object.freeze(boxes.map(([s,n,y,along,height,across,role])=>
 Object.freeze({s,n,y,along,height,across,role})));
const freezeFloors=floors=>Object.freeze(floors.map(([s0,s1,n0,n1,y=0])=>
 Object.freeze({s0,s1,n0,n1,y})));
const freezeGaps=gaps=>Object.freeze(gaps.map(([sign,s0,s1])=>Object.freeze({sign,s0,s1})));

function finish(stage,topology,boxes,points,{floors=[],wallGaps=[],bounds=[-6.25,6.25],returnPoints=null}={}){
 const end=[38,stage.reactorN??0,0];
 const waypoints=freezePoints([...points,end]);
 const returnWaypoints=freezePoints(returnPoints??[...points].reverse());
 return Object.freeze({id:stage.id,topology,solids:freezeBoxes(boxes),
  floors:freezeFloors(floors),wallGaps:freezeGaps(wallGaps),
  waypoints,returnWaypoints,bounds:Object.freeze({minN:bounds[0],maxN:bounds[1]})});
}

/** Six enclosed side galleries have two real openings in the original wall.
 * A collidable partition in the old aisle makes the annex the onward route;
 * the second opening returns to the existing reactor. The annex is broad
 * enough for the player and the carried companion, in either direction.
 */
function annex(stage){
 const deck=Math.floor(stage.index/3),sign=deck%2===0?1:-1;
 const N=n=>sign*n;
 const outer=deck%3===2?13.35:12.35;
 const center=(outer+6.05)/2,width=outer-6.05;
 const boxes=[
  [33,0,3.79,.36,7.58,12.05,'partition'],
  [33,N(outer+.16),3.8,9.9,7.6,.32,'shell'],
  [28.05,N(center),3.8,.32,7.6,width+.3,'shell'],
  [37.95,N(center),3.8,.32,7.6,width+.3,'shell'],
  [33,N(center),7.72,10.0,.18,width+.35,'roof'],
 ];
 // Six readable annex plans, with the obstruction off the walked lane. The
 // corridor must remain useful in both directions; these are actual solids.
 const inner=6.95,far=outer-1.05;
 const mid=[];
 switch(deck){
  case 0:
   boxes.push([33.0,N(outer-1.05),1.35,1.8,2.7,1.1,'machine']);
   mid.push([31.8,N(8.0)],[34.1,N(8.0)]);break;
  case 1:
   boxes.push([32.1,N(inner),1.65,1.15,3.3,.65,'machine'],
    [34.25,N(inner),1.65,1.15,3.3,.65,'machine']);
   mid.push([31.4,N(far)],[33.1,N(far)],[35.0,N(far)]);break;
  case 2:
   boxes.push([33,N(9.7),2.05,2.05,4.1,1.35,'machine']);
   mid.push([31.1,N(7.7)],[32.2,N(7.7)],[34.3,N(7.7)]);break;
  case 3:
   boxes.push([31.8,N(outer-.85),2.2,.7,4.4,1.25,'machine'],
    [34.3,N(inner),2.2,.7,4.4,1.25,'machine']);
   mid.push([31.5,N(8.45)],[33.1,N(8.9)],[35.2,N(outer-1.3)]);break;
  case 4:
   boxes.push([32.9,N(outer-1.1),1.65,2.0,3.3,1.25,'machine']);
   mid.push([31.6,N(7.8)],[34.2,N(7.8)]);break;
  default:
   boxes.push([32,N(inner),2.2,.65,4.4,1.0,'machine'],
    [34,N(outer-.8),2.2,.65,4.4,1.0,'machine']);
   mid.push([31.6,N(9.8)],[33,N(9.8)],[35.1,N(9.0)]);break;
 }
 const points=[[29.2,0],[30.05,N(4.8)],[30.05,N(7.55)],...mid,
  [36.05,N(7.55)],[36.05,N(4.9)],[37.0,stage.reactorN??0]];
 return finish(stage,'enclosed-annex',boxes,points,{
  floors:[[28.05,37.95,...(sign>0?[6.03,outer+.3]:[-outer-.3,-6.03])]],
  wallGaps:[[sign,29.0,31.15],[sign,35.0,37.2]],
  bounds:sign>0?[-6.25,outer+.3]:[-outer-.3,6.25],
 });
}

/** A floor-to-ceiling central apparatus creates two playable routes. The
 * authored path uses the side leading naturally to that wing's reactor.
 */
function island(stage){
 const sign=Math.sign(stage.reactorN)|| (stage.index%2?1:-1);
 const shift=(Math.floor(stage.index/3)%2)*.35;
 const boxes=[
  [32.15+shift,0,2.52,3.05,5.04,3.35,'machine'],
  [32.15+shift,-4.65,1.65,.70,3.3,.7,'pylon'],
  [32.15+shift,4.65,1.65,.70,3.3,.7,'pylon'],
  [35.3,0,6.6,1.35,1.65,7.7,'overhead'],
 ];
 const points=[[29.2,0],[30.15,sign*3.15],[32.45,sign*3.15],
  [34.65,sign*3.15],[36.4,stage.reactorN??0]];
 return finish(stage,'forked-island',boxes,points);
}

/** Battery's back reactor keeps its island course, while a separate upper
 * capacitor hall branches off before the gate. The first cargo contact powers
 * the projector. Its real beam raises the missing bridge to a second contact.
 * The five-metre gap cannot be cleared by a carried-companion jump.
 */
function batteryCapacitor(stage){
 const core=island(stage);
 const extra=[
  [20.45,7.2,.15,2.6,.3,1.5,'step'],
  [20.45,8.7,.30,2.6,.6,1.5,'step'],
  [20.45,10.2,.45,2.6,.9,1.5,'step'],
  [20.45,11.7,.60,2.6,1.2,1.5,'step'],
  [25.4,18.35,3.8,13.2,7.6,.32,'shell'],
  [27.45,12.05,3.8,9.1,7.6,.32,'shell'],
  [18.8,15.2,3.8,.32,7.6,6.4,'shell'],
  [32.0,15.2,3.8,.32,7.6,6.4,'shell'],
  [25.4,12.4,7.72,13.2,.18,12.1,'roof'],
 ];
 return Object.freeze({...core,
  solids:Object.freeze([...core.solids,...freezeBoxes(extra)]),
  floors:freezeFloors([[18.8,23.0,6.03,12.45],
   [19.0,23.0,12.2,18.15,1.2],[28.2,32.0,12.2,18.15,1.2]]),
  wallGaps:freezeGaps([[1,19.0,22.4]]),
  bounds:Object.freeze({minN:-6.25,maxN:18.5}),
  batteryBridge:Object.freeze({s0:23.0,s1:28.2,n0:12.2,n1:18.15,y:1.2}),
 });
}

/** A raised central causeway is built from real 30 cm risers. The 4.8 m
 * aisle between its flanking walls is wide enough for ordinary movement,
 * including the carried companion; the controller's normal step solver
 * climbs each riser without a scripted jump or player repositioning.
 */
function terrace(stage){
 const boxes=[
  [32.35,-2.65,2.3,6.9,4.6,.3,'parapet'],
  [32.35,2.65,2.3,6.9,4.6,.3,'parapet'],
  // These solid side closures make the raised crossing the route through
  // the room. The central 4.7 m tread remains wide enough for both actors.
  [31.75,-4.5,2.05,.42,4.1,3.35,'shell'],
  [31.75,4.5,2.05,.42,4.1,3.35,'shell'],
  [29.65,0,.15,1.05,.3,4.7,'step'],
  [30.7,0,.30,1.05,.6,4.7,'step'],
  [31.75,0,.45,1.05,.9,4.7,'step'],
  [32.8,0,.60,1.05,1.2,4.7,'step'],
  [33.85,0,.45,1.05,.9,4.7,'step'],
  [34.9,0,.30,1.05,.6,4.7,'step'],
  [35.95,0,.15,1.05,.3,4.7,'step'],
 ];
 const points=[[29.65,0,.3],[30.7,0,.6],[31.75,0,.9],[32.8,0,1.2],
  [33.85,0,.9],[34.9,0,.6],[35.95,0,.3],[37,stage.reactorN??0]];
 return finish(stage,'raised-causeway',boxes,points);
}

/** The press wing's rear wall opens onto an exposed, elevated U-shaped
 * maintenance route. Its two sides use actual stepped risers. Between them,
 * the outer catwalk has a missing span: walking straight over it drops the
 * player into open air, while one ordinary jump carries the original companion
 * across. The same jump is needed in reverse after the reactor is connected.
 */
function brokenSkybridge(stage){
 const boxes=[
  [33,0,3.79,.36,7.58,12.05,'partition'],
  [30,7.2,.15,2.4,.3,1.5,'step'],
  [30,8.7,.30,2.4,.6,1.5,'step'],
  [30,10.2,.45,2.4,.9,1.5,'step'],
  [30,11.7,.60,2.4,1.2,1.5,'step'],
  [36,11.7,.60,2.4,1.2,1.5,'step'],
  [36,10.2,.45,2.4,.9,1.5,'step'],
  [36,8.7,.30,2.4,.6,1.5,'step'],
  [36,7.2,.15,2.4,.3,1.5,'step'],
  [30,22.45,2.15,2.8,1.9,.28,'parapet'],
  [36,22.45,2.15,2.8,1.9,.28,'parapet'],
 ];
 const outward=[[29.35,0],[30,4.7],[30,6.3],[30,7.2,.3],
  [30,8.7,.6],[30,10.2,.9],[30,11.7,1.2],
  [30,13.4,1.2],[30,20.8,1.2],[31.6,20.8,1.2],
  [31.83,20.8,1.2,'jump'],[34.85,20.8,1.2],
  [36,20.8,1.2],[36,13.4,1.2],[36,11.7,1.2],
  [36,10.2,.9],[36,8.7,.6],[36,7.2,.3],
  [36,6.3],[36,4.7],[37,stage.reactorN??0]];
 const inbound=[[36,4.7],[36,6.3],[36,7.2,.3],[36,8.7,.6],
  [36,10.2,.9],[36,11.7,1.2],[36,13.4,1.2],
  [36,20.8,1.2],[34.6,20.8,1.2,'jump'],
  [31.15,20.8,1.2],[30,20.8,1.2],[30,13.4,1.2],
  [30,11.7,1.2],[30,10.2,.9],[30,8.7,.6],
  [30,7.2,.3],[30,6.3],[30,4.7],[29.35,0]];
 return finish(stage,'broken-skybridge',boxes,outward,{
  floors:[
   [28.9,31.25,6.03,12.5],
   [34.8,37.35,6.03,12.5],
   [28.9,32.22,12.4,22.5,1.2],
   [33.92,37.35,12.4,22.5,1.2],
  ],
  wallGaps:[[1,29.0,31.2],[1,35.0,37.2]],
  bounds:[-6.25,22.6],returnPoints:inbound,
 });
}

/** A very different rear chamber for the confluence machine: five full-height
 * baffles alternate their only companion-width openings between opposite
 * walls. The chamber extends beyond both former wing walls, so each crossing
 * is a real twenty-metre lateral traverse between solid barriers rather than
 * an arbitrary waypoint in an empty hall. It remains open in both directions.
 */
function accumulatorMaze(stage){
 const baffles=[29.7,31.4,33.1,34.8,36.5].map((s,index)=>
  [s,index%2===0?1.5:-1.5,3.8,.18,7.6,23.0,'machine']);
 const boxes=[
  ...baffles,
  [33.05,13.2,3.8,10.9,7.6,.32,'shell'],
  [33.05,-13.2,3.8,10.9,7.6,.32,'shell'],
  [27.6,9.7,3.8,.32,7.6,7.3,'shell'],
  [27.6,-9.7,3.8,.32,7.6,7.3,'shell'],
  [38.5,9.7,3.8,.32,7.6,7.3,'shell'],
  [38.5,-9.7,3.8,.32,7.6,7.3,'shell'],
  [33,0,7.72,9.6,.18,26.6,'roof'],
 ];
 const outward=[[28.95,0],[28.95,-11.35],
  [30.55,-11.35],[30.55,11.35],
  [32.25,11.35],[32.25,-11.35],
  [33.95,-11.35],[33.95,11.35],
  [35.65,11.35],[35.65,-11.35],
  [37.3,-11.35],[37.3,3.0]];
 return finish(stage,'accumulator-maze',boxes,outward,{
  floors:[[27.6,38.5,-13.35,-6.03],[27.6,38.5,6.03,13.35]],
  wallGaps:[[-1,28.3,38.1],[1,28.3,38.1]],bounds:[-13.35,13.35],
 });
}

/** One annex, one island and one stepped course per deck; annex placement
 * rotates between physical branches, so the player cannot memorize a single
 * east-wing detour on all six storeys. */
export function towerCourse(stage){
 if(!stage||!Number.isInteger(stage.index)||stage.index<0||stage.index>=18)
  throw new RangeError('Tower course needs an authored stage index 0..17');
 // The Exchange wing builds its five-metre shaft and raised receiving shelf
 // directly in LabTowerLevel. A flat terrace here would obstruct the landing.
 if(stage.id==='exchange')return finish(stage,'momentum-shaft',[],[]);
 if(stage.id==='press')return brokenSkybridge(stage);
 if(stage.id==='confluence')return accumulatorMaze(stage);
 if(stage.id==='battery')return batteryCapacitor(stage);
 const deck=Math.floor(stage.index/3),branch=stage.index%3;
 if(branch===deck%3)return annex(stage);
 if(branch===(deck+1)%3)return island(stage);
 return terrace(stage);
}
