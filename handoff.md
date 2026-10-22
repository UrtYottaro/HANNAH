# HANNAH — 引き継ぎメモ

最終更新: 2026-10-04。バージョン番号は管理しない（製品化していないため）。実コードと `CODE.md` を優先すること。

- ライブURL: https://urtyottaro.github.io/HANNAH/（公開を止める場合は Settings → Pages と `.github/workflows/deploy.yml` を確認）
- リポジトリ: https://github.com/urtyottaro/HANNAH

## 概要
個人用のメモ帳 PWA。Apple のメモ風の 3 ペイン UI（フォルダ／日付セクション付きメモ一覧／エディタ）。配色は「テーマ」方式（アクセント・背景・前景の3色。既定は GitHub ダーク `#1f6feb` / `#0d1117` / `#e6edf3`）。設定 → 外観で、モード（自動/ライト/ダーク）、プリセット28種のテーマ、色の手入力ができる（`src/js/theme.js`）。設定画面は全画面の2ペイン（左: 項目と検索、右: 内容のカード。`notes.css` 末尾）。色はすべて CSS 変数経由で、`notes.css` / `all.css` に色の直書きを増やさないこと（半透明の白は `rgba(var(--fg-rgb), α)`、アクセント面の上の文字は `var(--on-accent)`）。

## 構成（Vite + バニラ JS）
```
index.html          HTML の骨組み（起動時の黒い覆い #boot-screen を含む）
src/main.js         CSS・各モジュールの読み込み → initApp
src/css/all.css     旧来のスタイル（:root の色変数もここ）
src/css/notes.css   3ペイン・モバイル3階層・ツールバー等。all.css の後に読み込み上書き
src/js/*.js         機能別モジュール（詳細は CODE.md）
public/             manifest.json・アイコン
dist/               ビルド出力（git 管理外。GitHub Actions が再生成）
```

## 主な仕様
- **保存:** localStorage `memoire_data`（メモ・フォルダ・タスク・ゴミ箱）。設定は `hannah_settings`。常時編集＋自動保存（入力 0.6 秒後）。
- **タイトル:** 本文の 1 行目。旧形式のメモは起動時に `migrateMemoTitles` がタイトルを先頭行へ統合（初回のみ、元データを `memoire_data_backup_before_firstline_title` に退避）。
- **一覧:** 更新日の新しい順。「すべてのメモ」＝全件、「メモ」＝フォルダ未所属。何も書かずに離れたメモは自動で破棄。
- **フォルダ:** 左上のボタンで新規作成（その場で命名）、サイドバーの開閉。右クリックまたは「…」で名前変更・削除・書き出し。
- **スワイプ（一覧）:** 動きはメモ標準アプリの滑らかさを手本にしている（指・トラックパッドに 1:1 で追従、端でゴムのように重くなる、離した勢いを引き継いでバネの物理計算で開閉、触れた瞬間に止まる、トラックパッドの慣性は勢いの減り方で見分けて無視。開いた行を反対方向へスワイプしたときは真ん中で止め、反対側のボタンは次のスワイプで出す。スワイプは行全体（出ているボタンの上も）で受け付ける。カードは常に塗りつぶしで、ホバー・選択中の色は inset の box-shadow で重ねる＝スワイプ中に背景が切り替わらず点滅しない）。調整値は `swipe.js` 冒頭（`SPRING` の response・damping（ふだんは弾みなし）・flickDamping（はじいたときだけ弾む）・flickSpeed、行き先の予測 `DECELERATION_RATE`（UIScrollView と同じ指数減衰 0.998）、強いスワイプの位置 `strongAt`）。指針の出典は Emil Kowalski の apple-design（ジェスチャーに CSS の transition/keyframes は使わない、バネ＋速度の引き継ぎ）。 左へ=共有（.txt を書き出し先フォルダへ）とゴミ箱、右へ=ピン留め、右へ強く=ボタンなしでピン留め／解除。`memo.pinned`。書き出しは「コピー」でメモは消さない。書き出し先は 設定 → データ。
- **録音:** ツールバーの録音ボタン。音声は IndexedDB `hannah_audio`（JSON エクスポートには含まれない）。
- **音声入力（マイク）:** 勝手に切れても自動再開（`speech.js`）。
- **ツールバー:** 新規メモ・マイク（音声入力）・録音の3つと、検索欄だけ。表示モード（目）・メール送信・リンク挿入・削除のボタンは、2026-10-05 に画面から外した（コード `toggleEditMode` `mail.js` `insertLinkPrompt` と、メールの画面の HTML は残してあり、ボタンを戻せば再び使える）。メモの削除は、一覧のスワイプ（ゴミ箱）から。何も開いていないときのエディタは空白（案内文なし）。
- **テーマ:** `hannah_settings.theme`（`{name, accent, bg, fg}`）と `themeMode`。起動画面の色もこの背景色に合わせる（`index.html` の先頭スクリプト）。
- **フォント:** 設定 →「フォント」。上の「フォント」で4か所（画面全体 / 一覧のタイトル / メモ本文 / 日付・ボタン）すべてに適用、各行で個別に選べる（カスタム）。一覧は組み込み・読み込み済みを区別せず1つ。削除は専用ボタン（読み込んだフォントのみ・確認つき）。適用は CSS 変数 `--font-title` `--font-display` `--font-mono` と body のフォントで反映（`font-manager.js` の `applyFontVars`）。
- **モバイル（幅 600px 以下）:** フォルダ → 一覧 → エディタ（`mobile.js`）。

