import hashlib, importlib.util, io, json, pathlib, tempfile, unittest

spec=importlib.util.spec_from_file_location('restore',pathlib.Path(__file__).with_name('restore-campaign-v56-baseline.py'))
restore=importlib.util.module_from_spec(spec);spec.loader.exec_module(restore)

class Response(io.BytesIO):
    status=200
    def __init__(self,data,url):super().__init__(data);self.url=url;self.headers={'Content-Length':str(len(data))}
    def geturl(self):return self.url

class RestoreTests(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory();self.output=pathlib.Path(self.temporary.name)/'baseline'
        self.data=b'preserved exact old page\n'
        self.rows=[{'path':'old/index.html','bytes':len(self.data),'sha256':hashlib.sha256(self.data).hexdigest()}]
        self.previous=restore.publisher.BASELINE
        restore.publisher.BASELINE={'files':1,'bytes':len(self.data),'inventorySha256':restore.publisher.inventory_sha256(self.rows)}
        self.pins=json.loads(pathlib.Path('tools/campaign-v56-release.json').read_text());self.pins['baseline'].update(restore.publisher.BASELINE)
        self.manifest={'siteFiles':self.rows,'siteFilesSha256':restore.publisher.inventory_sha256(self.rows)}
        self.sleep=restore.time.sleep;restore.time.sleep=lambda _:None
    def tearDown(self):restore.publisher.BASELINE=self.previous;restore.time.sleep=self.sleep;self.temporary.cleanup()
    def test_exact_old_bytes_restored(self):
        result=restore.restore(self.manifest,self.output,self.pins,opener=lambda request,timeout:Response(self.data,request.full_url))
        self.assertTrue(result['pass']);self.assertEqual((self.output/'old/index.html').read_bytes(),self.data)
    def test_changed_public_bytes_never_become_baseline(self):
        with self.assertRaises(ValueError):restore.restore(self.manifest,self.output,self.pins,opener=lambda request,timeout:Response(self.data[:-1]+b'!',request.full_url))
        self.assertFalse(self.output.exists())
    def test_existing_baseline_never_overwritten(self):
        self.output.mkdir();(self.output/'retained').write_text('keep')
        with self.assertRaises(ValueError):restore.restore(self.manifest,self.output,self.pins,opener=lambda *args:None)
        self.assertEqual((self.output/'retained').read_text(),'keep')

if __name__=='__main__':unittest.main()
