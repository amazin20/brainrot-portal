"""Preserve the public archive, replace only the active demo, verify every new byte.
No GitHub credential is sent to the public website. Failed verification aborts.
"""
import concurrent.futures as cf
import hashlib,json,os,pathlib,shutil,sys,time,urllib.request,urllib.error,urllib.parse
BASE='https://amazin20.github.io/brainrot-portal/'
ROOT=pathlib.Path('pages');PROOF=pathlib.Path('proof');PROOF.mkdir(exist_ok=True)
def digest(data):return hashlib.sha256(data).hexdigest()
def safe(name):
 if not isinstance(name,str) or not name:raise ValueError('Missing path')
 p=pathlib.PurePosixPath(name)
 if p.is_absolute() or '..' in p.parts or '\\' in name or str(p)!=name:raise ValueError('Unsafe path '+name)
 return name
def get(name,missing=False):
 url=BASE+urllib.parse.quote(safe(name),safe='/')
 if name in ['demo-publication.json','demo-site-manifest.json','index.html','build-info.json']:url+='?demo_probe='+str(time.time_ns())
 for attempt in range(5):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'brainrot-demo-publisher','Cache-Control':'no-cache'}),timeout=60) as r:return r.read()
  except urllib.error.HTTPError as e:
   if missing and e.code==404:return None
   if e.code not in [429,500,502,503,504] or attempt==4:raise
  except (TimeoutError,OSError):
   if attempt==4:raise
  time.sleep(1+attempt*2)
def read(path):return json.loads(pathlib.Path(path).read_bytes())
def write(path,obj):pathlib.Path(path).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
def records(root,exclude=()):
 rows=[]
 for p in sorted(root.rglob('*')):
  if p.is_symlink():raise ValueError('Unexpected symlink '+str(p))
  if p.is_file():
   name=p.relative_to(root).as_posix()
   if name not in exclude:
    data=p.read_bytes();rows.append({'path':name,'bytes':len(data),'sha256':digest(data)})
 return rows
def fetch_row(row):
 name=safe(row['path']);data=get(name)
 if len(data)!=row['bytes'] or digest(data)!=row['sha256']:raise ValueError('Public bytes changed: '+name)
 dest=ROOT/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
 return len(data)
def restore():
 ROOT.mkdir(exist_ok=True);previous=get('demo-publication.json',missing=True)
 if previous:
  receipt=json.loads(previous);raw=get('demo-site-manifest.json');assert digest(raw)==receipt['siteInventorySha256'];catalog=json.loads(raw);rows=catalog['files']
  gate={'kind':'continuous-demo','receiptSha256':digest(previous)}
  (ROOT/'demo-publication.json').write_bytes(previous);(ROOT/'demo-site-manifest.json').write_bytes(raw)
 else:
  catalog=read('tools/campaign-v67-public-files.json');assert catalog['publicationAccepted'] and catalog['sourceCommit']=='cebc83f5066fe819d3439dc50ad38f15f357ad22';rows=catalog['siteFiles']
  assert len(rows)==catalog['files'];assert sum(r['bytes'] for r in rows)==catalog['bytes']
  gate={'kind':'original-v67','rootIndexSha256':digest(get('index.html'))}
 assert len({safe(r['path']) for r in rows})==len(rows)
 assert sum(r['bytes'] for r in rows)<950_000_000
 with cf.ThreadPoolExecutor(max_workers=16) as pool:
  total=0
  for i,n in enumerate(pool.map(fetch_row,rows),1):
   total+=n
   if i%250==0:print('Preserved',i,'/',len(rows),'files',flush=True)
 write(PROOF/'before.json',gate);write(PROOF/'preserved-files.json',rows)
 write(PROOF/'restore.json',{'files':len(rows),'bytes':total,'allHashesVerified':True})
 print('Existing public site preserved:',len(rows),total)
def verify_package():
 d=pathlib.Path('candidate');manifest=read(d/'demo-manifest.json');source=os.environ['SOURCE_COMMIT']
 assert manifest['commit']==source and str(manifest['runId'])==os.environ['SOURCE_RUN']
 files=manifest['files'];assert len(files)==len({safe(f['path']) for f in files})
 assert records(d,('demo-manifest.json',))==files,'Unexpected candidate file or hash'
 assert sum(f['bytes'] for f in files)<100_000_000
 info=read(d/'build-info.json');assert info['commit']==source and info['levels']==51 and info['status']=='development-demo' and info['verified'] is False
 return manifest,info
