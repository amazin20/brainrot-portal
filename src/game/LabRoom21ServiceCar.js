import * as THREE from 'three';

/** A small passenger deck shares the cassette's counterweight and brake.
 * The service lever holds both decks at their low position while the freight
 * is retrieved. Boarding with the freight trips a visible floor contact,
 * releasing the same brake; there is no stored puzzle stage or second motor. */
export function buildRoom21ServiceCar(k,cassette,seat){
 const g=k.game,w=k.world,group=new THREE.Group();group.position.set(25,7,-8);w.root.add(group);
 const surface=w.surface({name:'Counterweight service car',position:[0,0,0],normal:[0,1,0],width:3.2,height:4,parent:group,moving:true});
 const floor={minX:23.4,maxX:26.6,minZ:-10,maxZ:-6,y:7,mesh:surface.mesh,enabled:true};g.floors.push(floor);w.floors.push(floor);
 w.box([0,-.28,0],[3.2,.48,4],w.materials.trim,false,group);
 const backing=g.colliders.find(c=>c.mesh===surface.backing);if(backing)backing.kinematic=true;
 for(const x of [23.22,26.78])w.box([x,12.5,-8],[.16,12,4.3],w.materials.trim,false);
 w.box([7.5,25,-8],[36,.18,.18],w.materials.trim,false);
 const state={surface,floor,contact:false,update(dt){
  const old=floor.y,p=g.playerPosition;
  const aboard=g.playerGrounded&&Math.abs(p.y-old)<.22&&p.x>floor.minX+.15&&p.x<floor.maxX-.15&&p.z>floor.minZ+.15&&p.z<floor.maxZ-.15;
  state.contact=Boolean(aboard&&g.heldCube);
  if(cassette.braked&&state.contact&&!seat.loaded())cassette.toggleBrake();
  const y=7+(cassette.height-cassette.low)/(cassette.high-cassette.low)*11;
  if(aboard){p.y+=y-old;g.previousPlayerPosition.y+=y-old;}
  group.position.y=y;floor.y=y;group.updateWorldMatrix(true,true);
  for(const c of [surface.collider,backing].filter(Boolean)){c.box.setFromObject(c.mesh);g.physics?.updateStaticBox(c.mesh.uuid,c.box,dt);}
 },reset(){state.contact=false;state.update(0);}};
 k.ticks.push(dt=>state.update(dt));k.resets.push(()=>state.reset());k.state.serviceCar=state;
 k.control('service-hold',[19.8,7,-12.7],()=>{if(!cassette.braked)cassette.toggleBrake();},
  'Сервисный тормоз: удержать связанную пассажирскую платформу внизу, пока достаёшь друга.');
 return state;
}
