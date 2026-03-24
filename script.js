// ══════════════════════════════════════════
// SUPABASE
// ══════════════════════════════════════════
const SUPABASE_URL = 'https://ccbjhuuzidqxeplrvtrj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjYmpodXV6aWRxeGVwbHJ2dHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDA5MjMsImV4cCI6MjA4OTQxNjkyM30.HVfW1Co6vUw9NDJWoV3pUU53w-preCFyYENr3CAagec';
const HDR = { 'Content-Type':'application/json', 'apikey':SUPABASE_KEY, 'Authorization':'Bearer '+SUPABASE_KEY };

async function sbFetch(path, opts = {}) {
  const method = opts.method || 'GET';
  const needsRepresentation = method === 'POST' || method === 'PATCH';
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    method,
    headers: {
      ...HDR,
      ...(needsRepresentation ? { 'Prefer': 'return=representation' } : {}),
      ...(opts.headers || {}),
    },
    ...(opts.body ? { body: opts.body } : {}),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || e.error || 'HTTP '+res.status); }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : [];
}

// ══════════════════════════════════════════
// STATE
// ══════════════════════════════════════════
let systems = [];
let docs     = [];
let currentId    = null;
let editingId    = null;
let filterSystem = 'all';
let searchQ      = '';
let saveTimer    = null;
let newDocSelectedSystem = null;
let sysToDelete  = null;
let newSysSelectedEmoji = '📄';

const EMOJI_OPTIONS = ['📦','🗂️','🖥️','📋','📊','🔧','🏗️','👥','💼','🏛️','📝','🔐','💰','📡','🚚','🏥','📚','⚙️','🗃️','🔑','📈','🌐','🔬','🏭'];

// ══════════════════════════════════════════
// DB STATUS
// ══════════════════════════════════════════
function setDbStatus(state, label) {
  document.getElementById('dbDot').className = 'dot ' + state;
  document.getElementById('dbLabel').textContent = label;
}

// ══════════════════════════════════════════
// LOAD — sistemas primeiro, depois manuais
// ══════════════════════════════════════════
async function dbLoad() {
  setDbStatus('loading', 'Conectando…');
  try {
    const [sysData, docData] = await Promise.all([
      sbFetch('sistemas?order=ordem.asc,created_at.asc&select=*'),
      sbFetch('manuais?order=updated_at.desc&select=*'),
    ]);
    systems = sysData;
    docs    = docData;
    setDbStatus('ok', 'Supabase');
    renderSystemTabs();
    renderList();
    updateEmptyState();
    showPanel('empty');
  } catch (e) {
    setDbStatus('err', 'Erro de conexão');
    document.getElementById('docList').innerHTML = `<div class="list-empty">Não foi possível conectar.<br><small>${e.message}</small></div>`;
    document.getElementById('sidebarFooter').textContent = 'Erro';
    showToast('❌', 'Erro: ' + e.message, true);
  }
}

