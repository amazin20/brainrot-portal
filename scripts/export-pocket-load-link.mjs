// Reproducible optional review export. Runtime uses the same editable factory;
// the GLB is NOT another dependency added to every room's network load.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createPocketLoadLinkModel} from '../src/game/LabPocketLoadLink.js';

class BlobReader {
 readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();}).catch(error=>this.onerror?.(error));}
}
globalThis.FileReader ??= BlobReader;
const out=process.env.EVIDENCE_OUT||'smoke-artifacts/p02-export';fs.mkdirSync(out,{recursive:true});
const model=createPocketLoadLinkModel();
const bytes=Buffer.from(await new GLTFExporter().parseAsync(model.root,{binary:true,onlyVisible:true}));
if(bytes.length>4_000_000)throw new Error('Logical model exceeds export budget');
fs.writeFileSync(path.join(out,'pocket-load-link.glb'),bytes);
const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
const report={source:'src/game/LabPocketLoadLink.js',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
 meshes:doc.meshes.length,materials:doc.materials.length,textures:doc.textures?.length||0,
 status:'Reproducible review export; not a substitute for browser inspection or a full glTF Validator.',
 animation:'Runtime contact drives the two pointers. Static exported rest pose; no exported clips claimed.'};
fs.writeFileSync(path.join(out,'export.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
