const zlib = require('zlib');
function crc32(buf){
  let c, t=[];
  for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c;}
  let crc=0xffffffff;
  for(let i=0;i<buf.length;i++)crc=t[(crc^buf[i])&0xff]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
}
function chunk(type,data){
  const len=Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td=Buffer.concat([Buffer.from(type,'ascii'),data]);
  const crc=Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len,td,crc]);
}
// rgba: Buffer of w*h*4
function encodePNG(w,h,rgba){
  const stride=w*4;
  const raw=Buffer.alloc(h*(stride+1));
  for(let y=0;y<h;y++){
    raw[y*(stride+1)]=0;
    rgba.copy(raw,y*(stride+1)+1,y*stride,(y+1)*stride);
  }
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4);
  ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
    chunk('IHDR',ihdr),
    chunk('IDAT',zlib.deflateSync(raw,{level:9})),
    chunk('IEND',Buffer.alloc(0)),
  ]);
}
module.exports={encodePNG};
