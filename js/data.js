// Site content. Edit this file to update the portfolio; no build step needed.

export const profile = {
  name: 'Tushant',
  handle: 'TUSHANT-CSE',
  role: 'CSE student · backend & systems',
  location: 'India',
  avatar: 'https://avatars.githubusercontent.com/u/235111244?v=4',
  intro:
    'I build systems that are honest about their state: payment flows that only call it success when the bank statement agrees, APIs with real failure paths, and interfaces that show what is actually happening.',
  typed: [
    'reconciliation-first payments',
    'backend systems in TypeScript',
    'real-time dashboards',
    'clean, tested APIs',
  ],
  links: {
    github: 'https://github.com/TUSHANT-CSE',
    linkedin: '',
    email: '',
  },
};

// Featured case study.
export const featured = {
  repo: 'payproof',
  title: 'PayProof',
  tagline: 'Reconciliation-first UPI collections. Evidence is not truth.',
  summary:
    'Accepting UPI into your own bank account usually means trusting an SMS. PayProof treats a bank alert as evidence only. A payment becomes RECONCILED when its UTR and exact amount match an imported bank statement, and every state change is recorded, signed and delivered to the merchant.',
  lifecycle: ['ACTIVE', 'OBSERVED', 'RECONCILED'],
  highlights: [
    { label: 'Exact paise matching', detail: 'No rounding, ±60 s clock skew, no silent late matches' },
    { label: 'One live slot per account', detail: 'Enforced by a partial unique index, FIFO queue' },
    { label: 'Double-entry ledger', detail: 'DEBIT bank / CREDIT merchant payable on reconcile' },
    { label: 'Transactional outbox', detail: 'HMAC-SHA256 webhooks with retries and backoff' },
  ],
  stats: [
    { value: '29', label: 'tests passing' },
    { value: '6', label: 'lifecycle states' },
    { value: '4', label: 'design records' },
  ],
  stack: ['TypeScript', 'Fastify', 'PostgreSQL', 'PGlite', 'Zod', 'node:test'],
};

// Curated copy for repos. Anything not listed falls back to the GitHub description.
// Set hidden: true to keep a repo off the site.
export const curated = {
  payproof: {
    title: 'PayProof',
    description: 'Reconciliation-first UPI collection toolkit with a double-entry ledger and signed webhooks.',
    tags: ['TypeScript', 'Fastify', 'PostgreSQL'],
    category: 'backend',
    rank: 1,
  },
  'Capstone-pro-web-development': {
    title: 'Urban Pulse',
    description: 'Smart-city dashboard for civic complaints, analytics and service monitoring.',
    tags: ['React', 'Redux Toolkit', 'Tailwind', 'Recharts'],
    category: 'frontend',
    rank: 2,
  },
  webdevassgn3: {
    title: 'Student Records API',
    description: 'CRUD REST API for student records, with an in-memory store and a Postman collection.',
    tags: ['Node.js', 'Express', 'REST'],
    category: 'backend',
    rank: 3,
  },
  PORTFOLIO: {
    title: 'Portfolio v1',
    description: 'My first personal portfolio: projects, skills and contact in a responsive layout.',
    tags: ['HTML', 'CSS', 'JavaScript'],
    category: 'frontend',
    rank: 4,
  },
  PYTHON: {
    title: 'Python Toolkit',
    description: 'Gradebook, library manager, weather data visualiser and calorie tracker.',
    tags: ['Python', 'Jupyter', 'Data'],
    category: 'data',
    rank: 5,
  },
  'CAPSTONE-1': {
    title: 'Winter Gear Store',
    description: 'Responsive e-commerce sale landing page with original vs. sale pricing.',
    tags: ['HTML', 'CSS'],
    category: 'frontend',
    rank: 6,
  },
  'JAVA-QUIZ': {
    title: 'Java Quiz',
    description: 'Browser quiz with scoring and instant feedback.',
    tags: ['JavaScript', 'HTML'],
    category: 'frontend',
    rank: 7,
  },
  'Score-Board': {
    title: 'Score Board',
    description: 'Student scoreboard built with React and Vite.',
    tags: ['React', 'Vite'],
    category: 'frontend',
    rank: 8,
  },
  'student-management-zosima': {
    title: 'Student API (Express)',
    description: 'Express routing skeleton for a student management service.',
    tags: ['Node.js', 'Express'],
    category: 'backend',
    rank: 9,
  },
  tushantDSA: {
    title: 'DSA Practice',
    description: 'Data structures and algorithms practice in Python.',
    tags: ['Python', 'DSA'],
    category: 'data',
    rank: 10,
  },
  tushantDSA2: { hidden: true },
  'PORTFOLIO-2': { hidden: true },
  'WEB-DEV-1': {
    title: 'Web Dev Labs',
    description: 'HTML and CSS lab assignments.',
    tags: ['HTML', 'CSS'],
    category: 'frontend',
    rank: 12,
  },
  'WEB-DEV-3-AS-1': { hidden: true },
  'M.L': { hidden: true },
  'TUSHANT-CSE': { hidden: true },
  'TUSHANT-CSE.github.io': { hidden: true },
};

