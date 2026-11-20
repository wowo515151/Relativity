# Relativity Lab

A small JavaScript special-relativity library and ten interactive browser visualizations. The numerical core is renderer-independent and uses the Minkowski metric `(-+++)`, coordinates `(ct, x, y, z)`, and SI units by default. It is an educational model, not experimental data.

## Use

The library is an ES module with no runtime dependencies. Import `src/relativity.js` in a browser or Node.js 20+ project. Scalar and tensor calculations use JavaScript Number arithmetic as the CPU reference. WebGPU is initialized only when `createComputeBackend()` is explicitly called; unsupported devices use the CPU path.

```js
import { Event, LorentzTransform, intervalSquared } from './src/relativity.js';

const origin = new Event(0, 0, 0, 0);
const event = new Event(5e8, 2e8, 0, 0);
const boost = LorentzTransform.fromVelocity(0.4 * 299_792_458, 0, 0);
console.log(intervalSquared(origin, event));
console.log(boost.apply(event));
```

## Visualizations

Serve `index.html` from a static HTTP host to explore the ten synthetic visualizations. All controls work without WebGPU. GPU use is opt-in through the batch demo button; GPU results use Float32 and are approximate. The library does not claim GPU speedups. Direct `file:` loading may be blocked by browser module security.

## Tests

Run `npm test` with Node.js 20 or newer. Tests cover metric conventions, causal intervals, Lorentz invariance and inverse behavior, tensor contraction and transformations, velocity composition, render conversion, invalid inputs, and CPU batch fallback.

## Scope and limitations

This is special relativity in flat spacetime. It does not implement curved spacetime, general relativity, symbolic computation, or general physical simulation. Browser support varies; CPU operation is the supported baseline. The ten charts are local educational models using synthetic values.

MIT licensed. [Built by Executive51.biz](https://executive51.biz/).

## Development time

Approximately 1 hour 5 minutes of elapsed agent development for this implementation session through 2026-11-20 12:52 UTC, including the sequential conformance, performance, and ethics reviews. The session start and agent CPU time were not instrumented, so this is an approximate wall-clock estimate, not a precise labor total. The focused ethics review is estimated at about 8 minutes.

## Repository publication

GitHub publication remains pending: the local GitHub CLI reports that its existing credential is invalid, and the GitHub API hostname could not be resolved from this environment. No account login or credential change was attempted.
