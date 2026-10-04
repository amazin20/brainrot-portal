// Keep the historical CI entry point, using ordinary production UI rather than
// debug hooks that are deliberately absent from a Yandex submission.
import fs from 'node:fs';
import path from 'node:path';
process.env.OUT_DIR ||= 'smoke-artifacts/yandex-browser';
await import('./check-yandex-browser.mjs');
fs.mkdirSync('smoke-artifacts',{recursive:true});
fs.copyFileSync(path.join(process.env.OUT_DIR,'sdk-production-proof.json'),'smoke-artifacts/yandex-mock.json');