// Project notes describe the repository, not invented production outcomes.
export const caseStudies = {
  payproof: {
    problem: 'A bank notification can arrive late, repeat, or describe a payment that has not been reconciled. Calling that notification success hides the difference between observation and confirmation.',
    build: 'Separate the payment lifecycle from bank evidence. Match the UTR and exact integer paise against a statement, then record a double-entry ledger movement. A transactional outbox delivers signed webhooks with retries.',
    learning: 'The hard part is the failure path: duplicate alerts, account-slot contention, clock skew and late matches. The scaffold includes 29 tests and design records to make those decisions explicit.',
    status: 'Learning / portfolio toolkit · not production-ready',
  },
  'Capstone-pro-web-development': {
    problem: 'Civic complaints, service monitoring and analytics need a coherent interface rather than disconnected screens.',
    build: 'Urban Pulse brings those concerns into a smart-city dashboard, using React, Redux Toolkit, Tailwind and Recharts.',
    learning: 'This project explores dashboard structure, shared application state and visual presentation of civic data. The repository is the source of truth for the implementation.',
    status: 'Capstone project',
  },
  webdevassgn3: {
    problem: 'Student records need a predictable way to create, read, update and delete entries through an API.',
    build: 'An Express CRUD REST API backed by an in-memory store, with a Postman collection for trying the endpoints.',
    learning: 'Keeping routes and HTTP responses understandable is a useful first step. The in-memory store is deliberately not durable database storage.',
    status: 'Coursework API · in-memory storage',
  },
  PYTHON: {
    problem: 'Small everyday problems are a useful way to move from Python syntax into working programs.',
    build: 'A collection containing a gradebook, library manager, weather data visualiser and calorie tracker, across Python and Jupyter.',
    learning: 'Each exercise explores a different slice of Python: handling records, presenting data and organising a small program.',
    status: 'Coursework / learning collection',
  },
};

// Used when the GitHub API is unreachable or rate-limited (snapshot 2026-11-03).
export const fallbackRepos = [
  { name: 'payproof', language: 'TypeScript', stargazers_count: 0, pushed_at: '2026-11-03T00:00:00Z' },
  { name: 'student-management-zosima', language: 'JavaScript', stargazers_count: 0, pushed_at: '2026-10-09T00:00:00Z' },
  { name: 'webdevassgn3', language: 'JavaScript', stargazers_count: 0, pushed_at: '2026-09-23T00:00:00Z' },
  { name: 'Capstone-pro-web-development', language: 'JavaScript', stargazers_count: 0, pushed_at: '2026-04-30T00:00:00Z' },
  { name: 'Score-Board', language: null, stargazers_count: 0, pushed_at: '2026-04-19T00:00:00Z' },
  { name: 'tushantDSA', language: 'Python', stargazers_count: 0, pushed_at: '2026-03-25T00:00:00Z' },
  { name: 'CAPSTONE-1', language: 'CSS', stargazers_count: 0, pushed_at: '2025-12-01T00:00:00Z' },
  { name: 'PYTHON', language: 'Jupyter Notebook', stargazers_count: 0, pushed_at: '2025-11-24T00:00:00Z' },
  { name: 'JAVA-QUIZ', language: 'JavaScript', stargazers_count: 0, pushed_at: '2025-11-23T00:00:00Z' },
  { name: 'WEB-DEV-1', language: 'HTML', stargazers_count: 0, pushed_at: '2025-11-18T00:00:00Z' },
  { name: 'PORTFOLIO', language: 'HTML', stargazers_count: 0, pushed_at: '2025-11-18T00:00:00Z' },
].map((r) => ({ ...r, html_url: `https://github.com/TUSHANT-CSE/${r.name}`, description: null, fork: false }));

export const fallbackUser = { public_repos: 15, followers: 1, created_at: '2025-09-29T13:14:44Z' };

export const skills = [
  { group: 'Languages', items: ['TypeScript', 'JavaScript', 'Python', 'SQL', 'HTML', 'CSS'] },
  { group: 'Backend', items: ['Node.js', 'Fastify', 'Express', 'REST APIs', 'Webhooks', 'Zod'] },
  { group: 'Data', items: ['PostgreSQL', 'PGlite', 'Pandas', 'Jupyter', 'Data modelling'] },
  { group: 'Frontend', items: ['React', 'Redux Toolkit', 'Tailwind CSS', 'Vite', 'Recharts'] },
  { group: 'Practice', items: ['Testing', 'Git', 'Design records', 'DSA', 'Machine learning'] },
];

// Upcoming builds from the weekly lab.
export const lab = [
  { name: 'pulse', title: 'Pulse', pitch: 'Uptime monitor with latency percentiles, incidents and a public status page.', status: 'next' },
  { name: 'hearth', title: 'Hearth', pitch: 'Real-time smart home hub: simulated devices, scenes, automations and a kiosk display.', status: 'planned' },
  { name: 'arena', title: 'Arena', pitch: 'Real-time multiplayer trivia over WebSockets with a live leaderboard.', status: 'planned' },
  { name: 'atlas', title: 'Atlas', pitch: 'Mini search engine with an inverted index and BM25 ranking.', status: 'planned' },
];

export const timeline = [
  { when: '2025', title: 'Started building on GitHub', detail: 'HTML, CSS and JavaScript fundamentals; first portfolio and quiz app.' },
  { when: 'Early 2026', title: 'Python, data and DSA', detail: 'Coursework tools in Python and Jupyter, plus algorithm practice.' },
  { when: 'Mid 2026', title: 'React and APIs', detail: 'Urban Pulse dashboard with Redux and charts; Express REST APIs.' },
  { when: 'Nov 2026', title: 'Systems: PayProof', detail: 'Reconciliation-first payments with a ledger, outbox and 29 tests.' },
];
