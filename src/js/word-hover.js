// ═══════════════════════════════════════════════════
//  WORD HOVER (単語ホバー) MODULE
// ═══════════════════════════════════════════════════
import { tooltipTimeout, setTooltipTimeout } from './state.js';
import { escapeHtml } from './utils.js';
import { memos, currentMemoId } from './state.js';

export function onWordHover(e) {
  clearTimeout(tooltipTimeout);
  const word = e.target.getAttribute('data-word');
  if (!word || word.length < 2) return;

  // Find memos that contain this word (excluding current)
  const related = memos.filter(m => {
    if (m.id === currentMemoId) return false;
    return (m.title + ' ' + m.content).includes(word);
  }).slice(0, 5);

  const tooltip = document.getElementById('word-tooltip');
  if (!tooltip) return;
  const titleEl = document.getElementById('tooltip-title');
  if (titleEl) titleEl.textContent = `「${word}」が登場するメモ`;

  const itemsEl = document.getElementById('tooltip-items');
  if (related.length === 0) {
    itemsEl.innerHTML = '<div style="font-size:11px;color:var(--text-muted)">他のメモには見つかりません</div>';
  } else {
    itemsEl.innerHTML = related.map(m =>
      `<div class="word-tooltip-item" onclick="openMemo('${m.id}')">
        ${escapeHtml(m.title)}
      </div>`
    ).join('');
  }

  // Position
  const rect = e.target.getBoundingClientRect();
  let left = rect.left;
  let top = rect.top - 10;

  tooltip.style.left = Math.min(left, window.innerWidth - 340) + 'px';
  tooltip.style.top = (top - (tooltip.offsetHeight || 100)) + 'px';

  requestAnimationFrame(() => {
    const h = tooltip.offsetHeight;
    tooltip.style.top = Math.max(10, rect.top - h - 8) + 'px';
    tooltip.classList.add('visible');
  });

  // Highlight matching words in current display
  document.querySelectorAll(`.word-span[data-word="${CSS.escape(word)}"]`)
    .forEach(s => s.classList.add('highlight'));
}

export function onWordLeave() {
  setTooltipTimeout(setTimeout(() => {
    document.getElementById('word-tooltip').classList.remove('visible');
    document.querySelectorAll('.word-span.highlight').forEach(s => s.classList.remove('highlight'));
  }, 300));
}

// --- window assigns ---
window.onWordHover = onWordHover;
window.onWordLeave = onWordLeave;
