import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gameplayContract} from './lab-art-contract.js';
const fixture=JSON.parse(readFileSync(new URL('../fixtures/second-chapter-mounts-contract.json',import.meta.url)));
const hash=array=>createHash('sha256').update(Buffer.from(array.buffer,array.byteOffset,array.byteLength)).digest('hex');
/** Accept only the 24 closed, visible mounting pieces measured for this change.
 * Every other query, collision, state and portal row is compared verbatim. */
export function originalSecondChapterContract(game){
 const c=gameplayContract(game),mounting=game.firstLevel.secondChapterArt?.mounting;
 if(!mounting)return c;
 const names=Object.keys(fixture).filter(name=>name.startsWith(`${game.firstLevel.index+1} / `));
 assert.deepEqual(mounting.meshes.map(m=>m.name).sort(),names.sort(),'Exact room-local visible mount membership');
 for(const registry of [game.cameraBlockers,game.aimBlockers]){
  assert.deepEqual(registry.filter(m=>m.userData.secondChapterMount).map(m=>m.name).sort(),names,'No hidden or extra mount owner');
  for(const m of mounting.meshes)assert.equal(registry.filter(n=>n===m).length,1,'One registration of actual visible mesh');
 }
 for(const m of mounting.meshes){
  const f=fixture[m.name];assert.equal(m.parent,game.firstLevel.secondChapterArt);assert.ok(m.visible&&m.material.visible&&!m.material.transparent);
  for(let p=m;p;p=p.parent)assert.equal(p.visible,true,'Mount ancestry remains visible');
  assert.equal(hash(m.geometry.attributes.position.array),f.positionSha256,'Exact finite support triangles');
  assert.equal(hash(m.geometry.attributes.normal.array),f.normalSha256,'Exact support normals');
  assert.equal(hash(m.geometry.attributes.color.array),f.colorSha256,'Exact cast material faces');
  for(const key of ['camera','aim']){
   const rows=c[key].filter(row=>row.name===m.name);assert.equal(rows.length,1);assert.deepEqual(rows[0],f.query,'Exact visible support pose');
  }
  const rows=c.colliders.filter(row=>row.mesh.name===m.name);assert.equal(rows.length,1);assert.deepEqual(rows[0],f.collider,'Exact piece-wise physical bounds');
  const owned=game.physics.solids.get(m.uuid),physical=game.colliders.find(row=>row.mesh===m);
  assert.ok(owned&&physical,'Visible support owns a registered physical Box');
  const body=owned.body,center=physical.box.getCenter(m.position.clone()),half=physical.box.getSize(m.position.clone()).multiplyScalar(.5);
  assert.equal(body.labId,m.uuid);assert.equal(body.mass,0);assert.equal(body.type,2);assert.equal(body.collisionFilterGroup,1);assert.equal(body.collisionFilterMask,2);assert.equal(body.collisionResponse,true);
  assert.deepEqual(body.position.toArray(),center.toArray());assert.deepEqual(body.quaternion.toArray(),[0,0,0,1]);assert.equal(body.shapes.length,1);assert.deepEqual(body.shapes[0].halfExtents.toArray(),half.toArray());
  assert.equal(game.physics.world.bodies.includes(body),owned.inWorld,'Physical streaming follows the actual owned body');
 }
 return {...c,colliders:c.colliders.filter(row=>!names.includes(row.mesh.name)),camera:c.camera.filter(row=>!names.includes(row.name)),aim:c.aim.filter(row=>!names.includes(row.name))};
}
