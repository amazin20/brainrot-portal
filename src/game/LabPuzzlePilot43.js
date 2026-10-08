import * as THREE from 'three';
import {ResearchChamber} from './LabResearchArt.js';
import {dressPuzzlePilot43} from './LabPuzzlePilot43Art.js';

export const PILOT43_SPEC=Object.freeze({
 id:'puzzle-pilot43-return-and-release',title:'Другой ракурс',
 concept:'Один спутник держит обзор открытым. Перемести точку наблюдения, верни спутника и преврати ту же пару в путь для падения.',
 description:'Выход на верхнем настиле. Кнопка открывает обзор и приёмную дверь; нижний этаж возвращает к началу.',
 accent:0xf6be85,assets:[1,2,11,22,23,24],
 hints:[
  'Заслонка закрывает обзор, а не весь зал. Оставь спутника на кнопке и посмотри через открывшийся проём с дальней части двора.',
  'На боковой галерее видны кнопка внизу и отдельная белая поверхность позади приёмника. Верни оставленного спутника на этот настил, а не внутрь закрывшегося приёмника.',
  'Выход выше галереи. На её краю видны глубокий приёмный колодец и наклонная белая поверхность: перепад высоты даёт импульс. Спутника можно нести в руках.',
 ],
});

/** A sight shutter is ordinary live machinery: its only input is weight on
 * the visible button. It neither remembers visits nor recognizes portals. */
function sightShutter(k,button){
 const {game:g}=k,group=new THREE.Group();group.name='Weighted observation shutter';k.world.root.add(group);
 const leaf=k.block([0,0,0],[20,10,.7],'secondary',false,group,.10);
 const collider=g.collisionProxy(new THREE.Box3().setFromObject(leaf),{kinematic:true});collider.mesh.name='Observation shutter / physical sliding leaf';
 const shutter={group,leaf,collider,progress:0,previous:0,pressed:false,
  update(dt){
   const p=g.playerPosition,frame=button.surface.getFrame();
   const player=Boolean(g.playerGrounded&&p&&Math.abs(p.y-frame.center.y)<.25&&Math.abs(p.x-frame.center.x)<frame.halfWidth&&Math.abs(p.z-frame.center.z)<frame.halfHeight);
   this.pressed=button.loaded()||player;button.pressed=this.pressed;this.previous=this.progress;
   this.progress=THREE.MathUtils.damp(this.progress,this.pressed?1:0,4.5,dt);
   group.position.set(-18,17+10*this.progress,-6);group.updateWorldMatrix(true,true);
   g.syncCollision(collider,new THREE.Box3().setFromObject(leaf),dt);
  },
  reset(){this.progress=this.previous=0;this.pressed=false;button.pressed=false;group.position.set(-18,17,-6);group.updateWorldMatrix(true,true);g.syncCollision(collider,new THREE.Box3().setFromObject(leaf),0);},
  render(alpha){group.position.y=17+10*THREE.MathUtils.lerp(this.previous,this.progress,alpha);},
 };
 shutter.reset();k.ticks.push(dt=>shutter.update(dt));k.resets.push(()=>shutter.reset());k.renders.push(a=>shutter.render(a));return shutter;
}

/** A previously placed portal remains usable. The real receiving vestibule
 * therefore has a second live weight-controlled leaf: carrying away the
 * button's weight cannot carry that already placed shortcut past its door. */
function ingressDoor(k,shutter){
 const g=k.game,group=new THREE.Group();group.name='Observation vestibule side door';k.world.root.add(group);
 const leaf=k.block([0,0,0],[.7,8,9],'secondary',false,group,.10);
 const collider=g.collisionProxy(new THREE.Box3().setFromObject(leaf),{kinematic:true});collider.mesh.name='Vestibule / actual weighted exit leaf';
 const door={group,leaf,collider,progress:0,previous:0,open:false,
  update(dt){this.open=shutter.pressed;this.previous=this.progress;this.progress=THREE.MathUtils.damp(this.progress,this.open?1:0,6,dt);group.position.set(-26,19+8*this.progress,-12.5);group.updateWorldMatrix(true,true);g.syncCollision(collider,new THREE.Box3().setFromObject(leaf),dt);},
  reset(){this.progress=this.previous=0;this.open=false;group.position.set(-26,19,-12.5);group.updateWorldMatrix(true,true);g.syncCollision(collider,new THREE.Box3().setFromObject(leaf),0);},
  render(alpha){group.position.y=19+8*THREE.MathUtils.lerp(this.previous,this.progress,alpha);},
 };
 door.reset();k.ticks.push(dt=>door.update(dt));k.resets.push(()=>door.reset());k.renders.push(a=>door.render(a));return door;
}

/** Opt-in replacement for one room. The established room 43 is kept intact.
 * All three areas occupy one enclosed chamber; every return is a real walk.
 * Completion uses the original goal containment rule and the original cargo. */
