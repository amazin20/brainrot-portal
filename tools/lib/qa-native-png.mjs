import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
// Decode/check the original byte stream only. Never re-encode or alter pixels.
export function inspectNativePng(bytes){
 assert.ok(bytes.length>1024&&bytes.length<=6291456);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 const crc=buffer=>{let value=0xffffffff;for(const byte of buffer){value^=byte;for(let i=0;i<8;i++)value=value&1?(value>>>1)^0xedb88320:value>>>1;}return(value^0xffffffff)>>>0;};
 let offset=8,header=null,ended=false,chunks=0;const idat=[];
 while(offset<bytes.length){assert.ok(++chunks<=128&&offset+12<=bytes.length);const length=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8),end=offset+12+length;assert.ok(end<=bytes.length);assert.match(type,/^[A-Za-z]{4}$/);assert.equal(crc(bytes.subarray(offset+4,offset+8+length)),bytes.readUInt32BE(offset+8+length),'PNG chunk CRC');const data=bytes.subarray(offset+8,offset+8+length);
  if(type==='IHDR'){assert.equal(header,null);assert.equal(offset,8);assert.equal(length,13);header={width:data.readUInt32BE(0),height:data.readUInt32BE(4),depth:data[8],color:data[9],compression:data[10],filter:data[11],interlace:data[12]};}
  if(type==='IDAT'){assert.ok(header&&!ended);idat.push(data);}if(type==='IEND'){assert.equal(length,0);assert.equal(end,bytes.length);ended=true;}offset=end;
 }
 assert.ok(header&&ended&&idat.length);assert.equal(header.width,1280);assert.equal(header.height,720);assert.equal(header.depth,8);assert.ok([2,6].includes(header.color));assert.deepEqual([header.compression,header.filter,header.interlace],[0,0,0]);
 const channels=header.color===6?4:3,stride=header.width*channels,raw=inflateSync(Buffer.concat(idat),{maxOutputLength:header.height*(stride+1)+1});assert.equal(raw.length,header.height*(stride+1));let previous=new Uint8Array(stride),cursor=0,visible=0,min=Infinity,max=-Infinity;const first=[];let distinct=false;
 const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
 for(let y=0;y<header.height;y++){const filter=raw[cursor++],row=new Uint8Array(stride);assert.ok(filter<=4);for(let x=0;x<stride;x++){const a=x>=channels?row[x-channels]:0,b=previous[x],c=x>=channels?previous[x-channels]:0,predictor=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c);row[x]=(raw[cursor++]+predictor)&255;}
  for(let x=0;x<stride;x+=channels)if(channels===3||row[x+3]>0){visible++;for(let c=0;c<3;c++){min=Math.min(min,row[x+c]);max=Math.max(max,row[x+c]);}if(!first.length)first.push(row[x],row[x+1],row[x+2],channels===4?row[x+3]:255);else if(row[x]!==first[0]||row[x+1]!==first[1]||row[x+2]!==first[2]||(channels===4?row[x+3]:255)!==first[3])distinct=true;}previous=row;
 }
 assert.ok(visible>0&&distinct,'Actual decoded PNG must not be transparent/one-uniform-color blank');return{...header,chunks,decodedBytes:raw.length,visiblePixels:visible,moreThanOnePixelColor:distinct,channelMin:min,channelMax:max,scope:'PNG decode/CRC/nonuniformity only; no aesthetic or visibility acceptance'};
}
