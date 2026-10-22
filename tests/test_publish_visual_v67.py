"""Offline safety tests only. Synthetic tar/lease fixtures are not CI evidence."""
import hashlib
import importlib.util
import io
import json
import os
import pathlib
import shutil
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch
from PIL import Image, ImageDraw, ImageStat

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('v67_draft_under_test', ROOT/'scripts/publish-visual-v67.py')
controller = importlib.util.module_from_spec(spec); spec.loader.exec_module(controller)


def row(name, data):
    return {'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def archive(path, members):
    with tarfile.open(path, 'w') as tar:
        for name, data, kind in members:
            item = tarfile.TarInfo(name)
            item.type = kind
            if kind == tarfile.REGTYPE: item.size = len(data); tar.addfile(item, io.BytesIO(data))
            else: item.linkname = 'index.html'; tar.addfile(item)


class SafetyTests(unittest.TestCase):
    def assembly_fixture(self, root, files):
        source, site = root/'candidate', root/'pages'; source.mkdir(); site.mkdir()
        for name, data in files.items():
            path = source/name; path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(data)
        (site/'index.html').write_bytes(b'original root')
        (site/'old.js').write_bytes(b'original historical script')
        return source, site, controller.inventory(source), controller.inventory(site)

    def test_candidate_cannot_occupy_reserved_publisher_paths_before_any_copy(self):
        for reserved in ['release/provenance.json', 'release/history/root-index-before-v67.html', 'release', 'release/provenance.json/child']:
            with self.subTest(reserved=reserved), tempfile.TemporaryDirectory() as temp:
                root = pathlib.Path(temp)
                source, site, candidate, prior = self.assembly_fixture(root, {'index.html': b'accepted game', reserved: b'accepted source bytes'})
                with self.assertRaisesRegex(ValueError, 'reserved publisher'):
                    controller.assemble_candidate(source, candidate, prior, {'offlineFixture': True}, site)
                self.assertEqual(controller.inventory(site), prior)
                self.assertFalse((site/controller.PREFIX).exists())

    def test_full_candidate_inventory_is_rechecked_after_metadata_writes(self):
        for mutation in ['same-length-change', 'delete-file', 'unaccepted-extra-file']:
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as temp:
                root = pathlib.Path(temp)
                source, site, candidate, prior = self.assembly_fixture(root, {'index.html': b'game', 'assets/game.js': b'ACCEPTED'})
                original = controller.write_reserved_json
                def corrupt_after_metadata(path, value):
                    original(path, value)
                    target = site/controller.PREFIX/'assets/game.js'
                    if mutation == 'same-length-change': target.write_bytes(b'REPLACED')
                    elif mutation == 'delete-file': target.unlink()
                    else: (site/controller.PREFIX/'injected.js').write_bytes(b'unaccepted')
                with patch.object(controller, 'write_reserved_json', side_effect=corrupt_after_metadata):
                    with self.assertRaisesRegex(ValueError, 'candidate bytes changed|Unexpected publisher path'):
                        controller.assemble_candidate(source, candidate, prior, {'offlineFixture': True}, site)

    def test_successful_local_union_preserves_every_candidate_and_historical_byte(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            source, site, candidate, prior = self.assembly_fixture(root, {'index.html': b'new game', 'assets/game.js': b'exact game script'})
            union, additions, retained = controller.assemble_candidate(source, candidate, prior, {'offlineFixture': True}, site)
            self.assertEqual(retained['files'], len(candidate)); self.assertEqual(retained['inventorySha256'], controller.sha(controller.encoded(candidate)))
            for record in candidate:
                self.assertEqual(row(controller.PREFIX+record['path'], (site/controller.PREFIX/record['path']).read_bytes()), {**record, 'path': controller.PREFIX+record['path']})
            self.assertEqual((site/'old.js').read_bytes(), b'original historical script')
            self.assertEqual((site/controller.HISTORICAL_ROOT).read_bytes(), b'original root')
            self.assertEqual(controller.validate_candidate_union(candidate, union), retained)

    def test_varied_html_hud_cannot_hide_a_blank_actual_game_canvas(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp); blank = root/'blank-canvas.png'; hud = root/'varied-hud.png'
            Image.new('RGB', (1280, 720), '#101c28').save(blank)
            image = Image.new('RGB', (1280, 720), '#101c28'); draw = ImageDraw.Draw(image)
            for x in range(0, 1280, 80):
                draw.rectangle((x, 180, x+60, 540), fill=(x%255, (x*3)%255, (x*7)%255))
            draw.text((20, 20), 'SYNTHETIC VARIED HTML HUD OVER BLANK WEBGL', fill='white'); image.save(hud)
            # The previous whole-viewport metric passes this exact fixture.
            sample = image.resize((64, 36)); self.assertGreaterEqual(len(sample.getcolors(2305)), 4)
            self.assertGreater(max(ImageStat.Stat(sample).stddev), 1)
            code = """import fs from 'node:fs';
const {validateGameCanvasPixels,captureActualGameCanvas}=await import(process.argv[1]);
validateGameCanvasPixels(process.argv[2]); // even varied central HTML is insufficient
const data='data:image/png;base64,'+fs.readFileSync(process.argv[3]).toString('base64');
await captureActualGameCanvas({evaluate:async()=>({data,width:1280,height:720})},process.argv[4]);"""
            result = subprocess.run(['node', '--input-type=module', '-e', code,
                (ROOT/'scripts/observe-visual-v67-public.mjs').as_uri(), str(hud), str(blank), str(root/'actual-game-canvas.png')], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0); self.assertIn('Blank or invalid actual game canvas', result.stderr)
            self.assertTrue((root/'actual-game-canvas.png.invalid').is_file())

    def test_nonblank_canvas_pixel_fixture_is_accepted_without_browser_or_html(self):
        with tempfile.TemporaryDirectory() as temp:
            target = pathlib.Path(temp)/'synthetic-canvas.png'; image = Image.new('RGB', (320, 180)); draw = ImageDraw.Draw(image)
            for x in range(320): draw.line((x, 0, x, 179), fill=(x%255, (x*2)%255, (x*3)%255))
            image.save(target)
            code = "const {validateGameCanvasPixels}=await import(process.argv[1]);console.log(JSON.stringify(validateGameCanvasPixels(process.argv[2])));"
            result = subprocess.run(['node', '--input-type=module', '-e', code,
                (ROOT/'scripts/observe-visual-v67-public.mjs').as_uri(), str(target)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr); pixels = json.loads(result.stdout)
            self.assertGreaterEqual(pixels['central']['colors'], 16); self.assertGreaterEqual(pixels['central']['opaqueFraction'], .98)

    def test_template_is_deliberately_unpublishable_and_has_no_invented_source_run(self):
        template = ROOT/'tools/campaign-v67-release.template.json'
        value = json.loads(template.read_text())
        self.assertFalse(value['frozen']); self.assertIsNone(value['sourceRun']); self.assertIsNone(value['sourceCommit'])
        self.assertEqual(value['sourceArtifacts'], [])
        with patch.object(controller, 'CONFIG', str(template)):
            with self.assertRaisesRegex(ValueError, 'Draft/incomplete'): controller.config()

    def test_safe_tar_restores_complete_exact_historical_bytes(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp); data = [('index.html', b'original entry'), ('assets/a.bin', b'original asset')]
            expected = sorted([row(n, b) for n, b in data], key=lambda r: r['path'])
            archive(root/'artifact.tar', [('./'+n, b, tarfile.REGTYPE) for n, b in data])
            result = controller.safe_pages_tar(root/'artifact.tar', root/'pages', expected)
            self.assertEqual(result['files'], 2); self.assertEqual((root/'pages/index.html').read_bytes(), b'original entry')
            with self.assertRaisesRegex(ValueError, 'fresh'):
                controller.safe_pages_tar(root/'artifact.tar', root/'pages', expected)

    def test_tar_rejects_traversal_links_duplicates_and_unexpected_files(self):
        expected = [row('index.html', b'old')]
        cases = [
            [('index.html', b'old', tarfile.REGTYPE), ('../escape', b'bad', tarfile.REGTYPE)],
            [('index.html', b'old', tarfile.REGTYPE), ('link', b'', tarfile.SYMTYPE)],
            [('index.html', b'old', tarfile.REGTYPE), ('hard', b'', tarfile.LNKTYPE)],
            [('index.html', b'old', tarfile.REGTYPE), ('./index.html', b'old', tarfile.REGTYPE)],
            [('index.html', b'old', tarfile.REGTYPE), ('new.js', b'new', tarfile.REGTYPE)],
        ]
        for members in cases:
            with self.subTest(members=members), tempfile.TemporaryDirectory() as temp:
                root = pathlib.Path(temp); archive(root/'artifact.tar', members)
                with self.assertRaises(ValueError): controller.safe_pages_tar(root/'artifact.tar', root/'pages', expected)

    def test_tar_rejects_same_length_changed_bytes(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp); archive(root/'artifact.tar', [('index.html', b'NEW', tarfile.REGTYPE)])
            with self.assertRaisesRegex(ValueError, 'not the accepted inventory'):
                controller.safe_pages_tar(root/'artifact.tar', root/'pages', [row('index.html', b'OLD')])

    def test_only_root_redirect_may_change_and_original_entry_must_be_retained(self):
        redirect = controller.redirect_bytes(); prior = [row('assets/a.bin', b'old asset'), row('index.html', b'old entry')]
        union = sorted([prior[0], row('index.html', redirect), row(controller.HISTORICAL_ROOT, b'old entry'), row('campaign-v67/index.html', b'new game')], key=lambda r: r['path'])
        self.assertEqual(len(controller.validate_union(prior, union, redirect)), 2)
        for mutated in [
            [r for r in union if r['path'] != controller.HISTORICAL_ROOT],
            sorted([row('assets/a.bin', b'changed') if r['path']=='assets/a.bin' else r for r in union], key=lambda r: r['path']),
            sorted(union + [row('unexpected.txt', b'new')], key=lambda r: r['path']),
        ]:
            with self.assertRaises(ValueError): controller.validate_union(prior, mutated, redirect)
        self.assertIn(b'target.search=location.search', redirect)
        self.assertIn(b'target.hash=location.hash', redirect)

    def test_exact_accepted_v66_baseline_catalog_and_receipt_match(self):
        c = json.loads((ROOT/'tools/campaign-v67-release.template.json').read_text())
        rows = controller.accepted_baseline(c)
        self.assertEqual(len(rows), 2854)
        self.assertEqual(sum(r['bytes'] for r in rows), 717359694)
        self.assertEqual(controller.sha(controller.encoded(rows)), '4366e6b1ef5dad5008e9e208807721cfd6e2513632e2ef39edee6a685741a658')
        for key in ['baselineCatalogSha256', 'baselineAcceptanceSha256']:
            bad = {**c, key: '0'*64}
            with self.subTest(pin=key), self.assertRaisesRegex(ValueError, 'changed'):
                controller.accepted_baseline(bad)

    def test_lease_rejects_a_concurrent_main_or_deployment(self):
        c = json.loads((ROOT/'tools/campaign-v67-release.template.json').read_text())
        c.update(controllerParent='a'*40, sourceCommit='b'*40, sourceTree='c'*40)
        environment = {'GITHUB_REPOSITORY': 'amazin20/brainrot-portal', 'GITHUB_REF': 'refs/heads/main',
            'GITHUB_SHA': 'd'*40, 'GITHUB_RUN_ID': 'offline-fixture', 'GITHUB_RUN_ATTEMPT': 'offline-fixture'}
        def api(endpoint):
            if endpoint == 'git/ref/heads/main': return {'object': {'sha': 'd'*40}}
            if endpoint == 'git/commits/'+'d'*40: return {'parents': [{'sha': 'a'*40}]}
            if endpoint == 'git/ref/heads/'+c['sourceBranch']: return {'object': {'sha': 'b'*40}}
            if endpoint == 'git/commits/'+'b'*40: return {'tree': {'sha': 'c'*40}}
            self.fail('Unexpected fixture API endpoint: '+endpoint)
        deployment = {**c['baselineDeployment']}
        def pages(endpoint):
            return [deployment] if endpoint.startswith('deployments?') else [{'state': 'success'}]
        with patch.dict(os.environ, environment), patch.object(controller, 'api', side_effect=api), patch.object(controller, 'pages', side_effect=pages):
            self.assertEqual(controller.lease(c)['deployment'], deployment)
            deployment['id'] += 1
            with self.assertRaisesRegex(ValueError, 'deployment lease changed'): controller.lease(c)
        with patch.dict(os.environ, environment), patch.object(controller, 'api', return_value={'object': {'sha': 'e'*40}}):
            with self.assertRaisesRegex(ValueError, 'Main lease changed'): controller.lease(c)


if __name__ == '__main__': unittest.main()
