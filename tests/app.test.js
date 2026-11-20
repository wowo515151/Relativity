import test from 'node:test';
import assert from 'node:assert/strict';

class FakeCanvasContext {
  clearRect() {} fillRect() {} beginPath() {} moveTo() {} lineTo() {} stroke() {} fillText() {} arc() {} fill() {}
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
      const slider=controls.children[1]; const initial=readout.textContent; const defaultValue=slider.value; assert.ok(initial.length>0);
      slider.value=slider.max; slider.listeners.input(); assert.ok(readout.textContent.length>0);
      const extra=card.children.length===6?card.children[4]:null; const extraDefault=extra?.children[1].value;
      if(extra){const before=readout.textContent;extra.children[1].value=extra.children[1].max;extra.children[1].listeners.input();assert.notEqual(readout.textContent,before);if(title.textContent.startsWith('9.'))assert.match(readout.textContent,/m=5\.0 kg.*invariant mass=5\.000 kg/);}
      controls.children[3].listeners.click(); assert.equal(slider.value,defaultValue); if(extra) assert.equal(extra.children[1].value,extraDefault);
    }
    assert.match(status.textContent,/CPU Float64 calculations are active/);
    await gpuDemo.listeners.click(); assert.match(status.textContent,/CPU Float64 fallback active/);
  } finally { if (oldDocument===undefined) delete globalThis.document; else globalThis.document=oldDocument; }
});
