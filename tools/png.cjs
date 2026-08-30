const fs = require('fs');
const zlib = require('zlib');

function decodePNG(path) {
  const buf = fs.readFileSync(path);
  let p = 8;
  let w, h, bitDepth, colorType, interlace;
  let idat = [];
  let palette = null, trns = null;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.slice(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (interlace) throw new Error('interlaced not supported');
  if (bitDepth !== 8) throw new Error('bitDepth ' + bitDepth + ' not supported');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  const bpp = channels;
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[pos++];
    const line = raw.slice(pos, pos + stride); pos += stride;
    const cur = out.slice(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      switch (filter) {
        case 0: break;
        case 1: v = v + a; break;
        case 2: v = v + b; break;
        case 3: v = v + ((a + b) >> 1); break;
        case 4: {
          const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
          v = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); break;
        }
      }
      cur[i] = v & 0xff;
    }
  }
  // to RGBA
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let r, g, b, a = 255;
    const o = i * bpp;
    if (colorType === 6) { r = out[o]; g = out[o+1]; b = out[o+2]; a = out[o+3]; }
    else if (colorType === 2) { r = out[o]; g = out[o+1]; b = out[o+2]; }
    else if (colorType === 0) { r = g = b = out[o]; }
    else if (colorType === 4) { r = g = b = out[o]; a = out[o+1]; }
    else if (colorType === 3) { const idx = out[o]; r = palette[idx*3]; g = palette[idx*3+1]; b = palette[idx*3+2]; if (trns && idx < trns.length) a = trns[idx]; }
    rgba[i*4] = r; rgba[i*4+1] = g; rgba[i*4+2] = b; rgba[i*4+3] = a;
  }
  return { w, h, rgba, colorType, bitDepth };
}
module.exports = { decodePNG };
