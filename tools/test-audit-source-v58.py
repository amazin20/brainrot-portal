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
from unittest.mock import patch
from PIL import Image

ROOT=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('v58_source_auditor',ROOT/'audit-source-v58.py')
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
        f=provider_fixture();self.assertEqual(len(f[1]),24);self.assertEqual(len(f[2]),26)
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
        self.temporary=tempfile.TemporaryDirectory(prefix='v58-audit-boundary-')
        self.addCleanup(self.temporary.cleanup);self.root=pathlib.Path(self.temporary.name)

    def make(self,members=None):
        members=members or [('root/a.txt',b'actual original bytes')]
        archive=self.root/'artifact.zip';directory=self.root/'extracted';directory.mkdir(exist_ok=True)
        with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_STORED) as z:
            for name,data in members:z.writestr(name,data)
        (directory/'a.txt').write_bytes(b'actual original bytes')
        return archive,directory,self.pin(archive)

    def pin(self,archive):
        return {'id':1,'name':'camera-readability-boundary-fixture','size_in_bytes':archive.stat().st_size,
                'digest':'sha256:'+hashlib.sha256(archive.read_bytes()).hexdigest()}

    def test_exact_body_and_common_root(self):
        a,d,p=self.make();self.assertEqual(audit.verified_zip(a,d,p)['files'],1)

    def test_full_posix_path_order_survives_prefix_sibling_zip_members(self):
        names=['assets/panel.txt','assets-v2.json','assets/panel-v2.txt','assets.html']
        self.assertNotEqual(sorted(names,key=pathlib.PurePosixPath),sorted(names))
        archive=self.root/'prefixes.zip';directory=self.root/'prefixes';directory.mkdir()
        with zipfile.ZipFile(archive,'w') as z:
            for name in reversed(names):
                data=name.encode();z.writestr('payload/'+name,data)
                p=directory/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
        self.assertEqual([r['path'] for r in audit.inventory(directory)],sorted(names))
        self.assertEqual(audit.verified_zip(archive,directory,self.pin(archive))['files'],4)

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

