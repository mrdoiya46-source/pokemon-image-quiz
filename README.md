# ポケモン画像テスト テスト版

このフォルダは、アップロードされた Excel から生成した **GitHub Pages 用のテスト版** です。

## 含まれるもの
- `index.html` : 画面本体
- `style.css` : 見た目
- `app.js` : 出題・判定・復習
- `storage.js` : 端末内保存
- `utils.js` : 正答判定補助
- `questions.json` : Excel から変換した問題データ
- `questions-data.js` : ローカルでもそのまま開けるようにした問題データ
- `convert_excel_to_json.py` : Excel を再度 JSON 化するスクリプト
- `images/` : 画像が未配置のため、同名のプレースホルダー画像を自動生成済み
- `pokemon_master_test.xlsx` : 元の Excel

## 使い方
1. まずこのまま `index.html` を開くと、画面遷移と判定の流れを試せます。
2. 本番にする場合は、`images/` のプレースホルダー画像を **同じファイル名の実画像** で置き換えてください。
3. Excel を更新したら、Python が使える環境で `python convert_excel_to_json.py` を実行すると `questions.json` が更新されます。
4. GitHub Pages に載せる場合は、このフォルダ一式をリポジトリのルートへ置いてください。

## この Excel から読み取った問題数
- 10 問

## Excel 上で気になった点
- 
0646a の画像パス images/0636-Normal.png は番号不一致の可能性があります。- ID 646b はゼロ埋めが不統一です。- 646b の画像パス images/0646-White.png は番号不一致の可能性があります。- ID 646c はゼロ埋めが不統一です。- 646c の画像パス images/0646-Black.png は番号不一致の可能性があります。

## 補足
- 復習データはブラウザの `localStorage` に保存されます。
- ユーザー名ごとに端末内で分けて記録します。
- 別の端末には同期されません。
