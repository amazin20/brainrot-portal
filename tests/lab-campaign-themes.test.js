import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CAMPAIGN_THEMES,campaignTheme} from '../src/game/LabCampaignThemes.js';
import {finishCampaignTheme} from '../src/game/LabCampaignThemeFinish.js';

test('Five exact ten-room themes and a separate epilogue preserve original numbering',()=>{
 assert.equal(CAMPAIGN_THEMES.length,6);
 assert.deepEqual(CAMPAIGN_THEMES.map(t=>t.to-t.from+1),[10,10,10,10,10,1]);
 for(let i=0;i<51;i++)assert.equal(campaignTheme(i).id,CAMPAIGN_THEMES[Math.min(5,Math.floor(i/10))].id);
 for(const invalid of [-1,51,1.1,NaN,'1'])assert.throws(()=>campaignTheme(invalid),RangeError);
 assert.equal(new Set(CAMPAIGN_THEMES.map(t=>t.wall)).size,6);
 assert.equal(new Set(CAMPAIGN_THEMES.map(t=>t.floor)).size,6);
});
function fixture(){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xffffff);scene.fog=new THREE.Fog(0xffffff,50,100);
 const floor=new THREE.MeshStandardMaterial({name:'Honed mineral walking deck',color:0xabcdef});
 const portal=new THREE.MeshStandardMaterial({name:'Portal porcelain',color:0xfffefe});
 const actor=new THREE.MeshStandardMaterial({name:'Satin enamel / machine family',color:0x345678});
 const signal=new THREE.MeshStandardMaterial({name:'Inset signal diffuser',color:0xf12345});
 const root=new THREE.Group(),asset=new THREE.Group();scene.add(root);
 const geometry=new THREE.BoxGeometry(2,1,2);for(const material of [floor,portal,actor,signal])root.add(new THREE.Mesh(geometry,material));
 asset.add(new THREE.Mesh(geometry,actor));
 const game={scene,chamberEdition:'foundation',assets:new Map([[1,asset]]),materials:{floor}};
 const level={world:{materials:{floor}},dispose(){this.disposed=true;}};
 return{game,level,root,floor,portal,actor,signal};
}
test('Theme copies architecture without recoloring original actors, signals, portal surfaces or shared source materials',()=>{
 const f=fixture(),before=f.root.children.map(o=>o.matrix.toArray());
 finishCampaignTheme(f.game,f.level,10,[f.root]);
 assert.equal(f.floor.color.getHex(),0xabcdef);
 assert.notEqual(f.root.children[0].material,f.floor);
 assert.equal(f.root.children[0].material.color.getHex(),campaignTheme(10).floor);
 for(const [i,key]of [[1,'portal'],[2,'actor'],[3,'signal']])assert.equal(f.root.children[i].material,f[key]);
 assert.deepEqual(f.root.children.map(o=>o.matrix.toArray()),before);
 assert.equal(f.level.campaignTheme.id,'dynamo');
 assert.equal(f.level.campaignTheme.changedMaterials,1);
 const copy=f.root.children[0].material;let disposed=0;copy.addEventListener('dispose',()=>disposed++);f.level.dispose();
 assert.equal(disposed,1);assert.equal(f.level.disposed,true);
});
test('Classic and open editions do not inherit foundation theme or metadata',()=>{
 for(const edition of ['classic','open']){
  const f=fixture();f.game.chamberEdition=edition;
  assert.equal(finishCampaignTheme(f.game,f.level,0,[f.root]),f.level);
  assert.equal(f.root.children[0].material,f.floor);assert.equal(f.level.campaignTheme,undefined);
 }
});
test('Castle theme preserves independently colored wing navigation accents',()=>{
 const f=fixture(),wing=new THREE.MeshStandardMaterial({name:'castle wing enamel / freight',color:0x446677});f.root.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),wing));
 finishCampaignTheme(f.game,f.level,40,[f.root]);assert.equal(f.root.children.at(-1).material,wing);assert.equal(wing.color.getHex(),0x446677);
});
