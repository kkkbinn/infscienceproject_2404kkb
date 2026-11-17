-- ===================================================================
-- 추가 작업 7
--   ① 입금 주기를 자유롭게 (매달 / 며칠마다 / 몇 달마다 / 한 번만)
--   ② 목표 금액 : 이날까지 얼마를 모으고 싶다
-- Supabase > SQL Editor 에 붙여넣고 Run
-- ===================================================================

-- ① 입금 주기
--    전에는 '매달 반복인가 아닌가' 둘 중 하나였다.
--    격주로 들어오는 알바비나 두 달에 한 번 들어오는 돈은 적을 수 없었다.
alter table public.planned_incomes
  add column if not exists repeat_kind  text    not null default 'months',  -- none / days / months
  add column if not exists repeat_every integer not null default 1;         -- 몇 일마다 / 몇 달마다

-- 예전에 넣어 둔 값을 새 칸으로 옮긴다
update public.planned_incomes
   set repeat_kind  = case when repeat_monthly then 'months' else 'none' end,
       repeat_every = 1
 where repeat_kind = 'months' and repeat_every = 1;


-- ② 목표 금액
create table if not exists public.goals (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text    not null,                     -- 노트북 사기, 여행비 …
  amount      integer not null check (amount > 0),  -- 모으고 싶은 금액
  target_date date    not null,                     -- 그날까지
  created_at  timestamptz not null default now()
);

create index if not exists goals_user_date_idx on public.goals (user_id, target_date);

alter table public.goals enable row level security;

drop policy if exists "본인 목표만" on public.goals;
create policy "본인 목표만" on public.goals
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);
