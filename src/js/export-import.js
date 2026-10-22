// ── export-import.js ─────────────────────────────────────
import { memos, setMemos, folders, setFolders, tasks, setTasks, trashMemos, setTrashMemos, appSettings, setAppSettings } from './state.js';
import { saveData, loadData } from './storage.js';
import { escapeHtml, generateId, bodyWithoutTitle } from './utils.js';
import { DEFAULT_THEME, validTheme } from './theme.js';

// ── フォントデータを除去した配布用HTMLエクスポート ──
export function exportAppWithoutFonts() {
  if (!confirm('フォントデータを除去した配布用HTMLを生成します。\n受け取った側はシステムフォントで表示されます。\n\n続けますか？')) return;

  // 現在のHTMLを文字列として取得
  let html = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;

  // 1. base64埋め込みフォント（@font-face src: url("data:font/...") ）を除去
  html = html.replace(/@font-face\s*\{[^}]*src:\s*url\(['"]data:[^'"]+['"]\)[^}]*\}/gs, '');

  // 2. フォントマネージャーで読み込まれたカスタムフォントのstyleタグを除去
  //    （id="fm-style-..." または data-fm="true" のstyleタグ）
  html = html.replace(/<style[^>]*data-fm="true"[^>]*>[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<style[^>]*id="fm-style-[^"]*"[^>]*>[\s\S]*?<\/style>/gi, '');

  // 3. localStorageのフォント情報は実行時データなので除去不要
  //    （別PCで開いた時は自動で読み込まれない）

  const filename = `HANNAH_dist_${new Date().toISOString().slice(0,10)}.html`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);

  // 完了通知
  setTimeout(() => alert(`「${filename}」を生成しました。\nフォントデータは含まれていません。`), 300);
}

