// HANNAH デスクトップ版（Electron）。画面そのものは dist/ のウェブアプリをそのまま表示する。
// ブラウザ版と同じ localStorage / IndexedDB を使うため、専用の app:// で配信して保存先の出所を固定する。
import { app, BrowserWindow, protocol, net, session, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(here, '..', 'dist');
const ORIGIN = 'app://hannah';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// 二重起動を避ける（保存データの取り合いを防ぐ）
if (!app.requestSingleInstanceLock()) app.quit();

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 360,
    minHeight: 480,
    backgroundColor: '#0d1117',
    title: 'HANNAH',
    icon: path.join(here, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadURL(`${ORIGIN}/index.html`);

  // 外部サイトへのリンクは、アプリ内ではなく既定のブラウザで開く
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGIN)) { e.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); }
  });
  win.on('closed', () => { win = null; });
}

app.whenReady().then(() => {
  // dist/ の中身だけを返す（../ で外へ出られないようにする）
  protocol.handle('app', req => {
    const { pathname } = new URL(req.url);
    const rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
    const file = path.normalize(path.join(distDir, rel));
    if (!file.startsWith(distDir + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });

  // マイク（録音用）は自分の画面にだけ許可する
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => {
    cb(permission === 'media' && wc.getURL().startsWith(ORIGIN));
  });

  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
