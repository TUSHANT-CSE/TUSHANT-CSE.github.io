export const GITHUB_OWNER = 'TUSHANT-CSE';
export const CACHE_KEY = 'tushant-portfolio-github-v1';
export const CACHE_TTL = 15 * 60 * 1000;

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

export function repoUrl(name) {
  return `https://github.com/${GITHUB_OWNER}/${encodeURIComponent(name)}`;
}

export function isRepoList(value) {
  return Array.isArray(value) && value.every(r => r && typeof r.name === 'string' && /^[\w.-]+$/.test(r.name));
}

export function isUser(value) {
  return value && Number.isInteger(value.public_repos) && value.public_repos >= 0;
}

export function inferCategory(language) {
  if (['Python', 'Jupyter Notebook', 'R', 'Julia'].includes(language)) return 'data';
  if (['HTML', 'CSS', 'JavaScript'].includes(language)) return 'frontend';
  return 'backend';
}

export function normaliseRepos(repos, curated) {
  if (!isRepoList(repos)) return [];
  const seen = new Set();
  return repos.flatMap(r => {
    const c = curated[r.name] ?? {};
    if (r.fork || r.archived || c.hidden || seen.has(r.name)) return [];
    seen.add(r.name);
    return [{
      name: r.name,
      title: c.title || r.name.replace(/[-_]/g, ' '),
      description: c.description || r.description || 'A new experiment from my GitHub. Explore the source to see what is taking shape.',
      tags: c.tags || (r.language ? [r.language] : ['Experiment']),
      category: c.category || inferCategory(r.language),
      rank: Number.isFinite(c.rank) ? c.rank : 4.5,
      language: r.language || 'Source code',
      stars: Number.isInteger(r.stargazers_count) && r.stargazers_count >= 0 ? r.stargazers_count : 0,
      pushedAt: r.pushed_at,
      url: repoUrl(r.name),
    }];
  }).sort((a,b) => a.rank - b.rank || (Date.parse(b.pushedAt) || 0) - (Date.parse(a.pushedAt) || 0));
}

export function filterProjects(projects, category, query) {
  const q = String(query || '').trim().toLowerCase();
  return projects.filter(p => (category === 'all' || p.category === category) && (!q || [p.name,p.title,p.description,...p.tags].join(' ').toLowerCase().includes(q)));
}

export function formatDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Date unavailable' : d.toLocaleDateString('en-GB', { month:'short', year:'numeric', timeZone:'UTC' });
}

export function readCache(storage, now = Date.now()) {
  try {
    const data = JSON.parse(storage.getItem(CACHE_KEY));
    if (!data || !Number.isFinite(data.savedAt) || data.savedAt > now || !isRepoList(data.repos) || !isUser(data.user)) return null;
    return { ...data, fresh: now - data.savedAt < CACHE_TTL };
  } catch { return null; }
}

export function writeCache(storage, data) {
  try { storage.setItem(CACHE_KEY, JSON.stringify(data)); return true; }
  catch { return false; }
}

export function safeContactLinks(links) {
  const result = [];
  if (typeof links.email === 'string' && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(links.email) && !/[\r\n?]/.test(links.email)) {
    result.push({label:'Email me',url:`mailto:${links.email}`,external:false});
  }
  try {
    const u = new URL(links.linkedin);
    if (u.protocol === 'https:' && ['linkedin.com','www.linkedin.com'].includes(u.hostname)) {
      result.push({label:'LinkedIn',url:u.href,external:true});
    }
  } catch { /* Unconfigured or invalid links are intentionally hidden. */ }
  return result;
}

export async function fetchGitHub(fetchFn = fetch, signal) {
  const base = `https://api.github.com/users/${GITHUB_OWNER}`;
  async function get(url) {
    const response = await fetchFn(url, { signal, headers: { Accept:'application/vnd.github+json' } });
    if (!response.ok) {
      const error = new Error(response.status === 403 || response.status === 429 ? 'GitHub API limit reached' : `GitHub unavailable (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }
  const [first, user] = await Promise.all([get(`${base}/repos?per_page=100&sort=updated`), get(base)]);
  if (!isRepoList(first) || !isUser(user)) throw new Error('Unexpected GitHub response');
  const repos = [...first];
  // Public repositories only. Stop once GitHub returns fewer than a full page.
  let page = 2, batch = first;
  while (batch.length === 100 && page <= 10) {
    batch = await get(`${base}/repos?per_page=100&sort=updated&page=${page++}`);
    if (!isRepoList(batch)) throw new Error('Unexpected GitHub repository response');
    repos.push(...batch);
  }
  return {repos,user,savedAt:Date.now()};
}
