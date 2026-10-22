// ═══════════════════════════════════════════════════
//  HANNAH - メモを .txt として別フォルダへ書き出し
//
//  File System Access API（Chrome / Edge）が使えるときは、最初に選んだフォルダへ直接保存し、
//  そのフォルダを次回以降も覚えておく。使えないブラウザでは、ダウンロードとして保存する。
//  書き出しは「コピー」で、HANNAH 内のメモは消さない。
// ═══════════════════════════════════════════════════

import { memos, trashMemos } from './state.js';
import { deriveTitle } from './utils.js';

const PREF_DB = 'hannah_prefs';
const HANDLE_STORE = 'handles';
const HANDLE_KEY = 'exportDir';

const supportsFolderPicker = () => typeof window.showDirectoryPicker === 'function';

// ── 書き出し先フォルダのハンドルを IndexedDB に保存 ──
function openPrefDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(PREF_DB, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(HANDLE_STORE);
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e);
  });
}
async function getSavedHandle() {
  try {
    const db = await openPrefDB();
    return await new Promise(res => {
      const r = db.transaction(HANDLE_STORE).objectStore(HANDLE_STORE).get(HANDLE_KEY);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => res(null);
    });
  } catch (e) { return null; }
}
async function saveHandle(handle) {
  const db = await openPrefDB();
  await new Promise((res, rej) => {
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY);
    tx.oncomplete = res; tx.onerror = rej;
  });
}

export async function syncExportFolderUI() {
  const el = document.getElementById('exportFolderName');
  if (!el) return;
  if (!supportsFolderPicker()) { el.textContent = 'このブラウザはフォルダの指定に未対応です（ダウンロードフォルダに保存します）'; return; }
  const h = await getSavedHandle();
  el.textContent = h ? `現在: ${h.name}` : '未設定（最初に書き出すときに選びます）';
}

// 書き出し先フォルダを選ぶ（設定画面・初回の書き出し時）
export async function chooseExportFolder() {
  if (!supportsFolderPicker()) {
    window.showToast('このブラウザではフォルダを指定できないため、ダウンロードフォルダに保存されます');
    return null;
  }
  try {
    const dir = await window.showDirectoryPicker({ id: 'hannah-export', mode: 'readwrite' });
    await saveHandle(dir);
    syncExportFolderUI();
    return dir;
  } catch (e) {
    if (e && e.name === 'AbortError') return null;   // キャンセル
    console.error('HANNAH: フォルダを選べませんでした', e);
    window.showToast('フォルダを選べませんでした');
    return null;
  }
}

// 保存済みフォルダを使う（書き込み許可を確認）。無ければ選んでもらう
async function resolveExportDir() {
  const saved = await getSavedHandle();
  if (saved) {
    try {
      let perm = await saved.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') perm = await saved.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') return saved;
    } catch (e) { /* フォルダが消えた等 → 選び直す */ }
  }
  return chooseExportFolder();
}

export function safeFileName(title, fallback = 'メモ') {
  const s = String(title || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 60);
  return s || fallback;
}

// 同名ファイルがあれば「名前 (2).拡張子」にする
async function uniqueFileName(dir, base, ext) {
  let name = `${base}.${ext}`;
  for (let i = 2; i < 500; i++) {
    try { await dir.getFileHandle(name); } catch (e) { return name; }   // 見つからない＝空いている
    name = `${base} (${i}).${ext}`;
  }
  return `${base}-${Date.now()}.${ext}`;
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// 共通：Blob を書き出し先フォルダ（またはダウンロード）へ保存。保存先の説明文を返す（キャンセル時は null）
export async function saveBlobToExportFolder(blob, base, ext) {
  if (supportsFolderPicker()) {
    const dir = await resolveExportDir();
    if (!dir) return null;
    const name = await uniqueFileName(dir, base, ext);
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
    return `${dir.name}/${name}`;
  }
  const name = `${base}.${ext}`;
  downloadBlob(blob, name);
  return `ダウンロード/${name}`;
}

// メモ1件を .txt として書き出す（スワイプの共有ボタンから）
export async function exportMemoTxt(id) {
  const memo = memos.find(m => m.id === id) || trashMemos.find(m => m.id === id);
  if (!memo) return;
  const body = memo.content || '';
  const text = body.endsWith('\n') ? body : body + '\n';
  const base = safeFileName(deriveTitle(body) || memo.title, 'メモ');
  try {
    const where = await saveBlobToExportFolder(new Blob([text], { type: 'text/plain;charset=utf-8' }), base, 'txt');
    if (where) window.showToast(`書き出しました: ${where}`);
  } catch (e) {
    console.error('HANNAH: 書き出しに失敗', e);
    window.showToast('書き出しに失敗しました');
  }
}

window.exportMemoTxt = exportMemoTxt;
window.chooseExportFolder = chooseExportFolder;
window.syncExportFolderUI = syncExportFolderUI;
