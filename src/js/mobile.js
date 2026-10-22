// ═══════════════════════════════════════════════════
//  MOBILE VIEW CONTROLLER (モバイル表示) MODULE
//  メモ標準アプリと同じ3階層：フォルダ → メモ一覧 → エディタ
// ═══════════════════════════════════════════════════
import { setMobileCurrentView } from './state.js';

export function isMobile() {
  return window.innerWidth <= 600;
}

// view: 'folders' | 'list' | 'editor'
export function mobileShowView(view) {
  if (!isMobile()) return;
  setMobileCurrentView(view);
  const app = document.getElementById('main-app');
  if (!app) return;

  app.classList.remove('mobile-view-folders', 'mobile-view-editor');
  if (view === 'folders') app.classList.add('mobile-view-folders');
  else if (view === 'editor') app.classList.add('mobile-view-editor');
}

// --- window assigns ---
window.isMobile = isMobile;
window.mobileShowView = mobileShowView;
