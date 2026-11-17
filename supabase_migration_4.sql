-- ===================================================================
-- 추가 작업 4 : 동료 피드백 반영 (2026-11-17)
--   · 1511 이정현 / 1315 전재현 → 빠른 입력 항목을 직접 등록  (계획서 Input ⑤)
--   · 2616 최유빈            → 예정된 지출을 미리 등록        (계획서 Input ⑥)
-- Supabase > SQL Editor 에 붙여넣고 Run
-- ===================================================================

-- 원터치 빠른 입력 버튼 항목
create table if not exists public.quick_items (
  id       bigint generated always as identity primary key,
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name     text    not null,
  amount   integer not null check (amount > 0),
  category text    not null,
  created_at timestamptz not null default now()
);
create index if not exists quick_items_user_idx on public.quick_items (user_id);

-- 예정된 지출 (생일 선물처럼 그날 한 번 나갈 돈)
create table if not exists public.planned_expenses (
  id       bigint generated always as identity primary key,
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name     text    not null,
  amount   integer not null check (amount > 0),
  due_date date    not null,
  created_at timestamptz not null default now()
);
create index if not exists planned_user_date_idx on public.planned_expenses (user_id, due_date);

-- 다른 표와 똑같이 RLS 적용
alter table public.quick_items      enable row level security;
alter table public.planned_expenses enable row level security;

drop policy if exists "본인 빠른입력만" on public.quick_items;
create policy "본인 빠른입력만" on public.quick_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "본인 예정지출만" on public.planned_expenses;
create policy "본인 예정지출만" on public.planned_expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
