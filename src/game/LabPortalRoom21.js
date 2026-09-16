import * as THREE from 'three';
import { Workshop } from './LabWorkshopKit.js';
import { cargoLoadsPlate } from './LabPlateContact.js';
import { buildPocketCassette, addPocketExitMarker } from './LabPocketCassette.js';

export const ROOM21_SPEC = {
  id: 'gravity-pocket', title: 'Гравитационный карман',
  concept: 'Освобождение друга поднимает уже установленный портал: меняется высота выхода, а не правило переноса',
  description: 'Выход над сервисной галереей. Разберись в связях кассеты и грузового кармана, чтобы выбраться вместе.',
  accent: 0x9bc8c3, assets: [1,2,11,22,23,24],
  hints: ['Груз и механический тормоз независимо удерживают подвижную кассету.',
    'Нижнее окно ведёт в сервисный карман. Там есть постоянная опора и доступ к другу.',
    'Освободи тормоз, доставь друга в приёмник и поставь портал на опустившуюся кассету. Сервисная площадка позволяет забрать друга и упасть во вход снова, пока тот же выход поднимается.'],
};

/** Complete replacement, not another extension of the old two-pass layout.
 * Five portalable faces, one load-operated cassette, three occupied heights.
 * The engine's gravity, cargo body, placement and win rules are unchanged. */
