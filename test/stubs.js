// Minimal browser stand-ins so pixel.html's game code can run headless in JavaScriptCore (jsc).
// Audio is a fake clock: tests advance actx.currentTime themselves.
var performance = {now: () => Date.now()};
var innerWidth = 960, innerHeight = 600;
function addEventListener() {}
function requestAnimationFrame() {}
function setTimeout(fn) { fn(); }
var localStorage = {};
var indexedDB = {deleteDatabase() {}};
var window = {};
// a 2D context that accepts any drawing call (so draw() runs) and returns real pixel buffers
var ctx2 = new Proxy({
  getImageData: (x, y, w, h) => ({data: new Uint8ClampedArray(w * h * 4)}),
  putImageData() {},
}, {get: (o, k) => k in o ? o[k] : () => {}, set: (o, k, v) => { o[k] = v; return true; }});
var document = {getElementById: () => ({
  getContext: () => ctx2, style: {}, addEventListener() {}, width: 640, height: 400,
  getBoundingClientRect() { return {}; },
})};
const fakeParam = () => ({value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {}});
const fakeNode = () => ({gain: fakeParam(), playbackRate: fakeParam(), connect() {}, disconnect() {}, start() {}, stop() {}});
var AudioContext = function () {
  return {
    currentTime: 0, state: 'running', outputLatency: 0, baseLatency: 0, destination: {},
    createGain: fakeNode, createBufferSource: fakeNode,
    createAnalyser: () => Object.assign(fakeNode(), {frequencyBinCount: 128, getByteFrequencyData() {}}),
    createBuffer: (c, n, sr) => {
      const ch = [...Array(c)].map(() => new Float32Array(n));
      return {getChannelData: i => ch[i], length: n, sampleRate: sr, numberOfChannels: c, duration: n / sr};
    },
    resume() {}, suspend() {},
  };
};
window.AudioContext = AudioContext;
