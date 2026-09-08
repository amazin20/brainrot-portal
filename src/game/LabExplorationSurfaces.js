/** Authored additional portal areas, not marked solution slots. Every rectangle
 * is one continuous collider: seams do not snap, reject or recenter a shot.
 * Areas remain on their side of a physical challenge; safe-return surfaces
 * lead back into the room rather than to an invisible progress checkpoint. */
export function addExplorationSurfaces(game,level,index){
 const world=level.world,added=[];
 const wall=(name,position,normal,width,height=4.6)=>{
  const area=world.surface({name,position,normal,width,height,portal:true});
  level.panels[name]=area;added.push(area);return area;
 };
 if(index===0){
  wall('arrival-wall',[5.76,2.3,-9],[ -1,0,0],9);
  wall('start-wall',[5.76,2.3,9],[-1,0,0],10);
  wall('start-end',[0,2.3,14.76],[0,0,-1],11.3);
  wall('lower-return',[-5.76,-.7,0],[1,0,0],7.4,4.5);
 }else if(index===1){
  wall('weight-lab-left',[-7.76,2.3,9.6],[1,0,0],11.2);
  wall('weight-lab-right',[7.76,2.3,9.6],[-1,0,0],11.2);
  wall('weight-lab-end',[0,2.3,15.76],[0,0,-1],15.1);
 }else if(index===2){
  wall('balcony-ceramic',[0,7.3,13.76],[0,0,-1],5.7);
  wall('lower-work-wall',[6.76,2.3,7],[-1,0,0],12);
  wall('stair-work-wall',[-6.76,3.4,9],[1,0,0],7.5,6.3);
 }else if(index===3){
  wall('lift-lab-right',[5.76,2.3,8],[-1,0,0],12);
  wall('lift-lab-end',[0,2.3,14.76],[0,0,-1],11.3);
 }else if(index===4){
  wall('angle-workshop-wall',[-10.76,7.3,-5],[1,0,0],9);
  wall('angle-low-wall',[-10.76,2.3,5],[1,0,0],7.5);
  wall('angle-end-wall',[-6.8,7.3,-9.76],[0,0,1],7.3);
 }else if(index===5){
  wall('optical-workbench-wall',[-11.76,2.3,4],[1,0,0],5.2);
  wall('optical-front-wall',[0,2.3,12.76],[0,0,-1],22.8);
  wall('optical-side-wall',[11.76,2.3,-4.8],[-1,0,0],13.3);
 }else if(index===6){
  wall('balance-work-wall',[13.97,2.3,10],[-1,0,0],8);
  wall('balance-low-return',[13.97,2.3,-9],[-1,0,0],10);
  wall('balance-tower-return',[-10.15,2.3,-17.77],[0,0,1],8);
 }else if(index===7){
  wall('pneumatic-front-wall',[0,2.3,12.76],[0,0,-1],18.8);
  wall('pneumatic-low-wall',[-9.76,2.3,-6],[1,0,0],12.5);
  wall('pneumatic-right-wall',[9.76,2.3,-4],[-1,0,0],12.5);
 }else if(index===8){
  wall('loading-hall-wall',[-12.76,3.3,8],[1,0,0],10.5);
  wall('loading-hall-front',[0,2.3,13.76],[0,0,-1],24.8);
  wall('loading-service-wall',[12.76,2.3,-3],[-1,0,0],17.5);
 }else if(index===9){
  // Continuous lower-to-upper ceramic is visible from both the pit and ring.
  // The player can invent a return pair after falling, with no prior setup.
  wall('vault-west-return',[-14.76,1.8,0],[1,0,0],28.8,12);
  wall('vault-east-return',[14.86,1.8,0],[-1,0,0],28.8,12);
  wall('vault-front-return',[0,1.8,14.76],[0,0,-1],28.8,12);
 }
 level.explorationSurfaces=added;
 return level;
}
