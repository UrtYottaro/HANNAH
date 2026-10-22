// ═══════════════════════════════════════════════════
//  HANNAH - 録音（音声入力とは別の、音声そのものを残す機能）
//
//  ツールバーの録音ボタンで開始／停止する。録音は今開いているメモに添付され、
//  エディタ上部に再生バーとして並ぶ。音声データは IndexedDB（hannah_audio）に保存し、
//  メモ側には目録（id・長さなど）だけを持たせる。
//  各録音は「保存」から、書き出し先フォルダへ音声ファイルとして書き出せる。
// ═══════════════════════════════════════════════════

import { memos, trashMemos, currentMemoId } from './state.js';
import { saveData } from './storage.js';
import { generateId, deriveTitle, escapeHtml } from './utils.js';
import { saveBlobToExportFolder, safeFileName } from './memo-export.js';

const AUDIO_DB = 'hannah_audio';
const CLIP_STORE = 'clips';

const REC_ICON = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/></svg>';
const STOP_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

// ── IndexedDB ──
function openAudioDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(AUDIO_DB, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(CLIP_STORE, { keyPath: 'id' });
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e);
  });
}
async function dbRun(mode, fn) {
  const db = await openAudioDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(CLIP_STORE, mode);
    const r = fn(tx.objectStore(CLIP_STORE));
    tx.oncomplete = () => res(r && r.result);
    tx.onerror = e => rej(e);
  });
}
const putClip = clip => dbRun('readwrite', s => s.put(clip));
const getClip = id => dbRun('readonly', s => s.get(id));
const deleteClip = id => dbRun('readwrite', s => s.delete(id));

// ── 録音の状態 ──
let mediaRecorder = null;
let stream = null;
let chunks = [];
let startedAt = 0;
let timer = null;
let targetMemoId = null;

function pickMime() {
  const cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return cands.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
}
const extFor = mime => (mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm');
const fmtDur = sec => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

function setRecUI(on) {
  const btn = document.getElementById('rec-btn');
  if (!btn) return;
  btn.classList.toggle('rec-on', on);
  btn.innerHTML = on ? `${STOP_ICON}<span class="rec-time" id="rec-time">0:00</span>` : REC_ICON;
  btn.title = on ? '録音を止めて保存' : '録音';
}

function tick() {
  const el = document.getElementById('rec-time');
  if (el) el.textContent = fmtDur((Date.now() - startedAt) / 1000);
}

export async function toggleRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') { mediaRecorder.stop(); return; }

  if (!navigator.mediaDevices || !window.MediaRecorder) {
    window.showToast('このブラウザは録音に対応していません');
    return;
  }
  if (!currentMemoId && window.createNewMemo) window.createNewMemo();   // メモが無ければ作る
  targetMemoId = currentMemoId;

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    window.showToast(e && e.name === 'NotAllowedError' ? 'マイクの使用が許可されていません' : 'マイクを開始できませんでした');
    return;
  }

  const mime = pickMime();
  chunks = [];
  mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  mediaRecorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  mediaRecorder.onerror = () => window.showToast('録音中にエラーが起きました');
  mediaRecorder.onstop = finishRecording;
  mediaRecorder.start(1000);              // 1秒ごとにデータを確保（途中で止まっても失われにくい）
  startedAt = Date.now();
  setRecUI(true);
  clearInterval(timer);
  timer = setInterval(tick, 500);
}

