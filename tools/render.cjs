const fs = require('fs');
const { encodePNG } = require('./encode.cjs');

function hex(h){ return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]; }

function render(art, scale, palette, transparentIndex = 0) {
  const W=art.w*scale, H=art.h*scale;
  const buf=Buffer.alloc(W*H*4);
  const pal=(palette||art.palette).map(hex);
  for(let y=0;y<art.h;y++) for(let x=0;x<art.w;x++){
    const pi=art.rows[y][x];
    const [r,g,b]=pal[pi]||[255,0,255];
    const a = pi===transparentIndex ? 0 : 255;
    for(let dy=0;dy<scale;dy++) for(let dx=0;dx<scale;dx++){
      const o=(((y*scale+dy)*W)+(x*scale+dx))*4;
      buf[o]=r; buf[o+1]=g; buf[o+2]=b; buf[o+3]=a;
    }
  }
  return { W,H,buf };
}
module.exports={render,hex};

if (require.main === module) {
  fs.mkdirSync('art/preview',{recursive:true});
  for(const name of process.argv.slice(2)){
    const art=JSON.parse(fs.readFileSync(`art/${name}.json`,'utf8'));
    // opaque black bg for a like-for-like comparison against the source
    const r=render(art,8,null,-1);
    fs.writeFileSync(`art/preview/${name}-trace.png`,encodePNG(r.W,r.H,r.buf));
    console.log(`art/preview/${name}-trace.png  ${r.W}x${r.H}`);
  }
}
