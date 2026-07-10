# おかね日記 — お金のジャーナリング(自分用・段階2)

数字じゃなく、物語をつける家計簿。
React + Supabase(保存/ログイン) + Netlify(ホスティング + Claude API中継)。

## セットアップ手順(30〜60分)

### 1. Supabase(無料)
1. https://supabase.com でプロジェクト作成
2. SQL Editor で `supabase-schema.sql` の中身を実行
3. Authentication → Providers → Email(Magic Link)が有効なことを確認
4. Settings → API から `Project URL` と `anon public key` を控える

### 2. ローカルで起動
```bash
npm install
cp .env.example .env   # 控えた2つの値を記入
npm run dev
```

### 3. Netlifyにデプロイ
1. GitHubにpush → Netlifyで「Import from Git」
2. 環境変数を3つ設定:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`(console.anthropic.com で発行。フロントには出ません)
3. デプロイ完了後、Supabase → Authentication → URL Configuration に
   NetlifyのURLを追加(Magic Linkのリダイレクト用)

### 4. スマホで「アプリ化」(PWA)
デプロイされたURLをスマホで開き、「ホーム画面に追加」。
これで毎日ワンタップで開けます。

## Claude Codeへの依頼例
このフォルダを渡して:
- 「気持ちタグもカスタム編集できるようにして」
- 「週の手紙を毎週日曜に自動生成してメール送信して」(Supabase Edge Functions + Resend)
- 「アルバムを画像として書き出せるようにして」(Threadsシェア用)

## 構成
```
src/App.jsx                 … アプリ本体(4タブ: きろく/なづけ/週の手紙/今月の一枚)
src/supabase.js             … DB接続
netlify/functions/claude.js … Claude API中継(キー秘匿)
supabase-schema.sql         … テーブル定義 + RLS(自分のデータしか見えない設定)
public/manifest.json        … PWA設定
```

## 運用コスト目安
- Supabase/Netlify: 無料枠で十分
- Claude API: 一人で使う分には月数十〜数百円程度