async function finishRecording() {
  clearInterval(timer);
  stream && stream.getTracks().forEach(t => t.stop());
  const mime = (mediaRecorder && mediaRecorder.mimeType) || chunks[0]?.type || 'audio/webm';
  const duration = (Date.now() - startedAt) / 1000;
  const blob = new Blob(chunks, { type: mime });
  mediaRecorder = null; stream = null; chunks = [];
  setRecUI(false);
  if (!blob.size) { window.showToast('録音データがありませんでした'); return; }

  // 録音を始めたメモ（今のメモとは限らない）へ添付する
  const memo = memos.find(m => m.id === targetMemoId) || trashMemos.find(m => m.id === targetMemoId);
  if (!memo) { window.showToast('録音先のメモが見つからないため、保存しませんでした'); return; }
  const clip = { id: generateId(), memoId: memo.id, blob, mime, createdAt: new Date().toISOString(), duration };
  try {
    await putClip(clip);
  } catch (e) {
    console.error('HANNAH: 録音の保存に失敗', e);
    window.showToast('録音を保存できませんでした（保存容量を確認してください）');
    return;
  }
  (memo.recordings = memo.recordings || []).push({ id: clip.id, createdAt: clip.createdAt, duration, mime, size: blob.size });
  saveData();
  window.renderMemoList();
  if (currentMemoId === memo.id) renderAttachments(memo);
  window.showToast(`録音を保存しました（${fmtDur(duration)}）`);
}

// ── エディタ上部の録音一覧 ──
let urls = [];
function revokeUrls() { urls.forEach(u => URL.revokeObjectURL(u)); urls = []; }

export async function renderAttachments(memo) {
  const box = document.getElementById('note-attachments');
  if (!box) return;
  revokeUrls();
  const list = (memo && memo.recordings) || [];
  box.innerHTML = '';
  box.style.display = list.length ? '' : 'none';
  for (const rec of list) {
    const clip = await getClip(rec.id).catch(() => null);
    const item = document.createElement('div');
    item.className = 'rec-item';
    const when = new Date(rec.createdAt);
    const label = `${when.getMonth() + 1}/${when.getDate()} ${when.getHours()}:${String(when.getMinutes()).padStart(2, '0')}・${fmtDur(rec.duration || 0)}`;
    if (!clip) {
      item.innerHTML = `<span class="rec-missing">録音データが見つかりません（${escapeHtml(label)}）</span><button type="button" class="rec-act" data-act="del" title="この録音を消す">✕</button>`;
    } else {
      const url = URL.createObjectURL(clip.blob);
      urls.push(url);
      item.innerHTML = `<audio controls preload="metadata" src="${url}"></audio><span class="rec-label">${escapeHtml(label)}</span>
        <button type="button" class="rec-act" data-act="save" title="音声ファイルとして書き出す">保存</button>
        <button type="button" class="rec-act" data-act="del" title="この録音を消す">✕</button>`;
    }
    item.querySelector('[data-act="del"]').onclick = () => removeRecording(memo.id, rec.id);
    item.querySelector('[data-act="save"]')?.addEventListener('click', () => saveRecordingFile(memo, rec, clip));
    box.appendChild(item);
  }
}

async function removeRecording(memoId, recId) {
  if (!confirm('この録音を消しますか？（元に戻せません）')) return;
  const memo = memos.find(m => m.id === memoId) || trashMemos.find(m => m.id === memoId);
  if (!memo) return;
  memo.recordings = (memo.recordings || []).filter(r => r.id !== recId);
  await deleteClip(recId).catch(() => {});
  saveData();
  window.renderMemoList();
  renderAttachments(memo);
}

async function saveRecordingFile(memo, rec, clip) {
  const d = new Date(rec.createdAt);
  const p = n => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const base = `${safeFileName(deriveTitle(memo.content) || memo.title, '録音')}_${stamp}`;
  try {
    const where = await saveBlobToExportFolder(clip.blob, base, extFor(rec.mime || clip.mime || ''));
    if (where) window.showToast(`書き出しました: ${where}`);
  } catch (e) {
    console.error('HANNAH: 録音の書き出しに失敗', e);
    window.showToast('書き出しに失敗しました');
  }
}

// メモを完全に削除するとき、添付の録音データも消す
export async function deleteMemoRecordings(memo) {
  for (const rec of (memo && memo.recordings) || []) await deleteClip(rec.id).catch(() => {});
}

window.toggleRecording = toggleRecording;
window.renderAttachments = renderAttachments;
window.deleteMemoRecordings = deleteMemoRecordings;
