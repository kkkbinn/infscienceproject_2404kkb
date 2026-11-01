-- ===================================================================
-- 추가 작업 3 : 고정지출을 항목별로 저장할 표
-- 계획서 Input ③ "통신비·구독료·교통 정기권 등 항목명과 금액, 결제일"
-- Supabase > SQL Editor 에 붙여넣고 Run
-- ===================================================================

create table if not exists public.fixed_costs (
  id       bigint generated always as identity primary key,
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name     text    not null,                 -- 통신비 / 넷플릭스 / 교통 정기권 …
  amount   integer not null check (amount > 0),
  pay_day  integer check (pay_day between 1 and 31),   -- 매달 결제일
  created_at timestamptz not null default now()
);

create index if not exists fixed_costs_user_idx on public.fixed_costs (user_id);

-- 다른 표와 똑같이 RLS 를 켜고 본인 것만 보이게 합니다
alter table public.fixed_costs enable row level security;

drop policy if exists "본인 고정지출만" on public.fixed_costs;
create policy "본인 고정지출만" on public.fixed_costs
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);
