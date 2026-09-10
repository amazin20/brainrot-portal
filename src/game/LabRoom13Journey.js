const check=(okay,message)=>{if(!okay)throw new Error(message);};

// All helpers below drive the production movement/camera/buttons. They never
// assign actor transforms, portal frames, mechanism state, or the win flag.
function shoot(d,index,name,offset={x:0,y:0,z:0}){
 const patch=d.level.panels[name];
 d.aim(index,patch.getFrame().center.clone().add(offset));
 check(d.game.portals.portals[index]?.surfaceId===patch.mesh.uuid,`Shot reached the wrong ceramic: ${name}`);
}
export function room13Access(d,{carry=true}={}){
 const {game:g,walk,pickup,enter,until,mark}=d;
 walk(-8,20.5);walk(-8,-16);walk(-12,-16);
 shoot(d,1,'access-high',{x:0,y:1.5,z:0});
 walk(-8,20.5);walk(-11,20.5);shoot(d,0,'access-low');
 if(carry){walk(g.cargo.position.x+1,g.cargo.position.z);pickup();mark('original friend collected');}
 enter(d.level.panels['access-low']);until(()=>g.playerGrounded,5,'Freight gallery arrival');
 mark(carry?'cargo arrives at upper gallery':'scout reaches the high freight gallery');
}
function eastReturn(d){
 const {game:g,walk,frame,worldMove,stop,until,mark}=d;
 walk(15,2);walk(22,13.5);
 for(let i=0;i<180&&g.playerGrounded;i++){worldMove(0,.25);frame();}
 stop();check(!g.playerGrounded,'Leave the east gallery edge');
 until(()=>g.playerGrounded,5,'East lower return');
 check(Math.abs(g.playerPosition.y-7)<.05,'The return uses the seven-metre balcony');mark('east return balcony');
 walk(23.5,13);walk(23.5,-8.8);mark('returned to ground');
}
function loadByCarry(d){
 const {game:g,walk,wait,mark}=d;
 room13Access(d);walk(12.7,-12.5);walk(15,-12.5);walk(15,2);walk(9.7,2);
 wait(.6);g.interact();wait(2);
 check(d.level.state['freight-car'].loaded(),'The same friend must rest on the freight deck');
 mark('friend released onto freight car');eastReturn(d);
}
function loadAfterScouting(d){
 const {game:g,walk,wait,until,pickup,mark}=d;
 room13Access(d,{carry:false});walk(12.7,-12.5);walk(13,-3);walk(9,-3);
 shoot(d,1,'freight-feed');
 check(g.cargo.position.y<1&&!g.heldCube,'Scouting leaves the original load at the arrival');
 mark('scout prepares the high freight mouth');walk(13,-3);eastReturn(d);
 walk(17,-9.5);walk(17,20.5);walk(-8,20.5);walk(-16.9,17);
 shoot(d,0,'loading-pan',{x:1.65,y:0,z:0});
 const source=g.portals.portals[0].position.clone();
 walk(g.cargo.position.x+1,g.cargo.position.z);pickup();walk(-16.2,source.z);wait(.4);
 for(let i=0;i<180&&g.playerPosition.y> -2;i++){d.worldMove(-.6,0);d.frame();}
 check(!g.playerGrounded&&g.playerPosition.y< -1.5,'The load is released during a real fall');
 g.interact();d.stop();mark('free load enters the lower loading well');
 until(()=>d.level.state['freight-car'].loaded(),12,'Gravity feeds the upper freight cage');wait(1);
 check(!g.heldCube&&g.cargo.position.y>19.7,'A free rigid body crossed the low freight grille');
 mark('scout loads the hoist through a low freight opening');
 if(g.playerPosition.y<10){walk(source.x,source.z);until(()=>g.playerPosition.y>17,5,'Scout follows the empty portal');}
 until(()=>g.playerGrounded,5,'Scout lands behind the freight grille');walk(13,-3);eastReturn(d);
}
export function room13Light(d){
 const {walk,mark}=d;
 walk(13,-20);shoot(d,0,'light-intake');walk(-8,-20);walk(-8,2);walk(-12,2);shoot(d,1,'light-output');
 check(d.level.state.optical.receivers[1],'The actual loaded mirror must illuminate the lifting pawl');
 mark('loaded ray releases the brake');
}
function crossGap(d,direction){
 const {game:g,walk,wait,frame,worldMove,stop,mark}=d;
 walk(direction>0?-6.2:-1.1,16);wait(.6);g.input.keys.add('ShiftLeft');
 for(let i=0;i<120&&(direction>0?g.playerPosition.x< -5.5:g.playerPosition.x> -1.8);i++){worldMove(direction,0);frame();}
 g.input.jumpQueued=true;let airborne=false;
 for(let i=0;i<180;i++){worldMove(direction,0);frame();airborne||=!g.playerGrounded;if(airborne&&g.playerGrounded)break;}
 stop();wait(.3);
 check(airborne&&g.playerGrounded&&Math.abs(g.playerPosition.y-23)<.05&&(direction>0?g.playerPosition.x> -2.3:g.playerPosition.x< -5),'The jump must land on the detached high span');
 mark(direction>0?'crossed the detached span':'returned across the detached span');
}
export async function runRoom13(d,{order='cargo-first',interruptPower=false}={}){
 check(['cargo-first','scout-first'].includes(order),'Unknown counterweight route');
 const {game:g,level:l,walk,wait,until,mark,pickup,frame,worldMove,stop}=d,rig=l.state.counterweight;
 if(order==='cargo-first')loadByCarry(d);else loadAfterScouting(d);
 room13Light(d);
 if(interruptPower){
  until(()=>rig.A.position.y>6,15,'Partial ascent');
  shoot(d,1,'light-output',{x:0,y:0,z:2});wait(1.5);
  check(!l.state.optical.receivers.some(Boolean)&&rig.dynamics.velocity===0,'Loss of light applies the brake');
  const height=rig.A.position.y;wait(2);
  check(height>3&&height<12&&Math.abs(rig.A.position.y-height)<1e-8,'The occupied platform retains its intermediate height');
  mark('lost light holds the occupied car');shoot(d,1,'light-output');
 }
 until(()=>rig.A.position.y>13.99,20,'Counterweight ascent');wait(.5);
 check(g.playerPosition.y>13.98&&rig.B.position.y<.05&&rig.B.loaded(),'Opposite cars carry the player and original load');
 mark('occupied car reaches upper pier');walk(-12,3.6);walk(-17,3.6);mark('safe upper platform');
 walk(-17,4);walk(-24.4,4);walk(-24.4,-13);walk(-21.5,-13);walk(-21.5,11.5);mark('high gallery above the arrival');
 walk(-16,16);crossGap(d,1);walk(24,16);walk(24,14.25);mark('opposite view of the hoist');
 shoot(d,1,'freight-final');walk(10,16);walk(10,14.12);shoot(d,0,'mirror-cradle',{x:g.cargo.position.x-9+.5,y:0,z:Math.min(2.3,g.cargo.position.z)-2});
 mark('free cargo leaves the counterweight');
 until(()=>g.cargo.position.y>15.9&&g.cargo.position.x<6,8,'Freight delivery');wait(6);mark('free cargo crosses the low throat');
 walk(10,16);crossGap(d,-1);walk(-16,16);walk(-21.5,11.5);walk(-21.5,-13);walk(-24.4,-13);walk(-24.4,4);walk(-17,4);
 shoot(d,1,'crossing-exit');walk(-24.4,4);walk(-24.4,8);walk(-23.1,8);shoot(d,0,'launch-well',{x:1.5,y:0,z:0});
 const fallX=g.portals.portals[0].position.x;
 walk(-24.4,8);walk(-24.4,-13);walk(-21.5,-13);walk(-21.5,11.5);walk(fallX,11.5);mark('height ready for the final crossing');
 const before=g.teleportCount;walk(fallX,10.65);
 for(let i=0;i<180&&g.playerGrounded;i++){worldMove(0,-.18);frame();}
 stop();check(!g.playerGrounded,'Leave the high drop gallery');
 until(()=>g.teleportCount>before,5,'High fall enters floor portal');mark('gravity redirected by the tilted outlet');
 until(()=>g.playerGrounded,5,'Receiving dock landing');check(Math.abs(g.playerPosition.y-16)<.05,'The flight must reach the actual receiving dock');mark('landed after the high crossing');
 if(g.state==='playing'){walk(g.cargo.position.x,g.cargo.position.z+.95);pickup();walk(3,0);}
 until(()=>g.state==='won',5,'Counterweight reunion');mark('both at exit');
}
