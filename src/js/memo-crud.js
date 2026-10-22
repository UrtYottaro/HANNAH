// ═══════════════════════════════════════════════════
//  HANNAH - Memo CRUD Operations
// ═══════════════════════════════════════════════════

import {
  memos, folders, currentMemoId, isEditing,
  setMemos, setCurrentMemoId, setIsEditing,
  trashMemos, setTrashMemos,
  currentFolderFilter, appSettings
} from './state.js';

import {
  generateId, escapeHtml,
  deriveTitle, folderIdForFilter, formatNoteDate, DEFAULT_MEMO_TITLE
} from './utils.js';
import { saveData } from './storage.js';

// ─── Title (1行目がタイトル) ───

// 保存済みタイトルが本文の1行目と食い違うメモ（旧形式・インポート）は、
// タイトルを本文の先頭行に足して「1行目＝タイトル」に揃える。
// 書き換えが発生する場合は、初回だけ元データを別キーに退避してから行う。
const TITLE_PLACEHOLDERS = ['', '新しいメモ', '新規メモ', '無題', '(無題)'];
const PRE_MIGRATION_KEY = 'memoire_data_backup_before_firstline_title';

export function migrateMemoTitles() {
  const targets = [...memos, ...trashMemos];
  const stale = targets.filter(m => {
    const title = (m.title || '').trim();
    return !TITLE_PLACEHOLDERS.includes(title) && deriveTitle(m.content) !== title;
  });
  if (stale.length > 0) {
    try {
      if (localStorage.getItem(PRE_MIGRATION_KEY) === null) {
        const raw = localStorage.getItem('memoire_data');
        if (raw !== null) localStorage.setItem(PRE_MIGRATION_KEY, raw);
      }
    } catch (e) {
      console.error('HANNAH: 移行前バックアップに失敗したため、タイトル移行を中止しました', e);
      return 0;
    }
  }
  let changed = 0;
  targets.forEach(m => {
    const title = (m.title || '').trim();
    if (!TITLE_PLACEHOLDERS.includes(title) && deriveTitle(m.content) !== title) {
      m.content = m.content ? `${title}\n${m.content}` : title;
      changed++;
    }
    m.title = deriveTitle(m.content) || DEFAULT_MEMO_TITLE;
  });
  if (changed > 0) saveData();
  return changed;
}
window.migrateMemoTitles = migrateMemoTitles;

// ─── Note date header ───

export function updateNoteDate(memo) {
  const el = document.getElementById('note-date');
  if (!el) return;
  el.textContent = memo ? formatNoteDate(memo.updatedAt) : '';
  el.style.display = memo ? '' : 'none';
}
window.updateNoteDate = updateNoteDate;

// ─── Persist (開いているメモの保存／空メモの破棄) ───

// エディタの内容をメモに反映する。内容が変わっていなければ何もしない
// （開いて閉じただけで更新日が動かないようにするため）。変更があれば true。
export function persistCurrentMemo() {
  if (!currentMemoId || !isEditing) return false;
  const memo = memos.find(m => m.id === currentMemoId);
  if (!memo) return false;
  const content = document.getElementById('memo-content').value;
  if (content === memo.content) return false;
  memo.content = content;
  memo.title = deriveTitle(content) || DEFAULT_MEMO_TITLE;
  memo.updatedAt = new Date().toISOString();
  memo.tags = window.extractTags(content); // Cross-module call - connected via window in init.js
  saveData();
  return true;
}
window.persistCurrentMemo = persistCurrentMemo;

// 何も書かれていないメモは、離れるときに破棄する（メモアプリと同じ）。破棄したら true。
function discardIfEmpty(id) {
  if (!id) return false;
  const idx = memos.findIndex(m => m.id === id);
  if (idx < 0 || (memos[idx].content || '').trim() !== '') return false;
  if ((memos[idx].recordings || []).length) return false;   // 録音だけのメモは残す
  memos.splice(idx, 1);
  if (currentMemoId === id) setCurrentMemoId(null);
  saveData();
  return true;
}

// 今のメモを保存し、空なら破棄する。一覧の再描画が必要なら true。
export function leaveCurrentMemo() {
  const changed = persistCurrentMemo();
  const discarded = discardIfEmpty(currentMemoId);
  return changed || discarded;
}
window.leaveCurrentMemo = leaveCurrentMemo;

// ─── Pin ───

export function togglePin(id) {
  const memo = memos.find(x => x.id === id);
  if (!memo) return;
  memo.pinned = !memo.pinned;       // 更新日は変えない（並びは「ピン留め」グループの中で更新日順）
  saveData();
  window.renderMemoList();
  if (window.showToast) window.showToast(memo.pinned ? 'ピン留めしました' : 'ピン留めを外しました', 1600);
}
window.togglePin = togglePin;

// ─── Create ───

