// ═══════════════════════════════════════════════════
//  FOLDER SYSTEM — folders.js
//  Folder bar/dock, folder picker, context menu,
//  trash panel, task panel, sidebar tabs, search clear
// ═══════════════════════════════════════════════════
import { memos, folders, trashMemos, setFolders, currentFolderFilter, setCurrentFolderFilter, ctxMemoId, setCtxMemoId, appSettings, currentMemoId } from './state.js';
import { escapeHtml, safeId, FOLDER_COLORS, getFolderColor, UNFILED_FILTER } from './utils.js';
import { saveData } from './storage.js';

// ── SVGフォルダアイコン（色指定可能） ──
function folderSVG(color, count) {
  return `<div class="fp-folder-icon">
    <svg viewBox="0 0 56 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- 奥の板 -->
      <rect x="2" y="12" width="52" height="32" rx="4" fill="${color}99"/>
      <!-- タブ -->
      <path d="M2 12 Q2 6 8 6 L22 6 Q26 6 28 10 L28 12 Z" fill="${color}"/>
      <!-- 表面 -->
      <rect x="2" y="12" width="52" height="32" rx="4" fill="${color}" fill-opacity=".85"/>
      <!-- 光沢 -->
      <rect x="4" y="14" width="50" height="6" rx="2" fill="white" fill-opacity=".12"/>
    </svg>
    ${count > 0 ? `<span class="fp-folder-count">${count}</span>` : ''}
  </div>`;
}

// ── renderFolderBar（フォルダペイン描画） ──
function renderFolderBar() {
  renderFolderDock();
  // 旧folder-barは非表示
  const bar = document.getElementById('folder-bar');
  if (bar) bar.style.display = 'none';
}

// ── setFolderFilter ──
function setFolderFilter(id) {
  // 編集中のメモを保存（空なら破棄）してから切り替える
  window.leaveCurrentMemo();
  closeSideOverlay('task');
  closeSideOverlay('trash');
  window.clearSearch();       // フォルダを移ったら検索は解除
  setCurrentFolderFilter(id);
  window.renderMemoList();
  // デスクトップは一覧の先頭メモを開く。モバイルは一覧を見せる
  window.selectFirstMemoInView();
  window.mobileShowView('list');
}

// ── サイドバー（フォルダペイン）の開閉 ──
const NF_COLLAPSED_KEY = 'hannah_nf_collapsed';

function setFolderPaneCollapsed(collapsed) {
  document.getElementById('main-app')?.classList.toggle('nf-collapsed', collapsed);
  try { localStorage.setItem(NF_COLLAPSED_KEY, collapsed ? '1' : '0'); } catch (e) {}
}

function toggleFolderPane() {
  const app = document.getElementById('main-app');
  setFolderPaneCollapsed(!app.classList.contains('nf-collapsed'));
}

function restoreFolderPane() {
  try {
    if (localStorage.getItem(NF_COLLAPSED_KEY) === '1') setFolderPaneCollapsed(true);
  } catch (e) {}
}

