"""Isolated PUBLIC trust-boundary fixtures; no network, routes, or builds."""
import copy
import importlib.util
import json
import os
import pathlib
import stat
import tempfile
import unittest
import warnings
import zipfile
from PIL import Image
from unittest.mock import patch

ROOT=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('public_v61_auditor',ROOT/'audit-public-v61.py')
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
        temp=tempfile.TemporaryDirectory(prefix='v61-public-boundary-');self.addCleanup(temp.cleanup)
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

class PreciseProviderIdentity(unittest.TestCase):
    def test_positive_safe_run_job_and_artifact_ids(self):
        for bad in [None,False,True,0,-1,1.0,2**53,'1']:
            for where in ['run-id','run-attempt','job-id','job-run','job-attempt','artifact-id','artifact-run']:
                f=provider_fixture()
                if where=='run-id':f[0]['id']=bad
                if where=='run-attempt':f[0]['run_attempt']=bad
                if where=='job-id':f[1][0]['id']=bad
                if where=='job-run':f[1][0]['run_id']=bad
                if where=='job-attempt':f[1][0]['run_attempt']=bad
                if where=='artifact-id':f[2][0]['id']=bad
                if where=='artifact-run':f[2][0]['workflow_run']['id']=bad
                with self.subTest(bad=bad,where=where),self.assertRaises((AssertionError,TypeError,KeyError)):A.validate_provider(*f,COMMIT,RUN)
        self.assertTrue(A.positive_safe_integer(2**53-1));self.assertFalse(A.positive_safe_integer(2**53))

    def test_nanosecond_utc_provider_bounds_do_not_round_down(self):
        self.assertEqual(A.instant('2026-10-17T01:00:55.999999999Z')-A.instant('2026-10-17T01:00:55.999999998+00:00'),1)
        with self.assertRaises(AssertionError):A.instant('2026-10-17T01:00:55.9999999991Z')
        f=provider_fixture();target=f[2][-1];job=next(j for j in f[1] if j['name']==A.ARTIFACT_JOBS[target['name']])
        for step in job['steps']:step['completed_at']='2026-10-15T16:00:02.123456789Z'
        target['created_at']='2026-10-15T16:00:04.123456789Z';A.validate_provider(*f,COMMIT,RUN)
        target['created_at']='2026-10-15T16:00:04.123456790Z'
        with self.assertRaises(AssertionError):A.validate_provider(*f,COMMIT,RUN)


class ZIPBoundaries(Temporary):
    def make(self,members=None):
        archive=self.root/'proof.zip';directory=self.root/'proof';directory.mkdir(exist_ok=True)
        with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_STORED) as z:
            for name,data in members or [('a.txt',b'original')]:z.writestr(name,data)
        (directory/'a.txt').write_bytes(b'original')
        return archive,directory,self.pin(archive)

    def pin(self,archive):
        return {'id':42,'name':'v61-final-public-proof','size_in_bytes':archive.stat().st_size,'digest':'sha256:'+A.file_sha(archive)}

    def test_exact_zip_and_all_regular_bytes(self):
        a,d,p=self.make();result=A.verified_zip(a,d,p)
        self.assertEqual(result['files'],1);self.assertEqual(result['bytes'],8)
        self.assertEqual(result['zipSha256'],A.file_sha(a))

    def test_prefix_sibling_files_and_directories_have_canonical_full_path_order(self):
        names=['entry-v2.json','entry.json','entry/report.json',
               'native-early.report.json','native-early/1-finish.jpg']
        self.assertNotEqual(sorted(names,key=pathlib.PurePosixPath),names)
        directory=self.root/'proof';directory.mkdir();archive=self.root/'proof.zip'
        with zipfile.ZipFile(archive,'w') as z:
            for name in reversed(names):
                data=name.encode();target=directory/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data);z.writestr(name,data)
        expected=[{'path':name,'bytes':len(name.encode()),'sha256':A.sha(name.encode())} for name in names]
        self.assertEqual(A.inventory(directory),expected)
        result=A.verified_zip(archive,directory,self.pin(archive))
        self.assertEqual(result['inventorySha256'],A.sha(A.encoded(expected)))

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
    def test_exact_terminal_thirteen_jobs_and_fourteen_artifacts(self):
        f=provider_fixture();self.assertEqual((len(f[1]),len(f[2])),(13,14));A.validate_provider(*f,COMMIT,RUN)

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

