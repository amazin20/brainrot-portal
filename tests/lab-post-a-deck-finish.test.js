import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';

test('31, 33 and 34: offset carriage decks retain the shared world-mapped floor finish',async()=>{
 const game=await createHeadlessGame();
 try{
  game.chamberEdition='foundation';
  for(const [number,names]of [[31,['first','second']],[33,['car']],[34,['left','right']]]){
   await game.selectLevel(number-1,false);
   const floorMaterial=game.firstLevel.workshop.m.floor;
   assert.ok(floorMaterial.map,`Room ${number} must have a finished floor texture`);
   for(const name of names){
    const carrier=game.firstLevel[name];
    const deck=carrier.group.children.find(child=>child.isMesh&&child.material?.name===floorMaterial.name);
    assert.ok(deck,`Room ${number} missing its ${name} deck`);
    assert.notEqual(deck.material,floorMaterial,'Depth offset must apply only to the moving surface');
    assert.equal(deck.material.map,floorMaterial.map,'Moving and fixed floors must use the same finish');
    assert.ok(deck.material.polygonOffset&&deck.material.polygonOffsetFactor<0);

    // The actual UVs must have been baked in world space before the material
    // was cloned. A missing bake leaves moving decks with stretched tiles.
    const uv=deck.geometry.getAttribute('uv'),normal=deck.geometry.getAttribute('normal');
    const positions=deck.geometry.getAttribute('position');
    deck.updateWorldMatrix(true,false);
    let checked=0;
    for(let i=0;i<positions.count;i++){
     if(normal.getY(i)<.999)continue;
     const p=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(deck.matrixWorld);
     assert.ok(Math.abs(uv.getX(i)-p.x/6)<1e-5);
     assert.ok(Math.abs(uv.getY(i)-p.z/6)<1e-5);
     checked++;
    }
    assert.ok(checked>6,`Room ${number} ${name} has no mapped walking surface`);
   }
  }
 }finally{game.physics.dispose();game.portals.dispose();}
});
