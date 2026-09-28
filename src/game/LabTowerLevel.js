import * as THREE from 'three';
import {
 TOWER_STAGE_COUNT,TOWER_SIDE,TOWER_RISE,TOWER_HALF_WIDTH,TOWER_ENTRY_S,TOWER_ENTRY_MAX_S,TOWER_EXIT_S,
 TOWER_MANDATORY_DISTANCE,TOWER_MINIMUM_SECONDS,TOWER_STAGES,towerPoint,towerCoordinates,
} from './LabTowerLayout.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=THREE.MathUtils.clamp;
export const TOWER_SPEC=Object.freeze({
 id:'tower-of-five-hundred',name:'БАШНЯ ПЯТИСОТ',title:'БАШНЯ ПЯТИСОТ',
 description:'500 последовательных испытаний вокруг километровой шахты. Друг поднимается вместе с тобой. Ошибка возвращает к подножию. Контрольных точек нет.',
 assets:[1,2,11],accent:0x57d3d3,
 hints:['Цветные напольные контакты питают ближайшую створку. Пройди по каждому контакту.','Поднимайся по лестницам; низкую поперечную балку нужно перепрыгнуть. Друг должен быть рядом.','Это одно непрерывное восхождение: перезапуск или падение обнуляет все 500 этапов.'],
});

/** One physical, continuous tower. The nearby collision window is streamed,
 * but the route and stage state are fixed. No stage can respawn the player.
 * Stage progression observes only input-driven production physics positions.
 */
