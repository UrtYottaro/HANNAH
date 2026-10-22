import {
  appSettings, setAppSettings, autoSaveTimer, setAutoSaveTimer,
  _currentSettingsTab, set_currentSettingsTab,
  typewriterActive, setTypewriterActive,
  typewriterPosition, setTypewriterPosition,
  currentMemoId, memos, isEditing, setIsEditing
} from './state.js';
import { saveData } from './storage.js';
import { persistCurrentMemo } from './memo-crud.js';
import { applyTheme, syncThemeUI, DEFAULT_THEME } from './theme.js';

// ===== SETTINGS =====

export function loadSettings() {
  try {
    const saved = localStorage.getItem('hannah_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migration: old default '800px' → new full-width default
      if (parsed.contentWidth === '800px' && !parsed._widthMigrated) {
        parsed.contentWidth = '100%';
        parsed._widthMigrated = true;
        localStorage.setItem('hannah_settings', JSON.stringify(parsed));
      }
      // Migration: 配色を「テーマ（アクセント・背景・前景）」方式へ。旧アクセント色・背景明度は破棄して既定テーマに戻す
      if (!parsed.theme) {
        parsed.theme = { ...DEFAULT_THEME };
        delete parsed.accent;
        delete parsed.bgBrightness;
        localStorage.setItem('hannah_settings', JSON.stringify(parsed));
      }
      setAppSettings({ ...appSettings, ...parsed });
    }
  } catch(e) {}
  applyAllSettings();
  syncSettingsUI();
}

export function saveSettings() {
  try { localStorage.setItem('hannah_settings', JSON.stringify(appSettings)); } catch(e) {}
}

export function openSettings(tab) {
  document.getElementById('settingsOverlay').classList.add('open');
  syncSettingsUI();
  switchSettingsTab(tab || _currentSettingsTab || 'appearance');
}
// 歯車ボタン：1回転させてから設定を開く
export function openSettingsWithSpin(btn) {
  const icon = btn && btn.querySelector('.gear-icon');
  if (icon) {
    icon.classList.remove('spin');
    void icon.getBoundingClientRect();           // 連続クリックでも、毎回はじめから回す
    icon.classList.add('spin');
    icon.addEventListener('animationend', () => icon.classList.remove('spin'), { once: true });
  }
  openSettings();
}
export function openSettingsTab(tab) {
  openSettings(tab);
}
export function switchSettingsTab(tab) {
  set_currentSettingsTab(tab);
  // タブボタンの active 切り替え
  document.querySelectorAll('.settings-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  // セクションの active 切り替え
  document.querySelectorAll('.settings-section').forEach(sec => {
    sec.classList.remove('active');
  });
  if (tab === 'fonts' && window.onFontsTabShown) window.onFontsTabShown();
  const target = document.getElementById('settings-section-' + tab);
  if (target) {
    target.classList.add('active');
    // 先頭にスクロール
    const body = target.closest('.settings-body');
    if (body) body.scrollTop = 0;
  }
}
export function activateSettingsTab(tab) { switchSettingsTab(tab); }
export function closeSettings() {
  document.getElementById('settingsOverlay').classList.remove('open');
}

// Esc で設定を閉じる（テーマの一覧が開いているときは、まず一覧だけ閉じる）
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const overlay = document.getElementById('settingsOverlay');
  if (!overlay.classList.contains('open')) return;
  const openList = document.querySelector('.theme-dd-list:not([hidden])');   // テーマ・フォントの一覧
  if (openList) { openList.hidden = true; return; }
  closeSettings();
});

// 左の検索：項目名と、各項目の中の設定名に一致するものだけを残す
export function filterSettingsNav(query) {
  const q = (query || '').trim().toLowerCase();
  const tabs = [...document.querySelectorAll('#settingsTabs .settings-tab')];
  tabs.forEach(tab => {
    const section = document.getElementById('settings-section-' + tab.dataset.tab);
    const hay = (tab.textContent + ' ' + (section ? section.textContent : '')).toLowerCase();
    tab.hidden = !!q && !hay.includes(q);
  });
  const active = tabs.find(t => t.classList.contains('active'));
  if (active && active.hidden) {
    const first = tabs.find(t => !t.hidden);
    if (first) switchSettingsTab(first.dataset.tab);
  }
}

// Overlay click-to-close listener
document.getElementById('settingsOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('settingsOverlay')) closeSettings();
});

