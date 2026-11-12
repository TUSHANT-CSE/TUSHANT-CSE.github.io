import { profile, featured, curated, caseStudies, fallbackRepos, fallbackUser, skills, lab, timeline } from './data.js';
import { escapeHtml as e, repoUrl, normaliseRepos, filterProjects, formatDate, readCache, writeCache, safeContactLinks, fetchGitHub } from './lib.js';
import { createScene } from './scene.js';

const $ = selector => document.querySelector(selector);
const root = document.documentElement;
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
let storage;
try { storage = localStorage; } catch { storage = {getItem:()=>null,setItem:()=>{}}; }
let userPaused = false;
try { userPaused = storage.getItem('tushant-motion') === 'paused'; } catch { /* Storage can be blocked. */ }
let scene;
let typingTimer;
let typingPhrase = 0;
let typingCount = profile.typed[0].length;
let deleting = false;
let currentProjects = [];
let currentRepos = fallbackRepos;
let category = 'all';
let expanded = false;
let loading = false;
let currentFetch;

const glyphs = {
  frontend:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/></svg>',
  backend:'<svg viewBox="0 0 24 24"><path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/></svg>',
  data:'<svg viewBox="0 0 24 24"><path d="M4 19V9m8 10V4m8 15v-7M2 21h20"/></svg>',
};

$('#feature-highlights').innerHTML = featured.highlights.map(h=>`<div class="highlight">${e(h.label)}<small>${e(h.detail)}</small></div>`).join('');
$('#featured-tags').innerHTML = featured.stack.map(s=>`<span>${e(s)}</span>`).join('');
$('#skills-grid').innerHTML = skills.map(s=>`<div class="skill-group"><h3>${e(s.group)}</h3><ul>${s.items.map(i=>`<li>${e(i)}</li>`).join('')}</ul></div>`).join('');
$('#journey').innerHTML = timeline.map(t=>`<div class="journey-step"><span class="when">${e(t.when)}</span><h3>${e(t.title)}</h3><p>${e(t.detail)}</p></div>`).join('');
$('#year').textContent = String(new Date().getFullYear());

const contactLinks = safeContactLinks(profile.links);
$('#contact-links').innerHTML += contactLinks.map(l=>`<a class="contact-other" href="${e(l.url)}" ${l.external?'target="_blank" rel="noopener noreferrer"':''}>${e(l.label)} <span aria-hidden="true">↗</span></a>`).join('');

function renderLab() {
  const names = new Set(currentRepos.filter(r=>!r.archived).map(r=>r.name.toLowerCase()));
  $('#lab-list').innerHTML = lab.map((p,index)=>{
    const built = names.has(p.name.toLowerCase());
    const state = built ? 'built' : p.status;
    return `<div class="lab-row"><span class="lab-number">0${index+1}</span><h3 class="lab-name">${built?`<a href="${e(repoUrl(p.name))}" target="_blank" rel="noopener noreferrer">${e(p.title)}</a>`:e(p.title)}</h3><p class="lab-pitch">${e(p.pitch)}</p><span class="lab-status ${state}">${built?'On GitHub':state==='next'?'Next experiment':'Planned'}</span><span class="lab-arrow" aria-hidden="true">${built?'↗':'—'}</span></div>`;
  }).join('');
}

const categoryLabels = { frontend: 'Interface', backend: 'Backend', data: 'Data & algorithms' };
function projectCover(p) {
  // Original schematic artwork, deliberately not presented as a screenshot or live data.
  const bars = [35, 58, 44, 77, 63, 90, 74].map(h=>`<i style="--bar:${h}%"></i>`).join('');
  const bar = `<div class="cover-bar"><i></i><i></i><i></i><span>${e(p.title)}</span></div>`;
  let art;
  if (p.category === 'backend') {
    art = `<div class="cover-window">${bar}<div class="cover-code"><span><b>GET</b> /records <em>200</em></span><span><b>POST</b> /records <em>201</em></span><span><b>PATCH</b> /records/:id <em>200</em></span><span><b>DELETE</b> /records/:id <em>204</em></span></div></div>`;
  } else if (p.category === 'data') {
    art = `<div class="cover-data">${bars}</div>`;
  } else {
    art = `<div class="cover-window">${bar}<div class="cover-dashboard"><div class="cover-sidebar"><i></i><i></i><i></i><i></i></div><div class="cover-panels"><i></i><i></i><i></i><div class="cover-chart">${bars}</div></div></div></div>`;
  }
  return `<div class="project-cover ${e(p.category)}" aria-hidden="true">${art}<span class="cover-label">ILLUSTRATIVE ${p.category==='backend'?'API SKETCH':p.category==='data'?'DATA STUDY':'INTERFACE STUDY'}</span></div>`;
}

