from pathlib import Path

def replace(file,old,new):
 p=Path(file);s=p.read_text();assert old in s,(file,old);p.write_text(s.replace(old,new))
p=Path('src/game/LabCampaignLevels.js');s=p.read_text();assert 'RESEARCH_BUILDERS' not in s
s="import {RESEARCH_BUILDERS,RESEARCH_SPECS} from './LabResearchChambers.js';\n"+s
s=s.replace('...NEW_CAMPAIGN]);','...NEW_CAMPAIGN,...RESEARCH_SPECS]);')
s=s.replace(" if(game.chamberEdition==='open'&&OPEN_BUILDERS[index])", " if(index>=30)return RESEARCH_BUILDERS[index-30](game,index);\n if(game.chamberEdition==='open'&&OPEN_BUILDERS[index])")
p.write_text(s)
replace('src/game/LabV8Journey.js','    if(level.openChamber){',"    if(level.researchChamber){\n      const {runResearchJourney}=await import('./LabResearchJourney.js');\n      await runResearchJourney({game,level,walk,wait,aim,look,until,pickup,enter,mark,frame,worldMove,stop},journeyOptions);\n    }else if(level.openChamber){")
replace('src/game/LabOpenEdition.js','[23,27,29]','[23,27,29,30,31,32]')
replace('src/game/LabOpenEdition.js','The three rebuilt rooms are an explicit review edition.','The rebuilt rooms and the research chapter form an explicit review edition.')
for p in list(Path('.github/workflows').glob('*.yml'))+[Path('scripts/stamp-build.mjs'),Path('scripts/verify-public.mjs')]:
 s=p.read_text().replace('v39-campaign-30','v40-laboratory-33').replace('v39-chromatic-worlds','v40-research-laboratory')
 if p.name=='deploy-pages.yml':s=s.replace('info.levels,30','info.levels,33').replace('all thirty WebGL','all thirty-three WebGL')
 if p.name=='stamp-build.mjs':s=s.replace('CAMPAIGN.length,30','CAMPAIGN.length,33').replace('campaignRooms:30,campaignFinaleLevel:30','campaignRooms:33,campaignFinaleLevel:33').replace("version:'human-laboratory-v2'","version:'research-laboratory-v3'").replace('rooms:[24,28,30]','rooms:[24,28,30,31,32,33]')
 if p.name=='verify-public.mjs':s=s.replace('info?.levels,30','info?.levels,33').replace('[1,9,10,20,24,26,27,28,29,30]','[1,9,10,20,24,26,27,28,29,30,31,32,33]').replace('if(level===10||level===20||level===26)','if(level===10||level===20||level===26||level===30)').replace('{from:30,to:1','{from:33,to:1').replace('All thirty','All thirty-three').replace("'v39 campaign: 30 rooms; public ordinary routes 1,9,10,20,24,26–30; transitions 10→11,20→21,26→27,30→1;", "'v40 campaign: 33 rooms; public ordinary routes 1,9,10,20,24,26–33; transitions 10→11,20→21,26→27,30→31,33→1;")
 p.write_text(s)
for file in ['scripts/v8-package-check.mjs','tests/lab-extended-campaign.test.js','tests/lab-wind-room.test.js']:
 replace(file,'CAMPAIGN.length,30','CAMPAIGN.length,33')
replace('tests/lab-open-edition.test.js','only its three actual replacements','its replacements plus the new research chapter')
replace('tests/lab-open-edition.test.js','[24,28,30]','[24,28,30,31,32,33]')
replace('tests/lab-open-edition.test.js','[27,29,23]','[27,29,30,31,32,23]')
replace('scripts/open-browser-review.mjs','assert.deepEqual(menu,[23,27,29])','assert.deepEqual(menu,[23,27,29,30,31,32])')
p=Path('.github/workflows/verified-build.yml');s=p.read_text().replace('all thirty ordinary routes','all thirty-three ordinary routes').replace('All thirty routes','All thirty-three routes').replace("- {first: 30, last: 30, ui: '0'}", "- {first: 30, last: 30, ui: '0'}\n          - {first: 31, last: 33, ui: '0'}")
s+='''
  research:
    name: Research room ${{ matrix.room }} with alternative and recovery routes
    runs-on: ubuntu-latest
    timeout-minutes: 20
    strategy:
      fail-fast: false
      matrix:
        room: [31, 32, 33]
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.revision }}
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: |
          npm ci
          npm install --no-save --package-lock=false puppeteer-core@24.16.0
          npm run build
          node scripts/stamp-build.mjs v40-laboratory-33
      - name: Ordinary solution and alternative exploration in native WebGL
        env:
          ROOMS: ${{ matrix.room }}
          RECORD: ${{ inputs.record_puzzle && '1' || '0' }}
        run: |
          npm run preview -- --host 127.0.0.1 --port 4173 >research-preview.log 2>&1 &
          for i in {1..30}; do curl -fsS http://127.0.0.1:4173/ >/dev/null && break; sleep 1; done
          export CHROME_PATH="$(command -v google-chrome || command -v chromium)"
          node scripts/research-browser.mjs
          RECORD=0 ALTERNATE=1 OUT_DIR=qa/research-alternative node scripts/research-browser.mjs
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: research-chapter-${{ matrix.room }}
          path: |
            qa/research-browser/
            qa/research-alternative/
            research-preview.log
          retention-days: 14
'''
p.write_text(s)
Path('.github/workflows/research-wire.yml').unlink()
Path('.github/workflows/chapter-workspace.yml').unlink(missing_ok=True)
Path(__file__).unlink()
