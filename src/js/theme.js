// ═══════════════════════════════════════════════════
//  HANNAH - Color Theme（外観：テーマ・アクセント・背景・前景）
//  3色（アクセント／背景／前景）から、画面全体のCSS変数を導き出す。
//  プリセットは ~/Desktop/ColorTheme のスクリーンショットから書き起こした値。
// ═══════════════════════════════════════════════════

import { appSettings } from './state.js';

export const DEFAULT_THEME = { name: 'GitHub', accent: '#1f6feb', bg: '#0d1117', fg: '#e6edf3' };

// [名前, アクセント, 背景, 前景]
const PRESET_ROWS = [
  ['ChatGPT',     '#0169cc', '#111111', '#fcfcfc'],
  ['Absolutely',  '#cc7d5e', '#2d2d2b', '#f9f9f7'],
  ['Ayu',         '#e6b450', '#10141c', '#bfbdb6'],
  ['Catppuccin',  '#cba6f7', '#1e1e2e', '#cdd6f4'],
  ['Dracula',     '#ff79c6', '#282a36', '#f8f8f2'],
  ['Everforest',  '#a7c080', '#2d353b', '#d3c6aa'],
  ['GitHub',      '#1f6feb', '#0d1117', '#e6edf3'],
  ['Gruvbox',     '#458588', '#282828', '#ebdbb2'],
  ['Linear',      '#606acc', '#0f0f11', '#e3e4e6'],
  ['Lobster',     '#ff5c5c', '#111827', '#e4e4e7'],
  ['Material',    '#80cbc4', '#212121', '#eeffff'],
  ['Matrix',      '#1eff5a', '#040805', '#b8ffca'],
  ['Monokai',     '#99947c', '#272822', '#f8f8f2'],
  ['Night Owl',   '#44596b', '#011627', '#d6deeb'],
  ['Nord',        '#88c0d0', '#2e3440', '#d8dee9'],
  ['Notion',      '#3183d8', '#191919', '#d9d9d8'],
  ['OG',          '#10a37f', '#343541', '#d1d5db'],
  ['One',         '#4d78cc', '#282c34', '#abb2bf'],
  ['Oscurange',   '#f9b98c', '#0b0b0f', '#e6e6e6'],
  ['Raycast',     '#ff6363', '#101010', '#fefefe'],
  ['Rose Pine',   '#ea9a97', '#232136', '#e0def4'],
  ['Sentry',      '#7055f6', '#2d2935', '#e6dff9'],
  ['Solarized',   '#d30102', '#002b36', '#839496'],
  ['Temple',      '#e4f222', '#02120c', '#c7e6da'],
  ['Tokyo Night', '#3d59a1', '#1a1b26', '#a9b1d6'],
  ['Vercel',      '#006efe', '#000000', '#ededed'],
  ['VS Code Plus','#007acc', '#1e1e1e', '#d4d4d4'],
  ['Xcode',       '#5482ff', '#1f1f24', '#ffffff'],
];
export const THEMES = PRESET_ROWS.map(([name, accent, bg, fg]) => ({ name, accent, bg, fg }));

// ── 色の計算 ──
const HEX_RE = /^#[0-9a-f]{6}$/i;

