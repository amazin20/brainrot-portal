"""Isolated boundary tests; never invoke game routes, builds, or GitHub writes."""
import copy
import datetime
import hashlib
import importlib.util
import json
import pathlib
import stat
import tempfile
import unittest
import zipfile

ROOT=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('v57_source_auditor',ROOT/'audit-source-v57.py')
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
COMMIT='302b07505a4417c9969c64c3defc4c8b0793b640'
TREE='c1b21'+'0'*35
RUN=38763399366

def provider_fixture():
    run={'id':RUN,'run_attempt':1,'head_sha':COMMIT,'head_branch':audit.BRANCH,'path':audit.WORKFLOW,
         'event':'push','repository':{'full_name':audit.REPOSITORY},'status':'completed','conclusion':'success'}
    commit={'sha':COMMIT,'tree':{'sha':TREE},'parents':[{'sha':audit.BASE}]}
    jobs=[];artifacts=[]
    for i,(name,names) in enumerate(audit.expected_roles().items()):
        steps=[{'name':'Run actions/upload-artifact@v4','number':j+1,'status':'completed','conclusion':'success',
                'started_at':'2026-10-15T16:00:00Z','completed_at':'2026-10-15T16:00:02Z'} for j in range(len(names))]
        jobs.append({'id':2000+i,'name':name,'run_id':RUN,'run_attempt':1,'head_sha':COMMIT,
                     'status':'completed','conclusion':'success','steps':steps})
        for name in names:
            artifacts.append({'id':3000+len(artifacts),'name':name,'size_in_bytes':1024,'digest':'sha256:'+'f'*64,
                              'expired':False,'created_at':'2026-10-15T16:00:01Z',
                              'workflow_run':{'id':RUN,'head_sha':COMMIT,'head_branch':audit.BRANCH,
                                              'repository_id':1354625251,'head_repository_id':1354625251}})
    return run,jobs,artifacts,commit

def validate(fixture):
    return audit.validate_provider(*fixture,COMMIT,TREE,[audit.BASE],RUN)

class ProviderGates(unittest.TestCase):
    def test_exact_group_and_artifact_coverage(self):
        f=provider_fixture();self.assertEqual(len(f[1]),22);self.assertEqual(len(f[2]),24)
        self.assertEqual(set(validate(f)),{a['name'] for a in f[2]})

    def test_run_identity_and_completed_attempt(self):
        for key,value in [('id',RUN+1),('run_attempt',2),('head_sha',audit.BASE),('head_branch','main'),
                          ('path','.github/workflows/publish-campaign-v56.yml'),('event','workflow_dispatch'),
                          ('status','in_progress'),('conclusion','failure')]:
            with self.subTest(key=key):
                f=provider_fixture();f[0][key]=value
                with self.assertRaises((AssertionError,KeyError)):validate(f)

    def test_missing_duplicate_failed_or_wrong_origin_jobs(self):
        for mode in ['missing','duplicate-id','duplicate-name','failed','active','run','attempt','sha','upload']:
            with self.subTest(mode=mode):
                f=provider_fixture();j=f[1]
                if mode=='missing':j.pop()
                if mode=='duplicate-id':j[1]['id']=j[0]['id']
                if mode=='duplicate-name':j[1]['name']=j[0]['name']
                if mode=='failed':j[0]['conclusion']='failure'
                if mode=='active':j[0]['status']='in_progress'
                if mode=='run':j[0]['run_id']+=1
                if mode=='attempt':j[0]['run_attempt']=2
                if mode=='sha':j[0]['head_sha']=audit.BASE
                if mode=='upload':j[0]['steps'].pop()
                with self.assertRaises((AssertionError,KeyError)):validate(f)

    def test_missing_duplicate_expired_or_wrong_producer_artifacts(self):
        for mode in ['missing','duplicate-id','duplicate-name','expired','digest','run','sha','repository','upload-time']:
            with self.subTest(mode=mode):
                f=provider_fixture();a=f[2]
                if mode=='missing':a.pop()
                if mode=='duplicate-id':a[1]['id']=a[0]['id']
                if mode=='duplicate-name':a[1]['name']=a[0]['name']
                if mode=='expired':a[0]['expired']=True
                if mode=='digest':a[0]['digest']='sha256:bad'
                if mode=='run':a[0]['workflow_run']['id']+=1
                if mode=='sha':a[0]['workflow_run']['head_sha']=audit.BASE
                if mode=='repository':a[0]['workflow_run']['repository_id']+=1
                if mode=='upload-time':a[0]['created_at']='2026-10-15T16:05:00Z'
                with self.assertRaises((AssertionError,KeyError)):validate(f)

