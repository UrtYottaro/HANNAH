// ═══════════════════════════════════════════════════
//  HANNAH - Render Functions
// ═══════════════════════════════════════════════════

import { memos, currentMemoId, currentFolderFilter } from './state.js';

import { folders } from './state.js';
import {
  escapeHtml, UNFILED_FILTER, DEFAULT_MEMO_TITLE,
  deriveTitle, derivePreview, memoMatchesFilter,
  toTime, formatListDate, dateGroupOf
} from './utils.js';

const ICON = {
  pin: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16 3a1 1 0 0 1 .7 1.7L15.4 6l.9 5.1 2 2a1 1 0 0 1-.7 1.7H13v5.2a1 1 0 0 1-2 0v-5.2H6.4a1 1 0 0 1-.7-1.7l2-2L8.6 6 7.3 4.7A1 1 0 0 1 8 3h8z"/></svg>',
  unpin: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3H8l1.3 1.3L8.6 6l-.9 5.1-2 2h5.7V19"/><path d="M13 14.4h4.6l-2-2L15 9"/><line x1="3" y1="3" x2="21" y2="21"/></svg>',
  share: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><polyline points="7 8 12 3 17 8"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
  trash: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
  pinMark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 3 6 6-3.5.7-2 2-1 4-2 2-2-5-5-2 2-2 4-1 2-2z"/><path d="m9 15-6 6"/></svg>',
  pinSm: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M16 3a1 1 0 0 1 .7 1.7L15.4 6l.9 5.1 2 2a1 1 0 0 1-.7 1.7H13v5.2a1 1 0 0 1-2 0v-5.2H6.4a1 1 0 0 1-.7-1.7l2-2L8.6 6 7.3 4.7A1 1 0 0 1 8 3h8z"/></svg>',
};

const FOLDER_ICON_SM = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';

// ─── Memo List ───

// 現在のフォルダ絞り込みで見えているメモ（更新日の新しい順）
export function getVisibleMemos() {
  return memos
    .filter(m => memoMatchesFilter(m, currentFolderFilter, folders))
    .sort((a, b) => toTime(b.updatedAt) - toTime(a.updatedAt));
}
window.getVisibleMemos = getVisibleMemos;

export function currentFolderLabel() {
  if (currentFolderFilter === 'all') return 'すべてのメモ';
  if (currentFolderFilter === UNFILED_FILTER) return 'メモ';
  const f = folders.find(x => x.id === currentFolderFilter);
  return f ? f.name : 'すべてのメモ';
}

function updateListHeader(count) {
  const title = document.getElementById('list-title');
  const sub = document.getElementById('list-count');
  if (title) title.textContent = currentFolderLabel();
  if (sub) sub.textContent = `${count}件のメモ`;
}