function renderProjects() {
  const matched = filterProjects(currentProjects, category, $('#project-search').value);
  const visible = expanded ? matched : matched.slice(0,6);
  $('#project-grid').innerHTML = visible.map((p,i)=>`<article class="project-card">
    ${projectCover(p)}
    <div class="card-content">
      <div class="card-top"><span class="project-glyph ${e(p.category)}" aria-hidden="true">${glyphs[p.category]||glyphs.backend} ${e(categoryLabels[p.category]||'Experiment')}</span><span class="card-index">${String(i+1).padStart(2,'0')} / PROJECT</span></div>
      <h3><a href="${e(p.url)}" target="_blank" rel="noopener noreferrer">${e(p.title)} <span class="card-arrow" aria-hidden="true">↗</span></a></h3>
      <p>${e(p.description)}</p>
      <div class="tags">${p.tags.map(t=>`<span>${e(t)}</span>`).join('')}</div>
      <div class="card-bottom"><span><span class="language-dot" aria-hidden="true"></span>${e(p.language)}</span><span>${e(formatDate(p.pushedAt))}</span><span class="stars" title="${p.stars} GitHub stars"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/></svg><span class="sr-only">GitHub stars: </span>${p.stars}</span></div>
      <button class="card-details" data-project="${e(p.name)}" aria-label="Read about ${e(p.title)}">Behind the build <span aria-hidden="true">→</span></button>
    </div>
  </article>`).join('');
  $('#empty-projects').hidden = matched.length > 0;
  $('#show-more').hidden = matched.length <= 6;
  $('#show-more').innerHTML = expanded ? 'Show less <span aria-hidden="true">↑</span>' : `See ${matched.length-6} more projects <span aria-hidden="true">↓</span>`;
  $('#project-result-count').textContent = `${visible.length} of ${matched.length} matching projects shown.`;
}

const projectDialog = $('#project-dialog');
let dialogTrigger;
let dialogPaused = false;
function openProject(name, trigger) {
  const p = name === featured.repo
    ? { name, title: featured.title, description: featured.summary, tags: featured.stack, url: repoUrl(name) }
    : currentProjects.find(project=>project.name===name);
  if (!p || typeof projectDialog.showModal !== 'function') return;
  const notes = caseStudies[name];
  $('#project-dialog-content').innerHTML = `<h2 id="dialog-title">${e(p.title)}</h2><p class="dialog-summary">${e(p.description)}</p><div class="tags">${p.tags.map(t=>`<span>${e(t)}</span>`).join('')}</div><div class="dialog-sections">${notes ? [ ['The problem', notes.problem], ['The build', notes.build], ['What I learned', notes.learning] ].map(([title,text])=>`<section><h3>${e(title)}</h3><p>${e(text)}</p></section>`).join('') : `<section><h3>Explore the implementation</h3><p>This repository is part of my learning journey. The source and its project notes show what is implemented and how it works; no production outcomes or metrics are claimed here.</p></section>`}</div><div class="dialog-footer"><span class="mini-label">${e(notes?.status || 'Portfolio / learning project')}</span><a class="button button-primary" href="${e(p.url)}" target="_blank" rel="noopener noreferrer">Explore source <span aria-hidden="true">↗</span></a></div>`;
  dialogTrigger = trigger;
  dialogPaused = true;
  document.body.classList.add('dialog-open');
  root.classList.add('dialog-motion-stopped');
  scene?.setPaused(true);
  clearTimeout(typingTimer);
  projectDialog.showModal();
  projectDialog.scrollTop = 0;
}
document.addEventListener('click',event=>{
  const trigger = event.target.closest('[data-project]');
  if (trigger) openProject(trigger.dataset.project, trigger);
});
$('#close-project').addEventListener('click',()=>projectDialog.close());
projectDialog.addEventListener('keydown', event=>{
  if (event.key !== 'Tab') return;
  const controls = [...projectDialog.querySelectorAll('button:not(:disabled), a[href]')];
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault(); last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault(); first?.focus();
  }
});
projectDialog.addEventListener('click',event=>{
  if (event.target !== projectDialog) return;
  const rect = projectDialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) projectDialog.close();
});
projectDialog.addEventListener('close',()=>{
  dialogPaused = false;
  document.body.classList.remove('dialog-open');
  root.classList.remove('dialog-motion-stopped');
  updateMotion();
  if (dialogTrigger?.isConnected) dialogTrigger.focus({preventScroll:true});
  else $('#project-search').focus({preventScroll:true});
});

