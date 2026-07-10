import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// ─────────────────────────────────────────────
// おかね日記 v0.2(自分用・保存対応版)
// きろく / なづけ / 週の手紙 / 今月の一枚
// ─────────────────────────────────────────────

const ink = "#3A342C";
const paper = "#FBF8F1";
const paperDark = "#EFE8DA";
const midori = "#5B7561";
const midoriLight = "#EAF0EB";
const koharu = "#C67B5C";
const koharuLight = "#F8EDE7";
const gray = "#948C7E";

// 気持ち: あたたかい系 / ニュートラル / ざわざわ系 の3群・計14種
const FEELINGS = [
  "ほっとした", "わくわく", "じんわり幸せ", "誇らしい", "ありがたい", "たのしみ",
  "なんとなく", "迷った末に",
  "モヤモヤ", "しかたなく", "罪悪感", "不安", "背伸びした", "がまんの反動",
];
const WARM = new Set(["ほっとした", "わくわく", "じんわり幸せ", "誇らしい", "ありがたい", "たのしみ"]);

const DEFAULT_CATEGORIES = [
  "🍚 食", "🏠 住", "🚃 交通", "🎁 贈り物", "📚 学び", "☕ 息抜き",
  "👗 装い", "💊 健康", "🎮 遊び", "🌸 美容", "🧺 日用品", "👶 子ども",
  "🌱 じぶん実験", "❓ その他",
];

