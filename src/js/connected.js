// ═══════════════════════════════════════════════════
//  HANNAH - Connected Memos & Network Graph
// ═══════════════════════════════════════════════════

import {
  memos,
  networkNodes, setNetworkNodes,
  networkEdges, setNetworkEdges,
  animFrame, setAnimFrame,
  dragNode, setDragNode,
  mouseX, setMouseX,
  mouseY, setMouseY
} from './state.js';
import { escapeHtml } from './utils.js';
import { countWords, getAllWordFreq } from './word-analysis.js';

// ======= CONNECTED MEMOS =======
function updateConnectedMemos(memoId) {
  const memo = memos.find(m => m.id === memoId);
  if (!memo) return;

  const container = document.getElementById('connected-memos-list');
  if (!container) return;
  const words = Object.keys(countWords(memo.title + ' ' + memo.content)).filter(w => w.length >= 2);

  // Score each other memo
  const scored = memos
    .filter(m => m.id !== memoId)
    .map(m => {
      const otherWords = new Set(Object.keys(countWords(m.title + ' ' + m.content)));
      const common = words.filter(w => otherWords.has(w));
      return { memo: m, score: common.length, common };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (scored.length === 0) {
    container.innerHTML = '<div class="empty-state">関連メモが見つかりません</div>';
    return;
  }

  container.innerHTML = scored.map(({ memo: m, score, common }) => `
    <div class="connected-memo" onclick="openMemo('${m.id}')">
      <div class="connected-memo-title">${escapeHtml(m.title)}</div>
      <div class="connected-memo-match">${common.slice(0,3).join('・')} (${score}語共通)</div>
    </div>
  `).join('');
}

// ======= NETWORK GRAPH =======
function updateNetwork() {
  const canvas = document.getElementById('network-canvas');
  if (!canvas) return;
  const freq = getAllWordFreq();
  const topWords = Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0, 18);

  const W = canvas.parentElement ? canvas.parentElement.offsetWidth - 40 : 260;
  canvas.width = W || 260;
  canvas.height = 240;

  setNetworkNodes(topWords.map(([word, count], i) => ({
    id: word,
    label: word,
    count,
    x: 30 + Math.random() * (canvas.width - 60),
    y: 30 + Math.random() * (canvas.height - 60),
    vx: 0, vy: 0,
    r: Math.max(8, Math.min(22, 6 + count * 2))
  })));

  // Edges: two words co-occur in same memo
  const edges = [];
  const nodes = networkNodes.slice();
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i+1; j < nodes.length; j++) {
      const w1 = nodes[i].id, w2 = nodes[j].id;
      const coMemos = memos.filter(m => {
        const t = m.title + ' ' + m.content;
        return t.includes(w1) && t.includes(w2);
      });
      if (coMemos.length > 0) {
        edges.push({ source: i, target: j, weight: coMemos.length });
      }
    }
  }
  setNetworkEdges(edges);

  if (animFrame) cancelAnimationFrame(animFrame);
  networkRunning = true;
  animateNetwork();
}

let networkRunning = false;

function stopNetwork() {
  networkRunning = false;
  if (animFrame) cancelAnimationFrame(animFrame);
}

function animateNetwork() {
  if (!networkRunning) return;
  const canvas = document.getElementById('network-canvas');
  if (!canvas) { networkRunning = false; return; }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;

  // Force simulation step
  networkNodes.forEach((n, i) => {
    // Repulsion
    networkNodes.forEach((m, j) => {
      if (i === j) return;
      const dx = n.x - m.x, dy = n.y - m.y;
      const d = Math.sqrt(dx*dx + dy*dy) + 0.1;
      const f = 600 / (d*d);
      n.vx += dx/d * f;
      n.vy += dy/d * f;
    });
    // Attract to center
    n.vx += (W/2 - n.x) * 0.002;
    n.vy += (H/2 - n.y) * 0.002;
  });

  networkEdges.forEach(e => {
    const a = networkNodes[e.source], b = networkNodes[e.target];
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.sqrt(dx*dx + dy*dy) + 0.1;
    const f = (d - 80) * 0.015 * e.weight;
    a.vx += dx/d * f; a.vy += dy/d * f;
    b.vx -= dx/d * f; b.vy -= dy/d * f;
  });

  networkNodes.forEach(n => {
    if (n === dragNode) return;
    n.vx *= 0.85; n.vy *= 0.85;
    n.x += n.vx; n.y += n.vy;
    n.x = Math.max(n.r, Math.min(W - n.r, n.x));
    n.y = Math.max(n.r, Math.min(H - n.r, n.y));
  });

  // Draw
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(13,17,23,0.3)';
  ctx.fillRect(0, 0, W, H);

  // Edges
  networkEdges.forEach(e => {
    const a = networkNodes[e.source], b = networkNodes[e.target];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = `rgba(88, 166, 255, ${Math.min(0.6, e.weight * 0.15)})`;
    ctx.lineWidth = Math.min(2, e.weight * 0.5);
    ctx.stroke();
  });

  // Nodes
  networkNodes.forEach(n => {
    // Glow
    const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 2);
    grad.addColorStop(0, 'rgba(31,111,235,0.3)');
    grad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r * 2, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(22,27,34,0.9)';
    ctx.fill();
    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    ctx.fillStyle = '#e6edf3';
    ctx.font = `${Math.min(11, 7 + n.count)}px 'Zen Kaku Gothic New'`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n.label.slice(0, 4), n.x, n.y);
  });

  setAnimFrame(requestAnimationFrame(animateNetwork));
}

// Canvas drag (only if network-canvas exists)
function initNetworkCanvasDrag() {
  const canvas = document.getElementById('network-canvas');
  if (!canvas) return;
  canvas.addEventListener('mousedown', e => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const found = networkNodes.find(n => {
      const dx = n.x - mx, dy = n.y - my;
      return Math.sqrt(dx*dx + dy*dy) < n.r + 4;
    });
    setDragNode(found || null);
  });
  canvas.addEventListener('mousemove', e => {
    if (!dragNode) return;
    const rect = canvas.getBoundingClientRect();
    dragNode.x = e.clientX - rect.left;
    dragNode.y = e.clientY - rect.top;
    dragNode.vx = 0; dragNode.vy = 0;
  });
  canvas.addEventListener('mouseup', () => setDragNode(null));
}

// Initialize drag listeners
initNetworkCanvasDrag();

// Assign to window for onclick compatibility
window.updateConnectedMemos = updateConnectedMemos;
window.updateNetwork = updateNetwork;
window.stopNetwork = stopNetwork;
window.animateNetwork = animateNetwork;

export { updateConnectedMemos, updateNetwork, animateNetwork };