let demoState = 0;
const demoStates = [
  { state:'active', ledger:'AWAITING MATCH', button:'Simulate bank alert', message:'An intent is active. Nothing is confirmed yet.' },
  { state:'observed', ledger:'EVIDENCE ONLY', button:'Match sample statement', message:'The alert is evidence, not confirmation. The statement still needs to match.' },
  { state:'reconciled', ledger:'VERIFIED MATCH', button:'Reset illustration', message:'Sample UTR and ₹249.00 match exactly. The illustrative ledger can now be recorded.' },
];
$('#payment-demo-step').addEventListener('click',()=>{
  demoState = (demoState + 1) % demoStates.length;
  const state = demoStates[demoState];
  $('#payment-demo').dataset.state = state.state;
  $('#ledger-status').textContent = state.ledger;
  $('#payment-demo-step').innerHTML = `${state.button} <span aria-hidden="true">→</span>`;
  $('#demo-count').textContent = `0${demoState+1} / 03`;
  $('#payment-demo-status').textContent = state.message;
});

function applyGitHub(data, source) {
  currentRepos = data.repos;
  currentProjects = normaliseRepos(data.repos, curated).filter(p=>p.name!=='payproof');
  $('#repo-count').textContent = String(data.user.public_repos);
  $('#connection-indicator').className = `connection-indicator ${source==='live'?'live':'cached'}`;
  $('#github-status').textContent = source==='live' ? 'GitHub API · updated just now' : source==='cache' ? 'GitHub · saved data' : 'GitHub · offline snapshot (Nov 2026)';
  $('#retry-github').hidden = source==='live';
  $('#retry-github').textContent = source==='cache'?'Refresh':'Retry';
  renderProjects();
  renderLab();
}

async function loadGitHub(force = false) {
  if (loading) return;
  const cached = readCache(storage);
  if (!force && cached?.fresh) {
    applyGitHub(cached,'cache');
    return;
  }
  loading = true;
  $('#retry-github').disabled = true;
  $('#github-status').textContent = 'Connecting to GitHub…';
  currentFetch = new AbortController();
  const timeout = setTimeout(()=>currentFetch?.abort(),12000);
  try {
    const data = await fetchGitHub(fetch,currentFetch.signal);
    writeCache(storage,data);
    applyGitHub(data,'live');
  } catch {
    applyGitHub(cached || {repos:fallbackRepos,user:fallbackUser},cached?'cache':'fallback');
    $('#github-status').textContent = cached ? 'GitHub unavailable · showing saved data' : 'GitHub unavailable · showing Nov 2026 snapshot';
  } finally {
    clearTimeout(timeout);
    loading = false;
    currentFetch = undefined;
    $('#retry-github').disabled = false;
  }
}

applyGitHub({repos:fallbackRepos,user:fallbackUser},'fallback');
loadGitHub();
$('#retry-github').addEventListener('click',()=>loadGitHub(true));
window.addEventListener('online',()=>loadGitHub(true));
// A modest refresh interval; never poll while the tab is hidden or offline.
const githubInterval = setInterval(()=>{if(!document.hidden && navigator.onLine) loadGitHub();},15*60*1000);

for (const filter of document.querySelectorAll('.filter')) {
  filter.addEventListener('click',()=>{
    category = filter.dataset.filter;
    expanded = false;
    for(const b of document.querySelectorAll('.filter')) {
      b.classList.toggle('active',b===filter);
      b.setAttribute('aria-pressed',String(b===filter));
    }
    renderProjects();
  });
}
$('#project-search').addEventListener('input',()=>{expanded=false;renderProjects();});
$('#show-more').addEventListener('click',()=>{expanded=!expanded;renderProjects();});

let reveals;
if ('IntersectionObserver' in window) {
  reveals = new IntersectionObserver(entries=>{
    for(const entry of entries) if(entry.isIntersecting){
      entry.target.classList.add('is-visible');
      entry.target.classList.remove('pending-reveal');
      reveals.unobserve(entry.target);
    }
  },{threshold:.08});
  for (const node of document.querySelectorAll('.reveal')) {
    node.classList.add('pending-reveal');
    reveals.observe(node);
  }
}

