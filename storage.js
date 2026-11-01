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

// 소진율에 따른 막대 색 (빠듯한 항목은 색으로 구분)
function 막대색(소진율) {
  if (소진율 >= 80) return "bar-fill--danger";
  if (소진율 >= 50) return "bar-fill--warn";
  return "bar-fill--safe";
}
