import * as THREE from 'three';

const V=(x,y,z)=>new THREE.Vector3(x,y,z);

/** The last room folds back above itself. Its finish cannot be reached by
 * walking in from the gallery: a floor intake sends both travellers through
 * an elevated wall outlet onto a narrow upper landing. From there the player
 * must replace the pair and climb again to the suspended receiver. */
export function buildTowerCrown({game,owner,floor,box,materials,y=40}){
 const {shell,portal,step,dark,mint}=materials;
 const deck=(x0,x1,z0,z1,height,material)=>floor(owner,x0,x1,z0,z1,y+height,material);
 // Break the lower deck around one genuine portal-backed floor tile. No
 // coincident duplicate floor may catch a traveller underneath its aperture.
 deck(11,21,29.7,36.8,0);
 deck(11,11.35,24,29.7,0);deck(16.65,21,24,29.7,0);
 deck(11.35,16.65,24,24.35,0);deck(11.35,16.65,29.65,29.7,0);
 const intake=deck(11.35,16.65,24.35,29.65,0,portal);
 intake.name='Tower crown / lower floor intake';
 game.markPortalSurface(intake,V(14,y+.005,27),V(0,1,0),2.65,2.65);
 intake.userData.portalColliderId=intake.uuid;intake.userData.towerCrown='intake';

 // The wall is backed by a collidable body and faces the chamber's lower
 // court. The upper deck begins beyond the outlet, so a normal exit lands on
 // a physical support rather than floating in empty space.
 const middle=deck(16.55,21,31.05,36.65,4.2,portal);
 middle.name='Tower crown / middle floor intake';
 game.markPortalSurface(middle,V(18.75,y+4.205,34.35),V(0,1,0),2.2,2.7);
 middle.userData.portalColliderId=middle.uuid;middle.userData.towerCrown='middle-intake';
 const outlet=box(owner,[15.48,y+5.76,32.4],[.32,3.76,4.65],portal);
 outlet.name='Tower crown / upper wall outlet';
 game.markPortalSurface(outlet,V(15.65,y+5.78,32.4),V(1,0,0),2.2,1.82);
 outlet.userData.portalColliderId=outlet.uuid;outlet.userData.towerCrown='outlet';
 deck(16.55,21,24.2,30.45,8.4,step);
 const finalOutlet=box(owner,[15.48,y+10.08,28.1],[.32,3.76,4.65],portal);
 finalOutlet.name='Tower crown / upper wall outlet';
 game.markPortalSurface(finalOutlet,V(15.65,y+10.08,28.1),V(1,0,0),2.2,1.82);
 finalOutlet.userData.portalColliderId=finalOutlet.uuid;finalOutlet.userData.towerCrown='final-outlet';
 // A real guard and threshold reveal the two elevations from below. These
 // pieces stop below the portal's lower edge and never block its aperture.
 box(owner,[20.65,y+4.8,33.9],[.25,1.1,5.35],shell);
 // The first landing has an actual low front curb: a released companion can
 // settle here while both portal colours are retargeted above it.
 box(owner,[18.68,y+4.5,31.16],[4.15,.6,.2],dark);
 box(owner,[20.65,y+9,27.3],[.25,1.1,5.8],shell);
 box(owner,[18.5,y+8.43,27.7],[2.7,.045,2.7],dark,{solid:false,camera:false,aim:false});
 box(owner,[18.5,y+8.48,27.7],[2.12,.045,2.12],mint,{solid:false,camera:false,aim:false});
 const goal=V(18.5,y+8.4,27.7);
 let crossings=0;
 return {
  panels:[intake,outlet,middle,finalOutlet],goal,
  get crossings(){return crossings;},reset(){crossings=0;},
  onTeleport(entry,exit,keystoneSolved){
   if(keystoneSolved&&((entry?.surfaceId===intake.uuid&&exit?.surfaceId===outlet.uuid)
    ||(entry?.surfaceId===middle.uuid&&exit?.surfaceId===finalOutlet.uuid)))crossings++;
  },
  containsGoal(player,cargo,grounded){
   return grounded&&Math.abs(player.y-goal.y)<.35
    &&Math.hypot(player.x-goal.x,player.z-goal.z)<1.15&&cargo.distanceTo(player)<3.2;
  },
 };
}

/** An ordinary controller route, with both shots and a physical crossing.
 * The walk into the floor aperture is handled by Journey as a held movement
 * input, ending only after the game's real portal transport callback. */
export function towerCrownRoute(){
 const walk=(x,z,y=40,extra={})=>({kind:'walk',target:[x,y,z],...extra});
 return Object.freeze([
  walk(0,7),walk(8,7),walk(8,34,40,{timeout:45}),
  walk(11.1,34.3),walk(14,34.3),walk(14,32),
  {kind:'drop'},walk(14.8,32),{kind:'shoot',slot:0,aim:[14,40.005,27]},
  walk(18.1,26.1),{kind:'shoot',slot:1,aim:[15.65,45.78,32.4]},
  walk(14.8,32),{kind:'pickup'},
  {kind:'floorEnter',target:[14,40,27],approach:[14,40,30.4],seconds:5},
  walk(18.2,32.2,44.2,{timeout:15}),walk(19.3,32.2,44.2),
  {kind:'drop'},walk(17.05,32.2,44.2),
  {kind:'shoot',slot:0,aim:[18.75,44.205,34.35]},
  {kind:'shoot',slot:1,aim:[15.65,50.08,28.1]},
  walk(19.6,32.2,44.2),{kind:'pickup'},
  walk(17.05,32.2,44.2),walk(17.05,31.65,44.2),
  {kind:'floorEnter',target:[18.75,44.2,34.35],approach:[18.75,44.2,31.65],seconds:5},
  walk(18.5,27.7,48.4,{timeout:15}),
 ]);
}
