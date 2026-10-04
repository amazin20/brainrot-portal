import * as THREE from 'three';
import {Body,Box,Vec3,Material} from 'cannon-es';
import {ResearchChamber} from './LabResearchArt.js';
import {gate} from './LabPuzzleMechanics.js';
import {lateShutter,movingMechanismBlock} from './LabLateCampaignMechanisms.js';
const V=(...p)=>new THREE.Vector3(...p);

/** An inverse spring: the observer supplies the compression before the
 * companion is loaded. Release applies stored elastic force to a real guided
 * piston; its contact launches the same original rigid cargo body. */
export function buildInverseSpring(g,index,spec){
 const k=new ResearchChamber(g,spec,index,'kinetic',{minX:-27,maxX:27,minZ:-26,maxZ:25},-3,16);
 k.deck('West spring inspection promenade',-26,-14,-24,24,0);k.deck('East spring inspection promenade',-2,26,-24,24,0);k.deck('South spring loading court',-14,-2,12,24,0);k.deck('North spring receiver court',-14,-2,-24,0,0);
 k.block([0,-1.5,-8],[54,3,.65],'dark');
 const centre=V(-8,.65,6),size=V(12,.22,12);
 const plate=movingMechanismBlock(k,'Weight-compressed spring bed',centre.toArray(),size.toArray());
 const collider=g.collisionProxy(new THREE.Box3().setFromObject(plate),{kinematic:true});
 const floor={minX:-14,maxX:-2,minZ:0,maxZ:12,y:.76,mesh:plate,enabled:true};g.floors.push(floor);
 const spring={owner:null,body:null,floor,compression:0,held:false,holdY:centre.y,
  ensure(){if(!g.physics||this.owner===g.physics)return;this.owner=g.physics;g.physics.removeStaticBox(collider.mesh.uuid);this.body=new Body({mass:4,position:new Vec3(...centre.toArray()),shape:new Box(new Vec3(6,.11,6)),linearFactor:new Vec3(0,1,0),fixedRotation:true,linearDamping:0,material:new Material({friction:.70,restitution:0}),collisionFilterGroup:1,collisionFilterMask:2});g.physics.world.addBody(this.body);},
  sync(dt=0){const oldY=floor.y,p=g.playerPosition,wasOn=g.playerGrounded&&Math.abs(p.y-oldY)<.18&&p.x>floor.minX&&p.x<floor.maxX&&p.z>floor.minZ&&p.z<floor.maxZ;if(this.body)plate.position.y=this.body.position.y;const dy=plate.position.y+.11-oldY;if(dt&&wasOn){p.y+=dy;g.previousPlayerPosition.y+=dy;}plate.updateWorldMatrix(true,false);collider.mesh.position.copy(plate.position);collider.mesh.updateWorldMatrix(true,false);collider.box.setFromObject(plate);floor.y=plate.position.y+.11;this.compression=Math.max(0,centre.y-plate.position.y);},
  forces(){this.ensure();const b=this.body;if(this.held){b.type=Body.STATIC;b.position.y=this.holdY;b.velocity.setZero();b.force.setZero();return;}b.type=Body.DYNAMIC;const c=Math.max(0,centre.y-b.position.y),onBed=g.playerGrounded&&Math.abs(g.playerPosition.y-floor.y)<.15&&g.playerPosition.x>floor.minX&&g.playerPosition.x<floor.maxX&&g.playerPosition.z>floor.minZ&&g.playerPosition.z<floor.maxZ;
   if(onBed||c>.001)b.wakeUp();b.force.y+=b.mass*19.5+c*2400-b.velocity.y*(onBed?100:.3)-(onBed?90*19.5:0);
   if(b.position.y>centre.y){b.position.y=centre.y;b.velocity.y=Math.min(0,b.velocity.y);}if(b.position.y<centre.y-.85){b.position.y=centre.y-.85;b.velocity.y=Math.max(0,b.velocity.y);}
  },clamp(){if(this.compression>.6){this.held=true;this.holdY=this.body.position.y;this.body.type=Body.STATIC;this.body.velocity.setZero();}},release(){const loaded=this.loaded();this.held=false;this.body.type=Body.DYNAMIC;this.body.wakeUp();if(loaded)g.physics.cargoBody.wakeUp();},
  loaded(){const c=g.cargo.position;return !g.heldCube&&g.physics?.grounded&&Math.abs(c.y-.39-floor.y)<.15&&c.x>floor.minX&&c.x<floor.maxX&&c.z>floor.minZ&&c.z<floor.maxZ;},
  reset(){this.ensure();this.held=false;this.compression=0;this.holdY=centre.y;this.body.type=Body.DYNAMIC;this.body.position.copy(new Vec3(...centre.toArray()));this.body.velocity.setZero();this.body.force.setZero();this.sync();}
 };
 k.block([-8,-2.75,6],[10,.35,10],'dark');
 for(const x of [-12.5,-3.5])for(const z of [1.5,10.5]){
  k.block([x,-2.5,z],[.8,.4,.8],'metal');
  const coils=new THREE.Group();coils.position.set(x,-2.65,z);k.world.root.add(coils);
  for(let ring=0;ring<7;ring++)k.geometry(new THREE.TorusGeometry(.36,.075,6,16),'metal',[0,ring*3.19/6,0],new THREE.Quaternion().setFromAxisAngle(V(1,0,0),Math.PI/2),{parent:coils,batch:false,name:'Elastic coil under the real bed'});
  k.renders.push(()=>{coils.scale.y=Math.max(.15,(plate.position.y-.11+2.65)/3.19);});
 }
 k.control('spring-clamp',[-.5,0,6],()=>spring.clamp(),'E — зажать пружину под собственным весом.');
 k.control('spring-release',[5,0,6],()=>spring.release(),'E — отпустить сжатую пружину снаружи ложа.');
 const ceiling=k.panel('spring-ceiling',[-8,5.0,6],[0,-1,0],6,6);ceiling.mesh.userData.portalSize={width:1.4,height:.65};
 const mouth=k.panel('spring-catcher-mouth',[-22,1.05,-17],[1,0,0],4,2.3);mouth.mesh.userData.portalSize={width:1.4,height:.65};
 const catcher=k.loadPad('spring-weight-catcher',[-18,0,-17],8);
 // The cargo-height address and narrow charge slots exclude the observer. The stop wall catches the
 // launched rigid body on the weight plate; all glassless observation slots
 // are narrow manufactured openings in the actual envelope.
 k.block([-18,3.0,-17],[9,.24,5],'shell');
 k.block([-14,1,-17],[.5,2,5],'secondary');
 k.block([-18,7,-19.5],[9,14,.4],'shell');
 const cover=lateShutter(k,'Spring catcher inspection main leaf',[-16.5,7,-14.5],[6,14,.4],[0,16,0]);
 const coverPieces=[lateShutter(k,'Spring catcher optical lower cheek',[-21,.375,-14.5],[3,.75,.4],[0,16,0]),lateShutter(k,'Spring catcher optical upper cheek',[-21,7.725,-14.5],[3,12.55,.4],[0,16,0])];
 const surface=k.world.surface;
 k.world.surface=options=>{if(options.name==='Sealed partition'&&options.position[0]<-2.4){if(options.normal[2]>0)for(const [x0,x1,y0,y1]of [[-27,-17,0,16],[-13,-2.4,0,16],[-17,-13,0,.83],[-17,-13,1.41,16]])k.block([(x0+x1)/2,(y0+y1)/2,-8],[x1-x0,y1-y0,.65],'shell');return null;}return surface(options);};
 const door=gate(k.world,-8,54,16);k.world.surface=surface;let secured=false;
 k.control('spring-receiver-ratchet',[7,0,-13],()=>{if(door.progress>.9)secured=true;},'E — удержать открытую грузом дверь.');
 k.state.spring=spring;
 k.ticks.unshift(dt=>spring.sync(dt));k.forces.push(()=>spring.forces());
 k.ticks.push(dt=>{door.update(catcher.loaded()||secured,dt,k.time);for(const leaf of [cover,...coverPieces]){leaf.target=secured;leaf.update(dt);}});
 k.resets.push(()=>{spring.reset();secured=false;door.reset();});k.renders.push(a=>door.render(a,k.time));
 k.display([0,12,-25.2],()=>`ПРУЖИНА ${(spring.compression*100).toFixed(0)} см / ${spring.held?'ЗАЖАТА':'СВОБОДНА'}\nПРИЁМНИК ${catcher.loaded()?'ВЕС ДРУГА':'ПУСТО'}`,25,2);
 k.label('33 / ОБРАТНАЯ ПРУЖИНА',[0,14,24.2],[0,0,-1],24,1.1);
 const l=k.finishResearch([-14,0,20],[-18,.6,17],[0,0,-21],{postCampaign:true,spring,catcher,ceiling,mouth,door,cover,getSecured:()=>secured,spawnView:{yaw:.1,pitch:-.06}});
 l.puzzleGeometry={noProgressFlags:true,recoveryFloor:-3,portalRoles:{'spring-ceiling':'redirect elastic energy supplied by the observer','spring-catcher-mouth':'receive the actual small rigid body beyond the closed partition'},orders:['charge-then-load','aim-before-charge'],deductions:['the observer supplies compression before cargo loading','a mechanical clamp stores actual elastic displacement','spring contact creates upward cargo momentum','a cargo-height aperture excludes the observer','the receiver uses actual retained body weight']};
 const dispose=l.dispose;l.dispose=()=>{if(spring.body&&spring.owner?.world)spring.owner.world.removeBody(spring.body);dispose();};return l;
}