class CausalClosure(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=pathlib.Path(self.temp.name)
        for name,data in [('binding.json',b'{}'),('clips/phase.mp4',b'actual fixture body'),('stills/phase-0000.jpg',b'fixture pixels')]:
            p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
        rows=audit.inventory(self.root)
        (self.root/'closed-media-inventory.json').write_bytes(audit.encoded({'files':rows,'filesSha256':audit.sha(audit.encoded(rows))}))

    def test_exact_complete_closed_members(self):
        self.assertEqual(len(audit.check_closed_causal_inventory(self.root)),4)

    def test_changed_deleted_and_extra_members_are_rejected(self):
        for mode in ['changed','deleted','extra','wrong-inventory-order','wrong-inventory-digest']:
            with self.subTest(mode=mode):
                p=self.root/'binding.json';original=p.read_bytes();index=self.root/'closed-media-inventory.json';saved=index.read_bytes()
                try:
                    if mode=='changed':p.write_bytes(b'changed')
                    if mode=='deleted':p.unlink()
                    if mode=='extra':(self.root/'unmeasured.json').write_bytes(b'{}')
                    if mode.startswith('wrong-inventory'):
                        value=json.loads(saved)
                        if mode=='wrong-inventory-order':value['files'].reverse();value['filesSha256']=audit.sha(audit.encoded(value['files']))
                        else:value['filesSha256']='0'*64
                        index.write_bytes(audit.encoded(value))
                    with self.assertRaises(AssertionError):audit.check_closed_causal_inventory(self.root)
                finally:
                    p.write_bytes(original);index.write_bytes(saved);(self.root/'unmeasured.json').unlink(missing_ok=True)

class CausalArtifactGates(unittest.TestCase):
    """Synthetic packets exercise the helper, never audit() or receipt writing.

    JPEGs are real PIL images. MP4 bodies and telemetry are explicitly synthetic;
    ffprobe/ffmpeg are mocked so these packets cannot serve as native evidence.
    Inner-boundary mutations reseal the inventory deliberately: rejection must
    come from the specific identity/media gate, not a stale outer file hash.
    """
    phases={
        'room25':['loaded-support','lit-gallery','dark-return','relight-ascent'],
        'castle':['upper-founded-view','upper-ride','upper-after-ride','upper-contact-retained'],
    }

    def setUp(self):self.fixture()

    @staticmethod
    def pixel_log(frames=24,low=16,high=216):
        return ''.join(f'frame:{i}\nlavfi.signalstats.YMIN={low}\nlavfi.signalstats.YMAX={high}\n' for i in range(frames))

    def fixture(self):
        temp=tempfile.TemporaryDirectory(prefix='v58-causal-synthetic-');self.addCleanup(temp.cleanup)
        self.root=pathlib.Path(temp.name);self.source=self.root/'synthetic-source';self.source.mkdir()
        dist=self.root/'camera-readability-dist';dist.mkdir();(dist/'build-info.json').write_bytes(b'{"syntheticFixture":true}\n')
        stamp=(dist/'build-info.json').read_bytes()
        self.manifest={'files':[{'path':'assets/synthetic.js','bytes':7,'sha256':audit.sha(b'fixture')},
                                {'path':'index.html','bytes':7,'sha256':audit.sha(b'fixture')}]}
        self.probe={'streams':[{'codec_name':'h264','codec_type':'video','width':960,'height':540,
                               'r_frame_rate':'12/1','nb_frames':'24','nb_read_frames':'24','duration':'2.000000'}]}
        self.reports={};self.bindings={};self.served={};self.logs={}
        for case,ids in self.phases.items():
            directory=self.directory(case);directory.mkdir()
            source={'commit':COMMIT,'tree':TREE,'sourceReview':{'runId':RUN,'runAttempt':1}}
            controller={'commit':COMMIT,'tree':TREE,'runId':RUN,'runAttempt':1,'trackedWorkingTreeClean':True,
                        'captureOrigin':{'runId':RUN,'runAttempt':1,'commit':COMMIT}}
            package={'files':copy.deepcopy(self.manifest['files']),'buildInfoBytes':len(stamp),'buildInfoSha256':audit.sha(stamp)}
            self.bindings[case]={'source':copy.deepcopy(source),'controller':copy.deepcopy(controller),'package':copy.deepcopy(package)}
            self.served[case]={'sourceCommit':COMMIT,'sourceTree':TREE,'allHTTPFilesVerified':True,
                'files':[dict(row,status=200) for row in self.manifest['files']]+[
                    {'path':'build-info.json','bytes':len(stamp),'sha256':audit.sha(stamp),'status':200}]}
            telemetry=[{'syntheticFixture':True,'clipId':phase,'index':i,'encodedFrame':n*24+i}
                       for n,phase in enumerate(ids) for i in range(24)]
            self.put(case,'telemetry.jsonl',b''.join(audit.encoded(row)+b'\n' for row in telemetry))
            phases=[]
            for n,phase in enumerate(ids):
                self.put(case,'clips/'+phase+'.mp4',b'SYNTHETIC-MP4-FIXTURE:'+case.encode()+b':'+phase.encode())
                self.put(case,'ffprobe/'+phase+'.json',audit.encoded(self.probe))
                pixel_path='ffprobe/'+phase+'-pixels.log';self.put(case,pixel_path,self.pixel_log().encode())
                keyframes=[]
                for index in [0,12,23]:
                    name=f'stills/{phase}-{index:04d}.jpg';p=directory/name;p.parent.mkdir(exist_ok=True)
                    Image.linear_gradient('L').resize((960,540)).convert('RGB').save(p)
                    keyframes.append(dict(self.record(case,name),index=index,encodedFrame=n*24+index))
                phases.append({'id':phase,'frames':24,'clip':dict(self.record(case,'clips/'+phase+'.mp4'),frames=24,
                    pixelCheck=dict(self.record(case,pixel_path),minimumLuminanceRange=200)), 'keyframes':keyframes})
            self.reports[case]={'kind':'v58-causal-readability','syntheticFixture':True,'case':case,
                'source':source,'controller':controller,'package':package,'ui':{'syntheticFixture':True},'capture':{'width':960,'height':540},
                'telemetry':dict(self.record(case,'telemetry.jsonl'),samples=len(telemetry)),'phases':phases}
            self.logs['readability ('+case+')']=f'V58_CAUSAL_COMPLETE {case} 96 4 {COMMIT}\n'
        self.persist()

    def directory(self,case):return self.root/('camera-readability-causal-'+case)

    def put(self,case,name,data):
        p=self.directory(case)/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)

    def record(self,case,name):
        p=self.directory(case)/name;return {'path':name,'bytes':p.stat().st_size,'sha256':audit.file_sha(p)}

    def persist(self,rebind=False):
        for case,report in self.reports.items():
            if rebind:
                for section in ['source','controller','package']:self.bindings[case][section]=copy.deepcopy(report[section])
            self.put(case,'binding.json',audit.encoded(self.bindings[case]))
            self.put(case,'served-package.json',audit.encoded(self.served[case]))
            self.put(case,'native-ui-play.json',audit.encoded(report['ui']))
            self.put(case,'report.json',audit.encoded(report))
            rows=[r for r in audit.inventory(self.directory(case)) if r['path']!='closed-media-inventory.json']
            self.put(case,'closed-media-inventory.json',audit.encoded({'files':rows,'filesSha256':audit.sha(audit.encoded(rows))}))

    def validate(self,*,probe=None,pixels=None,decoder_error=False):
        commands=[]
        def decoder(command,**kwargs):
            commands.append((command,kwargs))
            if command[0]=='ffprobe':return audit.encoded(self.probe if probe is None else probe)
            self.assertEqual(command[0],'ffmpeg')
            if decoder_error:raise audit.subprocess.CalledProcessError(1,command,output='synthetic decoder failure')
            self.assertIs(kwargs.get('text'),True)
            return self.pixel_log() if pixels is None else pixels
        with patch.object(audit.subprocess,'check_output',side_effect=decoder):
            result=audit.causal_artifacts(self.root,self.source,COMMIT,TREE,RUN,self.manifest,self.logs)
        return result,commands

    def test_both_case_packets_decode_real_jpegs_and_return_keyed_unaccepted_scope(self):
        (result,probes,images),commands=self.validate()
        self.assertTrue(result['pass']);self.assertEqual(list(result['cases']),['room25','castle'])
        self.assertEqual(result['frames'],192);self.assertEqual(len(images),24);self.assertEqual(len(commands),16)
        for case,ids in self.phases.items():
            record=result['cases'][case]
            self.assertEqual(record['phases'],ids);self.assertEqual(record['frames'],96);self.assertEqual(record['keyframes'],12)
            self.assertEqual(set(probes[case]),set(ids));self.assertTrue(record['fullyDecoded'])
            for key in ['humanAccepted','cameraAccepted','hardwareFPSMeasured']:self.assertIs(record[key],False)
            self.assertEqual(record['reportSha256'],self.record(case,'report.json')['sha256'])
        self.assertTrue(all((row['width'],row['height'])==(960,540) for row in images))
        for command,_ in commands:
            if command[0]=='ffprobe':self.assertIn('-count_frames',command)
            else:self.assertIn('-xerror',command);self.assertIn('scale=160:90,signalstats,metadata=mode=print:file=-',command)

    def test_wrong_case_source_commit_or_tree_rejects_after_resealing(self):
        for section,key,value in [(None,'case','castle'),('source','commit','0'*40),('source','tree','0'*40)]:
            with self.subTest(section=section,key=key):
                self.fixture();target=self.reports['room25'] if section is None else self.reports['room25'][section]
                target[key]=value;self.persist(rebind=True)
                with self.assertRaisesRegex(AssertionError,'Causal source/case mismatch'):self.validate()

    def test_wrong_source_review_run_or_attempt_rejects(self):
        for review in [{'runId':RUN+1,'runAttempt':1},{'runId':RUN,'runAttempt':2}]:
            with self.subTest(review=review):
                self.fixture();self.reports['room25']['source']['sourceReview']=review;self.persist(rebind=True)
                with self.assertRaisesRegex(AssertionError,'Causal SOURCE review differs'):self.validate()

    def test_wrong_controller_or_capture_origin_rejects(self):
        variants=[('commit','0'*40),('tree','0'*40),('runId',RUN+1),('runAttempt',2),('trackedWorkingTreeClean',False)]
        variants += [('captureOrigin',dict({'runId':RUN,'runAttempt':1,'commit':COMMIT},**{key:value}))
                     for key,value in [('runId',RUN+1),('runAttempt',2),('commit','0'*40)]]
        for key,value in variants:
            with self.subTest(key=key,value=value):
                self.fixture();self.reports['room25']['controller'][key]=value;self.persist(rebind=True)
                with self.assertRaisesRegex(AssertionError,'Causal controller producer mismatch'):self.validate()

    def test_report_cannot_diverge_from_initial_frozen_binding(self):
        self.reports['room25']['controller']['runId']=RUN+1;self.persist()
        with self.assertRaisesRegex(AssertionError,'initial source freeze'):self.validate()

    def test_wrong_exact_package_files_stamp_bytes_or_hash_rejects(self):
        for key,value in [('files',[]),('buildInfoBytes',1),('buildInfoSha256','0'*64)]:
            with self.subTest(key=key):
                self.fixture();self.reports['room25']['package'][key]=value;self.persist(rebind=True)
                with self.assertRaisesRegex(AssertionError,'Causal exact package mismatch'):self.validate()

    def test_incomplete_or_wrong_served_http_closure_rejects(self):
        for mode in ['commit','tree','flag','missing-file','status','file-hash']:
            with self.subTest(mode=mode):
                self.fixture();served=self.served['room25']
                if mode=='commit':served['sourceCommit']='0'*40
                if mode=='tree':served['sourceTree']='0'*40
                if mode=='flag':served['allHTTPFilesVerified']=False
                if mode=='missing-file':served['files'].pop()
                if mode=='status':served['files'][0]['status']=304
                if mode=='file-hash':served['files'][0]['sha256']='0'*64
                self.persist()
                with self.assertRaisesRegex(AssertionError,'served package'):self.validate()

    def test_telemetry_actual_bytes_hash_or_samples_rejects(self):
        for mode in ['actual-body','declared-bytes','declared-hash','declared-samples']:
            with self.subTest(mode=mode):
                self.fixture();record=self.reports['room25']['telemetry']
                if mode=='actual-body':
                    p=self.directory('room25')/'telemetry.jsonl';p.write_bytes(p.read_bytes().replace(b'"index":0',b'"index":1',1))
                if mode=='declared-bytes':record['bytes']+=1
                if mode=='declared-hash':record['sha256']='0'*64
                if mode=='declared-samples':record['samples']-=1
                self.persist()
                with self.assertRaisesRegex(AssertionError,'telemetry bytes differ'):self.validate()

    def test_changed_mp4_body_or_report_hash_rejects(self):
        for mode in ['actual-body','declared-hash']:
            with self.subTest(mode=mode):
                self.fixture();clip=self.reports['room25']['phases'][0]['clip']
                if mode=='actual-body':
                    p=self.directory('room25')/clip['path'];body=p.read_bytes();p.write_bytes(b'X'+body[1:])
                else:clip['sha256']='0'*64
                self.persist()
                with self.assertRaisesRegex(AssertionError,'MP4 bytes differ'):self.validate()

    def test_actual_probe_wrong_frame_count_or_extra_stream_rejects(self):
        for mode in ['short','long','extra-stream']:
            with self.subTest(mode=mode):
                probe=copy.deepcopy(self.probe)
                if mode=='extra-stream':probe['streams'].append(copy.deepcopy(probe['streams'][0]))
                else:probe['streams'][0]['nb_read_frames']='23' if mode=='short' else '25'
                with self.assertRaisesRegex(AssertionError,'decoded frame count differs'):self.validate(probe=probe)

    def test_blank_truncated_or_missing_actual_movie_pixels_reject(self):
        for pixels in ['',self.pixel_log(frames=23),self.pixel_log(low=16,high=16),self.pixel_log().replace('YMAX=216\n','',1)]:
            with self.subTest(pixel_bytes=len(pixels)):
                with self.assertRaisesRegex(AssertionError,'Blank/truncated causal MP4'):self.validate(pixels=pixels)

    def test_actual_decoded_luminance_must_match_claimed_decode(self):
        with self.assertRaisesRegex(AssertionError,'movie pixels differ'):self.validate(pixels=self.pixel_log(high=217))

    def test_decoder_failure_propagates_without_a_causal_result(self):
        with self.assertRaises(audit.subprocess.CalledProcessError):self.validate(decoder_error=True)

    def test_producer_pixel_log_bytes_and_retained_probe_must_match(self):
        for mode in ['pixel-log','retained-probe']:
            with self.subTest(mode=mode):
                self.fixture();phase=self.reports['room25']['phases'][0]
                if mode=='pixel-log':
                    p=self.directory('room25')/phase['clip']['pixelCheck']['path'];p.write_bytes(p.read_bytes()+b'changed')
                else:
                    probe=copy.deepcopy(self.probe);probe['streams'][0]['width']=640
                    self.put('room25','ffprobe/'+phase['id']+'.json',audit.encoded(probe))
                self.persist()
                with self.assertRaisesRegex(AssertionError,'pixel log bytes differ|ffprobe metadata differs'):self.validate()

    def test_still_raw_bytes_hash_and_phase_filename_must_match(self):
        for mode in ['actual-body','declared-hash','filename']:
            with self.subTest(mode=mode):
                self.fixture();frame=self.reports['room25']['phases'][0]['keyframes'][0]
                if mode=='actual-body':
                    p=self.directory('room25')/frame['path'];p.write_bytes(p.read_bytes()+b'changed')
                if mode=='declared-hash':frame['sha256']='0'*64
                if mode=='filename':frame['path']=frame['path'].replace('-0000.jpg','-0001.jpg')
                self.persist()
                with self.assertRaisesRegex(AssertionError,'still bytes differ|frame filename mismatch'):self.validate()

    def test_real_jpeg_dimensions_cannot_differ_even_after_hashes_are_rebound(self):
        for size in [(640,360),(100,100),(960,539)]:
            with self.subTest(size=size):
                self.fixture();frame=self.reports['room25']['phases'][0]['keyframes'][0];p=self.directory('room25')/frame['path']
                Image.linear_gradient('L').resize(size).convert('RGB').save(p)
                frame.update(self.record('room25',frame['path']));self.persist()
                with self.assertRaisesRegex(AssertionError,'still dimensions differ'):self.validate()

    def test_actual_and_claimed_smaller_viewports_do_not_replace_960_by_540(self):
        frame=self.reports['room25']['phases'][0]['keyframes'][0];p=self.directory('room25')/frame['path']
        Image.linear_gradient('L').resize((640,360)).convert('RGB').save(p);frame.update(self.record('room25',frame['path']))
        self.reports['room25']['capture']={'width':640,'height':360};self.persist()
        with self.assertRaisesRegex(AssertionError,'still dimensions differ'):self.validate()

    def test_extra_member_rejects_even_when_closed_inventory_is_resealed(self):
        self.put('room25','extra-not-produced.json',b'{"synthetic":true}');self.persist()
        with self.assertRaisesRegex(AssertionError,'Unexpected/missing causal artifact member'):self.validate()

    def test_completion_requires_actual_case_frame_phase_and_commit_stdout(self):
        for value in ['',f'V58_CAUSAL_COMPLETE room25 95 4 {COMMIT}',f'V58_CAUSAL_COMPLETE room25 96 3 {COMMIT}',
                      f'V58_CAUSAL_COMPLETE room25 96 4 {"0"*40}']:
            with self.subTest(value=value):
                self.logs['readability (room25)']=value
                with self.assertRaisesRegex(AssertionError,'actual producer stdout'):self.validate()

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
