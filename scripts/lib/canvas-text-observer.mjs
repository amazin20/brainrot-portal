/** QA-only observation of native 2D text commands. These functions are
 * closure-free so Puppeteer can preload/read them in the actual game page.
 * Captures establish issued commands, not visible pixels or language approval.
 */
export function installCanvasTextObserver({maxUniqueEntries=2048,maxTextCodeUnits=16384}={}){
  if(!Number.isInteger(maxUniqueEntries)||maxUniqueEntries<1||maxUniqueEntries>4096)throw new RangeError('maxUniqueEntries must be between1 and4096');
  if(!Number.isInteger(maxTextCodeUnits)||maxTextCodeUnits<1||maxTextCodeUnits>1048576)throw new RangeError('maxTextCodeUnits must be between1 and1048576');
  const key='__LAB_CANVAS_TEXT_OBSERVER__',scope=globalThis;
  if(Object.prototype.hasOwnProperty.call(scope,key)){
    const previous=scope[key];
    if(previous?.kind!=='canvas-text-draw-observation'||previous.schemaVersion!==1)throw new Error('Canvas text observer key is already in use');
    return {installed:previous.installed,methods:[...previous.methods],alreadyInstalled:true,reason:previous.reason};
  }
  const state={schemaVersion:1,kind:'canvas-text-draw-observation',installed:false,methods:[],reason:null,
    maxUniqueEntries,maxTextCodeUnits,calls:{fillText:0,strokeText:0},successfulCalls:0,thrownCalls:0,
    unrecordedTextCalls:0,fontUnavailableCalls:0,observationErrors:0,overflow:false,overflowCalls:0,oversizedTextCalls:0,entries:[],
    scope:'Successful native CanvasRenderingContext2D text commands; no pixel visibility, human readability or language verdict.'};
  Object.defineProperty(state,'_bindings',{value:[]});
  Object.defineProperty(scope,key,{value:state,configurable:false,writable:false,enumerable:false});
  const prototype=scope.CanvasRenderingContext2D?.prototype;
  if(!prototype){state.reason='canvas-2d-unavailable';return {installed:false,methods:[],alreadyInstalled:false,reason:state.reason};}
  const names=['fillText','strokeText'],descriptors=names.map(name=>Object.getOwnPropertyDescriptor(prototype,name));
  if(descriptors.some(d=>!d||typeof d.value!=='function'||(!d.configurable&&!d.writable))){
    state.reason='native-text-methods-unavailable';return {installed:false,methods:[],alreadyInstalled:false,reason:state.reason};
  }
  // Read the native font accessor directly. A user-defined own font getter
  // must not be called as an extra side effect of observing a draw command.
  let fontDescriptor,fontPrototype=prototype;
  while(fontPrototype&&!fontDescriptor){fontDescriptor=Object.getOwnPropertyDescriptor(fontPrototype,'font');fontPrototype=Object.getPrototypeOf(fontPrototype);}
  const fontGetter=typeof fontDescriptor?.get==='function'?fontDescriptor.get:null,unique=new Map();
  const record=(method,context,args,ordinal)=>{
    let text;const value=args[0],type=typeof value;
    if(type==='string')text=value;
    else if(value===null||['undefined','number','boolean','bigint'].includes(type))text=String(value);
    else{
      // Native WebIDL already performed any required conversion. Converting
      // an object again could call toString twice and change game behavior.
      state.unrecordedTextCalls++;return;
    }
    if(text.length>maxTextCodeUnits){state.overflow=true;state.overflowCalls++;state.oversizedTextCalls++;return;}
    let font=null;
    try{if(fontGetter){const value=Reflect.apply(fontGetter,context,[]);if(typeof value==='string')font=value;}}catch{}
    if(font===null)state.fontUnavailableCalls++;
    const identity=JSON.stringify([method,text,font]),existing=unique.get(identity);
    if(existing){existing.count++;existing.lastCall=ordinal;return;}
    if(state.entries.length>=maxUniqueEntries){state.overflow=true;state.overflowCalls++;return;}
    const entry={method,text,font,count:1,firstCall:ordinal,lastCall:ordinal};unique.set(identity,entry);state.entries.push(entry);
  };
  try{
    for(let index=0;index<names.length;index++){
      const method=names[index],descriptor=descriptors[index],original=descriptor.value;
      const wrapped=function(...args){
        state.calls[method]++;const ordinal=state.calls.fillText+state.calls.strokeText;
        let result;
        try{result=Reflect.apply(original,this,args);}catch(error){state.thrownCalls++;throw error;}
        state.successfulCalls++;
        try{record(method,this,args,ordinal);}catch{state.observationErrors++;}
        return result;
      };
      Object.defineProperty(wrapped,'name',{value:original.name,configurable:true});
      Object.defineProperty(wrapped,'length',{value:original.length,configurable:true});
      Object.defineProperty(prototype,method,{...descriptor,value:wrapped});
      state._bindings.push({prototype,method,wrapper:wrapped,descriptor});state.methods.push(method);
    }
    state.installed=true;
  }catch{
    // A partial installation is never reported as complete. Undo every
    // successful replacement when the prototype permits restoring it.
    for(const binding of [...state._bindings].reverse())try{Object.defineProperty(binding.prototype,binding.method,binding.descriptor);}catch{}
    state.methods=state._bindings.filter(b=>Object.getOwnPropertyDescriptor(b.prototype,b.method)?.value===b.wrapper).map(b=>b.method);
    state.reason='native-text-method-wrap-failed';
  }
  return {installed:state.installed,methods:[...state.methods],alreadyInstalled:false,reason:state.reason};
}

export function readCanvasTextObservation(){
  const state=globalThis.__LAB_CANVAS_TEXT_OBSERVER__;
  if(!state||state.kind!=='canvas-text-draw-observation'||state.schemaVersion!==1)return {
    schemaVersion:1,kind:'canvas-text-draw-observation',present:false,installed:false,instrumentationIntact:false,captureComplete:false,
    reason:'observer-not-installed',methods:[],entries:[],
  };
  const bindings=state._bindings;
  const intact=state.installed&&Array.isArray(bindings)&&bindings.length===2&&bindings.every(binding=>
    Object.getOwnPropertyDescriptor(binding.prototype,binding.method)?.value===binding.wrapper);
  const complete=intact&&!state.overflow&&state.unrecordedTextCalls===0&&state.fontUnavailableCalls===0&&state.observationErrors===0
    &&state.entries.reduce((total,entry)=>total+entry.count,0)===state.successfulCalls;
  return {schemaVersion:state.schemaVersion,kind:state.kind,present:true,installed:state.installed,instrumentationIntact:intact,
    captureComplete:complete,
    reason:state.reason,methods:[...state.methods],maxUniqueEntries:state.maxUniqueEntries,maxTextCodeUnits:state.maxTextCodeUnits,
    calls:{fillText:state.calls.fillText,strokeText:state.calls.strokeText},successfulCalls:state.successfulCalls,thrownCalls:state.thrownCalls,
    unrecordedTextCalls:state.unrecordedTextCalls,fontUnavailableCalls:state.fontUnavailableCalls,observationErrors:state.observationErrors,
    overflow:state.overflow,overflowCalls:state.overflowCalls,oversizedTextCalls:state.oversizedTextCalls,
    entries:state.entries.map(entry=>({...entry})),scope:state.scope};
}
