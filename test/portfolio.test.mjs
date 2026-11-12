import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { escapeHtml, repoUrl, isRepoList, normaliseRepos, filterProjects, inferCategory, readCache, writeCache, CACHE_KEY, CACHE_TTL, safeContactLinks, formatDate, fetchGitHub } from '../js/lib.js';
import { curated, fallbackRepos, profile } from '../js/data.js';
import { createScene } from '../js/scene.js';
import { createSiteServer, siteRoot } from '../scripts/site.mjs';

const repo=(name,extra={})=>({name,language:'TypeScript',stargazers_count:2,pushed_at:'2026-11-03T12:00:00Z',...extra});
const store=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
const data={savedAt:1000,repos:[repo('payproof')],user:{public_repos:14}};

test('escapes all HTML attribute and text boundaries',()=>{
  assert.equal(escapeHtml(`<img src="x" onerror='alert(1)'>&`),'&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;');
  assert.equal(escapeHtml(null),'');
});
test('repository URLs are constructed for the expected owner, never trusted from API',()=>{
  assert.equal(repoUrl('hello-world'),'https://github.com/TUSHANT-CSE/hello-world');
  const [p]=normaliseRepos([repo('safe',{html_url:'javascript:alert(1)'})],{});
  assert.equal(p.url,'https://github.com/TUSHANT-CSE/safe');
});
test('rejects malformed repository responses and invalid names',()=>{
  assert.equal(isRepoList({message:'Bad credentials'}),false);
  assert.equal(isRepoList([null]),false);
  assert.equal(isRepoList([repo('../evil')]),false);
  assert.equal(isRepoList([repo('repo.github.io')]),true);
});
test('curation keeps empty/duplicate repos hidden and removes forks/archives',()=>{
  const list=normaliseRepos([repo('M.L'),repo('tushantDSA2'),repo('fork',{fork:true}),repo('archive',{archived:true}),repo('payproof')],curated);
  assert.deepEqual(list.map(p=>p.name),['payproof']);
});
test('deduplicates repository rows and orders flagship before new projects',()=>{
  const list=normaliseRepos([repo('new'),repo('payproof'),repo('new')],curated);
  assert.deepEqual(list.map(p=>p.name),['payproof','new']);
});
test('new unknown repositories are included with honest fallback description',()=>{
  const [p]=normaliseRepos([repo('pulse',{description:null})],curated);
  assert.equal(p.title,'pulse');
  assert.match(p.description,/new experiment/);
  assert.deepEqual(p.tags,['TypeScript']);
});
test('language infers categories and curated categories override language',()=>{
  assert.equal(inferCategory('Python'),'data');
  assert.equal(inferCategory('HTML'),'frontend');
  assert.equal(inferCategory(null),'backend');
  const [p]=normaliseRepos([repo('webdevassgn3',{language:'JavaScript'})],curated);
  assert.equal(p.category,'backend');
});
test('search and category filters compose and search tags case-insensitively',()=>{
  const list=normaliseRepos(fallbackRepos,curated);
  assert.equal(filterProjects(list,'backend',' postgres ')[0].name,'payproof');
  assert.equal(filterProjects(list,'frontend','postgres').length,0);
  assert.ok(filterProjects(list,'all','PYTHON').length>0);
  assert.equal(filterProjects(list,'all','unfindable-code-name').length,0);
});
test('cache distinguishes fresh, stale and future entries',()=>{
  const s=store();writeCache(s,data);
  assert.equal(readCache(s,1001).fresh,true);
  assert.equal(readCache(s,1000+CACHE_TTL).fresh,false);
  assert.equal(readCache(s,999),null);
});
test('corrupt and blocked cache storage never breaks the portfolio',()=>{
  const s=store();s.setItem(CACHE_KEY,'{broken');assert.equal(readCache(s),null);
  assert.equal(readCache({getItem(){throw Error('blocked');}}),null);
  assert.equal(writeCache({setItem(){throw Error('quota');}},data),false);
});
test('empty contact fields remain hidden; real links have safe protocols',()=>{
  assert.deepEqual(safeContactLinks(profile.links),[]);
  assert.equal(safeContactLinks({email:'hello@example.com',linkedin:'https://www.linkedin.com/in/example/'}).length,2);
  assert.deepEqual(safeContactLinks({email:'hello@example.com?bcc=evil',linkedin:'javascript:alert(1)'}),[]);
  assert.deepEqual(safeContactLinks({linkedin:'https://linkedin.com.evil.test/in/example'}),[]);
});
test('invalid dates and star counts are safe',()=>{
  assert.equal(formatDate('wrong'),'Date unavailable');
  assert.equal(normaliseRepos([repo('sample',{stargazers_count:-5})],{})[0].stars,0);
});
test('fetchGitHub validates live response shape',async()=>{
  const urls=[];
  const fake=async url=>{urls.push(url);return {ok:true,json:async()=>url.includes('/repos?')?[repo('sample')]:{public_repos:1}};};
  const d=await fetchGitHub(fake);
  assert.equal(d.repos[0].name,'sample');assert.equal(urls.length,2);assert.ok(d.savedAt>0);
});
test('fetchGitHub paginates instead of losing repos after the first 100',async()=>{
  const fake=async url=>({ok:true,json:async()=>url.includes('page=2')?[repo('final')]:url.includes('/repos?')?Array.from({length:100},(_,i)=>repo(`r${i}`)):{public_repos:101}});
  assert.equal((await fetchGitHub(fake)).repos.length,101);
});
test('rate limits and unexpected API payloads return errors for fallback UI',async()=>{
  await assert.rejects(fetchGitHub(async()=>({ok:false,status:403})),/limit/);
  await assert.rejects(fetchGitHub(async()=>({ok:true,json:async()=>({})})),/Unexpected/);
});
test('request cancellation propagates',async()=>{
  const controller=new AbortController();controller.abort();
  await assert.rejects(fetchGitHub(async(url,opts)=>{opts.signal.throwIfAborted();},controller.signal),{name:'AbortError'});
});
test('scene gracefully degrades without Canvas or a rendering context',()=>{
  assert.doesNotThrow(()=>createScene(null).destroy());
  const scene=createScene({getContext:()=>null});scene.setPaused(true);scene.destroy();
});
test('static HTML has accessible navigation, metadata and real flagship link',async()=>{
  const html=await readFile(join(siteRoot,'index.html'),'utf8');
  assert.match(html,/name="viewport"/);assert.match(html,/class="skip-link"/);
  assert.match(html,/aria-controls="mobile-nav"/);assert.match(html,/aria-pressed="false"/);
  assert.match(html,/https:\/\/github.com\/TUSHANT-CSE\/payproof/);
  assert.doesNotMatch(html,/(?:href|src)="(?:#|javascript:|https:\/\/example\.com)"/);
});
test('all local HTML assets exist',async()=>{
  const html=await readFile(join(siteRoot,'index.html'),'utf8');
  const files=[...html.matchAll(/(?:href|src)="(\.\/[^"#]+)"/g)].map(m=>m[1]);
  assert.ok(files.length>=3);
  for(const file of files)assert.equal((await stat(join(siteRoot,file))).isFile(),true);
});
test('HTTP flow serves the home, modules, CSS and favicon with correct MIME',async()=>{
  const server=createSiteServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    for(const [file,type] of [['/','text/html'],['/js/app.js','text/javascript'],['/css/style.css','text/css'],['/assets/favicon.svg','image/svg+xml']]){
      const r=await fetch(base+file);assert.equal(r.status,200);assert.ok(r.headers.get('content-type').startsWith(type));assert.ok((await r.text()).length>10);
    }
    const head=await fetch(base+'/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('HTTP flow blocks non-assets, traversal, unknown routes and POST writes',async()=>{
  const server=createSiteServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    for(const path of ['/package.json','/.env','/test/portfolio.test.mjs','/missing','/js/%2e%2e%2fpackage.json'])assert.ok((await fetch(base+path)).status>=400);
    const r=await fetch(base+'/',{method:'POST'});assert.equal(r.status,405);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
