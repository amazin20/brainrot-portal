"""Recreate the accepted public baseline from exact GET bytes, without rebuilding."""
import argparse, concurrent.futures, importlib.util, json, pathlib, shutil, tempfile, time, urllib.parse, urllib.request

spec = importlib.util.spec_from_file_location('publisher', pathlib.Path(__file__).with_name('publish-campaign-v56.py'))
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)

def restore(manifest, output, pins, *, opener=urllib.request.urlopen):
    publisher.validate_pins(pins)
    rows = publisher.check_baseline(manifest['siteFiles'])
    publisher.require(manifest['siteFilesSha256'] == pins['baseline']['inventorySha256'], 'Baseline manifest hash differs')
    output = publisher.no_symlinks(output)
    publisher.require(not output.exists(), 'Baseline output already exists')
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = pathlib.Path(tempfile.mkdtemp(prefix=output.name+'-restore-', dir=output.parent))
    try:
        def one(row):
            publisher.safe_name(row['path'])
            destination = temporary / row['path']
            for attempt in range(4):
                destination.unlink(missing_ok=True)
                try:
                    url = publisher.PUBLIC_BASE + urllib.parse.quote(row['path'], safe='/') + '?campaign-v56-baseline=' + str(time.time_ns())
                    request = urllib.request.Request(url, headers={'Cache-Control':'no-cache, no-store','Pragma':'no-cache','Accept-Encoding':'identity'})
                    with opener(request, timeout=90) as response:
                        publisher.require(response.status == 200 and response.geturl() == url, 'Baseline HTTP status/redirect differs')
                        publisher.require(response.headers.get('Content-Encoding','identity') in ('','identity') and response.headers.get('Content-Range') is None, 'Encoded/partial baseline response')
                        length=response.headers.get('Content-Length')
                        publisher.require(length is None or length.isdecimal() and int(length)==row['bytes'], 'Baseline length differs')
                        publisher.stream_to_file(response,destination,row['bytes'],row['sha256'])
                    return
                except Exception:
                    if attempt == 3: raise
                    time.sleep(2**attempt)
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            list(executor.map(one, rows))
        publisher.require(publisher.inventory(temporary) == rows, 'Restored baseline inventory differs')
        temporary.rename(output)
        return {'pass':True,'files':len(rows),'bytes':sum(row['bytes'] for row in rows),'inventorySha256':publisher.inventory_sha256(rows),'method':'complete-public-GET-no-rebuild'}
    finally:
        if temporary.exists(): shutil.rmtree(temporary)

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    for flag in ('manifest','output','pins'):parser.add_argument('--'+flag,required=True)
    args=parser.parse_args()
    print(json.dumps(restore(publisher.read_json(args.manifest),args.output,publisher.read_json(args.pins))))
