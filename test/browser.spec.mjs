import { test, expect } from '@playwright/test';
import { fallbackRepos } from '../js/data.js';

// Deterministic API fixtures for browser tests only. The actual site uses public GitHub data.
const repos=fallbackRepos;
async function mockGitHub(page,status=200){
  await page.route('https://api.github.com/users/TUSHANT-CSE**',route=>route.fulfill({
    status,contentType:'application/json',
    body:JSON.stringify(status===200?(route.request().url().includes('/repos?')?repos:{public_repos:14,followers:1}):{message:'API rate limit exceeded'}),
    headers:{'Access-Control-Allow-Origin':'*'},
  }));
}
async function load(page){await mockGitHub(page);await page.goto('/');await expect(page.locator('#github-status')).toHaveText('GitHub API · updated just now');}
async function frameGap(page){await page.evaluate(()=>new Promise(resolve=>{let n=0;function frame(){if(++n===10)resolve();else requestAnimationFrame(frame);}requestAnimationFrame(frame);}));}

 test('desktop hero, live API, local assets and drawing render without JS errors',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await load(page);
  await expect(page).toHaveTitle('Tushant — Ideas into systems');
  await expect(page.locator('h1')).toContainText('Ideas into');
  await expect(page.locator('#repo-count')).toHaveText('14');
  await expect(page.locator('.project-card')).toHaveCount(6);
  await expect(page.locator('.desktop-nav')).toBeVisible();
  const opaque=await page.locator('canvas').evaluate(c=>{const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return pixels.some((v,i)=>i%4===3&&v>20);});
  expect(opaque).toBe(true);expect(errors).toEqual([]);
  await page.screenshot({path:'assets/preview-desktop.png'});
  await page.locator('#work').evaluate(node=>window.scrollTo(0,node.offsetTop-35));
  await page.screenshot({path:'assets/preview-desktop-work.png'});
});