export function buildPuzzlePilot43(game,index=42){
 const k=new ResearchChamber(game,PILOT43_SPEC,index,'current',{minX:-30,maxX:28,minZ:-30,maxZ:28},-4,32);
 const entryDeck=k.deck('Entry observation court',-28,-8,8,26,0);
 const galleryDeck=k.deck('Raised inspection gallery',-28,-8,-26,-8,15);
 const viewingDeck=k.deck('Side observation return',-8,4,-26,-18,15);
 const goalDeck=k.deck('High receiving terrace',6,24,6,24,22);
 k.ramp('Physical service return',-28,-20,0,8,-4,0);

 // A deep partition and its eastern return make the observation aperture the
 // only lower-floor sightline to the gallery address. The side gallery sees
 // the button around that return; it is not a hidden pass-through wall.
 k.block([-18,4,-6],[20,16,1.0],'shell');
 k.block([-18,27,-6],[20,10,1.0],'shell');
 k.block([-8,9,-12],[1.0,26,12],'shell');
 const entry=k.panel('entry',[-14,2.85,25],[0,0,-1],8,5.8);
 // The raised centre is intentional. A lower centre would be occluded by
 // the actual receiving apron before the shot reached the porcelain face.
 const gallery=k.panel('gallery',[-20,20,-16],[0,0,1],8,5.8);
 const button=k.loadPad('floor-button',[-20,0,14],6);
 button.surface.mesh.userData.portalSize={width:1.8,height:2.1};
 // A person standing on this button cannot address the raised gallery. Its
 // north cheek blocks that upward line while the eastern opening remains
 // visible from the far side observation wing. The companion must keep the
 // weight here while the player's viewpoint moves into the open court.
 k.block([-20.5,6,9],[7,12,.55],'secondary');
 const fall=k.loadPad('fall',[13,-4,-22],10);
 const launch=k.panel('launch',[-8,10,13],[.435889894,.9,0],9,7);
 // Wide flight apertures tolerate a real carried body and camera-directed
 // floor-portal rotation. Their actual rims and collision openings agree.
 fall.surface.mesh.userData.portalSize={width:2.8,height:2.8};
 launch.mesh.userData.portalSize={width:2.8,height:2.8};
 const shutter=sightShutter(k,button);
 // This chamber has an ordinary front landing, a closed housing and one
 // weighted side door. The gallery return address is beyond that housing.
 // The one-and-a-half-metre inspection slit transmits an ordinary shot from
 // the lower court but is physically shorter than the standing capsule.
 k.block([-20,15.25,-8],[12,.5,.6],'shell');
 k.block([-20,24.5,-8],[12,15,.6],'shell');
 k.block([-20,23.5,-17],[12,17,.6],'shell');
 k.block([-14,23.5,-12.5],[.6,17,9],'shell');
 k.block([-26,27.5,-12.5],[.7,9,9],'shell');
 const ingress=ingressDoor(k,shutter);
 const returned=k.panel('return',[-20,17.85,-25.5],[0,0,1],8,5.8);
 // Three visible steps permit an accidental passenger to jump back into the
 // raised ingress portal. They provide physical recovery inside the housing.
 for(const [z,top]of [[-12.4,15.6],[-13.5,16.2],[-14.6,16.8]])k.block([-20,(15+top)/2,z],[8,top-15,1.1],'floor');
 k.wire([[-22,0.25,14],[-26,0.25,14],[-26,0.25,-4],[-26,13,-4]],()=>shutter.pressed);

 k.label('43 / ДРУГОЙ РАКУРС',[-29.0,6.8,18],[1,0,0],11,1.0);
 k.label('СМОТРОВАЯ ЗАСЛОНКА',[-18,23.4,-5.35],[0,0,1],13,.75);
 k.label('ВЫХОД',[15,27.6,25.9],[0,0,-1],9,.9);
 k.label('СЛУЖЕБНЫЙ ВОЗВРАТ',[-29.0,-.9,-6],[1,0,0],8,.7);
 k.label('ОБЗОР ГАЛЕРЕИ',[-14,0.04,22],[0,1,0],8,.6);
 dressPuzzlePilot43(k,{entryDeck,galleryDeck,viewingDeck,goalDeck,button,shutter,ingress,panels:k.panels});
 const level=k.finishResearch([-14,0,20],[-12,.6,19],[15,22,15],{
  pilot43:true,button,shutter,ingress,fall,launch,entry,gallery,returned,spawnView:{yaw:-.28,pitch:.06},
 });
 level.getObjective=()=>shutter.pressed?'Обзор открыт. Выход находится на высоком настиле.':'Выход находится на высоком настиле. Кнопка открывает смотровую заслонку.';
 level.getContextLesson=()=>['pilot43-familiar-rules','ЛКМ / ПКМ','Одна пара порталов переносит тебя и спутника. Вес на кнопке открывает обзор и приёмную дверь; скорость падения сохраняется на выходе. Внизу есть настоящий обратный путь.',false];
 level.puzzleGeometry={noProgressFlags:true,recoveryFloor:-4,goalHeight:22,footprint:58*58,
  orders:['cargo-opens-view'],discoveries:['retrieve-the-button-weight-from-a-new-view','reuse-the-pair-for-a-gravitational-flight'],
  portalRoles:{entry:'ordinary lower entrance',gallery:'raised receiving vestibule whose actual side door requires live button weight',return:'independent gallery receiver beyond the vestibule, hidden from the lower floor by real decking','floor-button':'live weight and cargo retrieval from the side gallery',fall:'receive a real fall from the fifteen-metre gallery',launch:'turn conserved falling velocity toward the high receiving terrace'},
 };
 return level;
}