export function buildRoom21(game,index=20) {
  const k=new Workshop(game,ROOM21_SPEC,index), w=k.world;
  w.highFidelity=true;
  k.bounds={minX:-20,maxX:24,minZ:-17,maxZ:19}; k.ceiling=29;
  w.walls(k.bounds,k.ceiling,-1);
  const floor=(name,x0,x1,z0,z1,y)=>{
    const s=w.floor(x0,x1,z0,z1,y,{name});
    w.box([(x0+x1)/2,y-.27,(z0+z1)/2],[x1-x0,.30,z1-z0],w.materials.trim);
    return s;
  };
  const stair=(name,x0,x1,z0,z1,lo,hi)=>{
    const n=Math.ceil((hi-lo)/.25);
    for(let i=0;i<n;i++) {
      const a=z0+(z1-z0)*i/n,b=z0+(z1-z0)*(i+1)/n;
      floor(name,x0,x1,Math.min(a,b),Math.max(a,b),lo+(hi-lo)*(i+1)/n);
      // Structural riser all the way down; no floating stack of thin shelves.
      const y=lo+(hi-lo)*(i+1)/n;
      w.box([(x0+x1)/2,y/2,(a+b)/2],[x1-x0,y,Math.abs(b-a)],w.materials.wall);
    }
  };
  floor('Connected recovery basin',-20,24,-17,19,0);
  floor('Departure gallery',-15,2,8,18,10);
  stair('Single recovery stair',-18.5,-15.5,0,17,0,10);
  floor('Recovery stair arrival',-18.5,-15,17,18,10);
  floor('Brake inspection bay',-19,-13,-16,-10.5,4);
  floor('Permanent service pocket',-2,23,-14,-3,7);
  // The receiver-side inspection apron closes the underside sightline; the
  // central service fall at x0 remains open and the east stair is unobstructed.
  floor('Receiver inspection apron',6,19.3,-3,1.5,7);
  floor('Upper arrival balcony',-2,23,-14,-3,18);
  stair('Cargo service stair',19.5,23,7,-3,3,7);
  floor('Retrieval landing',19.5,23,7,10,3.1);
  for(const x of [-12,-3])w.box([x,4.85,16.8],[.7,9.7,.7],w.materials.trim);
  for(const x of [-18,-14.5])w.box([x,1.85,-14.5],[.6,3.7,.6],w.materials.trim);
  // Visible pillars explain the two permanent balconies. They are out of the flights.
  for(const x of [21.8])for(const z of [-12.8,-4.2])w.box([x,8.8,z],[.7,17.6,.7],w.materials.trim);
  for(const y of [7,18]) {
    for(const z of [-14.1])w.box([10.5,y+.65,z],[25,1.3,.20],w.materials.trim);
    w.box([23.1,y+.65,-8.5],[.20,1.3,11],w.materials.trim);
  }
  // The open south edge of the service pocket is a new, lower fall source.
  // The start has its own visible open drop lip; neither is an invisible trigger.
  w.box([-7.5,10.65,7.85],[9,1.3,.22],w.materials.trim); // Open inspection sightline at the west end.

  const entry=k.panel('departure-entry',[-14.8,12,14],[1,0,0],5.6,4.6);
  const inspection=k.panel('brake-bay',[-16,6,-15.8],[0,0,1],5.6,4.6);
  const well=k.panel('shared-well',[0,.025,2],[0,1,0],6,14);
  const freight=k.panel('freight-mouth',[-5,8.7,6],[1,0,0],5.6,4.6);
  // Freight mouth is supported by a continuous equipment pier, not an isolated prop.
  w.box([-5.35,4.6,6],[.60,9.2,5.8],w.materials.wall);

  floor('Freight receiver floor',7,19.5,2,10,3);
  const tray=w.surface({name:'Graphite receiver',position:[13.25,3.10,6],normal:[0,1,0],width:12.5,height:8,portal:false,kind:'floor',authored:true});
  tray.group.userData.keepMaterial=true;
  game.floors.push({minX:7,maxX:19.5,minZ:2,maxZ:10,y:3.10,mesh:tray.mesh,enabled:true});
  const cargoSeat={surface:tray,loaded:()=>cargoLoadsPlate(game.cargo,game.heldCube,tray.getFrame())};
  k.pads.push(cargoSeat); k.state.cargoSeat=cargoSeat;
  // A full-height structural wall separates the balcony and cargo chamber.
  // The only low opening is 2.1 m high: wider than the friend, shorter than a standing player.
  w.box([5.5,2.55,6],[.7,5.1,8],w.materials.wall);
  w.box([5.5,11.7,6],[.7,9.0,8],w.materials.wall);
  w.box([5.5,8,14.5],[.7,16,9],w.materials.wall);
  w.box([5.5,8,1],[.7,16,2],w.materials.wall);
  // Upper equipment casing is solid, so its low inner ceiling is not a shortcut roof.
  w.box([13.1,12.25,6],[14.5,7.5,8],w.materials.wall);
  w.box([13.1,5.6,10.15],[14.5,5.2,.3],w.materials.wall);
  w.box([13.1,5.8,1.85],[14.5,5.6,.3],w.materials.wall);
  w.box([19.65,5.6,2.7],[.3,5.2,1.5],w.materials.wall);
  w.box([19.65,5.6,9.3],[.3,5.2,1.5],w.materials.wall);

  const cassette=buildPocketCassette(k,cargoSeat);
  k.state.cassette=cassette;
  k.control('cassette-brake',[-16.7,4,-12.2],()=>cassette.toggleBrake(),
    'Тормоз кассеты. Груз опускает её; противовес поднимает освобождённую поверхность.');
  addPocketExitMarker(k,[12,18,-8]);
  const level=k.finish([-9,10,13],[-4,10.55,13],[12,18,-8],{
    workshop:k,spec:ROOM21_SPEC,portalPuzzle:true,cassette,
    puzzleGeometry:{revision:'clean-slate-cassette-1',footprint:44*36,
      occupiedHeights:[3.1,4,7,10,18],orders:['cargo-first','brake-first'],
      noProgressFlags:true,oneMechanism:true,sourceHeights:[10,7],
      cargoWindow:{minY:5.1,maxY:7.2},
      portalRoles:{'departure-entry':'round trip to brake bay','brake-bay':'independent brake preparation',
        'shared-well':'the same fall entry used from two permanent galleries',
        'freight-mouth':'free cargo reaches receiver through a low mouth',
        'moving-cassette':'one persistent portal changes height when cargo is recovered'}}
  });
  level.spawnView={yaw:-.6,pitch:-.22};
  return level;
}
