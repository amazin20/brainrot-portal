import {Workshop} from './LabWorkshopKit.js';

export const ROOM15_SPEC={id:'woven-bridges',title:'Переплетённые мосты',concept:'Маршруты над и под собой',description:'Найди проход сквозь переплетение галерей. Разрывы мостов проходятся прыжком, а белые стены связывают далёкие ярусы.',hints:['Осмотри двор с верхней площадки: мосты пересекаются на разных высотах.','На разорванных мостах есть место для разбега и широкие площадки для приземления с другом.','Большие окна открывают вид на белые стены следующей галереи. Нижний двор и лестница позволяют вернуться после промаха.'],accent:0xc6b3e7,assets:[1,2,11,22,23,24]};

export function buildRoom15(game,index=14){
 const k=new Workshop(game,ROOM15_SPEC,index);k.shell({minX:-24,maxX:24,minZ:-28,maxZ:28},20);
 const w=k.world,decks=[];
 // The court is a real traversable floor. Every elevated floor is carried by
 // edge beams and grounded piers; a missed jump returns to the visible stair.
 function deck(name,x0,x1,z0,z1,y,{rail=true}={}){
  const top=w.floor(x0,x1,z0,z1,y,{name});decks.push({name,x0,x1,z0,z1,y});
  for(const z of [z0+.22,z1-.22]){
   w.box([(x0+x1)/2,y-.40,z],[x1-x0,.44,.32]);
   if(rail){
    w.box([(x0+x1)/2,y+.77,z],[x1-x0,.075,.075]);
    for(let x=x0+.25;x<x1;x+=2.5)w.box([x,y+.36,z],[.07,.76,.07]);
   }
  }
  for(const x of [x0+.45,x1-.45])for(const z of [z0+.44,z1-.44]){
   w.box([x,(y-.48)/2,z],[.28,y-.48,.28]);
   w.box([x,.09,z],[.66,.18,.66]);
   w.box([x,y-.60,z],[.70,.34,.70]);
  }
  return top;
 }
 // First weave: broad interrupted east-west bridge, under the later gallery.
 deck('West stair landing',-22,-12,13,21.6,3,{rail:false});
 deck('Lower bridge / offset stone',-9.8,-3.3,13.5,19.5,3.35);
 deck('Lower bridge / central span',-1.1,5.4,12.5,18.5,3);
 deck('Lower bridge / east arrival',7.6,24,13,19,3);
 const stairCount=12;
 for(let n=0;n<stairCount;n++){
  const z1=27-n*.45,z0=z1-.45,y=(n+1)*.25;
  w.floor(-22,-18,z0,z1,y,{name:'Court return stair '+n});
  w.box([-20,(y-.14)/2,(z0+z1)/2],[4,y-.14,.45],w.materials.trim);
 }
 // Second weave doubles back from the north, passes over the first bridge,
 // then crosses the central court westward. The far western end is hidden
 // from the start by a large structural window, not a scripted shutter.
 deck('Eastern longitudinal gallery',14,20,-12,19,7.4,{rail:false});
 deck('Eastern window arrival',8,14,-12,-5,7.4,{rail:false});
 w.box([8.18,8.17,-8.5],[.075,.075,7]);
 for(const x of [8.5,13.5])w.box([x,8.17,-5.18],[.65,.075,.075]);
 for(const x of [14.18,19.82]){
  // Keep the crossing at z=10 open. Rail on the outer edge reads as one long
  // gallery while the inside break is an actual route into the cross bridge.
  if(x>19)w.box([x,8.17,3.5],[.075,.075,31]);
  for(const z of [-10,-5,0,5,17])w.box([x,7.8,z],[.075,.8,.075]);
 }
 deck('Middle east span',7.5,14,7,13,7.4);
 deck('Middle elevated island',-.95,5.3,7,13,7.8);
 deck('Middle west island',-9.4,-3.15,7,13,7.4);
 deck('Western window balcony',-24,-11.6,6,14,8);
 // Final weave runs across the north wall. A central lookout extends over
 // both earlier routes and makes their crossing heights legible in play.
 deck('Upper west arrival',-22,-12,-26,-19,12.4,{rail:false});
 w.box([-21.82,13.17,-22.5],[.075,.075,7]);
 for(const x of [-21,-13])w.box([x,13.17,-19.18],[1.3,.075,.075]);
 deck('Upper bridge / west stone',-9.8,-3.3,-25,-19,12.8);
 deck('Upper bridge / east stone',-1.1,5.4,-25,-19,12.4);
 deck('Upper exit gallery',7.6,22,-26,-18,12.4);
 deck('Upper longitudinal lookout',-1.1,4,-19,18,12.4,{rail:false});
 for(const x of [-.92,3.82]){
  w.box([x,13.18,0],[.075,.075,35]);
  for(let z=-17;z<18;z+=4)w.box([x,12.8,z],[.075,.8,.075]);
 }
 // Two large portal windows frame the long sightlines. Their piers/headers
 // are solid and support the ceiling; the open centre is useful room space.
 function window(x,z,width,bottom,top){
  for(const sx of [-1,1]){
   w.box([x+sx*(width/2+.45),10,z],[.9,20,.8]);
   w.box([x+sx*(width/2+.45),.16,z],[1.5,.32,1.4]);
  }
  w.box([x,(20+top)/2,z],[width,20-top,.8]);
  if(bottom>0)w.box([x,bottom/2,z],[width,bottom,.8]);
  w.box([x,top-.08,z+.43],[width+.95,.10,.06],w.materials.accent,false);
 }
 window(13,-2,15,5.4,14.8);
 window(-17,0,9,11.25,18.2);
 // A real screened bay makes the crown wall discoverable from the middle
 // gallery. The low return doorway stays open, and the final jump crosses a
 // generous six-metre opening through its side, so the enclosure is readable
 // from both sides instead of an invisible shot/use restriction.
 w.box([-23.225,11.3,0],[1.55,17.4,.8]);
 w.box([-11.05,10,0],[2.1,20,.8]);
 for(const [z,depth] of [[-26.5,3],[-9.5,19]])w.box([-10,10,z],[.5,20,depth]);
 w.box([-10,6.1,-22],[.5,12.2,6]);
 w.box([-10,18.5,-22],[.5,3,6]);
 // The bridge opening has a short side return. It prevents a diagonal shot
 // from the lower east bridge entering the upper bay through this doorway.
 w.box([-8,14.9,-19],[4,5.8,.24]);
 // Tile fields cover useful continuous walls instead of narrow preset spots.
 k.panel('weave-entry',[23.97,5.25,16],[-1,0,0],6,4.5);
 k.panel('weave-east',[11,9.65,-11.97],[0,0,1],6,4.5);
 k.panel('weave-west',[-23.97,10.25,10],[1,0,0],8,4.5);
 k.panel('weave-crown',[-17,14.65,-25.97],[0,0,1],8,4.5);
 // The remote surfaces have their own architectural backing and headers.
 for(const [x,z,y,width] of [[11,-12,7.4,6],[-17,-26,12.4,8]]){
  for(const sx of [-1,1])w.box([x+sx*(width/2+.22),y+2.4,z],[.40,4.8,.42]);
  w.box([x,y+4.85,z],[width+.8,.32,.42]);
  w.box([x,y/2,z],[width+.8,y,.42]);
 }
 // Repeated cool inlays identify the three paths without a floating arrow or
 // a chain of control panels. Lights are recessed away from tread surfaces.
 for(const [z,y] of [[16,2.58],[10,6.98],[-22,11.98]])
  for(const x of [-19,-6.5,2,11,18])w.box([x,y,z],[1.1,.05,.24],w.materials.accent,false);
 k.state.architecture={decks,returnStair:{x:-20,z:26.8},tiers:[3,7.4,12.4],jumpCount:9};
 return k.finish([-16,0,25],[-14.6,.55,24.8],[18,12.4,-22],{workshop:k,platforming:true});
}

