// ======= HANNAH — Main Entry Point =======
// Imports all CSS and JS modules, starts the app

// --- CSS ---
import './css/all.css';
import './css/notes.css';   // メモ風3ペインUI（all.css の後に読み込んで上書き）

// --- JS Modules (order matters for side effects) ---
// State must be first
import './js/state.js';
import './js/utils.js';
import './js/ui.js';
import './js/storage.js';

// Core features
import './js/memo-crud.js';
import './js/render.js';
import './js/word-analysis.js';
import './js/word-hover.js';
import './js/search.js';
import './js/connected.js';

// Settings & modes
import './js/theme.js';
import './js/settings.js';
import './js/typewriter.js';
import './js/export-import.js';

// Folder system
import './js/folders.js';
import './js/drag.js';
import './js/swipe.js';
import './js/memo-export.js';
import './js/recorder.js';
import './js/tasks.js';
import './js/trash.js';

// Font manager
import './js/font-manager.js';

// Visual effects (splash removed — saved to ~/Desktop/splash-screen/)

// UI helpers
import './js/mobile.js';
import './js/speech.js';
import './js/mail.js';

// Init — must be last
import { initApp } from './js/init.js';

document.addEventListener('DOMContentLoaded', initApp);
