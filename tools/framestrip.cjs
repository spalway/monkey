// Frames plus an alignment overlay: frame 1 red, current frame cyan, both grey.
// The body should be solid grey and only the limbs should show colour.
const fs=require('fs');
const {encodePNG}=require('./encode.cjs');
const hx=(c)=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];
const NAMES=process.argv.slice(2);
const scale=5,gap=3;
const sets=NAMES.map(n=>JSON.parse(fs.readFileSync(`art/${n}-frames.json`,'utf8')));
const cols=Math.max(...sets.map(a=>a.frames.length));
const cw=Math.max(...sets.map(a=>a.w)), chh=Math.max(...sets.map(a=>a.h));
const W=(cw*cols+gap*(cols-1))*scale, H=(chh*2*sets.length+gap*(2*sets.length-1))*scale;
const buf=Buffer.alloc(W*H*4,0);
const put=(px,py,c)=>{for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
  const x=px*scale+dx,y=py*scale+dy;if(x<0||y<0||x>=W||y>=H)return;
  const o=(y*W+x)*4;buf[o]=c[0];buf[o+1]=c[1];buf[o+2]=c[2];buf[o+3]=255;}};
sets.forEach((A,si)=>{
  const pal=A.palette.map(hx);
  A.frames.forEach((f,i)=>{
    const ox=i*(cw+gap), oy=si*2*(chh+gap);
    for(let y=0;y<A.h;y++)for(let x=0;x<A.w;x++) put(ox+x,oy+y,pal[f[y][x]]);
    for(let y=0;y<A.h;y++)for(let x=0;x<A.w;x++){
      const a=A.frames[0][y][x]!==0, b=f[y][x]!==0;
      put(ox+x,oy+chh+gap+y, a&&b?[130,130,130]:a?[200,40,40]:b?[40,190,200]:[12,12,14]);
    }
  });
  console.log(`${NAMES[si]}: ${A.frames.length} frames, ${A.w}x${A.h}`);
});
fs.writeFileSync('samples/walk-frames.png',encodePNG(W,H,buf));
console.log(`samples/walk-frames.png ${W}x${H}`);
