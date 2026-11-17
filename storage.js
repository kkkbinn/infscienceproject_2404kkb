/* ===================================================================
   저장 담당 - storage.js  (5차시 → 7·8차시)

   5차시: 브라우저의 localStorage 에 저장 (그 브라우저에만 남음)
   7·8차시: Supabase 데이터베이스에 저장 (어느 기기에서 열어도 내 기록이 보임)

   ★ 5차시에 저장을 이 파일 하나로 몰아 둔 덕분에,
     화면을 그리는 app.js·expense.js·stats.js 는 거의 고치지 않고
     이 파일 안쪽만 Supabase 로 바꿀 수 있었습니다.

   ★ 함수가 전부 async 인 이유
     localStorage 는 내 컴퓨터 안이라 바로 값이 나오지만,
     Supabase 는 인터넷 건너편에 있어서 "다녀올 때까지 기다려야" 합니다.
     그래서 부르는 쪽에서 await 를 붙입니다.
   =================================================================== */

const 저장소 = (function () {

  const 카테고리목록 = ["식비", "배달", "카페", "유흥/모임", "교통", "기타"];

  // 카테고리별 한 달 예산 기본값 (처음 로그인한 사람에게 넣어 줍니다)
  const 기본예산 = {
    "식비": 150000, "배달": 60000, "카페": 40000,
    "유흥/모임": 160000, "교통": 100000, "기타": 50000
  };

  return {
    카테고리목록: 카테고리목록,
    기본예산: 기본예산,

    /* ---------------- 지출 기록 ---------------- */

    // 내 지출을 전부 불러옵니다.
    // RLS 덕분에 "where user_id = 나" 를 적지 않아도
    // 데이터베이스가 알아서 내 것만 걸러 줍니다.
    지출목록읽기: async function () {
      const { data, error } = await sb
        .from("expenses")
        .select("id, amount, category, spent_on, memo, created_at")
        .order("spent_on", { ascending: true })
        .order("id", { ascending: true });

      if (error) { console.error("지출 불러오기 실패", error); return []; }

      // 화면 코드가 쓰던 이름(번호·금액·카테고리·날짜·메모)으로 바꿔 줍니다
      return data.map(function (r) {
        return {
          번호: r.id, 금액: r.amount, 카테고리: r.category,
          날짜: r.spent_on, 메모: r.memo || "",
          기록시각: r.created_at          // 잔액을 입력한 뒤에 쓴 돈인지 가리는 데 씁니다
        };
      });
    },

    // 지출 한 건 추가. user_id 는 테이블 기본값 auth.uid() 가 알아서 넣습니다.
    지출추가: async function (금액, 카테고리, 날짜, 메모) {
      const { data, error } = await sb
        .from("expenses")
        .insert({ amount: 금액, category: 카테고리, spent_on: 날짜, memo: 메모 })
        .select("id")
        .single();

      if (error) { console.error("지출 저장 실패", error); return null; }
      return data.id;
    },

    지출삭제: async function (번호) {
      const { error } = await sb.from("expenses").delete().eq("id", 번호);
      if (error) { console.error("지출 삭제 실패", error); return false; }
      return true;
    },

    /* ---------------- 내 돈 정보 ---------------- */

    내돈정보읽기: async function () {
      const { data, error } = await sb
        .from("money_info")
        .select("balance, next_income_date, fixed_cost, income_type, income_amount, updated_at")
        .maybeSingle();            // 없으면 null (오류 아님)

      if (error) { console.error("내 돈 정보 불러오기 실패", error); return null; }
      if (!data) return null;

      return {
        잔액: data.balance,
        고정지출: data.fixed_cost,
        입금일: data.next_income_date || "",
        수입종류: data.income_type || "",
        수입금액: data.income_amount || 0,
        입력시각: data.updated_at          // 이 시각 이후에 쓴 돈을 잔액에서 뺍니다
      };
    },

    // upsert = 줄이 있으면 고치고, 없으면 새로 넣기
    // 사람마다 한 줄만 있어야 해서 user_id 를 기준으로 삼습니다.
    내돈정보쓰기: async function (정보) {
      const { data: u } = await sb.auth.getUser();
      if (!u.user) return false;

      const { error } = await sb.from("money_info").upsert({
        user_id: u.user.id,
        balance: 정보.잔액 || 0,
        fixed_cost: 정보.고정지출 || 0,
        next_income_date: 정보.입금일 || null,
        income_type: 정보.수입종류 || null,
        income_amount: 정보.수입금액 || 0,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

      if (error) { console.error("내 돈 정보 저장 실패", error); return false; }
      return true;
    },

    /* ---------------- 카테고리 예산 ---------------- */

    예산읽기: async function () {
      const { data, error } = await sb.from("budgets").select("category, amount");
      if (error) { console.error("예산 불러오기 실패", error); return 기본예산; }

      // 처음 로그인한 사람은 예산이 비어 있으므로 기본값을 넣어 줍니다
      if (!data || data.length === 0) {
        await 저장소.예산초기화();
        return 기본예산;
      }
      const 결과 = {};
      data.forEach(function (r) { 결과[r.category] = r.amount; });
      // 빠진 카테고리는 기본값으로 메웁니다
      카테고리목록.forEach(function (c) {
        if (결과[c] === undefined) 결과[c] = 기본예산[c];
      });
      return 결과;
    },

    /* ---------------- 빠른 입력 항목 (동료 피드백 ①) ----------------
       1511 이정현 / 1315 전재현 : 학식·버스·커피 3개로 고정돼 있어
       자주 쓰는 항목을 직접 등록할 수 있으면 좋겠다는 의견.
       계획서 Input ⑤ 에 써 두고 못 만들었던 기능이다. */

    기본빠른입력: [
      { 이름: "학식", 금액: 5000, 카테고리: "식비" },
      { 이름: "버스", 금액: 1500, 카테고리: "교통" },
      { 이름: "커피", 금액: 1500, 카테고리: "카페" }
    ],

    빠른입력읽기: async function () {
      const { data, error } = await sb
        .from("quick_items")
        .select("id, name, amount, category")
        .order("id", { ascending: true });
      if (error) { console.error("빠른 입력 불러오기 실패", error); return null; }

      // 처음 쓰는 사람에게는 기본 3개를 넣어 줍니다
      if (!data || data.length === 0) return await 저장소.빠른입력초기화();
      return data.map(function (r) {
        return { 번호: r.id, 이름: r.name, 금액: r.amount, 카테고리: r.category };
      });
    },

    빠른입력초기화: async function () {
      const { data: u } = await sb.auth.getUser();
      if (!u.user) return [];
      const 줄들 = 저장소.기본빠른입력.map(function (q) {
        return { user_id: u.user.id, name: q.이름, amount: q.금액, category: q.카테고리 };
      });
      const { data, error } = await sb.from("quick_items").insert(줄들).select("id, name, amount, category");
      if (error) { console.error("빠른 입력 기본값 넣기 실패", error); return []; }
      return data.map(function (r) {
        return { 번호: r.id, 이름: r.name, 금액: r.amount, 카테고리: r.category };
      });
    },

    빠른입력추가: async function (이름, 금액, 카테고리) {
      const { data, error } = await sb
        .from("quick_items")
        .insert({ name: 이름, amount: 금액, category: 카테고리 })
        .select("id").single();
      if (error) { console.error("빠른 입력 저장 실패", error); return null; }
      return data.id;
    },

    빠른입력삭제: async function (번호) {
      const { error } = await sb.from("quick_items").delete().eq("id", 번호);
      if (error) { console.error("빠른 입력 삭제 실패", error); return false; }
      return true;
    },

    /* ---------------- 입금 예정 (여러 건) ----------------
       2511 정영광 / 1310 박민석 : 알바비·용돈·과외비가 각각 다른 날 들어오는데
       입금일을 하나만 넣을 수 있어 계획을 세우기 어렵다는 의견. */

    입금예정읽기: async function () {
      const { data, error } = await sb
        .from("planned_incomes")
        .select("id, kind, amount, due_date, repeat_kind, repeat_every")
        .order("due_date", { ascending: true });
      if (error) { console.error("입금 예정 불러오기 실패", error); return null; }
      return data.map(function (r) {
        return {
          번호: r.id, 종류: r.kind, 금액: r.amount, 날짜: r.due_date,
          주기종류: r.repeat_kind || "months",   // none / days / months
          주기값: r.repeat_every || 1
        };
      });
    },

    입금예정추가: async function (종류, 금액, 날짜, 주기종류, 주기값) {
      const { data, error } = await sb
        .from("planned_incomes")
        .insert({
          kind: 종류, amount: 금액, due_date: 날짜,
          repeat_kind: 주기종류 || "months",
          repeat_every: 주기값 || 1,
          repeat_monthly: (주기종류 || "months") === "months"
        })
        .select("id").single();
      if (error) { console.error("입금 예정 저장 실패", error); return null; }
      return data.id;
    },

    입금예정삭제: async function (번호) {
      const { error } = await sb.from("planned_incomes").delete().eq("id", 번호);
      if (error) { console.error("입금 예정 삭제 실패", error); return false; }
      return true;
    },

    /* 예전에는 입금을 money_info 에 한 건만 적었다.
       그 값이 남아 있는데 표가 비어 있으면 한 줄로 옮겨 준다. */
    입금예정옮기기: async function (내돈) {
      if (!내돈 || !내돈.입금일 || !(내돈.수입금액 > 0)) return [];
      const id = await 저장소.입금예정추가(내돈.수입종류 || "알바비", 내돈.수입금액, 내돈.입금일, "months", 1);
      if (id === null) return [];
      return [{ 번호: id, 종류: 내돈.수입종류 || "알바비", 금액: 내돈.수입금액,
                날짜: 내돈.입금일, 주기종류: "months", 주기값: 1 }];
    },

    /* ---------------- 목표 금액 ----------------
       '이날까지 얼마를 모으고 싶다' 를 적어 두면,
       그 목표를 지키면서 오늘 얼마까지 쓸 수 있는지 따로 계산해 준다. */

    목표읽기: async function () {
      const { data, error } = await sb
        .from("goals")
        .select("id, name, amount, target_date")
        .order("target_date", { ascending: true });
      if (error) { console.error("목표 불러오기 실패", error); return null; }
      return data.map(function (r) {
        return { 번호: r.id, 이름: r.name, 금액: r.amount, 날짜: r.target_date };
      });
    },

    목표추가: async function (이름, 금액, 날짜) {
      const { data, error } = await sb
        .from("goals")
        .insert({ name: 이름, amount: 금액, target_date: 날짜 })
        .select("id").single();
      if (error) { console.error("목표 저장 실패", error); return null; }
      return data.id;
    },

    목표삭제: async function (번호) {
      const { error } = await sb.from("goals").delete().eq("id", 번호);
      if (error) { console.error("목표 삭제 실패", error); return false; }
      return true;
    },

    /* ---------------- 추가 입금 (꽁돈) ----------------
       세뱃돈·환급·중고거래처럼 예정에 없던 돈. 지출과 대칭으로 다룬다. */

    추가입금읽기: async function () {
      const { data, error } = await sb
        .from("extra_incomes")
        .select("id, amount, memo, received_on, created_at")
        .order("received_on", { ascending: true });
      if (error) { console.error("추가 입금 불러오기 실패", error); return null; }
      return data.map(function (r) {
        return { 번호: r.id, 금액: r.amount, 메모: r.memo || "", 날짜: r.received_on, 기록시각: r.created_at };
      });
    },

    추가입금추가: async function (금액, 날짜, 메모) {
      const { data, error } = await sb
        .from("extra_incomes")
        .insert({ amount: 금액, received_on: 날짜, memo: 메모 })
        .select("id").single();
      if (error) { console.error("추가 입금 저장 실패", error); return null; }
      return data.id;
    },

    추가입금삭제: async function (번호) {
      const { error } = await sb.from("extra_incomes").delete().eq("id", 번호);
      if (error) { console.error("추가 입금 삭제 실패", error); return false; }
      return true;
    },

    /* ---------------- 예정된 지출 (동료 피드백 ②) ----------------
       2616 최유빈 : 선물값처럼 한 번만 나갈 돈을 등록하면
       그날까지 매일 조금씩 미리 떼어 두면 좋겠다는 의견.
       계획서 Input ⑥ · 처리 ② 에 써 두고 못 만들었던 기능이다. */

    예정지출읽기: async function () {
      const { data, error } = await sb
        .from("planned_expenses")
        .select("id, name, amount, due_date")
        .order("due_date", { ascending: true });
      if (error) { console.error("예정 지출 불러오기 실패", error); return null; }
      return data.map(function (r) {
        return { 번호: r.id, 이름: r.name, 금액: r.amount, 날짜: r.due_date };
      });
    },

    예정지출추가: async function (이름, 금액, 날짜) {
      const { data, error } = await sb
        .from("planned_expenses")
        .insert({ name: 이름, amount: 금액, due_date: 날짜 })
        .select("id").single();
      if (error) { console.error("예정 지출 저장 실패", error); return null; }
      return data.id;
    },

    예정지출삭제: async function (번호) {
      const { error } = await sb.from("planned_expenses").delete().eq("id", 번호);
      if (error) { console.error("예정 지출 삭제 실패", error); return false; }
      return true;
    },

    /* ---------------- 고정지출 (항목별) ---------------- */

    고정지출읽기: async function () {
      const { data, error } = await sb
        .from("fixed_costs")
        .select("id, name, amount, pay_day")
        .order("pay_day", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true });

      // 표 자체가 없을 때와 '표는 있는데 비었을 때'를 구별해야 하므로
      // 오류일 때는 빈 배열이 아니라 null 을 돌려줍니다.
      if (error) { console.error("고정지출 불러오기 실패", error); return null; }
      return data.map(function (r) {
        return { 번호: r.id, 이름: r.name, 금액: r.amount, 결제일: r.pay_day };
      });
    },

    /* 예전에는 고정지출을 '합계 한 칸'으로만 저장했습니다.
       그 값이 남아 있는데 표가 비어 있으면, 한 줄로 옮겨 줍니다.
       이렇게 하지 않으면 예전에 넣어 둔 금액이 0으로 사라집니다. */
    고정지출옮기기: async function (옛합계) {
      if (!(옛합계 > 0)) return [];
      const id = await 저장소.고정지출추가("기존 고정지출", 옛합계, null);
      if (id === null) return [];
      return [{ 번호: id, 이름: "기존 고정지출", 금액: 옛합계, 결제일: null }];
    },

    고정지출추가: async function (이름, 금액, 결제일) {
      const { data, error } = await sb
        .from("fixed_costs")
        .insert({ name: 이름, amount: 금액, pay_day: 결제일 || null })
        .select("id")
        .single();
      if (error) { console.error("고정지출 저장 실패", error); return null; }
      return data.id;
    },

    고정지출삭제: async function (번호) {
      const { error } = await sb.from("fixed_costs").delete().eq("id", 번호);
      if (error) { console.error("고정지출 삭제 실패", error); return false; }
      return true;
    },

    예산초기화: async function () {
      const { data: u } = await sb.auth.getUser();
      if (!u.user) return;
      const 줄들 = 카테고리목록.map(function (c) {
        return { user_id: u.user.id, category: c, amount: 기본예산[c] };
      });
      await sb.from("budgets").upsert(줄들, { onConflict: "user_id,category" });
    }
  };
})();


/* ===================================================================
   계산 담당 - 화면과 상관없이 "숫자를 넣으면 숫자가 나오는" 함수들
   세 화면이 똑같은 계산을 써야 해서 여기에 모았습니다.
   값이 이상하면 여기부터 의심하면 됩니다.
   =================================================================== */

// 312000 -> "312,000원"
function 원(숫자) {
  return Math.round(숫자).toLocaleString("ko-KR") + "원";
}

// Date -> "2026-11-01"
function 날짜글자(d) {
  const 년 = d.getFullYear();
  const 월 = String(d.getMonth() + 1).padStart(2, "0");   // getMonth()는 0부터 시작
  const 일 = String(d.getDate()).padStart(2, "0");
  return 년 + "-" + 월 + "-" + 일;
}

// "2026-11-01" -> Date (시·분·초 없이 그날 0시)
function 글자날짜(글자) {
  const 조각 = 글자.split("-").map(Number);
  return new Date(조각[0], 조각[1] - 1, 조각[2]);
}

// 오늘 0시. 시·분·초를 버려야 날짜 빼기가 정확해집니다.
function 오늘0시() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

const 하루밀리초 = 1000 * 60 * 60 * 24;

// 오늘부터 입금일까지 며칠 남았는지
function 남은일수계산(입금일글자) {
  if (!입금일글자) return 0;
  return Math.round((글자날짜(입금일글자) - 오늘0시()) / 하루밀리초);
}

// 오늘의 안전 지출 금액 = (잔액 − 고정지출) ÷ 남은 일수
// Math.floor = 버림. 올리면 마지막 날 몇 원이 모자랄 수 있습니다.
function 안전금액계산(잔액, 고정지출, 남은일수) {
  const 쓸수있는돈 = 잔액 - 고정지출;
  if (남은일수 <= 0) return 0;
  if (쓸수있는돈 <= 0) return 0;
  return Math.floor(쓸수있는돈 / 남은일수);
}

// 어떤 달(예 "2026-11")의 지출만 걸러 냅니다
function 그달지출(목록, 달글자) {
  return 목록.filter(function (항목) {
    return 항목.날짜 && 항목.날짜.slice(0, 7) === 달글자;
  });
}

// 카테고리별로 얼마 썼는지 합계 -> { "식비": 12000, ... }
function 카테고리별합계(목록) {
  const 합 = {};
  저장소.카테고리목록.forEach(function (이름) { 합[이름] = 0; });
  목록.forEach(function (항목) {
    if (합[항목.카테고리] === undefined) 합[항목.카테고리] = 0;
    합[항목.카테고리] += 항목.금액;
  });
  return 합;
}

// 최근 N일 동안의 하루 평균 지출 (계획서 처리 ⑤)
function 하루평균지출(목록, 일수) {
  const 기준 = new Date(오늘0시().getTime() - (일수 - 1) * 하루밀리초);
  let 합 = 0;
  목록.forEach(function (항목) {
    if (!항목.날짜) return;
    const d = 글자날짜(항목.날짜);
    if (d >= 기준 && d <= 오늘0시()) 합 += 항목.금액;
  });
  return 합 / 일수;
}

/* 어떤 날짜에 쓴 돈의 합.
   계획서의 '어제 쓴 만큼 오늘이 줄어든다'를 만들려면 이 값이 필요합니다. */
function 그날쓴금액(목록, 날짜글자값) {
  let 합 = 0;
  목록.forEach(function (항목) {
    if (항목.날짜 === 날짜글자값) 합 += 항목.금액;
  });
  return 합;
}

/* 잔액을 입력한 시각(기준시각) 이후에 쓴 돈의 합.

   ★ 왜 필요한가
     사용자가 '현재 잔액 312,000원'이라고 적은 뒤에 6,500원을 쓰면
     실제 잔액은 305,500원이다. 그런데 입력한 숫자만 보면 312,000원 그대로라서,
     다음 날이 되면 남은 일수만 줄어 한도가 오히려 올라가는 모순이 생긴다.
     그래서 '적은 뒤에 쓴 돈'을 빼서 진짜 잔액을 구한다.

   날짜(spent_on)가 아니라 기록 시각(created_at)으로 가르는 이유는,
   과거 날짜로 입력한 지출도 '적은 뒤에 쓴 돈'이면 빼야 하기 때문이다. */
function 기준이후쓴돈(목록, 기준시각) {
  if (!기준시각) return 0;
  const 기준 = new Date(기준시각).getTime();
  let 합 = 0;
  목록.forEach(function (항목) {
    if (항목.기록시각 && new Date(항목.기록시각).getTime() > 기준) 합 += 항목.금액;
  });
  return 합;
}

/* 오늘부터 다음 입금일 사이에 나갈 예정 지출의 합 (동료 피드백 ②)

   입금일 뒤에 잡힌 예정 지출은 이번 기간의 돈이 아니므로 빼지 않습니다.
   이 합계를 쓸 수 있는 돈에서 먼저 빼고 남은 일수로 나누면,
   따로 계산하지 않아도 '그날까지 매일 조금씩 떼어 두는' 효과가 납니다.
     예) 선물값 30,000원 · 남은 일수 9일 → 하루 약 3,333원씩 미리 빠짐 */
function 기간내예정지출(목록, 입금일글자) {
  if (!목록 || !입금일글자) return 0;
  const 오늘 = 오늘0시();
  const 입금일 = 글자날짜(입금일글자);
  let 합 = 0;
  목록.forEach(function (항목) {
    const d = 글자날짜(항목.날짜);
    if (d >= 오늘 && d <= 입금일) 합 += 항목.금액;
  });
  return 합;
}

/* 입금 예정을 주기에 맞춰 앞으로 N일치 날짜로 펼칩니다.

   주기종류 : none(한 번만) / days(며칠마다) / months(몇 달마다)
   격주로 들어오는 알바비는 days 14, 두 달에 한 번은 months 2 가 됩니다. */
function 입금날짜펼치기(입금예정, 일수) {
  const 결과 = {};
  const 끝 = new Date(오늘0시().getTime() + 일수 * 하루밀리초);

  (입금예정 || []).forEach(function (p) {
    const 첫 = 글자날짜(p.날짜);
    const 종류 = p.주기종류 || "months";
    const 간격 = Math.max(p.주기값 || 1, 1);

    if (종류 === "none") {
      결과[p.날짜] = (결과[p.날짜] || 0) + p.금액;
      return;
    }

    for (let k = 0; k < 400; k++) {
      let d;
      if (종류 === "days") {
        d = new Date(첫.getTime() + k * 간격 * 하루밀리초);
      } else {
        d = new Date(첫.getFullYear(), 첫.getMonth() + k * 간격, 첫.getDate());
      }
      if (d > 끝) break;
      const 글자 = 날짜글자(d);
      결과[글자] = (결과[글자] || 0) + p.금액;
    }
  });
  return 결과;
}

/* 등록된 입금 중 금액이 가장 큰 것 (월급처럼 중심이 되는 수입) */
function 가장큰입금(입금예정) {
  if (!입금예정 || 입금예정.length === 0) return null;
  let 큰 = 입금예정[0];
  입금예정.forEach(function (p) { if (p.금액 > 큰.금액) 큰 = p; });
  return 큰;
}

/* 어떤 입금이 오늘 이후 처음 들어오는 날 */
function 다음번입금날(항목, 일수) {
  if (!항목) return null;
  const 날들 = Object.keys(입금날짜펼치기([항목], 일수 || 400)).sort();
  const 오늘 = 날짜글자(오늘0시());
  for (let i = 0; i < 날들.length; i++) {
    if (날들[i] >= 오늘) return 날들[i];
  }
  return null;
}


/* ===================================================================
   오늘의 기준을 구하는 단 하나의 함수

   ★ 왜 따로 뺐나
     메인 화면과 지출 입력 화면이 같은 '오늘의 기준'을 각자 계산하고 있었다.
     그런데 메인은 예정 지출과 고정지출 목록까지 반영하고,
     지출 입력 화면은 예전 값만 쓰고 있어서
     같은 날 같은 사람인데 두 화면의 숫자가 달랐다.
     계산을 여기 한 곳에만 두어 두 화면이 반드시 같은 값을 쓰게 한다.
   =================================================================== */
/* 등록된 입금 예정 중 오늘 이후로 가장 가까운 것.
   여러 건이 있으면 그중 제일 빠른 날이 '다음 입금일'이 된다. */
function 다음입금찾기(입금예정) {
  if (!입금예정 || 입금예정.length === 0) return null;
  const 오늘 = 오늘0시();
  let 가장가까운 = null;
  입금예정.forEach(function (p) {
    const d = 글자날짜(p.날짜);
    if (d >= 오늘 && (가장가까운 === null || d < 글자날짜(가장가까운.날짜))) 가장가까운 = p;
  });
  return 가장가까운;
}

function 오늘기준계산(자료) {
  const 내돈 = 자료.내돈 || {};
  const 지출 = 자료.지출목록 || [];
  const 꽁돈 = 자료.추가입금 || [];
  const 고정 = 자료.고정지출 || [];
  const 예정 = 자료.예정지출 || [];

  // 입금 예정이 여러 건이면 그중 가장 가까운 날을 기준으로 삼는다
  const 다음입금 = 다음입금찾기(자료.입금예정);
  const 입금일 = 다음입금 ? 다음입금.날짜 : 내돈.입금일;
  const 남은일수 = 남은일수계산(입금일);

  // 잔액을 적은 뒤에 쓰고 받은 돈
  const 쓴돈 = 기준이후쓴돈(지출, 내돈.입력시각);
  const 받은돈 = 기준이후쓴돈(꽁돈, 내돈.입력시각);
  const 오늘쓴금액 = 그날쓴금액(지출, 날짜글자(오늘0시()));
  const 어제까지쓴돈 = Math.max(쓴돈 - 오늘쓴금액, 0);

  const 실제잔액 = (내돈.잔액 || 0) - 쓴돈 + 받은돈;        // 지금 진짜 가진 돈
  const 오늘아침잔액 = (내돈.잔액 || 0) - 어제까지쓴돈 + 받은돈;

  // 고정지출 합계는 항목 목록에서. 목록을 못 읽었으면 예전 합계 값을 쓴다.
  let 고정합 = 0;
  고정.forEach(function (f) { 고정합 += f.금액; });
  if (고정.length === 0 && 내돈.고정지출 > 0) 고정합 = 내돈.고정지출;

  const 예정합 = 기간내예정지출(예정, 입금일);
  const 기준 = 안전금액계산(오늘아침잔액 - 예정합, 고정합, 남은일수);

  return {
    남은일수: 남은일수,
    입금일: 입금일,
    다음입금: 다음입금,
    실제잔액: 실제잔액,
    오늘아침잔액: 오늘아침잔액,
    고정지출합: 고정합,
    예정지출합: 예정합,
    쓴돈: 쓴돈,
    받은돈: 받은돈,
    오늘쓴금액: 오늘쓴금액,
    기준: 기준,
    남은금액: 기준 - 오늘쓴금액
  };
}


/* ===================================================================
   이번 주 소비를 한 줄로 정리하기  (2505 김준우)

   "지출 기록이 쌓이면 일주일마다 소비 습관을 정리해 피드백해 주는
    기능이 있으면 좋겠다" 는 의견.

   ★ 어떻게 쓸지가 더 중요했다
     계획서에 "잔소리하지 않는다"고 써 두었으므로
     '배달을 줄이세요' 같은 말은 쓰지 않는다.
     지난주와 이번 주 숫자를 나란히 놓고, 무엇이 가장 컸는지만 말한다.
   =================================================================== */
function 주간정리(지출목록) {
  const 오늘 = 오늘0시();

  function 기간합(시작전, 일수) {
    const 끝 = new Date(오늘.getTime() - 시작전 * 하루밀리초);
    const 시작 = new Date(끝.getTime() - (일수 - 1) * 하루밀리초);
    const 모음 = [];
    (지출목록 || []).forEach(function (항목) {
      if (!항목.날짜) return;
      const d = 글자날짜(항목.날짜);
      if (d >= 시작 && d <= 끝) 모음.push(항목);
    });
    let 합 = 0;
    모음.forEach(function (x) { 합 += x.금액; });
    return { 합: 합, 건수: 모음.length, 목록: 모음 };
  }

  const 이번주 = 기간합(0, 7);     // 오늘 포함 최근 7일
  const 지난주 = 기간합(7, 7);     // 그 앞의 7일

  if (이번주.건수 === 0) {
    return { 쓸만한가: false, 이번주: 이번주, 지난주: 지난주 };
  }

  // 이번 주에 가장 많이 쓴 카테고리
  const 합계 = 카테고리별합계(이번주.목록);
  let 으뜸 = null, 으뜸액 = 0;
  Object.keys(합계).forEach(function (이름) {
    if (합계[이름] > 으뜸액) { 으뜸 = 이름; 으뜸액 = 합계[이름]; }
  });
  const 비율 = 이번주.합 > 0 ? Math.round((으뜸액 / 이번주.합) * 100) : 0;

  // 가장 많이 쓴 날
  const 날짜별 = {};
  이번주.목록.forEach(function (x) { 날짜별[x.날짜] = (날짜별[x.날짜] || 0) + x.금액; });
  let 큰날 = null, 큰날액 = 0;
  Object.keys(날짜별).forEach(function (날) {
    if (날짜별[날] > 큰날액) { 큰날 = 날; 큰날액 = 날짜별[날]; }
  });
  const 요일이름 = ["일", "월", "화", "수", "목", "금", "토"];

  return {
    쓸만한가: true,
    이번주: 이번주,
    지난주: 지난주,
    차이: 이번주.합 - 지난주.합,        // 양수면 더 썼다는 뜻
    비교가능: 지난주.건수 > 0,
    으뜸: 으뜸, 으뜸액: 으뜸액, 비율: 비율,
    큰날: 큰날, 큰날액: 큰날액,
    큰날요일: 큰날 ? 요일이름[글자날짜(큰날).getDay()] : null,
    하루평균: Math.round(이번주.합 / 7)
  };
}


/* ===================================================================
   목표 금액을 지키면서 오늘 얼마까지 쓸 수 있는지

   '오늘의 기준'과 따로 계산한다.
   오늘의 기준은 다음 입금일까지 버티는 것만 생각하지만,
   목표는 그날까지 일정 금액을 남겨 두어야 하므로 더 빡빡하다.

     목표일까지 들어올 돈 − 나갈 돈 − 목표 금액
     ───────────────────────────────────────  = 목표를 지키며 하루에 쓸 수 있는 돈
                  목표일까지 남은 일수
   =================================================================== */
function 목표기준계산(자료, 목표) {
  if (!목표) return null;

  const 남은일수 = 남은일수계산(목표.날짜);
  if (남은일수 <= 0) return { 지남: true, 목표: 목표 };

  const 현재 = 오늘기준계산(자료);

  // 목표일까지 들어올 돈 (정기 입금을 주기대로 펼쳐서 합산)
  const 입금날들 = 입금날짜펼치기(자료.입금예정, 남은일수);
  const 오늘글자 = 날짜글자(오늘0시());
  const 목표글자 = 목표.날짜;
  let 들어올돈 = 0;
  Object.keys(입금날들).forEach(function (날) {
    if (날 > 오늘글자 && 날 <= 목표글자) 들어올돈 += 입금날들[날];
  });

  // 목표일까지 나갈 고정지출 (매달 결제일마다 한 번)
  let 고정나감 = 0;
  (자료.고정지출 || []).forEach(function (f) {
    const 결제일 = f.결제일 || 1;
    for (let i = 1; i <= 남은일수; i++) {
      const d = new Date(오늘0시().getTime() + i * 하루밀리초);
      if (d.getDate() === 결제일) 고정나감 += f.금액;
    }
  });

  // 목표일까지 잡힌 예정 지출
  let 예정나감 = 0;
  (자료.예정지출 || []).forEach(function (p) {
    if (p.날짜 > 오늘글자 && p.날짜 <= 목표글자) 예정나감 += p.금액;
  });

  const 쓸수있는총액 = 현재.실제잔액 + 들어올돈 - 고정나감 - 예정나감 - 목표.금액;
  const 하루 = Math.floor(쓸수있는총액 / 남은일수);
  const 오늘남은 = 하루 - 현재.오늘쓴금액;

  return {
    지남: false,
    목표: 목표,
    남은일수: 남은일수,
    들어올돈: 들어올돈,
    고정나감: 고정나감,
    예정나감: 예정나감,
    실제잔액: 현재.실제잔액,
    쓸수있는총액: 쓸수있는총액,
    하루: 하루,
    오늘쓴금액: 현재.오늘쓴금액,
    오늘남은: 오늘남은,
    // 지금 속도로 가면 목표를 넘길 수 있는지 (여유가 있으면 양수)
    여유: 쓸수있는총액
  };
}


/* ===================================================================
   앞으로의 잔액 변화 시뮬레이션

   ★ 왜 만들었나
     전에는 '잔액 ÷ 하루 평균 지출' 로 0원이 되는 날을 구했다.
     그런데 이 계산은 다음 입금일에 돈이 들어온다는 사실을 빼먹는다.
     그래서 매달 꼬박꼬박 돈이 들어오는 사람에게도
     "2028년 1월 28일에 0원이 됩니다" 같은 엉뚱한 날짜가 나왔다.

     실제로는 수입이 반복되므로, 하루 지출이 수입보다 적으면
     잔액은 0이 되지 않고 오히려 쌓인다.
     그래서 날짜를 하루씩 따라가며 들어오고 나가는 돈을 모두 반영한다.

   하루마다 반영하는 것
     · 최근 7일 하루 평균만큼 줄어든다
     · 입금 예정일에 수입이 들어온다 (그 뒤로는 매달 같은 날 반복)
     · 고정지출은 매달 결제일에 빠진다 (결제일을 안 적었으면 매달 1일)
     · 예정 지출과 추가 입금은 그 날짜에 한 번 반영된다
   =================================================================== */
function 잔액시뮬레이션(설정, 일수) {
  const 시작 = 오늘0시();
  const 결과 = [];
  let 잔액 = 설정.잔액;

  const 입금날들 = 입금날짜펼치기(설정.입금예정, 일수);

  // 예정 지출 / 추가 입금을 날짜별로 모아 둡니다
  const 예정날들 = {};
  (설정.예정지출 || []).forEach(function (p) {
    예정날들[p.날짜] = (예정날들[p.날짜] || 0) + p.금액;
  });
  const 꽁돈날들 = {};
  (설정.추가입금 || []).forEach(function (p) {
    꽁돈날들[p.날짜] = (꽁돈날들[p.날짜] || 0) + p.금액;
  });

  let 영원일 = null;

  for (let i = 0; i <= 일수; i++) {
    const 날 = new Date(시작.getTime() + i * 하루밀리초);
    const 글자 = 날짜글자(날);

    if (i > 0) {
      잔액 -= 설정.하루평균;                     // 매일 쓰는 돈

      // 고정지출 : 매달 결제일에 한 번
      (설정.고정지출 || []).forEach(function (f) {
        const 결제일 = f.결제일 || 1;
        if (날.getDate() === 결제일) 잔액 -= f.금액;
      });

      if (예정날들[글자]) 잔액 -= 예정날들[글자];   // 예정된 지출
      if (꽁돈날들[글자]) 잔액 += 꽁돈날들[글자];   // 추가 입금
      if (입금날들[글자]) 잔액 += 입금날들[글자];   // 정기 수입
    }

    if (영원일 === null && 잔액 <= 0) 영원일 = i;
    결과.push({ 날: i, 날짜: 글자, 잔액: 잔액 });
  }

  return { 점들: 결과, 영원일: 영원일, 끝잔액: 잔액 };
}

/* 앞말에 받침이 있는지 보고 조사를 골라 붙입니다.
   '알바비이 기준입니다' 처럼 어색해지는 것을 막습니다.
   한글 한 글자의 코드에서 (코드 - 0xAC00) % 28 이 0이면 받침이 없습니다. */
function 조사(말, 받침있을때, 받침없을때) {
  if (!말) return 받침없을때;
  const 끝 = 말.charCodeAt(말.length - 1);
  if (끝 < 0xAC00 || 끝 > 0xD7A3) return 받침없을때;   // 한글이 아니면 없는 쪽으로
  return ((끝 - 0xAC00) % 28) > 0 ? 받침있을때 : 받침없을때;
}

// 소진율에 따른 막대 색 (빠듯한 항목은 색으로 구분)
function 막대색(소진율) {
  if (소진율 >= 80) return "bar-fill--danger";
  if (소진율 >= 50) return "bar-fill--warn";
  return "bar-fill--safe";
}
