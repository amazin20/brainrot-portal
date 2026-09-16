import fs from 'node:fs';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
const g=await createHeadlessGame();await g.selectLevel(20,false);g.resetRun(true);g.scene.updateMatrixWorld(true);
const f=g.firstLevel.panels['moving-cassette'].getFrame(),ray=new THREE.Raycaster(),origins=[];
for(let x=-14.5;x<=1;x+=1.5)for(let z=8.15;z<18;z+=1.5)for(const y of [11.4,12.95])origins.push({zone:'departure',p:new THREE.Vector3(x,y,z)});
for(let x=-18;x<=-13.3;x+=1.5)for(let z=-15;z<-10.7;z+=1.5)for(const y of [5.4,6.95])origins.push({zone:'inspection',p:new THREE.Vector3(x,y,z)});
for(let x=-19;x<=23;x+=2.5)for(let z=-16;z<19;z+=2.5)for(const y of [1.4,2.95])origins.push({zone:'basin',p:new THREE.Vector3(x,y,z)});
let tested=0;const hits=[];
for(const {zone,p} of origins)for(const u of [-2.3,0,2.3])for(const v of [-2.3,0,2.3]){
 const target=f.center.clone().addScaledVector(f.right,u).addScaledVector(f.up,v),dir=target.clone().sub(p).normalize();if(dir.dot(f.normal)>=-.02)continue;
 ray.set(p,dir);tested++;const hit=ray.intersectObjects(g.aimBlockers,true).find(h=>(h.object.visible||h.object.userData.collisionProxy)&&g.isActiveBlocker(h.object));
 if(hit?.object===g.firstLevel.panels['moving-cassette'].mesh)hits.push({zone,origin:p.toArray(),target:target.toArray()});
}
const report={scope:'finite early shot rays, not ordinary player routes or exhaustive reachability',tested,hits};
const out=process.env.EVIDENCE_OUT||'smoke-artifacts/clean-slate';fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/early-rays.json',JSON.stringify(report,null,2));if(hits.length)process.exitCode=1;console.log(tested,hits.length,hits.slice(0,4));g.physics.dispose();g.portals.dispose();