export function createNewMemo() {
  const memo = {
    id: generateId(),
    title: DEFAULT_MEMO_TITLE,
    content: '',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // フォルダ選択中なら自動割り当て（「すべて」「メモ」は未所属）
    folderId: folderIdForFilter(currentFolderFilter)
  };
  memos.unshift(memo);
  saveData();
  openMemo(memo.id);          // 直前に開いていた空メモはここで破棄される
  window.renderMemoList();    // Cross-module call - connected via window in init.js
  startEditing();
}
window.createNewMemo = createNewMemo;

// ─── Open ───

export function openMemo(id) {
  // 別のメモへ移る前に、今のメモを保存（空なら破棄）
  const leftChanged = (currentMemoId && currentMemoId !== id) ? leaveCurrentMemo() : false;
  const memo = memos.find(m => m.id === id);
  if (!memo) { if (leftChanged) window.renderMemoList(); return; }
  setCurrentMemoId(id);
  setIsEditing(true);

  document.getElementById('welcome-screen').style.display = 'none';
  document.getElementById('memo-content').value = memo.content;
  document.getElementById('memo-content').style.display = 'block';
  document.getElementById('memo-display').style.display = 'none';
  setEditToggleIcon(true);
  updateNoteDate(memo);
  if (window.renderAttachments) window.renderAttachments(memo);   // 録音の一覧

  if (leftChanged) {
    window.renderMemoList();
  } else {
    document.querySelectorAll('.memo-card').forEach(c => c.classList.toggle('active', c.dataset.id === id));
  }

  if (window.autosizeMemo) setTimeout(window.autosizeMemo, 0);
  window.updateConnectedMemos(id); // Cross-module call - connected via window in init.js
  window.updateWordRanking();      // Cross-module call - connected via window in init.js
  window.updateStats();            // Cross-module call - connected via window in init.js
  // モバイルではエディタビューに切り替え
  if (typeof window.isMobile === 'function' && window.isMobile()) {
    window.mobileShowView('editor'); // Cross-module call - connected via window in init.js
  }
}
window.openMemo = openMemo;

// ─── Empty editor / folder switch ───

// どのメモも開いていない状態（ウェルカム画面）にする
export function showEmptyEditor() {
  setCurrentMemoId(null);
  setIsEditing(false);
  const content = document.getElementById('memo-content');
  const display = document.getElementById('memo-display');
  if (content) { content.value = ''; content.style.display = 'none'; }
  if (display) { display.style.display = 'none'; display.innerHTML = ''; }
  document.getElementById('welcome-screen').style.display = 'flex';
  updateNoteDate(null);
  if (window.renderAttachments) window.renderAttachments(null);
  document.querySelectorAll('.memo-card').forEach(c => c.classList.remove('active'));
}
window.showEmptyEditor = showEmptyEditor;

// モバイルでエディタから一覧へ戻る（保存し、空のままなら破棄）
export function backToMemoList() {
  if (leaveCurrentMemo()) window.renderMemoList();
  if (!currentMemoId) showEmptyEditor();
  window.mobileShowView('list');
}
window.backToMemoList = backToMemoList;

// 一覧の先頭メモを開く（モバイルは一覧のまま／メモがなければ空のエディタ）
export function selectFirstMemoInView() {
  const list = window.getVisibleMemos();
  if (typeof window.isMobile === 'function' && window.isMobile()) {
    showEmptyEditor();
  } else if (list.length > 0) {
    openMemo(list[0].id);
  } else {
    showEmptyEditor();
  }
}
window.selectFirstMemoInView = selectFirstMemoInView;

// ─── Editing ───

const ICON_PENCIL = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
const ICON_EYE = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';

function setEditToggleIcon(showingEditor) {
  const btn = document.getElementById('edit-toggle-btn');
  if (!btn) return;
  // When showing editor, the button should show "view" icon (eye) to switch to display
  // When showing display, the button should show "edit" icon (pencil) to switch to editor
  btn.innerHTML = showingEditor ? ICON_EYE : ICON_PENCIL;
  btn.title = showingEditor ? '表示モードにする（単語ホバーで関連メモ）' : '編集モードに戻す';
}

export function startEditing() {
  setIsEditing(true);
  const memo = memos.find(m => m.id === currentMemoId);
  if (!memo) return;
  document.getElementById('memo-content').value = memo.content;
  document.getElementById('memo-content').style.display = 'block';
  document.getElementById('memo-display').style.display = 'none';
  setEditToggleIcon(true);
  if (window.autosizeMemo) window.autosizeMemo();
  document.getElementById('memo-content').focus();
}
window.startEditing = startEditing;

