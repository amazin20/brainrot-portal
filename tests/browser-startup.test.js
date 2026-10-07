import test from 'node:test';
import assert from 'node:assert/strict';
import {launchBrowserWithStartupRetry} from '../scripts/lib/browser-startup.mjs';

class TimeoutError extends Error {}
const endpointTimeout = () => new TimeoutError('Timed out after 120000 ms while waiting for the WS endpoint URL to appear in stdout!');
const options = {executablePath:'/pinned/chrome', headless:true, protocolTimeout:1800000, args:['--no-sandbox','--use-angle=swiftshader']};

test('a successful owned browser launches once with preserved options and the startup budget', async () => {
  const browser = {}, events = []; let calls = 0;
  const actual = await launchBrowserWithStartupRetry({options, TimeoutError,
    launch: async received => {calls++; assert.deepEqual(received,{...options,timeout:120000}); return browser;},
    onAttempt: event => events.push(event), waitForCleanup: () => assert.fail('Successful launch must not wait')});
  assert.equal(actual,browser); assert.equal(calls,1); assert.deepEqual(events.map(e=>e.status),['started']);
});

test('an endpoint startup timeout waits for retirement and retries only once', async () => {
  const browser = {}, events = []; let calls = 0, cleanups = 0;
  const actual = await launchBrowserWithStartupRetry({options, TimeoutError,
    launch: async received => {assert.deepEqual(received,{...options,timeout:120000}); if(++calls===1)throw endpointTimeout(); assert.equal(cleanups,1); return browser;},
    onAttempt: event => events.push(event), waitForCleanup: async () => {cleanups++;}});
  assert.equal(actual,browser); assert.equal(calls,2); assert.equal(cleanups,1);
  assert.deepEqual(events.map(e=>[e.attempt,e.status,e.retry]),[[1,'failed',true],[2,'started',undefined]]);
});

test('a second endpoint startup timeout propagates the original error without a third launch', async () => {
  const failure = endpointTimeout(); let calls = 0, cleanups = 0;
  await assert.rejects(launchBrowserWithStartupRetry({options, TimeoutError,
    launch: async () => {calls++; throw failure;}, waitForCleanup: async () => {cleanups++;}}), error => error===failure);
  assert.equal(calls,2); assert.equal(cleanups,1);
});

for (const [label,failure] of [
  ['page navigation timeout',new TimeoutError('Navigation timeout of 180000 ms exceeded')],
  ['a same-named non-Puppeteer exception',Object.assign(new Error(endpointTimeout().message),{name:'TimeoutError'})],
  ['protocol or closed-target failure',Object.assign(new Error('Target closed'),{name:'TargetCloseError'})],
  ['gameplay assertion failure',new assert.AssertionError({message:'Original companion did not reach the exit'})],
]) {
  test(label+' propagates immediately without retry or cleanup wait', async () => {
    let calls = 0;
    await assert.rejects(launchBrowserWithStartupRetry({options, TimeoutError,
      launch: async () => {calls++; throw failure;}, waitForCleanup: () => assert.fail('Non-startup errors must not retry')}), error => error===failure);
    assert.equal(calls,1);
  });
}
