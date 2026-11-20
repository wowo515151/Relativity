import test from 'node:test';
import assert from 'node:assert/strict';

class FakeCanvasContext {
  constructor(){this.lines=[];this.arcs=[];this.rects=[];this.lastPoint=null;}
  clearRect() {} fillRect(...args) { this.rects.push(args); } beginPath() {} moveTo(x,y) { this.lastPoint=[x,y]; } lineTo(x,y) { if(this.lastPoint)this.lines.push([this.lastPoint[0],this.lastPoint[1],x,y]); this.lastPoint=[x,y]; } stroke() {} fillText() {} arc(...args) { this.arcs.push(args); } fill() {}
}
class FakeElement {
  constructor(tag) { this.tagName=tag; this.children=[]; this.attributes={}; this.listeners={}; this.textContent=''; this.value=''; this.context=new FakeCanvasContext(); }
  append(...items) { this.children.push(...items); }
  setAttribute(name,value) { this.attributes[name]=value; }
  addEventListener(name,fn) { this.listeners[name]=fn; }
  getContext() { return this.context; }
  focus() {}
}

test('visitor app builds ten panels and each slider refreshes its text output', async () => {
  const oldDocument=globalThis.document; const root=new FakeElement('main'); const status=new FakeElement('p'); status.textContent='CPU Float64 calculations are active. GPU initialization is optional.'; const gpuDemo=new FakeElement('button');
  globalThis.document={ querySelector(selector) { return selector==='#visualizations' ? root : selector==='#gpu-demo' ? gpuDemo : status; }, createElement(tag) { return new FakeElement(tag); } };
  try {
    await import(`../app.js?smoke=${Date.now()}`);
    await new Promise((resolve)=>setImmediate(resolve));
    assert.equal(root.children.length,10);
    for (const card of root.children) {
      const title=card.children[0]; const canvas=card.children[2]; const controls=card.children[3]; const readout=card.children.at(-1);
      assert.match(title.textContent,/^\d+\./); assert.equal(canvas.attributes.role,'img'); assert.ok(canvas.attributes['aria-label']);
      const description=card.children[1]; assert.ok(description.textContent.length>250); assert.equal(canvas.attributes['aria-label'],`${title.textContent.replace(/^\d+\.\s*/,'')} chart`); assert.equal(canvas.attributes['aria-describedby'],`${description.id} ${readout.id}`);
      const slider=controls.children[1]; const initial=readout.textContent; const defaultValue=slider.value; assert.ok(initial.length>0);
      slider.value=slider.max; slider.listeners.input(); assert.ok(readout.textContent.length>0);
      if(title.textContent.startsWith('1.')){const marker=canvas.context.arcs.at(-1);assert.ok(Math.abs(marker[0]-468.5)<1);assert.ok(Math.abs(marker[1]-38)<1);assert.match(readout.textContent,/timelike; interval squared = -0\.878/);}
      if(title.textContent.startsWith('4.')){const outbound=canvas.context.lines.at(-2);const returnLeg=canvas.context.lines.at(-1);assert.ok(Math.abs(outbound[0]-360)<1);assert.ok(Math.abs(outbound[1]-322)<1);assert.ok(Math.abs(outbound[2]-654.5)<1);assert.ok(Math.abs(outbound[3]-180)<1);assert.ok(Math.abs(returnLeg[0]-654.5)<1);assert.ok(Math.abs(returnLeg[1]-180)<1);assert.ok(Math.abs(returnLeg[2]-360)<1);assert.ok(Math.abs(returnLeg[3]-38)<1);assert.match(readout.textContent,/coordinate time=2\.000 units/);}
      if(title.textContent.startsWith('5.')){const measuredRod=canvas.context.lines.at(-1);assert.ok(Math.abs((measuredRod[0]+measuredRod[2])/2-360)<1);assert.ok(Math.abs((measuredRod[2]-measuredRod[0])-125.9)<1);assert.match(readout.textContent,/equal-boosted-time endpoint separation=0\.406 units/);}
      if(title.textContent.startsWith('6.')){const einstein=canvas.context.arcs.at(-1);const classical=canvas.context.rects.at(-1);assert.ok(Math.abs(einstein[0]-654.5)<1);assert.ok(Math.abs(einstein[1]-92.6)<1);assert.ok(Math.abs(classical[0]+5-654.5)<1);assert.ok(Math.abs(classical[1]+5-46.9)<1);assert.match(readout.textContent,/Einstein composition=0\.985c \(circle\); classical sum=1\.500c \(square\)/);}
      if(title.textContent.startsWith('7.')){assert.ok(canvas.context.lines.length>=4);assert.ok(canvas.context.rects.length>=2);assert.match(description.textContent,/source-frame photon direction/);}
      if(title.textContent.startsWith('9.')){assert.ok(canvas.context.lines.length>100);assert.match(description.textContent,/positive-energy mass shell/);}
      if(title.textContent.startsWith('10.')){const after00=canvas.context.rects.at(-2);const after11=canvas.context.rects.at(-1);assert.ok(Math.abs(after00[0]+5-220.5)<1);assert.ok(Math.abs(after11[0]+5-499.5)<1);assert.match(readout.textContent,/before=1\.000\/2\.000; after=-8\.256\/11\.256\. Mixed-tensor trace before=10\.000, after=10\.000/);}
      const extra=card.children.length===6?card.children[4]:null; const extraDefault=extra?.children[1].value;
      if(extra){const before=readout.textContent;extra.children[1].value=extra.children[1].max;extra.children[1].listeners.input();assert.notEqual(readout.textContent,before);if(title.textContent.startsWith('9.'))assert.match(readout.textContent,/m=5\.0 kg.*invariant mass=5\.000 kg/);}
      controls.children[3].listeners.click(); assert.equal(slider.value,defaultValue); if(extra) assert.equal(extra.children[1].value,extraDefault);
    }
    assert.match(status.textContent,/CPU Float64 calculations are active/);
    await gpuDemo.listeners.click(); assert.match(status.textContent,/CPU Float64 fallback active/);
  } finally { if (oldDocument===undefined) delete globalThis.document; else globalThis.document=oldDocument; }
});
