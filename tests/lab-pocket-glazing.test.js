import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';

test('rear glazing rails overlap the glass edge without sharing its depth plane',async()=>{
 const g=await createHeadlessGame();await g.selectLevel(20,false);
 try{
  const glass=g.scene.getObjectByName('Counterweight inspection glass / solid');
  const pane=new T.Box3().setFromObject(glass),rails=[];
  g.scene.traverse(o=>{if(o.name.includes('glazing rail / solid'))rails.push(o);});
  assert.equal(rails.length,4);
  for(const rail of rails){
   const box=new T.Box3().setFromObject(rail);
   assert.ok(box.min.x<pane.min.x-.02&&box.max.x<pane.max.x-.02,'Coplanar glass/trim faces');
   assert.ok(box.intersectsBox(pane),'Trim must still cover the actual glass edge');
  }
 }finally{g.physics.dispose();g.portals.dispose();}
});
