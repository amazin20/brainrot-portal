"""Isolated PUBLIC trust-boundary fixtures; no network, routes, or builds."""
import copy
import importlib.util
import json
import pathlib
import stat
import tempfile
import unittest
import warnings
import zipfile
from PIL import Image

ROOT=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('public_v57_auditor',ROOT/'audit-public-v57.py')
A=importlib.util.module_from_spec(spec);spec.loader.exec_module(A)
COMMIT='a'*40
SOURCE='b'*40
RUN=10001
STAMP='c'*64
PRODUCER={'GITHUB_REPOSITORY':A.REPO,'GITHUB_SHA':COMMIT,'GITHUB_RUN_ID':str(RUN),'GITHUB_RUN_ATTEMPT':'1'}

def row(name,data=b'content'):
    return {'path':name,'bytes':len(data),'sha256':A.sha(data)}

def provider_fixture():
    run={'id':RUN,'run_attempt':1,'head_sha':COMMIT,'head_branch':'main','event':'push','path':A.WORKFLOW,
         'repository':{'full_name':A.REPO},'status':'completed','conclusion':'success'}
    jobs=[];artifacts=[]
    for index,name in enumerate(dict.fromkeys(A.ARTIFACT_JOBS.values())):
        actions=set('Run actions/upload-pages-artifact@v3' if artifact=='github-pages' else 'Run actions/upload-artifact@v4'
                    for artifact,job in A.ARTIFACT_JOBS.items() if job==name)
        jobs.append({'id':2000+index,'name':name,'run_id':RUN,'run_attempt':1,'head_sha':COMMIT,
                     'status':'completed','conclusion':'success','steps':[
                         {'number':i+1,'name':action,'status':'completed','conclusion':'success',
                          'started_at':'2026-10-15T16:00:00Z','completed_at':'2026-10-15T16:00:02Z'}
                         for i,action in enumerate(sorted(actions))]})
    for index,name in enumerate(A.ARTIFACT_JOBS):
        artifacts.append({'id':3000+index,'name':name,'expired':False,'size_in_bytes':1024,
                          'digest':'sha256:'+'d'*64,'created_at':'2026-10-15T16:00:01Z',
                          'workflow_run':{'id':RUN,'head_sha':COMMIT,'head_branch':'main',
                                          'repository_id':1354625251,'head_repository_id':1354625251}})
    return run,jobs,artifacts

def network_fixture(pages=2):
    rows=[row('assets/game.js'),row('build-info.json'),row('index.html')]
    network=[{'page':page,'url':A.URL+'assets/game.js','status':200,'bytes':rows[0]['bytes'],
              'sha256':rows[0]['sha256'],'fromCache':False} for page in range(1,pages+1)]
    stamps=[{'page':page,'url':A.URL+'build-info.json','status':200,'sha256':STAMP} for page in range(1,pages+1)]
    return network,stamps,rows

class Temporary(unittest.TestCase):
    def setUp(self):
        temp=tempfile.TemporaryDirectory(prefix='v57-public-boundary-');self.addCleanup(temp.cleanup)
        self.root=pathlib.Path(temp.name)

class JSONRows(Temporary):
    def test_duplicate_keys_and_nonfinite_values_reject(self):
        p=self.root/'metadata.json'
        for content in ['{"x":1,"x":2}','{"outer":{"x":1,"x":2}}','{"x":NaN}','{"x":Infinity}','{"x":-Infinity}']:
            with self.subTest(content=content):
                p.write_text(content)
                with self.assertRaises(AssertionError):A.load(p)
        p.write_text('{"pass":true,"rows":[1,2]}');self.assertEqual(A.load(p),{'pass':True,'rows':[1,2]})

    def test_exact_sorted_inventory_and_empty_file(self):
        rows=[row('a',b''),row('b/game.js')];self.assertEqual(set(A.rows_valid(rows)),{'a','b/game.js'})

    def test_bad_rows_order_duplicates_sizes_hashes_and_namespace_reject(self):
        a=row('a');b=row('b')
        for rows in [[],[b,a],[a,a],[a,row('a/b')],[dict(a,bytes=-1)],[dict(a,bytes=True)],
                     [dict(a,bytes=A.LIMIT+1)],[dict(a,sha256='bad')],[dict(a,unclaimed=True)]]:
            with self.subTest(rows=rows),self.assertRaises(AssertionError):A.rows_valid(rows)
        with self.assertRaises(AssertionError):A.rows_valid([row('a',b'123'),row('b',b'123')],maximum=5)

