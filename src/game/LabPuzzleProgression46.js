import * as THREE from 'three';
import {ResearchChamber} from './LabResearchArt.js';
import {createLightBridge} from './LabLightBridge.js';
import {buildTransferFunnel} from './LabTransferFunnel.js';
import {cargoLoadsPlate} from './LabPlateContact.js';
import {dressPuzzleProgression46} from './LabPuzzleProgression46Art.js';
const V=(...p)=>new THREE.Vector3(...p);

export const PROGRESSION46_SPEC=Object.freeze({
 id:'puzzle-progression46-support-and-release',title:'Опора и освобождение',
 concept:'Мост даёт ракурс к запертому спутнику. На постоянном острове та же пара переносит поток, а затем превращает перепад высоты в совместный полёт.',
 description:'Спутник виден в низком грузовом кармане. За разрывом — пульт обратимого потока, а выше — общий выход. Нижний служебный этаж возвращает к началу.',
 accent:0xf3bc86,assets:[1,2,11,22,23,24],
 hints:[
  'Проектор упирается в белую панель. Его свет проходит через пару порталов; из панели у старта мост идёт к постоянному острову.',
  'На дальнем краю острова открывается боковой ракурс грузового кармана. Его низкий адрес пропускает спутника. Подключи к нему поток и включи обратное направление.',
  'Пока поток держит спутника, пара занята. На острове можно выключить поле и оставить спутника на настоящем настиле; затем перепад под восточным краем даст импульс для общего перелёта.',
 ],
});

/** No phase, visit, portal-name or completion latch exists in this room. The
 * sole reversible circuit applies ordinary force to the original rigid body. */