// ── promptNewFolder（一覧内の入力欄でその場で命名） ──
// Enter／入力欄を離れる＝作成、Esc＝取り消し。日本語入力の変換中の Enter は無視する
function promptNewFolder() {
  setFolderPaneCollapsed(false);
  const existing = document.getElementById('nf-new-input');
  if (existing) { existing.focus(); return; }
  const list = document.getElementById('folder-dock-list');
  if (!list) return;

  const row = document.createElement('div');
  row.className = 'nf-row nf-row-new';
  row.innerHTML = NF_ICON_FOLDER + '<input id="nf-new-input" class="nf-new-input" type="text" maxlength="100" placeholder="フォルダ名" autocomplete="off">';
  list.appendChild(row);
  row.scrollIntoView({ block: 'nearest' });
  const input = row.querySelector('input');
  input.focus();

  let finished = false;
  const finish = (commit) => {
    if (finished) return;
    finished = true;
    const name = input.value.trim();
    row.remove();
    if (commit && name) {
      folders.push({ id: 'f' + Date.now().toString(36), name });
      saveData();
      renderFolderBar();
    }
  };
  input.addEventListener('keydown', e => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
}

// ── renameFolderPrompt（その行の名前をその場で書き換える） ──
// Enter／入力欄を離れる＝確定、Esc＝取り消し。日本語入力の変換中の Enter は無視する
function renameFolderPrompt(fid) {
  const f = folders.find(x => x.id === fid);
  if (!f) return;
  setFolderPaneCollapsed(false);
  const wrap = document.querySelector(`#folder-dock-list .nf-row-wrap[data-fid="${fid}"]`);
  if (!wrap || wrap.querySelector('.nf-rename-input')) return;
  const orig = wrap.querySelector('.nf-row');
  const more = wrap.querySelector('.nf-more');

  const row = document.createElement('div');
  row.className = 'nf-row nf-row-new';
  row.innerHTML = NF_ICON_FOLDER + '<input class="nf-new-input nf-rename-input" type="text" maxlength="100" autocomplete="off">';
  const input = row.querySelector('input');
  input.value = f.name;
  orig.style.display = 'none';
  if (more) more.style.display = 'none';
  wrap.insertBefore(row, orig);
  input.focus();
  input.select();

  let finished = false;
  const finish = (commit) => {
    if (finished) return;
    finished = true;
    const name = input.value.trim();
    row.remove();
    orig.style.display = '';
    if (more) more.style.display = '';
    if (commit && name && name !== f.name) {
      f.name = name;
      saveData();
      window.renderMemoList();
    }
  };
  input.addEventListener('keydown', e => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
}

// ── deleteFolder ──
function deleteFolder(fid) {
  // 確認は出さない（フォルダ内のメモは消えず、フォルダなしに戻るだけ）
  memos.forEach(m => { if (m.folderId === fid) delete m.folderId; });
  setFolders(folders.filter(f => f.id !== fid));
  if (currentFolderFilter === fid) setCurrentFolderFilter('all');
  saveData(); window.renderMemoList();
}

// ── assignMemoToFolder ──
function assignMemoToFolder(memoId, folderId) {
  const m = memos.find(x => x.id === memoId);
  if (!m) return;
  if (folderId === '__none__') delete m.folderId;
  else m.folderId = folderId;
  saveData(); window.renderMemoList();
}

// ── switchSidebarTab（パネルoverlay版） ──
function switchSidebarTab(tab) {
  if (tab === 'task') openTaskPanel();
  else if (tab === 'trash') openTrashPanel();
  else {
    closeSideOverlay('task');
    closeSideOverlay('trash');
  }
}

// ═══════════════════════════════════════════════════
//  LONG-PRESS CONTEXT MENU
// ═══════════════════════════════════════════════════

// showCtxMenu は showFolderPicker に統合 (後方互換用スタブ)
function showCtxMenu(memoId) { showFolderPicker(memoId); }
function toggleCtxSub(id) {}
function closeCtxMenu() {
  document.getElementById('ctx-overlay')?.remove();
  document.getElementById('ctx-menu')?.remove();
  document.getElementById('ctx-confirm')?.remove();
  closeFolderPicker();
}
function promptNewFolderAndAssign(memoId) {
  const name = prompt('新しいフォルダ名：');
  if (!name || !name.trim()) return;
  const f = { id: 'f' + Date.now().toString(36), name: name.trim() };
  folders.push(f);
  assignMemoToFolder(memoId, f.id);
  closeFolderPicker();
}

// 削除確認ダイアログ（右下に表示）
function showDeleteConfirm(memoId) {
  document.getElementById('ctx-confirm')?.remove();
  const memo = memos.find(m => m.id === memoId);
  const title = memo ? memo.title : 'このメモ';
  const conf = document.createElement('div');
  conf.className = 'ctx-confirm';
  conf.id = 'ctx-confirm';
  conf.innerHTML = `
    <div class="ctx-confirm-text">🗑 「${escapeHtml(title)}」<br>をゴミ箱へ移動しますか？</div>
    <div class="ctx-confirm-btns">
      <button class="btn" onclick="document.getElementById('ctx-confirm').remove(); closeCtxMenu()">キャンセル</button>
      <button class="btn danger" onclick="moveToTrash('${memoId}'); closeCtxMenu()">削除する</button>
    </div>
  `;
  document.body.appendChild(conf);
}

// ═══════════════════════════════════════════════════
//  FOLDER PICKER (画面中央フォルダアイコン表示)
// ═══════════════════════════════════════════════════

function showFolderPicker(memoId) {
  closeFolderPicker();
  const memo = memos.find(m => m.id === memoId);
  if (!memo) return;

  const overlay = document.createElement('div');
  overlay.className = 'folder-picker-overlay';
  overlay.id = 'folder-picker-overlay';

  // フォルダグリッドHTML生成
  let gridHtml = '';

  // 「フォルダなし」
  const noColor = memo.folderId ? '#888' : 'var(--accent)';
  gridHtml += `<div class="fp-folder fp-special" onclick="assignMemoToFolder('${memoId}','__none__'); closeFolderPicker(); window.renderMemoList();">
    ${folderSVG('#888', 0)}
    <span class="fp-folder-name">${memo.folderId ? 'フォルダなし' : '✓ なし'}</span>
  </div>`;

  // 既存フォルダ
  folders.forEach((f, i) => {
    const cnt = memos.filter(m => m.folderId === f.id).length;
    const active = memo.folderId === f.id;
    const col = getFolderColor(i);
    gridHtml += `<div class="fp-folder${active?' fp-special':''}" id="fp-${f.id}"
        onclick="assignMemoToFolder('${memoId}','${f.id}'); closeFolderPicker(); window.renderMemoList();"
        data-folder-id="${f.id}">
      ${folderSVG(col, cnt)}
      <span class="fp-folder-name">${active?'✓ ':''}${escapeHtml(f.name)}</span>
    </div>`;
  });

  // 「新規フォルダ作成」
  gridHtml += `<div class="fp-folder fp-add" onclick="fpCreateNew('${memoId}')">
    <div class="fp-folder-icon" style="border:2px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;width:56px;height:48px;">
      <span style="font-size:24px;color:var(--text-muted);">＋</span>
    </div>
    <span class="fp-folder-name">新規作成</span>
  </div>`;

  // 「ゴミ箱へ」
  gridHtml += `<div class="fp-folder fp-special" onclick="closeFolderPicker(); showDeleteConfirm('${memoId}')">
    <div class="fp-folder-icon" style="display:flex;align-items:center;justify-content:center;width:56px;height:48px;">
      <span style="font-size:36px;">🗑</span>
    </div>
    <span class="fp-folder-name" style="color:#ff6b6b88;">ゴミ箱</span>
  </div>`;

  overlay.innerHTML = `
    <div class="folder-picker-memo-label">📝 ${escapeHtml(memo.title)}</div>
    <div class="folder-picker-title">▼  移動先フォルダを選択  ▼</div>
    <div class="folder-picker-grid" id="fp-grid">
      ${gridHtml}
    </div>
    <button class="folder-picker-cancel" onclick="closeFolderPicker()">✕ キャンセル</button>
  `;

  document.body.appendChild(overlay);

  // オーバーレイ自体（グリッド外）クリックでキャンセル
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeFolderPicker();
  });
}

