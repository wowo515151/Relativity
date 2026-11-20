import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_C, Event, FourVector, LorentzTransform, Metric, RelativityError, Tensor, classifySeparation, createComputeBackend, intervalSquared, properTime, toRenderCoordinates, velocityAdd } from '../src/relativity.js';

const close = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);

test('Minkowski metric and covariant lowering use the (-+++) convention', () => {
  assert.deepEqual(Metric.minkowski(), [[-1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]);
  const v = new FourVector(4, 1, 2, 3); assert.deepEqual(v.lower().components, [-4,1,2,3]);
  close(v.normSquared(), -16 + 1 + 4 + 9);
});

test('interval classifies timelike, null, and spacelike separations', () => {
  const o = new Event(0,0,0,0); const timelike = new Event(2,1,0,0); const lightlike = new Event(1,1,0,0); const spacelike = new Event(0,1,0,0);
  assert.equal(classifySeparation(timelike,o), 'timelike'); assert.equal(classifySeparation(lightlike,o), 'null'); assert.equal(classifySeparation(spacelike,o), 'spacelike');
  close(intervalSquared(timelike,o), -3); close(properTime(timelike,o,1), Math.sqrt(3)); assert.throws(() => properTime(spacelike,o,1), RelativityError);
});

test('Lorentz boost preserves interval, inverse, and metric orthogonality', () => {
  const boost = LorentzTransform.fromVelocity(.6 * DEFAULT_C, .2 * DEFAULT_C, 0);
  const a = new Event(4e8, 2e8, -3e8, 1e8); const transformed = boost.apply(a);
  close(intervalSquared(a,new Event(0,0,0,0)), intervalSquared(transformed,new Event(0,0,0,0)), 1e-9);
  const roundTrip = boost.inverse().apply(transformed); a.coordinates.forEach((x,i) => close(roundTrip.coordinates[i],x,1e-9));
  const eta = Metric.minkowski();
  for (let i=0;i<4;i++) for (let j=0;j<4;j++) {
    let value=0; for (let k=0;k<4;k++) value += boost.matrix[k][i]*eta[k][k]*boost.matrix[k][j]; close(value,eta[i][j],1e-9);
  }
});

test('zero and collinear boosts have stable expected limits', () => {
  const rest = LorentzTransform.fromVelocity(0,0,0); const e = new Event(2,3,4,5); assert.deepEqual(rest.apply(e).coordinates,e.coordinates);
  const b=.5; const out=LorentzTransform.fromVelocity(b,0,0,1).apply(new Event(2,1,0,0));
  close(out.ct,(2-b)/Math.sqrt(1-b*b)); close(out.x,(1-b*2)/Math.sqrt(1-b*b));
});

test('fixed-seed property sweep preserves intervals for varied subluminal frames', () => {
  let seed=0x51a7; const random=()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/0x1_0000_0000; };
  for (let i=0;i<100;i++) {
    const direction=[random()*2-1,random()*2-1,random()*2-1]; const magnitude=Math.hypot(...direction)||1; const speed=(.01+random()*.85)*DEFAULT_C;
    const velocity=direction.map((x)=>x/magnitude*speed); const event=new Event((random()*2-1)*1e8,(random()*2-1)*1e8,(random()*2-1)*1e8,(random()*2-1)*1e8);
    const boost=LorentzTransform.fromVelocity(...velocity); const transformed=boost.apply(event); const origin=new Event(0,0,0,0);
    close(intervalSquared(event,origin),intervalSquared(transformed,origin),2e-9);
    const back=boost.inverse().apply(transformed); event.coordinates.forEach((x,j)=>close(back.coordinates[j],x,2e-9));
  }
});

test('tensor contraction and Lorentz transform preserve mixed trace', () => {
  const tensor = new Tensor([4,4],[1,0,0,0,0,2,0,0,0,0,3,0,0,0,0,4],['up','down']);
  assert.equal(tensor.contract(0,1).at(),10); const moved=tensor.transform(LorentzTransform.fromVelocity(.7,0,0,1)); close(moved.contract(0,1).at(),10,1e-9);
  assert.throws(() => new Tensor([4,4],Array(16).fill(0),['up','up']).contract(0,1),RelativityError);
});

test('tensor indices can be raised and lowered with the Minkowski metric', () => {
  const upper = new Tensor([4],[1,2,3,4],['up']); const lower=Metric.lower(upper,0);
  assert.deepEqual(lower.components,[-1,2,3,4]); assert.deepEqual(Metric.raise(lower,0).components,upper.components);
  assert.throws(() => upper.raise(0),RelativityError);
});

test('rank-1 covariant values use inverse-transpose transformation', () => {
  const l=LorentzTransform.fromVelocity(.4,0,0,1); const cov=new FourVector(2,1,0,0,{variance:'down'}); const moved=l.apply(cov);
  close(moved.at(0),l.inverseMatrix[0][0]*2+l.inverseMatrix[1][0]);
});

test('Einstein velocity composition remains subluminal and handles zero boost', () => {
  close(velocityAdd([.8,0,0],[.7,0,0],1)[0],1.5/1.56); assert.deepEqual(velocityAdd([.2,.3,0],[0,0,0],1),[.2,.3,0]);
  assert.ok(Math.hypot(...velocityAdd([.7,0,0],[0,.6,0],1))<1);
});

test('render coordinates keep time separate from displayed space', () => {
  const view=toRenderCoordinates(new Event(DEFAULT_C,3,4,5),new Event(0,1,2,3),2); assert.deepEqual(view,{x:1,y:1,z:1,timeSeconds:1,unit:'render-units'});
});

test('invalid numerical inputs and inconsistent coordinate units are rejected', () => {
  assert.throws(() => new FourVector(NaN,0,0,0),RelativityError); assert.throws(() => LorentzTransform.fromVelocity(DEFAULT_C,0,0),RelativityError);
  assert.throws(() => LorentzTransform.fromVelocity(0,0,0,0),RelativityError); assert.throws(() => intervalSquared(new Event(0,0,0,0,'m'),new Event(0,0,0,0,'ft')),RelativityError);
  assert.throws(() => velocityAdd([1,0,0],[0,0,0],1),RelativityError);
});

test('batch backend has deterministic CPU fallback without WebGPU', async () => {
  const backend=await createComputeBackend({forceCpu:true}); assert.equal(backend.name,'cpu-f64'); assert.equal(backend.precision,'float64');
  const batch=await backend.transformEventsBatch([new Event(2,1,0,0)],LorentzTransform.fromVelocity(.5,0,0,1));
  assert.equal(batch.backend,'cpu-f64'); assert.equal(batch.precision,'float64'); assert.equal(batch.fallback,null);
  close(batch.events[0].ct,1.7320508075688772); close(batch.events[0].x,0); await backend.dispose();
});
