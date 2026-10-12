"""Recover immutable original artifact bytes through small read-only parts."""
import os,json,pathlib,hashlib,urllib.request,urllib.error,urllib.parse,subprocess,tempfile,copy
REPO='amazin20/brainrot-portal'
PUBLISHER='300e898c169a281bd3e0054e2c4b39bb055649e0'
SOURCE='58a71ddfc9bf704bef4c97fe13d16401c5a5f9f2'
RUN=38251739817
ARTIFACT=11752231330
SIZE=631746277
DIGEST='46009cc59b9612e84db53b81999d9878280f7dd3b82afb66a1cc560f08f1f599'
BRANCH='ops/recover-tower41-proof-20261012'
PART_LIMIT=128*1024*1024
JOBS={'Assemble the exact reviewed preview without changing the current site','Verify every existing byte, append the preview and execute its actual public ordinary journey'}
def require(value,label):
 if not value:raise ValueError(label)
def sha_file(path):
 h=hashlib.sha256()
 with path.open('rb')as f:
  for b in iter(lambda:f.read(4*1024*1024),b''):h.update(b)
 return h.hexdigest()
def check_publication(run,jobs,artifact,main,source):
 require(run['id']==RUN and run['run_attempt']==1 and run['head_sha']==PUBLISHER and run['head_branch']=='main' and run['event']=='push' and run['path']=='.github/workflows/publish-puzzle-progression-finale.yml' and run['status']=='completed' and run['conclusion']=='success','Wrong actual successful publication')
 require(len(jobs)==2 and {j['name']for j in jobs}==JOBS and {j['id']for j in jobs}=={114819519370,114820320448},'Two actual jobs required')
 for j in jobs:require(j['run_id']==RUN and j['run_attempt']==1 and j['head_sha']==PUBLISHER and j['status']=='completed' and j['conclusion']=='success','Wrong successful actual job')
 require(artifact['id']==ARTIFACT and artifact['name']==f'tower41-native-publication-proof-{RUN}-1' and artifact['size_in_bytes']==SIZE and artifact['digest']=='sha256:'+DIGEST and artifact['expired']is False and artifact['workflow_run']['id']==RUN and artifact['workflow_run']['head_sha']==PUBLISHER and artifact['workflow_run']['head_branch']=='main','Wrong immutable original artifact')
 require(main['object']['sha']==PUBLISHER and source['object']['sha']==SOURCE,'Current main or frozen source changed')
def verify_original(path,size,digest):
 require(path.is_file() and not path.is_symlink() and path.stat().st_size==size,'Original size changed')
 require(sha_file(path)==digest,'Original full SHA changed')
def split_verified(path,output,size,digest,limit=PART_LIMIT):
 verify_original(path,size,digest)
 require(type(limit)is int and 0<limit<=PART_LIMIT and not output.exists(),'Invalid new part output')
 output.mkdir(parents=True);rows=[];offset=0
 with path.open('rb')as f:
  while offset<size:
   part=f.read(min(limit,size-offset));require(part,'Truncated original')
   index=len(rows)+1;name=f'part-{index:03d}.bin';target=output/name
   with target.open('xb')as t:t.write(part)
   rows.append({'index':index,'name':name,'offset':offset,'bytes':len(part),'sha256':hashlib.sha256(part).hexdigest()});offset+=len(part)
  require(f.read(1)==b'' and offset==size,'Original coverage changed')
 return rows
