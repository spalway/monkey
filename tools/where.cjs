const fs=require('fs');
for(const name of process.argv.slice(2)){
  const art=JSON.parse(fs.readFileSync(`art/${name}.json`,'utf8'));
  console.log(`\n=== ${name} ${art.w}x${art.h}`);
  art.palette.forEach((hex,i)=>{
    const pts=[];
    for(let y=0;y<art.h;y++)for(let x=0;x<art.w;x++) if(art.rows[y][x]===i) pts.push([x,y]);
    if(pts.length>60) { console.log(`  [${i}] ${hex} ${pts.length} cells (bulk)`); return; }
    const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
    // what colors surround it
    const nb=new Map();
    for(const [x,y] of pts) for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy; if(nx<0||ny<0||nx>=art.w||ny>=art.h)continue;
      const v=art.rows[ny][nx]; if(v!==i) nb.set(v,(nb.get(v)||0)+1);
    }
    const nbs=[...nb].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([v,c])=>`${art.palette[v]}x${c}`).join(' ');
    console.log(`  [${i}] ${hex} ${pts.length} cells  x:${Math.min(...xs)}-${Math.max(...xs)} y:${Math.min(...ys)}-${Math.max(...ys)}  neighbors: ${nbs}`);
  });
}
