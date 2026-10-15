import pathlib, yaml
p=pathlib.Path('.github/workflows/publish-campaign-v56.yml')
s=p.read_text();w=yaml.safe_load(s)
assert w['concurrency']=={'group':'pages','cancel-in-progress':False}
assert len(w['jobs'])==6 and set(w['jobs'])=={'assemble','deploy','native','presentation','entry','verify'}
assert w['jobs']['deploy']['needs']=='assemble'
assert w['jobs']['native']['needs']=='deploy'
assert len(w['jobs']['native']['strategy']['matrix']['include'])==6
assert s.count('uses: actions/deploy-pages@v4')==1
assert 'npm run build' not in s and 'npm run package' not in s
assert 'a3c81ee59a9b2cbf1b23254857dd8c2a6f6b3c38' in s and "SOURCE_REVIEW_RUN_ID: '38451783602'" in s
assert 'restore-campaign-v56-baseline.py' in s and 'verify-source' in s and 'verify-public-aggregate' in s
assert 'scripts/test-campaign-v56-release.mjs' in s
assert 'cancel-in-progress: true' not in s and 'campaign-v55/' not in s
print('v56 workflow: one append-only deployment, pinned exact source, no rebuild, full PUBLIC cohort')
