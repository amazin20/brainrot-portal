import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {installCanvasTextObserver,readCanvasTextObservation} from '../scripts/lib/canvas-text-observer.mjs';

function fixture(options={}){
  const calls=[],fonts=new WeakMap(),result={nativeReturn:true};let fail=null;
  const brandError=new TypeError('Native canvas receiver required');
  class NativeContext{constructor(){fonts.set(this,'16px sans-serif');}}
  Object.defineProperty(NativeContext.prototype,'font',{configurable:true,get(){if(!fonts.has(this))throw brandError;return fonts.get(this);},set(value){fonts.set(this,value);}});
  for(const method of ['fillText','strokeText'])Object.defineProperty(NativeContext.prototype,method,{configurable:true,writable:true,enumerable:false,value:function(text,x,y,...rest){
    if(!fonts.has(this))throw brandError;if(fail)throw fail;
    const converted=String(text);calls.push({method,receiver:this,args:[text,x,y,...rest],converted});return result;
  }});
  const original=Object.getOwnPropertyDescriptors(NativeContext.prototype),context=vm.createContext({CanvasRenderingContext2D:NativeContext});
  const install=()=>vm.runInContext('('+installCanvasTextObserver.toString()+')('+JSON.stringify(options)+')',context);
  const read=()=>JSON.parse(JSON.stringify(vm.runInContext('('+readCanvasTextObservation.toString()+')()',context)));
  return{NativeContext,context,calls,result,brandError,original,install,read,setFailure:value=>{fail=value;}};
}

test('serialized preload forwards native receiver, arguments and return while recording exact strings/fonts',()=>{
  const f=fixture(),installed=f.install();assert.equal(installed.installed,true);
  const canvas=new f.NativeContext();canvas.font='bold 27px "Шрифт"';
  assert.equal(canvas.fillText('Портал\n№1\u0000',12,13,44),f.result);
  assert.equal(canvas.strokeText('ДВЕРЬ',-4,.5),f.result);
  assert.equal(f.calls[0].receiver,canvas);assert.deepEqual(f.calls[0].args,['Портал\n№1\u0000',12,13,44]);
  assert.deepEqual(f.calls[1].args,['ДВЕРЬ',-4,.5]);
  const report=f.read();assert.equal(report.instrumentationIntact,true);assert.equal(report.captureComplete,true);assert.equal(report.successfulCalls,2);
  assert.deepEqual(report.calls,{fillText:1,strokeText:1});assert.equal(report.entries[0].text,'Портал\n№1\u0000');
  assert.equal(report.entries[0].font,'bold 27px "Шрифт"');assert.equal(report.entries[1].method,'strokeText');
  assert.equal(f.NativeContext.prototype.fillText.length,f.original.fillText.value.length);
  assert.equal(Object.getOwnPropertyDescriptor(f.NativeContext.prototype,'fillText').enumerable,f.original.fillText.enumerable);
});

test('native failures propagate the identical exception and are never counted as drawn text',()=>{
  const f=fixture();f.install();const canvas=new f.NativeContext(),failure=new Error('native draw failed');f.setFailure(failure);
  assert.throws(()=>canvas.fillText('не нарисовано',1,2),error=>error===failure);
  assert.throws(()=>f.NativeContext.prototype.strokeText.call({},'invalid receiver',1,2),error=>error===f.brandError);
  const report=f.read();assert.equal(report.thrownCalls,2);assert.equal(report.successfulCalls,0);assert.deepEqual(report.entries,[]);
});

test('observation never coerces an object twice or invokes a shadowed font getter',()=>{
  const f=fixture();f.install();const canvas=new f.NativeContext();let conversions=0,fontReads=0;
  Object.defineProperty(canvas,'font',{get(){fontReads++;throw Error('do not read this custom property');}});
  const text={toString(){conversions++;return 'native conversion';}};
  assert.equal(canvas.fillText(text,1,2),f.result);assert.equal(conversions,1);assert.equal(fontReads,0);
  canvas.fillText('Строка',1,2);assert.equal(fontReads,0);
  const report=f.read();assert.equal(report.unrecordedTextCalls,1);assert.equal(report.captureComplete,false);assert.equal(report.entries.length,1);assert.equal(report.entries[0].font,'16px sans-serif');
});

