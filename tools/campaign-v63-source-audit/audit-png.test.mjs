import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import test from 'node:test';
import {decodeEvidencePNG} from './audit-png.mjs';

// Generated protocol fixtures test the decoder only; these are not screenshots.
const SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
function crc32(bytes){
  let crc=0xffffffff;
  for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc&1)?0xedb88320^(crc>>>1):crc>>>1;}
  return (crc^0xffffffff)>>>0;
}
function chunk(type,data=Buffer.alloc(0)){
  const payload=Buffer.from(data),out=Buffer.alloc(payload.length+12);
  out.writeUInt32BE(payload.length);out.write(type,4,4,'ascii');payload.copy(out,8);
  out.writeUInt32BE(crc32(out.subarray(4,-4)),out.length-4);return out;
}
function header({width=2,height=2,colorType=6,bitDepth=8,interlace=0}={}){
  const out=Buffer.alloc(13);out.writeUInt32BE(width);out.writeUInt32BE(height,4);
  out[8]=bitDepth;out[9]=colorType;out[12]=interlace;return out;
}
function png({ihdr=header(),raw=Buffer.from([0,255,0,0,255,0,255,0,255,0,0,0,255,255,255,255,255,255]),compressed=deflateSync(raw),before=[],after=[],idats=[compressed]}={}){
  return Buffer.concat([SIGNATURE,chunk('IHDR',ihdr),...before,...idats.map(data=>chunk('IDAT',data)),...after,chunk('IEND')]);
}
const RGBA=Buffer.from([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const expectBad=(bytes,pattern)=>assert.throws(()=>decodeEvidencePNG(bytes),pattern||/Invalid evidence PNG:/);
function filteredRows(pixels,width,channels,filters){
  const stride=width*channels,rows=[];
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<filters.length;y++){
    const filter=filters[y],row=Buffer.alloc(stride+1);row[0]=filter;
    for(let x=0;x<stride;x++){
      const a=x>=channels?pixels[y*stride+x-channels]:0,b=y?pixels[(y-1)*stride+x]:0,c=y&&x>=channels?pixels[(y-1)*stride+x-channels]:0;
      const prediction=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];
      row[x+1]=(pixels[y*stride+x]-prediction)&255;
    }
    rows.push(row);
  }
  return Buffer.concat(rows);
}

test('decodes tiny RGBA and RGB fixtures and binds exact pixel hashes',()=>{
  const data=png(),result=decodeEvidencePNG(data,{width:2,height:2});
  assert.deepEqual(result,{width:2,height:2,bitDepth:8,colorType:6,bytes:data.length,decodedBytes:18,pixelBytes:16,pixelSha256:hash(RGBA),opaquePixels:4,visiblePixels:4,nonUniformPixels:3});
  const rgb=Buffer.from([1,2,3,4,5,6]),rgbPNG=png({ihdr:header({height:1,colorType:2}),raw:Buffer.from([0,...rgb])});
  assert.equal(decodeEvidencePNG(rgbPNG).pixelSha256,hash(rgb));
  assert.equal(decodeEvidencePNG(rgbPNG).opaquePixels,2);
  assert.equal(decodeEvidencePNG(new Uint8Array(data)).pixelSha256,hash(RGBA));
  assert.throws(()=>decodeEvidencePNG(data,{width:3}),/width does not match/);
  assert.throws(()=>decodeEvidencePNG(data,{height:3}),/height does not match/);
  assert.throws(()=>decodeEvidencePNG(data,{width:NaN}),/invalid expected width/);
});

test('reconstructs every filter, prior rows, wrapping and Paeth tie cases',()=>{
  for(const channels of [3,4]){
    const width=3,height=10,pixels=Buffer.alloc(width*height*channels);
    for(let i=0;i<pixels.length;i++)pixels[i]=(i*149+Math.floor(i/7)*31)&255;
    const raw=filteredRows(pixels,width,channels,[0,1,2,3,4,4,3,2,1,0]);
    const value=decodeEvidencePNG(png({ihdr:header({width,height,colorType:channels===4?6:2}),raw}));
    assert.equal(value.pixelBytes,pixels.length);assert.equal(value.pixelSha256,hash(pixels));
  }
  // First-row left/upper-left values are zero for all filters too.
  for(let filter=0;filter<=4;filter++)assert.equal(decodeEvidencePNG(png({raw:filteredRows(RGBA,2,4,[filter,filter])})).pixelSha256,hash(RGBA));
});

test('accepts legal contiguous IDAT splits and checks ancillary CRCs',()=>{
  const raw=filteredRows(RGBA,2,4,[0,0]),z=deflateSync(raw);
  const bytes=png({before:[chunk('tEXt',Buffer.from('note\0decoder fixture'))],idats:[z.subarray(0,2),Buffer.alloc(0),z.subarray(2)],after:[chunk('tEXt',Buffer.from('after\0data'))]});
  assert.equal(decodeEvidencePNG(bytes).pixelSha256,hash(RGBA));
  const corrupt=Buffer.from(bytes);corrupt[42]^=1;expectBad(corrupt,/CRC mismatch/);
  const palette=chunk('PLTE',Buffer.from([1,2,3]));
  assert.equal(decodeEvidencePNG(png({before:[palette]})).pixelSha256,hash(RGBA));
});

