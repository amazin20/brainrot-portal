import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {labInstrument} from '../src/game/LabHumanLab.js';
import {finishVisualAuditLate} from '../src/game/LabVisualAuditLate.js';

function recordingCanvas(){
 const calls=[],context={fillRect(){},fillText(text,x,y,maxWidth){calls.push({text,font:this.font,x,y,maxWidth});}};
 return {calls,getContext:()=>context};
}
const dispose=g=>{g.firstLevel?.dispose?.();g.physics?.dispose();g.portals?.dispose();};

test('opposed pressure board prioritizes signed live delta while retaining five-Hz change-only uploads and its physical face',()=>{
 const previous=globalThis.document,canvas=recordingCanvas(),values={left:74,right:28,difference:46,stroke:12.4};
 globalThis.document={createElement:()=>canvas};
 const kit={ticks:[],geometry(geometry,material,position,quaternion){this.face=new THREE.Mesh(geometry,material);this.face.position.fromArray(position);this.face.quaternion.copy(quaternion);}};
 try{
  const read=()=>`A ${values.left.toFixed(0)} кПа / B ${values.right.toFixed(0)} кПа\nПЕРЕПАД ${values.difference.toFixed(0)} кПа / ХОД ${values.stroke.toFixed(1)} м`;
  const instrument=labInstrument(kit,[0,16,-16.6],{width:26,height:2,read,layout:'opposed-pressure',readings:()=>values});
  const texts=()=>canvas.calls.slice(-4).map(c=>c.text),font=c=>Number(c.font.match(/(\d+)px/)[1]);
  assert.deepEqual(texts(),['A 74 кПа','B 28 кПа','Δ +46 кПа','ХОД 12.4 м']);
  assert.ok(font(canvas.calls[2])>font(canvas.calls[0])&&font(canvas.calls[0])>font(canvas.calls[3]));
  assert.equal(kit.face.geometry.parameters.width,26);assert.equal(kit.face.geometry.parameters.height,2);
  assert.deepEqual(kit.face.position.toArray(),[0,16,-16.6]);assert.ok(kit.face.quaternion.equals(new THREE.Quaternion()));
  assert.equal(kit.ownedTextures.length,1);assert.equal(kit.face.material.map,kit.ownedTextures[0]);
  const tick=kit.ticks[0],version=kit.ownedTextures[0].version;
  Object.assign(values,{left:18,right:63,difference:-45,stroke:-8.2});tick(.11);
  assert.equal(instrument.updates,1);assert.equal(kit.ownedTextures[0].version,version);
  tick(.09);assert.equal(instrument.updates,2);assert.equal(kit.ownedTextures[0].version,version+1);
  assert.deepEqual(texts(),['A 18 кПа','B 63 кПа','Δ −45 кПа','ХОД -8.2 м']);
  values.left=18.01;tick(.2);assert.equal(instrument.updates,2,'unchanged rounded values must not upload');
  assert.equal(canvas.calls.length,8);
 }finally{kit.face?.geometry.dispose();kit.face?.material.dispose();kit.ownedTextures?.forEach(t=>t.dispose());globalThis.document=previous;}
});

test('actual42 wide pressure instrument selects the differential layout and retains all four local live dials',async()=>{
 const g=await createHeadlessGame(),previous=globalThis.document;g.chamberEdition='foundation';g.puzzleProgression=true;
 globalThis.document={...previous,createElement:()=>recordingCanvas()};
 try{
  await g.selectLevel(41,false);const l=g.firstLevel,face=l.world.root.getObjectByName('Process instrument');
  assert.ok(face);assert.equal(face.geometry.parameters.width,26);assert.equal(face.geometry.parameters.height,2);
  assert.deepEqual(face.position.toArray(),[0,16,-16.6]);
  assert.deepEqual(face.material.map.image.calls.slice(-4).map(c=>c.text),['A 0 кПа','B 0 кПа','Δ +0 кПа','ХОД 0.0 м']);
  assert.equal(l.visualAuditLateBound.instruments,4);
  assert.equal(l.workshop.ownedTextures.filter(t=>t===face.material.map).length,1);
 }finally{globalThis.document=previous;dispose(g);}
});

