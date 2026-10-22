// ═══════════════════════════════════════════════════
//  TRASH (ゴミ箱) MODULE
// ═══════════════════════════════════════════════════
import { trashMemos } from './state.js';
import { saveData } from './storage.js';
import { escapeHtml } from './utils.js';

export function renderTrash() {
  const list = document.getElementById('trash-list');
  if (!list) return;
  const sub = document.getElementById('trash-sub');
  if (sub) sub.textContent = trashMemos.length ? `${trashMemos.length}件のメモ` : '';
  if (trashMemos.length === 0) {
    list.innerHTML = '<div class="trash-empty">ゴミ箱は空です</div>';
    return;
  }
  list.innerHTML = trashMemos.map(m => {
    const d = m.deletedAt ? new Date(m.deletedAt) : new Date();
    const ds = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} 削除`;
    const body = (m.content || '').split('\n').slice(1).join(' ').trim().slice(0, 60);
    return `<div class="trash-card">
      <div class="trash-card-title">${escapeHtml(m.title || '新規メモ')}</div>
      <div class="trash-card-meta"><span class="trash-card-date">${ds}</span><span class="trash-card-preview">${escapeHtml(body)}</span></div>
      <div class="trash-card-btns">
        <button class="restore-btn" onclick="restoreFromTrash('${m.id}'); switchSidebarTab('memo')">元に戻す</button>
        <button class="perm-del-btn" onclick="confirmPermDelete('${m.id}')">完全に削除</button>
      </div>
    </div>`;
  }).join('');
}

export function confirmPermDelete(id) {
  const m = trashMemos.find(x => x.id === id);
  if (!m) return;
  if (confirm(`「${m.title}」を完全に削除しますか？\nこの操作は取り消せません。`)) {
    window.permDeleteFromTrash(id);
  }
}

// Assign to window for inline onclick handlers
window.renderTrash = renderTrash;
window.confirmPermDelete = confirmPermDelete;
