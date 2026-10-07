// Retry only a browser process that failed before exposing its CDP endpoint.
// Gameplay, page, protocol and assertion failures never enter this retry.
export async function launchBrowserWithStartupRetry({launch, options, TimeoutError,
  onAttempt = () => {}, waitForCleanup = () => new Promise(resolve => setTimeout(resolve, 6000))}) {
  const launchOptions = {...options, timeout: 120000};
  for (let attempt = 1; attempt <= 2; attempt++) {
    let browser;
    try {
      browser = await launch(launchOptions);
    } catch (error) {
      const endpointTimeout = error instanceof TimeoutError &&
        /^Timed out after \d+ ms while waiting for the WS endpoint URL to appear in stdout!$/.test(error.message);
      const retry = attempt === 1 && endpointTimeout;
      onAttempt({attempt, status: 'failed', timeoutMs: launchOptions.timeout,
        error: String(error), retry});
      if (!retry) throw error;
      // Puppeteer's failed-launch cleanup is asynchronous and allows 5 seconds.
      // Let that owned process retire before creating the single replacement.
      await waitForCleanup();
      continue;
    }
    onAttempt({attempt, status: 'started', timeoutMs: launchOptions.timeout});
    return browser;
  }
}