export function toggleEditMode() {
  if (!currentMemoId) return;
  if (isEditing) {
    // 表示モードへ（保存してから切り替え）
    const changed = persistCurrentMemo();
    setIsEditing(false);
    const content = document.getElementById('memo-content').value;
    window.renderMemoDisplay(content);
    document.getElementById('memo-content').style.display = 'none';
    document.getElementById('memo-display').style.display = 'block';
    setEditToggleIcon(false);
    if (changed) {
      const memo = memos.find(m => m.id === currentMemoId);
      updateNoteDate(memo);
      window.renderMemoList();
    }
  } else {
    startEditing();
  }
}
window.toggleEditMode = toggleEditMode;

// ─── Save ───

// Ctrl/Cmd+S 用。常時編集・自動保存なので、保留中の変更を即時に書き込むだけ
export function saveMemo() {
  if (!currentMemoId) return;
  if (persistCurrentMemo()) {
    updateNoteDate(memos.find(m => m.id === currentMemoId));
    window.renderMemoList();                    // Cross-module call - connected via window in init.js
    window.updateWordRanking();                 // Cross-module call - connected via window in init.js
    window.updateStats();                       // Cross-module call - connected via window in init.js
    window.updateConnectedMemos(currentMemoId); // Cross-module call - connected via window in init.js
    window.updateNetwork();                     // Cross-module call - connected via window in init.js
  }
  if (window.showSaveInd) window.showSaveInd('saved', '保存済み');
}
window.saveMemo = saveMemo;

// ─── Delete / Trash ───

export function deleteMemo() {
  if (!currentMemoId) return;
  if (appSettings.confirmDelete === false) {
    // 二重チェックOFF: 即座にゴミ箱へ
    moveToTrash(currentMemoId);
  } else {
    window.showDeleteConfirm(currentMemoId); // Cross-module call - connected via window in init.js
  }
}
window.deleteMemo = deleteMemo;

export function moveToTrash(id) {
  const idx = memos.findIndex(m => m.id === id);
  if (idx < 0) return;
  const memo = memos.splice(idx, 1)[0];
  memo.deletedAt = new Date().toISOString();
  trashMemos.unshift(memo);
  const wasCurrent = currentMemoId === id;
  if (wasCurrent) setCurrentMemoId(null);
  saveData();
  window.renderMemoList();    // Cross-module call - connected via window in init.js
  if (wasCurrent) {
    window.selectFirstMemoInView();
    if (typeof window.isMobile === 'function' && window.isMobile()) window.mobileShowView('list');
  }
  window.renderTrash();       // Cross-module call - connected via window in init.js
  window.updateWordRanking(); // Cross-module call - connected via window in init.js
  window.updateStats();       // Cross-module call - connected via window in init.js
  window.updateNetwork();     // Cross-module call - connected via window in init.js
}
window.moveToTrash = moveToTrash;

export function restoreFromTrash(id) {
  const idx = trashMemos.findIndex(m => m.id === id);
  if (idx < 0) return;
  const memo = trashMemos.splice(idx, 1)[0];
  delete memo.deletedAt;
  memos.unshift(memo);
  saveData();
  window.renderMemoList(); // Cross-module call - connected via window in init.js
  window.renderTrash();    // Cross-module call - connected via window in init.js
}
window.restoreFromTrash = restoreFromTrash;

export function permDeleteFromTrash(id) {
  const gone = trashMemos.find(m => m.id === id);
  if (gone && window.deleteMemoRecordings) window.deleteMemoRecordings(gone);   // 添付の録音データも消す
  setTrashMemos(trashMemos.filter(m => m.id !== id));
  saveData();
  window.renderTrash(); // Cross-module call - connected via window in init.js
}
window.permDeleteFromTrash = permDeleteFromTrash;

// ─── Link Insert ───

export function insertLinkPrompt() {
  const ta = document.getElementById('memo-content');
  if (!ta) return;
  // Switch to edit mode if needed
  if (!isEditing && currentMemoId) {
    if (window.startEditing) window.startEditing();
  }
  if (!currentMemoId) {
    alert('メモを開いてから使ってください');
    return;
  }
  const selStart = ta.selectionStart;
  const selEnd = ta.selectionEnd;
  const selectedText = ta.value.substring(selStart, selEnd);

  const url = window.prompt('URL を入力（https://...）:', selectedText.startsWith('http') ? selectedText : 'https://');
  if (!url) return;
  if (!/^(https?:\/\/|mailto:)/i.test(url)) {
    alert('URLは https://、http://、mailto: のいずれかで始めてください');
    return;
  }
  const label = selectedText && !selectedText.startsWith('http')
    ? selectedText
    : window.prompt('リンクの表示テキスト（空欄でURLそのまま）:', '') || url;

  const markdown = `[${label}](${url})`;
  ta.focus();
  ta.setRangeText(markdown, selStart, selEnd, 'end');
  // Trigger input event to save
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}
window.insertLinkPrompt = insertLinkPrompt;
