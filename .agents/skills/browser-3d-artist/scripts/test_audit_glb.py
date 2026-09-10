#!/usr/bin/env python3
"""Regression tests for the limited inspector; not tests of a game asset."""
from __future__ import annotations

import copy
import json
import struct
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from audit_glb import BIN_CHUNK, JSON_CHUNK, audit

BASE = {
    'asset': {'version': '2.0'},
    'buffers': [{'byteLength': 36}],
    'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': 36}],
    'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': 3,
                   'type': 'VEC3', 'min': [0, 0, 0], 'max': [1, 1, 0]}],
    'meshes': [{'primitives': [{'attributes': {'POSITION': 0}}]}],
    'nodes': [{'mesh': 0}], 'scenes': [{'nodes': [0]}], 'scene': 0,
}


def make_glb(doc: dict | None = None) -> bytes:
    text = json.dumps(BASE if doc is None else doc, separators=(',', ':')).encode()
    text += b' ' * ((-len(text)) % 4)
    binary = struct.pack('<9f', 0, 0, 0, 1, 0, 0, 0, 1, 0)
    chunks = struct.pack('<II', len(text), JSON_CHUNK) + text
    chunks += struct.pack('<II', len(binary), BIN_CHUNK) + binary
    return struct.pack('<4sII', b'glTF', 2, 12 + len(chunks)) + chunks


class InspectorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.asset = self.root / 'fixture.glb'
        self.asset.write_bytes(make_glb())

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_valid_fixture(self) -> None:
        result = audit(self.asset)
        self.assertEqual(result['inspection_status'], 'pass')
        self.assertEqual(result['declared_geometry']['triangles_sum_over_mesh_primitives'], 1)
        self.assertIsNone(result['production_ready'])
        self.assertEqual(len(result['main_glb']['sha256']), 64)

    def test_exact_size_budget(self) -> None:
        self.assertTrue(audit(self.asset, max_bytes=self.asset.stat().st_size)['within_budget'])

    def test_one_byte_over_budget(self) -> None:
        result = audit(self.asset, max_bytes=self.asset.stat().st_size - 1)
        self.assertEqual(result['inspection_status'], 'fail')
        self.assertFalse(result['within_budget'])

    def test_companions_counted_once(self) -> None:
        other = self.root / 'texture.ktx2'
        other.write_bytes(b'x' * 100)
        result = audit(self.asset, [other, other, self.asset])
        self.assertEqual(result['total_runtime_bytes'], self.asset.stat().st_size + 100)
        self.assertEqual(len(result['runtime_files']), 2)

    def test_external_image_rejected(self) -> None:
        doc = copy.deepcopy(BASE)
        doc['images'] = [{'uri': 'hidden-texture.png'}]
        self.asset.write_bytes(make_glb(doc))
        self.assertIn('external resource', audit(self.asset)['errors'][0])

    def test_data_uri_not_fetched_or_decoded(self) -> None:
        doc = copy.deepcopy(BASE)
        doc['images'] = [{'uri': 'data:image/png;base64,AAAA'}]
        self.asset.write_bytes(make_glb(doc))
        result = audit(self.asset)
        self.assertEqual(result['inspection_status'], 'pass')
        self.assertIsNone(result['production_ready'])

    def test_corrupt_length(self) -> None:
        self.asset.write_bytes(self.asset.read_bytes()[:-1])
        self.assertEqual(audit(self.asset)['inspection_status'], 'fail')

    def test_wrong_magic(self) -> None:
        self.asset.write_bytes(b'NOPE' + self.asset.read_bytes()[4:])
        self.assertEqual(audit(self.asset)['inspection_status'], 'fail')

    def test_accessor_index_out_of_range(self) -> None:
        doc = copy.deepcopy(BASE)
        doc['meshes'][0]['primitives'][0]['attributes']['POSITION'] = 25
        self.asset.write_bytes(make_glb(doc))
        self.assertIn('out of range', audit(self.asset)['errors'][0])

    def test_buffer_view_bounds(self) -> None:
        doc = copy.deepcopy(BASE)
        doc['bufferViews'][0]['byteLength'] = 40
        self.asset.write_bytes(make_glb(doc))
        self.assertIn('exceeds', audit(self.asset)['errors'][0])

    def test_required_extension_not_claimed_supported(self) -> None:
        doc = copy.deepcopy(BASE)
        doc['extensionsRequired'] = ['EXT_meshopt_compression']
        self.asset.write_bytes(make_glb(doc))
        result = audit(self.asset)
        self.assertIn('EXT_meshopt_compression', result['required_extensions'])
        self.assertTrue(result['warnings'])
        self.assertIsNone(result['production_ready'])

    def test_malformed_array_controlled_failure(self) -> None:
        doc = copy.deepcopy(BASE)
        doc['meshes'] = 'wrong'
        self.asset.write_bytes(make_glb(doc))
        self.assertIn('array of objects', audit(self.asset)['errors'][0])

    def test_meshopt_placeholder_metadata_without_decoding(self) -> None:
        doc = copy.deepcopy(BASE)
        doc['extensionsRequired'] = ['EXT_meshopt_compression']
        doc['buffers'].append({'byteLength': 36})
        doc['bufferViews'][0]['buffer'] = 1
        doc['bufferViews'][0]['extensions'] = {'EXT_meshopt_compression': {
            'buffer': 0, 'byteLength': 36, 'byteStride': 12, 'count': 3, 'mode': 'ATTRIBUTES'}}
        self.asset.write_bytes(make_glb(doc))
        result = audit(self.asset)
        self.assertEqual(result['inspection_status'], 'pass')
        self.assertTrue(any('not decoded' in w for w in result['warnings']))
        self.assertIsNone(result['production_ready'])

    def test_meshopt_range_checked_without_decoding(self) -> None:
        doc = copy.deepcopy(BASE)
        doc['extensionsRequired'] = ['EXT_meshopt_compression']
        doc['buffers'].append({'byteLength': 36})
        doc['bufferViews'][0]['buffer'] = 1
        doc['bufferViews'][0]['extensions'] = {'EXT_meshopt_compression': {
            'buffer': 0, 'byteLength': 40, 'byteStride': 12, 'count': 3, 'mode': 'ATTRIBUTES'}}
        self.asset.write_bytes(make_glb(doc))
        self.assertIn('compressed range exceeds', audit(self.asset)['errors'][0])

    def test_cli_writes_json(self) -> None:
        out = self.root / 'report.json'
        process = subprocess.run([sys.executable, str(Path(__file__).with_name('audit_glb.py')),
                                  str(self.asset), '--out', str(out)], capture_output=True, text=True)
        self.assertEqual(process.returncode, 0, process.stdout + process.stderr)
        self.assertEqual(json.loads(out.read_text())['inspection_status'], 'pass')

    def test_cli_does_not_overwrite_input(self) -> None:
        before = self.asset.read_bytes()
        process = subprocess.run([sys.executable, str(Path(__file__).with_name('audit_glb.py')),
                                  str(self.asset), '--out', str(self.asset)], capture_output=True, text=True)
        self.assertEqual(process.returncode, 1)
        self.assertEqual(before, self.asset.read_bytes())

    def test_cli_missing_input(self) -> None:
        process = subprocess.run([sys.executable, str(Path(__file__).with_name('audit_glb.py')),
                                  str(self.root / 'missing.glb')], capture_output=True, text=True)
        self.assertEqual(process.returncode, 1)
        self.assertEqual(json.loads(process.stdout)['inspection_status'], 'fail')


if __name__ == '__main__':
    unittest.main(verbosity=2)