export function exportData() {
  const data = { memos, folders, tasks, trash: trashMemos, settings: appSettings, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `libra_export_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── フォルダをMarkdownファイルとして書き出し ──
export function exportFolderAsMarkdown(folderId) {
  const folder = folders.find(f => f.id === folderId);
  if (!folder) return;
  const folderMemos = memos.filter(m => m.folderId === folderId);
  if (folderMemos.length === 0) {
    alert(`「${folder.name}」にはメモがありません。`);
    return;
  }

  let md = `# ${folder.name}\n\n`;
  md += `> エクスポート日時: ${new Date().toLocaleString('ja-JP')}\n`;
  md += `> メモ数: ${folderMemos.length}件\n\n`;
  md += `---\n\n`;

  folderMemos.forEach((memo, i) => {
    const date = new Date(memo.updatedAt).toLocaleString('ja-JP');
    md += `## ${i + 1}. ${memo.title || '(無題)'}\n\n`;
    md += `*更新: ${date}*\n\n`;
    if (memo.tags && memo.tags.length > 0) {
      md += `タグ: ${memo.tags.map(t => `\`${t}\``).join(' ')}\n\n`;
    }
    md += `${bodyWithoutTitle(memo.content)}\n\n`;
    if (i < folderMemos.length - 1) md += `---\n\n`;
  });

  const filename = `${folder.name.replace(/[\/:*?"<>|]/g, '_')}.md`;
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── フォルダをJSONとして書き出し（バックアップ・移行用） ──
export function exportFolderAsJSON(folderId) {
  const folder = folders.find(f => f.id === folderId);
  if (!folder) return;
  const folderMemos = memos.filter(m => m.folderId === folderId);
  if (folderMemos.length === 0) {
    alert(`「${folder.name}」にはメモがありません。`);
    return;
  }
  const payload = {
    exportedAt: new Date().toISOString(),
    folder: { id: folder.id, name: folder.name },
    memoCount: folderMemos.length,
    memos: folderMemos
  };
  const filename = `${folder.name.replace(/[\/:*?"<>|]/g, '_')}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── フォルダをプレーンテキスト（.txt）として書き出し ──
export function exportFolderAsTXT(folderId) {
  const folder = folders.find(f => f.id === folderId);
  if (!folder) return;
  const folderMemos = memos.filter(m => m.folderId === folderId);
  if (folderMemos.length === 0) {
    alert(`「${folder.name}」にはメモがありません。`);
    return;
  }
  let txt = `${folder.name}\n`;
  txt += `エクスポート日時: ${new Date().toLocaleString('ja-JP')}\n`;
  txt += `メモ数: ${folderMemos.length}件\n`;
  txt += `${'='.repeat(40)}\n\n`;
  folderMemos.forEach((memo, i) => {
    const date = new Date(memo.updatedAt).toLocaleString('ja-JP');
    txt += `[${i + 1}] ${memo.title || '(無題)'}\n`;
    txt += `更新: ${date}\n`;
    if (memo.tags && memo.tags.length > 0) {
      txt += `タグ: ${memo.tags.join(', ')}\n`;
    }
    txt += `\n${bodyWithoutTitle(memo.content)}\n`;
    if (i < folderMemos.length - 1) txt += `\n${'-'.repeat(40)}\n\n`;
  });
  const filename = `${folder.name.replace(/[\/:*?"<>|]/g, '_')}.txt`;
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── すべてのフォルダを一括でZipライクなHTMLとして書き出し ──
export function exportAllFoldersAsHTML() {
  let html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>HANNAH エクスポート</title>
<style>
  body { font-family: 'Hiragino Kaku Gothic ProN', sans-serif; max-width: 900px; margin: 0 auto; padding: 24px; background: #0d1117; color: #e6edf3; }
  h1 { color: #58a6ff; border-bottom: 2px solid #58a6ff; padding-bottom: 8px; }
  h2 { color: #58a6ff; margin-top: 40px; border-left: 4px solid #58a6ff; padding-left: 12px; }
  h3 { color: #8b949e; }
  .meta { color: #888; font-size: 12px; margin-bottom: 16px; }
  .memo { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 16px; margin: 12px 0; }
  .memo-title { color: #e6edf3; font-size: 16px; font-weight: bold; margin-bottom: 6px; }
  .memo-content { white-space: pre-wrap; color: #aaa; font-size: 13px; line-height: 1.7; }
  .tag { background: #1c2128; border: 1px solid #58a6ff44; color: #58a6ff; padding: 2px 8px; border-radius: 10px; font-size: 11px; margin-right: 4px; }
  .folder-section { border: 1px solid #333; border-radius: 8px; padding: 20px; margin: 24px 0; }
  .no-folder { opacity: .6; }
  hr { border: none; border-top: 1px solid #333; margin: 20px 0; }
</style>
</head>
<body>
<h1>📂 HANNAH メモエクスポート</h1>
<p class="meta">エクスポート日時: ${new Date().toLocaleString('ja-JP')} ／ 総メモ数: ${memos.length}件</p>
<hr>
`;

  // フォルダ別
  folders.forEach(folder => {
    const fMemos = memos.filter(m => m.folderId === folder.id);
    html += `<div class="folder-section">
<h2>📁 ${escapeHtml(folder.name)} <span style="font-size:13px;opacity:.6;">(${fMemos.length}件)</span></h2>`;
    fMemos.forEach(memo => {
      const date = new Date(memo.updatedAt).toLocaleString('ja-JP');
      const tags = (memo.tags||[]).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
      html += `<div class="memo">
  <div class="memo-title">${escapeHtml(memo.title||'(無題)')}</div>
  <div class="meta">${date} ${tags}</div>
  <div class="memo-content">${escapeHtml(bodyWithoutTitle(memo.content))}</div>
</div>`;
    });
    html += `</div>`;
  });

  // フォルダなし
  const noFolder = memos.filter(m => !m.folderId || !folders.find(f => f.id === m.folderId));
  if (noFolder.length > 0) {
    html += `<div class="folder-section no-folder">
<h2>📝 フォルダなし <span style="font-size:13px;opacity:.6;">(${noFolder.length}件)</span></h2>`;
    noFolder.forEach(memo => {
      const date = new Date(memo.updatedAt).toLocaleString('ja-JP');
      html += `<div class="memo">
  <div class="memo-title">${escapeHtml(memo.title||'(無題)')}</div>
  <div class="meta">${date}</div>
  <div class="memo-content">${escapeHtml(bodyWithoutTitle(memo.content))}</div>
</div>`;
    });
    html += `</div>`;
  }
  html += `
<!-- ══ メール作成モーダル ══ -->
<div class="mail-overlay" id="mail-overlay" style="display:none;" onclick="closeMailCompose(event)">
  <div class="mail-modal" id="mail-modal">
    <div class="mail-header">
      <span>✉ メールで送信</span>
      <button onclick="closeMailCompose(null, true)">✕</button>
    </div>

    <div class="mail-field-row">
      <label>宛先</label>
      <input type="email" id="mail-to" placeholder="example@email.com" multiple>
    </div>
    <div class="mail-field-row">
      <label>CC</label>
      <input type="email" id="mail-cc" placeholder="（任意）">
    </div>
    <div class="mail-field-row">
      <label>件名</label>
      <input type="text" id="mail-subject" placeholder="件名">
    </div>

    <div class="mail-format-row">
      <span class="mail-format-label">本文フォーマット</span>
      <div class="mail-format-tabs">
        <button class="mail-fmt-tab active" id="fmt-plain" onclick="setMailFormat('plain')">プレーン</button>
        <button class="mail-fmt-tab" id="fmt-formal" onclick="setMailFormat('formal')">ビジネス</button>
        <button class="mail-fmt-tab" id="fmt-casual" onclick="setMailFormat('casual')">カジュアル</button>
      </div>
    </div>

    <div class="mail-field-col">
      <label>本文 <span style="opacity:.5;font-size:9px;">（編集できます）</span></label>
      <textarea id="mail-body" rows="10" placeholder="本文"></textarea>
    </div>

    <div class="mail-preview-note" id="mail-preview-note"></div>

    <div class="mail-actions">
      <button class="mail-cancel-btn" onclick="closeMailCompose(null, true)">キャンセル</button>
      <button class="mail-send-btn" onclick="sendViaMailto()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        メールアプリで開く
      </button>
    </div>
  </div>
</div>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `HANNAH_export_${new Date().toISOString().slice(0,10)}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Sanitize imported memo to ensure safe field types
function validDate(v) {
  return (typeof v === 'number' || typeof v === 'string') && !Number.isNaN(new Date(v).getTime());
}

function sanitizeMemo(m) {
  if (!m || typeof m !== 'object') return null;
  const created = validDate(m.createdAt) ? m.createdAt : new Date().toISOString();
  return {
    id: String(m.id || '').replace(/[^a-zA-Z0-9_\-]/g, '') || generateId(),
    title: String(m.title || '').slice(0, 500),
    content: String(m.content || '').slice(0, 100000),
    tags: Array.isArray(m.tags) ? m.tags.filter(t => typeof t === 'string').map(t => t.slice(0, 50)) : [],
    pinned: m.pinned === true,
    folderId: m.folderId ? String(m.folderId).replace(/[^a-zA-Z0-9_\-]/g, '') : null,
    createdAt: created,
    updatedAt: validDate(m.updatedAt) ? m.updatedAt : created,
  };
}

function sanitizeFolder(f) {
  if (!f || typeof f !== 'object') return null;
  return {
    id: String(f.id || '').replace(/[^a-zA-Z0-9_\-]/g, '') || generateId(),
    name: String(f.name || '').slice(0, 100),
    color: /^#[0-9a-fA-F]{3,8}$/.test(f.color) ? f.color : '#58a6ff',
  };
}

export function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data || typeof data !== 'object') throw new Error('無効なデータ形式');
      let added = 0;
      if (data.memos && Array.isArray(data.memos)) {
        const existingIds = new Set(memos.map(m => m.id));
        const incoming = data.memos.map(sanitizeMemo).filter(Boolean);
        incoming.forEach(m => {
          if (!existingIds.has(m.id)) {
            memos.push(m);
            added++;
          }
        });
      }
      if (data.folders && Array.isArray(data.folders)) {
        const existingIds = new Set(folders.map(f => f.id));
        const incoming = data.folders.map(sanitizeFolder).filter(Boolean);
        incoming.forEach(f => {
          if (!existingIds.has(f.id)) folders.push(f);
        });
      }
      if (data.tasks && Array.isArray(data.tasks)) {
        const existingIds = new Set(tasks.map(t => t.id));
        data.tasks.forEach(t => {
          if (t && !existingIds.has(t.id)) tasks.push(t);
        });
      }
      if (data.trash && Array.isArray(data.trash)) {
        const existingIds = new Set(trashMemos.map(m => m.id));
        const incoming = data.trash.map(sanitizeMemo).filter(Boolean);
        incoming.forEach(m => {
          if (!existingIds.has(m.id)) trashMemos.push(m);
        });
      }
      window.migrateMemoTitles();
      saveData(); window.renderMemoList(); window.renderTaskList(); window.renderTrash(); window.updateWordRanking(); window.updateStats(); window.updateNetwork(); window.renderFolderDock();
      if (data.settings && typeof data.settings === 'object') {
        const allowed = ['theme','themeMode','contentWidth','editorFontSize','lineHeight','focusMode','saveMode','particles','sidebarWidth','previewLines','typewriterMode','typewriterPos','rankingLimit'];
        const safe = {};
        allowed.forEach(k => { if (k in data.settings) safe[k] = data.settings[k]; });
        if ('theme' in safe && !validTheme(safe.theme)) delete safe.theme;
        if ('themeMode' in safe && !['auto', 'light', 'dark'].includes(safe.themeMode)) delete safe.themeMode;   // 不正な色は取り込まない
        setAppSettings({ ...appSettings, ...safe });
        window.applyAllSettings(); window.syncSettingsUI(); window.saveSettings();
      }
      alert(`インポート完了：${added}件の新しいメモを追加しました（既存データは保持）。`);
    } catch(err) { alert('読み込みに失敗しました：' + err.message); }
  };
  reader.readAsText(file);
}

// ── ファイル読み込み（TXT / SRT / JSON → メモ化） ──

function parseSRT(text) {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\n+/)
    .map(block => {
      const lines = block.trim().split('\n');
      // SRT block: index, timestamp, text lines
      if (lines.length >= 3 && /^\d+$/.test(lines[0]) && /-->/.test(lines[1])) {
        return lines.slice(2).join('\n');
      }
      // Bare text block (no index line)
      if (lines.length >= 2 && /-->/.test(lines[0])) {
        return lines.slice(1).join('\n');
      }
      return null;
    })
    .filter(Boolean)
    .join('\n');
}

export function importFileAsMemo(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  let imported = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = ev => {
      const raw = ev.target.result;
      const ext = file.name.split('.').pop().toLowerCase();

      let content = '';
      if (ext === 'srt') {
        content = parseSRT(raw);
      } else if (ext === 'json') {
        try {
          content = JSON.stringify(JSON.parse(raw), null, 2);
        } catch { content = raw; }
      } else {
        content = raw;
      }

      const title = file.name.replace(/\.[^.]+$/, '') || '';
      const memo = {
        id: generateId(),
        title,
        content,
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        folderId: undefined
      };
      memos.unshift(memo);
      imported++;

      if (imported === files.length) {
        window.migrateMemoTitles();
        saveData();
        window.renderMemoList();
        window.renderFolderDock();
        window.updateWordRanking();
        window.updateStats();
        window.updateNetwork();
        alert(`${imported}件のファイルをメモとして読み込みました。`);
      }
    };
    reader.readAsText(file);
  });
  e.target.value = '';
}

// --- Reset ---
export function resetAllSettings() {
  if (!confirm('設定をすべてリセットしますか？')) return;
  setAppSettings({ theme:{ ...DEFAULT_THEME }, themeMode:'dark', contentWidth:'800px', editorFontSize:15, lineHeight:2, focusMode:false, saveMode:'realtime', particles:true, sidebarWidth:'320px', previewLines:2, typewriterMode:false, typewriterPos:50, rankingLimit:15 });
  window.saveSettings();
  window.applyAllSettings();
  window.syncSettingsUI();
}

// ── window に公開 ──
window.exportAppWithoutFonts = exportAppWithoutFonts;
window.exportData            = exportData;
window.exportFolderAsMarkdown = exportFolderAsMarkdown;
window.exportFolderAsJSON    = exportFolderAsJSON;
window.exportFolderAsTXT     = exportFolderAsTXT;

// 設定画面からフォルダを選んでエクスポート
export function exportSelectedFolder(format) {
  const sel = document.getElementById('folderExportSelect');
  if (!sel) return;
  const fid = sel.value;
  if (!fid) { alert('フォルダを選択してください'); return; }
  if (format === 'md')   exportFolderAsMarkdown(fid);
  else if (format === 'json') exportFolderAsJSON(fid);
  else if (format === 'txt')  exportFolderAsTXT(fid);
}
window.exportSelectedFolder = exportSelectedFolder;

// ドロップダウンの再構築
export function rebuildFolderExportSelect() {
  const sel = document.getElementById('folderExportSelect');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = folders.length === 0
    ? '<option value="">フォルダなし</option>'
    : folders.map(f => {
        const cnt = memos.filter(m => m.folderId === f.id).length;
        const safeName = (f.name || '').replace(/</g, '&lt;');
        return `<option value="${f.id}">${safeName} (${cnt})</option>`;
      }).join('');
  if (prev && folders.find(f => f.id === prev)) sel.value = prev;
}
window.rebuildFolderExportSelect = rebuildFolderExportSelect;
window.exportAllFoldersAsHTML = exportAllFoldersAsHTML;
window.importData            = importData;
window.importFileAsMemo      = importFileAsMemo;
window.resetAllSettings      = resetAllSettings;