class RawLogBoundaries(Temporary):
    def fixture(self):
        jobs=provider_fixture()[1];logs=self.root/'logs';logs.mkdir();data=b'\xef\xbb\xbf2026-10-16T20:00:00Z Current runner version: synthetic-fixture\n'
        for j in jobs:(logs/(str(j['id'])+'.log')).write_bytes(data)
        return jobs
    def test_exact_thirteen_original_raw_logs_and_retained_bom(self):
        rows=A.check_job_logs(self.root,self.fixture());self.assertEqual(len(rows),13);self.assertTrue(all(r['bomRetained'] for r in rows))
    def test_missing_extra_empty_substituted_and_symlink_logs_reject(self):
        jobs=self.fixture();p=self.root/'logs'/(str(jobs[0]['id'])+'.log');original=p.read_bytes()
        for mode in ['missing','extra','empty','substituted','symlink']:
            with self.subTest(mode=mode):
                if mode=='missing':p.unlink()
                if mode=='extra':(self.root/'logs/extra.log').write_bytes(original)
                if mode=='empty':p.write_bytes(b'')
                if mode=='substituted':p.write_bytes(b'{"tool":"metadata"}')
                if mode=='symlink':p.unlink();p.symlink_to(self.root/'outside.log');(self.root/'outside.log').write_bytes(original)
                with self.assertRaises(AssertionError):A.check_job_logs(self.root,jobs)
                if p.is_symlink():p.unlink()
                p.write_bytes(original)
                extra=self.root/'logs/extra.log'
                if extra.exists():extra.unlink()

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
            prefs={'completed':[0,1,6,9,10,14,19,40],'hints':{'1':2,'14':1,'40':3},'resumeLevel':3,'quality':'low','muted':True,
                   'volume':.29 if index==0 else .37,'tutorial':index==0}
            checks.append({'state':state,'index':3,'ownPreferences':prefs,'historicalUnchanged':True,
                           'writes':[{'method':'setItem','key':'brainrot-campaign-v61:brainrot-portal.preferences.v24'}],
                           'sequence':{'stableIndices':list(range(40))+list(range(41,51))+[40],'numbers':list(range(1,52)),'castleLast':True}})
        report={'kind':'actual-v61-public-bare-menu-save-isolation','pass':True,'publicationAccepted':False,
                'producer':copy.deepcopy(PRODUCER),'sourceCommit':SOURCE,'publicURL':A.URL,'buildInfoSha256':STAMP,
                'checks':checks,'captures':[A.image(self.root/n) for n in ['bare-menu.png','bare-playing.png','mobile-menu.png']],
                'errors':[],'network':network*11,'browserStampReads':stamps}
        return report,{'sourceCommit':SOURCE},rows

    def validate(self,fixture):
        report,c,rows=fixture;return A.check_entry(report,self.root,c,PRODUCER,rows,STAMP)

    def test_truthful_four_states_three_images_and_own_namespace(self):
        self.assertEqual(len(self.validate(self.fixture())),3)

    def test_reload_may_read_exact_persisted_preferences_without_writing(self):
        f=self.fixture();f[0]['checks'][3]['writes']=[]
        self.assertEqual(len(self.validate(f)),3)
        for mode in ['history','completed','hints','resume','volume','tutorial']:
            with self.subTest(mode=mode):
                f=self.fixture();v=f[0]['checks'][3];v['writes']=[]
                if mode=='history':v['historicalUnchanged']=False
                if mode=='completed':v['ownPreferences']['completed']=[0,1]
                if mode=='hints':v['ownPreferences']['hints']={'1':3}
                if mode=='resume':v['ownPreferences']['resumeLevel']=0
                if mode=='volume':v['ownPreferences']['volume']=.29
                if mode=='tutorial':v['ownPreferences']['tutorial']=True
                with self.assertRaises(AssertionError):self.validate(f)

    def test_storage_write_lists_early_writes_and_namespace_remain_required(self):
        for index in range(4):
            for bad in [None,{},'',0]:
                with self.subTest(index=index,bad=bad):
                    f=self.fixture();f[0]['checks'][index]['writes']=bad
                    with self.assertRaises(AssertionError):self.validate(f)
            for bad in [{'method':'clear','key':''},{'method':'setItem','key':'brainrot-campaign-v56:old'},
                        {'method':'removeItem','key':'brainrot-portal.preferences.v24'}]:
                with self.subTest(index=index,bad=bad):
                    f=self.fixture();f[0]['checks'][index]['writes']=[bad]
                    with self.assertRaises(AssertionError):self.validate(f)
            if index<3:
                with self.subTest(missingInitialWrites=index):
                    f=self.fixture();f[0]['checks'][index]['writes']=[]
                    with self.assertRaises(AssertionError):self.validate(f)

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


    def test_lost_v60_castle_completion_hint_and_wrong_final_order_reject(self):
        for mode in ['castle-completion','castle-hint','castle-in-middle','duplicate-room','false-flag','display-order']:
            with self.subTest(mode=mode):
                f=self.fixture();v=f[0]['checks'][0]
                if mode=='castle-completion':v['ownPreferences']['completed'].remove(40)
                if mode=='castle-hint':del v['ownPreferences']['hints']['40']
                if mode=='castle-in-middle':v['sequence']['stableIndices']=list(range(51))
                if mode=='duplicate-room':v['sequence']['stableIndices'][-1]=50
                if mode=='false-flag':v['sequence']['castleLast']=False
                if mode=='display-order':v['sequence']['numbers'][-1]=41
                with self.assertRaises(AssertionError):self.validate(f)

