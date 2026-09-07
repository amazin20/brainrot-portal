// Derivative LODs only. Original uploads are never written.
import fs from 'node:fs';import path from 'node:path';import{createHash}from'node:crypto';
import{NodeIO,Document}from'@gltf-transform/core';import{ALL_EXTENSIONS,KHRDracoMeshCompression}from'@gltf-transform/extensions';import{weld,prune}from'@gltf-transform/functions';import{MeshoptSimplifier as S}from'meshoptimizer';import draco from'draco3dgltf';import sharp from'sharp';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco.createDecoderModule(),'draco3d.encoder':await draco.createEncoderModule()});await S.ready;
const catalog=[
[31,'wind-generator','39ce982c',p=>p[2]<-.31&&Math.hypot(p[0],p[1]-.38)<.235],
[32,'spring-ram','7e233261',p=>p[2]<-.13&&p[1]>.11],
[33,'telescopic-lift','cf6d1e62',p=>p[1]>.72],
[34,'balance','31d681a7',p=>p[1]>.295],
[35,'shutter-fan','6b643fd6',p=>p[2]<-.22&&p[1]>.31&&Math.abs(p[0])<.235],
[36,'gripper','33eb394d',p=>p[0]<-.07&&p[1]>.30],
[37,'extension-bridge','144a19ca',p=>p[2]<.18&&p[1]>.075],
[38,'turntable','ad23c252',p=>p[1]>.395],
[39,'cable-winch','cb93f48c',p=>p[1]>.14]];
const hash=b=>createHash('sha256').update(b).digest('hex');const out='public/models/runtime',root=process.env.NESI_UPLOADS||'/mnt/data';const manifest=JSON.parse(fs.readFileSync(out+'/manifest.json')),records=[];
for(const[id,name,prefix,mask]of catalog){
 const source=fs.readdirSync(root).find(f=>f.startsWith(prefix)&&f.endsWith('-optimized.glb')),bytes=fs.readFileSync(path.join(root,source));if(bytes.readUInt32LE(8)!==bytes.length)throw Error('Truncated upload');
 const doc=await io.readBinary(bytes),src=doc.getRoot().listMeshes()[0].listPrimitives()[0],tex=src.getMaterial()?.getBaseColorTexture();const raw=tex?await sharp(tex.getImage()).removeAlpha().raw().toBuffer({resolveWithObject:true}):null;
 const p=src.getAttribute('POSITION').getArray(),n=src.getAttribute('NORMAL').getArray(),uv=src.getAttribute('TEXCOORD_0')?.getArray(),pos=new Float32Array(p.length),norm=new Float32Array(p.length),col=new Float32Array(p.length);
 const linear=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
 for(let i=0;i<p.length/3;i++){pos.set([p[i*3],-p[i*3+2],p[i*3+1]],i*3);norm.set([n[i*3],-n[i*3+2],n[i*3+1]],i*3);
 let c=[.7,.7,.7];if(raw&&uv){const x=Math.min(raw.info.width-1,Math.max(0,Math.round(uv[i*2]*(raw.info.width-1)))),y=Math.min(raw.info.height-1,Math.max(0,Math.round(uv[i*2+1]*(raw.info.height-1))));const t=(y*raw.info.width+x)*raw.info.channels;c=[0,1,2].map(k=>linear(raw.data[t+k]/255));}col.set(c,i*3);}
 const result=new Document(),buffer=result.createBuffer(),mat=result.createMaterial().setRoughnessFactor(.65).setMetallicFactor(.13).setDoubleSided(true),scene=result.createScene();const idx=src.getIndices().getArray(),groups=[[],[]];
 for(let i=0;i<idx.length;i+=3){const c=[0,1,2].map(k=>(pos[idx[i]*3+k]+pos[idx[i+1]*3+k]+pos[idx[i+2]*3+k])/3);groups[mask(c)?1:0].push(idx[i],idx[i+1],idx[i+2]);}
 for(let part=0;part<2;part++){if(!groups[part].length)continue;const prim=result.createPrimitive().setMaterial(mat).setIndices(result.createAccessor().setType('SCALAR').setArray(Uint32Array.from(groups[part])).setBuffer(buffer));for(const[k,data]of[['POSITION',pos],['NORMAL',norm],['COLOR_0',col]])prim.setAttribute(k,result.createAccessor().setType('VEC3').setArray(data.slice()).setBuffer(buffer));scene.addChild(result.createNode(part?'Moving':'Frame').setMesh(result.createMesh().addPrimitive(prim)));}
 await result.transform(weld());let triangles=0;
 for(const mesh of result.getRoot().listMeshes())for(const prim of mesh.listPrimitives()){
 const p=prim.getAttribute('POSITION'),n=prim.getAttribute('NORMAL'),c=prim.getAttribute('COLOR_0'),count=p.getCount(),attrs=new Float32Array(count*6);for(let i=0;i<count;i++){attrs.set(n.getArray().subarray(i*3,i*3+3),i*6);attrs.set(c.getArray().subarray(i*3,i*3+3),i*6+3);}
 const ids=prim.getIndices().getArray(),target=Math.max(350,Math.round(4200*ids.length/idx.length));const[indices,error]=S.simplifyWithAttributes(Uint32Array.from(ids),p.getArray(),3,attrs,6,[.14,.14,.14,.24,.24,.24],null,target*3,.04,['Permissive']);const[remap,size]=S.compactMesh(indices);
 for(const semantic of prim.listSemantics()){const a=prim.getAttribute(semantic),old=a.getArray(),w=a.getElementSize(),arr=new Float32Array(size*w);for(let i=0;i<remap.length;i++)if(remap[i]!==0xffffffff)for(let k=0;k<w;k++)arr[remap[i]*w+k]=old[i*w+k];prim.setAttribute(semantic,a.clone().setArray(arr));}prim.setIndices(prim.getIndices().clone().setArray(indices));triangles+=indices.length/3;}
 await result.transform(prune());result.createExtension(KHRDracoMeshCompression).setRequired(true).setEncoderOptions({method:KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,quantizationBits:{POSITION:13,NORMAL:9,COLOR:7},encodeSpeed:0,decodeSpeed:0});const data=await io.writeBinary(result),filename=`model-${id}-${name}.glb`;fs.writeFileSync(`${out}/${filename}`,data);
 const record={id,filename,sourceFilename:source,sourceSHA256:hash(bytes),outputSHA256:hash(data),sourceBytes:bytes.length,outputBytes:data.length,triangles,notes:'Derived LOD; source colors baked to vertices. Independent Frame/Moving nodes. Original upload unchanged.'};records.push(record);manifest.models=manifest.models.filter(m=>m.id!==id);manifest.models.push(record);console.log(id,triangles,data.length);}
fs.writeFileSync(out+'/manifest.json',JSON.stringify(manifest,null,2));fs.writeFileSync('docs/WORKSHOP_ASSETS.json',JSON.stringify(records,null,2));
