import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';

const SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
const MAX_FILE_BYTES=64*1024*1024;
const MAX_DIMENSION=16384;
const MAX_PIXELS=32_000_000;
const MAX_DECODED_BYTES=128*1024*1024;
const CRC_TABLE=new Uint32Array(256);
for(let n=0;n<256;n++){
  let c=n;
  for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;
  CRC_TABLE[n]=c>>>0;
}

function requirePNG(condition,message){
  if(!condition)throw new Error(`Invalid evidence PNG: ${message}`);
}

function crc32(bytes,start,end){
  let crc=0xffffffff;
  for(let i=start;i<end;i++)crc=CRC_TABLE[(crc^bytes[i])&255]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
}

function paeth(a,b,c){
  const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
  return pa<=pb&&pa<=pc?a:pb<=pc?b:c;
}

/**
 * Decode a complete, noninterlaced RGB8/RGBA8 PNG using only Node builtins.
 * Unsupported depth, transparency keys, animation and image modes are rejected.
 * pixelSha256 hashes reconstructed stored channels, without scanline filters.
 * opaquePixels means alpha=255; visiblePixels means alpha>0. Invisible RGB is
 * ignored when counting variation, so a fully transparent image is not evidence.
 */
export function decodeEvidencePNG(input,{width:expectedWidth,height:expectedHeight}={}){
  requirePNG(input instanceof Uint8Array,'input must be PNG bytes');
  requirePNG(input.byteLength>=45&&input.byteLength<=MAX_FILE_BYTES,'file size outside supported bounds');
  const bytes=Buffer.from(input);
  requirePNG(bytes.subarray(0,8).equals(SIGNATURE),'bad signature');
  for(const [name,value] of [['width',expectedWidth],['height',expectedHeight]]){
    if(value!==undefined)requirePNG(Number.isInteger(value)&&value>0,`invalid expected ${name}`);
  }

  let offset=8,width,height,bitDepth,colorType,channels;
  let seenIHDR=false,seenPLTE=false,seenIEND=false,idatState='before',chunkCount=0;
  const compressedParts=[];
  while(offset<bytes.length){
    requirePNG(++chunkCount<=10000,'too many chunks');
    requirePNG(bytes.length-offset>=12,'truncated chunk');
    const length=bytes.readUInt32BE(offset);
    requirePNG(length<=0x7fffffff&&length<=bytes.length-offset-12,'invalid or truncated chunk length');
    const typeBytes=bytes.subarray(offset+4,offset+8);
    requirePNG(typeBytes.every(value=>(value>=65&&value<=90)||(value>=97&&value<=122)),'invalid chunk name');
    requirePNG((typeBytes[2]&32)===0,'invalid chunk reserved bit');
    const type=typeBytes.toString('ascii'),start=offset+8,end=start+length;
    requirePNG(crc32(bytes,offset+4,end)===bytes.readUInt32BE(end),`${type} CRC mismatch`);
    requirePNG(seenIHDR||type==='IHDR','IHDR must be first');
    if(type!=='IDAT'&&idatState==='during')idatState='after';

    if(type==='IHDR'){
      requirePNG(!seenIHDR&&offset===8&&length===13,'IHDR must occur exactly once with length 13');
      seenIHDR=true;
      width=bytes.readUInt32BE(start);height=bytes.readUInt32BE(start+4);
      bitDepth=bytes[start+8];colorType=bytes[start+9];
      requirePNG(width>0&&height>0&&width<=MAX_DIMENSION&&height<=MAX_DIMENSION&&width*height<=MAX_PIXELS,'dimensions outside supported bounds');
      requirePNG(bitDepth===8&&(colorType===2||colorType===6),'unsupported image mode; RGB8 or RGBA8 required');
      requirePNG(bytes[start+10]===0&&bytes[start+11]===0,'unsupported compression or filter method');
      requirePNG(bytes[start+12]===0,'unsupported interlaced image');
      if(expectedWidth!==undefined)requirePNG(width===expectedWidth,'width does not match expected viewport');
      if(expectedHeight!==undefined)requirePNG(height===expectedHeight,'height does not match expected viewport');
      channels=colorType===6?4:3;
    }else if(type==='PLTE'){
      requirePNG(!seenPLTE&&idatState==='before','PLTE must occur once before IDAT');
      requirePNG(length>=3&&length<=768&&length%3===0,'invalid PLTE length');
      seenPLTE=true;
    }else if(type==='IDAT'){
      requirePNG(idatState!=='after','IDAT chunks must be contiguous');
      idatState='during';compressedParts.push(bytes.subarray(start,end));
    }else if(type==='IEND'){
      requirePNG(length===0&&compressedParts.length>0,'invalid IEND or missing IDAT');
      seenIEND=true;offset=end+4;
      requirePNG(offset===bytes.length,'extra bytes after IEND');
      break;
    }else{
      requirePNG((typeBytes[0]&32)!==0,`unknown critical chunk ${type}`);
      requirePNG(!['tRNS','acTL','fcTL','fdAT'].includes(type),`unsupported ${type} chunk`);
    }
    offset=end+4;
  }
  requirePNG(seenIHDR&&seenIEND,'missing required IHDR or IEND');

  const stride=width*channels,expectedDecodedBytes=height*(stride+1);
  requirePNG(expectedDecodedBytes<=MAX_DECODED_BYTES,'decoded image exceeds supported bounds');
  const compressed=Buffer.concat(compressedParts);
  requirePNG(compressed.length>=6,'truncated zlib stream');
  requirePNG((compressed[0]&15)===8&&(compressed[0]>>>4)<=7&&((compressed[0]<<8)+compressed[1])%31===0&&(compressed[1]&32)===0,'invalid PNG zlib header');
  let inflated;
  try{
    const result=inflateSync(compressed,{maxOutputLength:expectedDecodedBytes+1,info:true});
    requirePNG(result.engine.bytesWritten===compressed.length,'trailing bytes or multiple zlib streams');
    inflated=result.buffer;
  }catch(error){
    if(error.message.startsWith('Invalid evidence PNG:'))throw error;
    throw new Error(`Invalid evidence PNG: zlib decode failed (${error.code||error.message})`);
  }
  requirePNG(inflated.length===expectedDecodedBytes,'incorrect decoded scanline length');

  const pixels=Buffer.allocUnsafe(height*stride);
  for(let y=0;y<height;y++){
    const scanline=y*(stride+1),row=y*stride,filter=inflated[scanline];
    requirePNG(filter<=4,`unsupported scanline filter ${filter}`);
    for(let x=0;x<stride;x++){
      const a=x>=channels?pixels[row+x-channels]:0;
      const b=y>0?pixels[row+x-stride]:0;
      const c=y>0&&x>=channels?pixels[row+x-stride-channels]:0;
      const predictor=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c);
      pixels[row+x]=(inflated[scanline+x+1]+predictor)&255;
    }
  }

  let opaquePixels=0,visiblePixels=0,nonUniformPixels=0;
  const firstAlpha=channels===4?pixels[3]:255;
  const first=[firstAlpha?pixels[0]:0,firstAlpha?pixels[1]:0,firstAlpha?pixels[2]:0,firstAlpha];
  for(let i=0;i<pixels.length;i+=channels){
    const alpha=channels===4?pixels[i+3]:255;
    if(alpha===255)opaquePixels++;
    if(alpha>0)visiblePixels++;
    if(alpha!==first[3]||(alpha>0&&(pixels[i]!==first[0]||pixels[i+1]!==first[1]||pixels[i+2]!==first[2])))nonUniformPixels++;
  }
  requirePNG(visiblePixels>0,'blank fully transparent image');
  requirePNG(nonUniformPixels>0,'blank or uniform image');
  return {width,height,bitDepth,colorType,bytes:bytes.length,decodedBytes:inflated.length,pixelBytes:pixels.length,pixelSha256:createHash('sha256').update(pixels).digest('hex'),opaquePixels,visiblePixels,nonUniformPixels};
}
