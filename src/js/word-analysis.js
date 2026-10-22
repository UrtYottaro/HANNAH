// word-analysis.js — Word frequency analysis, tag extraction, stats
import { memos, appSettings } from './state.js';
import { STOP_WORDS, escapeHtml } from './utils.js';

export function extractTags(content) {
  const wordFreq = countWords(content);
  const sorted = Object.entries(wordFreq).sort((a,b) => b[1]-a[1]);
  return sorted.slice(0, 6).map(([w]) => w);
}

export function countWords(text) {
  if (!text) return {};
  const freq = {};
  // Split on punctuation, spaces, and newlines
  const tokens = text.split(/[\s、。！？「」【】『』〔〕（）\(\)\[\]…\.\,\!\?\n\r・：:；;\/\\]+/);
  tokens.forEach(token => {
    // Only include tokens that are:
    // 1. 2-10 characters long (word-like, not sentence-like)
    // 2. Not in stop words
    // 3. Contain at least one CJK character or is a meaningful word
    if (token.length >= 2 && token.length <= 10 && !STOP_WORDS.has(token)) {
      // Filter out tokens that look like sentences (contain verb endings suggesting full clauses)
      const sentencePattern = /[ましたですだっだろうだろたりすることなのいますいましいるいたてきたくださいおりますございます]/;
      if (!sentencePattern.test(token) || token.length <= 4) {
        freq[token] = (freq[token] || 0) + 1;
      }
    }
  });
  return freq;
}

export function getAllWordFreq() {
  const freq = {};
  memos.forEach(memo => {
    const wf = countWords(memo.content); // タイトルは本文1行目に含まれる
    Object.entries(wf).forEach(([w, c]) => {
      freq[w] = (freq[w] || 0) + c;
    });
  });
  return freq;
}

export function updateWordRanking() {
  const freq = getAllWordFreq();
  const limit = appSettings.rankingLimit || 15;
  const sorted = Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0, limit);
  const container = document.getElementById('word-ranking');
  if (!container) return;

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-state">メモを書くとランキングが表示されます</div>';
    return;
  }

  const maxCount = sorted[0][1];
  container.innerHTML = sorted.map(([word, count], i) => {
    const pct = (count / maxCount * 100).toFixed(1);
    return `
      <div class="word-rank-item" onclick="searchByWord('${escapeHtml(word)}')">
        <div class="word-rank-num">${i+1}</div>
        <div class="word-rank-bar-container">
          <div class="word-rank-bar" style="width:${pct}%"></div>
          <span class="word-rank-label">${escapeHtml(word)}</span>
        </div>
        <div class="word-rank-count">${count}</div>
      </div>
    `;
  }).join('');
}

export function updateStats() {
  const elMemos = document.getElementById('stat-memos');
  if (!elMemos) return;
  elMemos.textContent = memos.length;
  const totalChars = memos.reduce((s, m) => s + m.content.length, 0);
  const elWords = document.getElementById('stat-words');
  if (elWords) elWords.textContent = totalChars;
  const freq = getAllWordFreq();
  const elUnique = document.getElementById('stat-unique');
  if (elUnique) elUnique.textContent = Object.keys(freq).length;
  const allTags = new Set(memos.flatMap(m => m.tags));
  const elTags = document.getElementById('stat-tags');
  if (elTags) elTags.textContent = allTags.size;
}

// Expose to window for cross-module calls
window.extractTags = extractTags;
window.countWords = countWords;
window.getAllWordFreq = getAllWordFreq;
window.updateWordRanking = updateWordRanking;
window.updateStats = updateStats;
