// ===== FONT MANAGER =====
import {
  fmFonts, setFmFonts,
  fmSelected, setFmSelected,
  fmApplied, setFmApplied,
  fmDB, setFmDB
} from './state.js';
import { escapeHtml } from './utils.js';

// Font-manager-specific constants
const FM_BUILTIN = [
  { name: '明朝体 (Noto Serif JP)', family: "'Noto Serif JP', serif", weights: [] },
  { name: 'ゴシック体 (Zen Kaku Gothic New)', family: "'Zen Kaku Gothic New', sans-serif", weights: [] },
  { name: 'Terminal (Menlo)', family: "'Menlo', 'Monaco', 'SF Mono', 'Courier New', monospace", weights: [] },
];

const FM_DB_NAME = 'hannah_fonts';
const FM_DB_VER  = 1;

// ---- IndexedDB font persistence ----

function fmOpenDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(FM_DB_NAME, FM_DB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('fonts'))
        db.createObjectStore('fonts', { keyPath: 'name' });
      if (!db.objectStoreNames.contains('meta'))
        db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess  = e => { setFmDB(e.target.result); res(fmDB); };
    req.onerror    = e => rej(e);
  });
}

function fmDBPut(store, obj) {
  return new Promise((res, rej) => {
    const tx = fmDB.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(obj);
    req.onsuccess = () => res();
    req.onerror   = e => rej(e);
  });
}
function fmDBGetAll(store) {
  return new Promise((res, rej) => {
    const tx = fmDB.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e);
  });
}
function fmDBDelete(store, key) {
  return new Promise((res, rej) => {
    const tx = fmDB.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => res();
    req.onerror   = e => rej(e);
  });
}

async function fmLoad() {
  try {
    await fmOpenDB();
    // Restore applied mapping
    const metaRows = await fmDBGetAll('meta');
    const appliedRow = metaRows.find(r => r.key === 'applied');
    if (appliedRow) setFmApplied(appliedRow.value || {});

    // Restore saved fonts (binary blobs)
    const savedFonts = await fmDBGetAll('fonts');
    for (const saved of savedFonts) {
      // Recreate object URL from stored ArrayBuffer
      const mime = saved.mime || 'font/ttf';
      const blob = new Blob([saved.buffer], { type: mime });
      const objectUrl = URL.createObjectURL(blob);
      const cssFamily = String(saved.cssFamily || '').replace(/[^a-zA-Z0-9\u3000-\u9fff\uff00-\uffef _-]/g, '');
      if (!cssFamily) continue;
      const style = document.createElement('style');
      style.textContent = `@font-face { font-family: '${cssFamily}'; src: url('${objectUrl}'); font-weight: ${parseInt(saved.weight, 10) || 400}; }`;
      document.head.appendChild(style);

      const existing = fmFonts.find(f => f.name === saved.familyName);
      if (existing) {
        existing.weights.push({ weight: saved.weight, cssFamily, objectUrl });
        existing.weights.sort((a,b) => a.weight - b.weight);
        existing.primaryFamily = existing.weights[0].cssFamily;
      } else {
        fmFonts.push({
          name: saved.familyName,
          primaryFamily: cssFamily,
          weights: [{ weight: saved.weight, cssFamily, objectUrl }],
          file: saved.fileName
        });
      }
    }
    applyFontVars();
    renderFmList();
  } catch(e) {
    console.warn('fmLoad error', e);
  }
}

async function fmSaveMeta() {
  try {
    if (!fmDB) await fmOpenDB();
    await fmDBPut('meta', { key: 'applied', value: fmApplied });
  } catch(e) {}
}

async function fmSaveFontToDB(familyName, weight, cssFamily, buffer, mime, fileName) {
  try {
    if (!fmDB) await fmOpenDB();
    await fmDBPut('fonts', { name: cssFamily, familyName, weight, cssFamily, buffer, mime, fileName });
  } catch(e) { console.warn('fmSaveFontToDB error', e); }
}

async function fmDeleteFontFromDB(font) {
  try {
    if (!fmDB) await fmOpenDB();
    for (const w of font.weights) {
      await fmDBDelete('fonts', w.cssFamily);
    }
  } catch(e) {}
}

// フォント管理は、設定画面の「フォント」項目の中にある。
// 従来の呼び出し（openFontManager）は、設定のフォント項目を開く
function openFontManager() {
  window.openSettings('fonts');
}
// 設定のフォント項目が表示されたときに、一覧を描き直す
function onFontsTabShown() {
  renderFmList();
}
function closeFontManager() {}   // 単独の画面ではなくなったため、何もしない（互換用）

