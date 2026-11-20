# Relativity Lab

A small JavaScript special-relativity library and ten interactive browser visualizations. The numerical core is renderer-independent and uses the Minkowski metric `(-+++)`, coordinates `(ct, x, y, z)`, and SI units by default. It is an educational model, not experimental data.

## Use

The library is an ES module with no runtime dependencies. Import `src/relativity.js` in a browser or Node.js 20+ project. Scalar and tensor calculations use JavaScript Number arithmetic as the CPU reference. WebGPU is initialized only when `createComputeBackend()` is explicitly called; unsupported devices use the CPU path. Batch acceleration covers event boosts and homogeneous rank-2 four-dimensional tensor transforms.

```js
import { Event, LorentzTransform, intervalSquared } from './src/relativity.js';

const origin = new Event(0, 0, 0, 0);
const event = new Event(5e8, 2e8, 0, 0);
const boost = LorentzTransform.fromVelocity(0.4 * 299_792_458, 0, 0);
console.log(intervalSquared(origin, event));
console.log(boost.apply(event));
```

## API overview

- `Event(ct, x, y, z, unit = 'm')` stores a spacetime event in `(ct, x, y, z)` order. Time has already been multiplied by `c` at the API boundary.
- `FourVector(t, x, y, z, { unit, variance })` supports arithmetic, Minkowski products, and variance conversion. Addition requires the same unit and variance.
- `Metric.minkowski()`, `Tensor`, and `LorentzTransform` support raising/lowering tensor indices, contraction, index permutation, boost, inverse, composition, and rank-n tensor transformation.
- `intervalSquared`, `classifySeparation`, and `properTime` calculate invariant separation and causal class. `properTime` rejects non-timelike intervals.
- `velocityAdd(u, v, c)` composes two velocities using the documented three-dimensional Einstein law; collinear inputs reduce to `(u + v) / (1 + uv/c²)`.
- `toRenderCoordinates(event, origin, scale, c)` returns spatial display coordinates and a separate time in seconds. Display values should not be fed back into physics calculations.
- `createComputeBackend()` returns the CPU reference backend or an explicitly requested WebGPU backend. `transformEventsBatch` and homogeneous rank-2 `transformTensorsBatch` return result data plus actual backend, precision, and fallback metadata.

## Visualizations

Serve `index.html` from a static HTTP host to explore the ten synthetic visualizations. All controls work without WebGPU. GPU use is opt-in through the batch demo button; GPU results use Float32 and are approximate. The library does not claim GPU speedups. Direct `file:` loading may be blocked by browser module security.

## Tests

Run `npm test` with Node.js 20 or newer. Tests cover metric conventions, causal intervals, Lorentz invariance and inverse behavior, tensor contraction and transformations, velocity composition, render conversion, invalid inputs, and CPU batch fallback.

## Scope and limitations

This is special relativity in flat spacetime. It does not implement curved spacetime, general relativity, symbolic computation, or general physical simulation. Browser support varies; CPU operation is the supported baseline. The ten charts are local educational models using synthetic values.

MIT licensed. [Built by Executive51.biz](https://executive51.biz/).

## Development time

Approximately 1 hour 54 minutes of elapsed agent development for this implementation session through 2026-11-20 13:38 UTC, including the sequential conformance, performance, and ethics reviews. The session start and agent CPU time were not instrumented, so this is an approximate wall-clock estimate, not a precise labor total. The focused ethics review is estimated at about 10 minutes.

## Repository publication

Repository: [wowo515151/Relativity](https://github.com/wowo515151/Relativity). Live site: [GitHub Pages](https://wowo515151.github.io/Relativity/). The repository is MIT licensed, and Management remains outside the source repository.
