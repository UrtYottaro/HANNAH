# CODE.md — HANNAH のコード案内

このフォルダのどこに何のコードがあるかの一覧。新しく書く前にここを見て、既にあれば使い回す。作ったら足す。

- 確認日: 2026-10-03。パスの実在は確認済み。内容は調査でファイル冒頭まで見た範囲（全文は未読）
- 凡例: 「確認」＝冒頭まで見た / 「推定」＝名前や文書からの推測
- 全プロジェクトの導線: `/Users/yottaro/Desktop/dev/Basal/CODE.md`
- 文書: `handoff.md` は 2026-10-04 に現状へ書き直し済み（旧い記述は削除）。実体は `src/` + Vite 構成（バージョン番号は管理しない）。READMEは無い。**実コードを優先**
- v0.3.0 の変更前ソースは `backup_v0_2_0/`（git管理外）に退避済み

## 何のプロジェクトか

SF/サイバーパンク調のメモ帳PWA。バニラJS + Vite。フォルダ管理、頻出ワード分析、タイプライターモード付き。

## 再利用できるコード（すべて `src/js/` 配下、ESモジュール）

| 場所 | 何をするか / 役に立つ場面 | 状態 |
|---|---|---|
| `src/js/storage.js`、`src/js/state.js` | localStorage（キー `memoire_data`）主体のメモ保存/復元。文書ではIndexedDBとのデュアルライトとあるが、その実体は未確認。小規模なオフラインアプリの保存層に | 確認（`storage.js` 冒頭）／デュアルライトは推定 |
| `src/js/word-analysis.js` | `countWords` / `extractTags` による頻出語集計とタグ抽出（STOP_WORDS使用） | 確認（冒頭） |
| `src/js/typewriter.js` | カーソル位置固定スクロールのタイプライターモード（`setTypewriterMode`） | 確認（冒頭） |
| `src/js/matrix-rain.js` | Canvasのマトリックスレイン演出（`startMatrixRain` / `stopMatrixRain`） | 確認（冒頭） |
| `src/js/speech.js` | Web Speech APIの音声入力（`toggleMic`） | 確認（冒頭） |
| `src/js/export-import.js` | JSON入出力、フォント除去の配布HTML生成 | 確認（冒頭） |
| `src/js/font-manager.js`、`src/js/folders.js`、`src/js/drag.js`、`src/js/trash.js` | IndexedDBフォント管理、フォルダ、ドラッグ、ゴミ箱 | 推定（名前のみ） |
| `src/js/utils.js`（v0.3.0 で追加分） | メモ風UI用の純関数：`deriveTitle`（1行目→タイトル）、`derivePreview`、`bodyWithoutTitle`、`memoMatchesFilter`/`folderIdForFilter`（フォルダ絞り込み、`UNFILED_FILTER`）、`formatNoteDate`/`formatListDate`/`dateGroupOf`（日付表示とセクション分け） | 確認（作成・動作確認済み） |
| `src/js/memo-crud.js`（v0.3.0 で刷新） | `persistCurrentMemo`（内容が変わった時だけ保存）、`leaveCurrentMemo`（保存＋空メモ破棄）、`migrateMemoTitles`（旧メモのタイトルを本文先頭行へ統合・初回は元データを `memoire_data_backup_before_firstline_title` に退避）、`selectFirstMemoInView` | 確認 |
| `src/js/theme.js` | 配色のテーマ機能。プリセット28種（`~/Desktop/ColorTheme` のスクショから書き起こし）、アクセント・背景・前景の3色から全CSS変数（`--bg` `--surface` `--border` `--text` `--accent` `--accent2` `--on-accent` `--fg-rgb` など）を導出する `applyTheme`、設定画面の外観タブ（モード＝自動/ライト/ダーク、テーマ選択、色の手入力、JSON コピー/読込、リセット）。ライトは前景色から明るい背景を作る自動導出 | 確認（作成・動作確認済み） |
| `src/js/swipe.js` | メモ一覧のスワイプ（左=共有・ゴミ箱、右=ピン留め、右へ強く=自動ピン留め）。指・トラックパッドに1:1で追従し、離した勢いを引き継ぐバネの物理計算（`animateTo`）で開閉。トラックパッドの慣性は勢いの減り方で判定して無視。iOS風の滑らかな横スワイプが欲しいときに流用できる | 確認 |
| `src/js/memo-export.js` | メモを .txt で別フォルダへ書き出し。File System Access API でフォルダを覚える（未対応ブラウザはダウンロード）。`saveBlobToExportFolder` は録音の書き出しにも使用 | 確認 |
| `src/js/recorder.js` | 録音（音声入力とは別）。MediaRecorder で録音→IndexedDB `hannah_audio` に保存、メモには目録 `memo.recordings` のみ。エディタ上部に再生バー | 確認 |
| `src/js/speech.js`（刷新） | 音声入力。ブラウザが勝手にセッションを終了しても自動で再開、カーソル位置に挿入して自動保存へつなぐ | 確認 |
| `src/js/ui.js` | トースト通知 `showToast` | 確認 |
| `src/css/notes.css` | メモ風3ペイン（フォルダ／一覧／エディタ）とモバイル3階層のスタイル。`all.css` の後に読み込んで上書き | 確認 |

## ロゴ

- ロゴは `Logo/`（`現行/` と `旧ロゴ/`）。配布用は `public/`（`logo.svg` `favicon.svg` `icon-192.png` `icon-512.png`）。アイコン画像は Inkscape の CLI（`/Applications/Inkscape.app/Contents/MacOS/inkscape in.svg --export-type=png -w 512 -o out.png`）で作った。
- 起動画面のロゴは `index.html` の `#boot-screen`（背景色の上に白いロゴだけ。アクセント色は使わない）。

## 注意

- DOMのid（`matrix-rain-canvas` など）とグローバル状態に依存したモジュール群。単体で切り出すには手直しが要る。
- `*.zip` と `*.json`（エクスポート/マージ済みデータ）は個人のメモの可能性があり、見ていない。**読まない。**
- `node_modules` は対象外。

## 確かめ方

```bash
cd /Users/yottaro/Desktop/dev/HANNAH
grep -n -E "countWords|extractTags" src/js/word-analysis.js
grep -n "setTypewriterMode" src/js/typewriter.js
```
