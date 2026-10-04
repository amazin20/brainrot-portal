import {towerRoute,TOWER_ROUTE_REACTORS} from './LabTowerRoutes.js';

/** The tower is six connected storeys, each with three independently explorable
 * machine wings. A wing is a substantial puzzle, not a counter on a corridor.
 * The old 500 repeated floor switches are intentionally gone.
 */
export const TOWER_STAGE_COUNT=18;
export const TOWER_DECK_COUNT=6;
export const TOWER_RISE=8;
export const TOWER_SIDE=42;
export const TOWER_HALF_WIDTH=6.2;
export const TOWER_ENTRY_S=2;
export const TOWER_ENTRY_MAX_S=3;
export const TOWER_EXIT_S=38;
// There is no honest distance-only lower bound for a portal puzzle. The
// recorded, input-driven playthrough is the source of elapsed-time evidence.
export const TOWER_MANDATORY_DISTANCE=0;
export const TOWER_MINIMUM_SECONDS=0;

const BRANCHES=Object.freeze([
 Object.freeze({id:'east',name:'ВОСТОК',origin:[10,0],direction:[1,0]}),
 Object.freeze({id:'west',name:'ЗАПАД',origin:[-10,0],direction:[-1,0]}),
 Object.freeze({id:'north',name:'СЕВЕР',origin:[0,-10],direction:[0,-1]}),
]);

// Each recipe has a different physical dependency, not a differently coloured
// version of one switch. `order` is the order in which signals may latch; a
// solved wing stays solved for the remainder of this attempt only.
const PUZZLES=[
 {id:'prism',name:'ПРИЗМАТИЧЕСКИЙ УЗЕЛ',family:'optics',requirements:['mirror','beamA'],order:['mirror','beamA']},
 {id:'freight',name:'ПРОТИВОВЕСНЫЙ ДОК',family:'freight',requirements:['cargo','control','delivery','recovered'],order:['cargo','control','delivery','recovered']},
 {id:'exchange',name:'ШАХТА ИМПУЛЬСА',family:'fling',requirements:['transit','kinetic'],order:['transit','kinetic']},
 {id:'turbine',name:'МАСТЕРСКАЯ ТУРБИНЫ',family:'pneumatic',requirements:['airA','cargo'],order:['airA','cargo']},
 {id:'double-prism',name:'ДВА ПРИЁМНИКА',family:'optics',requirements:['beamA','beamB'],order:['beamA','beamB']},
 {id:'levitator',name:'ГРУЗОВОЙ ЛЕВИТАТОР',family:'gravity',requirements:['gravity','control'],order:['gravity','control']},
 {id:'battery',name:'СВЕТ И МАССА',family:'hybrid',requirements:['cargo','beamA','batteryOutput','beamB'],order:['cargo','beamA','batteryOutput','beamB']},
 {id:'windway',name:'ВОЗДУШНЫЙ ПЕРЕХОД',family:'pneumatic',requirements:['airA','transit','airLanding'],order:['airA','transit','airLanding']},
 {id:'vault',name:'РАЗГОННЫЙ СЕЙФ',family:'kinetic',requirements:['beamA','kinetic'],order:['beamA','kinetic']},
 {id:'magnet',name:'МАГНИТНАЯ ОПТИКА',family:'gravity',requirements:['gravity','beamA','cargoDock','beamB'],order:['gravity','beamA','cargoDock','beamB']},
 {id:'press',name:'ПРЕСС И ПРОТИВОВЕС',family:'kinetic',requirements:['cargo','kinetic'],order:['cargo','kinetic']},
 {id:'refraction',name:'ПЕРЕСТРОЙКА ЛУЧА',family:'optics',requirements:['mirror','beamA','chamberTurn','beamB'],order:['mirror','beamA','chamberTurn','beamB']},
 {id:'storm',name:'ГРОЗОВОЙ КОЛЛЕКТОР',family:'pneumatic',requirements:['airA','beamB'],order:['airA','beamB']},
 {id:'relay',name:'ОБМЕН ПИТАНИЕМ',family:'portal',requirements:['transit','cargo','control'],order:['transit','cargo','control']},
 {id:'balance',name:'ПЛАВУЧИЙ БАЛАНС',family:'gravity',requirements:['cargo','gravity','bridgeCatch'],order:['cargo','gravity','bridgeCatch']},
 {id:'confluence',name:'СЛИЯНИЕ ПОТОКОВ',family:'hybrid',requirements:['mirror','beamA','airA'],order:['mirror','beamA','airA']},
 {id:'crown-drive',name:'ПРИВОД КОРОНЫ',family:'hybrid',requirements:['cargo','beamB','kinetic'],order:['cargo','beamB','kinetic']},
 {id:'last-aperture',name:'ПОСЛЕДНЯЯ АПЕРТУРА',family:'finale',requirements:['gravity','transit','airA'],order:['gravity','transit','airA']},
];

