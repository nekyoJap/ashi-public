# ashi-public

競輪のレース情報・結果を掲載する静的サイト。

| ページ | ファイル |
|--------|---------|
| トップ | `index.html` |
| 飛びつきチャンネル | `channel.html` |
| レース情報（出走表） | `race.html` |
| レース結果 | `result.html` |
| 運営会社 | `company/index.html` |

## 共通アセット

`channel.html` は共通デザインシステムを利用しています。

- `assets/keirin-ui.css` — 競輪専門紙ポータル調のスタイル（ネイビー基調＋赤アクセント、グレードバッジ、車番7色、高密度テーブル）
- `assets/keirin-ui.js` — 共通ユーティリティ（`KUI`）。日付操作・データ取得・バッジ描画・ライン表示・共通ヘッダー／フッター

`race.html` / `result.html` は従来の Tailwind ベースのままで、共通アセットは未適用です。

レースデータは Google Cloud Storage から取得しています。ビルド不要の静的サイトで、
GitHub Pages（`main` / root）で配信しています。