def redirect(destination):
 return ('<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>БРЕЙНРОТ ПОРТАЛ — актуальная демка</title><p><a id="play" href="'+destination+'">Открыть актуальную демку</a></p><script>const u=new URL('+json.dumps(destination)+',location.href);u.search=location.search;u.hash=location.hash;document.querySelector("#play").href=u;location.replace(u.href);</script></html>')
def assemble():
 manifest,info=verify_package();source=manifest['commit'];target=ROOT/'campaign-v67'
 archive=ROOT/'archive/campaign-v67-20261022'
 if not archive.exists():
  assert (target/'index.html').is_file();shutil.copytree(target,archive)
  (archive/'ARCHIVE-NOTICE.txt').write_text('Историческая версия от 22.10.2026. Текущая демка: ../../campaign-v67/\n')
 target.mkdir(exist_ok=True);shutil.copytree('candidate',target,dirs_exist_ok=True)
 (ROOT/'index.html').write_text(redirect('./campaign-v67/'))
 (ROOT/'demo').mkdir(exist_ok=True);(ROOT/'demo/index.html').write_text(redirect('../campaign-v67/'))
 (ROOT/'build-info.json').write_bytes((target/'build-info.json').read_bytes())
 before=read(PROOF/'preserved-files.json')
 mutable={'index.html','build-info.json','demo/index.html','demo-publication.json','demo-site-manifest.json'}
 changed={f'campaign-v67/{f["path"]}' for f in records(pathlib.Path('candidate'))}
 for row in before:
  if row['path'] not in mutable|changed:
   p=ROOT/safe(row['path']);assert p.is_file() and digest(p.read_bytes())==row['sha256'],'Historical file changed: '+row['path']
 inventory={'schema':1,'sourceCommit':source,'files':records(ROOT,('demo-publication.json','demo-site-manifest.json'))}
 assert sum(r['bytes'] for r in inventory['files'])<950_000_000
 write(ROOT/'demo-site-manifest.json',inventory)
 receipt={'schema':1,'sourceCommit':source,'sourceBranch':'upgrade/tz-completion-20261023','sourceRun':int(os.environ['SOURCE_RUN']),
 'publicationRun':int(os.environ['GITHUB_RUN_ID']),'publisherCommit':os.environ['GITHUB_SHA'],'publishedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
 'channel':'development-demo','url':BASE+'campaign-v67/','siteInventorySha256':digest((ROOT/'demo-site-manifest.json').read_bytes()),
 'scope':'Build, storage/access tests and native startup smoke. All-level regression acceptance, human testing and live Yandex approval remain separate.',
 'fullCampaignAccepted':False,'yandexPublished':False}
 write(ROOT/'demo-publication.json',receipt);write(PROOF/'publication.json',receipt)
 expected=[{'path':'campaign-v67/'+r['path'],**{k:v for k,v in r.items() if k!='path'}} for r in records(pathlib.Path('candidate'))]
 expected += [r for r in records(ROOT) if r['path'] in ['index.html','build-info.json','demo/index.html','demo-publication.json','demo-site-manifest.json']]
 write(PROOF/'public-check-files.json',expected)
 print('Assembled current demo',source,'preserving every unrelated historical file')
def gate():
 prior=read(PROOF/'before.json');current=get('demo-publication.json',missing=True)
 if prior['kind']=='continuous-demo':assert current and digest(current)==prior['receiptSha256'],'Another publication changed the site'
 else:assert current is None and digest(get('index.html'))==prior['rootIndexSha256'],'Original public root changed'
def verify():
 rows=read(PROOF/'public-check-files.json')
 for attempt in range(10):
  try:
   receipt=json.loads(get('demo-publication.json'));assert receipt['sourceCommit']==os.environ['SOURCE_COMMIT'] and receipt['publicationRun']==int(os.environ['GITHUB_RUN_ID']);break
  except (AssertionError,urllib.error.HTTPError):
   if attempt==9:raise
   time.sleep(6)
 def check(r):
  data=get(r['path']);assert len(data)==r['bytes'] and digest(data)==r['sha256'],'Public mismatch: '+r['path'];return r['bytes']
 with cf.ThreadPoolExecutor(max_workers=12) as pool:total=sum(pool.map(check,rows))
 write(PROOF/'public-http.json',{'pass':True,'sourceCommit':os.environ['SOURCE_COMMIT'],'files':len(rows),'bytes':total,'allNewFilesVerified':True})
 print('Verified new public bytes',len(rows),total)
if __name__=='__main__':{'restore':restore,'assemble':assemble,'gate':gate,'verify':verify}[sys.argv[1]]()