export function buildPuzzleProgression46(game,index=45){
 const k=new ResearchChamber(game,PROGRESSION46_SPEC,index,'tidal',{minX:-31,maxX:29,minZ:-31,maxZ:28},-4,34);
 const entryDeck=k.deck('Projector observation and service arrival',-27,-17,2,22,15);
 const islandDeck=k.deck('Permanent switching and suspension island',-2,10,2,14,15);
 const observationDeck=k.deck('Side view of the freight throat',-2,10,-27,2,15);
 const freightDeck=k.deck('Enclosed original-companion freight bay',-27,-17,-29,-19,15);
 const goalDeck=k.deck('High joint receiving terrace',6,24,6,24,22);
 k.ramp('Broad physical service return',-28,-20,-16,2,-4,15);
 const lightSource=k.panel('light-source',[-15.8,15.75,-12],[-1,0,0],8,5.8);
 const bridgeAddress=k.panel('bridge-address',[-29.25,15.75,8],[1,0,0],8,5.8);
 k.projector([-24,15.12,-12],[1,0,0],{radius:.85});
 k.block([-20,8,-12],[9,.7,2.8],'dark');k.support(-24,-12,13,.55);
 // A genuine end cheek stops the temporary route. The permanent island
 // extends around it into the new side view; it never depends on live light.
 k.block([10.65,20.0,8],[1.0,10,11.2],'secondary');
 const light=createLightBridge(k,{origin:[-23.98,15.12,-12],direction:[1,0,0],span:[0,0,1],width:5.2,length:110,name:'46 / temporary access light causeway'});

 const baySupport={center:V(-22,15,-24),normal:V(0,1,0),right:V(1,0,0),up:V(0,0,-1),halfWidth:5,halfHeight:5};
 // Roof, front and rear are fully closed. The east inspection slot is a
 // real 1.85m throat, shorter than the unchanged 2.4m standing capsule.
 k.block([-22,20.0,-19.4],[10,10,.65],'secondary');
 k.block([-22,20.0,-29.35],[10,10,.65],'shell');
 k.block([-27.45,20.0,-24],[.65,10,10],'shell');
 k.block([-22,24.8,-24],[10,.55,10],'secondary');
 k.block([-17.05,5.625,-24],[.7,19.25,10],'shell');
 k.block([-17.05,20.95,-24],[.7,7.7,10],'secondary');
 // There is no player-sized aperture to enter the bay through a portal.
 // Its small visible ellipse and its physical standing clearance agree.
 const freight=k.panel('freight-extraction',[-26.8,16.2,-24],[1,0,0],6,2.15);
 const fieldAddress=k.panel('field-intake',[7,16.2,-13],[0,0,1],6,2.15);
 for(const p of [freight,fieldAddress])p.mesh.userData.portalSize={width:1.6,height:.78};
 const funnel=buildTransferFunnel(k,{origin:[7,16.2,10],direction:[0,0,-1],radius:1.65,speed:6});
 k.state.funnel=funnel;
 const reverse=k.control('reverse-flow',[1,15,11],()=>{funnel.reversed=!funnel.reversed;},'E — обратить настоящий поток. Янтарный поток тянет к излучателю.');
 const power=k.control('field-power',[1,15,5],()=>{funnel.enabled=!funnel.enabled;funnel.update(0);},'E — включить / выключить поле. Без поля спутник опускается на постоянный настил.');
 k.resets.push(()=>{funnel.enabled=false;funnel.reversed=false;funnel.update(0);});
 funnel.enabled=false;funnel.update(0);
 k.forces.push(()=>{
  if(game.heldCube||!game.physics?.cargoBody)return;
  const b=game.physics.cargoBody,a=funnel.acceleration(V(b.position.x,b.position.y,b.position.z),V(b.velocity.x,b.velocity.y,b.velocity.z),.39);
  if(a.lengthSq()){b.wakeUp();b.force.x+=a.x*b.mass;b.force.y+=a.y*b.mass;b.force.z+=a.z*b.mass;}
 });
 const fall=k.loadPad('fall',[19,-4,-22],10);
 const launch=k.panel('launch',[-8,10,13],[.435889894,.9,0],9,7);
 for(const p of [fall.surface,launch])p.mesh.userData.portalSize={width:2.8,height:2.8};
 k.label('46 / ОПОРА И ОСВОБОЖДЕНИЕ',[-29.6,22.3,17],[1,0,0],14,1.1);
 k.label('ПОСТОЯННЫЙ НАСТИЛ',[3.5,15.035,-3],[0,1,0],9,.7);
 k.label('НИЗКИЙ ГРУЗОВОЙ КАРМАН',[-16.61,19.15,-24],[1,0,0],8,.7);
 k.label('ОБРАТНЫЙ ПОТОК',[1,18.2,12.6],[0,0,-1],8,.7);
 k.label('ОПОРА БЕЗ ПОЛЯ',[1,18.2,6.6],[0,0,-1],8,.7);
 k.label('ПАДЕНИЕ / ПЕРЕЛЁТ',[7,15.035,-23],[0,1,0],8,.65);
 k.label('СЛУЖЕБНЫЙ ВОЗВРАТ',[-29.6,-.4,-8],[1,0,0],9,.7);
 k.label('ОБЩИЙ ВЫХОД',[15,27.6,25.9],[0,0,-1],10,.9);
 const art=dressPuzzleProgression46(k,{entryDeck,islandDeck,observationDeck,freightDeck,goalDeck,funnel,light});
 const supported=p=>p&&p.x>-2&&p.x<10&&p.z>-27&&p.z<14&&Math.abs(p.y-15.39)<.32;
 const l=k.finishResearch([-22,15,16],[-22,15.39,-24],[15,22,15],{
  puzzleProgression:46,light,funnel,reverse,power,fall,launch,lightSource,bridgeAddress,freight,fieldAddress,art,
  cargoOnAnyPad:()=>cargoLoadsPlate(game.cargo,game.heldCube,baySupport)||(!game.heldCube&&supported(game.cargo?.position)),
  playerAcceleration:(p,v)=>funnel.acceleration(p.clone().add(V(0,1.2,0)),v,.46,{centering:.8,damping:2}),
  spawnView:{yaw:.4,pitch:-.03},
 });
 const dispose=l.dispose;l.dispose=()=>{light.dispose();dispose();};
 l.getObjective=()=>`Выход выше острова. ${funnel.enabled?(funnel.reversed?'Поток тянет к излучателю.':'Поток отталкивает от излучателя.'):'Поле выключено: постоянный настил держит груз.'}`;
 l.getContextLesson=()=>['progression46-support-and-release','ЛКМ / ПКМ','Одна пара переносит свет, воздух, тебя и спутника. Мост исчезает при перестановке пары; выключенный поток отпускает настоящий груз на настил. Перепад высоты даёт импульс.',false];
 l.puzzleGeometry={noProgressFlags:true,recoveryFloor:-4,goalHeight:22,cargoThroatHeight:1.85,sourceCount:1,phaseCount:7,
  dependencies:['route-a-real-light-sheet','cross-before-repurposing-support','gain-the-side-view-of-the-low-cargo-bay','reverse-the-real-field-into-the-bay','settle-original-cargo-on-permanent-support','free-the-only-pair-for-a-deep-drop','carry-both-original-travellers-through-conserved-momentum'],
  orders:['bridge-then-extract-then-release-then-fly'],
  portalRoles:{'light-source':'intercept the projector away from any walking apron','bridge-address':'cast actual temporary support from entry toward the switching island','freight-extraction':'cargo-size aperture in the enclosed original freight bay','field-intake':'cargo-size interception of the reversible field','fall':'receive the real drop from the eastern island edge','launch':'convert conserved downward momentum into the joint high traversal'},
 };
 return l;
}
