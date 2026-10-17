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
import subprocess
import shutil
import os
from unittest.mock import patch
from PIL import Image

ROOT=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('v60_source_auditor',ROOT/'audit-source-v60.py')
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
        f=provider_fixture();self.assertEqual(len(f[1]),32);self.assertEqual(len(f[2]),34)
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
        self.temporary=tempfile.TemporaryDirectory(prefix='v60-audit-boundary-')
        self.addCleanup(self.temporary.cleanup);self.root=pathlib.Path(self.temporary.name)

    def make(self,members=None):
        members=members or [('root/a.txt',b'actual original bytes')]
        archive=self.root/'artifact.zip';directory=self.root/'extracted';directory.mkdir(exist_ok=True)
        with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_STORED) as z:
            for name,data in members:z.writestr(name,data)
        (directory/'a.txt').write_bytes(b'actual original bytes')
        return archive,directory,self.pin(archive)

    def pin(self,archive):
        return {'id':1,'name':'first-chapter-boundary-fixture','size_in_bytes':archive.stat().st_size,
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

class WorkflowScope(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        candidates=[ROOT/'first-chapter-upgrade',ROOT.parent.parent/'first-chapter-upgrade',ROOT.parent/'source',ROOT.parent]
        source=pathlib.Path(os.environ['V60_SOURCE_ROOT']) if 'V60_SOURCE_ROOT' in os.environ else next(p for p in candidates if (p/audit.WORKFLOW).is_file())
        cls.text=(source/audit.WORKFLOW).read_text()

    def test_actual_immutable_workflow_expands_to_32_jobs_34_artifacts(self):
        roles=audit.workflow_contract(self.text)
        self.assertEqual(len(roles),32);self.assertEqual(sum(map(len,roles.values())),34)
        self.assertEqual({name for rows in roles.values() for name in rows if name.startswith('first-chapter-film-')},{f'first-chapter-film-{i}' for i in range(1,11)})

    def test_missing_duplicate_film_or_wrong_native_matrix_rejected(self):
        import yaml
        for mode in ['missing-film','duplicate-film','extra-film','missing-group','reordered-rooms','missing-cpu','extra-job','wrong-upload','conditional','soft-failure','old-checkout','old-trigger','ref-concurrency']:
            with self.subTest(mode=mode):
                data=yaml.safe_load(self.text)
                if mode=='missing-film':data['jobs']['films']['strategy']['matrix']['room'].pop()
                if mode=='duplicate-film':data['jobs']['films']['strategy']['matrix']['room'][-1]=1
                if mode=='extra-film':data['jobs']['films']['strategy']['matrix']['room'].append(11)
                if mode=='missing-group':data['jobs']['native']['strategy']['matrix']['include'].pop()
                if mode=='reordered-rooms':data['jobs']['native']['strategy']['matrix']['include'][0]['rooms']='2,1,3,4,5,6,7,8,9,10'
                if mode=='missing-cpu':data['jobs']['cpu']['strategy']['matrix']['part'].pop()
                if mode=='extra-job':data['jobs']['diagnostic']=copy.deepcopy(data['jobs']['build'])
                if mode=='wrong-upload':data['jobs']['films']['steps'][-1]['with']['name']='first-chapter-film-1'
                if mode=='conditional':data['jobs']['films']['if']='false'
                if mode=='soft-failure':data['jobs']['attacks']['continue-on-error']=True
                if mode=='old-checkout':data['jobs']['build']['steps'][0]['with']['ref']='main'
                if mode=='old-trigger':data[True]['push']['branches']=['upgrade/castle-impulse-20261016']
                if mode=='ref-concurrency':data['concurrency']['group']='first-chapter-review-${{ github.ref }}'
                with self.assertRaises(AssertionError):audit.workflow_contract(yaml.safe_dump(data,sort_keys=False))

class ClosedMediaAndHTTP(unittest.TestCase):
    """Synthetic isolated records never enter audit() or create acceptance."""
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=pathlib.Path(self.temp.name)

    def test_closed_media_rejects_deleted_extra_duplicate_and_changed_body(self):
        f=self.root/'movie.bin';f.write_bytes(b'explicitly synthetic media fixture')
        row={'name':f.name,'bytes':f.stat().st_size,'sha256':audit.file_sha(f)}
        index=self.root/'closed-media-member-inventory.json'
        for mode in ['good','changed','deleted','extra','duplicate']:
            f.write_bytes(b'explicitly synthetic media fixture');rows=[row.copy()]
            if mode=='changed':f.write_bytes(b'changed')
            if mode=='deleted':f.unlink()
            if mode=='extra':rows.append({'name':'unclaimed.bin','bytes':1,'sha256':'f'*64})
            if mode=='duplicate':rows.append(row.copy())
            index.write_text(json.dumps({'files':rows}))
            if mode=='good':self.assertEqual(len(audit.closed_media(self.root,{'movie.bin'})),1)
            else:
                with self.subTest(mode=mode),self.assertRaises(AssertionError):audit.closed_media(self.root,{'movie.bin'})

    def http_fixture(self):
        info=b'{"synthetic":true}'
        files=[{'path':'app.js','bytes':7,'sha256':'f'*64}];inputs=[{'filename':'src/synthetic.js','sha256':'e'*64}]
        manifest={'sourceInputsSha256':audit.sha(audit.encoded(inputs)),'sourceInputFiles':1,'sourceInputs':inputs,'files':files}
        binding={'source':{'commit':COMMIT,'tree':TREE,'sourceInputsSha256':manifest['sourceInputsSha256'],'sourceInputFiles':1},'sourceInputs':inputs,'package':{'commit':COMMIT,'files':files,'buildInfoBytes':len(info),'buildInfoSha256':audit.sha(info)}}
        served={'sourceCommit':COMMIT,'sourceTree':TREE,'allHTTPFilesVerified':True,'files':[dict(row,status=200) for row in files]+[{'path':'build-info.json','bytes':len(info),'sha256':audit.sha(info),'status':200}]}
        return manifest,binding,served,info

    def test_every_served_body_source_and_metadata_must_match(self):
        for mode in ['good','source','tree','input-count','input-digest','inputs','package-commit','package-file','info-hash','HTTP404','HTTPfilemissing','HTTPsha','HTTPfalse']:
            manifest,binding,served,info=self.http_fixture()
            if mode=='source':binding['source']['commit']=audit.BASE
            if mode=='tree':binding['source']['tree']='0'*40
            if mode=='input-count':binding['source']['sourceInputFiles']=2
            if mode=='input-digest':binding['source']['sourceInputsSha256']='0'*64
            if mode=='inputs':binding['sourceInputs']=[]
            if mode=='package-commit':binding['package']['commit']=audit.BASE
            if mode=='package-file':binding['package']['files']=[]
            if mode=='info-hash':binding['package']['buildInfoSha256']='0'*64
            if mode=='HTTP404':served['files'][0]['status']=404
            if mode=='HTTPfilemissing':served['files'].pop()
            if mode=='HTTPsha':served['files'][0]['sha256']='0'*64
            if mode=='HTTPfalse':served['allHTTPFilesVerified']=False
            (self.root/'served-package.json').write_text(json.dumps(served))
            if mode=='good':audit.check_http_binding(self.root,binding,manifest,info,COMMIT,TREE)
            else:
                with self.subTest(mode=mode),self.assertRaises(AssertionError):audit.check_http_binding(self.root,binding,manifest,info,COMMIT,TREE)

    def test_historical_accepted_looking_forgery_is_rejected_before_use(self):
        p=self.root/'forged-root.json';p.write_text(json.dumps({'sourceAccepted':True,'publicationAccepted':False,'sourceCommit':audit.BASE}))
        with self.assertRaisesRegex(AssertionError,'historical Root receipt'):audit.historical_media_compatibility(self.root,COMMIT,p,self.root)

@unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'),'Actual media tools required')
class ActualDecoderBoundaries(unittest.TestCase):
    """Small real H264 fixtures test decoding; no game evidence or receipts."""
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory();cls.root=pathlib.Path(cls.temp.name)
        cls.movie=cls.root/'test-pattern.mp4';cls.blank=cls.root/'blank.mp4'
        for target,input_filter in [(cls.movie,'testsrc2=size=640x360:rate=12'),(cls.blank,'color=black:size=640x360:rate=12')]:
            subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-f','lavfi','-i',input_filter,'-frames:v','6','-c:v','libx264','-pix_fmt','yuv420p',str(target)],check=True)

    @classmethod
    def tearDownClass(cls):cls.temp.cleanup()

    def test_all_actual_frames_are_counted_and_decoded_at12fps(self):
        metadata=audit.movie_probe_and_decode(self.movie,6,12,640,360)
        self.assertEqual(metadata['streams'][0]['nb_read_frames'],'6')

    def test_wrong_count_cadence_dimensions_and_blank_actual_movie_rejected(self):
        for args in [(self.movie,5,12,640,360),(self.movie,6,4,640,360),(self.movie,6,12,960,540),(self.blank,6,12,640,360)]:
            with self.subTest(args=args),self.assertRaises(AssertionError):audit.movie_probe_and_decode(*args)

    def test_retained_keyframe_must_equal_its_actual_decoded_frame(self):
        key=self.root/'key.png'
        subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(self.movie),'-vf','select=eq(n\\,2)','-vsync','0','-frames:v','1','-pix_fmt','rgb24',str(key)],check=True)
        audit.verify_decoded_keyframe(self.movie,key,2)
        with self.assertRaises(AssertionError):audit.verify_decoded_keyframe(self.movie,key,5)
        with Image.open(key) as im:
            changed=im.convert('RGB');old=changed.getpixel((0,0));changed.putpixel((0,0),tuple((v+127)%256 for v in old));changed.save(key)
        with self.assertRaises(AssertionError):audit.verify_decoded_keyframe(self.movie,key,2)

    def test_truncated_real_mp4_cannot_pass_count_or_decode(self):
        target=self.root/'truncated.mp4';data=self.movie.read_bytes();target.write_bytes(data[:len(data)//2])
        with self.assertRaises((subprocess.CalledProcessError,AssertionError,KeyError,ValueError)):audit.movie_probe_and_decode(target,6,12,640,360)

if __name__=='__main__':unittest.main()

