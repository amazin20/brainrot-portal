import copy
import importlib.util
import pathlib
import subprocess
import tempfile
import unittest
from contextlib import chdir
from unittest.mock import patch

path=pathlib.Path(__file__).with_name('publish-mobile-v64.py')
spec=importlib.util.spec_from_file_location('publisher_v64_test_target',path)
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)

def row(name,value=b'x'):
    return {'path':name,'bytes':len(value),'sha256':p.sha(value)}

class AppendTests(unittest.TestCase):
    def setUp(self):
        self.old=[row('index.html'),row('old/movie.mp4')]
        self.union=sorted(self.old+[row('campaign-v64/index.html')],key=lambda r:r['path'])
    def test_all_old_bytes_preserved(self):
        self.assertEqual(p.validate_append(self.old,self.union),[row('campaign-v64/index.html')])
    def test_delete_is_rejected(self):
        with self.assertRaises(ValueError):p.validate_append(self.old,[r for r in self.union if r['path']!='old/movie.mp4'])
    def test_overwrite_is_rejected(self):
        changed=[row(r['path'],b'changed') if r['path']=='index.html' else r for r in self.union]
        with self.assertRaises(ValueError):p.validate_append(self.old,changed)
    def test_append_outside_candidate_is_rejected(self):
        with self.assertRaises(ValueError):p.validate_append(self.old,sorted(self.union+[row('new-root.html')],key=lambda r:r['path']))
    def test_before_uses_exact_prepared_http_summary(self):
        expected={'files':len(self.old),'bytes':sum(r['bytes'] for r in self.old),'inventorySha256':p.sha(p.encoded(self.old)),
            'method':'complete HTTP GET, exact length and SHA-256 for every file'}
        self.assertEqual(p.prepared_baseline({'baseline':expected},self.old),expected)
    def test_before_rejects_changed_prepared_inventory(self):
        wrong={'files':len(self.old),'bytes':sum(r['bytes'] for r in self.old),'inventorySha256':'0'*64,
            'method':'complete HTTP GET, exact length and SHA-256 for every file'}
        with self.assertRaises(ValueError):p.prepared_baseline({'baseline':wrong},self.old)

class ProviderTests(unittest.TestCase):
    def setUp(self):
        self.c={'sourceRun':123,'sourceAttempt':1,'sourceCommit':'a'*40,'sourceBranch':'upgrade/mobile-controls-20261021',
            'sourceWorkflow':'.github/workflows/mobile-controls-v64-review.yml','expectedJobs':['job'+str(i) for i in range(26)],'sourceArtifacts':[]}
        self.run={'id':123,'head_sha':'a'*40,'head_branch':self.c['sourceBranch'],'path':self.c['sourceWorkflow'],'run_attempt':1,'status':'completed','conclusion':'success'}
        self.jobs=[{'id':i+1,'name':name,'head_sha':'a'*40,'run_id':123,'run_attempt':1,'status':'completed','conclusion':'success'} for i,name in enumerate(self.c['expectedJobs'])]
        self.artifacts=[{'id':i+1,'name':'artifact'+str(i),'size_in_bytes':2,'digest':'sha256:'+'b'*64,'expired':False,'workflow_run':{'id':123,'head_sha':'a'*40}} for i in range(29)]
        self.c['sourceArtifacts']=[{k:a[k] for k in ['id','name','size_in_bytes','digest']} for a in self.artifacts]
    def call(self):
        with patch.object(p,'api',return_value=self.run),patch.object(p,'pages',side_effect=[self.jobs,self.artifacts]):return p.source_provider(self.c)
    def test_exact_success_provider_passes(self):self.assertEqual(self.call()['run'],self.run)
    def test_other_source_commit_rejected(self):
        self.run['head_sha']='c'*40
        with self.assertRaises(ValueError):self.call()
    def test_failed_actual_job_rejected(self):
        self.jobs[0]['conclusion']='failure'
        with self.assertRaises(ValueError):self.call()
    def test_missing_actual_job_rejected(self):
        self.jobs.pop()
        with self.assertRaises(ValueError):self.call()
    def test_expired_artifact_rejected(self):
        self.artifacts[0]['expired']=True
        with self.assertRaises(ValueError):self.call()
    def test_other_artifact_digest_rejected(self):
        self.artifacts[0]['digest']='sha256:'+'d'*64
        with self.assertRaises(ValueError):self.call()

class FreshOutputTests(unittest.TestCase):
    def test_actual_tracked_provider_inputs_do_not_block_or_change(self):
        repository=path.resolve().parent.parent
        tracked=subprocess.check_output(['git','ls-files','--','provider'],cwd=repository,encoding='utf8').splitlines()
        self.assertTrue(tracked,'This regression must exercise Main\'s real tracked provider inputs')
        before={filename:(repository/filename).read_bytes() for filename in tracked}
        class StopBeforeNetwork(Exception):pass
        with chdir(repository),patch.object(p,'baseline',side_effect=StopBeforeNetwork) as downstream:
            with self.assertRaises(StopBeforeNetwork):p.preparation({})
        downstream.assert_called_once_with({})
        self.assertEqual({filename:(repository/filename).read_bytes() for filename in tracked},before)
        self.assertFalse((repository/p.SOURCE_OUTPUT).exists())
        self.assertFalse((repository/'pages').exists())
        self.assertFalse((repository/'proof').exists())

    def test_existing_v64_output_is_rejected_without_deleting_marker(self):
        with tempfile.TemporaryDirectory() as directory,chdir(directory):
            p.SOURCE_OUTPUT.mkdir();marker=p.SOURCE_OUTPUT/'retained.json';marker.write_bytes(b'keep this output')
            with patch.object(p,'baseline') as downstream:
                with self.assertRaisesRegex(ValueError,'Fresh publisher output required'):p.preparation({})
            downstream.assert_not_called();self.assertEqual(marker.read_bytes(),b'keep this output')

    def test_pages_and_proof_still_require_fresh_paths(self):
        for name in ['pages','proof']:
            with self.subTest(name=name),tempfile.TemporaryDirectory() as directory,chdir(directory):
                folder=pathlib.Path(name);folder.mkdir();marker=folder/'retained.json';marker.write_bytes(b'keep original')
                with self.assertRaisesRegex(ValueError,'Fresh publisher output required'):p.require_fresh_outputs()
                self.assertEqual(marker.read_bytes(),b'keep original')

    def test_source_archive_download_uses_isolated_output(self):
        pin={'id':123,'name':'v64-dist','size_in_bytes':2,'digest':'sha256:'+'b'*64}
        with tempfile.TemporaryDirectory() as directory,chdir(directory),patch.object(p,'get') as download,patch.object(p,'safe_extract',return_value=[]) as extract,patch.object(pathlib.Path,'read_bytes',return_value=b'zip'):
            result=p.artifact({},pin)
        self.assertEqual(download.call_args.kwargs['destination'],p.SOURCE_OUTPUT/'123.zip')
        extract.assert_called_once_with(p.SOURCE_OUTPUT/'123.zip',p.SOURCE_OUTPUT/'v64-dist',100_000_000)
        self.assertEqual(result['folder'],str(p.SOURCE_OUTPUT/'v64-dist'))

if __name__=='__main__':unittest.main()
