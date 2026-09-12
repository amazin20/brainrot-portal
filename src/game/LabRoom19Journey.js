const check=(ok,message)=>{if(!ok)throw Error(message);};
function serviceInput(d,requireLight=true){
 const p=d.level.panels['service-intake'],target=p.getFrame().center.clone();
 for(let n=0;n<3;n++){d.aim(0,target);d.wait(.1);if(d.level.state['air-source'].segments[0]?.kind==='portal'&&d.level.state.optical.segments[0]?.kind==='portal'&&(!requireLight||d.level.state.optical.lit))return;target.add(p.getFrame().center.clone().sub(d.game.portals.portals[0].position));}
 check(false,'Source aperture missed the real airflow');
}
export function room19Ascent(d,{interruptLight=false}={}){
 const {game,level,walk,aim,wait,until,mark}=d,p=level.panels,s=level.state;
 walk(-6,14);walk(-6,1);aim(1,p['optical-window'].getFrame().center);
 walk(-6,5);walk(-17,5);walk(-17,-8);walk(-14,-8);serviceInput(d);
 check(s.optical.lit,'Glass optical receiver did not illuminate: '+JSON.stringify(s.optical.segments.map(x=>({a:x.a.toArray(),b:x.b.toArray(),kind:x.kind}))));
 check(!s.inertia.power,'Air must not reach the upper turbine through glass');mark('light crosses the sealed chamber');
 if(interruptLight){wait(2);aim(0,p['service-intake'].getFrame().center.clone().add({x:0,y:0,z:2}));wait(.2);check(!s.optical.lit,'A displaced aperture must interrupt light');until(()=>s['glass-observer'].position.y<.05,12,'Light loss must lower the unlatched lift');serviceInput(d);}
 until(()=>game.playerPosition.y>7.98,15,'Optical ascent');walk(-14,-11.5);walk(-6,-11.5);walk(-6,-14.5);walk(0,-14.5);walk(1,-9);mark('the reverse side of the service wall');
}
export function room19Cargo(d){
 const {game,level,walk,aim,until,wait,mark}=d,p=level.panels;
 walk(9,-11);aim(1,p['ferry-receiver'].getFrame().center);
 walk(0,-6);walk(0,-5.12);aim(0,p['sealed-cradle'].getFrame().center);
 until(()=>game.cargo.position.y>8,7,'Original cargo did not leave its sealed chamber');wait(1.5);
 check(game.state==='playing'&&level.state['inertial-ferry'].progress<.01,'Cargo transfer alone cannot cross the transit shaft');mark('friend reaches the ferry independently');
}
function charge(d){
 const {level,aim,until,mark}=d;
 aim(1,level.panels['open-air-duct'].getFrame().center);d.look(level.state.inertia.position);mark('air takes the open duct');
 until(()=>level.state.inertia.wheel.omega>30,40,'Flywheel did not acquire real momentum');
}
export async function runRoom19(d,{order='air-first',interruptLight=false,coastDelay=0}={}){
 const {game,level,walk,aim,wait,until,pickup,mark}=d,p=level.panels,s=level.state;
 check(['air-first','cargo-first'].includes(order),'Unknown room19 order');room19Ascent(d,{interruptLight});
 if(order==='air-first'){
  charge(d);room19Cargo(d);check(!s.inertia.power&&s.inertia.wheel.energy>0,'Releasing portals must leave physical stored energy');if(coastDelay)wait(coastDelay);
 }else{
  room19Cargo(d);walk(0,-6.5);walk(0,-14.5);walk(-6,-14.5);walk(-6,-11.5);walk(-14,-11.5);
  serviceInput(d,false);mark('return loop restores the original air intake');
  walk(-6,-11.5);walk(-6,-14.5);walk(0,-14.5);walk(1,-9);charge(d);
 }
 walk(0,-6.5);walk(4,-6.5);walk(10.1,-6.5);walk(10.1,-4.6);walk(10.1,-4.8);game.interact();check(s.inertia.gear===1,'Ferry clutch did not engage');
 mark('inertia carries the return');d.look(game.playerPosition.clone().add({x:0,y:2,z:15}));
 until(()=>s['inertial-ferry'].progress>.995,40,'Flywheel could not move the loaded ferry');
 walk(game.cargo.position.x+.9,game.cargo.position.z);pickup();walk(10.5,6);walk(10.5,10.5);walk(16,13);until(()=>game.state==='won',4,'Both travellers did not reach the far dock');
}
