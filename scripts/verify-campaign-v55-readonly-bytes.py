"""Read-only whole-site validation of an authenticated historical PUBLIC target.

The original byte verifier remains unchanged. Real current producer metadata is
retained separately; no GitHub environment or original PUBLIC identity is rewritten.
"""
import argparse
import importlib.util
import json
import os
import pathlib

parser = argparse.ArgumentParser()
parser.add_argument('--manifest', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--producer', required=True)
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parent
module_spec = importlib.util.spec_from_file_location('original_byte_verifier', root/'publish-campaign-v55.py')
helper = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(helper)
config = json.loads((root.parent/'tools/campaign-v55-readonly.json').read_text())
producer = json.loads(pathlib.Path(args.producer).read_text())
assert config['frozen'] is True
assert producer['kind'] == 'actual-read-only-campaign-v55-postprocessing-producer'
assert producer['noDeploymentOrBrowserReplay'] is True
assert producer['controllerCommit'] == os.environ['GITHUB_SHA']
assert producer['runId'] == int(os.environ['GITHUB_RUN_ID'])
assert producer['runAttempt'] == int(os.environ['GITHUB_RUN_ATTEMPT']) == 1
assert os.environ['GITHUB_REPOSITORY'] == 'amazin20/brainrot-portal'
assert os.environ['GITHUB_REF'] == 'refs/heads/'+config['branch']
assert os.environ['GITHUB_EVENT_NAME'] == 'push'
assert producer['runId'] != 38387082981
pins = json.loads((root.parent/'tools/campaign-v55-release.json').read_text())
expected = helper.identity(pins, 'ba3218f7855e7cbff8170ec1f692a0fd786794a6', 38387082981, 1)
receipt = helper.check_public(args.manifest, args.output, pins, expected, 'published')
assert receipt['pass'] is True and receipt['checked'] == 2038 and receipt['bytes'] == 640738913
assert receipt['siteFilesSha256'] == config['site']['inventorySha256']
helper.write_new(pathlib.Path(args.output).with_name('public-final-readonly-producer.json'), helper.json_bytes({
    'kind': 'actual-read-only-whole-GET-producer', 'pass': True, 'publicationAccepted': False,
    'historicalTarget': expected, 'actualReadOnlyProducer': producer,
    'originalCIConclusion': 'failure', 'byteReceiptSha256': helper.sha256_file(args.output),
    'scope': 'Fresh complete GET; historical target and actual current reader remain distinct.'}))
