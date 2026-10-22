// ═══════════════════════════════════════════════════
//  HANNAH - Pure Utility Functions & Constants
// ═══════════════════════════════════════════════════

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function escapeHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Sanitize IDs for safe use in onclick="fn('${safeId(id)}')" attributes
// Strips anything that isn't alphanumeric, dash, or underscore
export function safeId(id) {
  return String(id || '').replace(/[^a-zA-Z0-9_\-]/g, '');
}

export const STOP_WORDS = new Set([
  // 助詞
  'の','に','は','を','が','で','て','と','も','へ','や','か','な','ね','よ','わ',
  'から','まで','より','にて','にも','には','でも','では','をも','への','での','との',
  'ので','のに','ては','ても','でも','けど','けれど','けれども',
  // 助動詞・語尾
  'た','だ','だが','です','ます','ない','ぬ','う','よう','らしい','そう','ようだ',
  'れる','られる','せる','させる','たい','たがる','てる','でる',
  // 接続語
  'そして','しかし','でも','また','あと','さらに','ただ','つまり','すなわち',
  'したがって','それで','だから','なぜなら','ところが','一方','なお','もしくは',
  'あるいは','または','ならびに','および','かつ','もし','たとえ','たとえば',
  // 指示語・代名詞
  'これ','それ','あれ','どれ','ここ','そこ','あそこ','どこ','こう','そう','ああ',
  'この','その','あの','どの','こんな','そんな','あんな','どんな',
  'わたし','私','僕','俺','あなた','彼','彼女','自分','みんな','皆',
  // 形式名詞・汎用語
  'こと','もの','ため','とき','ところ','ほう','ほど','くらい','ぐらい','だけ',
  'しか','さえ','でさえ','ばかり','のみ','ずつ','など','とか','なり',
  // よく使われる動詞・形容詞（内容語として弱いもの）
  'ある','いる','する','なる','できる','いう','思う','見る','くる','いく',
  'ない','ある','ない','よい','いい','悪い','多い','少ない','大きい','小さい',
  // 接頭・接尾語的なもの
  'お','ご','さん','くん','ちゃん','たち','ども','がた',
]);

export const FOLDER_COLORS = ['#58a6ff','#3fb950','#d29922','#f85149','#bc8cff','#79c0ff','#56d364','#ffa657'];

export function getFolderColor(idx) { return FOLDER_COLORS[idx % FOLDER_COLORS.length]; }

// ═══════════════════════════════════════════════════
//  メモ風UI用ヘルパー（タイトル・フォルダ絞り込み・日付）
// ═══════════════════════════════════════════════════

export const UNFILED_FILTER = '__unfiled__';   // 「メモ」＝どのフォルダにも属さないメモ
export const DEFAULT_MEMO_TITLE = '新規メモ';

// 本文の1行目（空行を除く）をタイトルとして返す
export function deriveTitle(content) {
  const line = (content || '').split('\n').find(l => l.trim() !== '');
  return line ? line.trim().slice(0, 200) : '';
}

// 一覧用プレビュー：タイトル行の次にある最初の非空行
export function derivePreview(content) {
  const lines = (content || '').split('\n');
  const first = lines.findIndex(l => l.trim() !== '');
  if (first < 0) return '';
  const next = lines.slice(first + 1).find(l => l.trim() !== '');
  return next ? next.trim().replace(/\s+/g, ' ').slice(0, 120) : '';
}

export function memoMatchesFilter(memo, filter, folders) {
  if (!filter || filter === 'all') return true;
  const inFolder = memo.folderId && folders.some(f => f.id === memo.folderId);
  if (filter === UNFILED_FILTER) return !inFolder;
  return memo.folderId === filter;
}

// 新規メモに割り当てるフォルダID（フォルダ以外の絞り込み中は未所属）
export function folderIdForFilter(filter) {
  return (filter && filter !== 'all' && filter !== UNFILED_FILTER) ? filter : undefined;
}

function toTime(iso) {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}
export { toTime };

const WEEKDAYS = ['日曜日','月曜日','火曜日','水曜日','木曜日','金曜日','土曜日'];
const pad2 = n => String(n).padStart(2, '0');

function dayDiff(date, now) {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((a - b) / 86400000);
}

// エディタ上部の日時：2026年10月3日 14:29
export function formatNoteDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${pad2(d.getMinutes())}`;
}

// 一覧の日時：今日=時刻 / 昨日 / 7日以内=曜日 / それ以前=YYYY/MM/DD
export function formatListDate(iso, now = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = dayDiff(d, now);
  if (diff <= 0) return `${d.getHours()}:${pad2(d.getMinutes())}`;
  if (diff === 1) return '昨日';
  if (diff <= 7) return WEEKDAYS[d.getDay()];
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
}

// 一覧のセクション：今日 / 昨日 / 過去7日間 / 過去30日間 / N月 / YYYY年
export function dateGroupOf(iso, now = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { key: 'unknown', label: '日付なし' };
  const diff = dayDiff(d, now);
  if (diff <= 0) return { key: 'today', label: '今日' };
  if (diff === 1) return { key: 'yesterday', label: '昨日' };
  if (diff <= 7) return { key: 'week', label: '過去7日間' };
  if (diff <= 30) return { key: 'month', label: '過去30日間' };
  if (d.getFullYear() === now.getFullYear()) return { key: `m${d.getMonth()}`, label: `${d.getMonth() + 1}月` };
  return { key: `y${d.getFullYear()}`, label: `${d.getFullYear()}年` };
}

// 本文からタイトル行（1行目）を除いたもの。書き出し・メールでタイトルが二重にならないように使う
export function bodyWithoutTitle(content) {
  const lines = (content || '').split('\n');
  const i = lines.findIndex(l => l.trim() !== '');
  if (i < 0) return '';
  return lines.slice(i + 1).join('\n').replace(/^\n+/, '');
}
