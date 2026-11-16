import fs from 'fs';
const m = await import('/home/user/revela/vendor/libheif-bundle.mjs');
const lib = await new Promise((res)=>{ let mod; mod = m.default({ onRuntimeInitialized(){ setTimeout(()=>res(mod)); } }); });
for (const f of process.argv.slice(2)) {
  const imgs = new lib.HeifDecoder().decode(new Uint8Array(fs.readFileSync(f)));
  const im = imgs[0], w = im.get_width(), h = im.get_height();
  const d = await new Promise((res,rej)=> im.display({data:new Uint8ClampedArray(w*h*4),width:w,height:h},(x)=>x?res(x):rej(new Error('falha'))));
  fs.writeFileSync(f.replace(/\.HEIC$/i,'.rgba'), Buffer.from(d.data.buffer));
  fs.writeFileSync(f.replace(/\.HEIC$/i,'.json'), JSON.stringify({w,h}));
  console.log(f,w,h);
}