class ZIPGates(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory(prefix='v57-audit-boundary-')
        self.addCleanup(self.temporary.cleanup);self.root=pathlib.Path(self.temporary.name)

    def make(self,members=None):
        members=members or [('root/a.txt',b'actual original bytes')]
        archive=self.root/'artifact.zip';directory=self.root/'extracted';directory.mkdir(exist_ok=True)
        with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_STORED) as z:
            for name,data in members:z.writestr(name,data)
        (directory/'a.txt').write_bytes(b'actual original bytes')
        return archive,directory,self.pin(archive)

    def pin(self,archive):
        return {'id':1,'name':'physical-power-boundary-fixture','size_in_bytes':archive.stat().st_size,
                'digest':'sha256:'+hashlib.sha256(archive.read_bytes()).hexdigest()}

    def test_exact_body_and_common_root(self):
        a,d,p=self.make();self.assertEqual(audit.verified_zip(a,d,p)['files'],1)

    def test_changed_deleted_or_extra_extracted_member(self):
        for mode in ['changed','deleted','extra','extra-directory']:
            with self.subTest(mode=mode),tempfile.TemporaryDirectory(dir=self.root) as temp:
                a,d,p=self.make();original=(d/'a.txt').read_bytes()
                if mode=='changed':(d/'a.txt').write_bytes(b'changed')
                if mode=='deleted':(d/'a.txt').unlink()
                if mode=='extra':(d/'unclaimed.txt').write_text('extra')
                if mode=='extra-directory':(d/'unclaimed').mkdir()
                with self.assertRaises(AssertionError):audit.verified_zip(a,d,p)
                for item in list(d.iterdir()):
                    if item.is_dir():item.rmdir()
                    else:item.unlink()

    def test_changed_zip_even_when_extracted_body_unchanged(self):
        a,d,p=self.make();a.write_bytes(a.read_bytes()+b'drift')
        with self.assertRaises(AssertionError):audit.verified_zip(a,d,p)

    def test_crc_rejection_even_after_corrupt_zip_digest_is_repinned(self):
        a,d,p=self.make()
        with zipfile.ZipFile(a) as z:
            m=z.infolist()[0];offset=m.header_offset+30+len(m.filename.encode())+len(m.extra)
        data=bytearray(a.read_bytes());data[offset]^=1;a.write_bytes(data)
        with self.assertRaises(zipfile.BadZipFile):audit.verified_zip(a,d,self.pin(a))

    def test_noncanonical_paths_and_special_members(self):
        for name in ['../escape','/absolute','C:/drive','back\\slash','root//a.txt','root/./a.txt']:
            with self.subTest(name=name):
                a,d,p=self.make([(name,b'actual original bytes')])
                with self.assertRaises(AssertionError):audit.verified_zip(a,d,p)
        a,d,_=self.make()
        with zipfile.ZipFile(a,'w') as z:
            info=zipfile.ZipInfo('root/a.txt');info.external_attr=(stat.S_IFLNK|0o777)<<16;z.writestr(info,b'actual original bytes')
        with self.assertRaises(AssertionError):audit.verified_zip(a,d,self.pin(a))

    def test_unsafe_name_rejects_controls_empty_segments_and_traversal(self):
        for name in ['', '.', '..', 'a/../b','a\x00b','a\nb','a\x7fb','a//b','a/'+('b'*2048)]:
            with self.subTest(name=repr(name)),self.assertRaises(AssertionError):audit.safe_name(name)

