import { rgbToOklch, oklchToRgb, hexToRgb, rgbToHex } from '../src/art/color.js';
const P = [
  ['ape fur -1',   '#4a413a','#34302d', 0.817],
  ['ape skin -',   '#f2c08e','#dba977', 0.915],
  ['monkey fur -1','#a25b15','#794715', 0.826],
  ['monkey fur -2','#a25b15','#6e3e0e', 0.763],
  ['kong fur -2',  '#57595d','#383a40', 0.752],
  ['kong fur +1',  '#57595d','#60616a', 1.067],
  ['kong fur +2',  '#57595d','#747884', 1.237],
  ['kong crown +', '#493b29','#6b5c4f', 1.341],
  ['kong face +',  '#554e47','#6d6561', 1.197],
  ['monkey face +','#dedfdc','#fffffd', 1.108],
];
const SAT = new Set(['monkey fur -1','monkey fur -2','ape skin -','kong crown +']);
const dE=(a,b)=>{const[L1,C1,h1]=rgbToOklch(hexToRgb(a)),[L2,C2,h2]=rgbToOklch(hexToRgb(b));
  const a1=C1*Math.cos(h1*Math.PI/180),b1=C1*Math.sin(h1*Math.PI/180);
  const a2=C2*Math.cos(h2*Math.PI/180),b2=C2*Math.sin(h2*Math.PI/180);
  return Math.hypot(L1-L2,a1-a2,b1-b2);};
const apply=(hex,mul,exp)=>{const[L,C,h]=rgbToOklch(hexToRgb(hex));return rgbToHex(oklchToRgb([L*mul,C*mul**exp,h]));};
console.log('exp    all: max / mean      saturated-only: max / mean');
for(const exp of [0,0.4,0.6,0.8,1.0,1.25,1.5]){
  const all=P.map(([n,a,b,m])=>dE(apply(a,m,exp),b));
  const sat=P.filter(p=>SAT.has(p[0])).map(([n,a,b,m])=>dE(apply(a,m,exp),b));
  const f=(x)=>x.toFixed(4);
  console.log(`${String(exp).padEnd(6)} ${f(Math.max(...all))} / ${f(all.reduce((a,b)=>a+b)/all.length)}     ${f(Math.max(...sat))} / ${f(sat.reduce((a,b)=>a+b)/sat.length)}`);
}