// ══════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════
function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString('pt-BR', {day:'2-digit',month:'short',year:'numeric'}) : '—'; }
function stripHtml(html) { const d = document.createElement('div'); d.innerHTML = html; return d.textContent || ''; }
function wc(html) { const t = stripHtml(html).trim(); return t ? t.split(/\s+/).filter(Boolean).length : 0; }
function getSys(id) { return systems.find(s => s.id === id) || null; }
function escHtml(t) { return String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ══════════════════════════════════════════
// EMPTY STATE
// ══════════════════════════════════════════
function updateEmptyState() {
  const noSys = systems.length === 0;
  document.getElementById('emptyTitle').textContent = noSys ? 'Nenhum sistema cadastrado' : 'Nenhum manual aberto';
  document.getElementById('emptyDesc').textContent  = noSys
    ? 'Comece adicionando um sistema para depois criar manuais vinculados a ele.'
    : 'Selecione um manual na lista ou crie um novo documento.';
}

// ══════════════════════════════════════════
// RENDER SYSTEM TABS
// ══════════════════════════════════════════
function renderSystemTabs() {
  document.getElementById('systemTabsContainer').innerHTML = systems.map(s => `
    <button class="sys-tab ${filterSystem === s.id ? 'active' : ''}" onclick="setSystem('${s.id}', this)" id="tab_${s.id}">
      <div class="sys-tab-icon">${s.icone}</div>
      <div class="sys-tab-info">
        <div class="sys-tab-name">${escHtml(s.nome)}</div>
        <div class="sys-tab-count" id="count_${s.id}">—</div>
      </div>
      ${s.status ? `<span class="sys-tab-pill">${escHtml(s.status)}</span>` : ''}
      <button class="sys-tab-del" title="Remover sistema" onclick="event.stopPropagation(); openDeleteSysModal('${s.id}')">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </button>
  `).join('');
  updateCounts();
}

function updateCounts() {
  const allCount = docs.length;
  document.getElementById('countAll').textContent = allCount + ' manual' + (allCount !== 1 ? 'is' : '');
  systems.forEach(s => {
    const el = document.getElementById('count_' + s.id);
    if (el) { const n = docs.filter(d => d.system === s.id).length; el.textContent = n + ' manual' + (n !== 1 ? 'is' : ''); }
  });
  document.getElementById('topbarInfo').textContent = allCount + ' manual' + (allCount !== 1 ? 'is' : '') + ' · ' + systems.length + ' sistema' + (systems.length !== 1 ? 's' : '');
}

function populateSysSelect(selectedId) {
  const sel = document.getElementById('editorSysSelect');
  if (systems.length === 0) { sel.innerHTML = '<option value="">— sem sistemas —</option>'; return; }
  sel.innerHTML = systems.map(s => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${s.icone} ${escHtml(s.nome)}</option>`).join('');
}

// ══════════════════════════════════════════
// RENDER DOC LIST
// ══════════════════════════════════════════
function renderList() {
  updateCounts();
  let filtered = docs.filter(d => {
    const matchSys = filterSystem === 'all' || d.system === filterSystem;
    const matchQ   = !searchQ || (d.title||'').toLowerCase().includes(searchQ.toLowerCase()) || stripHtml(d.content||'').toLowerCase().includes(searchQ.toLowerCase());
    return matchSys && matchQ;
  });

  document.getElementById('sidebarFooter').textContent =
    filtered.length + ' manual' + (filtered.length !== 1 ? 'is' : '') + ' encontrado' + (filtered.length !== 1 ? 's' : '');

  const list = document.getElementById('docList');
  if (filtered.length === 0) {
    list.innerHTML = `<div class="list-empty">${systems.length === 0 ? 'Adicione um sistema<br>para criar manuais.' : 'Nenhum manual encontrado.'}</div>`;
    return;
  }

  const groups = {};
  filtered.forEach(d => { const k = d.system || '__sem_sistema__'; if (!groups[k]) groups[k] = []; groups[k].push(d); });

  list.innerHTML = Object.entries(groups).map(([sysId, items]) => {
    const sys = getSys(sysId);
    const header = filterSystem === 'all'
      ? `<div class="doc-group-header"><span class="doc-group-label">${sys ? sys.icone + ' ' + escHtml(sys.nome) : '— sem sistema'}</span><div class="doc-group-line"></div></div>`
      : '';
    return header + items.map((d, i) => `
      <div class="doc-item ${d.id === currentId ? 'active' : ''}" style="animation-delay:${i*25}ms" onclick="openDoc('${d.id}')">
        <div class="doc-item-title">${escHtml(d.title || 'Sem título')}</div>
        <div class="doc-item-meta">
          ${sys ? `<span class="sys-badge">${escHtml(sys.nome)}</span>` : ''}
          ${fmtDate(d.updated_at)}
        </div>
        <div class="doc-item-preview">${escHtml(stripHtml(d.content || ''))}</div>
        <div class="doc-item-actions">
          <button class="icon-btn" title="Editar" onclick="event.stopPropagation(); openDoc('${d.id}'); editCurrent()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="icon-btn danger" title="Excluir" onclick="event.stopPropagation(); currentId='${d.id}'; confirmDelete()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </div>`).join('');
  }).join('');
}

// ══════════════════════════════════════════
// VIEW
// ══════════════════════════════════════════
function openDoc(id) {
  currentId = id;
  const doc = docs.find(d => d.id === id);
  if (!doc) return;
  const sys = getSys(doc.system);
  showPanel('viewer');
  document.getElementById('viewerTitle').textContent    = doc.title || 'Sem título';
  document.getElementById('viewerSysBadge').innerHTML  = sys ? `<span class="sys-badge">${sys.icone} ${escHtml(sys.nome)}</span>` : '';
  document.getElementById('viewerMeta').textContent    = fmtDate(doc.updated_at) + ' · ' + wc(doc.content) + ' palavras';
  document.getElementById('viewerDocTitle').textContent = doc.title || 'Sem título';
  document.getElementById('viewerDocByline').innerHTML =
    (sys ? `<span class="sys-badge">${sys.icone} ${escHtml(sys.nome)}</span><span>${escHtml(sys.nome_completo)}</span><span>·</span>` : '') +
    `<span>Criado em ${fmtDate(doc.created_at)}</span><span>·</span><span>${wc(doc.content)} palavras</span>`;
  document.getElementById('viewerDocBody').innerHTML   = doc.content || '';
  renderList();
}

// ══════════════════════════════════════════
// NEW DOC MODAL
// ══════════════════════════════════════════
function openNewDocModal() {
  newDocSelectedSystem = systems.length > 0 ? systems[0].id : null;
  document.getElementById('newDocTitle').value = '';
  document.getElementById('newDocSysError').classList.remove('show');
  renderSysOptions();
  document.getElementById('newDocModal').classList.add('open');
  setTimeout(() => document.getElementById('newDocTitle').focus(), 160);
}

function renderSysOptions() {
  const grid = document.getElementById('sysOptionGrid');
  if (systems.length === 0) {
    grid.innerHTML = `<div style="font-size:13px;color:var(--ink3);padding:8px 0;">Nenhum sistema cadastrado. <button onclick="closeNewDocModal(); openNewSysModal()" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:13px;text-decoration:underline;">Adicionar sistema</button></div>`;
    return;
  }
  grid.innerHTML = systems.map(s => `
    <div class="sys-option ${s.id === newDocSelectedSystem ? 'selected' : ''}" onclick="selectSysOption('${s.id}', this)">
      <div class="sys-option-icon">${s.icone}</div>
      <div class="sys-option-text">
        <div class="sys-option-name">${escHtml(s.nome)}</div>
        <div class="sys-option-full">${escHtml(s.nome_completo)}</div>
      </div>
      <div class="sys-option-check"></div>
    </div>`).join('');
}

function selectSysOption(id, el) {
  newDocSelectedSystem = id;
  document.querySelectorAll('.sys-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('newDocSysError').classList.remove('show');
}

function closeNewDocModal() { document.getElementById('newDocModal').classList.remove('open'); }

function confirmNewDoc() {
  if (!newDocSelectedSystem) { document.getElementById('newDocSysError').classList.add('show'); return; }
  const title = document.getElementById('newDocTitle').value.trim();
  closeNewDocModal();
  editingId = null; currentId = null;
  resetHtmlMode();
  showPanel('editor');
  populateSysSelect(newDocSelectedSystem);
  document.getElementById('editorTitleInput').value  = title;
  document.getElementById('editorContent').innerHTML = '';
  updateWordCount();
  renderList();
  setTimeout(() => { title ? document.getElementById('editorContent').focus() : document.getElementById('editorTitleInput').focus(); }, 50);
}

// ══════════════════════════════════════════
// NEW SYSTEM MODAL
// ══════════════════════════════════════════
function openNewSysModal() {
  newSysSelectedEmoji = '📦';
  document.getElementById('newSysId').value = '';
  document.getElementById('newSysFullName').value = '';
  document.getElementById('newSysIdError').classList.remove('show');
  document.getElementById('newSysNameError').classList.remove('show');
  updateSysPreview();
  document.getElementById('emojiGrid').innerHTML = EMOJI_OPTIONS.map(e =>
    `<button class="emoji-btn ${e === newSysSelectedEmoji ? 'selected' : ''}" onclick="selectEmoji('${e}', this)">${e}</button>`
  ).join('');
  document.getElementById('newSysModal').classList.add('open');
  setTimeout(() => document.getElementById('newSysId').focus(), 160);
}

function closeNewSysModal() { document.getElementById('newSysModal').classList.remove('open'); }

function selectEmoji(emoji, el) {
  newSysSelectedEmoji = emoji;
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  updateSysPreview();
}

function updateSysPreview() {
  const id   = (document.getElementById('newSysId').value || 'SIGLA').toUpperCase().trim();
  const full = document.getElementById('newSysFullName').value || 'Nome completo do sistema';
  document.getElementById('previewIcon').textContent = newSysSelectedEmoji;
  document.getElementById('previewName').textContent = id;
  document.getElementById('previewFull').textContent = full;
}

async function confirmNewSys() {
  const id   = document.getElementById('newSysId').value.trim().toUpperCase().replace(/\s+/g,'');
  const full = document.getElementById('newSysFullName').value.trim();
  let valid  = true;

  if (!id) { document.getElementById('newSysIdError').textContent = 'Informe a sigla do sistema.'; document.getElementById('newSysIdError').classList.add('show'); valid = false; }
  else if (systems.find(s => s.id === id)) { document.getElementById('newSysIdError').textContent = 'Já existe um sistema com essa sigla.'; document.getElementById('newSysIdError').classList.add('show'); valid = false; }
  else { document.getElementById('newSysIdError').classList.remove('show'); }

  if (!full) { document.getElementById('newSysNameError').textContent = 'Informe o nome completo.'; document.getElementById('newSysNameError').classList.add('show'); valid = false; }
  else { document.getElementById('newSysNameError').classList.remove('show'); }

  if (!valid) return;

  const btn = document.getElementById('btnSaveSys');
  btn.disabled = true; btn.innerHTML = '…';

  try {
    const rows = await sbFetch('sistemas', {
      method: 'POST',
      body: JSON.stringify({ id, nome: id, nome_completo: full, icone: newSysSelectedEmoji, status: 'Ativo', ordem: systems.length })
    });
    const novo = Array.isArray(rows) ? rows[0] : rows;
    systems.push(novo);
    closeNewSysModal();
    renderSystemTabs();
    renderList();
    updateEmptyState();
    showToast('✅', `Sistema ${id} adicionado!`);
  } catch (e) {
    showToast('❌', 'Erro ao salvar sistema: ' + e.message, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar sistema`;
  }
}

// ══════════════════════════════════════════
// DELETE SYSTEM
// ══════════════════════════════════════════
function openDeleteSysModal(id) {
  sysToDelete = id;
  const sys = getSys(id);
  document.getElementById('deleteSysName').textContent = sys ? sys.nome : id;
  document.getElementById('deleteSysModal').classList.add('open');
}
function closeDeleteSysModal() { document.getElementById('deleteSysModal').classList.remove('open'); sysToDelete = null; }

async function confirmDeleteSys() {
  if (!sysToDelete) return;
  const btn = document.getElementById('btnConfirmDeleteSys');
  btn.disabled = true; btn.textContent = 'Removendo…';
  try {
    await sbFetch('sistemas?id=eq.' + sysToDelete, { method: 'DELETE' });
    systems = systems.filter(s => s.id !== sysToDelete);
    // manuais com esse system ficam com system=null no banco (on delete set null)
    docs.forEach(d => { if (d.system === sysToDelete) d.system = null; });
    if (filterSystem === sysToDelete) filterSystem = 'all';
    closeDeleteSysModal();
    renderSystemTabs();
    renderList();
    updateEmptyState();
    showToast('🗑️', 'Sistema removido.');
  } catch (e) {
    showToast('❌', 'Erro ao remover sistema: ' + e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'Remover';
  }
}

// ══════════════════════════════════════════
// EDIT
// ══════════════════════════════════════════
function editCurrent() {
  const doc = docs.find(d => d.id === currentId);
  if (!doc) return;
  editingId = doc.id;
  resetHtmlMode();
  showPanel('editor');
  populateSysSelect(doc.system);
  document.getElementById('editorTitleInput').value  = doc.title || '';
  document.getElementById('editorContent').innerHTML = doc.content || '';
  updateWordCount();
}
function cancelEdit() { currentId ? openDoc(currentId) : showPanel('empty'); editingId = null; }

// ══════════════════════════════════════════
// SAVE MANUAL
// ══════════════════════════════════════════
async function saveDoc() {
  const title   = document.getElementById('editorTitleInput').value.trim() || 'Sem título';
  const system  = document.getElementById('editorSysSelect').value || null;
  // Se estiver em modo HTML, usa o valor da textarea; caso contrário, usa o innerHTML
  const content = htmlModeActive
    ? document.getElementById('editorHtml').value
    : document.getElementById('editorContent').innerHTML;
  const btn     = document.getElementById('btnSave');
  btn.disabled  = true; btn.innerHTML = '…'; setSaved('loading');

  try {
    if (editingId) {
      const rows = await sbFetch('manuais?id=eq.' + editingId, { method:'PATCH', body: JSON.stringify({system, title, content}) });
      const updated = Array.isArray(rows) ? rows[0] : rows;
      const idx = docs.findIndex(d => d.id === editingId);
      if (idx !== -1) docs[idx] = updated;
      currentId = editingId;
    } else {
      const rows = await sbFetch('manuais', { method:'POST', body: JSON.stringify({system, title, content}) });
      const inserted = Array.isArray(rows) ? rows[0] : rows;
      docs.unshift(inserted);
      currentId = inserted.id;
    }
    editingId = null;
    openDoc(currentId);
    showToast('✅', 'Manual salvo!');
    setSaved('ok');
  } catch (e) {
    showToast('❌', 'Erro ao salvar: ' + e.message, true);
    setSaved('err');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Salvar`;
  }
}

// ══════════════════════════════════════════
// DELETE MANUAL
// ══════════════════════════════════════════
function confirmDelete() {
  const doc = docs.find(d => d.id === currentId);
  if (!doc) return;
  document.getElementById('deleteDocName').textContent = doc.title || 'Sem título';
  document.getElementById('deleteModal').classList.add('open');
}
function closeDeleteModal() { document.getElementById('deleteModal').classList.remove('open'); }

async function deleteDoc() {
  const btn = document.getElementById('btnConfirmDelete');
  btn.disabled = true; btn.textContent = 'Excluindo…';
  try {
    await sbFetch('manuais?id=eq.' + currentId, { method:'DELETE' });
    docs = docs.filter(d => d.id !== currentId);
    closeDeleteModal(); currentId = null;
    showPanel('empty'); renderList(); updateEmptyState();
    showToast('🗑️', 'Manual excluído.');
  } catch (e) {
    showToast('❌', 'Erro ao excluir: ' + e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'Excluir';
  }
}

// ══════════════════════════════════════════
// PANELS / FILTER / EDITOR
// ══════════════════════════════════════════
function showPanel(name) {
  document.getElementById('emptyState').style.display  = name === 'empty'  ? 'flex' : 'none';
  document.getElementById('viewerPanel').style.display = name === 'viewer' ? 'flex' : 'none';
  document.getElementById('editorPanel').style.display = name === 'editor' ? 'flex' : 'none';
}

function goHome() {
  currentId = null;
  editingId = null;
  filterSystem = 'all';
  searchQ = '';
  document.getElementById('searchInput').value = '';
  document.querySelectorAll('.sys-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tabAll').classList.add('active');
  showPanel('empty');
  updateEmptyState();
  renderList();
}

function setSystem(sys, btn) {
  filterSystem = sys;
  document.querySelectorAll('.sys-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderList();
}
function filterDocs(q) { searchQ = q; renderList(); }

function exec(cmd) { document.getElementById('editorContent').focus(); document.execCommand(cmd, false, null); }
function formatBlock(tag) { if (!tag) return; document.getElementById('editorContent').focus(); document.execCommand('formatBlock', false, tag); }
function insertHR() { document.getElementById('editorContent').focus(); document.execCommand('insertHTML', false, '<hr>'); }

// ══════════════════════════════════════════
// HTML MODE TOGGLE
// ══════════════════════════════════════════
let htmlModeActive = false;

function resetHtmlMode() {
  if (!htmlModeActive) return;
  htmlModeActive = false;
  const editorContent = document.getElementById('editorContent');
  const editorHtml    = document.getElementById('editorHtml');
  const btn           = document.getElementById('btnToggleHtml');
  const toolbar       = document.querySelector('.editor-toolbar');
  // Aplica conteúdo da textarea antes de fechar
  editorContent.innerHTML = editorHtml.value;
  editorContent.style.display = 'block';
  editorHtml.style.display    = 'none';
  btn.classList.remove('active');
  toolbar.querySelectorAll('.toolbar-btn:not(#btnToggleHtml), .toolbar-select, .toolbar-sep').forEach(el => {
    el.style.opacity = '';
    el.style.pointerEvents = '';
  });
}

function toggleHtmlMode() {
  htmlModeActive = !htmlModeActive;
  const editorContent = document.getElementById('editorContent');
  const editorHtml    = document.getElementById('editorHtml');
  const btn           = document.getElementById('btnToggleHtml');
  const toolbar       = document.querySelector('.editor-toolbar');

  if (htmlModeActive) {
    // Copia o HTML atual para a textarea
    editorHtml.value = formatHtml(editorContent.innerHTML);
    editorContent.style.display = 'none';
    editorHtml.style.display    = 'block';
    btn.classList.add('active');
    // Desabilita botões da toolbar que não fazem sentido no modo HTML
    toolbar.querySelectorAll('.toolbar-btn:not(#btnToggleHtml), .toolbar-select, .toolbar-sep').forEach(el => {
      el.style.opacity = '0.3';
      el.style.pointerEvents = 'none';
    });
    editorHtml.focus();
  } else {
    // Aplica o HTML editado de volta ao contenteditable
    editorContent.innerHTML = editorHtml.value;
    editorContent.style.display = 'block';
    editorHtml.style.display    = 'none';
    btn.classList.remove('active');
    toolbar.querySelectorAll('.toolbar-btn:not(#btnToggleHtml), .toolbar-select, .toolbar-sep').forEach(el => {
      el.style.opacity = '';
      el.style.pointerEvents = '';
    });
    updateWordCount();
    setSaved('editing');
  }
}

function onHtmlInput() {
  // Sincroniza contagem enquanto edita o HTML
  const text = stripHtml(document.getElementById('editorHtml').value);
  const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  document.getElementById('wordCount').textContent = words + ' palavra' + (words !== 1 ? 's' : '');
  document.getElementById('charCount').textContent = text.length + ' caractere' + (text.length !== 1 ? 's' : '');
  setSaved('editing');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => setSaved('unsaved'), 2500);
}

function formatHtml(html) {
  // Indentação simples do HTML para facilitar leitura
  let formatted = '';
  let indent = 0;
  const tags = html.match(/(<[^>]+>|[^<]+)/g) || [];
  const inlineTags = /^<(span|a|b|i|u|strong|em|code|br|img|svg|path|polyline|line|circle|rect)[^>]*>/i;
  const voidTags   = /^<(br|hr|img|input|meta|link)[^>]*\/?>/i;
  const closingTag = /^<\//;
  tags.forEach(tok => {
    const trimmed = tok.trim();
    if (!trimmed) return;
    if (closingTag.test(trimmed) && !inlineTags.test(trimmed)) {
      indent = Math.max(0, indent - 1);
      formatted += '  '.repeat(indent) + trimmed + '\n';
    } else if (/<[^/][^>]*>/.test(trimmed) && !inlineTags.test(trimmed) && !voidTags.test(trimmed)) {
      formatted += '  '.repeat(indent) + trimmed + '\n';
      indent++;
    } else {
      formatted += '  '.repeat(indent) + trimmed + '\n';
    }
  });
  return formatted.trim();
}

function setSaved(state) {
  const map = { ok:{dot:'#22C55E',text:'Salvo'}, loading:{dot:'#F59E0B',text:'Salvando…'}, editing:{dot:'#F59E0B',text:'Editando…'}, err:{dot:'#EF4444',text:'Erro'}, unsaved:{dot:'#EF4444',text:'Não salvo'} };
  const s = map[state] || map.ok;
  document.getElementById('statusSaved').innerHTML = `<div class="status-dot" style="background:${s.dot}"></div><span>${s.text}</span>`;
}
function onEditorInput() {
  updateWordCount(); setSaved('editing');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => setSaved('unsaved'), 2500);
}
function onEditorKeydown(e) { if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveDoc(); } }
function updateWordCount() {
  const text = stripHtml(document.getElementById('editorContent').innerHTML);
  const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  document.getElementById('wordCount').textContent = words + ' palavra' + (words !== 1 ? 's' : '');
  document.getElementById('charCount').textContent = text.length + ' caractere' + (text.length !== 1 ? 's' : '');
}

// ══════════════════════════════════════════
// EXPORT PDF
// ══════════════════════════════════════════
function exportPDF() {
  const doc = docs.find(d => d.id === currentId);
  if (!doc) return;
  const sys = getSys(doc.system);

  // Preenche preview do modal
  document.getElementById('pdfThumbTitle').textContent = doc.title || 'Sem título';
  document.getElementById('pdfThumbBadge').textContent = sys ? sys.icone + ' ' + sys.nome : '';
  document.getElementById('pdfInfoTitle').textContent  = doc.title || 'Sem título';
  document.getElementById('pdfInfoMeta').textContent   =
    (sys ? sys.nome_completo + ' · ' : '') +
    fmtDate(doc.updated_at) + ' · ' + wc(doc.content) + ' palavras';

  document.getElementById('pdfModal').classList.add('open');
}

function closePdfModal() {
  document.getElementById('pdfModal').classList.remove('open');
}

function confirmExportPDF() {
  const doc = docs.find(d => d.id === currentId);
  if (!doc) return;
  const sys = getSys(doc.system);

  const showHeader = document.getElementById('pdfOptHeader').checked;
  const showMeta   = document.getElementById('pdfOptMeta').checked;
  const showFooter = document.getElementById('pdfOptFooter').checked;
  const showDate   = document.getElementById('pdfOptDate').checked;

  const now = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  const headerHtml = showHeader ? `
    <div class="pdf-header">
      <div class="pdf-header-logo">
        <div class="pdf-logo-mark">MG</div>
        <span class="pdf-logo-name">ManuaisGov</span>
      </div>
      ${sys ? `<span class="pdf-header-sys">${sys.icone} ${escHtml(sys.nome)}</span>` : ''}
    </div>` : '';

  const metaHtml = showMeta ? `
    <div class="pdf-doc-byline">
      ${sys ? `<span class="pdf-badge">${escHtml(sys.nome)}</span><span>${escHtml(sys.nome_completo || '')}</span><span>·</span>` : ''}
      <span>Criado em ${fmtDate(doc.created_at)}</span>
      <span>·</span>
      <span>Atualizado em ${fmtDate(doc.updated_at)}</span>
      <span>·</span>
      <span>${wc(doc.content)} palavras</span>
      ${showDate ? `<span>·</span><span>Gerado em ${now}</span>` : ''}
    </div>` : (showDate ? `<div class="pdf-doc-byline"><span>Gerado em ${now}</span></div>` : '');

  const footerHtml = showFooter ? `
    <div class="pdf-footer">
      <span>ManuaisGov · ${sys ? escHtml(sys.nome) + ' · ' : ''}${escHtml(doc.title || 'Sem título')}</span>
      <span class="pdf-page-num">Página <span class="pagenum"></span></span>
    </div>` : '';

  const printHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${escHtml(doc.title || 'Manual')}</title>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { font-family: 'Geist', sans-serif; color: #1A1814; background: #fff; font-size: 11pt; line-height: 1.7; }

    @page {
      size: A4;
      margin: 18mm 20mm 22mm 20mm;
      ${showFooter ? `
      @bottom-center {
        content: "ManuaisGov";
        font-size: 8pt;
        color: #8A8680;
      }` : ''}
    }

    .pdf-header {
      display: flex; align-items: center; justify-content: space-between;
      padding-bottom: 10pt; border-bottom: 1.5pt solid #C8602A;
      margin-bottom: 18pt;
    }
    .pdf-header-logo { display: flex; align-items: center; gap: 8pt; }
    .pdf-logo-mark {
      width: 22pt; height: 22pt; background: #C8602A; border-radius: 5pt;
      display: flex; align-items: center; justify-content: center;
      font-size: 9pt; font-weight: 700; color: #fff;
    }
    .pdf-logo-name { font-family: 'Instrument Serif', serif; font-size: 14pt; color: #1A1814; }
    .pdf-header-sys {
      font-size: 8.5pt; font-weight: 600; background: rgba(200,96,42,0.12);
      color: #C8602A; padding: 3pt 8pt; border-radius: 4pt; letter-spacing: 0.04em;
    }

    .pdf-doc-title {
      font-family: 'Instrument Serif', serif; font-size: 26pt; font-weight: 400;
      color: #1A1814; line-height: 1.15; margin-bottom: 8pt;
    }
    .pdf-doc-byline {
      font-size: 8.5pt; color: #8A8680; margin-bottom: 18pt;
      padding-bottom: 14pt; border-bottom: 0.75pt solid rgba(26,24,20,0.1);
      display: flex; align-items: center; gap: 8pt; flex-wrap: wrap;
    }
    .pdf-badge {
      background: rgba(200,96,42,0.12); color: #C8602A;
      font-size: 7.5pt; font-weight: 700; letter-spacing: 0.06em;
      text-transform: uppercase; padding: 1.5pt 5pt; border-radius: 3pt;
    }

    .pdf-body { font-size: 11pt; line-height: 1.8; color: #4A4640; font-weight: 300; }
    .pdf-body h1 { font-family: 'Instrument Serif', serif; font-size: 20pt; font-weight: 400; color: #1A1814; margin: 18pt 0 8pt; line-height: 1.2; page-break-after: avoid; }
    .pdf-body h2 { font-family: 'Instrument Serif', serif; font-size: 15pt; font-weight: 400; color: #1A1814; margin: 14pt 0 6pt; page-break-after: avoid; }
    .pdf-body h3 { font-size: 12pt; font-weight: 600; color: #1A1814; margin: 12pt 0 5pt; page-break-after: avoid; }
    .pdf-body p { margin: 0 0 9pt; }
    .pdf-body ul, .pdf-body ol { padding-left: 18pt; margin: 6pt 0 10pt; }
    .pdf-body li { margin-bottom: 3pt; }
    .pdf-body blockquote {
      border-left: 3pt solid #C8602A; padding: 6pt 12pt;
      margin: 12pt 0; color: #8A8680; font-style: italic;
      background: rgba(200,96,42,0.06); border-radius: 0 4pt 4pt 0;
    }
    .pdf-body code {
      background: #E4E0D7; padding: 1pt 4pt; border-radius: 3pt;
      font-family: monospace; font-size: 9.5pt; color: #1A1814;
    }
    .pdf-body pre {
      background: #1A1814; color: #F5F2ED; padding: 10pt; border-radius: 5pt;
      font-family: monospace; font-size: 9pt; overflow: hidden;
      margin: 10pt 0; white-space: pre-wrap; page-break-inside: avoid;
    }
    .pdf-body hr { border: none; border-top: 0.75pt solid rgba(26,24,20,0.1); margin: 16pt 0; }
    .pdf-body strong { font-weight: 600; color: #1A1814; }
    .pdf-body em { font-style: italic; }
    .pdf-body a { color: #C8602A; text-decoration: underline; }
    .pdf-body table { width: 100%; border-collapse: collapse; margin: 12pt 0; font-size: 10pt; }
    .pdf-body th { background: #EDEAE3; font-weight: 600; padding: 6pt 10pt; border: 0.75pt solid rgba(26,24,20,0.15); text-align: left; }
    .pdf-body td { padding: 5pt 10pt; border: 0.75pt solid rgba(26,24,20,0.1); }
    .pdf-body tr:nth-child(even) td { background: rgba(26,24,20,0.02); }

    .pdf-footer {
      position: fixed; bottom: 0; left: 0; right: 0;
      display: flex; justify-content: space-between; align-items: center;
      padding: 6pt 20mm; border-top: 0.75pt solid rgba(26,24,20,0.12);
      font-size: 7.5pt; color: #8A8680; background: #fff;
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .pdf-footer { position: running(footer); }
    }
  </style>
</head>
<body>
  ${headerHtml}
  <div class="pdf-doc-title">${escHtml(doc.title || 'Sem título')}</div>
  ${metaHtml}
  <div class="pdf-body">${doc.content || ''}</div>
  ${footerHtml}
  <script>
    window.onload = function() {
      window.print();
      window.onafterprint = function() { window.close(); };
    };
  <\/script>
</body>
</html>`;

  closePdfModal();
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    showToast('❌', 'Permita pop-ups para gerar o PDF.', true);
    return;
  }
  win.document.open();
  win.document.write(printHtml);
  win.document.close();
  showToast('📄', 'PDF gerado! Escolha "Salvar como PDF" na impressão.');
}

// ══════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════
let toastTimer;
function showToast(icon, msg, isError = false) {
  const t = document.getElementById('toast');
  document.getElementById('toastIcon').textContent = icon;
  document.getElementById('toastMsg').textContent  = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  void t.offsetWidth; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), isError ? 4000 : 2800);
}

// ══════════════════════════════════════════
// KEYBOARD
// ══════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeDeleteModal(); closeNewDocModal(); closeNewSysModal(); closeDeleteSysModal(); closePdfModal(); }
});

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════
dbLoad();
