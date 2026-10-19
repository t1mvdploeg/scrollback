(function () {
  'use strict';
  let D = { posts: [], domains: [], collections: [], actions: [], skillIdeas: [], standout: [], profile: {}, style: {}, status: {}, kb: {}, warnings: [] };
  function parseRoute(hash) {
    const [path, query = ''] = (hash || '#overview').replace(/^#/, '').split('?');
    const [page, id] = path.split('/');
    return { page: ['overview', 'posts', 'post', 'style', 'add'].includes(page) ? page : 'overview', id, params: new URLSearchParams(query) };
  }
  function filterPosts(posts, filters) {
    const query = (filters.q || '').trim().toLowerCase();
    return posts.filter(p => (!filters.collection || p.collection === filters.collection)
      && (!filters.domain || p.domain === filters.domain)
      && (!filters.tag || p.tags.includes(filters.tag))
      && (!filters.verdict || p.verdict === filters.verdict)
      && (!query || [p.title, p.maker, p.summary, ...p.tags].join(' ').toLowerCase().includes(query)));
  }
  window.ScrollbackMockup = Object.freeze({ parseRoute, filterPosts });
  if (typeof document === 'undefined') return;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const iconPaths = {
    overview: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h7m-7 4h7m-7 3h4"/>',
    posts: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6m-6 4h6m-6 4h4"/>',
    style: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
    add: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    moon: '<path d="M20.5 14.5A9 9 0 0 1 9.5 3.5 9 9 0 1 0 20.5 14.5Z"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    design: '<path d="m4 17 13-13 3 3L7 20H4v-3Zm10-10 3 3"/>',
    development: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16"/>',
    automation: '<path d="M12 3v4m0 10v4M3 12h4m10 0h4"/><rect x="7" y="7" width="10" height="10" rx="3"/>',
    creative: '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4V8Z"/>',
    link: '<path d="m10 14 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    fetch: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    synthesis: '<path d="M4 4h5v5H4zM15 4h5v5h-5zM9 16h6v5H9zM6.5 9v3H12m5.5-3v3H12v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    book: '<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.posts}</svg>`;
  const verdicts = {
    installed: { symbol: '✅', label: 'Already installed', short: 'Installed' },
    new: { symbol: '🆕', label: 'New and worth it', short: 'Worth a try' },
    caution: { symbol: '⚠️', label: 'Caution', short: 'Caution' },
    skip: { symbol: '⏭️', label: 'Skip', short: 'Skip' }
  };
  const verdict = p => `<span class="verdict verdict-${esc(p.verdict)}"><span aria-hidden="true">${(verdicts[p.verdict] || verdicts.new).symbol}</span> ${(verdicts[p.verdict] || verdicts.new).short}</span>`;
  const postById = id => D.posts.find(p => p.id === id);
  const domainById = id => D.domains.find(d => d.id === id) || { id, name: id || 'Uncategorised' };
  const postLink = (id, text, className = '') => postById(id) || !text ? `<a class="${className}" href="#post/${esc(id)}">${esc(text || postById(id)?.maker || 'Open note')}</a>` : esc(text);
  const sourceLinks = ids => (ids || []).filter(postById).map(id => postLink(id)).join('<span aria-hidden="true"> · </span>');
  const tags = list => (list || []).map(tag => `<a class="tag" href="#posts?tag=${encodeURIComponent(tag)}">${esc(tag)}</a>`).join('');
  const safeUrl = u => { try { const x = new URL(String(u)); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (_) { return ''; } };
  const joinMeta = parts => parts.filter(Boolean).map(esc).join('<span aria-hidden="true"> · </span>');
  const fmtDate = v => { const d = new Date(v); return v && !isNaN(d) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };
  const demo = () => !!D.demo;
  const kbName = () => D.kb?.name || 'Your';
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const hexes = text => String(text || '').match(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi) || [];
  // Fill gaps the knowledge base cannot supply (visual, colour) and guard against missing fields.
  function normalise(data) {
    const themes = ['sand', 'blue', 'green', 'coral'];
    data.posts = (data.posts || []).map(p => {
      p = { tags: [], explained: [], tools: [], ...p };
      p.tags = p.tags || []; p.explained = p.explained || []; p.tools = p.tools || [];
      if (p.design) p.design = { colours: '', type: '', layout: '', effects: '', looksLike: '', ...p.design, libraries: p.design.libraries || [] };
      const hay = `${p.design?.looksLike || ''} ${p.design?.effects || ''} ${p.tags.join(' ')} ${p.title || ''}`.toLowerCase();
      if (!p.visual) p.visual = /motion|animat|gsap|transition/.test(hay) ? 'motion' : /workflow|automat|pipeline|inbox/.test(hay) || p.domain === 'automation' ? 'workflow' : p.design && /interface|app|dashboard|menu|\bui\b|tool|dark/.test(hay) || p.domain === 'development' ? 'interface' : 'editorial';
      if (!p.color) { let h = 0; for (const c of String(p.id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; p.color = p.visual === 'interface' ? 'blue' : p.visual === 'workflow' ? 'green' : themes[h % themes.length]; }
      return p;
    });
    data.domains = data.domains || []; data.collections = data.collections || []; data.actions = data.actions || [];
    data.skillIdeas = data.skillIdeas || []; data.standout = data.standout || []; data.profile = data.profile || {};
    data.warnings = data.warnings || []; data.kb = data.kb || {}; data.status = data.status || {};
    const S = data.style = data.style || {};
    S.recurring = S.recurring || []; S.groups = S.groups || []; S.best = (S.best || []).filter(b => data.posts.some(p => p.id === b.postId));
    S.libraries = (S.libraries || []).map(l => ({ ...l, onScreen: l.onScreen || [], guessed: l.guessed || [] }));
    S.groups = S.groups.map(g => ({ postIds: [], ...g }));
    return data;
  }
  const collectionNames = () => [...new Set([...(D.collections || []).map(c => c.name || c.id), ...D.posts.map(p => p.collection).filter(Boolean)])];
  const list = items => `<ul>${(items || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
  const evidence = text => `<span class="evidence ${/guessed|uncertain/i.test(text) ? 'evidence-guess' : ''}">${esc(text)}</span>`;
  function visual(p, extra = '') {
    const type = p.visual || 'editorial';
    const toolbar = `<div class="visual-toolbar"><span>•••</span><span>${esc(p.collection || 'saved')}</span></div>`;
    let content;
    if (type === 'interface') content = '<div class="mini-app"><div class="mini-rail"><span></span><span></span><span></span></div><div class="mini-main"><div class="mini-title">Room to think.</div><div class="mini-bars"><i></i><i></i><i></i></div><div class="mini-bottom"><b></b><b></b><b></b></div></div></div>';
    else if (type === 'motion') content = '<div class="motion-composition"><i class="orbit orbit-one"></i><i class="orbit orbit-two"></i><i class="orbit orbit-three"></i><span class="motion-word">Less,<br>but better.</span></div>';
    else if (type === 'workflow') content = `<div class="workflow-composition"><div class="flow-node">Capture</div><div class="flow-connector"></div><div class="flow-node">Connect</div><div class="flow-connector"></div><div class="flow-node">Create</div></div>`;
    else {
      const headline = p.title ? esc(String(p.title).slice(0, 48)) : 'Ideas deserve<br>a little space.';
      content = `<div class="visual-content"><span class="visual-kicker">${esc(String(p.domain ? domainById(p.domain).name : 'notes').toUpperCase())}</span><div class="visual-headline">${headline}</div><div class="visual-shapes"><i></i><i></i><i></i></div><span class="visual-caption">${esc(p.maker || '')}</span></div>`;
    }
    return `<div class="visual visual-${type} theme-${esc(p.color || 'sand')} ${extra}" aria-hidden="true">${toolbar}${content}</div>`;
  }
  function overview() {
    if (!D.posts.length) return emptyKb();
    return `<div class="page-content">
      <section class="overview-intro" aria-labelledby="overview-title"><div class="intro-copy"><h1 id="overview-title">Your saves,<br>put to work.</h1><p>The ideas worth keeping. The next steps worth taking.<br>Your collected knowledge, with a little perspective.</p><div class="intro-meta"><span>${plural(D.posts.length, 'post')}</span><span>${plural(D.domains.length, 'domain')}</span>${fmtDate(D.processed) ? `<span>Updated ${esc(fmtDate(D.processed))}</span>` : ''}</div></div><div class="intro-art" aria-hidden="true"><div class="save-slip slip-one"><span>THE SAVE</span>${icon('posts')}<strong>A good idea.</strong><small>Don't lose the thread.</small></div><div class="save-slip slip-two"><span>THE CONNECTION</span>${icon('link')}<strong>A bigger picture.</strong><small>Patterns, not piles.</small></div><div class="save-slip slip-three"><span>THE NEXT STEP</span>${icon('check')}<strong>Something to try.</strong><small>From inspiration to action.</small></div></div></section>
      <section aria-labelledby="priority-title"><div class="section-head"><div><h2 id="priority-title">Do these first</h2><p>A short list, in order of what helps your projects most.</p></div><span class="small-count">${D.actions.length} next steps</span></div><div class="priority-list">${D.actions.length ? '' : '<p class="quiet-note">No next steps yet. They appear once the knowledge base has an overview.</p>'}${D.actions.map((a, i) => `<article class="priority-row"><span class="priority-index">${String(i + 1).padStart(2, '0')}</span><div class="priority-copy"><h3>${postLink(a.postId, a.title)}</h3><p>${esc(a.why)}</p>${a.project ? `<span class="priority-project">${esc(a.project)}</span>` : ''}</div>${postById(a.postId) ? `<a class="priority-source" href="#post/${esc(a.postId)}" aria-label="Read note: ${esc(a.title)}">Read note ${icon('arrow')}</a>` : ''}</article>`).join('')}</div></section>
      <div class="overview-split"><section class="domain-section" aria-labelledby="domains-title"><div class="section-head"><div><h2 id="domains-title">Your domains</h2><p>A few threads running through your saves.</p></div></div><div class="domain-list">${D.domains.map(d => `<a class="domain-row" href="#posts?domain=${encodeURIComponent(d.id)}"><span class="domain-symbol domain-${esc(d.id)}">${icon(d.id)}</span><span class="domain-copy"><strong>${esc(d.name)}</strong><span>${esc(d.description)}</span></span><span class="domain-count">${D.posts.filter(p => p.domain === d.id).length} ${icon('arrow')}</span></a>`).join('')}</div></section><section class="skills-section" aria-labelledby="skills-title"><div class="section-head"><div><h2 id="skills-title">Skill ideas</h2><p>Useful workflows hiding in your saved posts.</p></div></div><div class="skill-list">${D.skillIdeas.map(s => `<article class="skill-row"><h3>${esc(s.title)}</h3><p>${esc(s.description)}</p><div class="skill-sources">${s.serves ? `<span>${esc(s.serves)}</span>` : ''}${sourceLinks(s.postIds) ? `<span>From ${sourceLinks(s.postIds)}</span>` : ''}</div></article>`).join('')}</div><p class="quiet-note">Ideas for skills. None have been built.</p></section></div>
      <section class="insight-panel" aria-labelledby="stood-out-title"><div class="section-head"><div><h2 id="stood-out-title">What stood out</h2><p>The signal between the saves.</p></div>${icon('book')}</div><ul class="insight-list">${D.standout.length ? '' : '<li><span>Nothing yet. This fills in once the overview has a "What stood out" section.</span></li>'}${D.standout.map(t => `<li>${icon('arrow')}<span>${esc(t)}</span></li>`).join('')}</ul>${D.style.recurring.length ? `<a class="style-teaser" href="#style"><span><strong>You have a visual type.</strong> ${esc(D.style.recurring[0].text)}</span><span>Explore your style ${icon('arrow')}</span></a>` : ''}</section>
      ${D.provenance ? `<details class="methodology"><summary>How these recommendations were chosen</summary><p>${esc(D.provenance)}</p></details>` : ''}
    </div>`;
  }

  function filterValues(params = parseRoute(location.hash).params) {
    return Object.fromEntries(['q', 'collection', 'domain', 'tag', 'verdict'].map(key => [key, params.get(key) || '']));
  }
  const option = (value, label, selected) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`;
  function posts() {
    const f = filterValues();
    const collections = collectionNames();
    const allTags = [...new Set(D.posts.flatMap(p => p.tags))].sort();
    return `<div class="page-content"><div class="page-heading"><div><h1>Posts</h1><p>${demo() ? 'Demo posts, all fictional.' : `Everything in ${esc(kbName())}, with the useful parts brought forward.`}</p></div><a class="button button-primary" href="#add">${icon('add')} Add posts</a></div>
      <form class="filter-panel" id="filters" role="search" aria-label="Filter posts"><label class="search-field" for="post-search">${icon('search')}<span class="sr-only">Search posts by title, maker or tag</span><input id="post-search" name="q" type="search" placeholder="Search ideas, makers, or tags…" value="${esc(f.q)}" autocomplete="off"></label><div class="filter-grid"><div class="field"><label for="collection-filter">Collection</label><select id="collection-filter" name="collection">${option('', 'All collections', f.collection)}${collections.map(c => option(c, c, f.collection)).join('')}</select></div><div class="field"><label for="domain-filter">Domain</label><select id="domain-filter" name="domain">${option('', 'All domains', f.domain)}${D.domains.map(d => option(d.id, d.name, f.domain)).join('')}</select></div><div class="field"><label for="tag-filter">Tag</label><select id="tag-filter" name="tag">${option('', 'All tags', f.tag)}${allTags.map(t => option(t, t, f.tag)).join('')}</select></div><div class="field"><label for="verdict-filter">Verdict</label><select id="verdict-filter" name="verdict">${option('', 'All verdicts', f.verdict)}${Object.entries(verdicts).map(([key, v]) => option(key, `${v.symbol} ${v.label}`, f.verdict)).join('')}</select></div></div><div class="filter-footer"><div class="active-filters" id="active-filters"></div><button type="button" id="clear-filters" class="button-plain">Reset filters</button></div></form><div class="results-bar"><p id="results-count" role="status" aria-live="polite"></p><span></span></div><div id="post-results"></div></div>`;
  }
  function postCard(p) {
    return `<a class="post-card" href="#post/${esc(p.id)}"><div class="post-visual">${visual(p)}<span class="visual-type">${icon(p.type === 'video' ? 'creative' : 'posts')}${esc(p.type === 'video' ? (p.duration || 'Video') : 'Photo post')}</span></div><div class="post-card-body"><div class="post-meta"><span>${esc(domainById(p.domain).name)}</span>${p.collection ? `<span>${esc(p.collection)}</span>` : ''}</div><h2 class="post-title">${esc(p.title)}</h2><p class="post-summary">${esc(p.summary || '')}</p><div class="post-card-footer">${verdict(p)}${p.maker ? `<span class="maker">${esc(p.maker)}</span>` : ''}</div></div></a>`;
  }
  function updatePosts() {
    const f = filterValues();
    const result = filterPosts(D.posts, f);
    $('results-count').textContent = `${result.length} of ${D.posts.length} posts`;
    $('post-results').innerHTML = result.length ? `<div class="post-grid">${result.map(postCard).join('')}</div>` : D.posts.length ? `<div class="empty-state">${icon('search')}<h2>No posts match this combination.</h2><p>Try a broader search or clear a filter to find your next idea.</p><button type="button" class="button button-secondary" data-reset>Reset filters</button></div>` : emptyKb();
    $('active-filters').innerHTML = Object.entries(f).filter(([, value]) => value).map(([key, value]) => `<button type="button" class="filter-chip" data-remove-filter="${key}" aria-label="Remove ${esc(key)} filter: ${esc(value)}">${esc(key === 'domain' ? domainById(value)?.name || value : key === 'verdict' ? verdicts[value]?.short || value : value)}${icon('close')}</button>`).join('') || '<span class="filter-hint">Find the right idea, not just the latest one.</span>';
    $('clear-filters').disabled = !Object.values(f).some(Boolean);
  }
  function setFilters(values) {
    const params = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => { if (value) params.set(key, value); });
    history.replaceState(null, '', `#posts${params.size ? `?${params}` : ''}`);
    lastPostsRoute = location.hash;
    updatePosts();
  }

  function post(id) {
    const p = postById(id);
    if (!p) return `<div class="page-content empty-state"><h1>This note isn't in the workspace.</h1><p>Choose one of the posts to keep exploring.</p><a class="button button-primary" href="#posts">Browse posts</a></div>`;
    const design = p.design;
    const sections = ['What is explained', 'Tools, repos and links mentioned', ...(design ? ['Design'] : []), 'Core claim', 'Usefulness'];
    const related = D.posts.filter(item => item.domain === p.domain && item.id !== p.id);
    return `<div class="page-content"><a class="back-link" href="${esc(lastPostsRoute)}">${icon('back')} Back to posts</a><div class="post-layout"><article class="note"><header class="note-header"><div class="post-meta"><a href="#posts?domain=${encodeURIComponent(p.domain)}">${esc(domainById(p.domain).name)}</a>${p.collection ? `<span>${esc(p.collection)} collection</span>` : ''}</div><h1>${esc(p.title)}</h1><p class="note-byline">${p.maker ? `By <strong>${esc(p.maker)}</strong>` : ''}${p.maker ? '<span aria-hidden="true"> · </span>' : ''}${joinMeta([p.type === 'video' ? 'Video' : 'Photo post', p.type === 'video' && p.duration, fmtDate(p.date) && `Saved ${fmtDate(p.date)}`])}</p><div class="note-tags">${tags(p.tags)}</div></header>${visual(p, 'visual-large')}
        <section class="note-section" id="explained"><h2>What is explained</h2>${list(p.explained)}</section>
        <section class="note-section" id="tools"><h2>Tools, repos and links mentioned</h2>${p.tools.length ? `<ul class="tool-list">${p.tools.map(t => `<li><strong>${esc(t.name)}</strong> <span>${esc(t.description || '')}</span> ${t.evidence ? evidence(t.evidence) : ''}</li>`).join('')}</ul>` : '<p class="quiet-note">No tools or repositories are mentioned.</p>'}</section>
        ${design ? `<section class="note-section" id="design"><h2>Design</h2><dl class="design-details">${[['Colours', design.colours], ['Type', design.type], ['Layout', design.layout], ['Effects', design.effects], ['Looks like', design.looksLike]].filter(r => r[1]).map(r => `<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`).join('')}<dt>Libraries</dt><dd>${design.libraries.length ? design.libraries.map(l => `<div class="library-note"><strong>${esc(l.name)}</strong> ${l.evidence ? evidence(l.evidence) : ''}</div>`).join('') : 'None visible.'}</dd></dl></section>` : ''}
        <section class="note-section" id="claim"><h2>Core claim</h2><blockquote>${esc(p.claim || '')}</blockquote></section><section class="note-section" id="usefulness"><h2>Usefulness</h2><p>${esc(p.usefulness || '')}</p></section><div class="notice">${icon('info')}<span>${demo() ? 'This note is fictional demo content. ' : ''}The visual is an illustrative card, not a captured image of the post.</span></div></article>
        <aside class="note-aside" aria-label="Note context"><section class="verdict-panel"><h2>The takeaway</h2>${verdict(p)}<p>${esc(p.verdictReason || '')}</p>${p.project ? `<span class="small-label">Fits your project</span><strong>${esc(p.project)}</strong>` : ''}</section><section class="source-info"><h2>Source details</h2><dl>${p.maker ? `<dt>Maker</dt><dd>${esc(p.maker)}</dd>` : ''}${p.collection ? `<dt>Collection</dt><dd>${esc(p.collection)}</dd>` : ''}${p.type ? `<dt>Format</dt><dd>${esc(p.type)}</dd>` : ''}<dt>Post ID</dt><dd>${esc(p.id)}</dd>${demo() ? '<dt>Source</dt><dd><small>Fictional demo post, no live link</small></dd>' : safeUrl(p.url) ? `<dt>Source</dt><dd><a href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener noreferrer">${esc(safeUrl(p.url))}</a></dd>` : ''}</dl></section><nav class="note-jumps" aria-label="In this note"><h2>In this note</h2>${sections.map((s, i) => `<a href="#" data-jump="${['explained', 'tools', ...(design ? ['design'] : []), 'claim', 'usefulness'][i]}">${esc(s)}</a>`).join('')}</nav>${related.length ? `<section class="related-list"><h2>Same thread</h2>${related.map(r => `<a href="#post/${esc(r.id)}">${esc(r.title)}${icon('arrow')}</a>`).join('')}</section>` : ''}</aside></div></div>`;
  }
  function style() {
    const S = D.style;
    const count = D.posts.filter(p => p.design).length;
    if (!count && !S.recurring.length) return `<div class="page-content"><div class="empty-state">${icon('style')}<h2>No style summary yet.</h2><p>Style appears once posts with a Design section have been processed and STYLE.md exists.</p><a class="button button-secondary" href="#add">Add posts</a></div></div>`;
    const freq = new Map();
    D.posts.forEach(p => hexes(p.design?.colours).forEach(h => { const k = h.length === 4 ? '#' + [...h.slice(1)].map(c => c + c).join('') : h; freq.set(k.toUpperCase(), (freq.get(k.toUpperCase()) || 0) + 1); }));
    const swatches = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(e => e[0]);
    const palette = swatches.length ? `<div class="palette-study"><span class="eyebrow">Colours that recur</span><div class="palette-strip" aria-label="Colours named in the design notes">${swatches.map(h => `<div class="palette-color" style="--swatch:${h}"><span>${h}</span></div>`).join('')}</div><p>Hex values found in the design notes</p></div>` : '';
    return `<div class="page-content"><section class="style-opening"><div class="style-copy"><h1>Your eye has a pattern.</h1><p>A visual vocabulary drawn from the ${plural(S.designCount || count, 'post')} that show an interface. A starting point for your next design, not a set of rules.</p></div>${palette}</section>
      <section aria-labelledby="recurring-title"><div class="section-head"><div><h2 id="recurring-title">Recurring style</h2><p>The details you keep coming back to.</p></div></div><div class="recurring-grid">${S.recurring.map(r => `<div class="recurring-item"><div><h3>${esc(r.label)}</h3><span class="small-count">${r.count} posts</span></div><p>${esc(r.text)}</p></div>`).join('')}</div></section>
      <section aria-labelledby="groups-title"><div class="section-head"><div><h2 id="groups-title">Style groups</h2><p>${S.groups.reduce((n, g) => n + g.postIds.length, 0)} of ${S.designCount || count} designs fall into these distinct looks.</p></div></div><div class="style-group-grid">${S.groups.map(g => `<article class="style-group">${visual({ visual: g.visual, color: g.visual === 'interface' ? 'blue' : 'sand', title: g.name })}<div class="style-group-body"><div class="post-meta"><span>${g.postIds.length} posts</span></div><h3>${esc(g.name)}</h3><p>${esc(g.description)}</p><p class="takeaway"><strong>Take from it</strong>${esc(g.take)}</p><div class="group-sources">${sourceLinks(g.postIds)}</div></div></article>`).join('')}</div></section>
      <section aria-labelledby="libraries-title"><div class="section-head"><div><h2 id="libraries-title">Libraries that keep showing up</h2><p>Visible names and educated guesses, kept separate.</p></div></div><div class="library-table"><table><thead><tr><th scope="col">Library</th><th scope="col">Posts</th><th scope="col">How sure</th></tr></thead><tbody>${S.libraries.length ? '' : '<tr><td colspan="3">None recorded.</td></tr>'}${S.libraries.map(l => `<tr><th scope="row">${esc(l.name)}</th><td>${sourceLinks([...l.onScreen, ...l.guessed])}</td><td>${l.onScreen.length ? evidence(`On screen in ${l.onScreen.length}`) : ''}${l.guessed.length ? evidence(l.onScreen.length ? `Guessed in ${l.guessed.length}` : 'Guessed only') : ''}</td></tr>`).join('')}</tbody></table></div><p class="quiet-note">Libraries have not been installed or tested.</p></section>
      <section aria-labelledby="best-title"><div class="section-head"><div><h2 id="best-title">Best examples</h2><p>Clear enough to learn from. Specific enough to reuse.</p></div><a class="text-link" href="#posts">Browse all posts ${icon('arrow')}</a></div><div class="best-list">${S.best.map(b => { const p = postById(b.postId); if (!p) return ''; return `<article class="best-row">${visual(p, 'miniature')}<div class="best-copy"><h3>${postLink(p.id, p.title)}</h3><p>${esc(b.why)}</p><span class="maker">${esc(p.maker)}</span></div>${postLink(p.id, 'Read note', 'text-link')}</article>`; }).join('')}</div></section></div>`;
  }

  const COMMAND = 'Ask Claude Code: add my newly saved posts to Scrollback';
  const phaseHelp = { Profile: 'Your projects and installed tools.', Links: 'Post links gathered in links.tsv.', Fetch: 'Captions, transcripts and frames.', Notes: 'One note per post.', Synthesis: 'Overview, domains and style.' };
  const phaseIcons = { Profile: 'profile', Links: 'link', Fetch: 'fetch', Notes: 'posts', Synthesis: 'synthesis' };
  const addState = { result: null, error: '', busy: false, links: '', collection: '' };
  function statusPanel() {
    const st = D.status || {};
    const phases = st.phases || [];
    const next = phases.findIndex(p => !p.done);
    const counts = [['links', st.links], ['fetched', st.fetched], ['notes', st.notes]].filter(c => Number.isFinite(c[1])).map(c => `${c[1]} ${c[0]}`).join(' · ');
    return `<div class="run-header"><h2>Where your knowledge base stands</h2><span class="run-badge run-${next === -1 && phases.length ? 'complete' : 'idle'}">${next === -1 && phases.length ? 'Up to date' : 'Work to do'}</span></div>${counts ? `<p class="quiet-note">${esc(counts)}</p>` : ''}${phases.length ? `<ol class="run-phases">${phases.map((ph, i) => `<li class="phase ${ph.done ? 'phase-done' : i === next ? 'phase-active' : ''}"${i === next ? ' aria-current="step"' : ''}><span class="phase-icon">${icon(ph.done ? 'check' : phaseIcons[ph.name] || 'posts')}</span><span class="phase-copy"><strong>${esc(ph.name)}</strong><small>${esc(ph.detail || phaseHelp[ph.name] || '')}</small></span><span class="phase-status">${ph.done ? 'Done' : i === next ? 'Next' : 'To do'}</span></li>`).join('')}</ol>` : '<p class="quiet-note">No status available for this folder.</p>'}
      <div class="run-complete"><h3>Process the new links in Claude Code</h3><p>This page only collects links. Fetching and writing notes happens in Claude Code with the Scrollback plugin. Open it in your knowledge base folder and say:</p><p><code id="cc-command">${esc(COMMAND)}</code></p><p>or run the skill directly: <code>/scrollback:scrollback</code></p><button type="button" class="button button-secondary" id="copy-command">Copy the request</button> <span id="copy-state" class="small-count" role="status"></span></div>`;
  }
  function resultPanel() {
    const r = addState.result;
    if (addState.error) return `<p class="error-text" role="alert">${esc(addState.error)}</p>`;
    if (!r) return '';
    const skipped = r.skipped || [];
    return `<div class="notice" role="status">${icon(r.added ? 'check' : 'info')}<span>${demo() ? 'Demo mode: nothing was saved. ' : ''}${r.added ? `${demo() ? 'Would have added' : 'Added'} ${plural(r.added, 'link')}.` : 'No new links added.'}${skipped.length ? ` Skipped ${skipped.length}:` : ''}</span></div>${skipped.length ? `<ul class="skip-list">${skipped.map(x => `<li><code>${esc(x.url)}</code> ${esc(x.reason)}</li>`).join('')}</ul>` : ''}`;
  }
  function add() {
    return `<div class="page-content"><div class="page-heading"><div><h1>Add posts</h1><p>Paste links to saved posts. Claude Code turns them into notes.</p></div></div>${demo() ? `<div class="notice demo-notice">${icon('info')}<span>Demo mode. Nothing you add here is saved.</span></div>` : ''}<div class="add-layout"><form class="add-form" id="links-form" novalidate><fieldset id="add-fields"><legend class="form-legend">Which posts?</legend><div class="field"><label for="post-links">Post links</label><textarea id="post-links" rows="6" aria-describedby="links-help" placeholder="One Instagram or TikTok post link per line">${esc(addState.links)}</textarea><p class="input-help" id="links-help">Links to single posts only. Tracking parameters are removed and known posts are skipped.</p></div><div class="field"><label for="collection-input">Collection</label><input id="collection-input" name="collection" list="collection-list" autocomplete="off" placeholder="unsorted" value="${esc(addState.collection)}"><datalist id="collection-list">${collectionNames().map(c => `<option value="${esc(c)}"></option>`).join('')}</datalist></div><div id="add-result" aria-live="polite">${resultPanel()}</div></fieldset><div class="form-actions"><button class="button button-primary" id="add-submit" type="submit"${addState.busy ? ' disabled' : ''}>${icon('add')}${addState.busy ? 'Adding…' : 'Add links'}</button></div></form><section class="run-panel" id="run-panel" aria-label="Knowledge base status">${statusPanel()}</section></div></div>`;
  }
  async function submitLinks() {
    const text = $('post-links').value, collection = $('collection-input').value.trim();
    addState.links = text; addState.collection = collection; addState.error = ''; addState.result = null;
    if (!text.trim()) { addState.error = 'Paste at least one post link.'; $('add-result').innerHTML = resultPanel(); $('post-links').focus(); return; }
    addState.busy = true; $('add-submit').disabled = true;
    try {
      const res = await fetch('/api/links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collection: collection || 'unsorted', text }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `The server answered ${res.status}.`);
      addState.result = body;
      if (body.added && !body.demo) { addState.links = ''; await reload(); }
    } catch (err) { addState.error = `Could not add the links. ${err.message || ''}`.trim(); }
    addState.busy = false;
    if (parseRoute(location.hash).page === 'add') { render(false); announce(addState.error || 'Links processed.'); }
  }
  function emptyKb() {
    return `<div class="page-content"><div class="empty-state">${icon('posts')}<h1>No notes yet.</h1><p>${esc(kbName())} knowledge base has no processed posts. Add some links, then ask Claude Code to process them.</p><a class="button button-primary" href="#add">${icon('add')} Add posts</a></div></div>`;
  }
  function warningsBanner() {
    const w = D.warnings || [];
    return w.length ? `<div class="page-content" style="padding-bottom:0"><div class="notice" role="status">${icon('info')}<span>Some files could not be read fully:<br>${w.map(esc).join('<br>')}</span></div></div>` : '';
  }
  function announce(text) { $('announcer').textContent = text; }
  let lastPostsRoute = '#posts';
  function render(focus = true) {
    const route = parseRoute(location.hash);
    const navPage = route.page === 'post' ? 'posts' : route.page;
    if (route.page === 'posts') lastPostsRoute = location.hash || '#posts';
    const labels = { overview: 'Overview', posts: 'Posts', style: 'Style', add: 'Add posts' };
    $('navigation').innerHTML = Object.entries(labels).map(([key, label]) => `<a class="nav-link${key === navPage ? ' is-current' : ''}" href="#${key}"${key === navPage ? ' aria-current="page"' : ''}>${icon(key)}<span>${label}</span>${key === 'posts' ? `<span class="nav-count">${D.posts.length}</span>` : ''}</a>`).join('');
    $('collections').innerHTML = collectionNames().map(c => `<a class="collection-link" href="#posts?collection=${encodeURIComponent(c)}"><span>${esc(c)}</span><span class="collection-count">${D.posts.filter(p => p.collection === c).length}</span></a>`).join('');
    $('current-page').textContent = route.page === 'post' ? 'Post' : labels[route.page];
    document.title = `${route.page === 'post' ? postById(route.id)?.title || 'Post' : labels[route.page]} · Scrollback`;
    $('workspace-name').textContent = `${kbName()} workspace`;
    $('rail-note').innerHTML = demo() ? '<span class="demo-label">Demo workspace</span><p class="workspace-name">Fictional posts.<br>Nothing here is saved.</p>' : `<span class="demo-label">Local knowledge base</span><p class="workspace-name">${esc(kbName())}<br>${plural(D.posts.length, 'post')}</p>`;
    $('footer-note').textContent = demo() ? 'Fictional content · Demo' : `Local · ${kbName()}`;
    $('main').innerHTML = warningsBanner() + ({ overview, posts, post: () => post(route.id), style, add }[route.page])();
    if (route.page === 'posts') updatePosts();
    if (focus) { $('main').focus({ preventScroll: true }); window.scrollTo(0, 0); }
  }
  function updateThemeButton() {
    const dark = document.documentElement.dataset.theme === 'dark';
    $('theme-toggle').innerHTML = icon(dark ? 'sun' : 'moon');
    $('theme-toggle').setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
    $('theme-toggle').title = `Switch to ${dark ? 'light' : 'dark'} mode`;
  }
  $('search-icon').innerHTML = icon('search');
  updateThemeButton();
  $('theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('scrollback-theme', next); } catch (_) { /* File previews may restrict storage. */ }
    updateThemeButton();
    announce(`${next === 'dark' ? 'Dark' : 'Light'} mode enabled.`);
  });
  function findPost() { if (parseRoute(location.hash).page !== 'posts') { location.hash = '#posts'; setTimeout(() => $('post-search')?.focus(), 0); } else $('post-search').focus(); }
  $('find-post').addEventListener('click', findPost);
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest('input,textarea,select,[contenteditable]')) { event.preventDefault(); findPost(); }
  });
  document.addEventListener('submit', event => {
    if (event.target.id === 'filters') event.preventDefault();
    if (event.target.id === 'links-form') { event.preventDefault(); submitLinks(); }
  });
  document.addEventListener('input', event => {
    if (event.target.closest('#filters')) setFilters(Object.fromEntries(new FormData($('filters'))));
    if (event.target.id === 'post-links') addState.links = event.target.value;
    if (event.target.id === 'collection-input') addState.collection = event.target.value;
  });
  document.addEventListener('change', event => {
    if (event.target.closest('#filters')) setFilters(Object.fromEntries(new FormData($('filters'))));
  });
  document.addEventListener('click', event => {
    const target = event.target.closest('button,a');
    if (!target) return;
    if (target.classList.contains('skip-link')) { event.preventDefault(); $('main').focus(); return; }
    if (target.id === 'clear-filters' || target.hasAttribute('data-reset')) { $('filters').reset(); for (const input of $('filters').elements) if (input.name) input.value = ''; setFilters({}); $('post-search').focus(); }
    if (target.dataset.removeFilter) { const f = filterValues(); f[target.dataset.removeFilter] = ''; $('filters').elements[target.dataset.removeFilter].value = ''; setFilters(f); $('filters').elements[target.dataset.removeFilter].focus(); }
    if (target.dataset.jump) { event.preventDefault(); const section = $(target.dataset.jump); section.setAttribute('tabindex', '-1'); section.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); section.focus({ preventScroll: true }); }
    if (target.id === 'copy-command') {
      const done = ok => { $('copy-state').textContent = ok ? 'Copied' : 'Select the text and copy it'; };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(COMMAND).then(() => done(true), () => done(false)); else done(false);
    }
    if (target.id === 'retry-load') boot();
  });
  async function load() {
    const res = await fetch('/api/kb', { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`The server answered ${res.status}.`);
    D = normalise(await res.json());
  }
  async function reload() { try { await load(); } catch (_) { /* keep the data we have */ } }
  async function boot() {
    $('main').innerHTML = '<div class="page-content"><p class="quiet-note" role="status">Loading your knowledge base…</p></div>';
    try { await load(); }
    catch (err) {
      $('main').innerHTML = `<div class="page-content"><div class="empty-state">${icon('info')}<h1>Could not load the knowledge base.</h1><p>The Scrollback server is not answering. Check that it is still running in your terminal, then try again.</p><button type="button" class="button button-primary" id="retry-load">Try again</button></div></div>`;
      return;
    }
    render(false);
  }
  window.addEventListener('hashchange', () => { if (D.posts.length || D.kb.name || D.demo !== undefined) render(); });
  boot();
})();