class AttackBoundaries(Temporary):
    """Synthetic closed packets exercise byte/origin boundaries only.

    No fixture is submitted to audit() or the immutable gameplay validator.
    """
    def setUp(self):
        super().setUp();self.proof=self.root/'attacks-early';self.proof.mkdir();self.source=self.root/'source';self.source.mkdir()
        harness=[]
        for name in sorted(['scripts/qa-second-chapter-attacks-browser.mjs','scripts/lib/second-chapter-attack-browser.mjs']):
            p=self.source/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(('synthetic harness '+name).encode())
            harness.append({'path':name,'bytes':p.stat().st_size,'sha256':A.file_sha(p)})
        self.c={'sourceCommit':SOURCE,'sourceTree':'d'*40,'sourceRun':9000,'sourceAttempt':1}
        self.receipt={'sourceInputsSha256':'e'*64}
        self.candidate=[row('assets/LabV8Journey-fixture.js'),row('build-info.json'),row('index.html')];self.stamp=self.candidate[1]['sha256']
        payload=[r for r in self.candidate if r['path']!='build-info.json'];self.put('attack-harness.js',b'SYNTHETIC QA BUNDLE; no game execution')
        descriptor={'syntheticFixture':True,'bytes':self.record('attack-harness.js')['bytes'],'sha256':self.record('attack-harness.js')['sha256']}
        self.put('attack-harness-inputs.json',A.encoded(descriptor));self.put('early-attacks-report.json',b'{"syntheticFixture":true}')
        self.browser={'product':'HeadlessChrome/123.0.0.0','userAgent':'synthetic HeadlessChrome/123.0.0.0'};self.put('native-browser.json',A.encoded(self.browser))
        cases=[{'syntheticFixture':True,'caseId':'fixture-'+str(i)} for i in range(2)]
        media=[]
        for i in range(2):
            for phase in ['start','end']:
                name='case-'+str(i+1).zfill(2)+'-'+phase+'.jpg';Image.linear_gradient('L').resize((640,360)).convert('RGB').save(self.proof/name)
                media.append({'filename':name})
        self.report={'schemaVersion':1,'kind':'actual-second-chapter-ordinary-attacks-browser-diagnostic','group':'early','pass':True,
            **{k:False for k in ['sourceCiAccepted','nativeAccepted','publicationAccepted','fullChapterAccepted','humanAccepted','allBypassesAccepted','humanPlaytest','hardwareFPSMeasured','cameraAccepted','allRenderFramesMeasured']},
            **{k:True for k in ['sourceWorkingBytesUnchanged','controllerWorkingBytesUnchanged','harnessWorkingBytesUnchanged','completeServedPackageVerified']},
            'source':{'commit':SOURCE,'tree':self.c['sourceTree'],'sourceInputsSha256':self.receipt['sourceInputsSha256']},
            'controller':{'commit':SOURCE,'tree':self.c['sourceTree'],'trackedWorkingTreeClean':True,'runId':RUN,'runAttempt':1,'files':harness,'filesSha256':A.sha(A.encoded(harness))},
            'sourceReview':{'runId':9000,'runAttempt':1},'captureRun':{'runId':RUN,'runAttempt':1},'providerRun':{'commit':COMMIT,'runId':RUN,'runAttempt':1},
            'captureOrigin':'https://amazin20.github.io','capturePath':'/brainrot-portal/campaign-v61/',
            'package':{'commit':SOURCE,'buildInfoBytes':self.candidate[1]['bytes'],'buildInfoSha256':self.stamp,'files':payload,'packageFilesSha256':A.sha(A.encoded(payload)),'fileCount':len(payload),'totalBytes':sum(r['bytes'] for r in payload),'journey':self.candidate[0],'originalRuntimeModels':14},
            'browser':self.browser,'caseObservations':cases,'pureReport':{'filename':'early-attacks-report.json','cases':2,'pass':True},'closedMedia':media,'harness':descriptor,'errors':[]}
        network=[{'page':n,'url':A.URL+self.candidate[0]['path'],'status':200,'bytes':self.candidate[0]['bytes'],'sha256':self.candidate[0]['sha256'],'fromCache':False} for n in [1,2]]
        stamps=[{'page':n,'url':A.URL+'build-info.json','status':200,'sha256':self.stamp} for n in [1,2]]
        images=[A.image(self.proof/r['filename']) for r in sorted(media,key=lambda r:r['filename'])]
        self.binding={'kind':'actual-v61-public-attacks-binding','pass':True,'publicationAccepted':False,'group':'early',
            'sourceCommit':SOURCE,'sourceTree':self.c['sourceTree'],'producer':copy.deepcopy(PRODUCER),'publicURL':A.URL,
            'buildInfoSha256':self.stamp,'freshPages':2,'driver':{'path':'scripts/qa-second-chapter-attacks-browser.mjs','sha256':A.file_sha(self.source/'scripts/qa-second-chapter-attacks-browser.mjs')},
            'network':network,'browserStampReads':stamps,'decodedImages':images}
        self.persist()

    def put(self,name,data):
        p=self.proof/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)

    def record(self,name):
        p=self.proof/name;return {'path':name,'bytes':p.stat().st_size,'sha256':A.file_sha(p)}

    def persist(self):
        self.put('second-chapter-attacks-browser-report.json',A.encoded(self.report))
        source_harness={'files':self.report['controller']['files'],'filesSha256':self.report['controller']['filesSha256']}
        self.put('binding.json',A.encoded({**{k:self.report[k] for k in ['source','controller','package']},'sourceHarness':source_harness}))
        payload=self.report['package']['files'];stamp=next(r for r in self.candidate if r['path']=='build-info.json')
        self.put('served-package.json',A.encoded({'sourceCommit':SOURCE,'sourceTree':self.c['sourceTree'],'captureOrigin':self.report['captureOrigin'],'capturePath':self.report['capturePath'],'allHTTPFilesVerified':True,'files':[dict(r,status=200) for r in payload]+[dict(stamp,status=200)]}))
        for i,case in enumerate(self.report['caseObservations']):self.put('case-'+str(i+1).zfill(2)+'-observation.json',A.encoded(case))
        for key,name in [('sourceReport','second-chapter-attacks-browser-report.json'),('pureReport','early-attacks-report.json')]:self.binding[key]=self.record(name)
        closed=[dict(name=r['path'],bytes=r['bytes'],sha256=r['sha256']) for r in A.inventory(self.proof) if r['path'] not in ('closed-media-member-inventory.json','public-binding.json')]
        self.put('closed-media-member-inventory.json',A.encoded({'files':closed}));self.binding['closedMediaInventory']=self.record('closed-media-member-inventory.json')
        self.put('public-binding.json',A.encoded(self.binding))

    def validate(self):
        return A.check_attacks(self.proof,self.source,self.c,PRODUCER,self.candidate,self.stamp,self.receipt,'early',decode=A.image)

    def test_exact_current_origin_closed_packet_and_genuine_pixels(self):
        summary,images=self.validate();self.assertEqual(summary['cases'],2);self.assertEqual(len(images),4)

    def test_wrong_source_review_actual_public_run_or_open_scope_reject(self):
        original=copy.deepcopy(self.report)
        for key,value in [('pass',False),('publicationAccepted',True),('fullChapterAccepted',True),('allBypassesAccepted',True),
            ('group','later'),('sourceWorkingBytesUnchanged',False),('controllerWorkingBytesUnchanged',False),('harnessWorkingBytesUnchanged',False),
            ('sourceReview',{'runId':RUN,'runAttempt':1}),('captureRun',{'runId':9000,'runAttempt':1}),
            ('providerRun',{'commit':SOURCE,'runId':RUN,'runAttempt':1}),('captureOrigin',A.BASE),('capturePath','/campaign-v60/'),('errors',['failed approach'])]:
            with self.subTest(key=key):
                self.report=copy.deepcopy(original);self.report[key]=value;self.persist()
                with self.assertRaises(AssertionError):self.validate()
        for section,key,value in [('source','commit',COMMIT),('source','tree','0'*40),('source','sourceInputsSha256','0'*64),
            ('controller','commit',COMMIT),('controller','runId',RUN+1),('controller','trackedWorkingTreeClean',False),
            ('package','files',[]),('package','buildInfoSha256','0'*64),('package','totalBytes',0)]:
            with self.subTest(section=section,key=key):
                self.report=copy.deepcopy(original);self.report[section][key]=value;self.persist()
                with self.assertRaises(AssertionError):self.validate()

    def test_wrong_public_binding_fresh_pages_stamp_cache_and_response_reject(self):
        original=copy.deepcopy(self.binding)
        for key,value in [('group','later'),('freshPages',1),('publicURL',A.BASE),('sourceCommit',COMMIT),('publicationAccepted',True),('decodedImages',[])]:
            with self.subTest(key=key):
                self.binding=copy.deepcopy(original);self.binding[key]=value;self.persist()
                with self.assertRaises((AssertionError,StopIteration)):self.validate()
        for key,value in [('page',0),('fromCache',True),('status',304),('bytes',999),('sha256','0'*64),('url',A.BASE+'assets/game.js')]:
            with self.subTest(network=key):
                self.binding=copy.deepcopy(original);self.binding['network'][0][key]=value;self.persist()
                with self.assertRaises(AssertionError):self.validate()
        self.binding=copy.deepcopy(original);self.binding['browserStampReads'].pop();self.persist()
        with self.assertRaises(AssertionError):self.validate()

    def test_substituted_closed_report_bundle_case_image_or_extra_member_reject(self):
        for name in ['early-attacks-report.json','attack-harness.js','attack-harness-inputs.json','case-01-observation.json','case-01-start.jpg','closed-media-member-inventory.json']:
            with self.subTest(name=name):
                p=self.proof/name;original=p.read_bytes();p.write_bytes(original+b'changed')
                with self.assertRaises(AssertionError):self.validate()
                p.write_bytes(original)
        self.put('unclosed-extra.json',b'{}')
        with self.assertRaises(AssertionError):self.validate()

    def test_source_harness_drift_and_valid_but_blank_canvas_reject(self):
        p=self.source/'scripts/lib/second-chapter-attack-browser.mjs';original=p.read_bytes();p.write_bytes(b'changed harness')
        with self.assertRaises(AssertionError):self.validate()
        p.write_bytes(original);Image.new('RGB',(640,360),'black').save(self.proof/'case-01-start.jpg');self.persist()
        with self.assertRaises(AssertionError):self.validate()

    def test_publisher_checks_same_origin_and_closed_bytes_without_issuing_acceptance(self):
        controller=ROOT/'v61-release-controller' if (ROOT/'v61-release-controller').is_dir() else ROOT.parent
        spec=importlib.util.spec_from_file_location('publisher60_boundary',controller/'scripts/publish-campaign-v61.py')
        publisher=importlib.util.module_from_spec(spec);spec.loader.exec_module(publisher)
        summary,_=publisher.check_attacks(self.proof,self.source,self.c,PRODUCER,self.candidate,self.stamp,self.receipt,'early')
        self.assertEqual(summary['retainedImages'],4)
        self.binding['producer']['GITHUB_SHA']=SOURCE;self.persist()
        with self.assertRaises(ValueError):publisher.check_attacks(self.proof,self.source,self.c,PRODUCER,self.candidate,self.stamp,self.receipt,'early')

    def test_actual_attack_stdout_hash_binds_the_specific_closed_report(self):
        summary={'cases':2,'report':{'sha256':'f'*64}}
        line='2026-10-17T01:00:00Z SECOND_CHAPTER_ATTACKS_DIAGNOSTIC_COMPLETE early '+SOURCE+' 2 '+'f'*64+'\n'
        A.check_attack_completion_log(line,'early',SOURCE,summary)
        for text in ['',line+line,line.replace(SOURCE,COMMIT),line.replace('early','later'),line.replace(' 2 ',' 1 '),line.replace('f'*64,'e'*64)]:
            with self.subTest(text=text[:80]),self.assertRaises(AssertionError):A.check_attack_completion_log(text,'early',SOURCE,summary)

    def test_root_replays_current_catalogue_and_recompiles_frozen_qa_bundle(self):
        for required in ['assertSecondChapterAttacksBrowserDiagnostic(report', 'compileSecondChapterAttackHarness({sourceRoot:source,base,journey:',
            'SECOND_CHAPTER_ATTACK_HARNESS_FILES.map(fileRow)', 'binding.source,core.source', 'row.harnessRequests', 'report.providerRun']:
            self.assertIn(required,A.NODE_GATES)