export function buildTowerLevel(game,index=40){
 const root=new THREE.Group();root.name='The final tower — one continuous 500-stage ascent';game.scene.add(root);
 const unit=new THREE.BoxGeometry(1,1,1);
 const colors=Array.from({length:25},(_,i)=>new THREE.Color().setHSL((.49+i*.071)%1,.56,.57));
 const matte=(color,roughness=.72,metalness=.12)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 const m={shell:matte(0x263c4c),core:matte(0x314c5b),deck:matte(0xa7bfc6,.86,.05),
  step:matte(0xc5d6d6),trim:matte(0x17313f,.52,.38),ivory:matte(0xe8e9dc),
  glass:matte(0x3e7181,.45,.28),pressed:new THREE.MeshBasicMaterial({color:0x86f4b3}),
  waiting:new THREE.MeshBasicMaterial({color:0xffc16e}),lamp:new THREE.MeshBasicMaterial({color:0xffefd0}),
  accents:colors.map(color=>matte(color,.54,.22)),glows:colors.map(color=>new THREE.MeshBasicMaterial({color})),
 };
 const background=game.scene.background?.clone?.()??game.scene.background;
 const globalObjects={colliders:[],floors:[],meshes:[]};
 const resident=new Map();const states=Array.from({length:TOWER_STAGE_COUNT},()=>({entered:false,plates:[],opened:false}));
 let completed=0,won=false,disposed=false,elapsed=0,activeSeconds=0,distanceMeters=0,idle=0,longestIdle=0,failures=0;
 let lastPosition=null,lastCompletion=0;const stageEvents=[];
 const lightPose=game.keyLight?{position:game.keyLight.position.clone(),target:game.keyLight.target.position.clone()}:null;
 game.scene.background=new THREE.Color(0x354e60);
 game.scene.fog=new THREE.Fog(0x354e60,65,170);

 function registerBox(owner,parent,position,size,material,{solid=true,camera=solid,aim=solid,visible=true}={}){
  const mesh=new THREE.Mesh(unit,material);mesh.position.fromArray(position);mesh.scale.fromArray(size);
  mesh.receiveShadow=true;mesh.visible=visible;parent.add(mesh);mesh.updateWorldMatrix(true,false);owner.meshes.push(mesh);
  if(solid){const c={mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true};owner.colliders.push(c);game.colliders.push(c);
   if(!visible)mesh.userData.collisionProxy=true;
   if(game.physics&&!game.physics.solids.has(mesh.uuid))game.physics.addStaticBox(mesh.uuid,c.box);
  }
  if(camera)game.cameraBlockers.push(mesh);if(aim)game.aimBlockers.push(mesh);
  return mesh;
 }
 function box(stage,s,n,y,width,height,depth,material,options){
  const p=towerPoint(stage.definition,s,n,stage.definition.baseY+y),[dx,dz]=stage.definition.direction;
  return registerBox(stage,stage.group,p,[Math.abs(dx)*depth+Math.abs(dz)*width,height,Math.abs(dz)*depth+Math.abs(dx)*width],material,options);
 }
 function floor(stage,s0,s1,y,width=TOWER_HALF_WIDTH*2,material=m.deck){
  const mesh=box(stage,(s0+s1)/2,0,y-.22,width,.44,s1-s0,material);
  const b=stage.colliders.at(-1).box;
  const f={minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z,y:stage.definition.baseY+y,mesh,enabled:true};
  game.floors.push(f);stage.floors.push(f);return mesh;
 }
 // A sealed architectural shaft, rather than disconnected floating platforms.
 // The global walls remain physical while floor modules stream with the player.
 const top=TOWER_STAGE_COUNT*TOWER_RISE+8,center=(top-2)/2;
 for(const [p,s] of [
  [[-2.5,center,-7],[.6,top+2,19.6]],[[16.5,center,-7],[.6,top+2,19.6]],
  [[7,center,2.5],[19.6,top+2,.6]],[[7,center,-16.5],[19.6,top+2,.6]],

 ])registerBox(globalObjects,root,p,s,m.shell);
 registerBox(globalObjects,root,[7,center,-7],[9.55,top+2,9.55],m.core,{visible:false});
 const shaftGlass=new THREE.MeshStandardMaterial({color:0x80c8df,transparent:true,opacity:.16,roughness:.25,metalness:.1,depthWrite:false,side:THREE.DoubleSide});
 for(const [p,s]of [[[2.226,center,-7],[.018,top+2,9.54]],[[11.774,center,-7],[.018,top+2,9.54]],[[7,center,-2.226],[9.54,top+2,.018]],[[7,center,-11.774],[9.54,top+2,.018]]])registerBox(globalObjects,root,p,s,shaftGlass,{solid:false});
 for(const x of [3.0,11.0])for(const z of [-3.0,-11.0])registerBox(globalObjects,root,[x,center,z],[.34,top+2,.34],m.core,{solid:false});
 for(const x of [3.22,10.78])for(const z of [-3.22,-10.78])registerBox(globalObjects,root,[x,center,z],[.07,top+2,.07],m.glows[0],{solid:false});
 const shaftRings=new THREE.InstancedMesh(unit,m.ivory,126*4),ringMatrix=new THREE.Matrix4();
 for(let ring=0;ring<126;ring++)for(let side=0;side<4;side++){const positions=[[7,ring*8-1,-3],[7,ring*8-1,-11],[3,ring*8-1,-7],[11,ring*8-1,-7]],size=side<2?[8.3,.18,.18]:[.18,.18,8.3];ringMatrix.compose(V(...positions[side]),new THREE.Quaternion(),V(...size));shaftRings.setMatrixAt(ring*4+side,ringMatrix);}
 shaftRings.computeBoundingSphere();root.add(shaftRings);
 // Repeated shaft mullions share one geometry; no uploaded actor is changed.
 for(const [x,z]of [[-2.13,2.13],[16.13,2.13],[-2.13,-16.13],[16.13,-16.13]])
  registerBox(globalObjects,root,[x,center,z],[.13,top+2,.13],m.lamp,{solid:false});

 function buildStage(i){
  const definition=TOWER_STAGES[i],state=states[i],group=new THREE.Group();group.name=`Tower stage ${i+1}: ${definition.pattern}`;root.add(group);
  const stage={definition,state,group,colliders:[],floors:[],meshes:[],plateMeshes:[],gatePanels:[],gateProgress:state.opened?1:0};
  const accent=m.accents[definition.sector],glow=m.glows[definition.sector];
  // The eight risers are 25 cm: below the production 37 cm step-up limit.
  floor(stage,0,7.8,0);
  for(let k=0;k<8;k++)floor(stage,7.8+k*.4,7.8+(k+1)*.4,(k+1)*.25,4.4,k%2?m.step:m.deck);
  floor(stage,11,14,2);
  // The square corner landing joins consecutive sides at exactly equal height.
  floor(stage,-2.2,0,0);
  // These solid ceiling trays prevent the next winding from being reached by
  // jumping. Their undersides are well above the 2.4 m character on the top step.
  box(stage,7,0,5.65,4.42,.32,9.55,m.shell);
  for(const n of [-2.12,2.12]){
   box(stage,7,n,5.39,.14,.12,9.25,m.ivory,{solid:false});
   box(stage,7,n,5.30,.065,.035,9.0,m.lamp,{solid:false});
   box(stage,4.15,n,.16,.09,.28,6.7,accent,{solid:false});
   box(stage,12.05,n,2.16,.09,.28,2.3,accent,{solid:false});
  }
  // Recessed folded panels give each circuit a readable material rhythm.
  for(const s of [2.8,5.0,7.2,9.4,11.6])for(const n of [-2.185,2.185]){
   box(stage,s,n,3.6,.035,1.45,1.75,accent,{solid:false});
   box(stage,s,n,4.41,.055,.07,1.8,m.ivory,{solid:false});
  }
  // Gate frame and leaves are visibly tied to the live floor contacts.
  const gateS=6.8;
  for(const n of [-2.05,2.05])box(stage,gateS,n,2.45,.18,4.9,.42,m.trim);
  box(stage,gateS,0,4.98,4.3,.18,.46,accent);
  for(const side of [-1,1]){
   const panel=box(stage,gateS,side*1.025,2.42,2.04,4.82,.13,m.ivory,{solid:false});
   const stripe=box(stage,gateS-.083,side*1.025,3.60,1.8,.19,.025,glow,{solid:false});
   stage.gatePanels.push({mesh:panel,side,s:gateS,y:2.42},{mesh:stripe,side,s:gateS-.083,y:3.60});
  }
  stage.gateProxy=box(stage,gateS,0,2.42,4.0,4.84,.18,m.trim,{visible:false});
  stage.gateCollider=stage.colliders.at(-1);
  stage.gateCollider.enabled=!state.opened;
  if(game.physics)game.physics.setStaticEnabled(stage.gateProxy.uuid,!state.opened);
  definition.plates.forEach((plate,p)=>{
   box(stage,plate.s,plate.n,.032,1.22,.064,1.08,m.trim,{solid:false});
   const lit=box(stage,plate.s,plate.n,.068,1.04,.025,.9,state.plates[p]?m.pressed:m.waiting,{solid:false});
   stage.plateMeshes.push(lit);
   // The cable lies in a recessed edge raceway, away from the walking surface.
   box(stage,(plate.s+gateS)/2,plate.n,.10,.032,.022,gateS-plate.s,m.waiting,{solid:false});
  });
  for(const obstacle of definition.obstacles){
   box(stage,obstacle.s,obstacle.n,obstacle.height/2,obstacle.width,obstacle.height,obstacle.depth,accent);
   box(stage,obstacle.s,obstacle.n,obstacle.height+.02,obstacle.width,.04,obstacle.depth+.04,m.ivory,{solid:false});
   if(obstacle.height<1)box(stage,obstacle.s-.02,obstacle.n,obstacle.height+.045,obstacle.width-.12,.024,.13,m.waiting,{solid:false});
  }
  // Readable end seam and elevated landing: an observed stage finish, never a
  // checkpoint. The next winding is still part of the same physical level.
  box(stage,TOWER_EXIT_S,0,2.018,4.12,.036,.14,glow,{solid:false});
  box(stage,11.75,0,5.40,2.8,.055,.15,m.lamp,{solid:false});
  if(i===TOWER_STAGE_COUNT-1){
   const gold=m.glows[24];
   for(const n of [-1.86,1.86]){
    box(stage,13.35,n,3.85,.20,3.7,.34,m.ivory,{solid:false});
    box(stage,13.13,n,3.85,.065,3.45,.055,gold,{solid:false});
   }
   box(stage,13.35,0,5.75,3.94,.28,.44,m.ivory,{solid:false});
   box(stage,13.10,0,5.78,3.65,.085,.055,m.waiting,{solid:false});
   box(stage,13.50,0,7.1,1.1,1.1,1.1,m.waiting,{solid:false});
   box(stage,13.50,0,9.8,.13,4.2,.13,m.lamp,{solid:false});
   box(stage,13.50,0,12.0,3.3,.12,3.3,m.lamp,{solid:false});
  }
  resident.set(i,stage);setGate(stage,stage.gateProgress);batchStage(stage);return stage;
 }
 function batchStage(stage){
  const dynamic=new Set([...stage.plateMeshes,...stage.gatePanels.map(p=>p.mesh)]),groups=new Map();
  for(const mesh of stage.meshes)if(mesh.visible&&!dynamic.has(mesh)){
   if(!groups.has(mesh.material))groups.set(mesh.material,[]);groups.get(mesh.material).push(mesh);
  }
  stage.batches=[];
  for(const [material,meshes]of groups){
   const batch=new THREE.InstancedMesh(unit,material,meshes.length);batch.name='Batched tower architectural modules';batch.receiveShadow=true;
   meshes.forEach((mesh,i)=>{mesh.updateMatrix();batch.setMatrixAt(i,mesh.matrix);mesh.visible=false;mesh.userData.collisionProxy=true;mesh.matrixAutoUpdate=false;});
   batch.computeBoundingSphere();stage.group.add(batch);stage.batches.push(batch);
  }
 }
 function removeMatching(array,set){let write=0;for(const value of array)if(!set.has(value))array[write++]=value;array.length=write;}
 function removeStage(i){
  const stage=resident.get(i);if(!stage)return;
  for(const c of stage.colliders)game.physics?.removeStaticBox(c.mesh.uuid);
  const meshes=new Set(stage.meshes),colliders=new Set(stage.colliders),floors=new Set(stage.floors);
  removeMatching(game.colliders,colliders);removeMatching(game.floors,floors);
  removeMatching(game.cameraBlockers,meshes);removeMatching(game.aimBlockers,meshes);
  for(const batch of stage.batches??[])batch.dispose();
  stage.group.removeFromParent();resident.delete(i);
 }
 function streamAround(i){
  // Six real stage modules at most. Preserve the current two approaches,
  // and the next winding's overhead slabs before the actor can reach them.
  const first=Math.max(0,i-2),last=Math.min(TOWER_STAGE_COUNT-1,first+5);
  for(const key of [...resident.keys()])if(key<first||key>last)removeStage(key);
  for(let n=first;n<=last;n++)if(!resident.has(n))buildStage(n);
  game.indexColliders?.();
 }
 function setGate(stage,progress){
  stage.gateProgress=progress;
  for(const part of stage.gatePanels){const p=towerPoint(stage.definition,part.s,part.side*(1.025+progress*2.18),stage.definition.baseY+part.y);part.mesh.position.fromArray(p);}
  const enabled=progress<.92;
  if(stage.gateCollider.enabled!==enabled){stage.gateCollider.enabled=enabled;game.physics?.setStaticEnabled(stage.gateProxy.uuid,enabled);}
 }
 function failure(){if(disposed||game.state!=='playing')return;failures++;game.callbacks?.onToast?.('Срыв. Башня начинается заново: контрольных точек нет.');game.resetRun(true);}
 function reset(){
  completed=0;game.completedStages=0;won=false;elapsed=activeSeconds=distanceMeters=idle=longestIdle=0;lastPosition=null;lastCompletion=0;stageEvents.length=0;
  for(const state of states){state.entered=false;state.plates=[];state.opened=false;}
  streamAround(0);
  for(const stage of resident.values()){
   for(const mesh of stage.plateMeshes)mesh.material=m.waiting;
   setGate(stage,0);
  }
 }
 function update(dt){
  if(disposed||won||game.state!=='playing')return;
  const p=game.playerPosition,stage=TOWER_STAGES[Math.min(completed,499)],local=towerCoordinates(stage,p);
  elapsed+=dt;
  if(lastPosition){const d=p.distanceTo(lastPosition);if(d<3){distanceMeters+=d;if(d>dt*.15){activeSeconds+=dt;idle=0;}else{idle+=dt;longestIdle=Math.max(longestIdle,idle);}}}
  lastPosition??=p.clone();lastPosition.copy(p);
  const oldestFloor=Math.max(0,completed-2)*TOWER_RISE;
  if(p.y<oldestFloor-2.6||game.cargo.position.y<oldestFloor-3.0){failure();return;}
  // A completed climb cannot fall onto a retired winding and continue from
  // there. The beginning is the only recovery state.
  if(p.x< -2.7||p.x>16.7||p.z< -16.7||p.z>2.7){failure();return;}
  const state=states[completed],live=resident.get(completed);
  if(!state||!live)return;
  // Both edges accept an ordinary jump. Requiring grounded contact made a
  // valid corner cut or leap miss an invisible sensor and strand a closed gate.
  // Ordered plates and the solid route remain mandatory; the wider entry band
  // is included in the conservative distance bound in LabTowerLayout.
  if(!state.entered&&local.s>=TOWER_ENTRY_S&&local.s<=TOWER_ENTRY_MAX_S&&Math.abs(local.n)<2&&p.y>=stage.baseY-.1&&p.y<=stage.baseY+2.5)state.entered=true;
  if(state.entered)stage.plates.forEach((plate,n)=>{
   if(!state.plates[n]&&Math.abs(local.s-plate.s)<.57&&Math.abs(local.n-plate.n)<.59&&Math.abs(p.y-stage.baseY)<.48&&game.playerGrounded){
    state.plates[n]=true;live.plateMeshes[n].material=m.pressed;
   }
  });
  state.opened=state.entered&&stage.plates.every((_,n)=>state.plates[n]);
  setGate(live,Math.min(1,live.gateProgress+(state.opened?dt*10:0)));
  if(state.entered&&state.opened&&local.s>=TOWER_EXIT_S&&local.s<15.1&&Math.abs(local.n)<2&&p.y>=stage.baseY+1.82&&p.y<=stage.baseY+4.5
   &&game.cargo.position.distanceTo(p)<3.5){
   completed++;game.completedStages=completed;
   const event={stage:completed,seconds:elapsed,stageSeconds:elapsed-lastCompletion,position:p.toArray(),distanceMeters};
   stageEvents.push(event);lastCompletion=elapsed;
   if(completed===TOWER_STAGE_COUNT){won=true;return;}
   streamAround(completed);
  }
 }
 function metrics(){return {completedStages:completed,totalStages:TOWER_STAGE_COUNT,activeSeconds,distanceMeters,longestIdleSeconds:longestIdle,
  elapsedSeconds:elapsed,failures,checkpoints:false,mandatoryDistanceMeters:TOWER_MANDATORY_DISTANCE,minimumSpeedrunSeconds:TOWER_MINIMUM_SECONDS,
  residentStages:resident.size,colliders:game.colliders.length,stageEvents:stageEvents.map(event=>({...event}))};}
 streamAround(0);
 const level={id:TOWER_SPEC.id,title:'41 / '+TOWER_SPEC.title,spec:TOWER_SPEC,index,game,tower:true,towerChallenge:true,totalStages:TOWER_STAGE_COUNT,
  towerStages:TOWER_STAGES,towerRoute:TOWER_STAGES,routeStages:TOWER_STAGES,
  spawn:V(...towerPoint(0,.08,0)),cargoSpawn:V(...towerPoint(0,.7,.82,.6)),spawnView:{yaw:-Math.PI/2,pitch:-.14},
  contextHandlesCarry:true,getContextLesson:()=>['tower-'+Math.min(completed,499),TOWER_STAGES[Math.min(completed,499)].patternIndex===8?'ПРОБЕЛ':'W A S D',game.heldCube?(TOWER_STAGES[Math.min(completed,499)].patternIndex===8?'Перепрыгни низкую балку. Нажми напольный контакт и продолжай подъём.':'Пройди по золотым напольным контактам, обойди перегородки и поднимись выше.'): 'Возьми друга клавишей E. Все 500 этапов нужно пройти за один подъём.',false],
  viewDistance:170,terminals:[],pads:[],gates:[],panels:{},launchPad:null,
  get completedStages(){return completed;},get progress(){return completed;},
  getTowerMetrics:metrics,diagnostics:()=>({id:TOWER_SPEC.id,tower:true,portalPuzzle:false,...metrics()}),
  getObjective:()=>`ЭТАП ${Math.min(completed+1,500)} / 500 · ${TOWER_STAGES[Math.min(completed,499)].pattern} · БЕЗ КОНТРОЛЬНЫХ ТОЧЕК`,
  nearbyInteraction:()=>completed===0&&game.playerPosition.distanceTo(game.cargo.position)<2.4&&!game.heldCube?'E — возьми друга: подниматься нужно вместе':'',
  interact:()=>false,cargoOnAnyPad:()=>false,getLaunch:()=>null,isWon:()=>won,reset,update,
  renderUpdate(){
   if(game.keyLight){const y=game.playerPosition?.y??0;game.keyLight.position.set(-7,y+24,14);game.keyLight.target.position.set(7,y+3,-7);game.keyLight.target.updateMatrixWorld();}
  },
  dispose(){disposed=true;game.scene.background=background;if(lightPose){game.keyLight.position.copy(lightPose.position);game.keyLight.target.position.copy(lightPose.target);}
   for(const key of [...resident.keys()])removeStage(key);
   shaftRings.dispose();shaftGlass.dispose();
   for(const material of Object.values(m).flat())material.dispose();
   unit.dispose();
  },
 };
 return level;
}
