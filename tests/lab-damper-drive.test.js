import test from 'node:test';
import assert from 'node:assert/strict';
import {DamperDrive} from '../src/game/LabDamperDrive.js';

function steady(loaded,frequency,dt=1/120){
 const m=new DamperDrive();m.frequency=frequency;const rows=[];
 for(let time=0;time<60-1e-8;time+=dt){m.step(dt,loaded,true);if(time>30)rows.push({v:m.bedVelocity,r:m.rmsVelocity,s:m.stroke});}
 return {rms:Math.sqrt(rows.reduce((s,p)=>s+p.v*p.v,0)/rows.length),min:Math.min(...rows.map(p=>p.r)),max:Math.max(...rows.map(p=>p.r)),strokeMin:Math.min(...rows.map(p=>p.s)),strokeMax:Math.max(...rows.map(p=>p.s))};
}

test('actual stopped bed velocity and weighted RMS preserve both damping and detuning causes',()=>{
 const freeLow=steady(false,.75),freeHigh=steady(false,5.2),loadedLow=steady(true,.75),loadedHigh=steady(true,5.2);
 assert.ok(loadedLow.rms<freeLow.rms*.75,'Real friction must reduce low-frequency bed motion');
 assert.ok(loadedHigh.rms>loadedLow.rms*2,'Cargo alone must leave resonant motion too large');
 assert.ok(freeHigh.rms>loadedHigh.rms*3,'Cargo must dissipate motion rather than separately permit the actuator');
 assert.equal(loadedLow.strokeMin,1);
 for(const row of [freeLow,freeHigh,loadedHigh])assert.equal(row.strokeMax,0);
});

test('end stops cannot retain outward velocity or report motion the real bed did not make',()=>{
 const m=new DamperDrive();let stopped=0;
 for(let i=0;i<2400;i++){
  const old=m.x;m.step(1/120,false,false);
  assert.ok(Math.abs(m.bedVelocity-(m.x-old)*.15*120)<1e-10);
  if(Math.abs(m.x)===.55){stopped++;assert.ok(m.x*m.v<=0,'End-stop reaction must remove outward velocity');}
 }
 assert.ok(stopped>100,'Exercise sustained actual end-stop contacts');
});

test('vibration relief follows motion history after load removal and optical return, without a contact permission',()=>{
 const m=new DamperDrive();m.frequency=.75;
 for(let i=0;i<120*40;i++)m.step(1/120,true,true);
 assert.equal(m.stroke,1);
 // Immediately removing the shoe does not instantaneously erase pressure.
 m.step(1/120,false,true);assert.ok(m.stroke>.99);
 for(let i=0;i<120*20;i++)m.step(1/120,false,true);
 assert.equal(m.stroke,0);
 for(let i=0;i<120*30;i++)m.step(1/120,true,true);
 assert.equal(m.stroke,1);
 for(let i=0;i<120;i++)m.step(1/120,true,false);
 assert.equal(m.stroke,0);assert.ok(m.rmsVelocity<.04);
});

test('frame partitions keep the same physical contrast at 12/30/60/120/240 Hz',()=>{
 const reference=steady(true,.75);
 for(const dt of [1/12,1/30,1/60,1/240]){
  const loaded=steady(true,.75,dt),free=steady(false,.75,dt),resonant=steady(true,5.2,dt);
  assert.ok(Math.abs(loaded.rms-reference.rms)<.002);
  assert.equal(loaded.strokeMin,1);assert.equal(free.strokeMax,0);assert.equal(resonant.strokeMax,0);
 }
});
