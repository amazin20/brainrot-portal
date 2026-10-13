import fs from 'node:fs';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
const g=await createHeadlessGame();g.chamberEdition='foundation';const results=[];if(process.env.TRACE_CARGO){const u=g.updatePlaying;g.updatePlaying=function(dt){const before=this.teleportCount;const r=u.call(this,dt);if(this.teleportCount!==before)console.error('PLAYER TELEPORT',this.teleportCount,this.playerPosition.toArray());return r;};}
for(const n of (process.env.ROOMS||'47,48,49,50,51').split(',').map(Number)){
 await g.selectLevel(n-1,false);if(process.env.TRACE_CARGO){const t=g.physics.teleportCargo;g.physics.teleportCargo=function(o){console.error('TRANSFER',this.cargoBody.position.toArray(),this.cargoBody.velocity.toArray(),o.position.toArray());const v=t.call(this,o);console.error('TRANSFERRED',this.cargoBody.position.toArray(),this.cargoBody.velocity.toArray());return v;};}
 try{const report=await runV8Journey(g);results.push(report);console.log('PASS',n,report.frames,report.teleports,JSON.stringify(report.milestones));}
 catch(e){console.error('FAILED',n,e.stack);console.error('PLAYER',g.playerPosition.toArray(),'CARGO',g.cargo.position.toArray(),'BODYV',g.physics.cargoBody.velocity.toArray(),'PORTALS',g.portals.portals.map(p=>p?.position.toArray()));console.error('SYSTEM',n===47?{broken:g.firstLevel.fuse.broken,energy:g.firstLevel.fuse.energy}:n===48?{gap:g.firstLevel.press.gap,jaw:g.firstLevel.press.body.position.toArray(),pinned:g.firstLevel.press.pinned}:n===49?{angle:g.firstLevel.head.angle,arm:g.firstLevel.head.arm,segments:g.firstLevel.head.segments.map(s=>({a:s.a.toArray(),b:s.b.toArray(),kind:s.kind}))}:n===50?{angle:g.firstLevel.top.angle,body:g.firstLevel.top.body.position.toArray()}:{});process.exitCode=1;break;}
}
fs.mkdirSync('qa',{recursive:true});fs.writeFileSync('qa/expansion-b-routes.json',JSON.stringify(results,null,2));
