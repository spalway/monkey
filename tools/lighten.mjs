import { rgbToOklch, oklchToRgb, hexToRgb, rgbToHex } from '../src/art/color.js';
const dE=(a,b)=>{const[L1,C1,h1]=rgbToOklch(hexToRgb(a)),[L2,C2,h2]=rgbToOklch(hexToRgb(b));
  const a1=C1*Math.cos(h1*Math.PI/180),b1=C1*Math.sin(h1*Math.PI/180);
  const a2=C2*Math.cos(h2*Math.PI/180),b2=C2*Math.sin(h2*Math.PI/180);
  return Math.hypot(L1-L2,a1-a2,b1-b2);};
const L=(h)=>rgbToOklch(hexToRgb(h))[0];
const PAIRS=[
  ['kong fur  +1','#57595d','#60616a'],
  ['kong fur  +2','#57595d','#747884'],
  ['kong crown +','#493b29','#6b5c4f'],
  ['kong crown++','#493b29','#77716b'],
  ['kong face  +','#554e47','#6d6561'],
  ['monkey face+','#dedfdc','#fffffd'],
];
console.log('pair           baseL   toneL   mul     t(toward white)');
for(const[n,a,b] of PAIRS){
  const la=L(a), lb=L(b);
  console.log(`${n}  ${la.toFixed(3)}   ${lb.toFixed(3)}   ${(lb/la).toFixed(3)}   ${((lb-la)/(1-la)).toFixed(4)}`);
}
// how well does a blend-toward-white reproduce each pair, and does it stay sane on pale fur?
const lighten=(hex,t)=>{const[l,c,h]=rgbToOklch(hexToRgb(hex));return rgbToHex(oklchToRgb([l+(1-l)*t,c,h]));};
console.log('\nfit check (t chosen per pair):');
for(const[n,a,b] of PAIRS){
  const t=(L(b)-L(a))/(1-L(a));
  console.log(`  ${n}  t=${t.toFixed(4)} -> ${lighten(a,t)} vs ${b}  dE=${dE(lighten(a,t),b).toFixed(4)}`);
}
console.log('\nextrapolation to pale fur, t=0.205 (the "light" step) then t=0.298 ("bright"):');
for(const f of ['#a9d8e8','#9ad12b','#d3a326','#dedfdc'])
  console.log(`  ${f} -> light ${lighten(f,0.205)}  bright ${lighten(f,0.298)}`);