function closeFolderPicker() {
  document.getElementById('folder-picker-overlay')?.remove();
  document.getElementById('drag-ghost')?.remove();
  const dragging = document.querySelector('.memo-card.dragging');
  if (dragging) dragging.classList.remove('dragging');
}

function fpCreateNew(memoId) {
  const name = prompt('新しいフォルダ名：');
  if (!name || !name.trim()) return;
  const f = { id: 'f' + Date.now().toString(36), name: name.trim() };
  folders.push(f);
  saveData();
  assignMemoToFolder(memoId, f.id);
  closeFolderPicker();
  window.renderMemoList();
}

// ═══════════════════════════════════════════════════════
//  FOLDER DOCK
// ═══════════════════════════════════════════════════════

// ── フォルダペイン描画 ──
const NF_ICON_ALL = '<svg class="nf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="7" y1="13" x2="17" y2="13"/></svg>';
const NF_ICON_FOLDER = '<svg class="nf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';

function renderFolderDock() {
  const list = document.getElementById('folder-dock-list');
  if (!list) return;

  const unfiledCount = memos.filter(m => !m.folderId || !folders.some(f => f.id === m.folderId)).length;
  const row = (filter, icon, name, count) => `<button class="nf-row ${currentFolderFilter === filter ? 'active' : ''}" onclick="setFolderFilter('${filter}')">
      ${icon}<span class="nf-name">${name}</span><span class="nf-count">${count}</span>
    </button>`;

  let html = row('all', NF_ICON_ALL, 'すべてのメモ', memos.length);
  html += row(UNFILED_FILTER, NF_ICON_FOLDER, 'メモ', unfiledCount);
  folders.forEach(f => {
    const fid = safeId(f.id);
    const cnt = memos.filter(m => m.folderId === f.id).length;
    html += `<div class="nf-row-wrap" data-fid="${fid}">
      <button class="nf-row ${currentFolderFilter === f.id ? 'active' : ''}"
          onclick="setFolderFilter('${fid}')"
          oncontextmenu="dockFolderMenu(event,'${fid}'); return false;">
        ${NF_ICON_FOLDER}<span class="nf-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span><span class="nf-count">${cnt}</span>
      </button>
      <button class="nf-more" onclick="event.stopPropagation(); dockFolderMenu(event,'${fid}')" title="名称変更・削除" aria-label="フォルダの操作">⋯</button>
    </div>`;
  });
  list.innerHTML = html;

  const trashCount = document.getElementById('trash-count');
  if (trashCount) trashCount.textContent = trashMemos.length || '';

  // Keep folder export dropdown in settings in sync
  if (window.rebuildFolderExportSelect) window.rebuildFolderExportSelect();
}

