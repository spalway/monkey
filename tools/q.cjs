function quantize(img, tol = 26) {
  const counts = new Map();
  for (let i = 0; i < img.w * img.h; i++) {
    const k = (img.rgba[i*4]<<16)|(img.rgba[i*4+1]<<8)|img.rgba[i*4+2];
    counts.set(k, (counts.get(k)||0)+1);
  }
  const sorted = [...counts].sort((a,b)=>b[1]-a[1]);
  const centers = [];
  for (const [k,n] of sorted) {
    const r=k>>16,g=(k>>8)&255,b=k&255;
    const hit = centers.find(c=>Math.abs(c.r-r)+Math.abs(c.g-g)+Math.abs(c.b-b)<tol);
    if (hit) hit.n+=n; else centers.push({r,g,b,n});
  }
  const lut = new Map();
  for (const [k] of sorted) {
    const r=k>>16,g=(k>>8)&255,b=k&255;
    let best=0,bd=Infinity;
    centers.forEach((c,i)=>{const d=(c.r-r)**2+(c.g-g)**2+(c.b-b)**2; if(d<bd){bd=d;best=i;}});
    lut.set(k,best);
  }
  const idx = new Uint16Array(img.w*img.h);
  for (let i=0;i<img.w*img.h;i++){
    const k=(img.rgba[i*4]<<16)|(img.rgba[i*4+1]<<8)|img.rgba[i*4+2];
    idx[i]=lut.get(k);
  }
  return { centers, idx };
}
function energy(idx,w,h,axis){
  const n=axis==='x'?w:h,m=axis==='x'?h:w;
  const e=new Float64Array(n);
  for(let i=1;i<n;i++){let c=0;
    for(let j=0;j<m;j++){
      const a=axis==='x'?idx[j*w+i]:idx[i*w+j];
      const b=axis==='x'?idx[j*w+i-1]:idx[(i-1)*w+j];
      if(a!==b)c++;
    } e[i]=c;}
  return e;
}
function peaks(e,minFrac=0.12){
  const max=Math.max(...e); const out=[];
  for(let i=1;i<e.length-1;i++)
    if(e[i]>=minFrac*max&&e[i]>=e[i-1]&&e[i]>=e[i+1]&&(out.length===0||i-out[out.length-1]>=2)) out.push(i);
  return out;
}
module.exports={quantize,energy,peaks};
