import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.wasm':'application/wasm','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ogg':'audio/ogg','.mp3':'audio/mpeg'};

/** Serve the same frozen package at its candidate subpath. There is no source
 * compilation, development-server fallback, redirect or substituted asset. */
export async function serveFrozenCampaign(directory,{port=0,namespace='campaign-v56'}={}){
 if(!/^campaign-v(?:55|56)$/.test(namespace))throw new Error('Unknown frozen campaign mount');
 const root=path.resolve(directory),prefixes=[`/${namespace}/`,`/brainrot-portal/${namespace}/`];
 const server=http.createServer((req,res)=>{
  try{
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),prefix=prefixes.find(value=>pathname.startsWith(value));
   if(!prefix)throw Error('Outside candidate mount');
   const relative=pathname.slice(prefix.length)+(pathname.endsWith('/')?'index.html':''),file=path.resolve(root,relative);
   if(!file.startsWith(root+path.sep)||!fs.statSync(file).isFile())throw Error('Missing frozen file');
   res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':fs.statSync(file).size,'Cache-Control':'no-store'});
   fs.createReadStream(file).pipe(res);
  }catch{res.writeHead(404).end();}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 return {server,url:`http://127.0.0.1:${server.address().port}/${namespace}/`};
}
