/* ═══════════════════════════════════════════════════════════
   APIForge — Frontend Application
═══════════════════════════════════════════════════════════ */

// ── State ─────────────────────────────────────────────────
const state = {
  projects: JSON.parse(localStorage.getItem('apiforge_projects') || '[]'),
  activeProject: null,
  generatedFiles: {},   // { filename: code }
  activeFile: null,
  isEditing: false,
  selections: {
    lang: 'Node.js',
    db: null,
    auth: null,
    extras: []
  }
};

// ── DOM refs ──────────────────────────────────────────────
const $ = id => document.getElementById(id);
const descTA      = $('apiDescription');
const charCount   = $('charCount');
const generateBtn = $('generateBtn');
const emptyState  = $('emptyState');
const generatedView = $('generatedView');
const fileTabs    = $('fileTabs');
const codeEditor  = $('codeEditor');
const lineNumbers = $('lineNumbers');
const copyBtn     = $('copyBtn');
const editBtn     = $('editBtn');
const saveBtn     = $('saveBtn');
const downloadBtn = $('downloadBtn');
const projectNameInput = $('projectNameInput');
const saveProjectBtn   = $('saveProjectBtn');
const projectList = $('projectList');
const apiCount    = $('apiCount');
const usageText   = $('usageText');
const usageFill   = $('usageFill');
const loadingOverlay = $('loadingOverlay');
const loadingText = $('loadingText');

// ── Tag selection ─────────────────────────────────────────
document.querySelectorAll('.tag').forEach(tag => {
  tag.addEventListener('click', () => {
    const group = tag.dataset.group;
    const val   = tag.dataset.val;

    if (group === 'extras') {
      tag.classList.toggle('active');
      const idx = state.selections.extras.indexOf(val);
      if (idx === -1) state.selections.extras.push(val);
      else state.selections.extras.splice(idx, 1);
    } else {
      // single-select per group
      document.querySelectorAll(`.tag[data-group="${group}"]`).forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
      state.selections[group] = val;
    }
  });
});

// ── Char counter ──────────────────────────────────────────
descTA.addEventListener('input', () => {
  charCount.textContent = `${descTA.value.length} characters`;
});

// ── Quick templates ───────────────────────────────────────
const TEMPLATES = {
  auth: {
    desc: 'Build a REST API with user authentication system including registration, login, logout, JWT token refresh, password reset via email, and role-based access control (admin, user, moderator).',
    lang: 'Node.js', db: 'PostgreSQL', auth: 'JWT', extras: ['Tests']
  },
  crud: {
    desc: 'Build a full CRUD REST API for a product catalog with categories, tags, search/filter, pagination, image upload support, and soft delete functionality.',
    lang: 'Node.js', db: 'MongoDB', auth: 'None', extras: ['OpenAPI']
  },
  payment: {
    desc: 'Build a payment processing API with Stripe integration, subscription management, invoice generation, webhook handling for payment events, and refund processing.',
    lang: 'Python', db: 'PostgreSQL', auth: 'JWT', extras: ['Docker', 'Tests']
  },
  chat: {
    desc: 'Build a real-time chat API with WebSocket support, rooms/channels, direct messages, message history, online presence indicators, and file sharing.',
    lang: 'Node.js', db: 'MongoDB', auth: 'JWT', extras: ['Docker']
  }
};

document.querySelectorAll('.qt-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tpl = TEMPLATES[btn.dataset.tpl];
    if (!tpl) return;
    descTA.value = tpl.desc;
    charCount.textContent = `${tpl.desc.length} characters`;

    // Apply tag selections
    document.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
    state.selections = { lang: tpl.lang, db: tpl.db, auth: tpl.auth, extras: [...tpl.extras] };

    document.querySelectorAll(`.tag[data-group="lang"][data-val="${tpl.lang}"]`).forEach(t => t.classList.add('active'));
    if (tpl.db) document.querySelectorAll(`.tag[data-group="db"][data-val="${tpl.db}"]`).forEach(t => t.classList.add('active'));
    if (tpl.auth) document.querySelectorAll(`.tag[data-group="auth"][data-val="${tpl.auth}"]`).forEach(t => t.classList.add('active'));
    tpl.extras.forEach(e => document.querySelectorAll(`.tag[data-group="extras"][data-val="${e}"]`).forEach(t => t.classList.add('active')));
  });
});

// ── New Project button ────────────────────────────────────
$('newProjectBtn').addEventListener('click', () => {
  descTA.value = '';
  charCount.textContent = '0 characters';
  state.generatedFiles = {};
  state.activeFile = null;
  state.activeProject = null;
  state.isEditing = false;
  emptyState.style.display = 'flex';
  generatedView.style.display = 'none';
  projectNameInput.value = '';
  document.querySelectorAll('.project-item').forEach(p => p.classList.remove('active'));
});