// Drag & drop handlers
function fmDragOver(e) {
  e.preventDefault();
  document.getElementById('fmDropzone').classList.add('dragover');
}
function fmDragLeave(e) {
  document.getElementById('fmDropzone').classList.remove('dragover');
}
function fmDrop(e) {
  e.preventDefault();
  document.getElementById('fmDropzone').classList.remove('dragover');
  const files = [...e.dataTransfer.files].filter(f => /\.(ttf|otf|woff2?)$/i.test(f.name));
  if (files.length) loadFontFiles(files);
}
function fmFilePicked(e) {
  const files = [...e.target.files];
  if (files.length) loadFontFiles(files);
  e.target.value = ''; // reset so same file can be re-picked
}

async function loadFontFiles(files) {
  for (const file of files) {
    await loadSingleFont(file);
  }
  renderFmList();
}

async function loadSingleFont(file) {
  // Parse font name from filename (strip extension & weight hints)
  const rawName = file.name.replace(/\.(ttf|otf|woff2?)$/i, '');

  // Detect weight from filename
  const weightMap = { thin:100, extralight:200, light:300, regular:400, medium:500, semibold:600, bold:700, extrabold:800, black:900 };
  let detectedWeight = 400;
  const lower = rawName.toLowerCase();
  for (const [key, val] of Object.entries(weightMap)) {
    if (lower.includes(key)) { detectedWeight = val; break; }
  }
  if (/[_-](\d{3})/.test(rawName)) detectedWeight = parseInt(RegExp.$1);

  // Clean family name
  const familyName = rawName
    .replace(/[-_](thin|extralight|extra[-_]?light|light|regular|medium|semibold|semi[-_]?bold|bold|extrabold|extra[-_]?bold|black|\d{3})/gi, '')
    .replace(/[-_]+/g, ' ')
    .trim() || rawName;

  // Read file as ArrayBuffer -> ObjectURL
  const buffer = await file.arrayBuffer();
  const ext = file.name.split('.').pop().toLowerCase();
  const mime = ext === 'ttf' ? 'font/ttf'
             : ext === 'otf' ? 'font/otf'
             : ext === 'woff' ? 'font/woff'
             : 'font/woff2';
  const blob = new Blob([buffer], { type: mime });
  const objectUrl = URL.createObjectURL(blob);

  // Register @font-face in document
  const cssFamily = `fm-${familyName.replace(/[^a-zA-Z0-9\u3000-\u9fff\uff00-\uffef _-]/g,'').replace(/\s+/g,'_')}_${detectedWeight}`;
  const style = document.createElement('style');
  style.textContent = `@font-face { font-family: '${cssFamily}'; src: url('${objectUrl}'); font-weight: ${detectedWeight}; }`;
  document.head.appendChild(style);

  // Group by family name
  const existing = fmFonts.find(f => f.name === familyName);
  if (existing) {
    existing.weights.push({ weight: detectedWeight, cssFamily, objectUrl });
    existing.weights.sort((a,b) => a.weight - b.weight);
    existing.primaryFamily = existing.weights[0].cssFamily;
  } else {
    fmFonts.push({
      name: familyName,
      primaryFamily: cssFamily,
      weights: [{ weight: detectedWeight, cssFamily, objectUrl }],
      file: file.name
    });
  }

  // Persist binary to IndexedDB for cross-session recovery
  fmSaveFontToDB(familyName, detectedWeight, cssFamily, buffer, mime, file.name);
}

// ───────────────────────────────────────────────
//  フォントの一覧・選択・適用
//  適用先は4か所：body=画面全体 / title=一覧のタイトル / display=メモ本文 / mono=日付・ボタン
//  上の「フォント」で4か所すべてに、各行で個別に（カスタム）選べる
// ───────────────────────────────────────────────
const FM_TARGETS = ['body', 'title', 'display', 'mono'];

// 組み込み＋読み込み済みを、区別せず1つの一覧として扱う
function allFonts() {
  return [
    ...FM_BUILTIN.map(f => ({ name: f.name, family: f.family, loaded: false })),
    ...fmFonts.map(f => ({ name: f.name, family: f.primaryFamily, loaded: true })),
  ];
}