test('primitive conversions are captured without changing the native arguments',()=>{
  const f=fixture();f.install();const canvas=new f.NativeContext();
  for(const value of [42,-0,true,null,undefined,17n])canvas.fillText(value,1,2);
  const report=f.read();assert.deepEqual(report.entries.map(entry=>entry.text),['42','0','true','null','undefined','17']);
  assert.equal(f.calls[0].args[0],42);assert.equal(Object.is(f.calls[1].args[0],-0),true);assert.equal(f.calls.at(-1).args[0],17n);
});

test('repeated strings count separately by method/font and snapshots cannot change stored observations',()=>{
  const f=fixture();f.install();const canvas=new f.NativeContext();
  canvas.fillText('Тест',0,0);canvas.fillText('Тест',1,1);canvas.strokeText('Тест',1,1);canvas.font='20px serif';canvas.fillText('Тест',1,1);
  const report=f.read();assert.equal(report.entries.length,3);assert.equal(report.entries[0].count,2);
  assert.equal(report.entries[0].firstCall,1);assert.equal(report.entries[0].lastCall,2);
  report.entries[0].text='forged';report.calls.fillText=0;
  assert.equal(f.read().entries[0].text,'Тест');assert.equal(f.read().calls.fillText,3);
});

test('unique entry overflow is explicit while native calls and retained counts continue',()=>{
  const f=fixture({maxUniqueEntries:2});f.install();const canvas=new f.NativeContext();
  for(const text of ['один','два','три','три','один'])canvas.fillText(text,1,2);
  const report=f.read();assert.equal(f.calls.length,5);assert.equal(report.successfulCalls,5);assert.equal(report.entries.length,2);
  assert.equal(report.overflow,true);assert.equal(report.captureComplete,false);assert.equal(report.overflowCalls,2);assert.equal(report.entries[0].count,2);
  assert.ok(report.entries.every(entry=>entry.text!=='три'));
});

test('oversized strings are passed intact and reported as overflow instead of truncated evidence',()=>{
  const f=fixture({maxTextCodeUnits:4});f.install();const canvas=new f.NativeContext(),text='Полная длинная строка';
  canvas.fillText(text,1,2);assert.equal(f.calls[0].args[0],text);
  const report=f.read();assert.equal(report.overflow,true);assert.equal(report.oversizedTextCalls,1);assert.deepEqual(report.entries,[]);
});

test('a second installation does not double-wrap and replaced instrumentation is detectable',()=>{
  const f=fixture();f.install();const first=f.NativeContext.prototype.fillText;
  assert.equal(f.install().alreadyInstalled,true);assert.equal(f.NativeContext.prototype.fillText,first);
  new f.NativeContext().fillText('Один вызов',1,2);assert.equal(f.read().successfulCalls,1);
  f.NativeContext.prototype.fillText=f.original.fillText.value;assert.equal(f.read().instrumentationIntact,false);
});

test('missing native support and missing preload are explicit unobserved states',()=>{
  const context=vm.createContext({});
  const read=()=>JSON.parse(JSON.stringify(vm.runInContext('('+readCanvasTextObservation.toString()+')()',context)));
  assert.equal(read().present,false);assert.equal(read().captureComplete,false);
  const installed=vm.runInContext('('+installCanvasTextObserver.toString()+')()',context);
  assert.equal(installed.installed,false);assert.equal(read().reason,'canvas-2d-unavailable');assert.equal(read().instrumentationIntact,false);
});

test('invalid observation budgets fail before any native method replacement',()=>{
  for(const options of [{maxUniqueEntries:0},{maxUniqueEntries:4097},{maxUniqueEntries:1.5},{maxTextCodeUnits:0}]){
    const f=fixture(options);assert.throws(f.install,/maxUniqueEntries|maxTextCodeUnits/);
    assert.equal(f.NativeContext.prototype.fillText,f.original.fillText.value);
  }
});