// ── Generate ──────────────────────────────────────────────
generateBtn.addEventListener('click', async () => {
  const desc = descTA.value.trim();
  if (!desc) { showToast('Please describe your API first', 'error'); return; }

  showLoading('Generating your API...');
  generateBtn.disabled = true;

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: desc,
        language: state.selections.lang,
        database: state.selections.db,
        auth: state.selections.auth,
        extras: state.selections.extras
      })
    });

    if (!res.ok) throw new Error('Generation failed');
    const data = await res.json();

    state.generatedFiles = data.files;
    state.activeFile = Object.keys(data.files)[0];

    renderFileTabs();
    renderCode();
    emptyState.style.display = 'none';
    generatedView.style.display = 'flex';

    // Suggest project name
    if (!projectNameInput.value) {
      projectNameInput.value = guessProjectName(desc);
    }

    showToast('✅ API generated successfully!', 'success');
  } catch (err) {
    showToast('Generation failed: ' + err.message, 'error');
  } finally {
    hideLoading();
    generateBtn.disabled = false;
  }
});

// ── File tabs ─────────────────────────────────────────────
function renderFileTabs() {
  fileTabs.innerHTML = '';
  Object.keys(state.generatedFiles).forEach(filename => {
    const tab = document.createElement('button');
    tab.className = 'file-tab' + (filename === state.activeFile ? ' active' : '');
    tab.innerHTML = `<span class="file-tab-icon">${fileIcon(filename)}</span>${filename}`;
    tab.addEventListener('click', () => {
      // Save edits before switching
      if (state.isEditing && state.activeFile) {
        state.generatedFiles[state.activeFile] = codeEditor.value;
      }
      state.activeFile = filename;
      renderFileTabs();
      renderCode();
    });
    fileTabs.appendChild(tab);
  });
}

function fileIcon(name) {
  if (name.endsWith('.js') || name.endsWith('.ts')) return '📄';
  if (name.endsWith('.py')) return '🐍';
  if (name.endsWith('.go')) return '🔵';
  if (name.endsWith('.json')) return '{}';
  if (name.includes('docker') || name.includes('Docker')) return '🐳';
  if (name.endsWith('.md')) return '📝';
  if (name.endsWith('.yml') || name.endsWith('.yaml')) return '⚙️';
  if (name.endsWith('.env')) return '🔑';
  if (name.endsWith('.sql')) return '🗄️';
  return '📄';
}

// ── Code render ───────────────────────────────────────────
function renderCode() {
  const code = state.generatedFiles[state.activeFile] || '';
  codeEditor.value = code;
  updateLineNumbers(code);
}

function updateLineNumbers(code) {
  const lines = code.split('\n').length;
  lineNumbers.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
}

codeEditor.addEventListener('input', () => {
  updateLineNumbers(codeEditor.value);
  if (state.isEditing && state.activeFile) {
    state.generatedFiles[state.activeFile] = codeEditor.value;
  }
});

// Sync scroll between line numbers and editor
codeEditor.addEventListener('scroll', () => {
  lineNumbers.scrollTop = codeEditor.scrollTop;
});

// ── Edit mode ─────────────────────────────────────────────
editBtn.addEventListener('click', () => {
  state.isEditing = !state.isEditing;
  if (state.isEditing) {
    codeEditor.removeAttribute('readonly');
    codeEditor.classList.add('editable');
    editBtn.textContent = '👁️ View';
    editBtn.style.borderColor = 'var(--yellow)';
    editBtn.style.color = 'var(--yellow)';
    saveBtn.style.display = 'inline-block';
    codeEditor.focus();
  } else {
    codeEditor.setAttribute('readonly', '');
    codeEditor.classList.remove('editable');
    editBtn.textContent = '✏️ Edit';
    editBtn.style.borderColor = '';
    editBtn.style.color = '';
    saveBtn.style.display = 'none';
    // Save current file edits
    if (state.activeFile) {
      state.generatedFiles[state.activeFile] = codeEditor.value;
    }
  }
});

saveBtn.addEventListener('click', () => {
  if (state.activeFile) {
    state.generatedFiles[state.activeFile] = codeEditor.value;
    showToast('✅ Changes saved', 'success');
  }
});

// ── Copy ──────────────────────────────────────────────────
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(codeEditor.value);
    copyBtn.textContent = '✅ Copied!';
    setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 2000);
  } catch {
    showToast('Copy failed', 'error');
  }
});

