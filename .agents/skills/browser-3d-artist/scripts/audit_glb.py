#!/usr/bin/env python3
"""Preflight a GLB and measure its runtime file budget. Standard library only.

This is NOT a complete glTF validator, decoder, visual test or performance test.
Counts are declared in JSON, not verified by decoding vertex/animation buffers.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import struct
import sys
from pathlib import Path
from typing import Any

DEFAULT_MAX_BYTES = 4_000_000
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942
MAX_INSPECTION_BYTES = 256_000_000


class AuditError(ValueError):
    """An input cannot be safely inspected by this limited inspector."""


def integer(value: Any, label: str, minimum: int = 0) -> int:
    if type(value) is not int or value < minimum:
        raise AuditError(f"{label}: expected integer >= {minimum}")
    return value


def objects(doc: dict[str, Any], key: str) -> list[dict[str, Any]]:
    value = doc.get(key, [])
    if not isinstance(value, list) or any(not isinstance(v, dict) for v in value):
        raise AuditError(f"{key}: expected an array of objects")
    return value


def indexed(items: list[Any], value: Any, label: str) -> Any:
    index = integer(value, label)
    if index >= len(items):
        raise AuditError(f"{label}: index {index} is out of range")
    return items[index]


def parse_glb(path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    size = path.stat().st_size
    if size > MAX_INSPECTION_BYTES:
        raise AuditError("Input exceeds this inspector's 256 MB memory guard")
    raw = path.read_bytes()
    if len(raw) < 20:
        raise AuditError("Truncated GLB header or first chunk")
    magic, version, declared_length = struct.unpack_from('<4sII', raw)
    if magic != b'glTF' or version != 2:
        raise AuditError("Expected a binary glTF 2.0 file")
    if declared_length != len(raw):
        raise AuditError("GLB header length does not match actual file length")
    chunks: list[tuple[int, bytes]] = []
    offset = 12
    while offset < len(raw):
        if offset + 8 > len(raw):
            raise AuditError("Truncated chunk header")
        length, kind = struct.unpack_from('<II', raw, offset)
        offset += 8
        if length % 4 or offset + length > len(raw):
            raise AuditError("Invalid chunk alignment or length")
        chunks.append((kind, raw[offset:offset + length]))
        offset += length
    if not chunks or chunks[0][0] != JSON_CHUNK:
        raise AuditError("First GLB chunk must be JSON")
    if sum(kind == JSON_CHUNK for kind, _ in chunks) != 1:
        raise AuditError("Expected exactly one JSON chunk")
    binary = [data for kind, data in chunks if kind == BIN_CHUNK]
    if len(binary) > 1:
        raise AuditError("Expected at most one BIN chunk")
    if binary and chunks[1][0] != BIN_CHUNK:
        raise AuditError("BIN chunk must immediately follow JSON")
    doc = json.loads(chunks[0][1].decode('utf-8'))
    if not isinstance(doc, dict):
        raise AuditError("JSON root must be an object")
    asset = doc.get('asset', {})
    if not isinstance(asset, dict) or asset.get('version') != '2.0':
        raise AuditError("Expected asset.version 2.0")
    return doc, {
        'sha256': hashlib.sha256(raw).hexdigest(),
        'bytes': len(raw),
        'bin_chunk_bytes': len(binary[0]) if binary else 0,
        'unknown_chunk_types': [kind for kind, _ in chunks if kind not in (JSON_CHUNK, BIN_CHUNK)],
    }


def inspect_document(doc: dict[str, Any], binary_bytes: int) -> dict[str, Any]:
    buffers = objects(doc, 'buffers')
    views = objects(doc, 'bufferViews')
    accessors = objects(doc, 'accessors')
    images = objects(doc, 'images')
    materials = objects(doc, 'materials')
    meshes = objects(doc, 'meshes')
    animations = objects(doc, 'animations')
    skins = objects(doc, 'skins')
    warnings: list[str] = []
    required = doc.get('extensionsRequired', [])
    if not isinstance(required, list) or any(not isinstance(v, str) for v in required):
        raise AuditError('extensionsRequired must be an array of strings')

    def meshopt_metadata(view: dict[str, Any]) -> dict[str, Any] | None:
        extensions = view.get('extensions', {})
        if not isinstance(extensions, dict):
            raise AuditError('bufferView.extensions must be an object')
        metadata = extensions.get('EXT_meshopt_compression')
        if metadata is not None and not isinstance(metadata, dict):
            raise AuditError('EXT_meshopt_compression metadata must be an object')
        return metadata

    for group_name, group in [('buffers', buffers), ('images', images)]:
        for i, item in enumerate(group):
            uri = item.get('uri')
            if uri is not None and (not isinstance(uri, str) or not uri.startswith('data:')):
                raise AuditError(f"{group_name}[{i}]: external resource violates standalone GLB contract")

    for i, buffer in enumerate(buffers):
        length = integer(buffer.get('byteLength'), f'buffers[{i}].byteLength', 1)
        if 'uri' not in buffer:
            if i == 0:
                if not length <= binary_bytes <= length + 3:
                    raise AuditError(f"buffers[{i}]: BIN payload size mismatch")
            else:
                refs = [v for v in views if v.get('buffer') == i]
                referenced_as_compressed = any(
                    metadata.get('buffer') == i
                    for v in views if (metadata := meshopt_metadata(v)) is not None
                )
                if ('EXT_meshopt_compression' not in required or not refs
                        or not all(meshopt_metadata(v) is not None for v in refs)
                        or referenced_as_compressed):
                    raise AuditError(f"buffers[{i}]: unsupported URI-less buffer")
                warnings.append(f'Meshopt fallback buffer {i}: compressed values are not decoded')

    for i, view in enumerate(views):
        buffer = indexed(buffers, view.get('buffer'), f'bufferViews[{i}].buffer')
        start = integer(view.get('byteOffset', 0), f'bufferViews[{i}].byteOffset')
        length = integer(view.get('byteLength'), f'bufferViews[{i}].byteLength', 1)
        if start + length > buffer['byteLength']:
            raise AuditError(f"bufferViews[{i}] exceeds declared buffer size")
        metadata = meshopt_metadata(view)
        if metadata is not None:
            source = indexed(buffers, metadata.get('buffer'), f'bufferViews[{i}].meshopt.buffer')
            compressed_start = integer(metadata.get('byteOffset', 0), 'meshopt.byteOffset')
            compressed_length = integer(metadata.get('byteLength'), 'meshopt.byteLength', 1)
            if compressed_start + compressed_length > source['byteLength']:
                raise AuditError(f'bufferViews[{i}]: compressed range exceeds source buffer')
            stride = integer(metadata.get('byteStride'), 'meshopt.byteStride', 1)
            count = integer(metadata.get('count'), 'meshopt.count', 1)
            if stride * count != length:
                raise AuditError(f'bufferViews[{i}]: meshopt decoded layout length mismatch')

    for i, image in enumerate(images):
        if 'bufferView' in image:
            indexed(views, image['bufferView'], f'images[{i}].bufferView')

    for i, accessor in enumerate(accessors):
        integer(accessor.get('count'), f'accessors[{i}].count', 1)
        if 'bufferView' in accessor:
            indexed(views, accessor['bufferView'], f'accessors[{i}].bufferView')

    triangles = vertices = primitives = nontriangle_primitives = 0
    secondary_joint_attributes = False
    for mi, mesh in enumerate(meshes):
        parts = objects(mesh, 'primitives')
        if not parts:
            raise AuditError(f"meshes[{mi}] has no primitives")
        for pi, primitive in enumerate(parts):
            label = f'meshes[{mi}].primitives[{pi}]'
            attributes = primitive.get('attributes', {})
            if not isinstance(attributes, dict):
                raise AuditError(f'{label}.attributes must be an object')
            positions = indexed(accessors, attributes.get('POSITION'), f'{label}.POSITION')
            count = positions['count']
            vertices += count
            if 'indices' in primitive:
                count = indexed(accessors, primitive['indices'], f'{label}.indices')['count']
            if 'material' in primitive:
                indexed(materials, primitive['material'], f'{label}.material')
            mode = integer(primitive.get('mode', 4), f'{label}.mode')
            if mode > 6:
                raise AuditError(f'{label}: unsupported primitive mode')
            if mode == 4:
                if count % 3:
                    raise AuditError(f'{label}: triangle element count is not divisible by 3')
                triangles += count // 3
            elif mode in (5, 6):
                triangles += max(count - 2, 0)
            else:
                nontriangle_primitives += 1
            secondary_joint_attributes |= any(k.startswith('JOINTS_') and k != 'JOINTS_0' for k in attributes)
            primitives += 1

    joints = []
    nodes = objects(doc, 'nodes')
    for i, skin in enumerate(skins):
        joint_nodes = skin.get('joints')
        if not isinstance(joint_nodes, list) or not joint_nodes:
            raise AuditError(f'skins[{i}].joints must be a nonempty array')
        for joint in joint_nodes:
            indexed(nodes, joint, f'skins[{i}].joints')
        joints.append(len(joint_nodes))

    if not meshes:
        warnings.append('No mesh definitions: this may be an animation-only file, not a complete model')
    if secondary_joint_attributes:
        warnings.append('Additional JOINTS sets found; decode weights to check the four-influence budget')
    if required:
        warnings.append('Required extensions listed, but compatibility with the target loader is not tested')
    if nontriangle_primitives:
        warnings.append('Non-triangle primitives are excluded from the declared triangle total')

    return {
        'declared_geometry': {
            'triangles_sum_over_mesh_primitives': triangles,
            'position_counts_sum_over_primitives_not_unique_vertices': vertices,
            'mesh_definitions': len(meshes),
            'primitive_definitions_not_runtime_draw_calls': primitives,
        },
        'material_definitions': len(materials),
        'image_definitions': len(images),
        'texture_definitions': len(objects(doc, 'textures')),
        'skin_joint_counts': joints,
        'has_secondary_joint_attributes': secondary_joint_attributes,
        'animations': [
            {'name': a.get('name'), 'channel_count': len(objects(a, 'channels'))}
            for a in animations
        ],
        'required_extensions': required,
        'warnings': warnings,
    }


def audit(path: Path, companions: list[Path] | None = None,
          max_bytes: int = DEFAULT_MAX_BYTES) -> dict[str, Any]:
    integer(max_bytes, 'max_bytes', 1)
    main = path.resolve(strict=True)
    paths = list(dict.fromkeys([main, *(p.resolve(strict=True) for p in (companions or []))]))
    if any(not p.is_file() for p in paths):
        raise AuditError('All inputs must be regular files')
    files = [{'path': str(p), 'bytes': p.stat().st_size} for p in paths]
    total = sum(f['bytes'] for f in files)
    report: dict[str, Any] = {
        'inspection_status': 'fail',
        'production_ready': None,
        'budget_bytes': max_bytes,
        'runtime_files': files,
        'total_runtime_bytes': total,
        'total_runtime_mb_decimal': round(total / 1_000_000, 6),
        'within_budget': total <= max_bytes,
        'errors': [],
        'not_checked': [
            'full Khronos glTF validation', 'decoded accessor values and compression integrity',
            'visual quality and deformation', 'animation playback and blending',
            'image dimensions and GPU memory', 'runtime draw calls and FPS',
            'physics, gameplay and target-loader compatibility',
            'companion file contents (only their byte sizes are counted)',
        ],
    }
    if total > max_bytes:
        report['errors'].append(f'Runtime asset is {total - max_bytes} bytes over budget')
    try:
        doc, meta = parse_glb(main)
        report['main_glb'] = meta
        report.update(inspect_document(doc, meta['bin_chunk_bytes']))
    except (AuditError, OSError, UnicodeError, json.JSONDecodeError) as exc:
        report['errors'].append(str(exc))
    report['inspection_status'] = 'pass' if not report['errors'] else 'fail'
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('glb', type=Path)
    parser.add_argument('--companion', type=Path, action='append', default=[],
                        help='Additional file in this asset budget; repeat as needed')
    parser.add_argument('--max-bytes', type=int, default=DEFAULT_MAX_BYTES)
    parser.add_argument('--out', type=Path, help='Write the JSON report; stdout is always emitted')
    args = parser.parse_args()
    try:
        inputs = {p.resolve() for p in [args.glb, *args.companion]}
        if args.out and args.out.resolve() in inputs:
            raise AuditError('Refusing to overwrite an input asset with the report')
        report = audit(args.glb, args.companion, args.max_bytes)
        text = json.dumps(report, ensure_ascii=False, indent=2)
        if args.out:
            args.out.parent.mkdir(parents=True, exist_ok=True)
            args.out.write_text(text + '\n', encoding='utf-8')
        print(text)
        return 0 if report['inspection_status'] == 'pass' else 1
    except (AuditError, OSError) as exc:
        print(json.dumps({'inspection_status': 'fail', 'error': str(exc)}, ensure_ascii=False))
        return 1


if __name__ == '__main__':
    sys.exit(main())
