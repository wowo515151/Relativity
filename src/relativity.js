export const DEFAULT_C = 299_792_458;
const ETA = Object.freeze([-1, 1, 1, 1]);

export class RelativityError extends Error {
  constructor(message, code = 'INVALID_INPUT') { super(message); this.name = 'RelativityError'; this.code = code; }
}

function finite(value, label) {
  if (!Number.isFinite(value)) throw new RelativityError(`${label} must be finite`);
  return value;
}
function vec3(v, label = 'vector') {
  if (!v || v.length !== 3) throw new RelativityError(`${label} must have three components`);
  return Array.from(v, (x, i) => finite(Number(x), `${label}[${i}]`));
}
function dot(a, b) { return a.reduce((sum, x, i) => sum + x * b[i], 0); }
function matrixVector(m, v) { return m.map((row) => dot(row, v)); }
function transpose(m) { return m[0].map((_, j) => m.map((row) => row[j])); }
function multiply(a, b) {
  const bt = transpose(b);
  return a.map((row) => bt.map((col) => dot(row, col)));
}

export class Event {
  constructor(ct, x, y, z, unit = 'm') {
    if (typeof unit !== 'string' || !unit.trim()) throw new RelativityError('unit must be a nonempty string');
    this.coordinates = Object.freeze([finite(Number(ct), 'ct'), finite(Number(x), 'x'), finite(Number(y), 'y'), finite(Number(z), 'z')]);
    this.unit = unit;
    Object.freeze(this);
  }
  get ct() { return this.coordinates[0]; }
  get x() { return this.coordinates[1]; }
  get y() { return this.coordinates[2]; }
  get z() { return this.coordinates[3]; }
  toFourVector(variance = 'up') {
    if (!['up', 'down'].includes(variance)) throw new RelativityError('variance must be up or down');
    const components = variance === 'up' ? this.coordinates : this.coordinates.map((x, i) => ETA[i] * x);
    return new FourVector(...components, { unit: this.unit, variance });
  }
}

