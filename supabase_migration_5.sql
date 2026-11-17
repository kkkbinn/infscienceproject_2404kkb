-- ===================================================================
-- 추가 작업 5 : 추가 입금(꽁돈) 기록
--   세뱃돈·환급·중고거래처럼 예정에 없던 돈이 들어온 것을 기록한다.
--   지출과 똑같이 기록 시각을 남겨, 잔액을 적은 뒤에 들어온 돈만
--   실제 잔액에 더하도록 한다.
-- Supabase > SQL Editor 에 붙여넣고 Run
-- ===================================================================

create table if not exists public.extra_incomes (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  amount      integer not null check (amount > 0),
  memo        text,
  received_on date not null,
  created_at  timestamptz not null default now()
);

create index if not exists extra_incomes_user_date_idx
  on public.extra_incomes (user_id, received_on desc);

alter table public.extra_incomes enable row level security;

drop policy if exists "본인 추가입금만" on public.extra_incomes;
create policy "본인 추가입금만" on public.extra_incomes
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);
