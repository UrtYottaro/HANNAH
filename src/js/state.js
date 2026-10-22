// ═══════════════════════════════════════════════════
//  HANNAH - Global Mutable State
// ═══════════════════════════════════════════════════

// --- Data Storage (from block1) ---
export let memos = [];
export function setMemos(val) { memos = val; }

export let folders = [];
export function setFolders(val) { folders = val; }

export let tasks = [];
export function setTasks(val) { tasks = val; }

export let trashMemos = [];
export function setTrashMemos(val) { trashMemos = val; }

export let currentMemoId = null;
export function setCurrentMemoId(val) { currentMemoId = val; }

export let isEditing = false;
export function setIsEditing(val) { isEditing = val; }

export let recognition = null;
export function setRecognition(val) { recognition = val; }

export let isRecording = false;
export function setIsRecording(val) { isRecording = val; }

export let sortByUpdated = false;
export function setSortByUpdated(val) { sortByUpdated = val; }

export let currentFolderFilter = 'all';
export function setCurrentFolderFilter(val) { currentFolderFilter = val; }

// --- Word Hover (from block1) ---
export let tooltipTimeout;
export function setTooltipTimeout(val) { tooltipTimeout = val; }

// --- Network Graph (from block1) ---
export let networkNodes = [];
export function setNetworkNodes(val) { networkNodes = val; }

export let networkEdges = [];
export function setNetworkEdges(val) { networkEdges = val; }

export let animFrame;
export function setAnimFrame(val) { animFrame = val; }

export let dragNode = null;
export function setDragNode(val) { dragNode = val; }

export let mouseX = 0;
export function setMouseX(val) { mouseX = val; }

export let mouseY = 0;
export function setMouseY(val) { mouseY = val; }

// --- Mobile View (from block1) ---
export let mobileCurrentView = 'list'; // 'list' | 'editor' | 'panel'
export function setMobileCurrentView(val) { mobileCurrentView = val; }

// --- Settings (from block3) ---
export let appSettings = {
  theme: { name: 'GitHub', accent: '#1f6feb', bg: '#0d1117', fg: '#e6edf3' },
  themeMode: 'dark',   // 'auto' | 'light' | 'dark'
  contentWidth: '100%',
  editorFontSize: 15,
  lineHeight: 2,
  focusMode: false,
  saveMode: 'realtime',
  particles: true,
  sidebarWidth: '320px',
  previewLines: 2,
  confirmDelete: true
};
export function setAppSettings(val) { appSettings = val; }

export let autoSaveTimer = null;
export function setAutoSaveTimer(val) { autoSaveTimer = val; }

export let _currentSettingsTab = 'appearance';
export function set_currentSettingsTab(val) { _currentSettingsTab = val; }

// --- Typewriter Mode (from block3) ---
export let typewriterActive = false;
export function setTypewriterActive(val) { typewriterActive = val; }

export let typewriterPosition = 50; // % from top
export function setTypewriterPosition(val) { typewriterPosition = val; }

// --- Context Menu (from block3) ---
export let ctxMemoId = null;
export function setCtxMemoId(val) { ctxMemoId = val; }

// --- Drag State (from block3) ---
export let _dragState = null;
export function set_dragState(val) { _dragState = val; }

// --- Mail (from block3) ---
export let currentMailFormat = 'plain';
export function setCurrentMailFormat(val) { currentMailFormat = val; }

// --- Font Manager (from block2) ---
export let fmFonts = [];        // { name, family, file, objectUrl, weights: [{ weight, url }] }
export function setFmFonts(val) { fmFonts = val; }

export let fmSelected = null;   // currently previewed font name
export function setFmSelected(val) { fmSelected = val; }

export let fmApplied = {};      // { body, title, display, mono } -> font family name
export function setFmApplied(val) { fmApplied = val; }

export let fmDB = null;
export function setFmDB(val) { fmDB = val; }