class ZIPBoundaries(Temporary):
    def make(self,members=None):
        archive=self.root/'proof.zip';directory=self.root/'proof';directory.mkdir(exist_ok=True)
        with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_STORED) as z:
            for name,data in members or [('a.txt',b'original')]:z.writestr(name,data)
        (directory/'a.txt').write_bytes(b'original')
        return archive,directory,self.pin(archive)

    def pin(self,archive):
        return {'id':42,'name':'v57-final-public-proof','size_in_bytes':archive.stat().st_size,'digest':'sha256:'+A.file_sha(archive)}

    def test_exact_zip_and_all_regular_bytes(self):
        a,d,p=self.make();result=A.verified_zip(a,d,p)
        self.assertEqual(result['files'],1);self.assertEqual(result['bytes'],8)
        self.assertEqual(result['zipSha256'],A.file_sha(a))

    def test_zip_digest_and_extracted_changed_extra_deleted_members_reject(self):
        for mode in ['zip','changed','extra','deleted','extra-directory']:
            with self.subTest(mode=mode):
                a,d,p=self.make()
                if mode=='zip':a.write_bytes(a.read_bytes()+b'unclaimed')
                if mode=='changed':(d/'a.txt').write_bytes(b'changed')
                if mode=='extra':(d/'extra.txt').write_bytes(b'extra')
                if mode=='deleted':(d/'a.txt').unlink()
                if mode=='extra-directory':(d/'extra').mkdir()
                with self.assertRaises(AssertionError):A.verified_zip(a,d,p)
                for item in list(d.iterdir()):
                    if item.is_dir():item.rmdir()
                    else:item.unlink()

    def test_crc_failure_cannot_be_hidden_by_repinned_archive_digest(self):
        a,d,p=self.make()
        with zipfile.ZipFile(a) as z:
            m=z.infolist()[0];offset=m.header_offset+30+len(m.filename.encode())+len(m.extra)
        data=bytearray(a.read_bytes());data[offset]^=1;a.write_bytes(data)
        with self.assertRaises(zipfile.BadZipFile):A.verified_zip(a,d,self.pin(a))

    def test_paths_duplicate_and_symlink_entries_reject(self):
        for name in ['../escape','/absolute','C:/drive','a\\b','a//b','a/./b','a/../b']:
            with self.subTest(name=name):
                a,d,p=self.make([(name,b'original')])
                with self.assertRaises(AssertionError):A.verified_zip(a,d,p)
        with warnings.catch_warnings():
            warnings.simplefilter('ignore',UserWarning);a,d,p=self.make([('a.txt',b'original'),('a.txt',b'original')])
        with self.assertRaises(AssertionError):A.verified_zip(a,d,p)
        a,d,p=self.make()
        with zipfile.ZipFile(a,'w') as z:
            info=zipfile.ZipInfo('a.txt');info.create_system=3;info.external_attr=(stat.S_IFLNK|0o777)<<16;z.writestr(info,b'original')
        with self.assertRaises(AssertionError):A.verified_zip(a,d,self.pin(a))

