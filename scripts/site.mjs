import { createServer } from 'node:http';
import { stat, readFile, mkdir, cp } from 'node:fs/promises';
import { dirname, resolve, join, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

function openPreview(url) {
  if(process.platform!=='win32') return;
  const child=spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{detached:true,stdio:'ignore'});
  child.on('error',error=>console.error(`Open ${url} in your browser: ${error.message}`));
  child.unref();
}

export const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};

export function createSiteServer(root = siteRoot) {
  return createServer(async (req,res)=>{
    if(!['GET','HEAD'].includes(req.method)) {res.writeHead(405,{'Allow':'GET, HEAD'});res.end('Method not allowed');return;}
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const relative=pathname==='/'?'index.html':pathname.slice(1);
      if(relative.split(/[\\/]/).some(part=>part.startsWith('.'))) {res.writeHead(403);res.end('Forbidden');return;}
      if(!/^(index\.html|(?:css|js|assets)\/[^\0]+)$/.test(relative)) {res.writeHead(404);res.end('Not found');return;}
      const target=resolve(root,relative);
      if(!target.startsWith(resolve(root)+sep)) {res.writeHead(403);res.end('Forbidden');return;}
      const info=await stat(target);
      if(!info.isFile()){res.writeHead(404);res.end('Not found');return;}
      const body=await readFile(target);
      res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream','Content-Length':body.length,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
      res.end(req.method==='HEAD'?undefined:body);
    }catch(error){res.writeHead(error instanceof URIError?400:404);res.end('Not found');}
  });
}

export async function build() {
  const dist=join(siteRoot,'dist');
  await mkdir(dist,{recursive:true});
  for(const asset of ['index.html','css','js','assets','.nojekyll']){
    await cp(join(siteRoot,asset),join(dist,asset),{recursive:true});
  }
  console.log(`Static build ready: ${dist}`);
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(process.argv[2]==='build') await build();
  else {
    const port=Number(process.env.PORT||4173);
    const url=`http://127.0.0.1:${port}/`;
    const server=createSiteServer();
    server.listen(port,'127.0.0.1',()=>{
      console.log(`Portfolio running at ${url}`);
      if(process.argv.includes('--open'))openPreview(url);
    });
    for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
    server.on('error',async error=>{
      if(error.code==='EADDRINUSE' && process.argv.includes('--open')){
        try{
          const response=await fetch(url,{signal:AbortSignal.timeout(2500)});
          if((await response.text()).includes('<title>Tushant — Ideas into systems</title>')){
            console.log(`Your portfolio is already running at ${url}`);openPreview(url);return;
          }
        }catch{/* Another process is using the port. */}
      }
      console.error(error.message);process.exitCode=1;
    });
  }
}
