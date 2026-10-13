import * as THREE from 'three';
import {LabPhysics} from '../../src/game/LabPhysics.js';
import {buildRoom23PhysicalMachine} from '../../src/game/LabRoom23PhysicalMachine.js';

/** Actual Cannon component fixture. Initial bodies are declared explicitly;
 * this is not the normal Play spawn or evidence of a complete ordinary route. */
export function room23PhysicalFixture({cargoSide='east',passengerSide='west',cargo=true,initialDisplacement=0}={}){
 const scene=new THREE.Scene(),material=new THREE.MeshStandardMaterial();
 const game={physics:new LabPhysics(),scene,colliders:[],cameraBlockers:[],aimBlockers:[],floors:[],portalPanels:[],heldCube:null,yaw:0,facing:0,
  playerPosition:new THREE.Vector3(),playerVelocity:new THREE.Vector3(),playerGrounded:false,
  input:{keys:new Set(),mobileSprint:false,getMove:()=>new THREE.Vector2(),consumeJump:()=>false},updatePlayer(){},
  portalOpensCollider:()=>false,colliderForId(id){return this.colliders.find(c=>c.mesh.uuid===id);}};
 const westY=initialDisplacement,eastY=20-initialDisplacement;
 const cargoPosition=cargo?(cargoSide==='east'?[1.1,eastY+.61,3]:[-1.1,westY+.61,3]):[-20,.6,15];
 game.physics.createCargo({position:cargoPosition});game.cargo={position:new THREE.Vector3(...cargoPosition)};
 const box=(p,s,mat=material,solid=false,parent=scene)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...s),mat);mesh.position.fromArray(p);parent.add(mesh);return mesh;};
 const k={game,world:{root:scene,box,floors:[],materials:{trim:material}},state:{},resets:[],ticks:[],panels:{},
  panel(name,p,n,width,height,parent=scene){
   const group=new THREE.Group();group.position.fromArray(p);parent.add(group);
   const mesh=box([0,-.1,0],[width,.2,height],material,false,group),backing=box([0,-.105,0],[width,.08,height],material,false,group);mesh.visible=false;mesh.userData.collisionProxy=true;
   group.updateWorldMatrix(true,true);
   const collider={mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true};game.colliders.push(collider);
   game.colliders.push({mesh:backing,box:new THREE.Box3().setFromObject(backing),enabled:true});
   const record={group,mesh,backing,collider,getFrame(){group.updateWorldMatrix(true,true);return{center:group.getWorldPosition(new THREE.Vector3()),normal:new THREE.Vector3(0,1,0),halfWidth:width/2,halfHeight:height/2};}};
   this.panels[name]=record;return record;
  }};
 const spawn=passengerSide==='west'?[-3.1,westY,3]:passengerSide==='east'?[3.1,eastY,3]:[-17,0,15];
 const machine=buildRoom23PhysicalMachine(k,{spawn,initialDisplacement});game.firstLevel={balance:machine};machine.ensure();
 const original=game.physics.cargoBody,shape=original.shapes[0];
 function step(seconds,observe=()=>{}){for(let n=0;n<Math.ceil(seconds*120);n++){game.updatePlayer(1/120);game.physics.step(1/120);observe(machine.diagnostics());}}
 function dispose(){machine.dispose();game.physics.dispose();}
 return{game,machine,step,dispose,original,shape,scope:'actual initialized Cannon component fixture; not ordinary Play route'};
}