class ProviderBoundaries(unittest.TestCase):
    def test_exact_terminal_eleven_jobs_and_twelve_artifacts(self):
        f=provider_fixture();self.assertEqual((len(f[1]),len(f[2])),(11,12));A.validate_provider(*f,COMMIT,RUN)

    def test_run_cannot_be_source_wrong_attempt_branch_workflow_or_not_success(self):
        for key,value in [('id',RUN+1),('run_attempt',2),('head_sha',SOURCE),('head_branch',A.SOURCE_BRANCH),
                          ('event','workflow_dispatch'),('path',A.SOURCE_WORKFLOW),('status','in_progress'),('conclusion','failure')]:
            with self.subTest(key=key):
                f=provider_fixture();f[0][key]=value
                with self.assertRaises(AssertionError):A.validate_provider(*f,COMMIT,RUN)

    def test_missing_duplicate_wrong_origin_failed_and_unfinished_jobs_reject(self):
        for mode in ['missing','duplicate-id','duplicate-name','run','attempt','head','status','failure','failed-step','unfinished-step']:
            with self.subTest(mode=mode):
                f=provider_fixture();j=f[1]
                if mode=='missing':j.pop()
                if mode=='duplicate-id':j[1]['id']=j[0]['id']
                if mode=='duplicate-name':j[1]['name']=j[0]['name']
                if mode=='run':j[0]['run_id']+=1
                if mode=='attempt':j[0]['run_attempt']=2
                if mode=='head':j[0]['head_sha']=SOURCE
                if mode=='status':j[0]['status']='in_progress'
                if mode=='failure':j[0]['conclusion']='failure'
                if mode=='failed-step':j[0]['steps'][0]['conclusion']='failure'
                if mode=='unfinished-step':j[0]['steps'][0]['status']='in_progress'
                with self.assertRaises(AssertionError):A.validate_provider(*f,COMMIT,RUN)

    def test_artifact_origin_expiry_digest_upload_and_timing_reject(self):
        for mode in ['missing','duplicate-id','duplicate-name','expired','digest','run','head','attempt-branch','repo','upload-time','upload-skipped']:
            with self.subTest(mode=mode):
                f=provider_fixture();a=f[2]
                if mode=='missing':a.pop()
                if mode=='duplicate-id':a[1]['id']=a[0]['id']
                if mode=='duplicate-name':a[1]['name']=a[0]['name']
                if mode=='expired':a[0]['expired']=True
                if mode=='digest':a[0]['digest']='sha256:bad'
                if mode=='run':a[0]['workflow_run']['id']+=1
                if mode=='head':a[0]['workflow_run']['head_sha']=SOURCE
                if mode=='attempt-branch':a[0]['workflow_run']['head_branch']=A.SOURCE_BRANCH
                if mode=='repo':a[0]['workflow_run']['repository_id']+=1
                if mode=='upload-time':a[0]['created_at']='2026-10-15T16:05:00Z'
                if mode=='upload-skipped':f[1][0]['steps'][0]['conclusion']='skipped'
                with self.assertRaises(AssertionError):A.validate_provider(*f,COMMIT,RUN)

class BrowserBoundaries(unittest.TestCase):
    def test_exact_fresh_route_pages_and_single_entry_stamp_are_distinct_valid_shapes(self):
        network,stamps,rows=network_fixture();A.check_network(network,stamps,rows,STAMP,2)
        network,stamps,rows=network_fixture(1);A.check_network(network,stamps,rows,STAMP,1,entry=True)

    def test_wrong_network_origin_page_cache_status_size_or_hash_reject(self):
        for key,value in [('page',0),('page',True),('url',A.BASE+'assets/game.js'),('status',304),('fromCache',True),('bytes',999),('sha256','0'*64)]:
            with self.subTest(key=key,value=value):
                n,s,r=network_fixture();n[0][key]=value
                with self.assertRaises(AssertionError):A.check_network(n,s,r,STAMP,2)

    def test_reused_omitted_unordered_or_stale_build_reads_reject(self):
        for mode in ['missing','reused','unordered','url','status','hash','no-html-js']:
            with self.subTest(mode=mode):
                n,s,r=network_fixture()
                if mode=='missing':s.pop()
                if mode=='reused':s[1]['page']=1
                if mode=='unordered':s.reverse()
                if mode=='url':s[0]['url']=A.BASE+'build-info.json'
                if mode=='status':s[0]['status']=404
                if mode=='hash':s[0]['sha256']='0'*64
                if mode=='no-html-js':n=[v for v in n if v['page']!=2]
                with self.assertRaises(AssertionError):A.check_network(n,s,r,STAMP,2)

