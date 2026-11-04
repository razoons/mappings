import { validateTargets } from './rules.js';
import { evaluateGraph } from './graph.js';
import { demoGraph } from './demo.js';
const { nodes, edges } = demoGraph();
const r = validateTargets(nodes, edges);
console.log('contrôles :', r.list.length ? r.list.map((i) => `${i.level} ${i.path ?? ''}: ${i.message}`).join('\n  ') : 'OK');
const ev = evaluateGraph(nodes, edges);
const t = ev.targets?.get?.('slip') ?? ev.targets?.slip;
console.log(JSON.stringify(t?.document ?? t?.value ?? t, null, 2)?.slice(0, 2000));
