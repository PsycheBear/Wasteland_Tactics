// Vitest setup — runs once before the test suite.
// jsdom does not implement HTMLMediaElement.play(); the audio layer calls it
// inside the FO4 fallback path. Stub it so test output stays quiet.
if (typeof window !== 'undefined' && window.HTMLMediaElement) {
  window.HTMLMediaElement.prototype.play = function () {
    return Promise.resolve();
  };
  window.HTMLMediaElement.prototype.pause = function () {};
}
