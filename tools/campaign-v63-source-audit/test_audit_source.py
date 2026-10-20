"""Synthetic mutation tests for audit mechanics; never Source acceptance."""
import copy
import importlib.util
import json
import os
import pathlib
import tempfile
import unittest
import zipfile

HERE=pathlib.Path(__file__).parent
if not os.environ.get('SOURCE_DIR') or not pathlib.Path(os.environ['SOURCE_DIR']).is_absolute():
    raise RuntimeError('Set SOURCE_DIR to the exact frozen Source Git checkout, independently of Main/auditor location')
SOURCE=pathlib.Path(os.environ['SOURCE_DIR']).resolve()
spec=importlib.util.spec_from_file_location('audit_source',HERE/'audit-source.py')
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
COMMIT='a'*40;TREE='b'*40;PARENT='c'*40

def provider_fixture():
    roles={'build':['v63-dist']}
    run={'id':100,'run_attempt':1,'head_sha':COMMIT,'head_branch':audit.BRANCH,'path':audit.WORKFLOW,'event':'push','workflow_id':200,'workflow_url':f'https://api.github.com/repos/{audit.REPOSITORY}/actions/workflows/200','repository':{'full_name':audit.REPOSITORY,'id':300},'status':'completed','conclusion':'success'}
    jobs=[{'id':400,'name':'build','run_id':100,'run_attempt':1,'head_sha':COMMIT,'status':'completed','conclusion':'success','steps':[{'number':1,'name':'Run actions/upload-artifact@v4','status':'completed','conclusion':'success','started_at':'2026-10-20T00:00:00Z','completed_at':'2026-10-20T00:00:10Z'}]}]
    artifacts=[{'id':500,'name':'v63-dist','expired':False,'digest':'sha256:'+'d'*64,'size_in_bytes':1000,'created_at':'2026-10-20T00:00:05Z','workflow_run':{'id':100,'head_sha':COMMIT,'head_branch':audit.BRANCH,'repository_id':300,'head_repository_id':300}}]
    meta={'sha':COMMIT,'tree':{'sha':TREE},'parents':[{'sha':PARENT}]};workflow={'id':200,'path':audit.WORKFLOW,'state':'active'}
    return [run,jobs,artifacts,meta,workflow,COMMIT,TREE,[PARENT],100,1,roles]

