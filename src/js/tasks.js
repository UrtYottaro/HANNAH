// ═══════════════════════════════════════════════════
//  TASK / QUEST SYSTEM MODULE
// ═══════════════════════════════════════════════════
import { tasks, setTasks } from './state.js';
import { saveData } from './storage.js';
import { generateId, escapeHtml } from './utils.js';

export function addTask() {
  const input = document.getElementById('task-input');
  const typeEl = document.getElementById('task-type-sel');
  const dlEl   = document.getElementById('task-deadline-input');
  const title  = input.value.trim();
  if (!title) return;
  tasks.unshift({
    id: 't' + Date.now().toString(36),
    type:     typeEl.value,
    title,
    deadline: dlEl.value || null,
    done:     false,
    createdAt: new Date().toISOString()
  });
  input.value = '';
  dlEl.value  = '';
  saveData();
  renderTaskList();
}

export function toggleTask(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  saveData();
  renderTaskList();
}

export function deleteTask(id) {
  setTasks(tasks.filter(x => x.id !== id));
  saveData();
  renderTaskList();
}

export function renderTaskList() {
  const el = document.getElementById('task-list');
  if (!el) return;
  if (tasks.length === 0) {
    el.innerHTML = '<div class="empty-state" style="text-align:center;padding:16px;font-size:10px;opacity:.5;">タスクはありません</div>';
    return;
  }
  const now = Date.now();
  el.innerHTML = tasks.map(t => {
    const badge = t.type === 'quest'
      ? '<span class="task-badge quest">QUEST</span>'
      : '<span class="task-badge task">TASK</span>';
    let dlHtml = '';
    if (t.deadline) {
      const dl = new Date(t.deadline);
      const diff = dl - now;
      const cls = diff < 0 ? 'overdue' : diff < 86400000 ? 'soon' : '';
      const dlStr = `${dl.getMonth()+1}/${dl.getDate()} ${String(dl.getHours()).padStart(2,'0')}:${String(dl.getMinutes()).padStart(2,'0')}`;
      const icon = diff < 0 ? '⚠' : diff < 86400000 ? '⏳' : '⏱';
      dlHtml = `<span class="task-deadline ${cls}">${icon} ${dlStr}</span>`;
    }
    return `<div class="task-card type-${t.type}${t.done?' done':''}">
      <div class="task-card-header">
        <button class="task-check" onclick="toggleTask('${t.id}')">${t.done?'✓':''}</button>
        <div class="task-card-body">
          <div class="task-card-title">${escapeHtml(t.title)}</div>
          <div class="task-meta">${badge}${dlHtml}</div>
        </div>
        <button class="task-del-btn" onclick="deleteTask('${t.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

// Assign to window for inline onclick handlers
window.addTask = addTask;
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;
window.renderTaskList = renderTaskList;
