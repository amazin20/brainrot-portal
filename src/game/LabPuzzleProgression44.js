import * as THREE from 'three';
import {ResearchChamber} from './LabResearchArt.js';
import {createLightBridge} from './LabLightBridge.js';
import {dressPuzzleProgression44} from './LabPuzzleProgression44Art.js';

export const PROGRESSION44_SPEC=Object.freeze({
 id:'puzzle-progression44-rearrange-the-path',title:'Перестановка пути',accent:0xf1bb8c,assets:[1,2,11,22,23,24],
 concept:'Один световой настил меняет направление. Найди другой ракурс на закрытый грузовой отсек, верни оригинального спутника и перестрой настил к выходу.',
 description:'Три галереи разделены провалами. Низкие белые адреса принимают свет и груз; человек проходит по настоящему настилу.',
 hints:[
  'Излучатель справа направлен в белый адрес у задней стены. Другая низкая поверхность может продолжить его настил через провал.',
  'С центрального острова виден второй низкий адрес. Перенастраивать пару безопасно на настоящем острове: прежний настил исчезает.',
  'Обойди северную перегородку. Оттуда видно грузовое гнездо через два настоящих низких окна. Верни спутника на северный настил, затем направь свет к выходу.',
 ],
});

/** Low wall addresses route a real solid-light sheet and the original cargo,
 * but cannot fit the standing capsule. No visits or completed-stage flags. */
export function buildPuzzleProgression44(g,index=43){
 const k=new ResearchChamber(g,PROGRESSION44_SPEC,index,'current',{minX:-32,maxX:32,minZ:-32,maxZ:30},-4,27);
 const entry=k.deck('West departure gallery',-30,-18,14,28,8);
 const middle=k.deck('Central reconfiguration island',-6,6,14,28,8);
 const north=k.deck('Northern inspection gallery',-6,6,-28,2,8);
 const freight=k.deck('Enclosed original-cargo pocket',-30,-18,-10,2,4);
 const exit=k.deck('Eastern receiving gallery',18,30,-28,-14,8);
 k.ramp('Physical west service return',-30,-22,2,14,-4,8);
 // A continuous partition has one ordinary northern passage. The
 // wall continues to the roof and west/east edges of the northern gallery.
 for(const [a,b]of [[-6,-3],[3,6]])k.block([(a+b)/2,17.5,-12],[b-a,19,.7],'shell');
 k.block([0,20,-12],[6,14,.7],'shell');
 // Source capture is visible around the east side of both real partitions.
 const source=k.panel('bridge-source',[30,8.9,24],[-1,0,0],8,3.2);
 const first=k.panel('first-bridge',[7,8.9,16],[-1,0,0],8,3.2);
 const second=k.panel('north-bridge',[0,8.9,-29],[0,0,1],8,3.2);
 const final=k.panel('exit-bridge',[-7,8.9,-21],[1,0,0],8,3.2);
 for(const p of [source,first,second,final])p.mesh.userData.portalSize={width:2.8,height:.9};
 // The final address is behind the northern partition and faces east, so a
 // southern observer cannot place a portal on its back through the wall.
 const load=k.loadPad('freight-floor',[-24,4,-4],8);
 k.block([-24,15.5,2],[12,23,.7],'shell');
 k.block([-24,15.5,-10],[12,23,.7],'shell');
 k.block([-30,15.5,-4],[.7,23,12],'shell');
 // East freight casing owns a real low shot opening in its northern half.
 k.block([-18,15.5,-1],[.7,23,6],'shell');
 k.block([-18,4.4,-7],[.7,.8,6],'shell');
 k.block([-18,16.7,-7],[.7,20.6,6],'shell');
 const returned=k.panel('freight-return',[7,8.9,-27],[-1,0,0],7,3.2);returned.mesh.userData.portalSize={width:2.8,height:.9};
 // Two independent real windows align only from the northern observation
 // point. The service floor is far below both, and their low roofs cannot
 // fit an actor standing on an upper deck.
 k.block([-12,11,3.5],[.8,30,19],'shell');
 k.block([-12,11,-27],[.8,30,10],'shell');
 k.block([-12,1,-14],[.8,10,16],'shell');
 k.block([-12,17.8,-14],[.8,18.4,16],'shell');
 const bridge=createLightBridge(k,{origin:[20,8.35,24],direction:[1,0,0],span:[0,0,1],width:4,length:110,name:'Reconfigurable inspection light bridge'});
 k.projector([20,8.35,24],[1,0,0],{radius:.35});
 k.label('44 / ПЕРЕСТАНОВКА ПУТИ',[-30.7,12,22],[1,0,0],12,.9);
 k.label('ГРУЗОВОЙ ОТСЕК',[-17.5,14,-4],[1,0,0],9,.8);
 k.label('СЕВЕРНЫЙ ПРОХОД',[0,15,-11.5],[0,0,1],10,.8);
 k.label('ВЫХОД',[24,14,-30.4],[0,0,1],9,.8);
 dressPuzzleProgression44(k,{entry,middle,north,freight,exit});
 const l=k.finishResearch([-24,8,24],[-24,4.6,-4],[24,8,-21],{puzzleProgression:44,progression44:true,source,first,second,final,load,returned,bridge,spawnView:{yaw:-.8,pitch:.02}});
 const dispose=l.dispose;l.dispose=()=>{bridge.dispose();dispose();};
 l.getContextLesson=()=>['progression44-low-addresses','ЛКМ / ПКМ · E','Низкие адреса переносят свет и свободного спутника. Человек идёт по световому настилу. Спутник находится в закрытом грузовом отсеке; внизу есть обратный пандус.',false];
 l.puzzleGeometry={noProgressFlags:true,noCheckpoints:true,recoveryFloor:-4,phases:['first-bridge','new-north-view','northern-observation','original-cargo-return','final-bridge'],portalRoles:{'bridge-source':'live light-sheet capture','first-bridge':'first low solid-light receiver','north-bridge':'second receiver visible from central island','freight-floor':'original free cargo extraction from a new view','freight-return':'northern original-cargo receiving apron','exit-bridge':'final light receiver behind the northern partition'}};
 return l;
}
