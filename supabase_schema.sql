-- ===================================================================
-- 불규칙 수입 대학생을 위한 지출 관리 서비스 - Supabase 테이블 설계
-- 2404 강경빈 / 계획서 6~7차시
--
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run 하면 됩니다.
-- ===================================================================

-- -------------------------------------------------------------------
-- 1) 지출 기록
--    계획서 '저장할 데이터 ③ 지출 기록(금액, 카테고리, 날짜, 메모)'
-- -------------------------------------------------------------------
create table if not exists public.expenses (
  id         bigint generated always as identity primary key,
  -- user_id : 이 기록이 누구 것인지. auth.uid() = 지금 로그인한 사람의 id
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  amount     integer not null check (amount > 0),   -- 금액 (0원 이하 저장 불가)
  category   text    not null,                      -- 식비/배달/카페/유흥·모임/교통/기타
  spent_on   date    not null,                      -- 쓴 날짜
  memo       text,                                  -- 메모 (선택)
  created_at timestamptz not null default now()
);

-- 내 기록을 날짜순으로 빨리 찾기 위한 색인
create index if not exists expenses_user_date_idx
  on public.expenses (user_id, spent_on desc);


-- -------------------------------------------------------------------
-- 2) 내 돈 정보 (잔액 / 다음 입금 예정일 / 고정지출 합계)
--    계획서 '저장할 데이터 ② 수입 기록, ⑤ 고정지출'
--    사람마다 한 줄만 있으면 되므로 user_id 를 기본키로 둡니다.
-- -------------------------------------------------------------------
create table if not exists public.money_info (
  user_id          uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  balance          integer not null default 0,   -- 현재 잔액(통장+현금)
  next_income_date date,                         -- 다음 입금 예정일
  fixed_cost       integer not null default 0,   -- 입금일까지 나갈 고정지출 합계
  updated_at       timestamptz not null default now()
);


-- -------------------------------------------------------------------
-- 3) 카테고리별 예산
--    계획서 '저장할 데이터 ④ 카테고리별 예산 설정값'
-- -------------------------------------------------------------------
create table if not exists public.budgets (
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null,
  amount   integer not null default 0,
  primary key (user_id, category)
);


-- ===================================================================
-- RLS (Row Level Security, 행 수준 보안)
--
-- ★ 이 부분이 이 프로젝트에서 가장 중요합니다.
--   금액은 민감한 개인 정보인데, 웹에 올라가는 열쇠(anon key)는
--   누구나 볼 수 있습니다. RLS 를 켜지 않으면 그 열쇠로 아무나
--   남의 지출 내역을 읽을 수 있습니다.
--
--   RLS 를 켜면 데이터베이스가 줄(row) 단위로 검사해서
--   'user_id 가 지금 로그인한 사람과 같은 줄'만 보여 줍니다.
-- ===================================================================

alter table public.expenses   enable row level security;
alter table public.money_info enable row level security;
alter table public.budgets    enable row level security;

-- using      : 읽기/수정/삭제할 때 "이 줄을 건드려도 되는가"
-- with check : 새로 넣거나 바꾼 값이 "여전히 내 것인가"
drop policy if exists "본인 지출만" on public.expenses;
create policy "본인 지출만" on public.expenses
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "본인 돈정보만" on public.money_info;
create policy "본인 돈정보만" on public.money_info
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "본인 예산만" on public.budgets;
create policy "본인 예산만" on public.budgets
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);