class EntryBoundaries(Temporary):
    def fixture(self):
        network,stamps,rows=network_fixture(1)
        for name,size in [('bare-menu.png',(1024,768)),('bare-playing.png',(640,360)),('mobile-menu.png',(360,800))]:
            Image.linear_gradient('L').resize(size).convert('RGB').save(self.root/name)
        checks=[]
        for index,state in enumerate(['ready','ready','playing','ready']):
            prefs={'completed':[0,1,6],'hints':{'1':2},'resumeLevel':3,'quality':'low','muted':True,
                   'volume':.29 if index==0 else .37,'tutorial':index==0}
            checks.append({'state':state,'index':3,'ownPreferences':prefs,'historicalUnchanged':True,
                           'writes':[{'method':'setItem','key':'brainrot-campaign-v57:brainrot-portal.preferences.v24'}]})
        report={'kind':'actual-v57-public-bare-menu-save-isolation','pass':True,'publicationAccepted':False,
                'producer':copy.deepcopy(PRODUCER),'sourceCommit':SOURCE,'publicURL':A.URL,'buildInfoSha256':STAMP,
                'checks':checks,'captures':[A.image(self.root/n) for n in ['bare-menu.png','bare-playing.png','mobile-menu.png']],
                'errors':[],'network':network*11,'browserStampReads':stamps}
        return report,{'sourceCommit':SOURCE},rows

    def validate(self,fixture):
        report,c,rows=fixture;return A.check_entry(report,self.root,c,PRODUCER,rows,STAMP)

    def test_truthful_four_states_three_images_and_own_namespace(self):
        self.assertEqual(len(self.validate(self.fixture())),3)

    def test_wrong_origin_broader_acceptance_and_failed_report_reject(self):
        for key,value in [('sourceCommit',COMMIT),('publicURL',A.BASE),('buildInfoSha256','0'*64),('publicationAccepted',True),('pass',False),('errors',['error']),('failure','failed')]:
            with self.subTest(key=key):
                f=self.fixture();f[0][key]=value
                with self.assertRaises(AssertionError):self.validate(f)
        f=self.fixture();f[0]['producer']['GITHUB_RUN_ID']=str(RUN+1)
        with self.assertRaises(AssertionError):self.validate(f)

    def test_missing_or_false_state_preferences_history_and_namespace_reject(self):
        for mode in ['state','missing-state','index','completed','volume','tutorial','history','clear','foreign-prefix','no-writes']:
            with self.subTest(mode=mode):
                f=self.fixture();v=f[0]['checks'][0]
                if mode=='state':v['state']='playing'
                if mode=='missing-state':f[0]['checks'].pop()
                if mode=='index':v['index']=0
                if mode=='completed':v['ownPreferences']['completed']=[0,1,6,9]
                if mode=='volume':v['ownPreferences']['volume']=.37
                if mode=='tutorial':v['ownPreferences']['tutorial']=False
                if mode=='history':v['historicalUnchanged']=False
                if mode=='clear':v['writes'][0]['method']='clear'
                if mode=='foreign-prefix':v['writes'][0]['key']='brainrot-campaign-v56:old'
                if mode=='no-writes':v['writes']=[]
                with self.assertRaises(AssertionError):self.validate(f)

    def test_changed_missing_extra_or_swapped_captures_reject(self):
        for mode in ['hash','missing','extra','swapped','wrong-pixels']:
            with self.subTest(mode=mode):
                f=self.fixture();captures=f[0]['captures']
                if mode=='hash':captures[0]['sha256']='0'*64
                if mode=='missing':captures.pop()
                if mode=='extra':captures.append(copy.deepcopy(captures[0]))
                if mode=='swapped':captures.reverse()
                if mode=='wrong-pixels':captures[0]['pixels']['width']=640
                with self.assertRaises(AssertionError):self.validate(f)

if __name__=='__main__':unittest.main()
