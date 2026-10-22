// ── Splash Screen Module ────────────────────────────────────────────
// Converted from IIFE in _block3_settings.js
// Imports startMatrixRain from matrix-rain module
// Exports: initSplash (the main entry point)

import { startMatrixRain } from './matrix-rain.js';

// ── IndexedDBからフォント設定を先読みする ──────────────────
function getSplashFont(cb) {
  try {
    const req = indexedDB.open('hannah_fonts', 1);
    req.onerror = () => cb(null);
    req.onsuccess = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('meta')) { db.close(); cb(null); return; }
      const tx  = db.transaction('meta', 'readonly');
      const st  = tx.objectStore('meta');
      const get = st.get('applied');
      get.onsuccess = () => {
        db.close();
        const applied = get.result ? get.result.value : null;
        // body / display / title / mono の優先順で最初に見つかったファミリを使う
        if (applied) {
          const f = applied.body || applied.display || applied.title || applied.mono || null;
          cb(f);
        } else { cb(null); }
      };
      get.onerror = () => { db.close(); cb(null); };
    };
  } catch(e) { cb(null); }
}

// ── 共通変数 ────────────────────────────────────────────────
const splash    = document.getElementById('splash-screen');
const logoWrap  = document.getElementById('splash-logo-wrap');
const titleEl   = document.getElementById('splash-title');
const subEl     = document.getElementById('splash-sub');
const authEl    = document.getElementById('splash-auth');
const authStat  = document.getElementById('auth-status');
const authWelc  = document.getElementById('auth-welcome');
const circWrap  = document.getElementById('splash-circle-wrap');
const circProg  = document.getElementById('circle-prog');
const circPct   = document.getElementById('circle-pct');
const letters   = document.querySelectorAll('.glitch-letter');

const CIRCUMFERENCE = 326.7;   // 2π×52

let splashDone = false;

// ── パーティクル canvas ──────────────────────────────────────
const canvas = document.getElementById('splash-canvas');
const ctx    = canvas.getContext('2d');
let W, H, particles = [], shapes = [], animId;

function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
resize();
window.addEventListener('resize', resize);

class GeoParticle {
  constructor() { this.reset(true); }
  reset(init) {
    this.x = Math.random()*W; this.y = init ? Math.random()*H : H+20;
    this.vx = (Math.random()-.5)*.6; this.vy = -(0.3+Math.random()*.7);
    this.size = 4+Math.random()*16; this.alpha = 0;
    this.maxAlpha = .15+Math.random()*.35; this.fadeIn = true;
    this.rot = Math.random()*Math.PI*2; this.rotV = (Math.random()-.5)*.02;
    this.type = ['tri','rect','hex','line','ring'][Math.floor(Math.random()*5)];
    this.color = ['#c8a96e','#7b68ee','#4ecdc4','#e8e4d9','#a0ff50'][Math.floor(Math.random()*5)];
    this.life = 0; this.maxLife = 180+Math.random()*240;
  }
  draw() {
    ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.rot);
    ctx.strokeStyle = this.color; ctx.globalAlpha = this.alpha; ctx.lineWidth = 1;
    const s = this.size;
    if (this.type==='tri') { ctx.beginPath(); ctx.moveTo(0,-s); ctx.lineTo(s*.866,s*.5); ctx.lineTo(-s*.866,s*.5); ctx.closePath(); ctx.stroke(); }
    else if (this.type==='rect') { ctx.strokeRect(-s/2,-s/2,s,s); }
    else if (this.type==='hex') { ctx.beginPath(); for(let i=0;i<6;i++){const a=(Math.PI/3)*i-Math.PI/6; i===0?ctx.moveTo(Math.cos(a)*s,Math.sin(a)*s):ctx.lineTo(Math.cos(a)*s,Math.sin(a)*s);} ctx.closePath(); ctx.stroke(); }
    else if (this.type==='line') { ctx.beginPath(); ctx.moveTo(-s,0); ctx.lineTo(s,0); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(0,0,s*.5,0,Math.PI*2); ctx.stroke(); }
    ctx.restore();
  }
  update() {
    this.life++; this.x+=this.vx; this.y+=this.vy; this.rot+=this.rotV;
    if (this.alpha<this.maxAlpha) this.alpha = Math.min(this.maxAlpha, this.alpha+.01);
    if (this.life>this.maxLife*.7) this.alpha = Math.max(0, this.alpha-.008);
    if (this.life>this.maxLife||this.y<-30) this.reset(false);
  }
}
class GridLine {
  constructor() { this.reset(); }
  reset() { this.prog=Math.random(); this.angle=Math.random()*Math.PI*2; this.speed=.002+Math.random()*.004; this.alpha=0; this.len=60+Math.random()*120; this.color=Math.random()>.5?'#c8a96e':'#4ecdc4'; }
  draw() {
    const cx=W/2,cy=H/2,r=this.prog*Math.max(W,H)*.8;
    const x=cx+Math.cos(this.angle)*r, y=cy+Math.sin(this.angle)*r;
    ctx.save(); ctx.strokeStyle=this.color; ctx.globalAlpha=this.alpha*(1-this.prog); ctx.lineWidth=.8;
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+Math.cos(this.angle)*this.len*this.prog, y+Math.sin(this.angle)*this.len*this.prog); ctx.stroke(); ctx.restore();
  }
  update() { this.prog+=this.speed; this.alpha=Math.min(.5,this.alpha+.02); if(this.prog>1) this.reset(); }
}
for(let i=0;i<60;i++) particles.push(new GeoParticle());
for(let i=0;i<20;i++) shapes.push(new GridLine());

