import {
  typewriterActive, setTypewriterActive,
  typewriterPosition, setTypewriterPosition,
  appSettings
} from './state.js';
import { saveSettings } from './settings.js';

// ======= TYPEWRITER MODE =======

export function setTypewriterMode(on) {
  appSettings.typewriterMode = on;
  setTypewriterActive(on);
  const posRow = document.getElementById('typewriterPosRow');
  if (posRow) posRow.style.display = on ? 'flex' : 'none';
  applyTypewriterMode(on);
  saveSettings();
}

export function setTypewriterPos(val) {
  appSettings.typewriterPos = parseInt(val);
  setTypewriterPosition(parseInt(val));
  document.getElementById('typewriterPosVal').textContent = val + '%';
  if (typewriterActive) applyTypewriterPadding();
  saveSettings();
}

export function applyTypewriterMode(on) {
  const ta = document.getElementById('memo-content');
  if (on) {
    applyTypewriterPadding();
    ta.addEventListener('input', typewriterScroll);
    ta.addEventListener('keyup', typewriterScroll);
    ta.addEventListener('click', typewriterScroll);
    typewriterScroll();
  } else {
    ta.removeEventListener('input', typewriterScroll);
    ta.removeEventListener('keyup', typewriterScroll);
    ta.removeEventListener('click', typewriterScroll);
    // Reset padding
    const editorArea = document.getElementById('editor-area');
    ta.style.paddingTop = '';
    ta.style.paddingBottom = '';
    editorArea.style.paddingTop = '';
    editorArea.style.paddingBottom = '';
  }
}

export function applyTypewriterPadding() {
  const ta = document.getElementById('memo-content');
  const editorArea = document.getElementById('editor-area');
  const areaH = editorArea.offsetHeight || window.innerHeight * 0.7;
  const posRatio = (appSettings.typewriterPos || 50) / 100;
  const topPad = Math.round(areaH * posRatio);
  const botPad = Math.round(areaH * (1 - posRatio));
  ta.style.paddingTop = topPad + 'px';
  ta.style.paddingBottom = botPad + 'px';
  ta.style.minHeight = 'unset';
}

export function typewriterScroll() {
  const ta = document.getElementById('memo-content');
  const editorArea = document.getElementById('editor-area');
  if (!typewriterActive || ta.style.display === 'none') return;

  // Get caret position
  const text = ta.value.substring(0, ta.selectionEnd);
  const lineCount = text.split('\n').length;

  // Create a mirror element to measure height
  const mirror = document.createElement('div');
  const style = window.getComputedStyle(ta);
  mirror.style.cssText = `
    position:absolute; visibility:hidden; pointer-events:none;
    white-space:pre-wrap; word-wrap:break-word;
    font-family:${style.fontFamily};
    font-size:${style.fontSize};
    line-height:${style.lineHeight};
    padding:${ta.style.paddingTop || '0'} ${style.paddingRight} 0 ${style.paddingLeft};
    width:${ta.offsetWidth}px;
    box-sizing:border-box;
  `;
  mirror.textContent = text;
  const span = document.createElement('span');
  span.textContent = '|';
  mirror.appendChild(span);
  document.body.appendChild(mirror);
  const caretTop = span.offsetTop;
  document.body.removeChild(mirror);

  const areaH = editorArea.offsetHeight;
  const posRatio = (appSettings.typewriterPos || 50) / 100;
  const targetScroll = caretTop - areaH * posRatio;
  editorArea.scrollTop = Math.max(0, targetScroll);
}

// --- window assignments ---
window.setTypewriterMode = setTypewriterMode;
window.setTypewriterPos = setTypewriterPos;
window.applyTypewriterMode = applyTypewriterMode;
window.applyTypewriterPadding = applyTypewriterPadding;
window.typewriterScroll = typewriterScroll;