export class FourVector {
  constructor(t, x, y, z, options = {}) {
    const { unit = 'm', variance = 'up' } = options;
    if (typeof unit !== 'string' || !unit.trim()) throw new RelativityError('unit must be a nonempty string');
    if (!['up', 'down'].includes(variance)) throw new RelativityError('variance must be up or down');
    this.components = Object.freeze([finite(Number(t), 'component 0'), finite(Number(x), 'component 1'), finite(Number(y), 'component 2'), finite(Number(z), 'component 3')]);
    this.unit = unit; this.variance = variance;
    Object.freeze(this);
  }
  at(i) { return this.components[i]; }
  add(other) { this.#compatible(other); return new FourVector(...this.components.map((x, i) => x + other.components[i]), this); }
  subtract(other) { this.#compatible(other); return new FourVector(...this.components.map((x, i) => x - other.components[i]), this); }
  scale(k) { finite(k, 'scale'); return new FourVector(...this.components.map((x) => x * k), this); }
  minkowskiDot(other) {
    this.#compatible(other);
    return this.components.reduce((sum, x, i) => sum + ETA[i] * x * other.components[i], 0);
  }
  normSquared() { return this.minkowskiDot(this); }
  lower() { return new FourVector(...this.components.map((x, i) => ETA[i] * x), { unit: this.unit, variance: this.variance === 'up' ? 'down' : 'up' }); }
  #compatible(other) {
    if (!(other instanceof FourVector) || other.unit !== this.unit || other.variance !== this.variance) throw new RelativityError('four-vectors must have matching units and variance');
  }
}

export const Metric = Object.freeze({
  minkowski() { return Object.freeze(ETA.map((d, i) => Object.freeze(ETA.map((_, j) => i === j ? d : 0)))); },
  lower(value, index = 0) {
    if (value instanceof FourVector) return value.lower();
    if (value instanceof Tensor) return value.lower(index);
    throw new RelativityError('expected FourVector or Tensor');
  },
  raise(value, index = 0) {
    if (value instanceof FourVector) return value.lower();
    if (value instanceof Tensor) return value.raise(index);
    throw new RelativityError('expected FourVector or Tensor');
  },
});

export class Tensor {
  constructor(shape, components, variance = []) {
    if (!Array.isArray(shape) || !Array.isArray(variance) || shape.length !== variance.length || shape.some((d) => d !== 4)) throw new RelativityError('tensor shape and variance must define rank-n four-dimensional axes');
    if (variance.some((v) => !['up', 'down'].includes(v))) throw new RelativityError('each tensor index variance must be up or down');
    const expected = 4 ** shape.length;
    if (!components || components.length !== expected) throw new RelativityError(`tensor requires ${expected} components`);
    this.shape = Object.freeze([...shape]); this.variance = Object.freeze([...variance]);
    this.components = Object.freeze(Array.from(components, (x, i) => finite(Number(x), `tensor[${i}]`)));
    Object.freeze(this);
  }
  get rank() { return this.shape.length; }
  at(...indices) { return this.components[this.#offset(indices)]; }
  map(fn) { return new Tensor(this.shape, this.components.map(fn), this.variance); }
  scale(k) { finite(k, 'scale'); return this.map((x) => x * k); }
  lower(index) { return this.#changeVariance(index, 'up', 'down'); }
  raise(index) { return this.#changeVariance(index, 'down', 'up'); }
  add(other) {
    if (!(other instanceof Tensor) || this.variance.join() !== other.variance.join() || this.shape.join() !== other.shape.join()) throw new RelativityError('tensor addition requires matching shape and variance');
    return new Tensor(this.shape, this.components.map((x, i) => x + other.components[i]), this.variance);
  }
  permute(order) {
    if (!Array.isArray(order) || order.length !== this.rank || new Set(order).size !== this.rank || order.some((i) => i < 0 || i >= this.rank)) throw new RelativityError('invalid tensor permutation');
    const out = new Array(this.components.length);
    for (let n = 0; n < out.length; n++) {
      const idx = decode(n, this.rank); const src = new Array(this.rank);
      order.forEach((oldAxis, newAxis) => { src[oldAxis] = idx[newAxis]; });
      out[n] = this.at(...src);
    }
    return new Tensor(order.map((i) => this.shape[i]), out, order.map((i) => this.variance[i]));
  }
  contract(axisA, axisB) {
    if (axisA === axisB || this.variance[axisA] === this.variance[axisB] || axisA < 0 || axisB < 0 || axisA >= this.rank || axisB >= this.rank) throw new RelativityError('contraction requires distinct valid indices with opposite variance');
    const keep = Array.from({ length: this.rank }, (_, i) => i).filter((i) => i !== axisA && i !== axisB);
    const shape = keep.map((i) => this.shape[i]); const variance = keep.map((i) => this.variance[i]);
    const out = new Array(4 ** shape.length).fill(0);
    for (let n = 0; n < out.length; n++) {
      const kept = decode(n, shape.length); const idx = new Array(this.rank); keep.forEach((axis, i) => { idx[axis] = kept[i]; });
      for (let k = 0; k < 4; k++) { idx[axisA] = k; idx[axisB] = k; out[n] += this.at(...idx); }
    }
    return new Tensor(shape, out, variance);
  }
  transform(lorentz) {
    const out = new Array(this.components.length).fill(0); const mats = this.variance.map((v) => v === 'up' ? lorentz.matrix : transpose(lorentz.inverseMatrix));
    for (let n = 0; n < out.length; n++) {
      const target = decode(n, this.rank);
      for (let k = 0; k < this.components.length; k++) {
        const source = decode(k, this.rank); let factor = this.components[k];
        for (let a = 0; a < this.rank; a++) factor *= mats[a][target[a]][source[a]];
        out[n] += factor;
      }
    }
    return new Tensor(this.shape, out, this.variance);
  }
  #changeVariance(index, from, to) {
    if (!Number.isInteger(index) || index < 0 || index >= this.rank || this.variance[index] !== from) throw new RelativityError(`tensor index ${index} must be ${from} before it can be ${to}`);
    const variance = [...this.variance]; variance[index] = to;
    const components = this.components.map((value, flat) => value * (decode(flat, this.rank)[index] === 0 ? -1 : 1));
    return new Tensor(this.shape, components, variance);
  }
  #offset(indices) {
    if (indices.length !== this.rank || indices.some((i, n) => !Number.isInteger(i) || i < 0 || i >= this.shape[n])) throw new RelativityError('tensor index out of bounds');
    return indices.reduce((offset, i) => offset * 4 + i, 0);
  }
}

function decode(flat, rank) {
  const out = new Array(rank);
  for (let i = rank - 1; i >= 0; i--) { out[i] = flat % 4; flat = Math.floor(flat / 4); }
  return out;
}

export class LorentzTransform {
  constructor(matrix, velocity, c) {
    this.matrix = Object.freeze(matrix.map((r) => Object.freeze([...r])));
    // Compute inverse as eta * transpose(Lambda) * eta; index-based to handle repeated values.
    this.inverseMatrix = Object.freeze(matrix.map((_, i) => matrix.map((_, j) => ETA[i] * matrix[j][i] * ETA[j])));
    this.velocity = Object.freeze([...velocity]); this.c = c;
    Object.freeze(this);
  }
  static fromVelocity(vx, vy, vz, c = DEFAULT_C) {
    finite(c, 'c'); if (c <= 0) throw new RelativityError('c must be positive');
    const v = vec3([vx, vy, vz], 'velocity'); const beta = v.map((x) => x / c); const b2 = dot(beta, beta);
    if (b2 >= 1) throw new RelativityError('frame velocity must be subluminal');
    const gamma = 1 / Math.sqrt(1 - b2); const m = Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => i === j ? 1 : 0));
    m[0][0] = gamma;
    for (let i = 0; i < 3; i++) { m[0][i + 1] = -gamma * beta[i]; m[i + 1][0] = -gamma * beta[i]; }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i + 1][j + 1] += (b2 === 0 ? 0 : (gamma - 1) * beta[i] * beta[j] / b2);
    return new LorentzTransform(m, v, c);
  }
  apply(value) {
    if (value instanceof Event) { const r = matrixVector(this.matrix, value.coordinates); return new Event(...r, value.unit); }
    if (value instanceof FourVector) {
      const matrix = value.variance === 'up' ? this.matrix : transpose(this.inverseMatrix);
      return new FourVector(...matrixVector(matrix, value.components), { unit: value.unit, variance: value.variance });
    }
    if (value instanceof Tensor) return value.transform(this);
    throw new RelativityError('unsupported Lorentz transform input');
  }
  inverse() { return new LorentzTransform(this.inverseMatrix, this.velocity.map((x) => -x), this.c); }
  compose(other) {
    if (!(other instanceof LorentzTransform) || other.c !== this.c) throw new RelativityError('transforms must use the same c');
    return new LorentzTransform(multiply(other.matrix, this.matrix), [0, 0, 0], this.c);
  }
}