class RuntimeCatalogue(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        root=pathlib.Path(self.temp.name);self.source=root/'source';self.dist=root/'dist'
        for base in [self.source/'public',self.dist]:
            (base/'models/runtime').mkdir(parents=True);(base/'draco').mkdir()
        (self.source/'src/game').mkdir(parents=True)
        (self.source/'package.json').write_text('{"type":"module"}')
        (self.source/'src/game/labAssets.js').write_text('export const CAMPAIGN_ASSETS='+json.dumps([{'id':i} for i in range(1,15)])+';')
        self.records=[]
        for i in list(range(1,15))+[99]:
            filename=f'model-{i}-fixture.glb';data=(f'original-model-{i}'.encode())*100
            (self.source/'public/models/runtime'/filename).write_bytes(data)
            if i!=99:(self.dist/'models/runtime'/filename).write_bytes(data)
            self.records.append({'id':i,'filename':filename,'outputBytes':len(data),'outputSHA256':audit.sha(data),'triangles':100+i,'sourceOnlyNote':'not shipped'})
        (self.source/'public/models/runtime/manifest.json').write_text(json.dumps({'models':self.records}))
        for base in [self.source/'public',self.dist]:(base/'draco/decoder.js').write_bytes(b'original decoder')
        self.compact={'version':8,'totalBytes':sum(r['outputBytes'] for r in self.records[:14]),'totalTriangles':sum(r['triangles'] for r in self.records[:14]),'models':[{k:r[k] for k in ['id','filename','outputBytes','outputSHA256','triangles']} for r in self.records[:14]]}
        self.save(self.compact)

    def save(self,value):
        (self.dist/'models/runtime/manifest.json').write_bytes(audit.encoded(value))

    def verify(self):audit.check_runtime_assets(self.source,self.dist,audit.inventory(self.dist))

    def test_exact_source_compaction_preserves_binary_assets(self):self.verify()

    def test_wrong_exact_metadata_and_record_fields(self):
        for field,value in [('version',9),('totalBytes',1),('totalTriangles',1),('extra',True)]:
            with self.subTest(field=field):
                mutated=copy.deepcopy(self.compact);mutated[field]=value;self.save(mutated)
                with self.assertRaises(AssertionError):self.verify()
        for field,value in [('filename','renamed.glb'),('outputBytes',7),('outputSHA256','0'*64),('triangles',7),('extra',True)]:
            with self.subTest(recordField=field):
                mutated=copy.deepcopy(self.compact);mutated['models'][0][field]=value;self.save(mutated)
                with self.assertRaises(AssertionError):self.verify()

    def test_missing_extra_duplicate_reordered_or_inactive_record(self):
        inactive={k:self.records[-1][k] for k in ['id','filename','outputBytes','outputSHA256','triangles']}
        for kind in ['missing','extra','duplicate','reordered','inactive']:
            with self.subTest(kind=kind):
                mutated=copy.deepcopy(self.compact)
                if kind=='missing':mutated['models'].pop()
                if kind=='extra':mutated['models'].append(inactive)
                if kind=='duplicate':mutated['models'][-1]=copy.deepcopy(mutated['models'][0])
                if kind=='reordered':mutated['models'].reverse()
                if kind=='inactive':mutated['models'][0]=inactive
                mutated['totalBytes']=sum(r['outputBytes'] for r in mutated['models']);mutated['totalTriangles']=sum(r['triangles'] for r in mutated['models']);self.save(mutated)
                with self.assertRaises(AssertionError):self.verify()

    def test_exact_serialization_and_each_model_decoder_byte(self):
        manifest=self.dist/'models/runtime/manifest.json';manifest.write_bytes(audit.encoded(self.compact)+b'\n')
        with self.assertRaises(AssertionError):self.verify()
        self.save(self.compact)
        for filename in ['models/runtime/model-1-fixture.glb','draco/decoder.js']:
            with self.subTest(binary=filename):
                path=self.dist/filename;old=path.read_bytes();path.write_bytes(old+b'changed')
                with self.assertRaises(AssertionError):self.verify()
                path.write_bytes(old)

class TAPGates(unittest.TestCase):
    good='# tests 17\n# pass 17\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n'

    def test_exact_positive_footer(self):self.assertEqual(audit.tap_counts(self.good)['tests'],17)

    def test_missing_ambiguous_failed_skipped_and_unfinished_footers(self):
        for text in [self.good+'# tests 17\n',self.good.replace('# todo 0\n',''),self.good.replace('# pass 17','# pass 16'),
                     self.good.replace('# fail 0','# fail 1'),self.good.replace('# skipped 0','# skipped 1'),
                     self.good.replace('# cancelled 0','# cancelled 1'),self.good.replace('# todo 0','# todo 1')]:
            with self.subTest(text=text),self.assertRaises(AssertionError):audit.tap_counts(text)

    def test_actual_provider_stdout_has_every_unmodified_tap_line_in_order(self):
        tap='ok 1 - physical contact\n'+self.good
        logged='\n'.join('2026-10-15T16:00:00.0000000Z '+s for s in tap.splitlines())
        audit.stdout_contains(tap,logged)
        for wrong in [logged.replace('physical contact','wrong test'), '\n'.join(reversed(logged.splitlines())), 'footer only']:
            with self.subTest(log=wrong),self.assertRaises(AssertionError):audit.stdout_contains(tap,wrong)

if __name__=='__main__':unittest.main()
