import * as THREE from 'three';
import {ResearchChamber} from './LabResearchArt.js';
import {buildTransferFunnel} from './LabTransferFunnel.js';
import {cargoLoadsPlate} from './LabPlateContact.js';
import {dressPuzzleProgression45} from './LabPuzzleProgression45Art.js';
const V=(...p)=>new THREE.Vector3(...p);
export const PROGRESSION45_SPEC=Object.freeze({
 id:'puzzle-progression45-countercurrent',title:'Встречное течение',accent:0xe9b582,assets:[1,2,11,22,23,24],
 concept:'Извлеки спутника обратным потоком, сохрани новый ракурс, верни живой вес и освободи общую магистраль.',
 description:'Спутник виден в низком грузовом канале. Поток можно обратить; выход находится в верхнем приёмном отсеке.',
 hints:[
  'Низкий грузовой канал пропускает спутника и поток. Обратное течение тянет к излучателю через ту же пару порталов.',
  'Живой вес открывает воздушный клапан подъёмной шахты. Верхняя галерея сохраняет высоту после переназначения пары.',
  'Из другого ракурса можно вернуть оставленный вес. Поперечный приёмник использует ту же магистраль; узкий отсек не выпускает из подвешивающего потока, пока пара занята излучателем.',
 ],
});
function weightValve(k,pad){
 const g=k.game,group=new THREE.Group();group.name='Countercurrent / live rising air valve';k.world.root.add(group);
 const leaf=k.block([0,0,0],[7,.5,7],'secondary',false,group,.08),collider=g.collisionProxy(new THREE.Box3(),{kinematic:true});
 collider.mesh.name='Countercurrent / actual live air valve leaf';
 const door={group,leaf,collider,progress:0,previous:0,pressed:false,
  update(dt){const p=g.playerPosition,f=pad.surface.getFrame();this.pressed=pad.loaded()||Boolean(g.playerGrounded&&Math.abs(p.y-f.center.y)<.3&&Math.abs(p.x-f.center.x)<f.halfWidth&&Math.abs(p.z-f.center.z)<f.halfHeight);pad.pressed=this.pressed;this.previous=this.progress;this.progress=THREE.MathUtils.damp(this.progress,this.pressed?1:0,5,dt);group.position.set(-12+9*this.progress,4,9);group.updateWorldMatrix(true,true);g.syncCollision(collider,new THREE.Box3().setFromObject(leaf),dt);},
  reset(){this.progress=this.previous=0;this.pressed=false;pad.pressed=false;this.update(0);},render(a){group.position.x=-12+9*THREE.MathUtils.lerp(this.previous,this.progress,a);},
 };door.reset();k.ticks.push(dt=>door.update(dt));k.resets.push(()=>door.reset());k.renders.push(a=>door.render(a));return door;
}
/** The current contributes forces to ordinary integrators. The only stateful
 * machinery is the reversible field and one live weight-operated air valve; neither
 * recognizes a stage, a visit, an actor identity or a portal arrangement. */
