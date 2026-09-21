import puppeteer from 'puppeteer-core';import fs from 'node:fs';import {build} from 'esbuild';
const result=await build({entryPoints:['scripts/solid-offline-view.mjs'],bundle:true,format:'iife',write:false});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();await page.setViewport({width:1200,height:900});
await page.setContent('<html><head></head><body></body></html>');await page.addScriptTag({content:result.outputFiles[0].text});
const out=process.env.MODEL_REVIEW_OUT||'smoke-artifacts/model-studies';fs.mkdirSync(out,{recursive:true});
for(const kind of ['solar','canopy','planter','drive','ring','crystal','pontoon']){await page.evaluate(kind=>window.showModel(kind),kind);await page.screenshot({path:`${out}/${kind}.png`});console.log(kind);}
await browser.close();