export function intervalSquared(a, b) {
  if (a?.unit !== b?.unit) throw new RelativityError('events must use matching coordinate units');
  const x = coords(a); const y = coords(b);
  const d = x.map((v, i) => v - y[i]);
  return -(d[0] ** 2) + d[1] ** 2 + d[2] ** 2 + d[3] ** 2;
}
function coords(value) { if (value instanceof Event || value instanceof FourVector) return value.coordinates ?? value.components; throw new RelativityError('expected Event or FourVector'); }
export function classifySeparation(a, b, relativeTolerance = 1e-12) {
  finite(relativeTolerance, 'relativeTolerance');
  if (relativeTolerance < 0) throw new RelativityError('relativeTolerance must be nonnegative');
  const x = coords(a); const y = coords(b); const d = x.map((v, i) => v - y[i]); const s = intervalSquared(a, b); const scale = d.reduce((sum, v) => sum + v * v, 0);
  if (Math.abs(s) <= Math.max(Number.EPSILON * scale * 32, relativeTolerance * scale)) return 'null';
  return s < 0 ? 'timelike' : 'spacelike';
}
export function properTime(a, b, c = DEFAULT_C) {
  finite(c, 'c'); if (c <= 0) throw new RelativityError('c must be positive');
  const s = intervalSquared(a, b); const x = coords(a); const y = coords(b);
  const scale = x.reduce((sum, value, i) => sum + (value - y[i]) ** 2, 0);
  if (s >= -Number.EPSILON * scale * 32) throw new RelativityError('proper time is defined only for timelike separation');
  return Math.sqrt(-s) / c;
}
export function velocityAdd(uInput, vInput, c = DEFAULT_C) {
  finite(c, 'c'); if (c <= 0) throw new RelativityError('c must be positive');
  const u = vec3(uInput, 'u'); const v = vec3(vInput, 'v'); const u2 = dot(u, u); const v2 = dot(v, v);
  if (u2 >= c * c || v2 >= c * c) throw new RelativityError('input velocities must be subluminal');
  const vmag = Math.sqrt(v2); if (vmag === 0) return u;
  const unit = v.map((x) => x / vmag); const up = unit.map((x) => x * dot(u, unit)); const ut = u.map((x, i) => x - up[i]); const gamma = 1 / Math.sqrt(1 - v2 / (c * c));
  const denominator = 1 + dot(u, v) / (c * c);
  const result = u.map((x, i) => (up[i] + v[i] + ut[i] / gamma) / denominator);
  if (dot(result, result) >= c * c * (1 + 64 * Number.EPSILON)) throw new RelativityError('velocity composition produced a non-subluminal result', 'NUMERIC_RANGE');
  return result;
}
export function transformPhoton(directionInput, frameVelocity, frequency = 1, c = DEFAULT_C) {
  const direction = vec3(directionInput, 'photon direction'); const speed = Math.hypot(...direction);
  if (speed === 0) throw new RelativityError('photon direction must be nonzero');
  finite(frequency, 'frequency'); if (frequency <= 0) throw new RelativityError('frequency must be positive');
  const unitDirection = direction.map((x) => x / speed); const velocity = vec3(frameVelocity, 'frame velocity');
  const photon = new FourVector(frequency, ...unitDirection.map((x) => x * frequency), { unit: 'frequency', variance: 'up' });
  const transformed = LorentzTransform.fromVelocity(...velocity, c).apply(photon);
  const spatial = transformed.components.slice(1); const outputFrequency = transformed.at(0); const outputMagnitude = Math.hypot(...spatial);
  return Object.freeze({ frequency: outputFrequency, frequencyRatio: outputFrequency / frequency, direction: Object.freeze(spatial.map((x) => x / outputMagnitude)), backend: 'cpu-f64' });
}
export function toRenderCoordinates(event, origin = new Event(0, 0, 0, 0), scale = 1, c = DEFAULT_C) {
  finite(scale, 'scale'); if (scale <= 0) throw new RelativityError('scale must be positive');
  finite(c, 'c'); if (c <= 0) throw new RelativityError('c must be positive');
  if (event?.unit !== origin?.unit) throw new RelativityError('events must use matching coordinate units');
  const e = coords(event); const o = coords(origin);
  return Object.freeze({ x: (e[1] - o[1]) / scale, y: (e[2] - o[2]) / scale, z: (e[3] - o[3]) / scale, timeSeconds: (e[0] - o[0]) / c, unit: 'render-units' });
}