test('rejects malformed framing, CRCs, required ordering and critical chunks',()=>{
  const good=png(),badSignature=Buffer.from(good);badSignature[0]=0;expectBad(badSignature,/signature/);
  for(const cut of [0,8,20,good.length-1])expectBad(good.subarray(0,cut));
  expectBad(Buffer.concat([good,Buffer.from([0])]),/after IEND/);
  const crc=Buffer.from(good);crc[29]^=1;expectBad(crc,/CRC mismatch/);
  expectBad(Buffer.concat([SIGNATURE,chunk('tEXt'),good.subarray(8)]),/IHDR must be first/);
  expectBad(png({before:[chunk('IHDR',header())]}),/IHDR must occur exactly once/);
  expectBad(Buffer.concat([SIGNATURE,chunk('IHDR',header()),chunk('IEND')]),/missing IDAT/);
  expectBad(Buffer.concat([SIGNATURE,chunk('IHDR',header()),chunk('IDAT',deflateSync(Buffer.alloc(18)))]),/missing required/);
  expectBad(png({before:[chunk('ABCD')]}),/unknown critical/);
  expectBad(png({before:[chunk('texT')]}),/reserved bit/);
  expectBad(png({before:[chunk('1EXt')]}),/invalid chunk name/);
  expectBad(png({before:[chunk('PLTE',Buffer.from([1,2]))]}),/PLTE length/);
  expectBad(png({before:[chunk('PLTE',Buffer.from([1,2,3])),chunk('PLTE',Buffer.from([1,2,3]))]}),/PLTE must occur once/);
  expectBad(png({after:[chunk('PLTE',Buffer.from([1,2,3]))]}),/PLTE must occur once/);
  const z=deflateSync(filteredRows(RGBA,2,4,[0,0]));
  expectBad(Buffer.concat([SIGNATURE,chunk('IHDR',header()),chunk('IDAT',z.subarray(0,2)),chunk('tEXt'),chunk('IDAT',z.subarray(2)),chunk('IEND')]),/IDAT chunks must be contiguous/);
});

test('rejects unsupported modes, unbounded dimensions and malformed compression',()=>{
  for(const ihdr of [header({width:0}),header({width:16385}),header({width:16384,height:16384})])expectBad(png({ihdr}),/dimensions/);
  for(const ihdr of [header({bitDepth:16}),header({colorType:3}),header({interlace:1})])expectBad(png({ihdr}),/unsupported/);
  const method=header();method[10]=1;expectBad(png({ihdr:method}),/compression or filter/);
  const filterMethod=header();filterMethod[11]=1;expectBad(png({ihdr:filterMethod}),/compression or filter/);
  for(const type of ['tRNS','acTL','fcTL','fdAT'])expectBad(png({before:[chunk(type)]}),/unsupported/);
  expectBad(png({compressed:Buffer.from([0,0,0,0,0,0])}),/zlib header/);
  const z=deflateSync(filteredRows(RGBA,2,4,[0,0]));
  expectBad(png({compressed:z.subarray(0,-1)}),/zlib decode failed/);
  const checksum=Buffer.from(z);checksum[checksum.length-1]^=1;expectBad(png({compressed:checksum}),/zlib decode failed/);
  expectBad(png({compressed:Buffer.concat([z,Buffer.from([0])])}),/trailing bytes/);
  expectBad(png({compressed:Buffer.concat([z,z])}),/multiple zlib streams/);
  expectBad(png({raw:Buffer.alloc(17)}),/scanline length/);
  expectBad(png({raw:Buffer.alloc(19)}),/scanline length/);
  expectBad(png({raw:Buffer.alloc(1000)}),/zlib decode failed/);
  const badFilter=filteredRows(RGBA,2,4,[0,0]);badFilter[0]=5;expectBad(png({raw:badFilter}),/scanline filter 5/);
});

test('rejects uniform and transparent images, normalizing invisible RGB',()=>{
  expectBad(png({raw:Buffer.from([0,1,2,3,255,1,2,3,255,0,1,2,3,255,1,2,3,255])}),/uniform/);
  expectBad(png({raw:Buffer.from([0,255,0,0,0,0,255,0,0,0,0,0,255,0,255,255,255,0])}),/fully transparent/);
  const rgba=Buffer.from(RGBA);rgba[3]=128;rgba[7]=0;
  const result=decodeEvidencePNG(png({raw:filteredRows(rgba,2,4,[0,0])}));
  assert.equal(result.visiblePixels,3);assert.equal(result.opaquePixels,2);
  const rgb=png({ihdr:header({height:1,colorType:2}),raw:Buffer.from([0,0,0,0,0,0,0])});expectBad(rgb,/uniform/);
  expectBad('not bytes',/input must be PNG bytes/);
});