class DeploymentSnapshotBoundaries(Temporary):
    """Synthetic HTTP page bodies test provenance, never issue acceptance."""
    def setUp(self):
        super().setUp();self.folder=self.root/'deployment-provider';self.folder.mkdir()
        self.c={'sourceCommit':SOURCE,'sourceTree':'d'*40,'sourceRun':9000,'sourceAttempt':1}
        self.job={'id':99,'started_at':'2026-10-17T01:00:00Z','completed_at':'2026-10-17T01:01:00Z','steps':[{'name':'Validate actual prior producer statuses, all public routes and deployment ownership','status':'completed','conclusion':'success','started_at':'2026-10-17T01:00:00Z','completed_at':'2026-10-17T01:00:55Z'}]}
        self.deployment={'id':A.OLD_DEPLOY['id']+1,'sha':COMMIT,'environment':'github-pages'}
        self.status={'id':4001,'state':'success','log_url':'https://github.com/'+A.REPO+'/actions/runs/'+str(RUN)}
        self.manifest={'schemaVersion':1,'kind':'actual-v61-ci-deployment-api-snapshot','publicationAccepted':False,
            'producer':copy.deepcopy(PRODUCER),'sourceCommit':SOURCE,'sourceTree':self.c['sourceTree'],
            'sourceReview':{'runId':9000,'runAttempt':1},'deploymentId':self.deployment['id'],
            'captureStartedAt':'2026-10-17T01:00:01Z','captureCompletedAt':'2026-10-17T01:00:50Z','resources':{}}
        self.resource('deployments','deployments?environment=github-pages',[[self.deployment]])
        self.resource('statuses','deployments/'+str(self.deployment['id'])+'/statuses',[[self.status]])
        self.persist()

    def resource(self,stem,endpoint,pages):
        records=[]
        for number,values in enumerate(pages,1):
            name=stem+'-page-'+str(number).zfill(3)+'.json';raw=json.dumps(values,indent=3).encode()+b'\n\n'
            (self.folder/name).write_bytes(raw)
            url='https://api.github.com/repos/'+A.REPO+'/'+endpoint+('&' if '?' in endpoint else '?')+'per_page=100&page='+str(number)
            minute='10' if stem=='deployments' else '30'
            records.append({'path':name,'page':number,'requestURL':url,'responseURL':url,'status':200,
                'requestedAt':'2026-10-17T01:00:'+minute+'Z','completedAt':'2026-10-17T01:00:'+minute+'Z',
                'bytes':len(raw),'sha256':A.sha(raw),'items':len(values)})
        self.manifest['resources'][stem]={'endpoint':endpoint,'items':sum(map(len,pages)),'pages':records}

    def persist(self):
        (self.folder/'manifest.json').write_bytes(A.encoded(self.manifest))

    def validate(self,sealed=None):
        return A.deployment_snapshot(self.folder,PRODUCER,self.c,self.job,sealed)

    def test_original_raw_bodies_producer_job_window_and_deployment_are_bound(self):
        current,summary=self.validate();self.assertEqual(A.deployment(current,COMMIT,RUN),self.deployment['id'])
        self.assertEqual(summary['origin'],'authenticated-final-ci-api-snapshot');self.assertFalse(summary['independentPostCiDeploymentGet'])
        self.assertEqual(summary['deployments'],1);self.assertEqual(summary['statuses'],1)
        self.assertTrue((self.folder/'deployments-page-001.json').read_bytes().endswith(b'\n\n'))

    def test_only_the_reported_final_second_precision_is_allowed(self):
        self.job['completed_at']='2026-10-17T01:00:55Z'
        for stamp in ['2026-10-17T01:00:55.500000Z','2026-10-17T01:00:55.999999Z','2026-10-17T01:00:55.999999999Z']:
            self.manifest['captureCompletedAt']=stamp;self.persist();self.validate()
        for stamp in ['2026-10-17T01:00:56Z','2026-10-17T01:00:56.000001Z']:
            with self.subTest(stamp=stamp):
                self.manifest['captureCompletedAt']=stamp;self.persist()
                with self.assertRaises(AssertionError):self.validate()

    def test_complete_pagination_preserves_each_actual_response_without_aggregate_file(self):
        values=[dict(self.deployment,id=self.deployment['id']-n) for n in range(100)]
        self.resource('deployments','deployments?environment=github-pages',[values,[]]);self.persist()
        current,summary=self.validate();self.assertEqual(summary['deployments'],100);self.assertEqual(len(summary['rawPages']),3)
        self.assertEqual(current['deployment'],self.deployment);self.assertFalse((self.folder/'deployments.json').exists())
        self.manifest['resources']['deployments']['pages'].pop();self.persist()
        with self.assertRaises(AssertionError):self.validate()

    def test_substituted_endpoint_producer_source_page_clock_count_or_status_reject(self):
        original=copy.deepcopy(self.manifest)
        for key,value in [('publicationAccepted',True),('producer',dict(PRODUCER,GITHUB_SHA=SOURCE)),
            ('sourceCommit',COMMIT),('sourceReview',{'runId':RUN,'runAttempt':1}),('deploymentId',A.OLD_DEPLOY['id']),
            ('captureStartedAt','2026-10-17T00:00:00Z'),('captureCompletedAt','2026-10-17T02:00:00Z')]:
            with self.subTest(key=key):
                self.manifest=copy.deepcopy(original);self.manifest[key]=value;self.persist()
                with self.assertRaises(AssertionError):self.validate()
        for key,value in [('path','other.json'),('page',2),('requestURL','https://example.invalid/api'),
            ('responseURL','https://api.github.com/other'),('status',304),('bytes',1),('sha256','0'*64),('items',2),
            ('requestedAt','2026-10-17T00:00:00Z'),('completedAt','2026-10-17T02:00:00Z')]:
            with self.subTest(page=key):
                self.manifest=copy.deepcopy(original);self.manifest['resources']['deployments']['pages'][0][key]=value;self.persist()
                with self.assertRaises(AssertionError):self.validate()

    def test_wrong_current_lease_changed_raw_body_extra_member_and_sealed_copy_reject(self):
        p=self.folder/'deployments-page-001.json';original=p.read_bytes();p.write_bytes(original+b' ')
        with self.assertRaises(AssertionError):self.validate()
        p.write_bytes(original);(self.folder/'unclosed.json').write_bytes(b'[]')
        with self.assertRaises(AssertionError):self.validate()
        (self.folder/'unclosed.json').unlink()
        import shutil
        sealed=self.root/'sealed';shutil.copytree(self.folder,sealed);self.validate(sealed)
        (sealed/'statuses-page-001.json').write_bytes(b'[]')
        with self.assertRaises(AssertionError):self.validate(sealed)
        self.status['state']='failure';self.resource('statuses','deployments/'+str(self.deployment['id'])+'/statuses',[[self.status]]);self.persist()
        current,_=self.validate()
        with self.assertRaises(AssertionError):A.deployment(current,COMMIT,RUN)

    def test_collector_copies_every_original_byte_once_and_refuses_differing_provider(self):
        spec=importlib.util.spec_from_file_location('v61_snapshot_collector',next(p for p in [ROOT/'collect-v61-public-proof.py',ROOT.parent.parent/'collect-v61-public-proof.py'] if p.is_file()))
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        proof=self.root/'proof';proof.mkdir();import shutil;shutil.copytree(self.folder,proof/'deployment-provider')
        out=self.root/'provider';module.copy_deployment_provider(proof,out)
        self.assertEqual(A.inventory(self.folder),A.inventory(out/'deployment-provider'))
        module.copy_deployment_provider(proof,out)
        (out/'deployment-provider/statuses-page-001.json').write_bytes(b'keep differing evidence')
        with self.assertRaises(ValueError):module.copy_deployment_provider(proof,out)
        self.assertEqual((out/'deployment-provider/statuses-page-001.json').read_bytes(),b'keep differing evidence')


if __name__=='__main__':unittest.main()