test('chapter40 and synthesis46 finish accents remain a single flat field strictly inside the real joint occupancy footprint',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';g.puzzleProgression=true;
 try{
  for(const n of [40,46]){
   await g.selectLevel(n-1,false);const l=g.firstLevel,field=l.visualAuditLateGoal;
   assert.ok(field);assert.deepEqual(field.footprint,[4,3.8]);assert.deepEqual(field.position,l.goal.position.toArray());
   const registries=[g.colliders,g.cameraBlockers,g.aimBlockers,g.portalPanels].map(r=>r.slice());
   finishVisualAuditLate(g,l,n-1,[l.world.root]);
   assert.equal(l.world.root.children.filter(c=>c.name==='Late finish / true joint occupancy field').length,1);
   assert.deepEqual([g.colliders,g.cameraBlockers,g.aimBlockers,g.portalPanels],registries);
   const bounds=new THREE.Box3().setFromObject(field.root),p=l.goal.position;
   assert.ok(bounds.min.x>p.x-2.1&&bounds.max.x<p.x+2.1&&bounds.min.z>p.z-2&&bounds.max.z<p.z+2);
   assert.ok(bounds.min.y>p.y+.02&&bounds.max.y<p.y+.04);
   assert.equal(field.root.children[0].material.opacity,.86);assert.equal(field.root.children[1].count,10);
   for(const x of [bounds.min.x,bounds.max.x])for(const z of [bounds.min.z,bounds.max.z])assert.equal(l.goal.contains(new THREE.Vector3(x,p.y,z)),true);
   const resources=[...field.root.children.flatMap(m=>[m.geometry,m.material])],counts=new Map(resources.map(r=>[r,0]));
   for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));
   l.dispose();l.dispose();for(const count of counts.values())assert.equal(count,1,'field resources must dispose exactly once');
  }
 }finally{dispose(g);}
});

test('rail48 passive court walls have quieter enamel while actual carriage and roof retain working contrast',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';g.puzzleProgression=true;
 try{
  await g.selectLevel(47,false);const l=g.firstLevel,k=l.workshop;
  assert.equal(k.visualAuditLate.quietPassiveBulkheads,16);
  assert.equal(k.visualAuditLateQuietWalls.length,16);
  g.scene.updateMatrixWorld(true);
  const contrast=(root,contains=()=>true)=>{
   let count=0,min=1,max=0;const point=new THREE.Vector3();
   root.traverse(m=>{const p=m.geometry?.attributes.position,c=m.geometry?.attributes.color;if(!c)return;
    for(let i=0;i<p.count;i++){
     point.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);if(!contains(m,point))continue;
     const value=(c.getX(i)+c.getY(i)+c.getZ(i))/3;min=Math.min(min,value);max=Math.max(max,value);count++;
    }
   });assert.ok(count>900,'measure actual manufactured faces');return max-min;
  };
  const wall=contrast(l.world.root,(m,p)=>m.material?.name==='Fabricated device enamel / bulkhead'&&p.x>=-17.00001&&p.x<=29.00001&&p.y>=11&&p.y<=26.00001&&p.z>=8.74999&&p.z<=9.25001);
  assert.ok(wall<.12,'the broad passive wall must not compete with working machinery');
  for(const name of ['48 / dynamic spring rail carriage','48 / physical pin-operated freight roof']){
   const group=l.world.root.getObjectByName(name);assert.ok(group);assert.ok(contrast(group)>.4,'real moving machinery must keep its ivory/copper contrast');
   group.traverse(m=>assert.notEqual(m.userData.quietPassiveBulkhead,true));
  }
  assert.ok(l.world.root.getObjectByName('48 / removable transverse contact pin'));
 }finally{dispose(g);}
});