async function askClaude(prompt) {
  const res = await fetch("/.netlify/functions/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  return data.text;
}

const fmtDate = (d) => `${new Date(d).getMonth() + 1}/${new Date(d).getDate()}`;

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const [tab, setTab] = useState("kiroku");
  const [entries, setEntries] = useState([]);
  const [customCats, setCustomCats] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [letter, setLetter] = useState(null);
  const [album, setAlbum] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState(DEFAULT_CATEGORIES[0]);
  const [feeling, setFeeling] = useState("なんとなく");
  const [memo, setMemo] = useState("");
  const [newCat, setNewCat] = useState("");
  const [showCatEditor, setShowCatEditor] = useState(false);

  const allCategories = [...DEFAULT_CATEGORIES, ...customCats.map((c) => c.name)];

  // ── 認証 ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // ── 初期ロード ──
  useEffect(() => {
    if (!session) return;
    (async () => {
      const [e, c, ch, a] = await Promise.all([
        supabase.from("entries").select("*").order("entry_date", { ascending: true }),
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("characters").select("*").order("created_at"),
        supabase.from("album").select("*").order("created_at", { ascending: false }),
      ]);
      setEntries(e.data || []);
      setCustomCats(c.data || []);
      setCharacters(ch.data || []);
      setAlbum(a.data || []);
    })();
  }, [session]);

  const signIn = async () => {
    await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setSent(true);
  };

  // ── 記録 ──
  const addEntry = async () => {
    if (!amount) return;
    const { data, error } = await supabase
      .from("entries")
      .insert({ label, amount: Number(amount), feeling, memo })
      .select()
      .single();
    if (error) { setErr("保存できませんでした"); return; }
    setEntries([...entries, data]);
    setAmount(""); setMemo("");
  };

  const deleteEntry = async (id) => {
    await supabase.from("entries").delete().eq("id", id);
    setEntries(entries.filter((e) => e.id !== id));
  };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    const { data, error } = await supabase.from("categories").insert({ name: newCat.trim() }).select().single();
    if (!error) { setCustomCats([...customCats, data]); setNewCat(""); }
  };

  const deleteCategory = async (id) => {
    await supabase.from("categories").delete().eq("id", id);
    setCustomCats(customCats.filter((c) => c.id !== id));
  };

  const monthEntries = entries.filter((e) => {
    const d = new Date(e.entry_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const entriesText = (list) =>
    list.map((e) => `${fmtDate(e.entry_date)} ${e.label} ${e.amount}円 気持ち:${e.feeling} メモ:${e.memo}`).join("\n");

  // ── なづけ(外在化) ──
  const externalize = async () => {
    setLoading(true); setErr("");
    try {
      const prompt = `あなたはナラティブセラピーの「外在化」に精通した、あたたかいファシリテーターです。以下のおかね日記の記録から、繰り返し現れるお金との付き合い方のパターンを2〜3個見つけ、親しみやすい「キャラクター名」をつけてください。

この日記の持ち主について: 貯金はできるのに「自分のためにお金を使うこと」へのためらいが強い人です。節約パターンだけでなく「ためらい」「罪悪感」のパターンにも目を向けてください。

原則:
- 評価語(浪費・無駄遣い)は使わない。人とパターンを切り離す
- 各パターンが本人を「守ろうとしている意図」を添える
- ユニークアウトカム(例外の瞬間)を探す問いを1つ添える

記録:
${entriesText(monthEntries)}

JSONのみで回答:
{"characters":[{"emoji":"絵文字1つ","name":"名前(〜さん等)","pattern":"どんな時に現れるか(50字以内)","intention":"守ろうとしているもの(40字以内)","question":"例外を探す問い(60字以内)"}]}`;
      const parsed = JSON.parse(await askClaude(prompt));
      const rows = parsed.characters || [];
      await supabase.from("characters").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      const { data } = await supabase.from("characters").insert(rows).select();
      setCharacters(data || rows);
    } catch { setErr("うまく読み取れませんでした。もう一度どうぞ。"); }
    setLoading(false);
  };

  const renameCharacter = async (i, name) => {
    const next = [...characters];
    next[i] = { ...next[i], name };
    setCharacters(next);
    if (next[i].id) await supabase.from("characters").update({ name }).eq("id", next[i].id);
  };

  // ── 週の手紙 ──
  const writeLetter = async () => {
    setLoading(true); setErr("");
    try {
      const week = entries.slice(-15);
      const charText = characters.length ? characters.map((c) => `${c.emoji}${c.name}: ${c.pattern}`).join("\n") : "(まだ名づけ前)";
      const prompt = `あなたはナラティブセラピーの再著述を実践する、縁側でお茶を出してくれるような聞き手です。一週間のおかね日記への短い手紙を書いてください。

持ち主は、貯金はできるのに自分のためにお金を使うことにためらいがある人です。「使えたこと」「心が動いたこと」を、責めずに静かに照らしてください。合計額や使いすぎへの言及は絶対にしないでください。

記録:
${entriesText(week)}

名づけたパターン:
${charText}

JSONのみで回答:
{"greeting":"呼びかけ(20字以内)","body":"手紙本文(200〜280字・敬体・評価と助言なし・例外の瞬間に光を当てる)","questions":["開かれた問い(60字以内)","開かれた問い(60字以内)"]}`;
      const parsed = JSON.parse(await askClaude(prompt));
      setLetter(parsed);
      await supabase.from("letters").insert({ greeting: parsed.greeting, body: parsed.body, questions: parsed.questions });
    } catch { setErr("手紙が届きませんでした。もう一度どうぞ。"); }
    setLoading(false);
  };

  // ── 今月の一枚 ──
  const makeMonthStory = async () => {
    const chosen = entries.find((e) => e.id === selectedId);
    if (!chosen) return;
    setLoading(true); setErr("");
    try {
      const prompt = `あなたは、人の小さな選択を物語として掬い上げる書き手です。「今月いちばん心が動いた支出」として選ばれた記録から、短い物語を書いてください。

選ばれた一枚: ${fmtDate(chosen.entry_date)} ${chosen.label} ${chosen.amount}円 気持ち:${chosen.feeling} メモ:${chosen.memo}

前後の文脈(今月の記録):
${entriesText(monthEntries)}

原則:
- 「正解」として讃えるのではなく、そこにあった感覚(迷い・ためらい・ひらいた瞬間)を描く
- 「お金を使えた」ことではなく「好きに気づけた」ことが主役
- 未来へのささやかな示唆で終える。説教はしない。敬体

JSONのみで回答:
{"title":"タイトル(15字以内・詩的に)","story":"物語(150〜200字)","hint":"来月へのひとこと(40字以内)"}`;
      const parsed = JSON.parse(await askClaude(prompt));
      const monthLabel = `${new Date().getFullYear()}年${new Date().getMonth() + 1}月`;
      const { data } = await supabase
        .from("album")
        .insert({ month_label: monthLabel, title: parsed.title, story: parsed.story, hint: parsed.hint, entry_snapshot: chosen })
        .select()
        .single();
      setAlbum([data, ...album]);
      setSelectedId(null);
    } catch { setErr("物語が編めませんでした。もう一度どうぞ。"); }
    setLoading(false);
  };

  // ── ログイン画面 ──
  if (!session) {
    return (
      <div style={{ minHeight: "100vh", background: paper, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Zen Kaku Gothic New',sans-serif", color: ink }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap'); .mincho{font-family:'Shippori Mincho',serif;}`}</style>
        <div style={{ textAlign: "center", padding: 24, maxWidth: 380 }}>
          <div className="mincho" style={{ fontSize: 28, fontWeight: 700, letterSpacing: "0.22em", marginBottom: 8 }}>おかね日記</div>
          <div style={{ fontSize: 12, color: gray, marginBottom: 28, letterSpacing: "0.1em" }}>お金のジャーナリング</div>
          {sent ? (
            <p style={{ fontSize: 14, lineHeight: 2 }}>メールを送りました。<br />リンクを開くと日記がはじまります。</p>
          ) : (
            <>
              <input type="email" placeholder="メールアドレス" value={email} onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", border: `1px solid ${paperDark}`, borderRadius: 8, fontSize: 15, marginBottom: 12, background: "#fff" }} />
              <button onClick={signIn}
                style={{ width: "100%", padding: 13, background: midori, color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer" }}>
                はじめる(ログインリンクを送る)
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── 本体 ──
  return (
    <div style={{ minHeight: "100vh", background: paper, color: ink, fontFamily: "'Zen Kaku Gothic New','Hiragino Kaku Gothic ProN',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap');
        .mincho { font-family: 'Shippori Mincho','Hiragino Mincho ProN',serif; }
        button { cursor: pointer; }
        input, select { font-family: inherit; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>

      <header style={{ padding: "26px 20px 10px", textAlign: "center", position: "relative" }}>
        <div className="mincho" style={{ fontSize: 25, fontWeight: 700, letterSpacing: "0.22em" }}>おかね日記</div>
        <div style={{ fontSize: 11, color: gray, marginTop: 6, letterSpacing: "0.14em" }}>数字じゃなく、物語をつける</div>
        <button onClick={() => supabase.auth.signOut()} style={{ position: "absolute", right: 14, top: 14, fontSize: 11, color: gray, background: "none", border: "none" }}>ログアウト</button>
      </header>

      <nav style={{ display: "flex", justifyContent: "center", gap: 2, padding: "8px 8px 14px", flexWrap: "wrap" }}>
        {[["kiroku", "きろく"], ["nazuke", "なづけ"], ["tegami", "週の手紙"], ["ichimai", "今月の一枚"]].map(([key, name]) => (
          <button key={key} onClick={() => setTab(key)} className="mincho"
            style={{ padding: "8px 15px", fontSize: 14, letterSpacing: "0.08em", border: "none",
              borderBottom: tab === key ? `2px solid ${midori}` : "2px solid transparent",
              background: "transparent", color: tab === key ? midori : gray, fontWeight: tab === key ? 700 : 500 }}>
            {name}
          </button>
        ))}
      </nav>

      <main style={{ maxWidth: 560, margin: "0 auto", padding: "0 20px 60px" }}>
        {err && <div style={{ background: koharuLight, color: koharu, padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{err}</div>}

        {tab === "kiroku" && (
          <div>
            <div style={{ background: "#fff", border: `1px solid ${paperDark}`, borderRadius: 14, padding: 18, marginBottom: 18 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <input type="number" placeholder="金額" value={amount} onChange={(e) => setAmount(e.target.value)}
                  style={{ flex: 1, padding: "10px 12px", border: `1px solid ${paperDark}`, borderRadius: 8, fontSize: 16, background: paper, minWidth: 0 }} />
                <select value={label} onChange={(e) => setLabel(e.target.value)}
                  style={{ padding: "10px 8px", border: `1px solid ${paperDark}`, borderRadius: 8, fontSize: 14, background: paper, maxWidth: "45%" }}>
                  {allCategories.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>

              <button onClick={() => setShowCatEditor(!showCatEditor)} style={{ fontSize: 11, color: gray, background: "none", border: "none", padding: 0, marginBottom: 8, textDecoration: "underline" }}>
                {showCatEditor ? "カテゴリ編集を閉じる" : "＋ 自分のカテゴリを追加する"}
              </button>
              {showCatEditor && (
                <div style={{ background: paper, borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input placeholder="例: 🎤 推し活" value={newCat} onChange={(e) => setNewCat(e.target.value)}
                      style={{ flex: 1, padding: "8px 10px", border: `1px solid ${paperDark}`, borderRadius: 8, fontSize: 13, background: "#fff" }} />
                    <button onClick={addCategory} style={{ padding: "8px 14px", background: midori, color: "#fff", border: "none", borderRadius: 8, fontSize: 13 }}>追加</button>
                  </div>
                  {customCats.map((c) => (
                    <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, background: "#fff", border: `1px solid ${paperDark}`, borderRadius: 999, padding: "3px 10px", margin: "0 6px 6px 0" }}>
                      {c.name}
                      <button onClick={() => deleteCategory(c.id)} style={{ border: "none", background: "none", color: gray, fontSize: 12, padding: 0 }}>×</button>
                    </span>
                  ))}
                </div>
              )}

              <div style={{ fontSize: 11, color: gray, marginBottom: 6 }}>そのとき、どんな気持ちでしたか</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {FEELINGS.map((f) => (
                  <button key={f} onClick={() => setFeeling(f)}
                    style={{ padding: "5px 11px", borderRadius: 999, fontSize: 12,
                      border: `1px solid ${feeling === f ? (WARM.has(f) ? koharu : midori) : paperDark}`,
                      background: feeling === f ? (WARM.has(f) ? koharuLight : midoriLight) : "#fff",
                      color: feeling === f ? (WARM.has(f) ? koharu : midori) : gray }}>
                    {f}
                  </button>
                ))}
              </div>
              <input placeholder="ひとことメモ(場面を残すと、あとで物語になります)" value={memo} onChange={(e) => setMemo(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: `1px solid ${paperDark}`, borderRadius: 8, fontSize: 14, background: paper, marginBottom: 12 }} />
              <button onClick={addEntry}
                style={{ width: "100%", padding: 12, background: midori, color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, letterSpacing: "0.1em" }}>
                日記に書き入れる
              </button>
            </div>

            <div style={{ fontSize: 11.5, color: gray, marginBottom: 8 }}>今月の日記 {monthEntries.length}ページ(合計は出しません。ここは日記なので)</div>
            {monthEntries.slice().reverse().map((e) => (
              <div key={e.id} style={{ display: "flex", alignItems: "baseline", gap: 9, padding: "11px 4px", borderBottom: `1px dashed ${paperDark}` }}>
                <span style={{ fontSize: 11, color: gray, minWidth: 34 }}>{fmtDate(e.entry_date)}</span>
                <span style={{ fontSize: 13 }}>{e.label}</span>
                <span className="mincho" style={{ fontSize: 13, minWidth: 58, textAlign: "right", color: gray }}>{e.amount.toLocaleString()}円</span>
                <span style={{ fontSize: 11, color: WARM.has(e.feeling) ? koharu : midori, background: WARM.has(e.feeling) ? koharuLight : midoriLight, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>{e.feeling}</span>
                <span style={{ fontSize: 12, flex: 1, lineHeight: 1.6 }}>{e.memo}</span>
                <button onClick={() => deleteEntry(e.id)} style={{ border: "none", background: "none", color: paperDark, fontSize: 13 }}>×</button>
              </div>
            ))}
          </div>
        )}

        {tab === "nazuke" && (
          <div>
            <p style={{ fontSize: 13, color: gray, lineHeight: 2, marginBottom: 16 }}>
              あなたが問題なのではありません。問題が、問題です。<br />
              「つい我慢しちゃう」「使うとき罪悪感がある」——そんなパターンに名前をつけると、性格ではなく、付き合い方を選べる相手になります。
            </p>
            <button onClick={externalize} disabled={loading} className="mincho"
              style={{ width: "100%", padding: 13, background: characters.length ? "transparent" : midori, color: characters.length ? midori : "#fff", border: `1.5px solid ${midori}`, borderRadius: 8, fontSize: 14, fontWeight: 700, letterSpacing: "0.1em", opacity: loading ? 0.5 : 1, marginBottom: 16 }}>
              {loading ? "日記を読んでいます…" : characters.length ? "もういちど名づけてもらう" : "日記から、名前を見つけてもらう"}
            </button>
            {characters.map((c, i) => (
              <div key={c.id || i} style={{ background: "#fff", border: `1px solid ${paperDark}`, borderRadius: 14, padding: 20, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 26 }}>{c.emoji}</span>
                  <input className="mincho" value={c.name} onChange={(ev) => renameCharacter(i, ev.target.value)}
                    style={{ fontSize: 17, fontWeight: 700, border: "none", borderBottom: `1px dashed ${paperDark}`, background: "transparent", color: ink, flex: 1, padding: "2px 4px" }} />
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.9, marginBottom: 8 }}>{c.pattern}</div>
                <div style={{ fontSize: 12, color: midori, background: midoriLight, padding: "8px 12px", borderRadius: 8, lineHeight: 1.7, marginBottom: 10 }}>守ろうとしているもの:{c.intention}</div>
                <div className="mincho" style={{ fontSize: 13, color: koharu, lineHeight: 1.9, borderLeft: `3px solid ${koharu}`, paddingLeft: 10 }}>{c.question}</div>
              </div>
            ))}
          </div>
        )}

        {tab === "tegami" && (
          <div>
            {!letter && (
              <div style={{ textAlign: "center", padding: "36px 0" }}>
                <p style={{ fontSize: 13, color: gray, lineHeight: 2, marginBottom: 20 }}>
                  週にいちど、日記を読んだ聞き手から手紙が届きます。<br />評価も助言も、書かれていません。
                </p>
                <button onClick={writeLetter} disabled={loading} className="mincho"
                  style={{ padding: "13px 32px", background: midori, color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, letterSpacing: "0.12em", opacity: loading ? 0.5 : 1 }}>
                  {loading ? "手紙を書いています…" : "手紙を受け取る"}
                </button>
              </div>
            )}
            {letter && (
              <div style={{ background: "#fff", border: `1px solid ${paperDark}`, borderRadius: 4, padding: "34px 28px", boxShadow: "0 2px 12px rgba(58,52,44,.06)" }}>
                <div className="mincho" style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>{letter.greeting}</div>
                <div className="mincho" style={{ fontSize: 14.5, lineHeight: 2.2, whiteSpace: "pre-wrap", marginBottom: 22 }}>{letter.body}</div>
                <div style={{ borderTop: `1px solid ${paperDark}`, paddingTop: 16 }}>
                  {letter.questions?.map((q, i) => (
                    <div key={i} className="mincho" style={{ fontSize: 13.5, color: koharu, lineHeight: 2, marginBottom: 10, borderLeft: `3px solid ${koharu}`, paddingLeft: 12 }}>{q}</div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: gray, textAlign: "right", marginTop: 14 }}>── 縁側の聞き手より</div>
              </div>
            )}
          </div>
        )}

        {tab === "ichimai" && (
          <div>
            <p style={{ fontSize: 13, color: gray, lineHeight: 2, marginBottom: 16 }}>
              月にいちど、いちばん<span style={{ color: koharu }}>心が動いた支出</span>を選びます。<br />
              金額の大小は関係ありません。「あ、私これが好きだったんだ」に気づくための一枚です。
            </p>
            {monthEntries.map((e) => (
              <button key={e.id} onClick={() => setSelectedId(e.id)}
                style={{ display: "flex", width: "100%", boxSizing: "border-box", textAlign: "left", alignItems: "baseline", gap: 10, padding: "12px", marginBottom: 6, borderRadius: 10,
                  border: `1.5px solid ${selectedId === e.id ? koharu : paperDark}`,
                  background: selectedId === e.id ? koharuLight : "#fff" }}>
                <span style={{ fontSize: 11, color: gray, minWidth: 34 }}>{fmtDate(e.entry_date)}</span>
                <span style={{ fontSize: 13 }}>{e.label}</span>
                <span className="mincho" style={{ fontSize: 13, color: gray, minWidth: 56, textAlign: "right" }}>{e.amount.toLocaleString()}円</span>
                <span style={{ fontSize: 12, flex: 1, lineHeight: 1.6 }}>{e.memo}</span>
              </button>
            ))}
            <button onClick={makeMonthStory} disabled={loading || !selectedId} className="mincho"
              style={{ width: "100%", marginTop: 14, padding: 14, background: selectedId ? koharu : paperDark, color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, letterSpacing: "0.12em", opacity: loading ? 0.5 : 1 }}>
              {loading ? "物語を編んでいます…" : "この一枚で、今月の物語をつくる"}
            </button>

            {album.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <div style={{ fontSize: 11.5, color: gray, marginBottom: 10, letterSpacing: "0.1em" }}>アルバム(一年で12枚たまります)</div>
                {album.map((a) => (
                  <div key={a.id} style={{ background: "#fff", border: `1.5px solid ${koharu}`, borderRadius: 14, padding: "24px 22px", marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: koharu, letterSpacing: "0.2em", marginBottom: 6 }}>{a.month_label}の一枚</div>
                    <div className="mincho" style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{a.title}</div>
                    <div className="mincho" style={{ fontSize: 13.5, lineHeight: 2.1, marginBottom: 12 }}>{a.story}</div>
                    <div style={{ fontSize: 12, color: midori, background: midoriLight, padding: "9px 13px", borderRadius: 8, lineHeight: 1.8 }}>{a.hint}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
