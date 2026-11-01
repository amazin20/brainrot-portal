import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
import {assertRoom14FieldOwnership} from './helpers/lab-room14-deflector-contract.js';

// Formerly a parented counterweight-stair pose regression. The same drift,
// restart and physical-owner risks now concern the finite oriented field and
// its four real tilted fixed supports. Ordinary contact motion is separately
// covered by lab-room14-deflector-journey.test.js, with no fixture actor writes.
test('current14 light and tilted fixed owners retain exact world contact through30s idle and normal restarts',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(13,false);
 try{
  const cargo=g.cargo,body=g.physics.cargoBody,shape=body.shapes[0];assertRoom14FieldOwnership(g);
  for(let n=0;n<3600;n++){g.updatePlaying(1/120);if(n%2===1)g.updateVisuals(1/60,1);if(n%120===0)assertRoom14FieldOwnership(g);}
  for(let n=0;n<3;n++){g.restart();g.updatePlaying(1/120);g.updateVisuals(1/60,1);assertRoom14FieldOwnership(g);}
  assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(body.shapes[0],shape);
 }finally{disposeLabLevel(g);}
});
test('current14 equal configured readdresses reuse the same physical shapes and never mix render interpolation with contact pose',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(13,false);
 try{
  const field=g.firstLevel.readability.field,owners=field.owned.map(p=>({p,body:p.body,shape:p.shape}));
  const place=(i,name)=>{const panel=g.firstLevel.panels[name],at=panel.getFrame().center.clone();if(name.startsWith('contact-'))at.y=1.25;assert.equal(g.placeOnPanel(i,panel.mesh,at),true);field.update();};
  for(const destination of ['contact-turn','passenger-arrival','contact-turn']){
   place(0,'contact-intake');place(1,destination);assert.ok(field.segments.length>1);
   for(let n=0;n<120;n++){g.updatePlaying(1/120);for(const alpha of [0,.5,1])g.firstLevel.renderUpdate(alpha);assertRoom14FieldOwnership(g);}
   for(const {p,body,shape} of owners){assert.equal(p.body,body);assert.equal(p.shape,shape);}
  }
  g.portals.clear();field.update();assertRoom14FieldOwnership(g);assert.ok(field.pieces.slice(1).every(p=>!p.collider.enabled&&!p.body.collisionFilterMask));
 }finally{disposeLabLevel(g);}
});
