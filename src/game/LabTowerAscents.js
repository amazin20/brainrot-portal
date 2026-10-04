/** The five climbs share an exterior shaft, but their supporting surfaces,
 * height profiles and required turns are individually authored. All dimensions
 * below are world-space metres relative to the current deck; no actor is moved
 * by the level. The ascending floor colliders carry both travellers normally.
 */
export const TOWER_ASCENT_NAMES=Object.freeze([
 'offset exchange','double-back gallery','broken bridge','cross flights','return loop',
]);

export function buildTowerAscent(deck,y,{owner,floor,box,materials:m}){
 if(!Number.isInteger(deck)||deck<0||deck>=5)throw new RangeError(`Invalid tower ascent ${deck}`);
 const path=[];
 const mark=(x,z,h)=>path.push(Object.freeze([x,y+h,z]));
 const slab=(x0,x1,z0,z1,h,material=m.step)=>floor(owner,x0,x1,z0,z1,y+h,material);
 const run=(start,end,h0,h1,count,width)=>{
  const [x0,z0]=start,[x1,z1]=end,alongX=Math.abs(x1-x0)>Math.abs(z1-z0);
  if(alongX&&Math.abs(z1-z0)>.01||!alongX&&Math.abs(x1-x0)>.01)
   throw new Error('Tower stair flights must be axis aligned');
  for(let i=0;i<count;i++){
   const a=i/count,b=(i+1)/count;
   const from=alongX?x0+(x1-x0)*a:z0+(z1-z0)*a;
   const to=alongX?x0+(x1-x0)*b:z0+(z1-z0)*b;
   const h=h0+(h1-h0)*b;
   if(alongX)slab(Math.min(from,to),Math.max(from,to),z0-width/2,z0+width/2,h,i%2?m.step:m.floor);
   else slab(x0-width/2,x0+width/2,Math.min(from,to),Math.max(from,to),h,i%2?m.step:m.floor);
  }
 };
 const side=()=>{
  for(const x of [-4.25,4.25])box(owner,[x,y+4,21.9],[.30,8,22.5],m.shell);
 };
 switch(deck){
  case 0:{
   // A low east flight meets a transverse exchange shelf. The high west
   // flight has no support at its lower end unless the shelf is reached.
   run([2.25,11.2],[2.25,21.2],0,3.5,14,3.5);
   slab(-4,4,20.8,23.0,3.5);
   run([-2.25,23],[-2.25,35.2],3.5,8,18,3.5);
   mark(2.25,10.9,0);mark(2.25,20.9,3.5);mark(-2.25,22.2,3.5);mark(-2.25,34.8,8);
   break;
  }
  case 1:{
   // A full double-back: ascend west, cross the raised turntable, descend
   // *in z only* on the east flight while continuing upward, cross overhead,
   // then use the west gallery to reach the existing upper return corridor.
   run([-2.25,11.2],[-2.25,32.6],0,4,16,3.5);
   slab(-4,4,32.2,35.2,4);
   // The next deck's broken bridge occupies the middle of this shared
   // shaft. Keep this high return in the outer aisle with upright clearance.
   // It meets an overhead traverse at z=23; the next deck's own stair is
   // already high enough there to leave a full-height crossing underneath.
   run([3.05,32.2],[3.05,23.4],4,8,16,1.65);
   slab(-4,4,22.4,23.4,8);
   slab(-4,-.5,23.4,35.2,8);
   mark(-2.25,10.9,0);mark(-2.25,32.6,4);mark(3.05,33.5,4);
   mark(3.05,23.2,8);mark(-2.25,23.0,8);mark(-2.25,34.8,8);
   break;
  }
  case 2:{
   // Two missing spans require actual jumps. There is no invisible floor or
   // trigger across either void. Eight risers per section, each 1/3 m high.
   const edges=[[11.2,18.1],[19.9,26.8],[28.6,35.2]];
   for(let i=0;i<3;i++)run([0,edges[i][0]],[0,edges[i][1]],i*8/3,(i+1)*8/3,8,3.6);
   mark(0,10.9,0);mark(0,17.85,8/3);mark(0,20.4,3.05);
   mark(0,26.55,16/3);mark(0,29.1,5.72);mark(0,34.8,8);
   break;
  }
  case 3:{
   // Alternating longitudinal and transverse flights. The side-to-side
   // risers themselves gain height, so the two turns cannot be cut diagonally.
   run([-2.25,11.2],[-2.25,18.8],0,2.4,8,3.5);
   slab(-4,-.5,18.8,19.8,2.4);
   run([-2.25,19.25],[2.25,19.25],2.4,4,5,1.8);
   slab(.5,4,19.25,20.5,4);
   run([2.25,20.5],[2.25,28.1],4,6.4,8,3.5);
   slab(.5,4,28.1,29.1,6.4);
   run([2.25,28.55],[-2.25,28.55],6.4,8,5,1.8);
   slab(-4,-.5,28.55,35.2,8);
   mark(-2.25,10.9,0);mark(-2.25,19.1,2.4);mark(2.25,19.25,4);
   mark(2.25,28.4,6.4);mark(-2.25,28.55,8);mark(-2.25,34.8,8);
   break;
  }
  case 4:{
   // The climb loops around its own open middle. The west return rises toward
   // the *entrance*, then the overhead bridge doubles east and finally north.
   // Lower and upper surfaces are separated by more than head clearance.
   run([2.25,11.2],[2.25,20.0],0,2.4,8,3.5);
   slab(.5,4,19.5,20.8,2.4);
   run([2.25,20.1],[-2.25,20.1],2.4,4,5,1.8);
   slab(-4,-.5,19.5,20.7,4);
   run([-2.25,19.5],[-2.25,13.0],4,5.6,5,3.5);
   slab(-4,-.5,12.0,13.8,5.6);
   run([-2.25,13.0],[2.25,13.0],5.6,7.2,5,1.8);
   run([2.25,13.0],[2.25,15.4],7.2,8,3,3.5);
   slab(.5,4,15.4,35.2,8);
   mark(2.25,10.9,0);mark(2.25,19.8,2.4);mark(-2.25,20.1,4);
   mark(-2.25,13.1,5.6);mark(2.25,13.0,7.2);mark(2.25,15.5,8);mark(2.25,34.8,8);
   break;
  }
 }
 side();
 return Object.freeze({name:TOWER_ASCENT_NAMES[deck],path:Object.freeze(path)});
}

export function towerAscentRoute(deck,baseY,path){
 if(deck>=5)return Object.freeze([]);
 const walk=(target,extra={})=>Object.freeze({kind:'walk',target,...extra});
 const actions=[walk([0,baseY,7]),walk([0,baseY,10.2])];
 for(let i=0;i<path.length;i++){
  if(deck===2&&(i===2||i===4))actions.push(Object.freeze({kind:'jump'}));
  actions.push(walk(path[i],{timeout:55,tolerance:deck===2&&[1,3].includes(i)?.3:.35}));
 }
 actions.push(walk([8,baseY+8,35.7]),walk([8,baseY+8,8]),walk([0,baseY+8,0]));
 return Object.freeze(actions);
}
