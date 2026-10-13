import test from 'node:test';
import assert from 'node:assert/strict';
import {PUBLIC_CAMPAIGN_URL,assertBareEntry,assertBareRuntime,assertIsolatedStorage} from './qa-campaign-v55-public-entry.mjs';

test('bare public entry gate requires exact public origin, path and zero query/hash',()=>{
 assert.equal(assertBareEntry(PUBLIC_CAMPAIGN_URL).href,PUBLIC_CAMPAIGN_URL);
 for(const url of [PUBLIC_CAMPAIGN_URL+'?debug=1',PUBLIC_CAMPAIGN_URL+'?edition=foundation',PUBLIC_CAMPAIGN_URL+'#start',PUBLIC_CAMPAIGN_URL.replace('amazin20.github.io','example.com'),PUBLIC_CAMPAIGN_URL.replace('campaign-v55','tower41-v3'),'http://127.0.0.1:4193/campaign-v55/'])assert.throws(()=>assertBareEntry(url));
 assert.equal(assertBareEntry('http://127.0.0.1:4193/campaign-v55/',{localPreparation:true}).hostname,'127.0.0.1');
 assert.throws(()=>assertBareEntry(PUBLIC_CAMPAIGN_URL,{localPreparation:true}));
});
test('historical save bytes and private writes are both mandatory, independent of persisted values',()=>{
 const historical={'brainrot-foundation-v1:brainrot-portal.preferences.v24':'original bytes'};
 const own=JSON.stringify({completed:[0,1,6],hints:{1:2},resumeLevel:3,volume:.37,tutorial:false});
 const good={historical,own,writes:[{method:'setItem',key:'brainrot-campaign-v55:brainrot-portal.preferences.v24'}]};
 assert.equal(assertIsolatedStorage(good,historical).volume,.37);
 for(const bad of [{...good,historical:{...historical,[Object.keys(historical)[0]]:'changed'}},{...good,writes:[{method:'setItem',key:Object.keys(historical)[0]}]},{...good,writes:[{method:'clear',key:''}]},{...good,own:null},{...good,own:JSON.stringify({completed:[],hints:{1:2},resumeLevel:3})},{...good,own:JSON.stringify({completed:[0,1,6],hints:{},resumeLevel:3})}])assert.throws(()=>assertIsolatedStorage(bad,historical));
});
test('bare DOM observation rejects debug runtime, stale ordering and wrong restored room',()=>{
 const good={location:PUBLIC_CAMPAIGN_URL,debugExposed:false,runtimeState:'ready',gameReady:'true',modelsLoaded:14,edition:'foundation',preview:'false',physicalEntry:'',gameMode:'campaign',levelIndex:3,visibleRoom:4,selectedIndex:3,hudNumber:4,
  indices:[...Array.from({length:40},(_,i)=>i),...Array.from({length:10},(_,i)=>i+41),40],numbers:Array.from({length:51},(_,i)=>i+1)};
 assertBareRuntime(good);
 for(const bad of [{...good,debugExposed:true},{...good,levelIndex:0},{...good,visibleRoom:3},{...good,hudNumber:3},{...good,selectedIndex:0},{...good,indices:Array.from({length:51},(_,i)=>i)},{...good,numbers:good.indices.map(i=>i+1)},{...good,runtimeState:'loading'},{...good,physicalEntry:'foundation20'},{...good,edition:'open'},{...good,modelsLoaded:0},{...good,location:PUBLIC_CAMPAIGN_URL+'?debug=1'}])assert.throws(()=>assertBareRuntime(bad));
 assertBareRuntime({...good,runtimeState:'playing'},{state:'playing'});
});
