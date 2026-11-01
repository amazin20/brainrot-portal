import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
import {assertRoom14FieldOwnership} from './helpers/lab-room14-deflector-contract.js';

// Current ordinary routes/orders live in lab-room14-deflector-journey.test.js.
// The3generic old bridge regressions remain active, explicitly independent of
// current14, in lab-light-bridge-legacy-component.test.js.
test('current14 rerouting removes the retired oblique face without leaving a walking floor or cargo contact at its former address',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(13,false);
 try{
  const l=g.firstLevel,field=l.readability.field,place=(i,name)=>{const panel=l.panels[name],at=panel.getFrame().center.clone();if(name.startsWith('contact-'))at.y=1.25;assert.equal(g.placeOnPanel(i,panel.mesh,at),true);field.update();};
  place(0,'contact-intake');place(1,'contact-turn');assert.ok(field.segments.length>1);assertRoom14FieldOwnership(g);
  const output=field.pieces[1],before=output.collider.box.clone();assert.equal(output.collider.enabled,true);
  place(1,'passenger-arrival');assertRoom14FieldOwnership(g);assert.ok(output.collider.box.min.distanceTo(before.min)>1,'The field must actually leave its former freight-turn geometry');
  assert.equal(g.floors.some(f=>field.pieces.some(p=>p.mesh===f.mesh)),false,'Current14 never represents a vertical field as a horizontal support');
  g.portals.clear();field.update();assertRoom14FieldOwnership(g);assert.equal(output.collider.enabled,false);assert.equal(output.mesh.visible,false);assert.equal(output.body.collisionFilterMask,0);
 }finally{disposeLabLevel(g);}
});
