const fs=require('fs');
const {decodePNG}=require('./png.cjs');
const {encodePNG}=require('./encode.cjs');
const [file,X,Y,W,H,Z,out]=process.argv.slice(2);
const img=decodePNG(file);
const x0=+X,y0=+Y,w=+W,h=+H,z=+Z;
const buf=Buffer.alloc(w*z*h*z*4);
for(let y=0;y<h*z;y++)for(let x=0;x<w*z;x++){
  const sx=x0+Math.floor(x/z), sy=y0+Math.floor(y/z);
  const o=(y*w*z+x)*4;
  if(sx<0||sy<0||sx>=img.w||sy>=img.h){buf[o+3]=255;continue;}
  const s=(sy*img.w+sx)*4;
  buf[o]=img.rgba[s];buf[o+1]=img.rgba[s+1];buf[o+2]=img.rgba[s+2];buf[o+3]=255;
}
fs.writeFileSync(out,encodePNG(w*z,h*z,buf));
console.log(out,`${w*z}x${h*z} from ${file} at ${x0},${y0}`);