/** Space and held directional input only: momentum is produced by the normal
 * run-up and jump, with the original companion carried throughout. */
function jump(d,fromX,fromZ,toX,toZ,landingY){
 const {game,walk,frame,worldMove,stop,wait,mark}=d;
 const dx=toX-fromX,dz=toZ-fromZ,length=Math.hypot(dx,dz),x=dx/length,z=dz/length;
 walk(fromX-x*1.8,fromZ-z*1.8);
 game.input.keys.add('ShiftLeft');
 for(let n=0;n<120;n++){
  if((game.playerPosition.x-fromX)*x+(game.playerPosition.z-fromZ)*z>=0)break;
  worldMove(x,z);frame();
 }
 game.input.keys.add('Space');game.input.jumpQueued=true;
 let airborne=false,landed=false;
 for(let n=0;n<150;n++){
  worldMove(x,z);frame();
  if(!game.playerGrounded)airborne=true;
  if(airborne&&game.playerGrounded){landed=true;break;}
 }
 stop();wait(.25);
 if(!landed||Math.abs(game.playerPosition.y-landingY)>.12)
  throw Error('Woven bridge jump missed: '+JSON.stringify({from:[fromX,fromZ],to:[toX,toZ],position:game.playerPosition.toArray(),landingY}));
 mark('jumped a broken gallery with the same friend');
}

export async function runRoom15(d){
 const {game,level,walk,pickup,aim,enter,mark,wait}=d,p=level.panels;
 function connect(entry,exit){
  game.interact();wait(.9);
  if(game.heldCube)throw Error('The friend needs a clear standing place before aiming');
  const target=p[exit].getFrame().center.clone();if(exit==='weave-crown')target.y+=1.75;
  aim(1,target);aim(0,p[entry].getFrame().center);
  const c=game.cargo.position.clone(),approach=game.playerPosition.clone().sub(c);approach.y=0;approach.normalize().multiplyScalar(1.1);
  walk(c.x+approach.x,c.z+approach.z);pickup();
 }
 walk(-14.6,25.9);pickup();walk(-16,27.3);walk(-20,27.3);walk(-20,21.3);walk(-14,16);
 jump(d,-12.55,16,-9.1,16,3.35);
 jump(d,-3.85,16,-.4,16,3);
 jump(d,4.85,16,8.3,16,3);
 walk(11,16);connect('weave-entry','weave-east');
 enter(p['weave-entry']);mark('portal reached the gallery crossing above the lower bridge');
 walk(17,-8);walk(17,10);walk(9.4,10);
 jump(d,8.05,10,4.6,10,7.8);
 jump(d,-.4,10,-3.85,10,7.4);
 jump(d,-8.85,10,-12.3,10,8);
 walk(-17,12.3);connect('weave-west','weave-crown');
 enter(p['weave-west']);mark('second portal loop reached the crown gallery');
 walk(-14,-22);
 jump(d,-12.55,-22,-9.1,-22,12.8);
 jump(d,-3.85,-22,-.4,-22,12.4);
 jump(d,4.85,-22,8.3,-22,12.4);
 walk(18,-22);
 if(game.state!=='won')d.until(()=>game.state==='won',3,'Crown exit did not receive the pair');
}
