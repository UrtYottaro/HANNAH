// ═══════════════════════════════════════════════════
//  HANNAH - 小さなUI部品（トースト通知）
// ═══════════════════════════════════════════════════

let toastTimer = null;

export function showToast(message, ms = 2600) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  // 次の描画で表示（連続表示でもアニメーションが走るように）
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

window.showToast = showToast;
