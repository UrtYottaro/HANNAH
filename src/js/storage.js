import {
  memos, folders, tasks, trashMemos,
  setMemos, setFolders, setTasks, setTrashMemos
} from './state.js';

export function loadData() {
  try {
    const saved = localStorage.getItem('memoire_data');
    if (saved) {
      const d = JSON.parse(saved);
      if (Array.isArray(d)) {
        setMemos(d);
      } else {
        setMemos(d.memos || []);
        setFolders(d.folders || []);
        setTasks(d.tasks || []);
        setTrashMemos(d.trash || []);
      }
    }
  } catch(e) {
    console.error('HANNAH: データ読み込みエラー', e);
    alert('データの読み込みに問題が発生しました。データが破損している可能性があります。');
  }
}

export function cleanupOldTrash(days = 7) {
  const now = Date.now();
  const limit = days * 24 * 60 * 60 * 1000;
  const before = trashMemos.length;
  const kept = trashMemos.filter(m => {
    if (!m.deletedAt) return true;
    return (now - new Date(m.deletedAt).getTime()) < limit;
  });
  if (kept.length < before) {
    setTrashMemos(kept);
    saveData();
    console.log(`HANNAH: ゴミ箱から ${before - kept.length} 件の古いメモを自動削除しました`);
  }
}

export function saveData() {
  try {
    localStorage.setItem('memoire_data', JSON.stringify({ memos, folders, tasks, trash: trashMemos }));
  } catch(e) { console.log('Storage not available'); }
}
