-- ===================================================================
-- 추가 작업 : 다음 수입 정보(종류·금액)를 저장할 칸 추가
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run
-- ===================================================================

alter table public.money_info
  add column if not exists income_type   text,              -- 알바비 / 용돈 / 과외비 …
  add column if not exists income_amount integer default 0; -- 들어올 금액
