from pathlib import Path
import shutil
r=Path.cwd()
for d in ['src','scripts','tests','docs','.github']:
    shutil.copytree(Path('/tmp/w03-payload')/d,r/d,dirs_exist_ok=True)
def edit(file,old,new):
    p=r/file;s=p.read_text();assert old in s, (file,old);p.write_text(s.replace(old,new))
edit('src/game/LabAdvancedArchitecture.js',' {wall:0x7c7d8d,low:0x9294a1,high:0xb6a8b4,edge:0xd4bbd2,trim:0x5b5a70,sky:0x414154},',' {wall:0x7c7d8d,low:0x9294a1,high:0xb6a8b4,edge:0xd4bbd2,trim:0x5b5a70,sky:0x414154},\n {wall:0x7e8d89,low:0x9caeaa,high:0xc3b79e,edge:0xe6b86b,trim:0x536a64,sky:0x435851},')
for f in ['LabBrowser3DArt.js','LabBrowser3DPremium.js','LabMechanismReflections.js']:
    edit('src/game/'+f,'level.index>19','level.index>20')
p=r/'src/game/LabCampaignLevels.js';s=p.read_text();s="import {ROOM21_SPEC,buildRoom21} from './LabPortalRoom21.js';\n"+s;s=s.replace('ROOM19_SPEC,ROOM20_SPEC];','ROOM19_SPEC,ROOM20_SPEC,ROOM21_SPEC];').replace('buildRoom19,buildRoom20];','buildRoom19,buildRoom20,buildRoom21];');p.write_text(s)
edit('src/game/LabV8Journey.js',"()=>import('./LabRoom19Journey.js'),()=>import('./LabRoom20Journey.js'),","()=>import('./LabRoom19Journey.js'),()=>import('./LabRoom20Journey.js'),()=>import('./LabRoom21Journey.js'),")
edit('src/main.js','      window.__NESI_RUN_LEVEL_ROUTE__=async()=>',"""      window.__NESI_RUN_ROOM21_RECORDED__=async(options={})=>{
        const {runRoom21Recorded}=await import('./game/LabRoom21Recording.js');
        game.renderer.setAnimationLoop(null);hideScreens();setState('playing');
        try{return await runRoom21Recorded(game,options);}
        finally{game.render();clearInput();setState(game.state);diagnostics();}
      };
      window.__NESI_RUN_LEVEL_ROUTE__=async()=>""")
for f in ['tests/lab-wind-room.test.js','tests/lab-extended-campaign.test.js','scripts/v8-package-check.mjs','scripts/stamp-build.mjs']:
    p=r/f;s=p.read_text().replace('CAMPAIGN.length,20','CAMPAIGN.length,21').replace('twenty-course registry','twenty-one-course registry');p.write_text(s)
edit('scripts/v8-package-check.mjs',"assert.equal(CAMPAIGN.at(-1).id,'braided-exchange');","assert.equal(CAMPAIGN[19].id,'braided-exchange');assert.equal(CAMPAIGN.at(-1).id,'gravity-pocket');")
for f in ['scripts/stamp-build.mjs','scripts/verify-public.mjs','.github/workflows/verified-build.yml','.github/workflows/deploy-pages.yml','.github/workflows/campaign-preview.yml','.github/workflows/early-art-review.yml']:
    p=r/f;s=p.read_text().replace('v36-unified-campaign-art','v37-gravity-pocket').replace('v36-complete-machined-environment','v37-gravity-pocket-environment').replace('info?.levels,20','info?.levels,21').replace('info.levels,20','info.levels,21')
    if f.endswith('verified-build.yml'):
        s=s.replace("          - {first: 20, last: 20, ui: '0'}", "          - {first: 20, last: 20, ui: '0'}\n          - {first: 21, last: 21, ui: '0'}").replace('All twenty routes','All twenty-one routes').replace('all twenty ordinary routes','all twenty-one ordinary routes')
    if f.endswith('verify-public.mjs'):s=s.replace('(_,i)=>i+1),20]', '(_,i)=>i+1),20,21]')
    p.write_text(s)