def signed_location(value):
 u=urllib.parse.urlsplit(value);require(u.scheme=='https' and u.hostname and not u.username and not u.password,'Unsafe artifact redirect')
 return value
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,request,fp,code,msg,headers,newurl):return None
def api(resource):
 token=os.environ['GITHUB_TOKEN'];url='https://api.github.com/repos/'+REPO+'/'+resource
 req=urllib.request.Request(url,headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'})
 try:
  with urllib.request.urlopen(req,timeout=90)as f:return json.load(f)
 except Exception:raise RuntimeError('Read-only provider metadata request failed')from None
def download_original(destination):
 # Authorization goes ONLY to api.github.com. The redirect is followed with
 # a new credential-free request, and its signed URL is never logged/saved.
 url=f'https://api.github.com/repos/{REPO}/actions/artifacts/{ARTIFACT}/zip'
 req=urllib.request.Request(url,headers={'Authorization':'Bearer '+os.environ['GITHUB_TOKEN'],'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'})
 try:
  try:
   response=urllib.request.build_opener(NoRedirect()).open(req,timeout=90)
  except urllib.error.HTTPError as e:
   require(e.code in (301,302,303,307,308),'Artifact download was not redirected');location=signed_location(e.headers['Location']);response=urllib.request.urlopen(urllib.request.Request(location),timeout=120)
  count=0;h=hashlib.sha256()
  with response as f,destination.open('xb')as out:
   for b in iter(lambda:f.read(4*1024*1024),b''):
    count+=len(b);require(count<=SIZE,'Original artifact exceeds pinned size');out.write(b);h.update(b)
  require(count==SIZE and h.hexdigest()==DIGEST,'Downloaded original artifact bytes do not match provider')
 except Exception:
  destination.unlink(missing_ok=True);raise RuntimeError('Original artifact transport or exact byte validation failed')from None
def self_test():
 count=0
 with tempfile.TemporaryDirectory()as folder:
  root=pathlib.Path(folder);p=root/'sample';data=b'original-zip-bytes';p.write_bytes(data);digest=hashlib.sha256(data).hexdigest()
  rows=split_verified(p,root/'parts',len(data),digest,5);require(b''.join((root/'parts'/r['name']).read_bytes()for r in rows)==data,'Uneven parts changed bytes');require([r['offset']for r in rows]==[0,5,10,15] and sum(r['bytes']for r in rows)==len(data),'Part offsets changed');count+=1
  for size,d in [(len(data)+1,digest),(len(data),'0'*64)]:
   try:split_verified(p,root/'invalid',size,d,5)
   except ValueError:require(not(root/'invalid').exists(),'Rejected input produced parts');count+=1
   else:raise AssertionError('Invalid original accepted')
  for url in ['http://example.com/a','https://user:password@example.com/a','file:///a']:
   try:signed_location(url)
   except ValueError:count+=1
   else:raise AssertionError('Unsafe redirect accepted')
  require(signed_location('https://example.com/a?token=private').startswith('https://'),'Valid transport rejected');count+=1
 require(count==7,'Incomplete meaningful transfer checks');print(json.dumps({'recoveryTransferChecks':count,'pass':True}))
def main():
 self_test();require(os.environ['GITHUB_REPOSITORY']==REPO and os.environ['GITHUB_REF']=='refs/heads/'+BRANCH,'Recovery repository/ref changed')
 head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip();parent=subprocess.check_output(['git','rev-parse','HEAD^'],text=True).strip()
 require(head==os.environ['GITHUB_SHA'] and parent==PUBLISHER,'Recovery is not one direct child of the unchanged publisher')
 run=api('actions/runs/'+str(RUN));jobs_response=api(f'actions/runs/{RUN}/jobs?filter=all&per_page=100');require(jobs_response['total_count']==2,'Unexpected hidden/paginated publication jobs');jobs=jobs_response['jobs'];artifact=api('actions/artifacts/'+str(ARTIFACT));mainref=api('git/ref/heads/main');source=api('git/ref/heads/upgrade/tower41-preview-nav-20261012');check_publication(run,jobs,artifact,mainref,source)
 root=pathlib.Path('recovery');root.mkdir();original=root/'original.zip';download_original(original);rows=split_verified(original,root/'parts',SIZE,DIGEST)
 require(len(rows)==5 and [r['offset']for r in rows]==[i*PART_LIMIT for i in range(5)],'Exact five-part coverage required')
 final_jobs=api(f'actions/runs/{RUN}/jobs?filter=all&per_page=100');require(final_jobs['total_count']==2,'Publication job pagination changed');check_publication(api('actions/runs/'+str(RUN)),final_jobs['jobs'],api('actions/artifacts/'+str(ARTIFACT)),api('git/ref/heads/main'),api('git/ref/heads/upgrade/tower41-preview-nav-20261012'))
 manifest={'schemaVersion':1,'pass':True,'recoveryCommit':head,'recoveryRun':int(os.environ['GITHUB_RUN_ID']),'recoveryAttempt':int(os.environ['GITHUB_RUN_ATTEMPT']),'originalArtifact':artifact,'originalPublication':{'runId':RUN,'runAttempt':1,'publisherCommit':PUBLISHER,'sourceCommit':SOURCE},'originalZip':{'bytes':SIZE,'sha256':DIGEST},'parts':rows,'transport':'Exact original ZIP bytes partitioned after full provider SHA validation. No ZIP extraction, Pages permission or main/source mutation.','before':{'run':run,'jobs':jobs,'main':mainref,'source':source}}
 (root/'manifest').mkdir();(root/'manifest/recovery-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'originalBytesVerified':SIZE,'originalSha256':DIGEST,'rawParts':len(rows),'pass':True}))
if __name__=='__main__':main()