function motionStopped() {return userPaused || reducedQuery.matches;}
function typeStep() {
  if(motionStopped() || document.hidden || dialogPaused) return;
  const phrase = profile.typed[typingPhrase];
  if(deleting) typingCount--;
  else typingCount++;
  $('#typed-text').textContent = phrase.slice(0,Math.max(0,typingCount));
  let delay = deleting?34:65;
  if(!deleting && typingCount>=phrase.length){deleting=true;delay=2100;}
  else if(deleting && typingCount<=0){deleting=false;typingPhrase=(typingPhrase+1)%profile.typed.length;delay=350;}
  typingTimer = setTimeout(typeStep,delay);
}
function updateMotion() {
  const paused = motionStopped();
  root.classList.toggle('motion-paused',paused);
  root.classList.toggle('motion-enabled',!paused);
  scene?.setPaused(paused || dialogPaused);
  const b=$('#motion-toggle');
  b.setAttribute('aria-pressed',String(paused));
  b.setAttribute('aria-label',reducedQuery.matches?'Animations reduced by system preference':paused?'Resume animations':'Pause animations');
  b.title = b.getAttribute('aria-label');
  b.disabled = reducedQuery.matches;
  b.innerHTML = paused?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 10 7-10 7Z"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>';
  clearTimeout(typingTimer);
  if(paused){$('#typed-text').textContent=profile.typed[typingPhrase];typingCount=profile.typed[typingPhrase].length;deleting=false;}
  else if(!document.hidden && !dialogPaused) typingTimer=setTimeout(typeStep,1800);
}
scene = createScene($('#orbital-canvas'));
updateMotion();
$('#motion-toggle').addEventListener('click',()=>{
  userPaused=!userPaused;
  try{storage.setItem('tushant-motion',userPaused?'paused':'enabled');}catch{/* No persistence. */}
  updateMotion();
});
reducedQuery.addEventListener('change',updateMotion);
document.addEventListener('visibilitychange',()=>{
  root.classList.toggle('page-hidden', document.hidden);
  if(document.hidden) clearTimeout(typingTimer);
  else updateMotion();
});
let decorativeObserver;
if ('IntersectionObserver' in window) {
  decorativeObserver = new IntersectionObserver(entries=>{
    for (const entry of entries) entry.target.classList.toggle('offscreen', !entry.isIntersecting);
  });
  for (const node of document.querySelectorAll('.hero, .ticker-shell, .contact-section')) decorativeObserver.observe(node);
}

const menuButton=$('#menu-toggle'), menu=$('#mobile-nav');
function closeMenu(returnFocus=false){menu.hidden=true;menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','Open navigation');if(returnFocus)menuButton.focus();}
menuButton.addEventListener('click',()=>{
  const open=menu.hidden;
  menu.hidden=!open;
  menuButton.setAttribute('aria-expanded',String(open));
  menuButton.setAttribute('aria-label',open?'Close navigation':'Open navigation');
});
for(const a of menu.querySelectorAll('a')) a.addEventListener('click',()=>closeMenu());
document.addEventListener('click',event=>{if(!menu.hidden&&!menu.contains(event.target)&&!menuButton.contains(event.target))closeMenu();});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!menu.hidden)closeMenu(true);
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
    event.preventDefault();
    if (projectDialog.open) return;
    $('#work').scrollIntoView({behavior:motionStopped()?'instant':'smooth'});
    $('#project-search').focus({preventScroll:true});
  }
});
const mobileQuery=matchMedia('(max-width: 700px)');
mobileQuery.addEventListener('change',()=>{if(!mobileQuery.matches)closeMenu();});
const sectionLinks = document.querySelectorAll('.desktop-nav a, .studio-dock a');
function setCurrentSection(id) {
  for (const a of sectionLinks) {
    const active = a.hash === `#${id}`;
    a.classList.toggle('current', active);
    if (active) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
  }
}
setCurrentSection(location.hash.slice(1) || 'home');
let navFrame = null;
function updateCurrentSection() {
  navFrame = null;
  let current = 'home';
  for (const section of document.querySelectorAll('main>section')) {
    if (section.getBoundingClientRect().top <= innerHeight * 0.35) current = section.id;
  }
  setCurrentSection(current);
}
function scheduleNavigation() {
  if (navFrame === null) navFrame = requestAnimationFrame(updateCurrentSection);
}
window.addEventListener('scroll', scheduleNavigation, {passive:true});
window.addEventListener('resize', scheduleNavigation, {passive:true});
window.addEventListener('hashchange', scheduleNavigation);

window.addEventListener('pagehide',event=>{
  clearTimeout(typingTimer);
  if(!event.persisted){
    scene.destroy();
    reveals?.disconnect();
    decorativeObserver?.disconnect();
    if (navFrame !== null) cancelAnimationFrame(navFrame);
    window.removeEventListener('scroll', scheduleNavigation);
    window.removeEventListener('resize', scheduleNavigation);
    window.removeEventListener('hashchange', scheduleNavigation);
    clearInterval(githubInterval);
    currentFetch?.abort();
  }else scene.setPaused(true);
});
window.addEventListener('pageshow',event=>{if(event.persisted)updateMotion();});
