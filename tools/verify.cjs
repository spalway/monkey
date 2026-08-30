const fs=require('fs');
const { decodePNG } = require('./png.cjs');
const { hex } = require('./render.cjs');

for(const name of process.argv.slice(2)){
  const art=JSON.parse(fs.readFileSync(`art/${name}.json`,'utf8'));
  const img=decodePNG(`images/${name}.png`);
  const pal=art.palette.map(hex);
  // recover grid geometry the same way extract did: bbox of non-black
  let x0=1e9,y0=1e9,x1=-1,y1=-1;
  for(let y=0;y<img.h;y++)for(let x=0;x<img.w;x++){
    const o=(y*img.w+x)*4;
    if(img.rgba[o]+img.rgba[o+1]+img.rgba[o+2] > 24){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
  }
  const cw=(x1+1-x0)/art.w, ch=(y1+1-y0)/art.h;
  let close=0,far=0,tot=0,sum=0;
  for(let y=0;y<img.h;y++)for(let x=0;x<img.w;x++){
    const cx=Math.floor((x-x0)/cw), cy=Math.floor((y-y0)/ch);
    const inside = cx>=0&&cy>=0&&cx<art.w&&cy<art.h;
    const [pr,pg,pb] = inside ? pal[art.rows[cy][cx]] : [0,0,0];
    const o=(y*img.w+x)*4;
    const d=Math.abs(img.rgba[o]-pr)+Math.abs(img.rgba[o+1]-pg)+Math.abs(img.rgba[o+2]-pb);
    tot++; sum+=d;
    if(d<=30)close++; else if(d>90)far++;
  }
  console.log(`${name}: ${(100*close/tot).toFixed(2)}% pixels within tol,  ${(100*far/tot).toFixed(2)}% badly off,  mean |dRGB|=${(sum/tot).toFixed(2)}`);
}
