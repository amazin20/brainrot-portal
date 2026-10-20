"""Finite hostile-input checks for the v63 append-only publication controller."""
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch
import urllib.error
import zipfile

spec=importlib.util.spec_from_file_location('campaign_v63',Path(__file__).with_name('publish-campaign-v63.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class WorkingDirectory:
    def __enter__(self):
        self.old=Path.cwd();self.tmp=tempfile.TemporaryDirectory();os.chdir(self.tmp.name);return Path(self.tmp.name)
    def __exit__(self,*args):os.chdir(self.old);self.tmp.cleanup()

def receipt_fixture():
    rows=[{'path':'index.html','bytes':1,'sha256':m.sha(b'x')}]
    c={'sourceCommit':'1'*40,'sourceTree':'2'*40,'sourceRun':123,'sourceAttempt':2,
       'sourceAcceptance':{'path':'tools/campaign-v63-root-source-acceptance.json','sha256':None}}
    r={'sourceAccepted':True,'publicationAccepted':False,'sourceCommit':c['sourceCommit'],'sourceTree':c['sourceTree'],
       'run':123,'runAttempt':2,'sourceReview':{'runId':123,'runAttempt':2},'baselineSourceC':m.BASELINE_SOURCE,
       'candidateFiles':rows,'candidateBytes':1,'candidateInventorySha256':m.sha(m.encoded(rows)),
       'checks':{'cpu':{'tests':10,'passed':10,'failed':0},
        'nativeRoutes':{'gameplayPassed':51,'capturesPassed':51,'normalUiZeroStepStartProven':False,'resetCounterScope':m.LEGACY_ROUTE_RESET_COUNTER_SCOPE},
        'playerAccess':{'pass':True},'rewardedUI':{'pass':True},
        'platformChecker':{'pass':True,'rooms':51,'liveSdkAccepted':False,'moderationAccepted':False},
        'opticsNative':{'pass':True,'rooms':10},'architecture':{'pass':True,'rooms':10}}}
    return c,r

def save_receipt(c,r):
    m.write(c['sourceAcceptance']['path'],r)
    c['sourceAcceptance']['sha256']=m.sha(Path(c['sourceAcceptance']['path']).read_bytes())

class GuardTests(unittest.TestCase):
    def test_inventory_rejects_path_duplicates_collisions_and_noncanonical_rows(self):
        valid=[{'path':'a','bytes':1,'sha256':'a'*64}]
        self.assertEqual(m.rows_valid(valid),{'a':valid[0]})
        for bad in [valid*2,[dict(valid[0],path='../a')],[dict(valid[0],bytes=True)],
                    valid+[dict(valid[0],path='a/b')],[dict(valid[0],sha256='a'*63)],
                    [dict(valid[0],path='b'),dict(valid[0],path='a')]]:
            with self.subTest(bad=bad),self.assertRaises(ValueError):m.rows_valid(bad)

    def test_json_rejects_duplicates_and_nonfinite_numbers(self):
        with WorkingDirectory():
            for text in ['{"x":1,"x":2}','{"x":NaN}','{"x":Infinity}']:
                Path('test.json').write_text(text)
                with self.assertRaises(ValueError):m.load('test.json')

    def test_zip_valid_bytes_crc_and_exact_inventory(self):
        with WorkingDirectory():
            with zipfile.ZipFile('a.zip','w') as z:z.writestr('folder/a.txt',b'original')
            rows=m.safe_extract('a.zip','out',100)
            self.assertEqual(rows,[{'path':'folder/a.txt','bytes':8,'sha256':m.sha(b'original')}])
            with self.assertRaises(ValueError):m.safe_extract('a.zip','out',100)

    def test_zip_rejects_traversal_symlink_duplicates_and_budget(self):
        for kind in ['traversal','symlink','duplicate','budget','collision']:
            with self.subTest(kind=kind),WorkingDirectory():
                with zipfile.ZipFile('a.zip','w') as z:
                    if kind=='traversal':z.writestr('../escape',b'x')
                    elif kind=='symlink':
                        info=zipfile.ZipInfo('link');info.create_system=3;info.external_attr=(stat.S_IFLNK|0o777)<<16;z.writestr(info,b'/etc/passwd')
                    elif kind=='duplicate':z.writestr('x',b'a');z.writestr('x',b'b')
                    elif kind=='collision':z.writestr('x',b'a');z.writestr('x/y',b'b')
                    else:z.writestr('x',b'1234')
                with self.assertRaises(ValueError):m.safe_extract('a.zip','out',3)
                self.assertFalse(Path('../escape').exists())

    def test_source_receipt_validates_actual_aggregates_and_scope(self):
        with WorkingDirectory():
            c,r=receipt_fixture();save_receipt(c,r);self.assertEqual(m.source_receipt(c),r)
            mutations=[lambda x:x.update(sourceAccepted=False),lambda x:x.update(publicationAccepted=True),
              lambda x:x['checks']['cpu'].update(failed=1),lambda x:x['checks']['nativeRoutes'].update(normalUiZeroStepStartProven=True),
              lambda x:x['checks']['nativeRoutes'].update(capturesPassed=50),lambda x:x['checks']['rewardedUI'].update(**{'pass':False}),
              lambda x:x['checks']['platformChecker'].update(liveSdkAccepted=True),lambda x:x['checks']['platformChecker'].update(rooms=50),
              lambda x:x['checks']['opticsNative'].update(rooms=9),lambda x:x.update(candidateBytes=2),
              lambda x:x.update(sourceReview={'runId':124,'runAttempt':2})]
            for mutate in mutations:
                bad=copy.deepcopy(r);mutate(bad);save_receipt(c,bad)
                with self.assertRaises(ValueError):m.source_receipt(c)

    def test_source_receipt_digest_and_baseline_identity_are_pinned(self):
        with WorkingDirectory():
            c,r=receipt_fixture();save_receipt(c,r);Path(c['sourceAcceptance']['path']).write_text('{}')
            with self.assertRaises(ValueError):m.source_receipt(c)
            r['baselineSourceC']='3'*40;save_receipt(c,r)
            with self.assertRaises(ValueError):m.source_receipt(c)

    def provider_fixture(self):
        c={'sourceCommit':'1'*40,'sourceRun':123,'sourceAttempt':2,'expectedJobs':['build','cpu (0)'],
           'sourceArtifacts':[{'id':456,'name':'v63-dist','size_in_bytes':100,'digest':'sha256:'+'a'*64}]}
        run={'id':123,'status':'completed','conclusion':'success','head_sha':c['sourceCommit'],'head_branch':m.SOURCE_BRANCH,'path':m.SOURCE_WORKFLOW,'run_attempt':2}
        jobs=[{'name':n,'status':'completed','conclusion':'success'} for n in c['expectedJobs']]
        artifacts=[dict(c['sourceArtifacts'][0],expired=False,workflow_run={'head_sha':c['sourceCommit'],'id':123})]
        return c,run,jobs,artifacts

    def check_provider(self,c,run,jobs,artifacts):
        def pages(endpoint):return jobs if endpoint.endswith('/jobs') else artifacts
        with patch.dict(os.environ,GITHUB_RUN_ID='999'),patch.object(m,'api',return_value=run),patch.object(m,'pages',side_effect=pages):
            return m.source_provider(c)

    def test_source_provider_requires_terminal_exact_job_and_artifact_set(self):
        c,run,jobs,artifacts=self.provider_fixture();self.check_provider(c,run,jobs,artifacts)
        for variant in ['running','failed','attempt','missingjob','extrajob','jobfailure','artifactdigest','expired','artifactcommit','artifactrun']:
            r,j,a=copy.deepcopy((run,jobs,artifacts))
            if variant=='running':r['status']='in_progress'
            elif variant=='failed':r['conclusion']='failure'
            elif variant=='attempt':r['run_attempt']=1
            elif variant=='missingjob':j.pop()
            elif variant=='extrajob':j.append(dict(j[0],name='unexpected'))
            elif variant=='jobfailure':j[0]['conclusion']='failure'
            elif variant=='artifactdigest':a[0]['digest']='sha256:'+'b'*64
            elif variant=='expired':a[0]['expired']=True
            elif variant=='artifactcommit':a[0]['workflow_run']['head_sha']='3'*40
            else:a[0]['workflow_run']['id']=124
            with self.subTest(variant=variant),self.assertRaises(ValueError):self.check_provider(c,r,j,a)

    def test_scope_never_promotes_legacy_initialization_to_strict_native_start(self):
        m.check_legacy_route_scope({'normalUiZeroStepStartProven':False,'resetCounterScope':m.LEGACY_ROUTE_RESET_COUNTER_SCOPE})
        for bad in [{},{'normalUiZeroStepStartProven':True,'resetCounterScope':m.LEGACY_ROUTE_RESET_COUNTER_SCOPE},
                    {'normalUiZeroStepStartProven':False,'resetCounterScope':'0 resets'}]:
            with self.assertRaises(ValueError):m.check_legacy_route_scope(bad)

    def test_actual_ordinary_source_null_optional_counter_is_compatible(self):
        # This is the ordinary qa-creative-browser serializer shape: the
        # actual runV8Journey counters are present while its specialized
        # cargoResets field is null. This fixture claims no new playthrough.
        route=json.loads('{"pass":true,"kind":"ordinary-v8-route","state":"won","resets":0,"respawns":0,"cargoResets":null}')
        m.check_route_reset_counters(route)
        m.check_route_reset_counters(dict(route,cargoResets=0))
        del route['cargoResets'];m.check_route_reset_counters(route)

    def test_any_actual_reset_or_malformed_optional_counter_is_rejected(self):
        route={'resets':0,'respawns':0,'cargoResets':None}
        for key in ('resets','respawns','cargoResets'):
            for value in (1,2,-1,True,False,'0',0.0,[],{}):
                with self.subTest(key=key,value=value),self.assertRaises(ValueError):
                    m.check_route_reset_counters(dict(route,**{key:value}))
        for key in ('resets','respawns'):
            bad=dict(route);del bad[key]
            with self.subTest(missing=key),self.assertRaises(ValueError):m.check_route_reset_counters(bad)
            with self.subTest(null=key),self.assertRaises(ValueError):m.check_route_reset_counters(dict(route,**{key:None}))

    def test_http_digest_mismatch_never_installs_partial_bytes(self):
        class Response(io.BytesIO):
            status=200;url=m.BASE+'x'
        with WorkingDirectory(),patch.object(m.time,'sleep'),patch.object(m.urllib.request,'build_opener') as opener:
            opener.return_value.open.side_effect=lambda *a,**k:Response(b'bad')
            with self.assertRaises(m.ContentMismatch):m.get(m.BASE+'x',expected={'bytes':3,'sha256':m.sha(b'yes')},destination=Path('target'))
            self.assertFalse(Path('target').exists());self.assertFalse(Path('target.partial').exists())

    def test_http_missing_namespace_requires_real_404(self):
        with patch.object(m.urllib.request,'build_opener') as opener:
            opener.return_value.open.side_effect=urllib.error.HTTPError(m.URL,404,'missing',{},None)
            self.assertIsNone(m.get(m.URL,absent=True))
            opener.return_value.open.side_effect=urllib.error.HTTPError(m.URL,403,'forbidden',{},None)
            with self.assertRaises(urllib.error.HTTPError):m.get(m.URL,absent=True)

    def test_network_checks_exact_response_bytes_and_actual_fresh_page_stamps(self):
        rows=[{'path':'index.html','bytes':1,'sha256':'a'*64}]
        net=[{'page':1,'url':m.URL+'index.html','status':200,'fromCache':False,'bytes':1,'sha256':'a'*64}]
        stamps=[{'page':1,'url':m.URL+'build-info.json','status':200,'sha256':'b'*64}]
        m.check_network(net,stamps,rows,'b'*64,1)
        for variant in ['cached','wrongbody','outside','stamp','page']:
            n,s=copy.deepcopy((net,stamps))
            if variant=='cached':n[0]['fromCache']=True
            elif variant=='wrongbody':n[0]['sha256']='c'*64
            elif variant=='outside':n[0]['url']=m.BASE+'campaign-v62/index.html'
            elif variant=='stamp':s[0]['sha256']='c'*64
            else:s[0]['page']=2
            with self.subTest(variant=variant),self.assertRaises(ValueError):m.check_network(n,s,rows,'b'*64,1)

    def test_accepted_baseline_pin_is_exact(self):
        self.assertEqual(m.BASELINE[:2],(2605,690702631))
        self.assertEqual(m.CATALOG_SHA,'e5d36ae12354ec7fea8c86a187d5a044fdf29ecec669789b8fe85b9f12c17994')
        self.assertEqual(m.BASELINE_DEPLOYMENT,{'id':7190324410,'sha':'c5814892d6a40ffc911e0ed62df022f82990cb4a'})

if __name__=='__main__':unittest.main()