function dockFolderMenu(e, fid) {
  e.preventDefault();
  const f = folders.find(x => x.id === fid);
  if (!f) return;
  // コンテキストメニューをポップアップ表示
  showFolderDockMenu(e.clientX, e.clientY, fid, f.name);
}

function showFolderDockMenu(x, y, fid, fname) {
  document.getElementById('fdm-popup')?.remove();
  const menu = document.createElement('div');
  menu.id = 'fdm-popup';
  menu.className = 'fdm-popup';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  const ic = d => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  menu.innerHTML = `
    <button class="fdm-item" onclick="renameFolderPrompt('${fid}'); closeFDM()">
      ${ic('<path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>')}フォルダを名称変更
    </button>
    <button class="fdm-item fdm-danger" onclick="deleteFolder('${fid}'); closeFDM()">
      ${ic('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>')}フォルダを削除
    </button>
  `;
  document.body.appendChild(menu);
  const r = menu.getBoundingClientRect();   // 画面の端ではみ出さないよう寄せる
  menu.style.left = Math.max(8, Math.min(x, window.innerWidth - r.width - 8)) + 'px';
  menu.style.top = Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) + 'px';
  setTimeout(() => document.addEventListener('click', closeFDM, { once: true }), 10);
}

function closeFDM() { document.getElementById('fdm-popup')?.remove(); }

// ═══════════════════════════════════════════════════════
//  LAYOUT — Panel overlay / Search / createMemoInFolder
// ═══════════════════════════════════════════════════════