const pick=stage=>typeof stage==='number'?{index:stage,deck:Math.floor(stage/3),branch:stage%3}:stage;
export function towerHeight(stage){return pick(stage).deck*TOWER_RISE;}
/** s is distance into a wing; n points to the wing's left wall. */
export function towerPoint(stage,s,n=0,y){
 const item=pick(stage),branch=BRANCHES[item.branch],[dx,dz]=branch.direction;
 return [branch.origin[0]+dx*s-dz*n,y??item.baseY??towerHeight(item),branch.origin[1]+dz*s+dx*n];
}
export function towerCoordinates(stage,position){
 const item=pick(stage),branch=BRANCHES[item.branch],[dx,dz]=branch.direction;
 const x=position.x??position[0],z=position.z??position[2];
 return {s:(x-branch.origin[0])*dx+(z-branch.origin[1])*dz,
  n:(x-branch.origin[0])*-dz+(z-branch.origin[1])*dx};
}

const freezePosition=p=>Object.freeze(p);

export const TOWER_STAGES=Object.freeze(PUZZLES.map((puzzle,index)=>{
 const deck=Math.floor(index/3),branch=index%3,baseY=deck*TOWER_RISE;
 const reactorN=TOWER_ROUTE_REACTORS[puzzle.id]??0;
 const descriptor={index,number:index+1,id:puzzle.id,deck,branch,sector:deck,baseY,reactorN,
  direction:Object.freeze([...BRANCHES[branch].direction]),branchName:BRANCHES[branch].name,
  name:puzzle.name,pattern:puzzle.name,patternIndex:index,
  puzzle:Object.freeze({...puzzle,requirements:Object.freeze([...puzzle.requirements]),order:Object.freeze([...puzzle.order])}),
  entry:freezePosition(towerPoint(index,2)),reactor:freezePosition(towerPoint(index,38,reactorN)),exit:freezePosition(towerPoint(index,38,reactorN)),
  panelInput:freezePosition(towerPoint(index,8,6.04,baseY+2.4)),
  panelOutputA:freezePosition(towerPoint(index,14,-6.04,baseY+2.4)),
  panelOutputB:freezePosition(towerPoint(index,20,-6.04,baseY+2.4)),
  cargoPad:freezePosition(towerPoint(index,puzzle.id==='battery'?20.8:5.1,
   puzzle.id==='battery'?15.4:0,baseY+(puzzle.id==='battery'?1.2:0))),
  batteryOutput:puzzle.id==='battery'?freezePosition(towerPoint(index,30.5,15.15,baseY+1.2)):null,
  control:freezePosition(towerPoint(index,5,-2,baseY+.9)),
 };
 descriptor.route=towerRoute(descriptor);
 descriptor.waypoints=Object.freeze(descriptor.route.filter(a=>a.kind==='walk').map(a=>Object.freeze({position:a.target})));
 return Object.freeze(descriptor);
}));

export const TOWER_DECKS=Object.freeze(Array.from({length:TOWER_DECK_COUNT},(_,deck)=>Object.freeze({
 deck,baseY:deck*TOWER_RISE,branchIds:Object.freeze(TOWER_STAGES.slice(deck*3,deck*3+3).map(s=>s.id)),
 stairEntry:freezePosition([0,deck*TOWER_RISE,10.2]),
 stairExit:freezePosition([0,(deck+1)*TOWER_RISE,34]),
 upperReturn:freezePosition([8,(deck+1)*TOWER_RISE,34]),
 upperHub:freezePosition([8,(deck+1)*TOWER_RISE,7]),
})));