## ロゴ
- 置き場: `Logo/`（`現行/` が今のロゴ。`旧ロゴ/` に過去のロゴ。一覧は `Logo/README.md`）。
- 今のロゴ: AとHのモノグラム（`Logo/現行/HANNAH_AH_logo.svg`、黒一色・背景なし。ロゴの外枠は 36〜156 の正方形）。
- 配布用（`public/`）: `logo.svg`（元ロゴ）、`favicon-v3.svg`（ブラウザのタブのアイコン。枠なしで、ロゴの外枠をアイコンの枠いっぱいに。ダークのタブでは白、ライトのタブでは黒）、`favicon-v3.png`（SVG 非対応ブラウザ用。白いロゴ、背景透明）、`icon-192.png`・`icon-512.png`（アプリのアイコン。暗い背景＋白いロゴで、ロゴは幅・高さの50%（参考にしたアプリのアイコンは高さ50%。ロゴは正方形なので幅も50%に合わせた）。OS が円形に切り抜いてもはみ出さない。`manifest.json` の purpose は any maskable。ファビコンは上のとおり別の作り）。アクセント色の円は使わない。ファビコンはブラウザのキャッシュが強いので、作り直したらファイル名の番号（`-v3`）を上げ、`index.html` の `<link>` も合わせる。
- 起動画面: `index.html` の `#boot-screen`。背景色だけの画面に、ロゴ（白）を1つ。アクセント色は使わない。明るい背景（ライトモード）のときだけロゴを黒にする。色は前回のテーマ（`hannah_boot_bg` / `hannah_boot_logo`）。最低0.7秒は表示。
- ロゴを替える手順: `Logo/現行/` に新しい SVG を置く → 古い SVG は `旧ロゴ/` へ → `public/` の上のファイル（アイコン PNG は Inkscape の CLI で SVG から書き出し）と、`index.html` の起動画面の `<path d=...>` を差し替える（起動画面のロゴは、ロゴの外枠 36〜156 に合わせた `viewBox="36 36 120 120"`）。

## 開発の流れ
1. `npm run dev`（または `npx vite --port 5173`）でローカル確認
2. 構文確認: `node --check src/js/*.js` と `npx vite build --outDir <一時フォルダ>`
3. GitHub のブラウザ UI で変更ファイルをアップロード（main への push で自動デプロイ）

## 注意
- 大きな変更の前は `backup_vX_Y_Z/` に src と index.html をコピーしておく（git 管理外）。
- CSS のセレクタ重複に注意（過去に意図しない上書きバグあり）。新しい見た目は `notes.css` に書く。
- Canvas 操作には null ガードを入れる。
- ブラウザ拡張の CSP `eval` エラーはアプリと無関係。

## デスクトップ版（Windows）

- `electron/main.js`：dist/ を `app://hannah/` で配信して表示するだけの薄い殻。マイクは自分の画面にだけ許可。
- 音声入力は Electron では動かない（`speech.js` の `toggleMic` が Electron を検知して断る）。録音（MediaRecorder）は動く。
- `npm run dist:win` で `release/HANNAH-Setup-<version>.exe`（NSIS）。Mac からも作れる。`.github/workflows/build-windows.yml` は `v*` タグで Releases に添付。
- 検索欄の表示は、Mac 以外では「Ctrl+K」になる（`search.js`）。
