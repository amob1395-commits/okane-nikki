-- おかね日記 スキーマ
-- Supabase SQL Editor で実行してください

-- 日記の記録
create table entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  entry_date date not null default current_date,
  label text not null,
  amount integer not null,
  feeling text not null,
  memo text default '',
  created_at timestamptz default now()
);

-- カスタムカテゴリ
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  sort_order integer default 0
);

-- 名づけ(外在化キャラクター)
create table characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  emoji text,
  name text not null,
  pattern text,
  intention text,
  question text,
  created_at timestamptz default now()
);

-- 週の手紙
create table letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  greeting text,
  body text,
  questions jsonb,
  created_at timestamptz default now()
);

-- 今月の一枚(アルバム)
create table album (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  month_label text not null,
  title text,
  story text,
  hint text,
  entry_snapshot jsonb,
  created_at timestamptz default now()
);

-- RLS: 自分のデータしか読み書きできない
alter table entries enable row level security;
alter table categories enable row level security;
alter table characters enable row level security;
alter table letters enable row level security;
alter table album enable row level security;

create policy "own entries" on entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own categories" on categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own characters" on characters for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own letters" on letters for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own album" on album for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
