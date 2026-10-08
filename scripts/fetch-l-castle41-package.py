#!/usr/bin/env python3
"""Fetch the fixed L browser artifact. Signed download URLs are never logged."""
import argparse, hashlib, json, os, pathlib, stat, urllib.request, urllib.error, zipfile

class Redirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        request = super().redirect_request(req, fp, code, msg, headers, newurl)
        if request is not None:
            request.remove_header('Authorization')
        return request

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--pin',required=True);ap.add_argument('--out',required=True)
    args=ap.parse_args();pin=json.loads(pathlib.Path(args.pin).read_text());out=pathlib.Path(args.out)
    out.mkdir(parents=True,exist_ok=True)
    token=os.environ.get('GITHUB_TOKEN');assert token,'Missing read-only Actions token'
    api='https://api.github.com/repos/'+pin['repo'];opener=urllib.request.build_opener(Redirect())
    def get(url):
        request=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'application/vnd.github+json','Authorization':'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'})
        with opener.open(request,timeout=60) as response:return response.read()
    run=json.loads(get(api+'/actions/runs/'+str(pin['run'])))
    assert run['id']==pin['run'] and run['head_sha']==pin['commit'] and run['run_attempt']==pin['attempt'],'Run identity mismatch'
    artifact=json.loads(get(api+'/actions/artifacts/'+str(pin['artifact'])))
    assert artifact['id']==pin['artifact'] and artifact['name']==pin['artifactName'] and not artifact['expired'],'Artifact identity mismatch'
    assert artifact['workflow_run']['id']==pin['run'] and artifact['workflow_run']['head_sha']==pin['commit'],'Artifact run/source mismatch'
    assert artifact['digest']=='sha256:'+pin['outerSha256'] and artifact['size_in_bytes']==pin['artifactBytes'],'Artifact metadata digest/size mismatch'
    data=get(api+'/actions/artifacts/'+str(pin['artifact'])+'/zip')
    assert len(data)==pin['artifactBytes'] and hashlib.sha256(data).hexdigest()==pin['outerSha256'],'Actual outer ZIP mismatch'
    archive=out/'campaign-browser.zip';archive.write_bytes(data);package=out/'package'
    assert not package.exists(),'Extraction destination already exists'
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None,'ZIP CRC failure'
        files=z.infolist();names=[i.filename for i in files];assert len(names)==len(set(names)),'Duplicate ZIP entry'
        assert sum(i.file_size for i in files)<32*1024*1024,'Unexpected extraction size'
        for entry in files:
            p=pathlib.PurePosixPath(entry.filename)
            assert not p.is_absolute() and '..' not in p.parts and '\\' not in entry.filename,'Unsafe ZIP path'
            assert not stat.S_ISLNK(entry.external_attr>>16) and not entry.flag_bits&1,'Symlink/encrypted ZIP entry'
        z.extractall(package)
    proof={'pin':pin,'run':{k:run.get(k) for k in ['id','head_sha','run_attempt','path','event','status','conclusion']},
           'artifact':{k:artifact[k] for k in ['id','name','size_in_bytes','digest','created_at','workflow_run']},
           'outerZipSha256':hashlib.sha256(data).hexdigest(),'outerZipBytes':len(data),'safeExtraction':True}
    (out/'download-proof.json').write_text(json.dumps(proof,indent=2)+'\n')
    print(json.dumps({'artifact':artifact['id'],'bytes':len(data),'sha256':proof['outerZipSha256'],'safeExtraction':True}))

if __name__=='__main__':
    try:main()
    except urllib.error.HTTPError as error:raise SystemExit('GitHub artifact HTTP status '+str(error.code)) from None
    except urllib.error.URLError:raise SystemExit('GitHub artifact network request failed; private URL omitted') from None
