import * as THREE from 'three';
import {Body,Box,Vec3,Material} from 'cannon-es';
import {ResearchChamber} from './LabResearchArt.js';
import {cargoOccludes,movingMechanismBlock} from './LabLateCampaignMechanisms.js';

const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
export const CREATIVE_COUNTERWEIGHT_SPEC=Object.freeze({
 id:'post-pneumatic-reservoir',title:'Пневмоаккумулятор',
 concept:'Свободный спутник перекрывает настоящую утечку в низком воздуховоде. Сжатый воздух накапливается, затем открывает общую дверь и выталкивает тот же груз на другой берег.',
 description:'Посади друга перед утечкой и дождись давления. Переключи распределитель на выдачу: запас воздуха откроет дверь, а друг пройдёт по низкому грузовому рукаву. Забери его на дальнем полу.',
 accent:0xa0e4d2,assets:[1,2,11,22,23,24],
 hints:['Белый пол отправляет свободного друга в низкий воздуховод. Узкое седло пропускает воздух, но корпус друга закрывает его геометрию.',
 'Давление растёт только при перекрытой утечке. Распределитель переводит запас на дверь и поднимает седло: поток выталкивает друга вперёд.',
 'Давление расходуется после выдачи. Пройди дверь и забери друга на дальнем полу. Третье положение распределителя возвращает неудачно отправленный груз; затем можно повторить заряд.'],
});

function movingPart(k,name,p,size){
 const mesh=movingMechanismBlock(k,name,p,size);
 const collider=k.game.collisionProxy(new THREE.Box3().setFromObject(mesh),{kinematic:true});
 const start=V(...p);
 return {mesh,collider,move(height,dt){mesh.position.copy(start);mesh.position.y+=height;mesh.updateWorldMatrix(true,false);k.game.syncCollision(collider,new THREE.Box3().setFromObject(mesh),dt);}};
}

/** Pressure is a continuously leaking physical store. The valve has three
 * manually selected plumbing paths; it never records a completed objective.
 * Its door is an actual guided dynamic body driven by pressure force. */
