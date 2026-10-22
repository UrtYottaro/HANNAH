// ═══════════════════════════════════════════════════
//  MAIL COMPOSE (メール作成) MODULE
// ═══════════════════════════════════════════════════
import { currentMailFormat, setCurrentMailFormat } from './state.js';
import { memos, currentMemoId } from './state.js';
import { escapeHtml, bodyWithoutTitle } from './utils.js';

export function openMailCompose() {
  if (!currentMemoId) return;
  const memo = memos.find(m => m.id === currentMemoId);
  if (!memo) return;

  // 件名にメモタイトルをセット
  document.getElementById('mail-subject').value = memo.title || '(無題)';
  // フォーマットをプレーンに初期化
  setCurrentMailFormat('plain');
  setMailFormat('plain', memo);
  // 宛先はブランク
  document.getElementById('mail-to').value = '';
  document.getElementById('mail-cc').value  = '';

  document.getElementById('mail-overlay').style.display = 'flex';
  document.getElementById('mail-btn')?.classList.add('active');
}

export function closeMailCompose(e, force) {
  if (force || (e && e.target === document.getElementById('mail-overlay'))) {
    document.getElementById('mail-overlay').style.display = 'none';
    document.getElementById('mail-btn')?.classList.remove('active');
  }
}

export function setMailFormat(fmt, memoArg) {
  setCurrentMailFormat(fmt);
  // タブ状態更新
  ['plain','formal','casual'].forEach(f => {
    document.getElementById('fmt-' + f)?.classList.toggle('active', f === fmt);
  });

  const memo = memoArg || memos.find(m => m.id === currentMemoId);
  if (!memo) return;
  const body = buildMailBody(fmt, memo);
  document.getElementById('mail-body').value = body;

  // ノート
  const notes = {
    plain:  'メモの内容をそのまま本文にします。',
    formal: '宛名・挨拶・締め文を自動で付けます（ビジネス向け）。',
    casual: '柔らかい言い回しで整えます。'
  };
  document.getElementById('mail-preview-note').textContent = notes[fmt];
}

export function buildMailBody(fmt, memo) {
  const content = bodyWithoutTitle(memo.content); // 1行目は件名・題名として別に出す
  const title   = memo.title   || '(無題)';
  const date    = memo.updatedAt ? new Date(memo.updatedAt).toLocaleDateString('ja-JP') : '';

  if (fmt === 'plain') {
    return content;
  }

  if (fmt === 'formal') {
    return `お世話になっております。

以下の内容をお送りいたします。

──────────────────────
【件名】${title}
【日付】${date}
──────────────────────

${content}

──────────────────────
以上、ご確認のほどよろしくお願いいたします。`;
  }

  if (fmt === 'casual') {
    return `こんにちは！

「${title}」についてメモをまとめたので共有します。

${content}

以上、よろしくお願いします！`;
  }

  return content;
}

export function sendViaMailto() {
  const to      = document.getElementById('mail-to').value.trim();
  const cc      = document.getElementById('mail-cc').value.trim();
  const subject = document.getElementById('mail-subject').value.trim();
  const body    = document.getElementById('mail-body').value;

  if (!to) {
    document.getElementById('mail-to').focus();
    document.getElementById('mail-to').style.borderBottom = '1px solid var(--danger)';
    setTimeout(() => document.getElementById('mail-to').style.borderBottom = '', 1500);
    return;
  }

  // mailto: URL構築
  let mailto = 'mailto:' + encodeURIComponent(to);
  const params = [];
  if (cc)      params.push('cc='      + encodeURIComponent(cc));
  if (subject) params.push('subject=' + encodeURIComponent(subject));
  if (body)    params.push('body='    + encodeURIComponent(body));

  if (params.length) mailto += '?' + params.join('&');

  // URLの長さ制限警告（ブラウザ・OSによって2000〜8000文字が上限）
  if (mailto.length > 2000) {
    document.getElementById('mail-preview-note').textContent =
      '⚠ 本文が長いため、メールアプリによっては一部が切れることがあります。';
  }

  window.location.href = mailto;
  // モーダルは少し遅らせて閉じる（アプリが開くまで表示を保つ）
  setTimeout(() => closeMailCompose(null, true), 800);
}

// --- window assigns ---
window.openMailCompose = openMailCompose;
window.closeMailCompose = closeMailCompose;
window.setMailFormat = setMailFormat;
window.buildMailBody = buildMailBody;
window.sendViaMailto = sendViaMailto;
