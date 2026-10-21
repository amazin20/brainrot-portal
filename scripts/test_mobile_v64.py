import copy
import importlib.util
import pathlib
import unittest
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

if __name__=='__main__':unittest.main()