function renderGeo() {
  if (splashDone) return;
  ctx.clearRect(0,0,W,H);
  const grd=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.min(W,H)*.5);
  grd.addColorStop(0,'rgba(200,169,110,0.06)'); grd.addColorStop(1,'transparent');
  ctx.fillStyle=grd; ctx.fillRect(0,0,W,H);
  shapes.forEach(s=>{s.update();s.draw()});
  particles.forEach(p=>{p.update();p.draw()});
  animId = requestAnimationFrame(renderGeo);
}
renderGeo();

// ── グリッチ ─────────────────────────────────────────────────
function glitchLetter(el, dur) { el.classList.add('glitching'); setTimeout(()=>el.classList.remove('glitching'), dur); }
function randomGlitchWave(times, interval, cb) {
  let count=0;
  function wave() {
    [...letters].sort(()=>Math.random()-.5).slice(0,1+Math.floor(Math.random()*3))
      .forEach(l=>glitchLetter(l,120+Math.random()*180));
    count++;
    if (count<times) setTimeout(wave, interval+Math.random()*200);
    else if (cb) setTimeout(cb, 200);
  }
  wave();
}

// ── 円形プログレス更新 ────────────────────────────────────────
function setCircleProgress(pct) {
  const offset = CIRCUMFERENCE * (1 - pct/100);
  circProg.style.strokeDashoffset = offset;
  circPct.textContent = Math.round(pct) + '%';
}

// アニメーションで pct を target まで移動
function animCircle(target, duration, cb) {
  const start = performance.now();
  const from  = parseFloat(circPct.textContent) || 0;
  function step(now) {
    const t = Math.min(1, (now-start)/duration);
    const ease = t<.5 ? 2*t*t : -1+(4-2*t)*t;
    setCircleProgress(from + (target-from)*ease);
    if (t<1) requestAnimationFrame(step);
    else if (cb) cb();
  }
  requestAnimationFrame(step);
}

// ── 認証メッセージ一覧 ────────────────────────────────────────
// メッセージは時間軸で切り替え（進捗とは独立）
const MSGS = [
  { text: 'INITIALIZING SYSTEM...',    at: 0    },
  { text: 'LOADING NEURAL CORE...',    at: 400  },
  { text: 'VERIFYING MEMORY CELLS...', at: 850  },
  { text: 'BUILDING KNOWLEDGE MAP...',  at: 1300 },
  { text: 'AUTHENTICATION OK',         at: 1700 },
  { text: 'ACCESS GRANTED',            at: 1950 },
];
const PROGRESS_DURATION = 2000; // 2秒で0→100%

// ── メインシーケンス（フォント取得後に開始）────────────────────
export function initSplash() {
  getSplashFont(function(detectedFont) {
    // フォント CSS ファミリ文字列を確定
    const splashFont = detectedFont
      ? `'${detectedFont}', 'Share Tech Mono', monospace`
      : "'Share Tech Mono', monospace";

    // CSS カスタムプロパティとしてスプラッシュ全体に適用
    splash.style.setProperty('--splash-font', splashFont);

    // タイトル・サブ・ステータスのフォントを直接適用
    titleEl.style.fontFamily  = splashFont;
    subEl.style.fontFamily    = splashFont;
    authStat.style.fontFamily = splashFont;
    authWelc.style.fontFamily = splashFont;
    circPct.style.fontFamily  = splashFont;

    // Matrix Rain にも伝達
    window._splashFont = splashFont;

    // ── シーケンス開始 ─────────────────────────────
    setTimeout(() => {
      titleEl.classList.add('visible');
      subEl.classList.add('visible');

      // Matrix Rain 開始 (use imported function directly)
      startMatrixRain(splashFont);

      setTimeout(() => randomGlitchWave(6, 100, () => {
        // 円表示
        circWrap.classList.add('visible');
        authEl.classList.add('visible');

        // メッセージを時間で切り替え
        MSGS.forEach(m => {
          setTimeout(() => { authStat.textContent = m.text; }, m.at);
        });

        // 2秒で0→100% スムーズアニメ
        animCircle(100, PROGRESS_DURATION, () => {
          // 100%到達
          authStat.style.color = '#a0ff50';
          authStat.textContent = '✓ AUTHENTICATION COMPLETE';
          authWelc.textContent = '認証完了 — ようこそ、HANNAH へ';
          authWelc.classList.add('visible');

          setTimeout(() => randomGlitchWave(14, 70, () => {
            setTimeout(() => {
              logoWrap.classList.add('split');
              // 1秒後にUI表示
              setTimeout(() => {
                splash.classList.add('exit');
                setTimeout(() => {
                  splash.classList.add('gone');
                  splashDone = true;
                  cancelAnimationFrame(animId);
                  if (window.stopMatrixRain) window.stopMatrixRain();
                }, 800);
              }, 1000);
            }, 200);
          }), 300);
        });
      }), 400);
    }, 300);
  });
}

// Auto-run on module load (preserves original IIFE behavior)
initSplash();
