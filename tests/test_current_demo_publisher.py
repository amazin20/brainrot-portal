import importlib.util,tempfile,os,pathlib,unittest
SCRIPT=pathlib.Path(__file__).resolve().parents[1]/'scripts/current-demo/site.py'
class PublisherSafety(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.old=os.getcwd();os.chdir(self.temp.name)
  spec=importlib.util.spec_from_file_location('current_demo_site_test',SCRIPT);self.m=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.m)
  self.saved={k:os.environ.get(k) for k in ['SOURCE_COMMIT','SOURCE_RUN','GITHUB_RUN_ID','GITHUB_SHA']}
  os.environ.update(SOURCE_COMMIT='a'*40,SOURCE_RUN='123',GITHUB_RUN_ID='456',GITHUB_SHA='b'*40)
 def tearDown(self):
  for k,v in self.saved.items():
   if v is None:os.environ.pop(k,None)
   else:os.environ[k]=v
  os.chdir(self.old);self.temp.cleanup()
 def put(self,name,value):
  p=pathlib.Path(name);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(value if isinstance(value,bytes) else value.encode())
 def seed(self):
  self.put('pages/campaign-v67/index.html','old game');self.put('pages/campaign-v67/assets/old.js','old code');self.put('pages/walkthroughs/recording.mp4',b'old media');self.put('pages/index.html','old root')
  self.m.write('proof/preserved-files.json',self.m.records(pathlib.Path('pages')))
  self.put('candidate/index.html','new game');self.put('candidate/assets/new.js','new code')
  self.m.write('candidate/build-info.json',{'commit':'a'*40,'levels':51,'status':'development-demo','verified':False})
  self.m.write('candidate/demo-manifest.json',{'commit':'a'*40,'runId':'123','files':self.m.records(pathlib.Path('candidate'))})
 def test_paths(self):
  for name in ['../a','/x','a/../../b','a\\b','a//b']:
   with self.assertRaises(ValueError):self.m.safe(name)
 def test_archive_and_history_survive(self):
  self.seed();self.m.assemble()
  self.assertEqual(pathlib.Path('pages/walkthroughs/recording.mp4').read_bytes(),b'old media')
  self.assertEqual(pathlib.Path('pages/archive/campaign-v67-20261022/index.html').read_text(),'old game')
  self.assertEqual(pathlib.Path('pages/campaign-v67/index.html').read_text(),'new game')
  self.assertEqual(pathlib.Path('pages/campaign-v67/assets/old.js').read_text(),'old code')
  self.assertEqual(self.m.read('pages/build-info.json')['commit'],'a'*40)
  receipt=self.m.read('pages/demo-publication.json');self.assertFalse(receipt['fullCampaignAccepted']);self.assertFalse(receipt['yandexPublished'])
 def test_tampered_bundle_rejected(self):
  self.seed();self.put('candidate/assets/new.js','tampered')
  with self.assertRaises(AssertionError):self.m.verify_package()
 def test_unlisted_file_rejected(self):
  self.seed();self.put('candidate/CNAME','unlisted.invalid')
  with self.assertRaises(AssertionError):self.m.verify_package()
 def test_stale_source_rejected(self):
  self.seed();os.environ['SOURCE_COMMIT']='c'*40
  with self.assertRaises(AssertionError):self.m.verify_package()
 def test_overlapping_publication_rejected(self):
  self.m.write('proof/before.json',{'kind':'continuous-demo','receiptSha256':self.m.digest(b'old')});self.m.get=lambda *args,**kwargs:b'new'
  with self.assertRaises(AssertionError):self.m.gate()
if __name__=='__main__':unittest.main()"}