export function renderMemoList(filtered) {
  window.renderFolderBar(); // Cross-module call - connected via window in init.js
  // 検索中は、保存・再描画のたびに絞り込みが解除されないよう、検索結果で描画する
  if (!filtered) filtered = window.getActiveSearchResults();
  const list = filtered
    ? [...filtered].sort((a, b) => toTime(b.updatedAt) - toTime(a.updatedAt))
    : getVisibleMemos();
  updateListHeader(list.length);

  const container = document.getElementById('memo-list');
  container.innerHTML = '';
  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state">メモがありません</div>';
    return;
  }

  const now = new Date();
  const showFolder = !filtered && currentFolderFilter === 'all';
  window.resetSwipeState();   // 描き直すので、ボタンを出していた行の覚えを消す

  // ピン留めを先頭の1グループにまとめ、残りは更新日ごとのセクションに分ける
  const groups = [];
  const pinned = list.filter(m => m.pinned);
  if (pinned.length) groups.push({ key: 'pinned', label: 'ピン留め', pinned: true, items: pinned });
  list.filter(m => !m.pinned).forEach(memo => {
    const g = dateGroupOf(memo.updatedAt, now);
    let last = groups[groups.length - 1];
    if (!last || last.key !== g.key) { last = { key: g.key, label: g.label, items: [] }; groups.push(last); }
    last.items.push(memo);
  });

  groups.forEach(g => {
    const groupEl = document.createElement('section');
    groupEl.className = 'memo-group';
    groupEl.innerHTML = `<h3 class="memo-group-title">${g.pinned ? ICON.pinSm : ''}${escapeHtml(g.label)}</h3>`;
    container.appendChild(groupEl);

    g.items.forEach(memo => {
      const row = document.createElement('div');
      row.className = 'memo-row';
      const title = deriveTitle(memo.content) || memo.title || DEFAULT_MEMO_TITLE;
      const nRec = (memo.recordings || []).length;
      const preview = derivePreview(memo.content) || (nRec ? `録音 ${nRec}件` : '追加テキストなし');
      const folder = showFolder ? folders.find(f => f.id === memo.folderId) : null;
      const folderRow = folder
        ? `<div class="memo-card-folder">${FOLDER_ICON_SM}<span>${escapeHtml(folder.name)}</span></div>`
        : '';
      row.innerHTML = `
        <div class="swipe-actions swipe-actions-left">
          <button type="button" class="swipe-btn swipe-pin" data-act="pin" title="${memo.pinned ? 'ピン留めを外す' : 'ピン留め'}" aria-label="${memo.pinned ? 'ピン留めを外す' : 'ピン留め'}">${memo.pinned ? ICON.unpin : ICON.pin}</button>
        </div>
        <div class="swipe-actions swipe-actions-right">
          <button type="button" class="swipe-btn swipe-share" data-act="export" title=".txt として別フォルダへ書き出す" aria-label="書き出し">${ICON.share}</button>
          <button type="button" class="swipe-btn swipe-trash" data-act="trash" title="ゴミ箱へ" aria-label="ゴミ箱へ">${ICON.trash}</button>
        </div>
        <div class="memo-card${memo.id === currentMemoId ? ' active' : ''}${memo.pinned ? ' is-pinned' : ''}" data-id="${memo.id}">
          ${memo.pinned ? `<span class="memo-pin-mark" aria-label="ピン留め中">${ICON.pinMark}</span>` : ''}
          <div class="memo-card-title">${escapeHtml(title)}</div>
          <div class="memo-card-meta">
            <span class="memo-card-date">${formatListDate(memo.updatedAt, now)}</span>
            <span class="memo-card-preview">${escapeHtml(preview)}</span>
          </div>
          ${folderRow}
        </div>`;
      const card = row.querySelector('.memo-card');
      card.onclick = () => { if (!window.swallowRowClick(row)) window.openMemo(memo.id); };
      // 長押し → ドラッグ起動
      window.initMemoDrag(card, memo.id); // Cross-module call - connected via window in init.js
      window.initMemoSwipe(row, memo.id);
      groupEl.appendChild(row);
    });
  });
}
window.renderMemoList = renderMemoList;

// ─── Memo Display ───

function sanitizeUrl(url) {
  if (!url) return '';
  const trimmed = url.trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return 'https://' + trimmed;
  return '';
}

export function renderMemoDisplay(content) {
  const display = document.getElementById('memo-display');
  if (!content) { display.innerHTML = ''; return; }

  // Step 1: Extract markdown links [text](url) and raw URLs into placeholders
  const linkPlaceholders = [];
  let processedContent = content;

  // Markdown links: [text](url)
  processedContent = processedContent.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, (m, text, url) => {
    const safe = sanitizeUrl(url);
    if (!safe) return m;
    linkPlaceholders.push(`<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer" class="memo-link">${escapeHtml(text)}</a>`);
    return `LINK${linkPlaceholders.length - 1}`;
  });

  // Raw URLs: https://... http://... www....
  processedContent = processedContent.replace(/(https?:\/\/[^\s<>"'）)]+|www\.[^\s<>"'）)]+)/g, (m) => {
    const safe = sanitizeUrl(m);
    if (!safe) return m;
    const label = m.length > 60 ? m.slice(0, 57) + '...' : m;
    linkPlaceholders.push(`<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer" class="memo-link">${escapeHtml(label)}</a>`);
    return `LINK${linkPlaceholders.length - 1}`;
  });

  // Step 2: Split into lines, process words for hover
  const lines = processedContent.split('\n');
  const html = lines.map(line => {
    if (!line.trim()) return '<br>';
    const wordRegex = /([^\s、。！？「」【】\(\)\[\]…\.\,\!\?]+)/g;
    const processed = line.replace(wordRegex, (match) => {
      if (match.length < 2) return match;
      // Don't wrap link placeholders in word-span
      if (match.includes('LINK')) return match;
      return `<span class="word-span" data-word="${escapeHtml(match)}">${escapeHtml(match)}</span>`;
    });
    return `<p style="margin-bottom:0.5em">${processed}</p>`;
  }).join('');

  // Step 3: Restore link placeholders
  const finalHtml = html.replace(/LINK(\d+)/g, (_, i) => linkPlaceholders[parseInt(i)] || '');
  display.innerHTML = finalHtml;

  // Extract tags for current memo
  window.extractTags(content); // Cross-module call - connected via window in init.js

  // Add hover listeners
  display.querySelectorAll('.word-span').forEach(span => {
    span.addEventListener('mouseenter', window.onWordHover);  // Cross-module call - connected via window in init.js
    span.addEventListener('mouseleave', window.onWordLeave);  // Cross-module call - connected via window in init.js
  });
}
window.renderMemoDisplay = renderMemoDisplay;