export function buildCreative34(g,index=33){
 const k=new ResearchChamber(g,CREATIVE_COUNTERWEIGHT_SPEC,index,'current',{minX:-27,maxX:27,minZ:-26,maxZ:26},0,16);
 const dispatch=k.loadPad('pressure-feed',[-9,0,16],8);
 const inlet=k.panel('pressure-mouth',[-19,.95,6.5],[1,0,0],4,2.1);
 inlet.mesh.userData.portalSize={width:.95,height:.65};
 // A continuous low freight sleeve crosses the same full-height partition
 // as the human door. The pipe, its roof and every side are actual volumes.
 k.block([-18.3,.75,-5.55],[.35,1.5,20.6],'shell');
 k.block([-17,1.62,-5.55],[2.95,.25,20.6],'shell');
 // The head is wide enough for the actual rigid cargo, with a low aiming
 // window on the east. A human capsule cannot pass through its 2.05 m height.
 k.block([-19.5,1.175,6.5],[.35,2.35,2.9],'shell');
 k.block([-17.5,1.175,8],[4.3,2.35,.3],'shell');
 k.block([-17.5,2.475,6.6],[4.3,.25,2.5],'shell');
 // A shorter continuous side reaches the end of the roofed trunk.
 k.block([-15.7,.75,-5.55],[.35,1.5,20.6],'shell');
 k.block([-15.7,-.075,6.5],[.35,.15,2.7],'metal');
 k.block([-15.7,2.175,6.5],[.35,.25,2.7],'metal');
 // One partition, one human opening, one separate cargo-height aperture.
 for(const [a,b]of [[-27,-18.48],[-15.52,-2.7],[2.7,27]])k.block([(a+b)/2,8,-8],[b-a,16,.65],'shell');
 k.block([-17,8.85,-8],[2.96,14.3,.65],'shell');
 k.block([0,10.2,-8],[5.4,11.6,.65],'dark');
 // Four manufactured jaws leave a real .66 m air aperture. Cargo .78 m
 // closes it by occlusion; no pad name or distance-based load key is used.
 const seat=[];
 for(const [p,s]of [
  [[-17,.055,2],[2.6,.11,.24]], [[-17,1.115,2],[2.6,.67,.24]],
  [[-17.815,.44,2],[.97,.66,.24]], [[-16.185,.44,2],[.97,.66,.24]],
 ])seat.push(movingPart(k,'Pneumatic vent seat',p,s));
 k.block([-17,3.6,2],[3.2,.3,1.3],'dark');
 for(const x of [-18.5,-15.5])k.block([x,2.55,2],[.16,2.4,.32],'metal');
 const doorMesh=movingMechanismBlock(k,'Pressure-driven guided door',[0,2.2,-8],[5.4,4.4,.7]);
 const doorCollider=g.collisionProxy(new THREE.Box3().setFromObject(doorMesh),{kinematic:true});
 for(const y of [0,4.4])k.block([3.4,y,-8],[13,.18,1.1],'metal');
 const state={mode:0,pressure:0,coverage:0,seatTravel:0,doorBody:null,owner:null,doorTravel:0,
  ensure(){if(!g.physics||this.owner===g.physics)return;this.owner=g.physics;g.physics.removeStaticBox(doorCollider.mesh.uuid);
   this.doorBody=new Body({mass:80,position:new Vec3(0,2.2,-8),shape:new Box(new Vec3(2.7,2.2,.35)),fixedRotation:true,linearFactor:new Vec3(1,0,0),linearDamping:.04,material:new Material({friction:.45,restitution:.02}),collisionFilterGroup:1,collisionFilterMask:2});g.physics.world.addBody(this.doorBody);
  },forces(){this.ensure();const body=this.doorBody;if(!body)return;
   if(body.position.x<0){body.position.x=0;body.velocity.x=Math.max(0,body.velocity.x);}
   if(body.position.x>6.4){body.position.x=6.4;body.velocity.x=Math.min(0,body.velocity.x);}
   body.force.y+=body.mass*19.5;
   body.force.x+=(this.mode===1?this.pressure*8:0)-body.position.x*60-body.velocity.x*120;body.wakeUp();
   const c=g.physics.cargoBody;if(!c||g.heldCube)return;
   // Curved inlet and outlet plenum guide a drag field inside the real tube.
   // Wall contacts, rather than position assignments, make both turns.
   const reverse=this.mode===2;
   const inside=c.position.x>(reverse?-20:-19.3)&&c.position.x<(reverse?-14:-15.3)&&c.position.z<7.9&&c.position.z>(reverse?-24:-17.5)&&c.position.y<1.55;
   if(!inside)return;
   const speed=reverse?5:(this.mode===1?8:3.6);
   let ax=-(c.position.x+17)*18-c.velocity.x*6,az=((reverse?1:-1)*speed-c.velocity.z)*7;
   if(reverse&&c.position.z>5.2){ax=(5-c.velocity.x)*7;az=(6.5-c.position.z)*16-c.velocity.z*6;}
   c.force.x+=c.mass*THREE.MathUtils.clamp(ax,-65,65);c.force.z+=c.mass*THREE.MathUtils.clamp(az,-65,65);c.wakeUp();
  },update(dt){this.ensure();
   let covered=0;
   for(let iy=0;iy<5;iy++)for(let ix=0;ix<5;ix++){
    const a=V(-17+(ix-2)*.125,.44+(iy-2)*.125,2.98),direction=V(0,0,-1);
    if(cargoOccludes(g,[{a,direction,length:.86}]))covered++;
   }
   this.coverage=covered/25;
   // A regulated supply, the exposed leak, and the actual discharge path.
   const supply=this.mode===0?14:0;
   const leak=.055+(this.mode===0?(1-this.coverage)*8:0);
   this.pressure=THREE.MathUtils.clamp(this.pressure+(supply-leak*this.pressure-(this.mode===1?2.4:0))*dt,0,100);
   this.seatTravel=THREE.MathUtils.damp(this.seatTravel,this.mode!==0?2.2:0,5,dt);
   seat.forEach(part=>part.move(this.seatTravel,dt));
   if(this.doorBody){this.doorTravel=this.doorBody.position.x;doorMesh.position.x=this.doorTravel;doorMesh.updateWorldMatrix(true,false);doorCollider.mesh.position.copy(doorMesh.position);doorCollider.mesh.updateWorldMatrix(true,false);doorCollider.box.setFromObject(doorMesh);}
  },reset(){this.ensure();this.mode=0;this.pressure=this.coverage=this.seatTravel=this.doorTravel=0;seat.forEach(part=>part.move(0,0));
   if(this.doorBody){this.doorBody.position.set(0,2.2,-8);this.doorBody.velocity.setZero();this.doorBody.force.setZero();this.doorBody.wakeUp();this.doorBody.aabbNeedsUpdate=true;}
   this.update(0);
  },
 };
 k.ticks.unshift(dt=>state.update(dt));k.forces.push(()=>state.forces());k.resets.push(()=>state.reset());
 k.control('pneumatic-distributor',[-9,0,7],()=>{state.mode=(state.mode+1)%3;},'E — распределитель: заряд → выдача → возврат. Заряд закрывает седло; выдача расходует накопленный воздух; возврат продувает рукав назад.');
 // A vessel, visible piping and a mechanical pressure gauge make the energy
 // store legible before it moves. All heavy housings have real collision.
 k.geometry(new THREE.CylinderGeometry(1.45,1.45,5.4,24),'shell',[-7,2.8,2],Q(),{solid:true,batch:false,name:'Compressed air reservoir'});
 for(const y of [.3,5.3])k.geometry(new THREE.TorusGeometry(1.48,.12,8,24),'metal',[-7,y,2],Q().setFromAxisAngle(V(1,0,0),Math.PI/2),{batch:false,name:'Reservoir retaining ring'});
 for(const x of [-7,-12,-17])k.geometry(new THREE.CylinderGeometry(.18,.18,4.8,10),'metal',[x,3,4.5],Q().setFromAxisAngle(V(0,0,1),Math.PI/2),{batch:false,name:'Pressure manifold tube'});
 k.projector([-17,3.5,7.1],[0,0,-1],{radius:.48,rotating:true});
 k.display([1,12,-24.7],()=>`РЕСИВЕР ${state.pressure.toFixed(0)} кПа / УТЕЧКА ${((1-state.coverage)*100).toFixed(0)}%\n${['ЗАРЯД','ВЫДАЧА','ВОЗВРАТ'][state.mode]} / ДВЕРЬ ${state.doorTravel.toFixed(1)} м`,22,2.1);
 k.label('34 / ПНЕВМОАККУМУЛЯТОР',[0,14,24.6],[0,0,-1],23,1.1);
 k.label('УТЕЧКА / КОРПУС ЗАКРЫВАЕТ ОТВЕРСТИЕ',[-14.6,4,2],[1,0,0],10,.65);
 k.label('ГРУЗОВОЙ РУКАВ / ВЫДАЧА',[-17,2.9,-16],[0,0,-1],10,.7);
 const l=k.finishResearch([-4,0,20],[-7,.6,18],[0,0,-21],{postCampaign:true,pressureState:state,dispatch,inlet,doorCollider,seat,spawnView:{yaw:.15,pitch:-.05}});
 l.puzzleGeometry={noProgressFlags:true,recoveryFloor:0,footprint:52*52,orders:['charge-then-deliver','inspect-unsealed-first','recover-early-discharge'],portalRoles:{'pressure-feed':'free original cargo enters the enclosed tube','pressure-mouth':'cargo-only pressure inlet'},deductions:['cargo closes a geometric leak rather than loading a named receiver','air pressure stores and leaks continuously','one manual distributor switches charge, discharge and reverse plumbing','stored pressure supplies force to a real guided door','released cargo opens its own former seat and exits through a separate low sleeve']};
 const dispose=l.dispose;l.dispose=()=>{if(state.doorBody&&state.owner?.world)state.owner.world.removeBody(state.doorBody);dispose();};
 return l;
}
