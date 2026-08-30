// The ape's frame 3 sits 2 rows lower than the others when the feet are aligned.
// Render the cycle both ways: ground-aligned (a body bob) and head-aligned (no bob).
const fs=require('fs');
const {encodePNG}=require('./encode.cjs');
const hx=(c)=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];
const A=JSON.parse(fs.readFileSync('art/ape-frames.json','utf8'));
const src=fs.readFileSync('src/art/sprites.js','utf8').split('export const ape = {')[1];
const roles=[...(/slots: \[(.*?)\]\]/s.exec(src)[1].matchAll(/\['(\w+)'/g))].map(m=>m[1]);
const skin=new Set(roles.map((r,i)=>r==='skin'?i:-1).filter(i=>i>=0));
const headTop=(f)=>{for(let y=0;y<A.h;y++)for(let x=0;x<A.w;x++) if(skin.has(f[y][x])) return y; return 0;};
const tops=A.frames.map(headTop);
const shift=tops.map(t=>tops[0]-t); // head-aligned offsets
console.log('head top rows:', tops.join(', '), ' -> head-align shifts', shift.join(', '));

const pal=A.palette.map(hx), scale=6, gap=3, N=A.frames.length;
const W=(A.w*N+gap*(N-1))*scale, H=(A.h*2+gap)*scale;
const buf=Buffer.alloc(W*H*4,0);
const put=(px,py,c)=>{for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
  const x=px*scale+dx,y=py*scale+dy;if(x<0||y<0||x>=W||y>=H)return;
  const o=(y*W+x)*4;buf[o]=c[0];buf[o+1]=c[1];buf[o+2]=c[2];buf[o+3]=255;}};
A.frames.forEach((f,i)=>{
  const ox=i*(A.w+gap);
  for(let y=0;y<A.h;y++)for(let x=0;x<A.w;x++){
    put(ox+x,y,pal[f[y][x]]);                                   // row 1: ground aligned
    const sy=y-shift[i];
    put(ox+x,A.h+gap+y, (sy>=0&&sy<A.h)?pal[f[sy][x]]:[0,0,0]); // row 2: head aligned
  }
});
fs.writeFileSync('samples/ape-vertical.png',encodePNG(W,H,buf));
console.log('samples/ape-vertical.png  top row = ground aligned, bottom row = head aligned');