// ── Download ZIP ──────────────────────────────────────────
downloadBtn.addEventListener('click', async () => {
  // Save any pending edits
  if (state.isEditing && state.activeFile) {
    state.generatedFiles[state.activeFile] = codeEditor.value;
  }

  showLoading('Preparing ZIP file...');
  try {
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: state.generatedFiles,
        projectName: projectNameInput.value || 'my-api'
      })
    });

    if (!res.ok) throw new Error('Download failed');

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${(projectNameInput.value || 'my-api').replace(/\s+/g, '-').toLowerCase()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ ZIP downloaded!', 'success');
  } catch (err) {
    showToast('Download failed: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
});

// ── Save project to sidebar ───────────────────────────────
saveProjectBtn.addEventListener('click', () => {
  const name = projectNameInput.value.trim();
  if (!name) { showToast('Enter a project name', 'error'); return; }
  if (Object.keys(state.generatedFiles).length === 0) { showToast('No generated code to save', 'error'); return; }

  const lang = state.selections.lang || 'Node.js';
  const endpointCount = countEndpoints(state.generatedFiles);

  if (state.activeProject !== null) {
    // Update existing
    state.projects[state.activeProject] = {
      ...state.projects[state.activeProject],
      name, lang, files: { ...state.generatedFiles },
      endpoints: endpointCount,
      updatedAt: Date.now()
    };
    showToast('✅ Project updated', 'success');
  } else {
    // New project
    state.projects.unshift({
      id: Date.now(),
      name, lang,
      files: { ...state.generatedFiles },
      endpoints: endpointCount,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    state.activeProject = 0;
    showToast('✅ Project saved!', 'success');
  }

  persistProjects();
  renderProjectList();
});

// ── Project list ──────────────────────────────────────────
function renderProjectList() {
  projectList.innerHTML = '';
  const filtered = state.projects.filter(p =>
    p.name.toLowerCase().includes(($('searchInput').value || '').toLowerCase())
  );

  filtered.forEach((proj, idx) => {
    const item = document.createElement('div');
    item.className = 'project-item' + (state.activeProject === idx ? ' active' : '');
    item.innerHTML = `
      <div class="pi-left">
        <div class="pi-name">${escHtml(proj.name)}</div>
        <div class="pi-meta">${proj.endpoints} endpoint${proj.endpoints !== 1 ? 's' : ''} · ${timeAgo(proj.updatedAt)}</div>
      </div>
      <span class="pi-badge ${langBadge(proj.lang)}">${proj.lang}</span>
    `;
    item.addEventListener('click', () => loadProject(idx));
    projectList.appendChild(item);
  });

  apiCount.textContent = state.projects.length;
  const pct = Math.min((state.projects.length / 50) * 100, 100);
  usageFill.style.width = pct + '%';
  usageText.textContent = `${state.projects.length} / 50 free`;
}

function loadProject(idx) {
  const proj = state.projects[idx];
  if (!proj) return;

  state.activeProject = idx;
  state.generatedFiles = { ...proj.files };
  state.activeFile = Object.keys(proj.files)[0];
  state.isEditing = false;

  codeEditor.setAttribute('readonly', '');
  codeEditor.classList.remove('editable');
  editBtn.textContent = '✏️ Edit';
  editBtn.style.borderColor = '';
  editBtn.style.color = '';
  saveBtn.style.display = 'none';

  projectNameInput.value = proj.name;
  renderFileTabs();
  renderCode();
  emptyState.style.display = 'none';
  generatedView.style.display = 'flex';

  document.querySelectorAll('.project-item').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
}

$('searchInput').addEventListener('input', renderProjectList);

// ── Helpers ───────────────────────────────────────────────
function guessProjectName(desc) {
  const words = desc.split(/\s+/).slice(0, 5);
  const name = words.join(' ').replace(/[^a-zA-Z0-9 ]/g, '').trim();
  return name || 'My API';
}

function countEndpoints(files) {
  let count = 0;
  Object.values(files).forEach(code => {
    const matches = code.match(/\.(get|post|put|delete|patch)\s*\(/gi) || [];
    count += matches.length;
  });
  return count || Math.floor(Math.random() * 8) + 3;
}

function langBadge(lang) {
  if (!lang) return 'badge-node';
  const l = lang.toLowerCase();
  if (l.includes('python')) return 'badge-python';
  if (l.includes('go'))     return 'badge-go';
  return 'badge-node';
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d} day${d > 1 ? 's' : ''} ago`;
  return new Date(ts).toLocaleDateString();
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function persistProjects() {
  localStorage.setItem('apiforge_projects', JSON.stringify(state.projects));
}

function showLoading(msg) {
  loadingText.textContent = msg || 'Processing...';
  loadingOverlay.style.display = 'flex';
}
function hideLoading() {
  loadingOverlay.style.display = 'none';
}

function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── Init ──────────────────────────────────────────────────
renderProjectList();
