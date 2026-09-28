/** Pure, deterministic geometry contract for the final ascent.
 * No clocks, actor mutations, random generation, or checkpoint locations.
 * s runs forward along one square side; n runs toward the outside of the shaft.
 */
export const TOWER_STAGE_COUNT = 500;
export const TOWER_SIDE = 14;
export const TOWER_RISE = 2;
export const TOWER_HALF_WIDTH = 2.2;
export const TOWER_ENTRY_S = 1;
export const TOWER_EXIT_S = 12.8;
export const TOWER_ENTRY_MAX_S = 1.12;
export const TOWER_MANDATORY_DISTANCE = TOWER_STAGE_COUNT * (TOWER_EXIT_S - TOWER_ENTRY_MAX_S);
export const TOWER_MINIMUM_SECONDS = TOWER_MANDATORY_DISTANCE / 5;
const CORNERS = [[0,0],[14,0],[14,-14],[0,-14]];
const DIRECTIONS = [[1,0],[0,-1],[-1,0],[0,1]];
const PATTERNS = [
 {name:'ЛЕВЫЙ КОНТУР',plates:[[4.8,-1.22]],path:[[1.5,0],[3.3,-1.22],[4.8,-1.22],[6.5,0]],blocks:[]},
 {name:'ПРАВЫЙ КОНТУР',plates:[[4.8,1.22]],path:[[1.5,0],[3.3,1.22],[4.8,1.22],[6.5,0]],blocks:[]},
 {name:'ЗМЕЙКА',plates:[[5.5,-1.22]],path:[[1.5,0],[2.6,1.3],[3.9,1.3],[3.98,-1.3],[4.8,-1.3],[5.5,-1.22],[6.5,0]],blocks:[[3.1,-.95,2.45,0.34,3.3],[4.85,.95,2.45,.34,3.3]]},
 {name:'ДВОЙНАЯ ЦЕПЬ',plates:[[3,-1.22],[5.3,1.22]],path:[[1.5,0],[3,-1.22],[4.1,0],[5.3,1.22],[6.5,0]],blocks:[]},
 {name:'ОБХОД СЛЕВА',plates:[[5.3,-1.22]],path:[[1.5,0],[2.5,-1.4],[4.7,-1.4],[5.3,-1.22],[6.5,0]],blocks:[[3.65,0,1.7,1.45,3.4]]},
 {name:'ОБХОД СПРАВА',plates:[[5.3,1.22]],path:[[1.5,0],[2.5,1.4],[4.7,1.4],[5.3,1.22],[6.5,0]],blocks:[[3.65,0,1.7,1.45,3.4]]},
 {name:'ПЕРЕКРЁСТНЫЕ ЛОПАСТИ',plates:[[5.5,1.22]],path:[[1.5,0],[2.6,-1.3],[3.9,-1.3],[3.98,1.3],[4.8,1.3],[5.5,1.22],[6.5,0]],blocks:[[3.1,.95,2.45,.34,3.3],[4.85,-.95,2.45,.34,3.3]]},
 {name:'СТУПЕНЧАТЫЙ ПРИВОД',plates:[[5.2,-1.22]],path:[[1.5,0],[3,-1.22],[4.25,-1.22],[5.2,-1.22],[6.5,0]],blocks:[[3.7,0,4.38,.7,.3]]},
 {name:'ПЕРЕПРЫГНИ БАЛКУ',plates:[[5.5,1.22]],path:[[1.5,0],[2.45,0],[3.05,0,'jump'],[4.9,0],[5.5,1.22],[6.5,0]],blocks:[[3.9,0,4.38,.32,.64]]},
 {name:'ДВА РЕГУЛЯТОРА',plates:[[3,1.22],[5.3,-1.22]],path:[[1.5,0],[3,1.22],[4.1,0],[5.3,-1.22],[6.5,0]],blocks:[]},
 {name:'ВНЕШНЯЯ ГАЛЕРЕЯ',plates:[[4.8,1.25]],path:[[1.5,0],[2.6,1.4],[4.8,1.25],[5.6,1.4],[6.5,0]],blocks:[[4.1,-.65,2.6,2.2,3.4]]},
 {name:'ВНУТРЕННЯЯ ГАЛЕРЕЯ',plates:[[4.8,-1.25]],path:[[1.5,0],[2.6,-1.4],[4.8,-1.25],[5.6,-1.4],[6.5,0]],blocks:[[4.1,.65,2.6,2.2,3.4]]},
];
export function towerHeight(stage,s) {
 const base=typeof stage==='number'?stage*TOWER_RISE:stage.baseY;
 if(s<7.8)return base;
 if(s>=11)return base+TOWER_RISE;
 return base+Math.min(8,Math.floor((s-7.8)/.4)+1)*.25;
}
export function towerPoint(stage,s,n=0,y) {
 const i=typeof stage==='number'?stage:stage.index,q=i%4,[x,z]=CORNERS[q],[dx,dz]=DIRECTIONS[q];
 return [x+dx*s-dz*n,y??towerHeight(i,s),z+dz*s+dx*n];
}
export function towerCoordinates(stage,position) {
 const i=typeof stage==='number'?stage:stage.index,[x,z]=CORNERS[i%4],[dx,dz]=DIRECTIONS[i%4];
 const px=position.x??position[0],pz=position.z??position[2];
 return {s:(px-x)*dx+(pz-z)*dz,n:(px-x)*-dz+(pz-z)*dx};
}
export const TOWER_STAGES = Object.freeze(Array.from({length:TOWER_STAGE_COUNT},(_,index)=>{
 const pattern=PATTERNS[index%PATTERNS.length];
 const descriptor={index,number:index+1,sector:Math.floor(index/20),baseY:index*TOWER_RISE,
  direction:Object.freeze([...DIRECTIONS[index%4]]),pattern:pattern.name,patternIndex:index%PATTERNS.length,
  plates:pattern.plates.map(([s,n])=>Object.freeze({s,n,position:Object.freeze(towerPoint(index,s,n))})),
  obstacles:pattern.blocks.map(([s,n,width,depth,height])=>Object.freeze({s,n,width,depth,height})),
  entry:Object.freeze(towerPoint(index,TOWER_ENTRY_S)),exit:Object.freeze(towerPoint(index,TOWER_EXIT_S)),
  // Walking these actual route points is sufficient; progression is exclusively
  // the live level's collision/plate sensors, never a journey instruction.
  waypoints:[...pattern.path.map(([s,n,action])=>({position:towerPoint(index,s,n),...(action?{action}:{}),s,n})),
   ...[7.15,7.65,8.25,9.05,9.85,10.65,11.5,TOWER_EXIT_S+.12].map(s=>({position:towerPoint(index,s),s,n:0}))],
 };
 descriptor.waypoints=Object.freeze(descriptor.waypoints.map(p=>Object.freeze({...p,position:Object.freeze(p.position)})));
 return Object.freeze(descriptor);
}));
