import fs from 'node:fs';import{createHeadlessGame}from'./lab-headless.mjs';import{runV8Journey}from'../src/game/LabV8Journey.js';
const g=await createHeadlessGame();await g.selectLevel(16,false);try{console.log(await runV8Journey(g));}catch(e){console.log(e.message);}fs.writeFileSync('/mnt/data/sail-trace.json',JSON.stringify(g.firstLevel.state.sailPhysics));