test('project categories, search and empty state work together',async({page})=>{
  await load(page);await page.getByRole('button',{name:'Backend',exact:true}).click();
  await expect(page.locator('.project-card')).toHaveCount(2);
  await expect(page.getByRole('button',{name:'Backend',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('searchbox',{name:'Search projects'}).fill('no-match-project');
  await expect(page.locator('#empty-projects')).toBeVisible();
  await expect(page.locator('.project-card')).toHaveCount(0);
  await page.getByRole('button',{name:'All work',exact:true}).click();
  await page.getByRole('searchbox').fill('Python');await expect(page.locator('.project-card')).toHaveCount(2);
});

test('show more reveals remaining projects and show less collapses them',async({page})=>{
  await load(page);await page.locator('#show-more').click();
  await expect(page.locator('.project-card')).toHaveCount(10);
  await expect(page.locator('#show-more')).toContainText('Show less');
  await page.locator('#show-more').click();await expect(page.locator('.project-card')).toHaveCount(6);
});

test('mobile menu, touch-sized controls and project layout work at 375px',async({page})=>{
  await page.setViewportSize({width:375,height:812});await load(page);
  await expect(page.locator('#menu-toggle')).toBeVisible();await expect(page.locator('.desktop-nav')).toBeHidden();
  await page.screenshot({path:'assets/preview-mobile.png',fullPage:false});
  await page.locator('#menu-toggle').click();await expect(page.locator('#mobile-nav')).toBeVisible();
  await page.locator('#mobile-nav a[href="#work"]').click();await expect(page.locator('#mobile-nav')).toBeHidden();
  await expect(page).toHaveURL(/#work$/);
  await page.screenshot({path:'assets/preview-mobile-work.png'});
  await page.locator('#menu-toggle').scrollIntoViewIfNeeded();await page.locator('#menu-toggle').click();await page.keyboard.press('Escape');
  await expect(page.locator('#menu-toggle')).toBeFocused();await expect(page.locator('#mobile-nav')).toBeHidden();
});

test('no horizontal overflow across phone, tablet and desktop widths',async({page})=>{
  await load(page);
  for(const width of [320,375,700,820,1024,1440,1920]){
    await page.setViewportSize({width,height:900});
    const sizes=await page.evaluate(()=>({inner:innerWidth,scroll:document.documentElement.scrollWidth}));
    expect(sizes.scroll,`overflow at ${width}px`).toBeLessThanOrEqual(sizes.inner);
  }
});

test('rate limits still display useful offline projects and retry succeeds',async({page})=>{
  await mockGitHub(page,403);await page.goto('/');
  await expect(page.locator('#github-status')).toHaveText('GitHub unavailable · showing Nov 2026 snapshot');
  await expect(page.locator('.project-card')).toHaveCount(6);
  await expect(page.locator('#retry-github')).toBeVisible();
  await mockGitHub(page);await page.locator('#retry-github').click();
  await expect(page.locator('#github-status')).toHaveText('GitHub API · updated just now');
});

test('blocked cache storage does not prevent app startup',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage blocked');}});});
  await load(page);await expect(page.locator('.project-card')).toHaveCount(6);
});

test('motion setting pauses the canvas, persists and respects system preferences',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await load(page);
  const activeBefore=await page.locator('canvas').evaluate(c=>c.toDataURL());await frameGap(page);
  expect(await page.locator('canvas').evaluate(c=>c.toDataURL())).not.toBe(activeBefore);
  await page.locator('#motion-toggle').click();await expect(page.locator('#motion-toggle')).toHaveAttribute('aria-pressed','true');
  const before=await page.locator('canvas').evaluate(c=>c.toDataURL());await frameGap(page);
  expect(await page.locator('canvas').evaluate(c=>c.toDataURL())).toBe(before);
  await page.reload();await expect(page.locator('#motion-toggle')).toHaveAttribute('aria-pressed','true');
  await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('#motion-toggle')).toBeDisabled();
  await expect(page.locator('html')).toHaveClass(/motion-paused/);
});

test('planned projects and missing contacts are not advertised as shipped or available',async({page})=>{
  await load(page);
  await expect(page.locator('#contact-links a')).toHaveCount(1);
  await expect(page.locator('#contact-links').getByRole('link',{name:'Email me'})).toHaveCount(0);
  await expect(page.locator('#contact-links').getByRole('link',{name:'LinkedIn'})).toHaveCount(0);
  await expect(page.locator('#lab-list .lab-status.built')).toHaveCount(0);
  await expect(page.locator('#lab-list .lab-row')).toHaveCount(4);
  const urls=await page.locator('.project-card h3 a').evaluateAll(links=>links.map(l=>l.href));
  expect(urls.every(url=>url.startsWith('https://github.com/TUSHANT-CSE/'))).toBe(true);
});

test('PayProof illustration distinguishes evidence from reconciliation and resets',async({page})=>{
  await load(page);
  const step=page.locator('#payment-demo-step');
  await expect(page.locator('#payment-demo')).toHaveAttribute('data-state','active');
  await step.click();
  await expect(page.locator('#payment-demo')).toHaveAttribute('data-state','observed');
  await expect(page.locator('#ledger-status')).toHaveText('EVIDENCE ONLY');
  await expect(page.locator('#payment-demo-status')).toContainText('not confirmation');
  await step.click();
  await expect(page.locator('#payment-demo')).toHaveAttribute('data-state','reconciled');
  await expect(page.locator('#ledger-status')).toHaveText('VERIFIED MATCH');
  await expect(page.locator('#payment-demo-status')).toContainText('₹249.00');
  await step.click();
  await expect(page.locator('#payment-demo')).toHaveAttribute('data-state','active');
  await expect(page.locator('#ledger-status')).toHaveText('AWAITING MATCH');
});

test('project notes open safely, trap focus, close on Escape and restore focus',async({page})=>{
  await load(page);
  const trigger=page.getByRole('button',{name:'Read about Urban Pulse'});
  await trigger.click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading',{name:'Urban Pulse',exact:true})).toBeVisible();
  await expect(dialog.getByRole('heading',{name:'The problem',exact:true})).toBeVisible();
  await expect(page.locator('#close-project')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('link',{name:'Explore source'})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#close-project')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.getByRole('button',{name:'The engineering story'}).click();
  await expect(dialog).toContainText('not production-ready');
  await page.screenshot({path:'assets/preview-project-notes.png'});
  await page.getByRole('button',{name:'Close project details'}).click();
  await expect(dialog).toBeHidden();
});

test('floating dock remains accessible and tracks sections; keyboard search works',async({page})=>{
  await load(page);
  const dock=page.getByRole('navigation',{name:'Studio navigation'});
  await expect(dock).toBeVisible();
  await dock.getByRole('link',{name:'About',exact:true}).click();
  await expect(page).toHaveURL(/#about$/);
  await expect(dock.getByRole('link',{name:'About',exact:true})).toHaveAttribute('aria-current','location');
  const position=await dock.boundingBox();
  expect(position.y+position.height).toBeLessThanOrEqual(1000);
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('searchbox')).toBeFocused();
  await page.getByRole('searchbox').fill('Python');
  await expect(page.locator('.project-card')).toHaveCount(2);
});

test('canvas stops offscreen and while reading a project, then resumes',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await load(page);
  await page.locator('.studio-dock a[href="#contact"]').click();
  await expect(page).toHaveURL(/#contact$/);
  await page.waitForFunction(()=>document.querySelector('#orbital-canvas').getBoundingClientRect().bottom<0);
  await frameGap(page);
  const offscreen=await page.locator('canvas').evaluate(c=>c.toDataURL());
  await frameGap(page);
  expect(await page.locator('canvas').evaluate(c=>c.toDataURL())).toBe(offscreen);
  await page.locator('.studio-dock a[href="#home"]').click();
  await page.waitForFunction(()=>document.querySelector('#orbital-canvas').getBoundingClientRect().top>0);
  await frameGap(page);
  const resumed=await page.locator('canvas').evaluate(c=>c.toDataURL());
  await frameGap(page);
  expect(await page.locator('canvas').evaluate(c=>c.toDataURL())).not.toBe(resumed);
  // Open notes without moving the hero offscreen, to isolate modal pausing.
  await page.evaluate(()=>document.querySelector('[data-project="payproof"]').click());
  await expect(page.getByRole('dialog')).toBeVisible();
  const reading=await page.locator('canvas').evaluate(c=>c.toDataURL());
  await frameGap(page);
  expect(await page.locator('canvas').evaluate(c=>c.toDataURL())).toBe(reading);
  await page.locator('#close-project').click();
  const afterClose=await page.locator('canvas').evaluate(c=>c.toDataURL());
  await frameGap(page);
  expect(await page.locator('canvas').evaluate(c=>c.toDataURL())).not.toBe(afterClose);
});

test('phone project dialog fits and details controls have usable touch targets',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await load(page);
  await page.getByRole('button',{name:'Read about Urban Pulse'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const bounds=await page.getByRole('dialog').boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(16);
  expect(bounds.x+bounds.width).toBeLessThanOrEqual(359);
  const close=await page.locator('#close-project').boundingBox();
  expect(close.width).toBeGreaterThanOrEqual(40);
  await page.screenshot({path:'assets/preview-mobile-notes.png'});
  await page.locator('#close-project').click();
  const detail=await page.getByRole('button',{name:'Read about Urban Pulse'}).boundingBox();
  expect(detail.height).toBeGreaterThanOrEqual(44);
});
