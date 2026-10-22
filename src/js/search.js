// ═══════════════════════════════════════════════════
//  HANNAH - Search Functions
//  ツールバー右上の入力欄（モバイルは一覧上部）にそのまま入力して絞り込む。
//  入力するたびに一覧を絞り込み、空にすると元の一覧へ戻る。
// ═══════════════════════════════════════════════════

import { memos, folders, currentFolderFilter } from './state.js';
import { memoMatchesFilter } from './utils.js';

let searchQuery = '';
let searchTimer = null;

function searchInputs() {
  return [...document.querySelectorAll('.js-search-input')];
}

// 現在のフォルダ内で、検索語に合うメモ（検索中でなければ null）。render.js が参照する
function getActiveSearchResults() {
  if (!searchQuery) return null;
  const q = searchQuery.toLowerCase();
  return memos
    .filter(m => memoMatchesFilter(m, currentFolderFilter, folders))
    .filter(m => (m.title + ' ' + m.content + ' ' + (m.tags || []).join(' ')).toLowerCase().includes(q));
}

function applySearch(value) {
  searchQuery = (value || '').trim();
  // PC用とモバイル用の入力欄、✕ボタンの表示を揃える
  searchInputs().forEach(el => {
    if (el.value !== value) el.value = value;
    el.closest('.js-search-box')?.classList.toggle('has-text', value !== '');
  });
  window.renderMemoList();
}

// 入力欄の oninput から呼ぶ
function onSearchInput(el) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => applySearch(el.value), 80);
}

function onSearchKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    clearSearch();
    e.target.blur();
  }
}

// 単語クリック（頻出ワード・関連語）などから、その語で検索する
function searchByWord(word) {
  applySearch(word);
}

function clearSearch() {
  clearTimeout(searchTimer);
  applySearch('');
}

// ⌘K / Ctrl+K で検索欄へ移動（画面に見えている方の入力欄）
function focusSearch() {
  const visible = searchInputs().find(el => el.offsetParent !== null);
  if (!visible) return;
  visible.focus();
  visible.select();
}

document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    focusSearch();
  }
});

// Mac 以外では、ショートカットの表示を Ctrl+K にする
if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
  const box = document.getElementById('search-input');
  if (box) box.placeholder = '検索 (Ctrl+K)';
}

window.getActiveSearchResults = getActiveSearchResults;
window.onSearchInput = onSearchInput;
window.onSearchKeydown = onSearchKeydown;
window.searchByWord = searchByWord;
window.clearSearch = clearSearch;
window.focusSearch = focusSearch;

export { getActiveSearchResults, onSearchInput, onSearchKeydown, searchByWord, clearSearch, focusSearch };
