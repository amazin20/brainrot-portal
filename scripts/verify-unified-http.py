#!/usr/bin/env python3
"""Check exact byte-range serving of every accepted immutable video."""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.error
import urllib.request

parser=argparse.ArgumentParser()
parser.add_argument('--site',required=True)
parser.add_argument('--base',required=True)
parser.add_argument('--output',required=True)
args=parser.parse_args()
site=Path(args.site)
receipt=json.loads((site/'publication-receipt.json').read_text())
target=json.loads(Path('docs/unified-publication-target.json').read_text())
assert len(receipt['recordings'])==len(target['recordings'])
assert sorted(record['id'] for record in receipt['recordings'])==sorted(record['id'] for record in target['recordings'])
checks=[]
for record in receipt['recordings']:
    relative=record['publicVideo']
    assert relative.startswith('walkthroughs/') and '..' not in relative
    data=(site/relative).read_bytes()
    assert len(data)>128
    for start in [0,len(data)//2,len(data)-64]:
        end=start+63
        request=urllib.request.Request(args.base+relative,headers={'Range':f'bytes={start}-{end}'})
        with urllib.request.urlopen(request,timeout=15) as response:
            assert response.status==206,(relative,response.status)
            assert response.headers['Content-Range']==f'bytes {start}-{end}/{len(data)}'
            assert response.headers['Accept-Ranges']=='bytes'
            assert response.headers['Content-Type'].split(';')[0]=='video/mp4'
            chunk=response.read()
            assert chunk==data[start:end+1],('Range bytes changed',relative,start)
            checks.append({'path':relative,'status':206,'start':start,'bytes':len(chunk),'sha256':hashlib.sha256(chunk).hexdigest()})
    request=urllib.request.Request(args.base+relative,headers={'Range':f'bytes={len(data)}-'})
    try:
        urllib.request.urlopen(request,timeout=15)
        raise AssertionError('Unsatisfiable range did not return416')
    except urllib.error.HTTPError as error:
        assert error.code==416
        assert error.headers['Content-Range']==f'bytes */{len(data)}'
for relative in ['missing-publication-file.mp4','missing-publication-file.html','missing-publication-route']:
    try:
        urllib.request.urlopen(args.base+relative,timeout=15)
        raise AssertionError('A missing publication path was hidden by a fallback')
    except urllib.error.HTTPError as error:
        assert error.code==404
proof={'pass':True,'mediaByteRanges':checks,'unsatisfiableRanges':len(receipt['recordings']),'missingPaths':3,'rebuild':False}
Path(args.output).parent.mkdir(parents=True,exist_ok=True)
Path(args.output).write_text(json.dumps(proof,indent=2)+'\n')
print('PUBLICATION HTTP RANGE VERIFIED',json.dumps(proof))
