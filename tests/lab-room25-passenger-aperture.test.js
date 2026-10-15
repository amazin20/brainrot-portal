import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';

test('Room25 actual metal passenger decks reject portal placement and retain original cargo plus mechanical support contacts',async()=>{
 const game=await createHeadlessGame();
 try{
  for(const name of ['shadow-lift','relay-lift']){
   await game.selectLevel(24,true);
   const car=game.firstLevel.state[name],original=game.physics.cargoBody,shape=original.shapes[0],cargo=game.cargo;
   const frame=car.surface.getFrame(),position=[frame.center.x,frame.center.y+1,frame.center.z];
   game.physics.resetCargo({position});cargo.position.fromArray(position);cargo.previousPosition?.copy(cargo.position);cargo.quaternion.copy(original.quaternion);game.companionBehavior?.reanchor(cargo.position);
   let contacts=0;
   const advance=()=>{for(let n=0;n<180;n++){
    game.updatePlaying(1/120);
    contacts+=game.physics.world.contacts.filter(c=>c.enabled!==false&&c.multiplier>0&&((c.bi===original&&c.bj===car.body)||(c.bj===original&&c.bi===car.body))).length;
   }};
   advance();assert.ok(contacts>0,name+' must physically support the unchanged original cargo');
   assert.ok(Math.abs(original.position.y-(car.position.y+.39))<.06);
   assert.equal(car.surface.portal,false);assert.equal(car.surface.mesh.userData.portalable,undefined);assert.equal(game.portalPanels.includes(car.surface.mesh),false);
   assert.deepEqual(game.portals.placeOnPanel(0,car.surface.mesh,car.surface.getFrame().center),{ok:false,reason:'forbidden'});
   const home=game.firstLevel.panels.home;
   assert.equal(game.portals.placeOnPanel(1,home.mesh,home.getFrame().center).ok,true);game.portalSurfaceIds[1]=home.mesh.uuid;
   assert.equal(game.portals.ready,false,'A legal remote portal does not turn metal into a portal host');
   const transports=game.physics.portalTransports;contacts=0;advance();
   assert.equal(game.physics.portalTransports,transports);assert.ok(contacts>0);assert.ok(car.parts.every(p=>!p.apertureOpened));
   assert.equal(game.physics.cargoBody,original);assert.equal(original.shapes[0],shape);assert.equal(game.cargo,cargo);
   assert.equal(car.diagnostics().liveOwnership,true);assert.ok(car.diagnostics().endStopContacts>0);
  }
 }finally{game.firstLevel?.dispose?.();game.physics.dispose();game.portals.dispose();}
});