export function buildPuzzleProgression45(game,index=44){
 const k=new ResearchChamber(game,PROGRESSION45_SPEC,index,'tidal',{minX:-30,maxX:30,minZ:-34,maxZ:28},0,30);
 const entryDeck=k.deck('Countercurrent source court',-28,28,12,26,0);
 const berth=k.deck('Low freight inspection berth',-23,-13,-25,-9,2);
 k.ramp('Physical rear freight service incline',-26,-10,-32,-25,0,2);
 // The freight cavity is 1.55 metres high. Its same visible ceiling blocks a
 // standing traveller and allows the ordinary free cargo body.
 k.block([-18,1,-17],[10,2,16],'shell');
 k.block([-18,7.8,-11],[10,8.5,4],'secondary');
 for(const x of [-23.3,-12.7])k.block([x,7,-17],[.6,14,17],'shell');
 const source=k.panel('source',[25,1.9,18],[-1,0,0],8,5.8);
 source.mesh.userData.portalSize={width:2.8,height:1.75};
 const freight=k.panel('freight',[-18,3.25,-24.6],[0,0,1],6,2.1);freight.mesh.userData.portalSize={width:2,height:.85};
 const load=k.loadPad('weight',[-22,0,22],6);load.surface.mesh.userData.portalSize={width:1.8,height:2.1};
 const shaft=k.loadPad('shaft',[-12,0,9],7);shaft.surface.mesh.userData.portalSize={width:2.8,height:2.8};
 const apron=k.deck('Weighted lift receiving vestibule',-16,-8,0,8,14);
 const gallery=k.deck('Retained current observation gallery',-28,-16,0,12,14);
 const arm=k.deck('Freight reunion observation arm',-28,-20,-25,0,14);
 // The receiving gallery is permanently open; weight affects the stream
 // below it, never a receiving door or a remembered access state.
 // A broad stop lets the observer deliberately steer off the rising column.
 k.block([-12,24.5,9],[7,.5,7],'secondary');
 const door=weightValve(k,load);
 const reunion=k.panel('reunion',[-24,16.85,-24.6],[0,0,1],7,5.8);
 // The high passage is hidden behind a real sixteen-metre bulkhead. The
 // retained observation arm goes around its west end, preserving the new view.
 k.block([4.65,10.25,-8],[34.7,20.5,.6],'shell');
 k.block([-29.75,10.25,-8],[.5,20.5,.6],'shell');
 k.block([-24.9,10.25,-8],[3.2,20.5,.6],'shell');
 k.block([-28,7,-8],[3,14,.6],'shell');
 k.block([-28,24.25,-8],[3,11.5,.6],'shell');
 k.block([-18,1,-8],[10.6,2,.6],'shell');
 k.block([-18,12.025,-8],[10.6,16.95,.6],'shell');
 const crossing=k.panel('crossing',[-26,20.2,-16],[1,0,0],7,5.8);
 // A real horizontal freight throat admits the near-horizontal current but
 // hides its high inlet from service-floor observers behind the bulkhead.
 k.block([-2.5,18.55,-16],[17,.5,5],'shell');
 k.block([-11,9.4,-16],[.4,18.8,5],'shell');
 k.block([-2.5,23.05,-16],[17,.5,5],'secondary');
 for(const z of [-18.7,-13.3])k.block([-2.5,15,z],[17,30,.4],'shell');
 const receive=k.deck('Suspended transverse receiving bay',6,26,-20,-12,15);
 // Within the three-metre-wide bore the entire standing capsule remains in
 // the visible field. Its low side exit is below the suspended traveller.
 k.block([16,23,-17.7],[20,16,.4],'secondary');
 k.block([12,23,-14.3],[12,16,.4],'secondary');
 k.block([24.5,23,-14.3],[3,16,.4],'secondary');
 k.block([20.5,24.3,-14.3],[5,13.4,.4],'secondary');
 k.block([26.2,23,-16],[.4,16,3.8],'shell');
 const goalDeck=k.deck('Lower side exit landing',14,26,-14,-4,15);
 const release=k.panel('release',[25.95,17.5,-16],[-1,0,0],2.8,4.8);release.mesh.userData.portalSize={width:.85,height:1.5};
 // A cargo mistake on any upper deck can walk or fall to the same unbroken
 // service foundation. No reset volume, checkpoint or synthetic return exists.
 k.wire([[-24.7,.23,22],[-27,.23,22],[-27,.23,4],[-27,4.3,4],[-27,4.3,9],[-16,4.3,9]],()=>door.pressed);
 const field=buildTransferFunnel(k,{origin:[-27,1.9,18],direction:[1,0,0],radius:2.15,speed:6});
 const reverse=k.control('reverse',[-16,0,25],()=>{field.reversed=!field.reversed;},'E — реверс грузового потока');
 k.state.field=field;k.state.door=door;k.state.load=load;
 k.forces.push(()=>{if(game.heldCube||!game.physics?.cargoBody)return;const b=game.physics.cargoBody,a=field.acceleration(V(b.position.x,b.position.y,b.position.z),V(b.velocity.x,b.velocity.y,b.velocity.z),.5);if(a.lengthSq()){b.wakeUp();b.force.x+=a.x*b.mass;b.force.y+=a.y*b.mass;b.force.z+=a.z*b.mass;}});
 k.label('45 / ВСТРЕЧНОЕ ТЕЧЕНИЕ',[-28.6,6.8,21],[1,0,0],11,.95);
 k.label('НИЗКИЙ ГРУЗОВОЙ КАНАЛ',[-18,9.8,-8.65],[0,0,1],10,.75);
 k.label('ВЕС ОТКРЫВАЕТ ПОТОК',[-12,5.7,12.7],[0,0,1],7,.65);
 k.label('ВЫХОД',[20,20,-3.6],[0,0,-1],8,.85);
 const art=dressPuzzleProgression45(k,{entryDeck,berth,apron,gallery,arm,receive,goalDeck,field,door,load});
 const level=k.finishResearch([-9,0,23],[-18,2.6,-10.8],[20,15,-8],{
  puzzleProgression:45,puzzleProgression45:true,field,door,load,shaft,source,freight,reunion,crossing,release,reverse,art,
  spawnView:{yaw:-.45,pitch:.03},
  cargoOnAnyPad:()=>load.loaded()||cargoLoadsPlate(game.cargo,game.heldCube,{center:V(-18,2,-17),normal:V(0,1,0),right:V(1,0,0),up:V(0,0,-1),halfWidth:5,halfHeight:8}),
  playerAcceleration:(p,v)=>field.acceleration(p.clone().add(V(0,1.2,0)),v,.46,{centering:.8,damping:2}),
 });
 level.getContextLesson=()=>['progression45-current','ЛКМ / ПКМ','Один обратимый поток проходит через обычную пару. Вес держит настоящий воздушный клапан открытым. Постоянная галерея сохраняет высоту; внизу есть служебный возврат.',false];
 level.puzzleGeometry={noProgressFlags:true,phases:6,recoveryFloor:0,cargoThroatHeight:1.55,goalHeight:15,footprint:60*62,
  discoveries:['pull-original-cargo-from-low-throat','live-weight-preserves-access','retain-viewpoint-and-recover-live-weight','reuse-single-current-for-joint-transverse-passage','release-occupied-pair-to-descend-inside-narrow-receiver'],
  portalRoles:{source:'one reversible physical emitter',freight:'cargo-only low inspection throat',weight:'live air-valve weight and later physical retrieval',shaft:'ordinary upward field receiving plane',reunion:'upper physical reunion receiver',crossing:'new-view transverse passage',release:'disconnect the emitter at a low receiving-wall address, preserving both travellers in the actual bay'},
 };
 return level;
}
