// ═══════════════════════════════════════════════════
//  SPEECH RECOGNITION (音声入力) MODULE
//
//  ブラウザの音声認識は、無音が続いたり一定時間たったりすると、こちらが止めていなくても
//  セッションを終了する。そのため「止めたい」と押されるまでは、終了のたびに自動で再開する。
//  認識した文字はカーソル位置に挿入し、入力イベントを発行して自動保存につなげる。
// ═══════════════════════════════════════════════════
import { recognition, setRecognition, isRecording, setIsRecording, currentMemoId } from './state.js';

const MIC_ICON = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>';
const STOP_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>';

let wantListening = false;     // ユーザーが「聞き続けてほしい」状態か
let targetMemoId = null;       // 音声入力を始めたメモ（別のメモへ移ったら止める）
let restartTimer = null;
let quickFailures = 0;         // 結果が出ないまますぐ終わった回数（無限に再開し続けないため）
let sessionStartedAt = 0;
let gotResultThisSession = false;

function setMicUI(on) {
  const btn = document.getElementById('mic-btn');
  if (btn) {
    btn.classList.toggle('recording', on);
    btn.innerHTML = on ? STOP_ICON : MIC_ICON;
    btn.title = on ? '音声入力を止める' : '音声入力';
  }
  const bar = document.getElementById('mic-wave-bar');
  if (bar) bar.style.display = on ? 'block' : 'none';
  if (!on) setInterim('');
}

function setInterim(text) {
  const el = document.getElementById('mic-interim');
  if (el) el.textContent = text;
}

// カーソル位置に文字を入れ、入力イベントで自動保存・自動リサイズを動かす
function insertAtCaret(text) {
  const ta = document.getElementById('memo-content');
  if (!ta || !text) return;
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? start;
  const before = ta.value.slice(0, start);
  // 英数字どうしがくっつくときだけ空白を挟む（日本語は空白なし）
  const needSpace = /[A-Za-z0-9]$/.test(before) && /^[A-Za-z0-9]/.test(text);
  const insert = (needSpace ? ' ' : '') + text;
  ta.setRangeText(insert, start, end, 'end');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

function stopListening(message) {
  wantListening = false;
  clearTimeout(restartTimer);
  try { recognition && recognition.stop(); } catch (e) {}
  setIsRecording(false);
  setMicUI(false);
  if (message) window.showToast ? window.showToast(message) : alert(message);
}

function startSession() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  setRecognition(rec);
  rec.lang = 'ja-JP';
  rec.continuous = true;
  rec.interimResults = true;

  rec.onstart = () => {
    sessionStartedAt = Date.now();
    gotResultThisSession = false;
    setIsRecording(true);
    setMicUI(true);
  };

  rec.onresult = (e) => {
    // 別のメモへ移っていたら、そのメモへ誤って書き込まないよう止める
    if (currentMemoId !== targetMemoId) { stopListening('メモが切り替わったので音声入力を止めました'); return; }
    gotResultThisSession = true;
    quickFailures = 0;
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    if (final) insertAtCaret(final);
    setInterim(interim);
  };

  rec.onerror = (e) => {
    // 許可されていない・マイクがない場合は再開しても無駄なので止める
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      stopListening('マイクの使用が許可されていません。ブラウザのマイク設定を確認してください。');
    } else if (e.error === 'audio-capture') {
      stopListening('マイクが見つかりません。接続を確認してください。');
    }
    // no-speech / aborted / network などは onend で自動再開する
  };

  rec.onend = () => {
    if (!wantListening) { setIsRecording(false); setMicUI(false); return; }
    // 勝手に終了した：すぐ再開する。結果もないまま短時間で何度も終わる場合は諦める
    const lived = Date.now() - sessionStartedAt;
    if (!gotResultThisSession && lived < 1500) quickFailures++;
    if (quickFailures >= 5) {
      stopListening('音声入力が繰り返し切断されたため止めました。ネットワークとマイクを確認してください。');
      return;
    }
    setInterim('');
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      if (!wantListening) return;
      try { startSession(); } catch (err) {
        // 直前のセッションがまだ終わりきっていない場合は、少し待ってもう一度
        restartTimer = setTimeout(() => { if (wantListening) { try { startSession(); } catch (e2) { stopListening('音声入力を再開できませんでした。'); } } }, 500);
      }
    }, quickFailures > 0 ? 400 * quickFailures : 150);
  };

  rec.start();
}

export function toggleMic() {
  // デスクトップ版（Electron）には Google の音声認識が付いていないため、使えない
  if (/Electron\//.test(navigator.userAgent)) {
    window.showToast('デスクトップ版では音声入力は使えません（録音は使えます）');
    return;
  }

  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert('音声認識はこのブラウザではサポートされていません。Chrome をお試しください。');
    return;
  }

  if (wantListening || isRecording) {
    stopListening();
    return;
  }

  // メモが開いていなければ新規メモを作る。表示モードなら編集に戻す
  if (!currentMemoId && window.createNewMemo) window.createNewMemo();
  if (window.startEditing) window.startEditing();

  wantListening = true;
  targetMemoId = currentMemoId;   // import した currentMemoId は最新の値を指す
  quickFailures = 0;
  startSession();
}

// --- window assigns ---
window.toggleMic = toggleMic;
window.stopMic = () => { if (wantListening) stopListening(); };