function buildShader() {
  return `struct Matrix { columns: array<vec4<f32>, 4> }; @group(0) @binding(0) var<storage, read> inputEvents: array<vec4<f32>>; @group(0) @binding(1) var<storage, read_write> outputEvents: array<vec4<f32>>; @group(0) @binding(2) var<uniform> transform: Matrix; @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3<u32>) { let i = gid.x; if (i >= arrayLength(&inputEvents)) { return; } outputEvents[i] = transform.columns[0] * inputEvents[i].x + transform.columns[1] * inputEvents[i].y + transform.columns[2] * inputEvents[i].z + transform.columns[3] * inputEvents[i].w; }`;
}
function buildTensorShader() {
  return `struct MatrixPair { first: array<vec4<f32>, 4>, second: array<vec4<f32>, 4> }; @group(0) @binding(0) var<storage, read> inputValues: array<f32>; @group(0) @binding(1) var<storage, read_write> outputValues: array<f32>; @group(0) @binding(2) var<uniform> transforms: MatrixPair; @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3<u32>) { let i = gid.x; if (i >= arrayLength(&inputValues)) { return; } let component = i % 16u; let outA = component / 4u; let outB = component % 4u; let tensorBase = i - component; var value = 0.0; for (var a = 0u; a < 4u; a = a + 1u) { for (var b = 0u; b < 4u; b = b + 1u) { value = value + transforms.first[a][outA] * transforms.second[b][outB] * inputValues[tensorBase + a * 4u + b]; } } outputValues[i] = value; }`;
}
function varianceMatrix(transform, variance) {
  return variance === 'up' ? transform.matrix : transpose(transform.inverseMatrix);
}
function matrixColumns(matrix, target, offset = 0) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) target[offset + c * 4 + r] = matrix[r][c];
}
export async function createComputeBackend({ device = null, forceCpu = false } = {}) {
  if (forceCpu) return Object.freeze({ name: 'cpu-f64', precision: 'float64', async transformEventsBatch(events, transform) { return { events: cpuBatch(events, transform), backend: 'cpu-f64', precision: 'float64', fallback: null }; }, async transformTensorsBatch(tensors, transform) { return { tensors: cpuTensorBatch(tensors, transform), backend: 'cpu-f64', precision: 'float64', fallback: null }; }, async dispose() {} });
  let gpuDevice = device;
  try {
    if (!gpuDevice && globalThis.navigator?.gpu) { const adapter = await navigator.gpu.requestAdapter(); if (adapter) gpuDevice = await adapter.requestDevice(); }
  } catch { gpuDevice = null; }
  if (!gpuDevice) return Object.freeze({ name: 'cpu-f64', precision: 'float64', async transformEventsBatch(events, transform) { return { events: cpuBatch(events, transform), backend: 'cpu-f64', precision: 'float64', fallback: null }; }, async transformTensorsBatch(tensors, transform) { return { tensors: cpuTensorBatch(tensors, transform), backend: 'cpu-f64', precision: 'float64', fallback: null }; }, async dispose() {} });
  const backend = {
    name: 'webgpu', precision: 'float32-approximate',
    async transformEventsBatch(events, transform) {
      let buffers = [];
      try {
        if (!Array.isArray(events) || events.some((e) => !(e instanceof Event)) || !(transform instanceof LorentzTransform)) throw new RelativityError('batch requires Events and a LorentzTransform');
        if (events.length === 0) return { events: [], backend: 'webgpu', precision: 'float32-approximate', fallback: null };
        if (events.length > 1_000_000) return { events: cpuBatch(events, transform), backend: 'cpu-f64', precision: 'float64', fallback: 'batch-size-limit' };
        const outputBytes = events.length * 4 * Float32Array.BYTES_PER_ELEMENT;
        const maxBufferSize = gpuDevice.limits?.maxBufferSize ?? Number.POSITIVE_INFINITY;
        const maxStorageSize = gpuDevice.limits?.maxStorageBufferBindingSize ?? maxBufferSize;
        if (outputBytes > maxBufferSize || outputBytes > maxStorageSize) return { events: cpuBatch(events, transform), backend: 'cpu-f64', precision: 'float64', fallback: 'device-buffer-limit' };
        if (Math.ceil(events.length / 64) > (gpuDevice.limits?.maxComputeWorkgroupsPerDimension ?? 65_535)) return { events: cpuBatch(events, transform), backend: 'cpu-f64', precision: 'float64', fallback: 'device-dispatch-limit' };
        const input = new Float32Array(events.length * 4);
        events.forEach((event, i) => { for (let j = 0; j < 4; j++) input[i * 4 + j] = event.coordinates[j]; });
        const usage = GPUBufferUsage;
        const inBuf = gpuDevice.createBuffer({ size: outputBytes, usage: usage.STORAGE | usage.COPY_DST });
        buffers.push(inBuf);
        const outBuf = gpuDevice.createBuffer({ size: outputBytes, usage: usage.STORAGE | usage.COPY_SRC });
        buffers.push(outBuf);
        const readBuf = gpuDevice.createBuffer({ size: outputBytes, usage: usage.MAP_READ | usage.COPY_DST });
        buffers.push(readBuf);
        const cols = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) cols[c * 4 + r] = transform.matrix[r][c];
        const uniform = gpuDevice.createBuffer({ size: 64, usage: usage.UNIFORM | usage.COPY_DST });
        buffers.push(uniform);
        gpuDevice.queue.writeBuffer(inBuf, 0, input); gpuDevice.queue.writeBuffer(uniform, 0, cols);
        const module = gpuDevice.createShaderModule({ code: buildShader() }); const pipeline = gpuDevice.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });
        const group = gpuDevice.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: inBuf } }, { binding: 1, resource: { buffer: outBuf } }, { binding: 2, resource: { buffer: uniform } }] });
        const encoder = gpuDevice.createCommandEncoder(); const pass = encoder.beginComputePass(); pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(Math.ceil(events.length / 64)); pass.end(); encoder.copyBufferToBuffer(outBuf, 0, readBuf, 0, outputBytes); gpuDevice.queue.submit([encoder.finish()]);
        await readBuf.mapAsync(GPUMapMode.READ); const result = new Float32Array(readBuf.getMappedRange().slice(0)); readBuf.unmap();
        const mapped = Array.from(events, (_, i) => new Event(result[i * 4], result[i * 4 + 1], result[i * 4 + 2], result[i * 4 + 3], events[i].unit));
        return { events: mapped, backend: 'webgpu', precision: 'float32-approximate', fallback: null };
      } catch {
        return { events: cpuBatch(events, transform), backend: 'cpu-f64', precision: 'float64', fallback: 'gpu-error' };
      } finally { for (const buffer of buffers) { try { buffer.destroy(); } catch {} } }
    },
    async transformTensorsBatch(tensors, transform) {
      let buffers = [];
      try {
        validateTensorBatch(tensors, transform);
        if (tensors.length === 0) return { tensors: [], backend: 'webgpu', precision: 'float32-approximate', fallback: null };
        if (tensors.length > 65_536) return { tensors: cpuTensorBatch(tensors, transform), backend: 'cpu-f64', precision: 'float64', fallback: 'batch-size-limit' };
        const outputBytes = tensors.length * 16 * Float32Array.BYTES_PER_ELEMENT;
        const maxBufferSize = gpuDevice.limits?.maxBufferSize ?? Number.POSITIVE_INFINITY;
        const maxStorageSize = gpuDevice.limits?.maxStorageBufferBindingSize ?? maxBufferSize;
        if (outputBytes > maxBufferSize || outputBytes > maxStorageSize) return { tensors: cpuTensorBatch(tensors, transform), backend: 'cpu-f64', precision: 'float64', fallback: 'device-buffer-limit' };
        if (Math.ceil(tensors.length * 16 / 64) > (gpuDevice.limits?.maxComputeWorkgroupsPerDimension ?? 65_535)) return { tensors: cpuTensorBatch(tensors, transform), backend: 'cpu-f64', precision: 'float64', fallback: 'device-dispatch-limit' };
        const components = new Float32Array(tensors.length * 16);
        tensors.forEach((tensor, i) => components.set(tensor.components, i * 16));
        const usage = GPUBufferUsage;
        const inBuf = gpuDevice.createBuffer({ size: outputBytes, usage: usage.STORAGE | usage.COPY_DST }); buffers.push(inBuf);
        const outBuf = gpuDevice.createBuffer({ size: outputBytes, usage: usage.STORAGE | usage.COPY_SRC }); buffers.push(outBuf);
        const readBuf = gpuDevice.createBuffer({ size: outputBytes, usage: usage.MAP_READ | usage.COPY_DST }); buffers.push(readBuf);
        const uniforms = new Float32Array(32);
        matrixColumns(varianceMatrix(transform, tensors[0].variance[0]), uniforms, 0);
        matrixColumns(varianceMatrix(transform, tensors[0].variance[1]), uniforms, 16);
        const uniformBuf = gpuDevice.createBuffer({ size: uniforms.byteLength, usage: usage.UNIFORM | usage.COPY_DST }); buffers.push(uniformBuf);
        gpuDevice.queue.writeBuffer(inBuf, 0, components); gpuDevice.queue.writeBuffer(uniformBuf, 0, uniforms);
        const module = gpuDevice.createShaderModule({ code: buildTensorShader() });
        const pipeline = gpuDevice.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });
        const group = gpuDevice.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: inBuf } }, { binding: 1, resource: { buffer: outBuf } }, { binding: 2, resource: { buffer: uniformBuf } }] });
        const encoder = gpuDevice.createCommandEncoder(); const pass = encoder.beginComputePass(); pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(Math.ceil(components.length / 64)); pass.end(); encoder.copyBufferToBuffer(outBuf, 0, readBuf, 0, outputBytes); gpuDevice.queue.submit([encoder.finish()]);
        await readBuf.mapAsync(GPUMapMode.READ); const result = new Float32Array(readBuf.getMappedRange().slice(0)); readBuf.unmap();
        const mapped = tensors.map((tensor, i) => new Tensor([4, 4], result.slice(i * 16, (i + 1) * 16), tensor.variance));
        return { tensors: mapped, backend: 'webgpu', precision: 'float32-approximate', fallback: null };
      } catch {
        return { tensors: cpuTensorBatch(tensors, transform), backend: 'cpu-f64', precision: 'float64', fallback: 'gpu-error' };
      } finally { for (const buffer of buffers) { try { buffer.destroy(); } catch {} } }
    },
    async dispose() { if (!device && gpuDevice) gpuDevice.destroy(); },
  };
  return Object.freeze(backend);
}
function cpuBatch(events, transform) {
  if (!Array.isArray(events) || events.some((e) => !(e instanceof Event)) || !(transform instanceof LorentzTransform)) throw new RelativityError('batch requires Events and a LorentzTransform');
  return events.map((e) => transform.apply(e));
}
function validateTensorBatch(tensors, transform) {
  if (!Array.isArray(tensors) || tensors.some((tensor) => !(tensor instanceof Tensor) || tensor.rank !== 2 || tensor.shape[0] !== 4 || tensor.shape[1] !== 4)) throw new RelativityError('tensor batch requires rank-2 four-dimensional tensors');
  if (!(transform instanceof LorentzTransform)) throw new RelativityError('tensor batch requires a LorentzTransform');
  if (tensors.some((tensor) => tensor.variance.join() !== tensors[0]?.variance.join())) throw new RelativityError('tensor batch requires matching index variance');
}
function cpuTensorBatch(tensors, transform) {
  validateTensorBatch(tensors, transform);
  return tensors.map((tensor) => tensor.transform(transform));
}
