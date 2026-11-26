import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
const assets={};
const types={html:'text/html; charset=utf-8',js:'text/javascript',css:'text/css',jpg:'image/jpeg',ttf:'font/ttf',woff2:'font/woff2',json:'application/json'};
async function collect(dir){
 for(const entry of await fs.readdir(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory())await collect(file);
  else assets['/'+path.relative('out',file)]=[types[file.split('.').pop()]||'application/octet-stream',(await fs.readFile(file)).toString('base64')];
 }
}
await collect('out');
await fs.mkdir('dist/.openai',{recursive:true});
await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');
await build({stdin:{contents:`import {api} from './lib/api.js';const assets=${JSON.stringify(assets)};export default {async fetch(req,env){const p=new URL(req.url).pathname;if(p.startsWith('/api/'))return api(req,env);const a=assets[p==='/'?'/index.html':p];if(!a)return new Response('Página no encontrada',{status:404});return new Response(Uint8Array.from(atob(a[1]),c=>c.charCodeAt(0)),{headers:{'Content-Type':a[0]}})}}`,resolveDir:process.cwd()},platform:'browser',conditions:['worker','browser'],format:'esm',bundle:true,minify:true,outfile:'dist/server/index.js'});