// CSS に渡す形へ（引用符の無い単独の名前は引用し、代替フォントを付ける）
function toCss(family) {
  if (!family) return '';
  if (family.includes(',')) return family;
  return /^['"]/.test(family) ? `${family}, sans-serif` : `'${family}', sans-serif`;
}
const usedBy = family => Object.values(fmApplied).some(v => v === family);
const fontNameFor = family => allFonts().find(f => f.family === family)?.name || null;

function renderFmList() {
  const el = document.getElementById('fmAllFonts');
  if (!el) return;
  const fonts = allFonts();
  el.innerHTML = fonts.map((f, i) => `
    <div class="fm-font-row ${fmSelected === f.name ? 'active' : ''}" data-i="${i}">
      <span class="fm-font-row-name" style="font-family:${toCss(f.family)};">${escapeHtml(f.name)}</span>
      ${usedBy(f.family) ? '<span class="fm-font-row-badge applied">使用中</span>' : ''}
    </div>`).join('');
  el.querySelectorAll('.fm-font-row').forEach(row => {
    row.addEventListener('click', () => fmSelectFont(fonts[Number(row.dataset.i)].name));
  });
  renderFontDropdowns();
}

// ── 上部の「フォント」「画面全体」…のドロップダウン ──
const CHEVRON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
const aaIcon = family => `<span class="theme-aa fm-aa" style="${family ? `font-family:${toCss(family)};` : ''}">Aa</span>`;

function renderFontDropdowns() {
  const fonts = allFonts();
  document.querySelectorAll('.fm-dd').forEach(dd => {
    const target = dd.dataset.target;
    const values = (target === 'all' ? FM_TARGETS : [target]).map(t => fmApplied[t] || null);
    const same = values.every(v => v === values[0]);
    const current = values[0];
    const label = !same ? 'カスタム' : !current ? '標準' : (fontNameFor(current) || current);
    const btn = dd.querySelector('.theme-dd-btn');
    const list = dd.querySelector('.theme-dd-list');
    btn.innerHTML = `${aaIcon(same ? current : null)}<span class="theme-dd-name">${escapeHtml(label)}</span>${CHEVRON}`;
    const item = (i, name, family, selected) => `<button type="button" class="theme-item${selected ? ' selected' : ''}" data-i="${i}">${aaIcon(family)}<span class="theme-item-name" style="${family ? `font-family:${toCss(family)};` : ''}">${escapeHtml(name)}</span>${selected ? '<span class="theme-item-check">✓</span>' : ''}</button>`;
    list.innerHTML = item(-1, '標準', null, same && !current) + fonts.map((f, i) => item(i, f.name, f.family, same && current === f.family)).join('');
    btn.onclick = e => {
      e.stopPropagation();
      const willOpen = list.hidden;
      document.querySelectorAll('.fm-dd .theme-dd-list').forEach(l => { l.hidden = true; });
      list.hidden = !willOpen;
      if (willOpen) list.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
    };
    list.querySelectorAll('.theme-item').forEach(it => {
      it.onclick = () => { pickFont(target, Number(it.dataset.i)); };
    });
  });
}
document.addEventListener('click', e => {
  if (!e.target.closest?.('.fm-dd')) document.querySelectorAll('.fm-dd .theme-dd-list').forEach(l => { l.hidden = true; });
});

// target: 'all' | 'body' | 'title' | 'display' | 'mono'、index: -1 なら標準に戻す
function pickFont(target, index) {
  const font = index >= 0 ? allFonts()[index] : null;
  (target === 'all' ? FM_TARGETS : [target]).forEach(t => {
    if (font) fmApplied[t] = font.family; else delete fmApplied[t];
  });
  applyFontVars();
  fmSaveMeta();
  renderFmList();
}

function fmSelectFont(name) {
  const font = allFonts().find(f => f.name === name);
  if (!font) return;
  setFmSelected(name);
  renderFmList();
  const loaded = font.loaded ? fmFonts.find(f => f.name === name) : null;
  const weights = loaded ? loaded.weights : [];

  document.getElementById('fmEmptyState').style.display = 'none';
  document.getElementById('fmPreviewContent').style.display = 'block';
  document.getElementById('fmApplyBar').style.display = 'flex';
  document.getElementById('fmDeleteBtn').style.display = font.loaded ? '' : 'none';   // 組み込みは削除できない

  document.getElementById('fmPreviewName').textContent = name;
  document.getElementById('fmPreviewMeta').textContent = font.loaded ? `${weights.length} weight(s) loaded` : 'built-in';
  // 選択中のフォントを、操作バーに覚えておく
  document.getElementById('fmApplyBar').dataset.family = font.family;
  fmUpdatePreview();

  const grid = document.getElementById('fmWeightsGrid');
  if (weights.length > 1) {
    const sampleText = document.getElementById('fmPreviewText').value || 'HANNAH';
    grid.innerHTML = weights.map(w => `
      <div class="fm-weight-card">
        <div class="fm-weight-label">WEIGHT ${w.weight}</div>
        <div class="fm-weight-sample" style="font-family:'${w.cssFamily}'; font-weight:${w.weight};">${escapeHtml(sampleText.slice(0, 16))}</div>
      </div>`).join('');
  } else {
    grid.innerHTML = '';
  }
}

function fmUpdatePreview() {
  const family = document.getElementById('fmApplyBar').dataset.family || '';
  const text = document.getElementById('fmPreviewText').value || 'HANNAH — 記憶の地図';
  const size = document.getElementById('fmSizeRange').value;
  document.getElementById('fmSizeVal').textContent = size + 'px';
  const sample = document.getElementById('fmPreviewSample');
  sample.style.fontFamily = toCss(family);
  sample.style.fontSize = size + 'px';
  sample.textContent = text;
  const sampleText = text.slice(0, 16);
  document.querySelectorAll('.fm-weight-sample').forEach(el => { el.textContent = sampleText; });
}

// 選択中のフォントを、4か所すべてに適用
function applyFontAll() {
  const family = document.getElementById('fmApplyBar').dataset.family;
  if (!family) return;
  FM_TARGETS.forEach(t => { fmApplied[t] = family; });
  applyFontVars();
  fmSaveMeta();
  renderFmList();
}

// 適用を CSS に反映する。画面全体は body に、他の3つは CSS 変数（notes.css が参照）に設定。
// 一覧の再描画で消えないよう、要素への直接指定ではなく変数で持つ
function applyFontVars() {
  const root = document.documentElement.style;
  document.body.style.fontFamily = fmApplied.body ? toCss(fmApplied.body) : '';
  ['title', 'display', 'mono'].forEach(t => {
    if (fmApplied[t]) root.setProperty('--font-' + t, toCss(fmApplied[t]));
    else root.removeProperty('--font-' + t);
  });
}

function resetFonts() {
  setFmApplied({});
  fmSaveMeta();
  applyFontVars();
  renderFmList();
}

// 読み込んだフォントを削除（誤って消さないよう、一覧の行ではなく専用ボタンから確認つきで）
function deleteSelectedFont() {
  const font = fmFonts.find(f => f.name === fmSelected);
  if (!font) return;
  if (!confirm(`「${font.name}」を削除しますか？\nこのフォントを使っている箇所は「標準」に戻ります。元に戻せません。`)) return;
  fmRemoveFont(font.name);
}

function fmRemoveFont(name) {
  const idx = fmFonts.findIndex(f => f.name === name);
  if (idx < 0) return;
  const font = fmFonts[idx];
  fmDeleteFontFromDB(font);
  font.weights.forEach(w => URL.revokeObjectURL(w.objectUrl));
  FM_TARGETS.forEach(t => { if (fmApplied[t] === font.primaryFamily) delete fmApplied[t]; });   // 使っていた箇所は標準へ
  fmFonts.splice(idx, 1);
  if (fmSelected === name) {
    setFmSelected(null);
    document.getElementById('fmEmptyState').style.display = 'block';
    document.getElementById('fmPreviewContent').style.display = 'none';
    document.getElementById('fmApplyBar').style.display = 'none';
    document.getElementById('fmApplyBar').dataset.family = '';
  }
  applyFontVars();
  fmSaveMeta();
  renderFmList();
}

// ---- Window assignments for onclick compatibility ----
window.fmSelectFont    = fmSelectFont;
window.openFontManager = openFontManager;
window.onFontsTabShown = onFontsTabShown;
window.closeFontManager = closeFontManager;
window.applyFontAll    = applyFontAll;
window.deleteSelectedFont = deleteSelectedFont;
window.resetFonts      = resetFonts;
window.fmRemoveFont    = fmRemoveFont;
window.fmFilePicked    = fmFilePicked;
window.fmDragOver      = fmDragOver;
window.fmDragLeave     = fmDragLeave;
window.fmDrop          = fmDrop;
window.fmUpdatePreview = fmUpdatePreview;
window.loadFontFiles   = loadFontFiles;

// ---- Exports ----
export {
  FM_BUILTIN, FM_DB_NAME, FM_DB_VER,
  fmOpenDB, fmDBPut, fmDBGetAll, fmDBDelete,
  fmLoad, fmSaveMeta, fmSaveFontToDB, fmDeleteFontFromDB,
  openFontManager, closeFontManager,
  fmDragOver, fmDragLeave, fmDrop, fmFilePicked,
  loadFontFiles, loadSingleFont,
  renderFmList, fmSelectFont, fmUpdatePreview,
  applyFontAll, applyFontVars, pickFont, deleteSelectedFont,
  resetFonts, fmRemoveFont
};

// Init
fmLoad();
