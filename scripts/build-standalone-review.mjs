import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
const out='/mnt/data/NESI-v17-delivery';
await fs.mkdir(out,{recursive:true});
const result=await build({absWorkingDir:process.cwd(),entryPoints:['src/main.js'],outfile:path.join(out,'review-app.js'),bundle:true,format:'iife',platform:'browser',target:'es2022',minify:true,write:false,
 define:{'import.meta.env.MODE':'"production"','import.meta.env.BASE_URL':'"./"','import.meta.env.DEV':'false','import.meta.env.PROD':'true'},
 plugins:[{name:'local-review-query',setup(b){b.onLoad({filter:/\/src\/main\.js$/},async args=>({contents:(await fs.readFile(args.path,'utf8')).replace('new URLSearchParams(location.search)','new URLSearchParams(location.search || window.__NESI_REVIEW_QUERY__ || "")'),loader:'js'}));}}]});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text;
const css=result.outputFiles.find(f=>f.path.endsWith('.css'))?.text||'';
const files={};
for(const directory of ['models/runtime','draco']) {
 for(const name of await fs.readdir('dist/'+directory)) {
   const file='dist/'+directory+'/'+name;if(!(await fs.stat(file)).isFile())continue;
   files[directory+'/'+name]=(await fs.readFile(file)).toString('base64');
 }
}
const shim=`(()=>{const assets=${JSON.stringify(files)},nativeFetch=window.fetch.bind(window);window.__NESI_LOCAL_REQUESTS__=[];window.fetch=(input,options)=>{const raw=typeof input==='string'?input:input.url;let key;try{const p=new URL(raw,document.baseURI==='about:blank'?'https://nesi.local/':document.baseURI).pathname;const m=p.match(/(?:^|\\/)((?:models\\/runtime|draco)\\/[^/?]+)$/);key=m?.[1]}catch{}if(key&&assets[key]){window.__NESI_LOCAL_REQUESTS__.push(key);const binary=atob(assets[key]);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);const type=key.endsWith('.wasm')?'application/wasm':key.endsWith('.js')?'application/javascript':key.endsWith('.json')?'application/json':'model/gltf-binary';return Promise.resolve(new Response(bytes,{status:200,headers:{'Content-Type':type,'Content-Length':String(bytes.length)}}));}return nativeFetch(input,options)}})();`;
let html=await fs.readFile('index.html','utf8');
html=html.replace(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>\s*<\/script>/g,'');
html=html.replace('</head>','<style>'+css.replace(/<\/style/gi,'<\\/style')+'</style></head>');
html=html.replace('</body>','<script>'+ (shim+'\n'+js).replace(/<\/script/gi,'<\\/script')+'</script></body>');
await fs.writeFile(out+'/NESI-20-levels.html',html);
console.log(JSON.stringify({file:out+'/NESI-20-levels.html',bytes:Buffer.byteLength(html),embeddedModels:Object.keys(files).filter(n=>n.endsWith('.glb')).length,externalAssetDownloads:false}));
