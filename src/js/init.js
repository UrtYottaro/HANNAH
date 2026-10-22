// ======= HANNAH Init Module =======
// Orchestrates app startup: loads data, renders UI, sets up event listeners

import { loadData, saveData, cleanupOldTrash } from './storage.js';
import { loadSettings, applyAllSettings, syncSettingsUI } from './settings.js';
import { renderMemoList } from './render.js';
import { updateWordRanking, updateStats } from './word-analysis.js';
import { updateNetwork } from './connected.js';
import { renderFolderDock } from './folders.js';
import { renderTaskList } from './tasks.js';
import { renderTrash } from './trash.js';
import { isMobile, mobileShowView } from './mobile.js';
import { saveMemo, persistCurrentMemo, migrateMemoTitles, selectFirstMemoInView } from './memo-crud.js';
import { onWordHover, onWordLeave } from './word-hover.js';
import { tooltipTimeout, setTooltipTimeout, currentMemoId } from './state.js';

export function initApp() {
  // Load persisted data
  loadData();
  cleanupOldTrash();
  migrateMemoTitles(); // 旧形式（タイトル欄あり）のメモを「1行目＝タイトル」へ
  loadSettings();
  applyAllSettings();
  syncSettingsUI();

  // Initial render
  renderMemoList();
  renderTaskList();
  renderTrash();
  updateWordRanking();
  updateStats();
  updateNetwork();
  renderFolderDock();

  window.restoreFolderPane(); // サイドバーの開閉状態を復元

  // 起動時は一覧の先頭メモを開く（モバイルは一覧から始める）
  selectFirstMemoInView();
  mobileShowView('list');

  // Fix panel layout
  ['panel-task', 'panel-trash'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.flexDirection = 'column';
  });

  // Floating particles
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.top = (50 + Math.random() * 50) + 'vh';
    p.style.animationDelay = Math.random() * 8 + 's';
    p.style.animationDuration = (6 + Math.random() * 6) + 's';
    document.body.appendChild(p);
  }

  // Keyboard shortcut: Ctrl+S / Cmd+S to save
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveMemo();
    }
  });

  // Save current memo on page close/refresh
  function emergencySave() {
    persistCurrentMemo();
  }
  window.addEventListener('beforeunload', emergencySave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') emergencySave();
  });

  // Window resize: reset mobile view on desktop
  window.addEventListener('resize', () => {
    if (!isMobile()) {
      const app = document.getElementById('main-app');
      if (app) {
        app.classList.remove('mobile-view-folders', 'mobile-view-editor');
      }
    }
  });

  // Word tooltip hover persistence
  const tooltip = document.getElementById('word-tooltip');
  if (tooltip) {
    tooltip.addEventListener('mouseenter', () => {
      clearTimeout(tooltipTimeout);
    });
    tooltip.addEventListener('mouseleave', () => {
      const tt = document.getElementById('word-tooltip');
      if (tt) tt.classList.remove('visible');
    });
  }

  // 本文欄は中身に合わせて伸ばし、スクロールは外側の editor-area が受け持つ。
  // 高さを一度 auto に戻すと外側のスクロール位置が先頭付近へ飛ぶので、
  // 位置を覚えて戻し、そのうえで入力中の行（キャレット）が見える位置に保つ。
  const memoTa = document.getElementById('memo-content');
  if (memoTa) {
    const caretBottom = () => {   // キャレットのある行の下端（本文欄の上端からの距離）
      const cs = getComputedStyle(memoTa);
      const mirror = document.createElement('div');
      mirror.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box;' +
        `width:${memoTa.clientWidth}px;font:${cs.font};letter-spacing:${cs.letterSpacing};line-height:${cs.lineHeight};` +
        `padding:${cs.paddingTop} ${cs.paddingRight} 0 ${cs.paddingLeft};tab-size:${cs.tabSize};`;
      mirror.textContent = memoTa.value.slice(0, memoTa.selectionEnd);
      const mark = document.createElement('span');
      mark.textContent = '\u200b';
      mirror.appendChild(mark);
      document.body.appendChild(mirror);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.6;
      const bottom = mark.offsetTop + lh;
      mirror.remove();
      return bottom;
    };
    const autosize = () => {
      const scroller = document.getElementById('editor-area');
      const keep = scroller ? scroller.scrollTop : 0;
      memoTa.style.height = 'auto';
      memoTa.style.height = memoTa.scrollHeight + 'px';
      if (!scroller) return;
      scroller.scrollTop = keep;
      if (document.activeElement !== memoTa) return;
      const sr = scroller.getBoundingClientRect();
      const lineBottom = memoTa.getBoundingClientRect().top + caretBottom();
      const margin = 24;
      if (lineBottom > sr.bottom - margin) scroller.scrollTop += lineBottom - (sr.bottom - margin);
      else if (lineBottom < sr.top + margin) scroller.scrollTop -= (sr.top + margin) - lineBottom;
    };
    memoTa.addEventListener('input', autosize);
    window.autosizeMemo = autosize;
    setTimeout(autosize, 100);
  }

  // Click anywhere in editor-area's empty space → focus the textarea (and move caret to end)
  const editorArea = document.getElementById('editor-area');
  if (editorArea) {
    editorArea.addEventListener('click', e => {
      const ta = document.getElementById('memo-content');
      if (!ta || getComputedStyle(ta).display === 'none') return;
      // Only react when the click landed on the editor-area itself (not on textarea / display / welcome)
      if (e.target === editorArea) {
        ta.focus();
        const len = ta.value.length;
        ta.setSelectionRange(len, len);
      }
    });
  }

  // 起動時の黒い覆いを外す（スタイル適用後の最初の描画を待ってからフェードアウト）
  // ロゴが見える最低限の時間（ページを開いてから0.7秒）は出したままにする
  const bootMinMs = 700;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    setTimeout(() => {
      const boot = document.getElementById('boot-screen');
      if (!boot) return;
      boot.classList.add('boot-done');
      setTimeout(() => boot.remove(), 300);
    }, Math.max(0, bootMinMs - performance.now()));
  }));

  // Long-press delete button (3 seconds)
  const delBtn = document.getElementById('delete-btn');
  if (delBtn) {
    let pressTimer = null;
    const start = (e) => {
      if (!currentMemoId) return;
      delBtn.classList.add('pressing');
      pressTimer = setTimeout(() => {
        delBtn.classList.remove('pressing');
        delBtn.classList.add('deleting');
        if (window.moveToTrash && currentMemoId) {
          window.moveToTrash(currentMemoId);
        }
        setTimeout(() => delBtn.classList.remove('deleting'), 300);
      }, 3000);
    };
    const cancel = () => {
      clearTimeout(pressTimer);
      delBtn.classList.remove('pressing');
    };
    delBtn.addEventListener('mousedown', start);
    delBtn.addEventListener('mouseup', cancel);
    delBtn.addEventListener('mouseleave', cancel);
    delBtn.addEventListener('touchstart', start, { passive: true });
    delBtn.addEventListener('touchend', cancel);
    delBtn.addEventListener('touchcancel', cancel);
    delBtn.addEventListener('click', e => e.preventDefault());
  }
}
