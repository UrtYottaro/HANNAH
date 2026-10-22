// ═══════════════════════════════════════════════════
//  HANNAH - メモ一覧のスワイプ操作
//
//   左へスライド → [共有（.txt に書き出し）] [ゴミ箱] のボタンが出る
//   右へスライド → [ピン留め] のボタンが出る
//   右へ強くスライド → ボタンを押さなくても、そのままピン留め（もう一度で解除）
//
//  動きはメモ標準アプリの滑らかさを手本にしている：
//   ・指（トラックパッドの2本指／タッチ／マウス）に 1:1 で吸い付く（描画は requestAnimationFrame にまとめる）
//   ・端を越えると、ゴムのように重くなる
//   ・離した瞬間の勢いを引き継いで、バネの動きで開く・閉じる（CSS の一定時間の動きではなく、物理計算）
//   ・動いている途中でも、つかみ直せる
//   ・トラックパッドは、指を離したあとの慣性スクロールを見分けて無視する
// ═══════════════════════════════════════════════════

const BTN_W = 64;                       // ボタン1つの幅
const OPEN_LEFT = -BTN_W * 2;           // 左へ開いたときの位置（ボタン2つ分）
const OPEN_RIGHT = BTN_W;               // 右へ開いたときの位置（ボタン1つ分）
const DELETE_MS = 420;                  // ゴミ箱へ入れるときのスライドアウトの長さ
// バネの硬さ：response＝1往復の時間（秒、小さいほど速い）
// damping＝減衰（1で弾みなし、1未満で弾む）。ふだんは弾まず、勢いよくはじいたときだけ少し弾ませる（Apple の標準的な作り）
const SPRING = { response: 0.38, damping: 1, flickDamping: 0.82, flickSpeed: 0.6 };   // flickSpeed＝はじきとみなす速さ（px/ms）
// 離したときの勢いから「どこまで進むか」を予測する（UIScrollView と同じ指数減衰：減速率 0.998）
const DECELERATION_RATE = 0.998;
const projectDistance = v => v * 1000 * DECELERATION_RATE / (1 - DECELERATION_RATE) / 1000;   // v: px/ms → px

