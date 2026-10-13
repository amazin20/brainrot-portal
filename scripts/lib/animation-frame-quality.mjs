import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

export function animationFrameStatistics(output,{expectedFrames,minimumFrames=45,minimumLumaRange=12}={}){
 const frames=[];
 for(const line of output.split(/\r?\n/)){
  if(/^frame:\d+\s/.test(line)){frames.push({frame:Number(line.match(/^frame:(\d+)/)[1])});continue;}
  const value=line.match(/^lavfi\.signalstats\.(YMIN|YMAX)=([\d.]+)$/);
  if(value&&frames.length)frames.at(-1)[value[1]]=Number(value[2]);
 }
 assert.ok(frames.length>=minimumFrames,'Animation capture omitted its movement, jump or recovery frames');
 if(expectedFrames!==undefined)assert.equal(frames.length,expectedFrames,'Decoded animation frame count differs from the captured production samples');
 for(const frame of frames){
  assert.ok(Number.isFinite(frame.YMIN)&&Number.isFinite(frame.YMAX),'Animation frame has no decoded pixel statistics');
  frame.lumaRange=frame.YMAX-frame.YMIN;
  assert.ok(frame.lumaRange>=minimumLumaRange,`Animation frame ${frame.frame} is blank or has insufficient scene contrast`);
 }
 return {frames:frames.length,minimumLumaRange:Math.min(...frames.map(frame=>frame.lumaRange)),allNonblank:true};
}

export function validateAnimationFrames(folder,expectedFrames){
 const decoded=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-framerate','15','-i',folder+'/%04d.jpg',
  '-vf','scale=64:36,signalstats,metadata=mode=print:file=-','-f','null','-'],{encoding:'utf8',maxBuffer:4*1024*1024});
 if(decoded.error)throw new Error('Animation decoder could not start: '+decoded.error.message,{cause:decoded.error});
 assert.equal(decoded.status,0,'Animation pixel validation failed: '+decoded.stderr);
 return animationFrameStatistics(decoded.stdout,{expectedFrames});
}
