// Minimal no-dependency renderer contract smoke test.
// Run: node tests/compat_smoke.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web/subheader.js');
let code = fs.readFileSync(file, 'utf8');
code = code.replace(/^import \{ app \} from "\.\.\/\.\.\/scripts\/app\.js";\s*/m, '');
code = code.replaceAll('import.meta.url', JSON.stringify(pathToFileURL(file).href));

class Element {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.style = {}; this.dataset = {};
    this.parentElement = null; this.className = ''; this.textContent = ''; this.attrs = {}; this.classList = {add: () => {}, remove: () => {}}; }
  append(...kids) { kids.forEach(k => this.appendChild(k)); }
  appendChild(k) { if (k.parentElement) k.parentElement.removeChild(k); this.children.push(k); k.parentElement=this; return k; }
  removeChild(k) { const i=this.children.indexOf(k); if (i>=0) this.children.splice(i,1); k.parentElement=null; }
  replaceChildren(...kids) { for (const k of this.children) k.parentElement=null; this.children=[]; this.append(...kids); }
  insertBefore(child,before) { if(child.parentElement) child.parentElement.removeChild(child); const idx=before?this.children.indexOf(before):-1; if(idx<0)this.children.push(child);else this.children.splice(idx,0,child); child.parentElement=this; return child; }
  prepend(child){ this.insertBefore(child,this.children[0]||null); }
  matches(query){return query==='[data-testid="node-widget"]' && this.attrs['data-testid']==='node-widget';}
  querySelector(query){ if(query==='.sh-vue-visual' && this.children.some(c=>String(c.className).startsWith('sh-vue-visual')))return this.children[0];return null;}
  closest(query){ let n=this;while(n){if(n.matches(query))return n;n=n.parentElement;}return null;}
  get lastElementChild(){return this.children.at(-1) || null;}
  get firstElementChild(){return this.children[0] || null;}
  get nextElementSibling(){ if(!this.parentElement)return null;return this.parentElement.children[this.parentElement.children.indexOf(this)+1]||null; }
  addEventListener(){} setAttribute(k,v){this.attrs[k]=v;}
}
const grid = new Element();
const row = name => {const el=new Element();el.attrs['data-testid']='node-widget';el.label=name;grid.appendChild(el);return el;};
const native1=row('Input A'); const native2=row('Input B');
let vue = false;
const document={createElement: tag=>new Element(tag),head:new Element(),body:new Element(),
  querySelector: s=>s.startsWith('[data-testid="node-widget"]')&&vue?native1:null};
const extensions = [];
const app={rootGraph:null,canvas:{setDirty(){}},registerExtension(ext){extensions.push(ext)}};
// The external node's native widgets must not change order.
function SubgraphNode(){this.size=[360,220];this.widgets=[{name:'Input A'},{name:'Input B'}];}
SubgraphNode.prototype.isSubgraphNode=function(){return true;};
SubgraphNode.prototype.getLayoutWidgets=function(){return [...this.widgets];};
SubgraphNode.prototype.drawWidgets=function(){};
SubgraphNode.prototype.computeSize=function(){return [360,220];};
SubgraphNode.prototype.setDirtyCanvas=function(){};
SubgraphNode.prototype.addDOMWidget=function(name,type,element,options){
  const w={name,type,element,options};this.widgets.push(w);
  const r=row('visual');r.appendChild(element);return w;
};
const subgraph=new SubgraphNode();
const config=[
  {type:'header',position:2,text:'SAMPLING',textColor:'white',backgroundColor:'purple',alignment:'center'},
  {type:'line',position:3,color:'cyan',thickness:2}
];
subgraph.subgraph={nodes:[{id:5,type:'SubHeader', widgets:[{name:'configuration',value:JSON.stringify(config)}]}]};
app.rootGraph={_nodes:[subgraph]};
let tick;
const createTimer=fn=>{tick=fn;return 1;};
const compile = new Function('app','document','setTimeout','setInterval','requestAnimationFrame','ResizeObserver',code);
compile(app,document,()=>1,createTimer,fn=>fn(),class {observe(){} disconnect(){}});
const extension=extensions.find(ext=>ext.name==='ComfyUI.SubHeader');
assert.ok(extension, 'extension registers');
extension.setup();
// Legacy inserts visual widget descriptors into virtual layout, not node.widgets.
tick();
const legacy=subgraph.getLayoutWidgets();
assert.equal(legacy.length,4);
assert.equal(legacy[1].__subHeaderElement.text,'SAMPLING');
assert.equal(subgraph.widgets.length,2);
// Vue: new DOM widgets, existing native widget storage still first and unmoved.
vue=true;
tick();
assert.equal(subgraph.widgets.length,4);
assert.equal(subgraph.widgets[0].name,'Input A');
assert.equal(subgraph.widgets[1].name,'Input B');
assert.equal(subgraph.widgets[2].serialize,false);
assert.equal(subgraph.widgets[3].serialize,false);
assert.equal(grid.children[0],native1);
assert.equal(grid.children[1].children[0].className,'sh-vue-visual sh-vue-header');
assert.equal(grid.children[2],native2);
assert.equal(grid.children[3].children[0].className,'sh-vue-visual sh-vue-line');
assert.equal(subgraph.getLayoutWidgets().length,4,'legacy layout hides Vue placeholders');
// Change configuration and verify view changes without multiplying widgets.
config[0].text='SAMPLING / ADVANCED';
subgraph.subgraph.nodes[0].widgets[0].value=JSON.stringify(config);
tick();
assert.equal(subgraph.widgets.length,4);
assert.equal(subgraph.widgets[2].element.children[0].textContent,'SAMPLING / ADVANCED');
// Render switch must not duplicate decorators or break the old canvas layout.
vue=false;
tick();
assert.equal(subgraph.widgets.length,4);
assert.equal(subgraph.widgets[2].hidden,true);
assert.equal(subgraph.getLayoutWidgets().length,4);
// Switching back into Vue reuses the widget pair.
vue=true;
tick();
assert.equal(subgraph.widgets.length,4);
assert.equal(subgraph.widgets[2].hidden,false);
console.log('PASS: legacy layout, Vue row placement, non-serializing widgets, live edits, renderer switch');
