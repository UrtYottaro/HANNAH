// ── Matrix Rain Module ──────────────────────────────────────────────
// Converted from IIFE in _block3_settings.js
// Exports: startMatrixRain, stopMatrixRain

const rainCanvas = document.getElementById('matrix-rain-canvas');
const rctx = rainCanvas.getContext('2d');
let rW, rH;
let rainRunning = false;
let rainAnimId  = null;
let streams     = [];   // 全列のストリーム

const FONT_SIZE = 16;   // 1セルのピクセル高さ
let FONT_FACE = "'Share Tech Mono', monospace";

// メモからキーワード文字プールを取得
function buildCharPool() {
  const fallback = 'HANNAH記憶思考概念言語知識情報データ認証解析起動接続展開回路電脳仮想現実'.split('');
  try {
    const saved = localStorage.getItem('memoire_data');
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    const memoArr = Array.isArray(parsed) ? parsed : (parsed.memos || []);
    if (!memoArr.length) return fallback;
    const STOP = new Set(['の','に','は','を','が','で','て','と','も','へ','や','か','な','ね','よ','た','だ','し','れ','さ','ある','いる','する','なる','など','この','その','こと','もの','ため','とき']);
    let chars = [];
    memoArr.forEach(m => {
      const tokens = (m.title + ' ' + m.content)
        .split(/[\s、。！？「」【】（）\.\,\!\?\n\r・：；\/\\]+/);
      tokens.forEach(t => {
        if (t.length >= 1 && t.length <= 6 && !STOP.has(t)) {
          // 単語を1文字ずつ展開
          for (const c of t) chars.push(c);
        }
      });
    });
    chars = [...new Set(chars)];
    return chars.length >= 8 ? chars : fallback;
  } catch(e) { return fallback; }
}

// ストリーム：1列のMatrix Code
// 各セルは { char, alpha } の配列として管理
class Stream {
  constructor(col, rows, charPool) {
    this.col      = col;          // 列インデックス
    this.rows     = rows;         // 画面の行数
    this.charPool = charPool;
    this.cells    = [];           // 表示中のセル { char, brightness }
    this.maxLen   = 6 + Math.floor(Math.random() * 18);  // ストリーム長
    this.speed    = 1 + Math.floor(Math.random() * 2);   // フレームごとの更新速度
    this.frame    = 0;
    this.active   = false;
    this.waiting  = Math.floor(Math.random() * 80);      // 開始遅延
    this.done     = false;        // 画面外に消えたか
    this.exitRow  = 0;            // 末尾が通過した行
  }

  randChar() {
    return this.charPool[Math.floor(Math.random() * this.charPool.length)];
  }

  update() {
    this.frame++;

    // 開始遅延
    if (this.waiting > 0) { this.waiting--; return; }

    // speedフレームに1回だけ更新
    if (this.frame % this.speed !== 0) return;

    // ストリーム先頭が画面を超えたらリセット
    if (this.done) return;

    // 新しい文字を先頭（下方向）に追加
    if (this.cells.length < this.maxLen && this.exitRow < this.rows + this.maxLen) {
      this.cells.push({ char: this.randChar(), bright: 1.0 });
      this.exitRow++;
    }

    // 先頭文字をたまにランダム変化（チラつき）
    if (this.cells.length > 0 && Math.random() < 0.25) {
      this.cells[this.cells.length - 1].char = this.randChar();
    }

    // 末尾（上端）の文字を消す → 下に流れて見える効果
    if (this.cells.length >= this.maxLen) {
      this.cells.shift();
    }

    // 全部消えたらリスタート
    if (this.exitRow >= this.rows + this.maxLen && this.cells.length === 0) {
      this.exitRow  = 0;
      this.cells    = [];
      this.maxLen   = 6 + Math.floor(Math.random() * 18);
      this.speed    = 1 + Math.floor(Math.random() * 2);
      this.waiting  = 20 + Math.floor(Math.random() * 100);
    }
  }

  draw() {
    if (this.cells.length === 0) return;

    const x = this.col * FONT_SIZE;
    // exitRow = セル末尾（最下端）の行位置
    const tailRow = this.exitRow - 1;
    const headRow = tailRow - this.cells.length + 1;

    for (let i = 0; i < this.cells.length; i++) {
      const row = headRow + i;
      if (row < 0 || row >= this.rows) continue;
      const y = row * FONT_SIZE + FONT_SIZE;

      const isHead = (i === this.cells.length - 1); // 先頭（最も下）
      const ratio  = i / (this.cells.length - 1 || 1); // 0=上端(古い) 1=下端(先頭)

      rctx.save();
      rctx.font = `bold ${FONT_SIZE}px ${FONT_FACE}`;
      rctx.textAlign = 'center';

      if (isHead) {
        // 先頭文字: 白に近い輝く緑白
        rctx.fillStyle = '#e0ffe0';
        rctx.shadowColor = 'rgba(160,255,80,1)';
        rctx.shadowBlur  = 14;
        rctx.globalAlpha = 1.0;
      } else {
        // 残りのセル: サイバー黄緑、上に行くほど暗くフェード
        const brightness = 0.15 + ratio * 0.75;
        const g = Math.floor(160 + ratio * 95);
        const r = Math.floor(20  + ratio * 60);
        rctx.fillStyle   = `rgb(${r},${g},20)`;
        rctx.shadowColor = `rgba(80,200,40,${ratio * 0.5})`;
        rctx.shadowBlur  = ratio * 6;
        rctx.globalAlpha = brightness;
      }

      rctx.fillText(this.cells[i].char, x + FONT_SIZE / 2, y);
      rctx.restore();
    }
  }
}

function initRain() {
  rW = rainCanvas.width  = window.innerWidth;
  rH = rainCanvas.height = window.innerHeight;

  const charPool = buildCharPool();
  const cols     = Math.floor(rW / FONT_SIZE);
  const rows     = Math.floor(rH / FONT_SIZE);

  // 黒地でクリア
  rctx.fillStyle = '#000';
  rctx.fillRect(0, 0, rW, rH);

  streams = [];
  for (let c = 0; c < cols; c++) {
    streams.push(new Stream(c, rows, charPool));
  }
}

function renderRain() {
  if (!rainRunning) return;

  // 毎フレーム黒で完全クリア → 残像なし、文字がくっきり
  rctx.fillStyle = 'rgba(0,0,0,0.92)';
  rctx.fillRect(0, 0, rW, rH);

  streams.forEach(s => { s.update(); s.draw(); });

  rainAnimId = requestAnimationFrame(renderRain);
}

export function startMatrixRain(fontOverride) {
  if (fontOverride) FONT_FACE = fontOverride;
  initRain();
  rainRunning = true;
  rainCanvas.classList.add('visible');
  renderRain();
}

export function stopMatrixRain() {
  rainRunning = false;
  if (rainAnimId) cancelAnimationFrame(rainAnimId);
}

// Backward compatibility: also assign to window
window.startMatrixRain = startMatrixRain;
window.stopMatrixRain  = stopMatrixRain;

window.addEventListener('resize', () => {
  if (rainRunning) initRain();
});