class AuditMutations(unittest.TestCase):
    def test_workflow_expands_frozen_current_roles_without_historical_totals(self):
        roles=audit.workflow_roles(SOURCE)
        self.assertEqual(len(roles),44);self.assertEqual(sum(map(len,roles.values())),57)
        self.assertEqual(roles['production-sdk'],['v63-production-sdk'])
        self.assertEqual(roles['films (31)'],['v63-optics-film-31','v63-optics-checker-31'])

    def test_provider_identity_mutations_are_rejected(self):
        original=provider_fixture();audit.validate_provider(*original)
        changes=[lambda x:x[0].update(head_sha='f'*40),lambda x:x[0].update(run_attempt=2),lambda x:x[0].update(event='workflow_dispatch'),
                 lambda x:x[0].update(path='other.yml'),lambda x:x[0].update(head_branch='main'),lambda x:x[4].update(id=201),
                 lambda x:x[4].update(state='disabled_manually'),lambda x:x[0].update(workflow_url='https://example.invalid/fake'),
                 lambda x:x[3]['tree'].update(sha='e'*40),lambda x:x[1][0].update(conclusion='failure'),
                 lambda x:x[1][0]['steps'][0].update(conclusion='skipped'),lambda x:x[2][0].update(expired=True),
                 lambda x:x[2][0]['workflow_run'].update(id=101),lambda x:x[2][0].update(created_at='2026-10-21T00:00:00Z'),
                 lambda x:x[2].append(copy.deepcopy(x[2][0])),lambda x:x[1].clear()]
        for change in changes:
            value=copy.deepcopy(original);change(value)
            with self.subTest(change=change),self.assertRaises(AssertionError):audit.validate_provider(*value)

    def test_workflow_capability_marker_requires_exact_actual_rejection_and_same_run_url(self):
        args=provider_fixture();run=args[0]
        marker={'schemaVersion':1,'kind':'workflow-metadata-get-unavailable','requestedUrl':run['workflow_url'],'tool':'mcp__codex_apps__github_fetch',
                'actualToolResponse':{'content':[{'type':'text','text':audit.WORKFLOW_GET_REJECTION}],
                    'structuredContent':{'error':audit.WORKFLOW_GET_REJECTION,'error_code':'INVALID_ARGUMENT'},'isError':True},
                'sourceWorkflow':{'path':audit.WORKFLOW,'bytes':10,'sha256':'a'*64,'gitBlob':'b'*40},
                'independentWorkflowMetadataGet':False,'workflowDefinitionFromExactSourceTree':True}
        audit.validate_workflow_unavailable(marker,run);args[4]=None;audit.validate_provider(*args,workflow_unavailable=marker)
        for change in [lambda x:x.update(requestedUrl=run['workflow_url']+'0'),lambda x:x.update(independentWorkflowMetadataGet=True),lambda x:x.update(state='active'),
                       lambda x:x['actualToolResponse'].update(isError=False),lambda x:x['actualToolResponse']['structuredContent'].update(error='404 Not Found'),
                       lambda x:x['actualToolResponse']['content'][0].update(text='tool not available'),lambda x:x['sourceWorkflow'].update(path='fake.yml')]:
            value=copy.deepcopy(marker);change(value)
            with self.assertRaises(AssertionError):audit.validate_provider(*args,workflow_unavailable=value)
        with self.assertRaises(AssertionError):audit.validate_provider(*args)

    def test_workflow_capability_fallback_binds_actual_committed_definition_and_never_silently_omits_metadata(self):
        source=SOURCE;commit=audit.git(source,'rev-parse','HEAD');body=(source/audit.WORKFLOW).read_bytes();run=provider_fixture()[0]
        bound={'path':audit.WORKFLOW,'bytes':len(body),'sha256':audit.sha(body),'gitBlob':audit.git(source,'rev-parse',commit+':'+audit.WORKFLOW)}
        marker={'schemaVersion':1,'kind':'workflow-metadata-get-unavailable','requestedUrl':run['workflow_url'],'tool':'mcp__codex_apps__github_fetch',
                'actualToolResponse':{'content':[{'type':'text','text':audit.WORKFLOW_GET_REJECTION}],
                    'structuredContent':{'error':audit.WORKFLOW_GET_REJECTION,'error_code':'INVALID_ARGUMENT'},'isError':True},
                'sourceWorkflow':bound,'independentWorkflowMetadataGet':False,'workflowDefinitionFromExactSourceTree':True}
        with tempfile.TemporaryDirectory() as temp:
            provider=pathlib.Path(temp)
            with self.assertRaises(AssertionError):audit.workflow_record(source,provider,run,commit)
            file=provider/'workflow-metadata-unavailable.json';file.write_text(json.dumps(marker))
            metadata,actual,summary,used=audit.workflow_record(source,provider,run,commit)
            self.assertIsNone(metadata);self.assertEqual(actual,marker);self.assertEqual(used,file)
            self.assertFalse(summary['independentWorkflowMetadataGet']);self.assertTrue(summary['workflowDefinitionFromExactSourceTree']);self.assertEqual(summary['sourceWorkflow'],bound)
            for key,value in [('sha256','e'*64),('bytes',len(body)+1),('gitBlob','f'*40)]:
                altered=copy.deepcopy(marker);altered['sourceWorkflow'][key]=value;file.write_text(json.dumps(altered))
                with self.assertRaises(AssertionError):audit.workflow_record(source,provider,run,commit)
            file.write_text(json.dumps(marker));real=provider/'workflow.json';real.write_text(json.dumps(provider_fixture()[4]))
            with self.assertRaises(AssertionError):audit.workflow_record(source,provider,run,commit)
            file.unlink();metadata,actual,summary,used=audit.workflow_record(source,provider,run,commit)
            self.assertEqual(metadata,provider_fixture()[4]);self.assertIsNone(actual);self.assertTrue(summary['independentWorkflowMetadataGet']);self.assertEqual(used,real)

    def test_upload_ids_names_bytes_digest_and_run_link_bind_to_the_actual_job_log(self):
        args=provider_fixture();mapping=audit.validate_provider(*args)
        line=(COMMIT+'\nSHA256 digest of uploaded artifact zip is '+'d'*64+'\n'
              'Artifact v63-dist has been successfully uploaded! Final size is 1000 bytes. Artifact ID is 500\n'
              f'Artifact download URL: https://github.com/{audit.REPOSITORY}/actions/runs/100/artifacts/500\n')
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp);(root/'logs').mkdir();file=root/'logs/400.log';file.write_text(line)
            audit.validate_logs(root,args[1],args[2],mapping,COMMIT,100)
            alias=root/'logs/0400.log';alias.write_text(line)
            with self.assertRaises(AssertionError):audit.validate_logs(root,args[1],args[2],mapping,COMMIT,100)
            alias.unlink()
            for changed in [line.replace('ID is 500','ID is 501'),line.replace('v63-dist has','v63-fake has'),line.replace('1000 bytes','1001 bytes'),line.replace('d'*64,'e'*64),line.replace('/runs/100/','/runs/101/')]:
                file.write_text(changed)
                with self.assertRaises(AssertionError):audit.validate_logs(root,args[1],args[2],mapping,COMMIT,100)

    def test_provider_pages_require_complete_nonduplicated_total(self):
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp);file=root/'page-001.json';file.write_text('{"total_count":1,"jobs":[{"id":1}]}')
            self.assertEqual(len(audit.pages(root,'jobs')[0]),1)
            for value in ['{"total_count":2,"jobs":[{"id":1}]}','{"total_count":2,"jobs":[{"id":1},{"id":1}]}','{"total_count":1,"total_count":2,"jobs":[{"id":1}]}','{"total_count":1,"jobs":[{"id":1,"unexpected":1e999}]}']:
                file.write_text(value)
                with self.assertRaises(AssertionError):audit.pages(root,'jobs')

    def test_zip_crc_closure_and_safe_paths(self):
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp);archive=root/'1.zip';directory=root/'files';directory.mkdir();(directory/'report.json').write_text('{}')
            with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_STORED) as zipped:zipped.writestr('report.json','{}')
            def pin():return {'id':1,'name':'test','size_in_bytes':archive.stat().st_size,'digest':'sha256:'+audit.file_sha(archive)}
            audit.verified_zip(archive,directory,pin());(directory/'extra').write_text('extra')
            with self.assertRaises(AssertionError):audit.verified_zip(archive,directory,pin())
            (directory/'extra').unlink();(directory/'report.json').write_text('{changed}')
            with self.assertRaises(AssertionError):audit.verified_zip(archive,directory,pin())
            (directory/'report.json').write_text('{}')
            # Change actual payload and update the provider digest: CRC must
            # still reject rather than trusting the new outer SHA alone.
            raw=archive.read_bytes();offset=raw.index(b'{}');archive.write_bytes(raw[:offset]+b'[]'+raw[offset+2:])
            with self.assertRaises(zipfile.BadZipFile):audit.verified_zip(archive,directory,pin())
            for name in ['../outside','/absolute','a\\b','a//b','a/./b']:
                with zipfile.ZipFile(archive,'w') as zipped:zipped.writestr(name,'{}')
                with self.assertRaises(AssertionError):audit.verified_zip(archive,directory,pin())

    def test_tap_rejects_skips_missing_footer_and_raw_stdout_mismatch(self):
        good='TAP version 13\nok 1 - x\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n'
        self.assertEqual(audit.tap_counts(good)['tests'],1)
        audit.stdout_contains(good,'\n'.join('2026-10-20T00:00:00.000Z '+line for line in good.splitlines()))
        for changed in [good.replace('# skipped 0','# skipped 1'),good.replace('# pass 1','# pass 0'),good.replace('# todo 0\n',''),good+'# tests 1\n']:
            with self.assertRaises(AssertionError):audit.tap_counts(changed)
        with self.assertRaises(AssertionError):audit.stdout_contains(good,good.replace('ok 1 - x','ok 1 - y'))

if __name__=='__main__':unittest.main()
