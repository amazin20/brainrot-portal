import {Workshop} from './LabWorkshopKit.js';
import {installVisualAuditMiddleKit} from './LabVisualAuditMiddle.js';
import {buildRoom23PhysicalMachine as buildRoom23Balance} from './LabRoom23PhysicalMachine.js';
export const ROOM23_SPEC={id:'counterweight-reversal',title:'Вес возвращения',concept:'Передача настоящей нагрузки между противоположными кабинами под общим тормозом',description:'Две кабины и один барабан; грузовые поддоны и пассажирские площадки расположены на разных высотах.',accent:0xd9bb87,assets:[1,2,11,22,23,24],hints:['Пружинные грузовые поддоны меняют направление питаемого привода. Пассажир и друг действительно нагружают свои кабины.','На средней высоте края кабин сближаются. Общий тормоз держит барабан, пока нагрузка переходит с одного поддона на другой.','Муфта передаёт момент через прижатые диски. Снятый тормоз позволяет восточной кабине отвезти тебя на верхний обратный путь.']};

/** Isolated, unaccepted dynamic Room23 prototype. The normal builder uses
 * massive opposite cars; the former storage/empty-return walkthrough has
 * not been reaccepted for this changed topology. */
export function buildRoom23PhysicalPrototype(game,index=22){
 // Explicit component-fixture initial conditions are accepted only by this
 // opt-in experimental builder. The normal prototype starts at q=0 and uses
 // the authored spawn; no moving body reads or changes a checkpoint stage.
 const initial=game.room23PhysicalPrototypeInitialState??{},spawn=initial.spawn??[-17,0,15],cargoSpawn=initial.cargoSpawn??[-3.1,.6,3];
 const k=new Workshop(game,ROOM23_SPEC,index),w=k.world;w.highFidelity=true;k.bounds={minX:-23,maxX:23,minZ:-23,maxZ:22};k.ceiling=29;w.walls(k.bounds,29,-1);
 const deck=(name,x0,x1,z0,z1,y)=>{w.floor(x0,x1,z0,z1,y,{name});w.box([(x0+x1)/2,y-.28,(z0+z1)/2],[x1-x0,.32,z1-z0],w.materials.trim);};
 const block=(p,s)=>w.box(p,s,w.materials.wall);
 // Physical shaft openings keep the fixed court from carrying a passenger
 // through the lower dynamic cabin. The real lower stops close each well.
 deck('West recovery court',-23,-6.2,-23,22,0);deck('East recovery court',6.2,23,-23,22,0);
 deck('North recovery court',-6.2,6.2,-23,-.6,0);deck('South recovery court',-6.2,6.2,6.6,22,0);
 deck('West permanent disembarkation',-16,-6.2,-4,-.5,10);
 deck('Folded middle return',-20,20,-12,-4,10);
 deck('East permanent disembarkation',6.2,16,-4,-.5,10);
 deck('East side boarding ledge',6.2,8,-.5,6,10);
 const balance=buildRoom23Balance(k,{spawn,initialDisplacement:initial.displacement??0});
 // The initial remote freight mouth keeps the old cargo-only high hood;
 // its authored route and pan delivery are still an open prototype task.
 k.panel('freight-throat',[3.1,21,-1.5],[0,0,1],5.6,4.6);
 block([3.1,10,-1.85],[6.4,20,.6]);block([3.1,25.8,1.8],[6.4,6.4,3.5]);
 for(const x of [-.25,6.45])block([x,24.5,.8],[.3,9,5.5]);
 // A real narrow guide slot clears the east travelling ear at x=6.4.
 deck('High car exit apron',-.1,6.2,6.6,10,20);deck('Outer high car exit apron',6.6,8,6.6,10,20);
 deck('Upper return around the shaft',8,22,-17,10,20);
 deck('Upper maintenance crossover',-19,12,-16,-14,20);
 deck('West upper inspection walk',-19,-16,-17,10,20);
 deck('High receiving gallery',-5,22,-23,-17,20);
 block([14.8,9.9,-3.5],[.35,19.8,27]);
 block([0,14.5,-17],[10,29,.4]);block([-5.2,14.5,-20],[.4,29,6]);block([5.2,9.9,-20],[.4,19.8,6]);block([5.2,26.5,-20],[.4,5,6]);
 k.panel('high-return',[-4.85,22.3,-20],[1,0,0],5.6,4.6);
 k.control('balance-brake',[7,10,4.5],()=>balance.requestBrake(!balance.brakeRequested),'E — привести в движение колодки общего тормоза');
 k.control('balance-coupling',[-6.5,0,5.6],()=>balance.requestClutch(!balance.clutchRequested),'E — прижать или отвести диски муфты');
 k.control('ground-brake-release',[-7,0,1],()=>balance.requestBrake(false),'E — отвести колодки общего тормоза');
 installVisualAuditMiddleKit(k,23);
 const level=k.finish(spawn,cargoSpawn,[0,20,-20],{workshop:k,spec:ROOM23_SPEC,room23PhysicalPrototype:true,portalPuzzle:true,balance,cargoOnAnyPad:()=>balance.west.loaded()||balance.east.loaded()});
 // A positive spring-pan contact is a command to stay on this load surface.
 // The shared passive guard also suppresses the powered upright recovery,
 // which otherwise runs before the ordinary onPad stay check.
 level.passiveCompanionSupport=()=>balance.west.loaded()||balance.east.loaded();
 level.dispose=()=>balance.dispose();level.spawnView={yaw:-.80,pitch:-.15};
 level.mechanismArt={liftSurfaces:['west-load-car','east-load-car']};
 level.puzzleGeometry={footprint:46*45,occupiedHeights:[0,10,20],orders:['physical-direct-transfer-prototype'],noProgressFlags:true,
  portalRoles:{'west-load-car':'original cargo delivery and final retrieval on a real cabin','east-load-car':'the opposite massive carriage','freight-throat':'initial high delivery','high-return':'retrieve the original from the descended cabin'},
  deductions:['both cabins and the traveller are massive bodies','actual spring compression controls an external bounded supply','friction clutch and brake must carry current contact loads','the original crosses the two adjacent freight decks instead of resting in a permanent pocket'],
  prototype:true,declaredInitialComponentFixture:game.room23PhysicalPrototypeInitialState!==undefined,fullOrdinaryRouteAccepted:false,nativeAccepted:false,publicationAccepted:false};
 return level;
}
export {runRoom23} from './LabRoom23Journey.js';