// ── フォルダ指定でメモ作成 ──
function createMemoInFolder(folderId) {
  const folder = folders.find(f => f.id === folderId);
  if (!folder) return;
  // フォルダを選択状態にしてからメモ作成
  setFolderFilter(folderId);
  window.createNewMemo();
  // 作成後、そのメモをフォルダに割り当て
  setTimeout(() => {
    if (currentMemoId) {
      const memo = memos.find(m => m.id === currentMemoId);
      if (memo) {
        memo.folderId = folderId;
        saveData();
        window.renderMemoList();
        renderFolderDock();
      }
    }
  }, 50);
}

// ── タスク・ゴミ箱パネル開閉 ──
function openTaskPanel() {
  const t = document.getElementById('panel-task');
  const tr = document.getElementById('panel-trash');
  const btn = document.getElementById('nav-task-btn');
  if (!t) return;
  const isOpen = t.style.display !== 'none';
  t.style.display = isOpen ? 'none' : 'flex';
  if (tr) tr.style.display = 'none';
  btn?.classList.toggle('active', !isOpen);
  document.getElementById('nav-trash-btn')?.classList.remove('active');
  if (!isOpen) window.renderTaskList();
}

function openTrashPanel() {
  const tr = document.getElementById('panel-trash');
  const t = document.getElementById('panel-task');
  const btn = document.getElementById('nav-trash-btn');
  if (!tr) return;
  const isOpen = tr.style.display !== 'none';
  tr.style.display = isOpen ? 'none' : 'flex';
  if (t) t.style.display = 'none';
  btn?.classList.toggle('active', !isOpen);
  document.getElementById('nav-task-btn')?.classList.remove('active');
  if (!isOpen) window.renderTrash();
}

function closeSideOverlay(type) {
  const el = document.getElementById(`panel-${type}`);
  if (el) el.style.display = 'none';
  document.getElementById(`nav-${type}-btn`)?.classList.remove('active');
}

// ═══════════════════════════════════════════════════
//  EXPORTS & WINDOW ASSIGNMENTS
// ═══════════════════════════════════════════════════
export {
  folderSVG,
  renderFolderBar,
  setFolderFilter,
  promptNewFolder,
  toggleFolderPane,
  restoreFolderPane,
  renameFolderPrompt,
  deleteFolder,
  assignMemoToFolder,
  switchSidebarTab,
  showCtxMenu,
  toggleCtxSub,
  closeCtxMenu,
  promptNewFolderAndAssign,
  showDeleteConfirm,
  showFolderPicker,
  closeFolderPicker,
  fpCreateNew,
  renderFolderDock,
  dockFolderMenu,
  showFolderDockMenu,
  closeFDM,
  createMemoInFolder,
  openTaskPanel,
  openTrashPanel,
  closeSideOverlay
};

window.folderSVG = folderSVG;
window.renderFolderBar = renderFolderBar;
window.setFolderFilter = setFolderFilter;
window.promptNewFolder = promptNewFolder;
window.toggleFolderPane = toggleFolderPane;
window.restoreFolderPane = restoreFolderPane;
window.renameFolderPrompt = renameFolderPrompt;
window.deleteFolder = deleteFolder;
window.assignMemoToFolder = assignMemoToFolder;
window.switchSidebarTab = switchSidebarTab;
window.showCtxMenu = showCtxMenu;
window.toggleCtxSub = toggleCtxSub;
window.closeCtxMenu = closeCtxMenu;
window.promptNewFolderAndAssign = promptNewFolderAndAssign;
window.showDeleteConfirm = showDeleteConfirm;
window.showFolderPicker = showFolderPicker;
window.closeFolderPicker = closeFolderPicker;
window.fpCreateNew = fpCreateNew;
window.renderFolderDock = renderFolderDock;
window.dockFolderMenu = dockFolderMenu;
window.showFolderDockMenu = showFolderDockMenu;
window.closeFDM = closeFDM;
window.createMemoInFolder = createMemoInFolder;
window.openTaskPanel = openTaskPanel;
window.openTrashPanel = openTrashPanel;
window.closeSideOverlay = closeSideOverlay;