export function syncSettingsUI() {
  syncThemeUI();
  if (window.syncExportFolderUI) window.syncExportFolderUI();
  // sliders
  const ef = document.getElementById('editorFontSize');
  if (ef) { ef.value = appSettings.editorFontSize; document.getElementById('editorFontSizeVal').textContent = appSettings.editorFontSize + 'px'; }
  // selects
  ['contentWidth','lineHeight','sidebarWidth','previewLines','saveMode'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = appSettings[id];
  });
  // toggles
  ['focusMode'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = appSettings[id];
  });
  const rl = document.getElementById('rankingLimitInput');
  if (rl) rl.value = appSettings.rankingLimit || 15;
  // typewriter
  const twEl = document.getElementById('typewriterMode');
  if (twEl) twEl.checked = appSettings.typewriterMode || false;
  const twPosEl = document.getElementById('typewriterPos');
  if (twPosEl) twPosEl.value = appSettings.typewriterPos || 50;
  const twPosVal = document.getElementById('typewriterPosVal');
  if (twPosVal) twPosVal.textContent = (appSettings.typewriterPos || 50) + '%';
  const twPosRow = document.getElementById('typewriterPosRow');
  if (twPosRow) twPosRow.style.display = appSettings.typewriterMode ? 'flex' : 'none';
  const pe = document.getElementById('particleEffect');
  if (pe) pe.checked = appSettings.particles;
  const cdEl = document.getElementById('confirmDelete');
  if (cdEl) cdEl.checked = appSettings.confirmDelete !== false;
}

export function applyAllSettings() {
  applyTheme();
  applySaveMode('realtime');
  applyEditorFontSize(appSettings.editorFontSize);
  applyLineHeight(appSettings.lineHeight);
  applyContentWidth(appSettings.contentWidth);
  applySidebarWidth(appSettings.sidebarWidth);
  if (!appSettings.particles) hideParticles();
  // Typewriter
  setTypewriterActive(appSettings.typewriterMode || false);
  setTypewriterPosition(appSettings.typewriterPos || 50);
  if (appSettings.typewriterMode) window.applyTypewriterMode(true);
}

// --- Editor font size ---
export function setEditorFontSize(val) {
  appSettings.editorFontSize = parseInt(val);
  const el = document.getElementById('editorFontSizeVal');
  if (el) el.textContent = val + 'px';
  applyEditorFontSize(val);
  saveSettings();
}
export function applyEditorFontSize(val) {
  const mc = document.getElementById('memo-content');
  const md = document.getElementById('memo-display');
  if (mc) mc.style.fontSize = val + 'px';
  if (md) md.style.fontSize = val + 'px';
}

// --- Line height ---
export function setLineHeight(val) {
  appSettings.lineHeight = parseFloat(val);
  applyLineHeight(val);
  saveSettings();
}
export function applyLineHeight(val) {
  const mc = document.getElementById('memo-content');
  const md = document.getElementById('memo-display');
  if (mc) mc.style.lineHeight = val;
  if (md) md.style.lineHeight = val;
}

// --- Ranking limit ---
export function setRankingLimit(val) {
  const n = Math.max(1, parseInt(val) || 15);
  appSettings.rankingLimit = n;
  const el = document.getElementById('rankingLimitInput');
  if (el) el.value = n;
  window.updateWordRanking();
  saveSettings();
}

// --- Content width ---
export function setContentWidth(val) {
  appSettings.contentWidth = val;
  applyContentWidth(val);
  saveSettings();
}
export function applyContentWidth(val) {
  const ea = document.getElementById('editor-area');
  if (ea) {
    const fullWidth = !val || val === '100%' || val === 'none';
    ea.style.maxWidth = val || 'none';
    ea.style.margin = fullWidth ? '0' : '0 auto';
  }
}

// --- Sidebar width ---
export function setSidebarWidth(val) {
  appSettings.sidebarWidth = val;
  applySidebarWidth(val);
  saveSettings();
}
export function applySidebarWidth(val) {
  // メモ一覧ペインの幅（3ペイン構成の中央）。grid 側は var(--list-w) を参照する
  const app = document.getElementById('main-app');
  if (app) app.style.setProperty('--list-w', val);
}

// --- Preview lines ---
export function setPreviewLines(val) {
  appSettings.previewLines = parseInt(val);
  applyPreviewLines(val);
  saveSettings();
}
export function applyPreviewLines(val) {
  // メモ風の一覧はプレビュー1行固定のため、行数設定は反映しない
  document.getElementById('previewLineStyle')?.remove();
}

// --- Focus mode ---
export function setFocusMode(on) {
  appSettings.focusMode = on;
  const sidebar = document.querySelector('.sidebar');
  const rp = document.querySelector('.right-panel');
  if (sidebar) sidebar.style.opacity = on ? '0.3' : '';
  if (rp) rp.style.opacity = on ? '0.3' : '';
  // restore on hover (use onX properties to avoid listener accumulation)
  if (on) {
    [sidebar, rp].forEach(el => { if (el) { el.onmouseenter = () => el.style.opacity='1'; el.onmouseleave = () => el.style.opacity='0.3'; }});
  } else {
    [sidebar, rp].forEach(el => { if (el) { el.style.opacity=''; el.onmouseenter=null; el.onmouseleave=null; }});
  }
  saveSettings();
}