export function normalizeHex(v) {
  let s = String(v || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map(c => c + c).join('');
  return /^[0-9a-f]{6}$/i.test(s) ? '#' + s.toLowerCase() : null;
}
const toRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const toHex = rgb => '#' + rgb.map(c => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const x = toRgb(a), y = toRgb(b); return toHex(x.map((c, i) => c + (y[i] - c) * t)); };
const luminance = hex => {
  const [r, g, b] = toRgb(hex).map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const l1 = luminance(a), l2 = luminance(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };

// from を to へ少しずつ寄せて、bg に対して min 以上のコントラストになる最初の色を返す
function readable(from, to, bg, min, start = 0) {
  for (let t = start; t <= 1.0001; t += 0.05) {
    const c = mix(from, to, t);
    if (contrast(c, bg) >= min) return c;
  }
  return to;
}

export function validTheme(t) {
  return !!t && HEX_RE.test(t.accent || '') && HEX_RE.test(t.bg || '') && HEX_RE.test(t.fg || '');
}

export function currentTheme() {
  return validTheme(appSettings.theme) ? appSettings.theme : { ...DEFAULT_THEME };
}

// ── モード（ダーク／ライト／自動） ──
const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function resolvedMode() {
  const m = appSettings.themeMode;
  if (m === 'light' || m === 'dark') return m;
  return darkQuery && !darkQuery.matches ? 'light' : 'dark';   // 自動：OSの設定に合わせる
}

// ライトは、テーマの前景色から明るい背景を、背景色から暗い文字色を作る（アクセントはそのまま）
function effectiveColors(theme) {
  if (resolvedMode() === 'dark') return theme;
  return {
    accent: theme.accent,
    bg: mix(theme.fg, '#ffffff', 0.92),
    fg: mix(theme.bg, '#000000', 0.2),
  };
}

// 3色から全体の配色（CSS変数）を設定する
export function applyTheme(theme = currentTheme()) {
  const { accent, bg, fg } = effectiveColors(theme);
  const root = document.documentElement.style;
  const set = (k, v) => root.setProperty(k, v);
  const [fr, fgc, fb] = toRgb(fg), [ar, ag, ab] = toRgb(accent);

  set('color-scheme', resolvedMode());   // 音声プレーヤーなど、標準部品の明暗
  set('--bg', bg);
  set('--surface', mix(bg, fg, 0.045));
  set('--surface2', mix(bg, fg, 0.09));
  set('--border', mix(bg, fg, 0.17));
  set('--text', fg);
  set('--text-muted', readable(bg, fg, bg, 3.3, 0.5));
  set('--accent', accent);
  const accentText = readable(accent, fg, bg, 4.5);   // 文字・アイコン用（背景に埋もれない明るさ）
  set('--accent2', accentText);
  set('--accent3', accentText);
  set('--on-accent', luminance(accent) > 0.45 ? '#000000' : '#ffffff');  // アクセント面の上の文字色
  set('--glow', `rgba(${ar}, ${ag}, ${ab}, 0.16)`);
  set('--fg-rgb', `${fr}, ${fgc}, ${fb}`);              // 文字色の半透明（ホバー面など）用
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  // 次回の起動画面：背景色と、ロゴの色。ロゴは白。明るい背景（ライトモード）のときだけ、見えるように黒にする
  const bootLogo = contrast('#ffffff', bg) >= contrast('#000000', bg) ? '#ffffff' : '#000000';
  try {
    localStorage.setItem('hannah_boot_bg', bg);
    localStorage.setItem('hannah_boot_logo', bootLogo);
  } catch (e) {}
}

// ── 設定画面（外観タブ） ──
function matchPreset(t) {
  return THEMES.find(p => p.accent === t.accent && p.bg === t.bg && p.fg === t.fg);
}

function aaIcon(t) {
  return `<span class="theme-aa" style="background:${t.bg};color:${t.accent}">Aa</span>`;
}

function setTheme(t, name) {
  appSettings.theme = { name: name || matchPreset(t)?.name || 'カスタム', accent: t.accent, bg: t.bg, fg: t.fg };
  applyTheme(appSettings.theme);
  syncThemeUI();
  window.saveSettings();
}

export function syncThemeUI() {
  const t = currentTheme();
  document.querySelectorAll('.mode-thumb').forEach(b => {
    const on = b.dataset.mode === (appSettings.themeMode || 'dark');
    b.classList.toggle('selected', on);
    b.setAttribute('aria-pressed', String(on));
  });
  // サムネイルのアクセント色（線の色）を今のテーマに合わせる
  document.querySelectorAll('.mode-thumbs').forEach(el => el.style.setProperty('--mt-accent', t.accent));
  const name = matchPreset(t)?.name || 'カスタム';
  const btn = document.getElementById('themeDDBtn');
  if (btn) btn.innerHTML = `${aaIcon(t)}<span class="theme-dd-name">${name}</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
  [['Accent', t.accent], ['Bg', t.bg], ['Fg', t.fg]].forEach(([key, val]) => {
    const hex = document.getElementById(`theme${key}Hex`);
    const pick = document.getElementById(`theme${key}Picker`);
    const dot = document.getElementById(`theme${key}Dot`);
    if (hex && document.activeElement !== hex) hex.value = val.toUpperCase();
    if (pick) pick.value = val;
    if (dot) dot.style.background = val;
  });
  const list = document.getElementById('themeDDList');
  if (list) {
    const item = p => `<button type="button" class="theme-item${p.name === name ? ' selected' : ''}" onclick="selectTheme('${p.name}')">${aaIcon(p)}<span class="theme-item-name">${p.name}</span>${p.name === name ? '<span class="theme-item-check">✓</span>' : ''}</button>`;
    const [first, ...rest] = THEMES;
    list.innerHTML = item(first) + '<div class="theme-group-label">そのほかのテーマ</div>' + rest.map(item).join('');
  }
}

function selectTheme(name) {
  const p = THEMES.find(x => x.name === name);
  if (p) setTheme(p, p.name);
  closeThemeDropdown();
}

function toggleThemeDropdown(e) {
  e?.stopPropagation();
  const list = document.getElementById('themeDDList');
  if (!list) return;
  list.hidden = !list.hidden;
  if (!list.hidden) list.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
}
function closeThemeDropdown() {
  const list = document.getElementById('themeDDList');
  if (list) list.hidden = true;
}
document.addEventListener('click', e => {
  if (!e.target.closest?.('#themeDD')) closeThemeDropdown();
});

// 色の入力（'accent' | 'bg' | 'fg'）。16進数の手入力と、色の選択の両方から呼ぶ
function setThemeColor(key, value, { fromText = false } = {}) {
  const hex = normalizeHex(value);
  if (!hex) return;                       // 入力途中の値は無視（確定時に戻す）
  setTheme({ ...currentTheme(), [key]: hex });
  if (!fromText) syncThemeUI();
}
function commitThemeHex(key, el) {
  if (!normalizeHex(el.value)) syncThemeUI();    // 不正な値は元に戻す
  else setThemeColor(key, el.value);
  el.value = currentTheme()[key].toUpperCase();
}

function resetTheme() {
  appSettings.themeMode = 'dark';
  setTheme({ ...DEFAULT_THEME }, DEFAULT_THEME.name);
}

function setThemeMode(mode) {
  if (!['auto', 'light', 'dark'].includes(mode)) return;
  appSettings.themeMode = mode;
  applyTheme();
  syncThemeUI();
  window.saveSettings();
}
if (darkQuery) darkQuery.addEventListener?.('change', () => { if (appSettings.themeMode === 'auto') applyTheme(); });

// テーマをJSONでコピー／貼り付けて読み込み
async function copyTheme(btn) {
  const t = currentTheme();
  const json = JSON.stringify({ name: matchPreset(t)?.name || 'カスタム', accent: t.accent, bg: t.bg, fg: t.fg });
  try { await navigator.clipboard.writeText(json); } catch (e) { window.prompt('テーマのJSON（コピーしてください）', json); return; }
  if (btn) { const old = btn.title; btn.title = 'コピーしました'; btn.classList.add('done'); setTimeout(() => { btn.title = old; btn.classList.remove('done'); }, 1200); }
}
function importTheme() {
  const raw = window.prompt('テーマのJSONを貼り付けてください', '{"accent":"#1f6feb","bg":"#0d1117","fg":"#e6edf3"}');
  if (!raw) return;
  try {
    const o = JSON.parse(raw);
    const t = { accent: normalizeHex(o.accent), bg: normalizeHex(o.bg), fg: normalizeHex(o.fg) };
    if (!validTheme(t)) throw new Error('色の形式が正しくありません');
    setTheme(t);
  } catch (e) {
    window.alert('読み込めませんでした：' + e.message);
  }
}

function toggleAppearanceAdvanced() {
  const box = document.getElementById('apAdvanced');
  const btn = document.getElementById('apAdvToggle');
  if (!box) return;
  box.hidden = !box.hidden;
  btn?.classList.toggle('open', !box.hidden);
}

window.applyTheme = applyTheme;
window.syncThemeUI = syncThemeUI;
window.selectTheme = selectTheme;
window.toggleThemeDropdown = toggleThemeDropdown;
window.setThemeColor = setThemeColor;
window.commitThemeHex = commitThemeHex;
window.resetTheme = resetTheme;
window.setThemeMode = setThemeMode;
window.copyTheme = copyTheme;
window.importTheme = importTheme;
window.toggleAppearanceAdvanced = toggleAppearanceAdvanced;
