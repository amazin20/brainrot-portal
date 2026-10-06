import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createHeadlessGame} from './lab-headless.mjs';
import {campaignSpec} from '../src/game/LabCampaignLevels.js';
const g=await createHeadlessGame();g.chamberEdition='foundation';
const round=n=>Number(n.toFixed(5)),v=p=>p?.toArray?.().map(round);
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const rows=[];
for(let index=0;index<51;index++){
 await g.selectLevel(index,false);const l=g.firstLevel,spec=campaignSpec(g,index);
 const physics={colliders:g.colliders.map(c=>({min:v(c.box.min),max:v(c.box.max),enabled:c.enabled!==false,walkable:!!c.walkablePlane})),floors:g.floors.map(f=>Object.fromEntries(['minX','maxX','minZ','maxZ','y','enabled'].filter(k=>f[k]!==undefined).map(k=>[k,typeof f[k]==='number'?round(f[k]):f[k]]))),spawn:v(g.playerPosition),cargo:v(g.cargo.position),panels:Object.entries(l.panels||{}).filter(([_,p])=>typeof p.getFrame==='function').map(([name,p])=>{const f=p.getFrame();return{name,center:v(f.center),normal:v(f.normal),width:f.width,height:f.height};})};
 const themed=new Set();g.scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.userData?.campaignTheme)themed.add(m);});
 rows.push({room:index+1,id:spec.id,title:spec.title,concept:spec.concept||spec.description,theme:l.campaignTheme?.id||null,themedMaterials:themed.size,physicsHash:hash(physics),...physics,roles:l.puzzleGeometry?.portalRoles||{},orders:l.puzzleGeometry?.orders||[],deductions:l.puzzleGeometry?.deductions||[],terminals:(l.terminals||[]).map(t=>({id:t.kind,position:v(t.position),label:t.label}))});
 console.log('INVENTORY',index+1,rows.at(-1).theme,rows.at(-1).themedMaterials);
}
const output=process.env.QA_OUT||'qa/themed/inventory.json';fs.mkdirSync(output.slice(0,output.lastIndexOf('/')),{recursive:true});fs.writeFileSync(output,JSON.stringify({scope:'All51 initial production physical rooms; architectural themes checked separately from gameplay changes',rows},null,2));
