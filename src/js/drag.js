// ═══════════════════════════════════════════════════════
//  DRAG INITIATION — drag.js
//  長押し → 掴む → フォルダピッカー表示
// ═══════════════════════════════════════════════════════
import { memos } from './state.js';
import { _dragState, set_dragState } from './state.js';

// ── document-level mousemove/mouseup listeners（1回だけ登録） ──
document.addEventListener('mousemove', e => {
  if (!_dragState) return;
  const ds = _dragState;
  if (ds.ghost) {
    ds.ghost.style.left = (e.clientX - 20) + 'px';
    ds.ghost.style.top  = (e.clientY - 20) + 'px';
  }
  if (!ds.isDragging && (Math.abs(e.clientX - ds.startX) > 6 || Math.abs(e.clientY - ds.startY) > 6)) {
    clearTimeout(ds.pressTimer);
  }
});
document.addEventListener('mouseup', e => {
  if (_dragState && _dragState.isDragging) {
    _dragState.endPress(e.clientX, e.clientY);
  }
});

function initMemoDrag(card, memoId) {
  let pressTimer = null;
  let isDragging = false;
  let ghost = null;
  let startX = 0, startY = 0;

  function endPress(cx, cy) {
    clearTimeout(pressTimer);
    if (isDragging) {
      isDragging = false;
      if (ghost) { ghost.remove(); ghost = null; }
      card.classList.remove('dragging');
      window.showFolderPicker(memoId);
    }
    if (_dragState === state) set_dragState(null);
  }

  const state = { get isDragging() { return isDragging; }, get ghost() { return ghost; }, get startX() { return startX; }, get startY() { return startY; }, get pressTimer() { return pressTimer; }, endPress };

  function startPress(cx, cy) {
    startX = cx; startY = cy;
    pressTimer = setTimeout(() => {
      isDragging = true;
      card.classList.add('dragging');
      ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      const memo = memos.find(m => m.id === memoId);
      ghost.textContent = '📝 ' + (memo ? memo.title : 'メモ');
      ghost.style.left = (cx - 20) + 'px';
      ghost.style.top  = (cy - 20) + 'px';
      document.body.appendChild(ghost);
    }, 450);
    set_dragState(state);
  }

  function cancelPress() {
    clearTimeout(pressTimer);
    if (ghost) { ghost.remove(); ghost = null; }
    isDragging = false;
    card.classList.remove('dragging');
    if (_dragState === state) set_dragState(null);
  }

  // ── マウスイベント（card にのみ登録） ──
  card.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    startPress(e.clientX, e.clientY);
  });
  card.addEventListener('mouseup', e => {
    if (!isDragging) clearTimeout(pressTimer);
  });
  card.addEventListener('mouseleave', () => {
    if (!isDragging) clearTimeout(pressTimer);
  });

  // ── タッチイベント ──
  card.addEventListener('touchstart', e => {
    const t = e.touches[0];
    startPress(t.clientX, t.clientY);
  }, { passive: true });
  card.addEventListener('touchmove', e => {
    const t = e.touches[0];
    if (isDragging && ghost) {
      e.preventDefault();
      ghost.style.left = (t.clientX - 20) + 'px';
      ghost.style.top  = (t.clientY - 20) + 'px';
    }
    if (!isDragging && (Math.abs(t.clientX - startX) > 8 || Math.abs(t.clientY - startY) > 8)) {
      clearTimeout(pressTimer);
    }
  }, { passive: false });
  card.addEventListener('touchend', e => {
    const t = e.changedTouches[0];
    endPress(t.clientX, t.clientY);
  });
  card.addEventListener('touchcancel', cancelPress);

  // クリック（短押し）は openMemo はそのまま動く
  // mousedown → mouseup が短い場合は pressTimer が未発火なので isDragging=false のまま
}

// ═══════════════════════════════════════════════════
//  EXPORTS & WINDOW ASSIGNMENTS
// ═══════════════════════════════════════════════════
export { initMemoDrag };

window.initMemoDrag = initMemoDrag;
