-- ===================================================================
-- 추가 작업 6 : 입금 예정을 여러 건 등록 (동료 피드백)
--   2511 정영광 / 1310 박민석 : 알바비·용돈·과외비가 각각 다른 날 들어오는데
--   입금일을 하나만 넣을 수 있어 계획을 세우기 어렵다는 의견.
--   두 명이 같은 지적을 해서 가장 중요하다고 보고 반영한다.
-- Supabase > SQL Editor 에 붙여넣고 Run
-- ===================================================================

create table if not exists public.planned_incomes (
  id        bigint generated always as identity primary key,
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind      text    not null,                    -- 알바비 / 용돈 / 과외비 / 기타
  amount    integer not null check (amount > 0),
  due_date  date    not null,                    -- 들어올 날
  repeat_monthly boolean not null default true,  -- 매달 같은 날 반복되는지
  created_at timestamptz not null default now()
);

create index if not exists planned_incomes_user_date_idx
  on public.planned_incomes (user_id, due_date);

alter table public.planned_incomes enable row level security;

drop policy if exists "본인 입금예정만" on public.planned_incomes;
create policy "본인 입금예정만" on public.planned_incomes
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);