let openRow = null;                     // 今ボタンを出している行
let clickBlockedUntil = 0;              // ドラッグ直後のクリック（＝メモが開く誤動作）を無視するための時刻
// トラックパッドの慣性：指を離したあとも、勢いが減りながら横スクロールが続く。これを無視する間の状態
let wheelLock = { on: false, last: 0, lastMag: 0 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const strongAt = row => Math.min((row.offsetWidth || 300) * 0.5, 200);   // ここを越えて離すと自動ピン留め

// 指の位置（raw）→ 画面上の位置。開く位置・強いスワイプ位置を越えた分は、だんだん重くなる
function rubber(row, raw) {
  if (raw > 0) {
    const free = strongAt(row) + 24;
    if (raw <= free) return raw;
    const over = raw - free;
    return free + over / (1 + over / 90);
  }
  if (raw < OPEN_LEFT) {
    const over = OPEN_LEFT - raw;
    return OPEN_LEFT - over / (1 + over / 60);
  }
  return raw;
}

// スワイプを始めたときに、どちら側が開いていたか（-1＝左が開いている、1＝右が開いている、0＝閉じている）
function sideAtStart(row) {
  if (row._target) return Math.sign(row._target);
  const x = row._x || 0;
  return Math.abs(x) > 4 ? Math.sign(x) : 0;
}

// 開いた状態から始めたスワイプは、真ん中（閉じた位置）を越えて反対側へは行かせない
function limitToSide(raw, side) {
  if (side < 0) return Math.min(raw, 0);
  if (side > 0) return Math.max(raw, 0);
  return raw;
}

// ── 描画 ──
function paint(row, x) {
  row._x = x;
  const card = row._card;
  card.style.transform = Math.abs(x) < 0.01 ? '' : `translate3d(${x}px, 0, 0)`;
  row.classList.toggle('reveal-left', x < -0.5);
  row.classList.toggle('reveal-right', x > 0.5);
  if (Math.abs(x) > 0.5) row.classList.add('swiped');
  // ボタンは、カードが動いた分だけ見える（右側の2つは幅を分け合い、左のピンは行の端まで伸びる）
  row._left.style.width = Math.max(0, x) + 'px';
  row._right.style.width = Math.max(0, -x) + 'px';
  row.classList.toggle('armed', x >= strongAt(row));     // 自動ピン留めの位置に来たら、ボタンが反応する
}

let paintQueue = new Map();
function schedulePaint(row, x) {
  const first = paintQueue.size === 0;
  paintQueue.set(row, x);
  if (first) requestAnimationFrame(() => {
    const q = paintQueue; paintQueue = new Map();
    q.forEach((v, r) => paint(r, v));
  });
}

function setFocusable(row, x) {
  for (const b of row.querySelectorAll('.swipe-btn')) {
    const visible = b.closest('.swipe-actions-left') ? x > 0 : x < 0;
    b.tabIndex = visible ? 0 : -1;
    b.setAttribute('aria-hidden', String(!visible));
  }
}

// ── バネのアニメーション（離した瞬間の速さを引き継ぐ） ──
function animateTo(row, target, v0, onDone, noCrossSide = 0, damping = SPRING.damping) {
  cancelAnimationFrame(row._raf);
  paintQueue.delete(row);
  if (reduceMotion()) { paint(row, target); onDone && onDone(); return; }
  const w = (2 * Math.PI) / SPRING.response;
  const z = damping;
  let x = row._x || 0;
  let v = clamp(v0 || 0, -1.6, 1.6) * 1000;             // px/ms → px/s（強くはじいても、弾みすぎないよう上限を設ける）
  let last = performance.now();
  const step = now => {
    const dt = Math.min(0.034, (now - last) / 1000);
    last = now;
    for (let i = 0; i < 4; i++) {                        // 細かく刻んで計算（フレームが落ちても破綻しない）
      const h = dt / 4;
      const a = -w * w * (x - target) - 2 * z * w * v;
      v += a * h;
      x += v * h;
      // 真ん中に戻すときは、勢いで反対側へはみ出さない（反対側のボタンが一瞬見えないように）
      if ((noCrossSide < 0 && x > 0) || (noCrossSide > 0 && x < 0)) { x = 0; v = 0; }
    }
    if (Math.abs(x - target) < 0.35 && Math.abs(v) < 6) {
      row._raf = 0;
      paint(row, target);
      onDone && onDone();
      return;
    }
    paint(row, x);
    row._raf = requestAnimationFrame(step);
  };
  row._raf = requestAnimationFrame(step);
}

function settle(row, target, v = 0, after, noCrossSide = 0) {
  // はじいたときだけ弾ませる。ふだんは弾まずに、すっと収まる
  const damping = Math.abs(v) >= SPRING.flickSpeed ? SPRING.flickDamping : SPRING.damping;
  row._target = target;
  if (target !== 0) {
    if (openRow && openRow !== row) settle(openRow, 0);
    row.classList.add('open');
    openRow = row;
  } else {
    row.classList.remove('open');
    if (openRow === row) openRow = null;
  }
  animateTo(row, target, v, () => {
    setFocusable(row, target);
    if (target === 0) row.classList.remove('swiped', 'reveal-left', 'reveal-right', 'armed');
    after && after();
  }, noCrossSide, damping);
}

export function closeRow(row) {
  if (row) settle(row, 0);
}

// 離したとき：今の位置と勢いから、開く／閉じる／自動ピン留めを決めて、バネで動かす
function release(row, memoId, v, side = 0) {
  const x = row._x || 0;
  if (x >= strongAt(row) && side >= 0) {
    // 強いスワイプ：戻り終えてからピン留め（一覧の並び替えで、戻る動きが途切れないように）
    settle(row, 0, v, () => window.togglePin(memoId));
    return;
  }
  const projected = x + projectDistance(clamp(v, -3, 3));
  let target = 0;
  if (projected <= OPEN_LEFT / 2) target = OPEN_LEFT;
  else if (projected >= OPEN_RIGHT / 2) target = OPEN_RIGHT;
  // 開いていた側と反対には開かない（真ん中に戻すだけ。反対側は、もう一度スワイプしたときに出す）
  if (side !== 0 && Math.sign(target) === -side) target = 0;
  settle(row, target, v, null, target === 0 ? side : 0);
}

// 直近 100ms の動きから速さ（px/ms）を出す
function velocityOf(samples) {
  const now = performance.now();
  const recent = samples.filter(s => now - s.t <= 100);
  if (recent.length < 2) return 0;
  const a = recent[0], b = recent[recent.length - 1];
  return (b.x - a.x) / Math.max(8, b.t - a.t);
}

// 左へスライドアウトして詰めてから、ゴミ箱へ移す（動きを減らす設定のときは即座に）
function animateDelete(row, memoId) {
  if (row.classList.contains('deleting')) return;
  if (openRow === row) openRow = null;
  if (reduceMotion()) { window.moveToTrash(memoId); return; }
  row.style.setProperty('--delete-height', row.offsetHeight + 'px');
  row.classList.add('deleting');
  setTimeout(() => window.moveToTrash(memoId), DELETE_MS - 20);
}

export function initMemoSwipe(row, memoId) {
  const card = row.querySelector('.memo-card');
  const surface = row;   // スワイプを受け付ける範囲：行全体（カードと、出ているボタンの上）
  row._card = card;
  row._left = row.querySelector('.swipe-actions-left');
  row._right = row.querySelector('.swipe-actions-right');
  row._x = 0;

  // ── ボタン ──
  // ボタンの上でスライドした直後のクリックは、押したことにしない
  const onButton = fn => e => { e.stopPropagation(); if (performance.now() < clickBlockedUntil) return; fn(); };
  row.querySelector('[data-act="pin"]')?.addEventListener('click', onButton(() => settle(row, 0, 0, () => window.togglePin(memoId))));
  row.querySelector('[data-act="export"]')?.addEventListener('click', onButton(() => { closeRow(row); window.exportMemoTxt(memoId); }));
  row.querySelector('[data-act="trash"]')?.addEventListener('click', onButton(() => animateDelete(row, memoId)));

  // ── ポインター（タッチ・マウス・ペン）のドラッグ ──
  let startX = 0, startY = 0, base = 0, samples = [], side = 0;
  let tracking = false, horizontal = false, pid = null;

  let interrupted = false;   // 動いている最中に触れて止めたか
  surface.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    tracking = true; horizontal = false; pid = e.pointerId;
    startX = e.clientX; startY = e.clientY;
    samples = [];
    // 触れた瞬間に、その場で止める（メモアプリと同じ）
    interrupted = !!row._raf;
    if (interrupted) { cancelAnimationFrame(row._raf); row._raf = 0; }
  });

  surface.addEventListener('pointermove', e => {
    if (!tracking || e.pointerId !== pid) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!horizontal) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {                                   // 縦スクロール
        tracking = false;
        if (interrupted) { interrupted = false; settle(row, row._target || 0); }
        return;
      }
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      horizontal = true;
      try { surface.setPointerCapture(pid); } catch (err) {}
      // 動いている途中ならその場でつかむ。動き出しの6px分は差し引いて、急に跳ねないようにする
      cancelAnimationFrame(row._raf);
      side = sideAtStart(row);
      base = (row._x || 0) - Math.sign(dx) * 6;
      if (openRow && openRow !== row) settle(openRow, 0);
    }
    if (side !== 0 && Math.sign(base + dx) === -side) base = -dx;   // 真ん中を越えた分は数えない
    const raw = limitToSide(base + dx, side);
    samples.push({ t: performance.now(), x: raw });
    if (samples.length > 12) samples.shift();
    schedulePaint(row, rubber(row, raw));
  });

  const end = e => {
    if (!tracking || (e && e.pointerId !== pid)) return;
    tracking = false;
    if (!horizontal) {
      // 止めたまま横に動かさずに離した：元の行き先への動きを再開する
      if (interrupted) { interrupted = false; clickBlockedUntil = performance.now() + 300; settle(row, row._target || 0); }
      return;
    }
    interrupted = false;
    horizontal = false;
    clickBlockedUntil = performance.now() + 350;       // ドラッグを離した直後のクリックは無視
    release(row, memoId, velocityOf(samples), side);
  };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', end);

  // ── トラックパッドの2本指スワイプ ──
  // 指が動いている間は 1:1 で追従。指を離すと、勢いが一定の割合で減っていく横スクロール（慣性）に変わるので、
  // それを見分けた時点で「離した」とみなしてバネに任せ、以後の慣性は無視する。
  let g = null;   // 進行中のジェスチャー { base, acc, samples, mags, peak, timer }

  const endWheel = momentum => {
    if (!g) return;
    clearTimeout(g.timer);
    const v = velocityOf(g.samples);
    const side = g.side;
    if (momentum) wheelLock = { on: true, last: performance.now(), lastMag: g.mags[g.mags.length - 1] || 0 };
    g = null;
    clickBlockedUntil = performance.now() + 300;
    release(row, memoId, v, side);
  };

  surface.addEventListener('wheel', e => {
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? row.clientWidth : 1;
    const dx = e.deltaX * unit, dy = e.deltaY * unit;
    const mag = Math.abs(dx);
    const horizontalMove = mag > Math.abs(dy) * 1.1;
    const now = performance.now();

    if (wheelLock.on) {
      // 慣性は勢いが必ず減っていく。間が空いた、または勢いが増えた＝指で新しく動かした
      const fresh = now - wheelLock.last > 140 || mag > wheelLock.lastMag * 1.2 + 0.5;
      if (!fresh) {
        if (horizontalMove) e.preventDefault();
        wheelLock.last = now; wheelLock.lastMag = mag;
        return;
      }
      wheelLock.on = false;
    }
    if (!g && (!horizontalMove || mag < 0.5)) return;   // 縦スクロールは邪魔しない
    e.preventDefault();                                  // ブラウザの「戻る」スワイプも抑える

    if (!g) {
      cancelAnimationFrame(row._raf);                    // 動いている途中ならその場でつかむ
      g = { base: row._x || 0, acc: 0, samples: [], mags: [], peak: 0, timer: 0, side: sideAtStart(row) };
      if (openRow && openRow !== row) settle(openRow, 0);
    }
    g.acc += horizontalMove ? -dx : 0;                   // 指を右へ動かすと deltaX は負
    // 開いた状態からのスワイプは、真ん中で止める（行き過ぎた分は数えない＝戻すとすぐ追従する）
    if (g.side < 0 && g.base + g.acc > 0) g.acc = -g.base;
    if (g.side > 0 && g.base + g.acc < 0) g.acc = -g.base;
    const raw = g.base + g.acc;
    g.samples.push({ t: now, x: raw });
    if (g.samples.length > 16) g.samples.shift();
    g.mags.push(mag);
    if (g.mags.length > 4) g.mags.shift();
    g.peak = Math.max(g.peak, mag);
    schedulePaint(row, rubber(row, raw));

    // 指を止めたまま離した（慣性が来ない）場合
    clearTimeout(g.timer);
    g.timer = setTimeout(() => endWheel(false), 90);

    // 慣性の始まりを判定：勢いが一定の割合（0.70〜0.99倍）で4回続けて減った
    const m = g.mags;
    if (m.length === 4 && g.peak >= 4) {
      let decaying = true;
      for (let i = 1; i < 4; i++) {
        const r = m[i] / Math.max(0.01, m[i - 1]);
        if (!(m[i] < m[i - 1] && r > 0.7 && r < 0.99)) { decaying = false; break; }
      }
      if (decaying) endWheel(true);
    }
  }, { passive: false });
}

// 行のクリックを無視すべきか（ドラッグ直後、または開いた行を閉じるためのクリック）
export function swallowRowClick(row) {
  if (performance.now() < clickBlockedUntil) return true;
  if (row.classList.contains('open')) { closeRow(row); return true; }
  return false;
}

// 開いている行の外を押したら閉じる
document.addEventListener('pointerdown', e => {
  if (openRow && !openRow.contains(e.target)) closeRow(openRow);
}, true);

// 一覧が描き直されたら、開いていた行は無くなるので覚えを消す
export function resetSwipeState() { openRow = null; }

window.initMemoSwipe = initMemoSwipe;
window.swallowRowClick = swallowRowClick;
window.resetSwipeState = resetSwipeState;
