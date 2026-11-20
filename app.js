import { DEFAULT_C, Event, FourVector, LorentzTransform, Tensor, classifySeparation, intervalSquared, properTime, velocityAdd, createComputeBackend } from './src/relativity.js';

const c = 1; // normalized display units: one light-year per year
const configs = [
  ['Minkowski diagram','Compare event separations with the light cone.','Event time coordinate ct',0,100,55],
  ['Lorentz boost grid','See how a moving frame tilts its time and space axes.','Frame speed as a fraction of c',0,95,60],
  ['Relativity of simultaneity','Events simultaneous in one frame can occur at different times in another.','Frame speed as a fraction of c',0,95,60],
  ['Time dilation','Compare coordinate time with proper time along an inertial path.','Speed as a fraction of c',0,95,80],
  ['Length contraction','Measure rod endpoints at equal time in the observing frame.','Frame speed as a fraction of c',0,95,70],
  ['Velocity addition','Compose two collinear velocities using Einstein addition.','Second velocity as a fraction of c',0,95,60],
  ['Doppler shift and aberration','Change the relative speed and view frequency and direction shifts.','Relative speed as a fraction of c',0,95,65],
  ['Velocity disk','Explore how composed two-dimensional velocities stay inside the unit-c disk.','Horizontal input velocity as a fraction of c',-95,95,55],
  ['Energy-momentum four-vector','Move a particle speed and inspect energy and momentum on its mass shell.','Speed as a fraction of c',0,95,70],
  ['Tensor transformation','Boost a rank-2 sample tensor and compare its trace invariant.','Frame speed as a fraction of c',0,95,50],
];
const root = document.querySelector('#visualizations');
const paints = [drawMinkowski, drawBoost, drawSimultaneity, drawClock, drawRod, drawVelocity, drawDoppler, drawDisk, drawEnergy, drawTensor];
configs.forEach((cfg, i) => {
  const card = document.createElement('article'); card.className = 'card';
  const title = document.createElement('h2'); title.id = `viz-title-${i}`; title.textContent = `${i + 1}. ${cfg[0]}`;
  const description = document.createElement('p'); description.textContent = cfg[1];
  const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 360; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${cfg[0]} chart. ${cfg[1]}`);
  const controls = document.createElement('div'); controls.className = 'controls';
  const label = document.createElement('label'); label.htmlFor = `control-${i}`; label.textContent = cfg[2];
  const input = document.createElement('input'); input.type = 'range'; input.id = `control-${i}`; input.min = cfg[3]; input.max = cfg[4]; input.value = cfg[5]; input.setAttribute('aria-describedby', `readout-${i}`);
  const output = document.createElement('output'); output.htmlFor = input.id;
  const readout = document.createElement('p'); readout.className = 'readout'; readout.id = `readout-${i}`; readout.setAttribute('aria-live', 'polite');
  const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'reset'; reset.textContent = 'Reset'; reset.addEventListener('click', () => { input.value = cfg[5]; update(); input.focus(); });
  controls.append(label, input, output, reset); card.append(title, description, canvas, controls, readout); root.append(card);
  function update() { const value = Number(input.value); output.textContent = `${value}% c`; readout.textContent = paints[i](canvas, value / 100); }
  input.addEventListener('input', update); update();
});

const backendStatus = document.querySelector('#backend-status');
const gpuDemo = document.querySelector('#gpu-demo');
gpuDemo.addEventListener('click', async () => {
  gpuDemo.disabled = true; backendStatus.textContent = 'Initializing optional batch backend…';
  try {
    const backend = await createComputeBackend();
    const samples = Array.from({length:4096},(_,i)=>new Event(i/1000,Math.sin(i/25),Math.cos(i/25),0));
    const result = await backend.transformEventsBatch(samples,LorentzTransform.fromVelocity(.25*DEFAULT_C,0,0));
    backendStatus.textContent = result.backend === 'webgpu' ? `WebGPU batch complete · ${result.events.length.toLocaleString()} events · Float32 approximate` : `CPU Float64 fallback active · ${result.events.length.toLocaleString()} events · ${result.fallback ?? 'WebGPU unavailable'}`;
    await backend.dispose();
  } catch { backendStatus.textContent = 'CPU Float64 reference backend active · GPU batch unavailable'; }
  finally { gpuDemo.disabled = false; }
});

function setup(canvas) {
  const ctx = canvas.getContext('2d'); const w = canvas.width; const h = canvas.height;
  ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#0a1722'; ctx.fillRect(0, 0, w, h); ctx.font = '16px system-ui'; ctx.lineWidth = 2;
  ctx.strokeStyle = '#294354'; ctx.fillStyle = '#a9c0ce';
  return { ctx, w, h, x: (v) => 50 + (v + 1) * (w - 100) / 2, y: (v) => h - 38 - (v + 1) * (h - 76) / 2, axis() { ctx.beginPath(); ctx.moveTo(45, h / 2); ctx.lineTo(w - 25, h / 2); ctx.moveTo(w / 2, h - 25); ctx.lineTo(w / 2, 25); ctx.stroke(); ctx.fillText('space x', w - 85, h / 2 - 8); ctx.fillText('time ct', w / 2 + 8, 35); }, line(x1, y1, x2, y2, color, width = 3) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(this.x(x1), this.y(y1)); ctx.lineTo(this.x(x2), this.y(y2)); ctx.stroke(); }, point(x, y, color = '#ffbd69') { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(this.x(x), this.y(y), 7, 0, Math.PI * 2); ctx.fill(); } };
}
function drawMinkowski(canvas, t) { const s = setup(canvas); s.axis(); s.line(-.9,-.9,.9,.9,'#53d9c3'); s.line(-.9,.9,.9,-.9,'#53d9c3'); s.point(.35,t*1.5-.75); const e = new Event(t*2-1,.35,0,0); const ref = new Event(0,0,0,0); return `Event separation is ${classifySeparation(e,ref)}; interval squared = ${intervalSquared(e,ref).toFixed(3)} normalized units².`; }
function drawBoost(canvas, b) { const s=setup(canvas); s.axis(); const edge=.75; s.line(0,-.9,0,.9,'#53d9c3'); if (b>0.04) s.line(-b*edge,-edge,b*edge,edge,'#79aaff'); s.line(-edge,-b*edge,edge,b*edge,'#ffbd69'); const transformed=LorentzTransform.fromVelocity(b,0,0,1).apply(new Event(.8,.3,0,0)); return `β=${b.toFixed(2)}, γ=${(1/Math.sqrt(1-b*b)).toFixed(3)}. Blue line is the moving origin worldline; amber line is the moving frame's simultaneity axis. Event (ct=0.80,x=0.30) maps to (ct′=${transformed.ct.toFixed(3)},x′=${transformed.x.toFixed(3)}).`; }
function drawSimultaneity(canvas,b) { const s=setup(canvas); s.axis(); const t=.35; const g=1/Math.sqrt(1-b*b); s.line(-.8,g*(t-b*(-.8)),.8,g*(t-b*.8),'#ffbd69'); s.line(-.85,-.85,.85,.85,'#53d9c3'); s.point(-.6,t,'#53d9c3'); s.point(.6,t,'#79aaff'); const dt=-1.2*b*g; return `Two events simultaneous in this frame and separated by 1.2 space units differ in boosted time by ${dt.toFixed(3)} units.`; }
function drawClock(canvas,b) { const s=setup(canvas); s.axis(); s.line(-b*.45,-.8,0,0,'#79aaff'); s.line(0,0,-b*.45,.8,'#ffbd69'); const outbound=properTime(new Event(0,0,0,0),new Event(1,b,0,0),1); const returnLeg=properTime(new Event(1,b,0,0),new Event(2,0,0,0),1); return `Piecewise inertial round trip: coordinate time=2.000 units; proper time=${(outbound+returnLeg).toFixed(3)} units (${outbound.toFixed(3)} per leg).`; }
function drawRod(canvas,b) { const s=setup(canvas); s.axis(); const g=1/Math.sqrt(1-b*b); const L=1/g; s.line(-.65,0,.65,0,'#53d9c3',8); s.line(-L/2,.35,L/2,.35,'#ffbd69',8); return `Rest length = 1.30 units; measured moving length = ${(1.3/g).toFixed(3)} units at equal observer-frame time.`; }
function drawVelocity(canvas,b) { const s=setup(canvas); s.axis(); const a=.55; const total=velocityAdd([a*c,0,0],[b*c,0,0],c)[0]; const classical=a+b; s.line(-.9,0,.9,0,'#294354'); s.point(a,0,'#53d9c3'); s.point(b,0,'#79aaff'); s.point(total,0,'#ffbd69'); return `u=${a.toFixed(2)}c, v=${b.toFixed(2)}c; Einstein composition=${total.toFixed(3)}c; classical sum=${classical.toFixed(3)}c.`; }
function drawDoppler(canvas,b) { const s=setup(canvas); s.axis(); const ratio=Math.sqrt((1+b)/(1-b)); const angle=Math.acos(b); s.line(-.7,0,.7,0,'#53d9c3'); s.line(0,0,.7*Math.cos(angle),.7*Math.sin(angle),'#ffbd69'); s.point(.55*Math.cos(angle),.55*Math.sin(angle)); return `Longitudinal approaching frequency ratio = ${ratio.toFixed(3)}; aberrated ray angle = ${(angle*180/Math.PI).toFixed(1)}°.`; }
function drawDisk(canvas,b) { const s=setup(canvas); s.axis(); s.ctx.strokeStyle='#294354'; s.ctx.beginPath(); s.ctx.arc(canvas.width/2,canvas.height/2,Math.min(canvas.width,canvas.height)*.36,0,Math.PI*2); s.ctx.stroke(); const other=[0,.55]; const result=velocityAdd([b,.0,0],[0,.55,0],1); s.point(b,0,'#53d9c3'); s.point(0,.55,'#79aaff'); s.point(result[0],result[1],'#ffbd69'); return `Inputs (${b.toFixed(2)}, 0)c and (0, ${other[1].toFixed(2)})c compose to (${result[0].toFixed(3)}, ${result[1].toFixed(3)})c.`; }
function drawEnergy(canvas,b) { const s=setup(canvas); s.axis(); const mass=1; const g=1/Math.sqrt(1-b*b); const momentum=g*mass*b; const p4=new FourVector(g*mass*DEFAULT_C, momentum*mass,0,0); const invariantMass=Math.sqrt(Math.max(0,-p4.normSquared()))/DEFAULT_C; s.line(-.8,-.8,.8,.8,'#294354'); s.point(momentum/2,g/2,'#ffbd69'); return `For m=1 kg and v=${b.toFixed(2)}c: E=${(p4.at(0)*DEFAULT_C).toExponential(2)} J; |p|=${(p4.at(1)*DEFAULT_C).toExponential(2)} kg·m/s; invariant mass=${invariantMass.toFixed(3)} kg.`; }
function drawTensor(canvas,b) { const s=setup(canvas); s.axis(); const transform=LorentzTransform.fromVelocity(b*DEFAULT_C,0,0); const tensor=new Tensor([4,4],[1,0,0,0,0,2,0,0,0,0,3,0,0,0,0,4],['up','down']); const changed=tensor.transform(transform); const trace=tensor.contract(0,1).at(); const after=changed.contract(0,1).at(); s.point(-.4,.55,'#53d9c3'); s.point(.4,.55,'#ffbd69'); return `Mixed-tensor trace before=${trace.toFixed(3)}, after=${after.toFixed(3)}.`; }