// --- Save mode ---
export function setSaveMode(mode) {
  appSettings.saveMode = mode;
  saveSettings();
  applySaveMode(mode);
}

export function applySaveMode(mode) {
  mode = 'realtime'; // 常時編集＋自動保存に統一（手動保存・3秒保存は廃止）
  appSettings.saveMode = mode;
  const ta      = document.getElementById('memo-content');
  const saveBtn = document.getElementById('save-btn');
  const editBtn = document.getElementById('edit-toggle-btn');
  const ind     = document.getElementById('autosave-ind');

  if (!ta) return;
  ta.removeEventListener('input', rtSaveHandler);
  ta.removeEventListener('input', auto3sHandler);
  clearTimeout(autoSaveTimer);

  if (mode === 'realtime') {
    if (saveBtn) saveBtn.style.display = 'none';
    if (editBtn) editBtn.style.display = '';
    if (ind)     { ind.style.display = 'inline-flex'; showSaveInd('saved', '保存済み'); }
    ta.addEventListener('input', rtSaveHandler);
    if (currentMemoId) {
      ta.style.display = 'block';
      document.getElementById('memo-display').style.display = 'none';
      setIsEditing(true);
    }
  } else if (mode === 'auto3s') {
    if (saveBtn) saveBtn.style.display = 'none';
    if (editBtn) editBtn.style.display = '';
    if (ind)     { ind.style.display = 'inline-flex'; showSaveInd('saved', '保存済み'); }
    ta.addEventListener('input', auto3sHandler);
    if (currentMemoId) {
      ta.style.display = 'block';
      document.getElementById('memo-display').style.display = 'none';
      setIsEditing(true);
    }
  } else {
    // manual
    if (saveBtn) saveBtn.style.display = '';
    if (editBtn) editBtn.style.display = '';
    if (ind)     ind.style.display = 'none';
  }
}

const IND_DOTS  = '<span class="autosave-dots"><span></span><span></span><span></span></span>';
const IND_CHECK = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

export function showSaveInd(state, label) {
  const ind = document.getElementById('autosave-ind');
  if (!ind) return;
  ind.className = 'autosave-ind ' + state;
  ind.innerHTML = state === 'saved' ? IND_CHECK : IND_DOTS;
  if (label) ind.title = label;
}

export function rtSaveHandler() {
  showSaveInd('saving', '保存中...');
  clearTimeout(autoSaveTimer);
  setAutoSaveTimer(setTimeout(() => {
    silentSaveMemo();
    showSaveInd('saved', '保存済み');
  }, 600));
}

export function auto3sHandler() {
  showSaveInd('unsaved', '未保存');
  clearTimeout(autoSaveTimer);
  setAutoSaveTimer(setTimeout(() => {
    silentSaveMemo();
    showSaveInd('saved', '保存済み');
  }, 3000));
}

// Saves without toggling edit mode
export function silentSaveMemo() {
  if (!persistCurrentMemo()) return;
  window.updateNoteDate(memos.find(m => m.id === currentMemoId));
  window.renderMemoList();
}

// --- Particles ---
export function setParticles(on) {
  appSettings.particles = on;
  if (!on) hideParticles(); else showParticles();
  saveSettings();
}
export function hideParticles() { document.querySelectorAll('.particle').forEach(p => p.style.display='none'); }
export function showParticles() { document.querySelectorAll('.particle').forEach(p => p.style.display=''); }

// --- window assignments ---
window.loadSettings = loadSettings;
window.saveSettings = saveSettings;
window.openSettings = openSettings;
window.openSettingsWithSpin = openSettingsWithSpin;
window.openSettingsTab = openSettingsTab;
window.switchSettingsTab = switchSettingsTab;
window.activateSettingsTab = activateSettingsTab;
window.closeSettings = closeSettings;
window.filterSettingsNav = filterSettingsNav;
window.syncSettingsUI = syncSettingsUI;
window.applyAllSettings = applyAllSettings;
window.setEditorFontSize = setEditorFontSize;
window.applyEditorFontSize = applyEditorFontSize;
window.setLineHeight = setLineHeight;
window.applyLineHeight = applyLineHeight;
window.setRankingLimit = setRankingLimit;
window.setContentWidth = setContentWidth;
window.applyContentWidth = applyContentWidth;
window.setSidebarWidth = setSidebarWidth;
window.applySidebarWidth = applySidebarWidth;
window.setPreviewLines = setPreviewLines;
window.applyPreviewLines = applyPreviewLines;
window.setFocusMode = setFocusMode;
window.setSaveMode = setSaveMode;
window.applySaveMode = applySaveMode;
window.showSaveInd = showSaveInd;
window.rtSaveHandler = rtSaveHandler;
window.auto3sHandler = auto3sHandler;
window.silentSaveMemo = silentSaveMemo;
window.setParticles = setParticles;
window.hideParticles = hideParticles;
window.showParticles = showParticles;
