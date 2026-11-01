/* ===================================================================
   메인 화면 - app.js  (2차시 → 5차시)

   2차시: 손으로 적은 임시 숫자를 화면에 넣음
   4차시: '오늘 쓸 수 있는 금액'을 실제로 계산
   5차시: 입력값이 새로고침해도 남고, 카테고리 막대가 실제 기록으로 계산됨
   6~8차시: Supabase 에 저장·불러오기, 로그인

   ★ 핵심 계산
       오늘의 기준     = (잔액 − 고정지출) ÷ 다음 입금일까지 남은 일수
       오늘 더 쓸 수 있는 금액 = 오늘의 기준 − 오늘 쓴 금액
     발표 자료의 '12,400원 → 12,000원 쓰면 400원' 이 이 식입니다.

   계산 함수와 저장 기능은 storage.js 에 있습니다.
   =================================================================== */

// 처음 열었을 때 '내 돈 정보'에 들어갈 값.
// 발표 자료 예시와 같게 맞춰, 손 검산과 비교할 수 있게 했습니다.
//   (312,000 − 200,400) ÷ 9일 = 12,400원
// 화면 전체가 같이 보는 값들. 시작할 때 Supabase 에서 채웁니다.
let 내돈 = { 잔액: 0, 고정지출: 0, 입금일: "", 수입종류: "", 수입금액: 0, 입력시각: null };
let 지출목록 = [];
let 고정지출목록 = [];
let 고정지출표사용가능 = true;   // 표를 못 읽으면 false. 이때는 옛 합계 값을 그대로 씁니다.

const 빠른입력목록 = [
  { 이름: "학식", 금액: 5000, 카테고리: "식비" },
  { 이름: "버스", 금액: 1500, 카테고리: "교통" },
  { 이름: "커피", 금액: 1500, 카테고리: "카페" }
];


/* -------------------------------------------------------------------
   화면에 그리기
   ------------------------------------------------------------------- */

// (1) 상단 - 잔액과 D-day
function 상단그리기(실제잔액, 남은일수) {
  document.getElementById("balance").textContent = 원(실제잔액);
  document.getElementById("dday").textContent = 남은일수 > 0 ? "D-" + 남은일수 : "―";

  const 수입칸 = document.getElementById("next-income");
  const 종류 = document.getElementById("input-income-type").value;
  const 금액 = Number(document.getElementById("input-income-amount").value);
  수입칸.textContent = 금액 > 0 ? 종류 + " " + 원(금액) : 종류;
}

// (2) 중앙 - 오늘의 안전 지출 금액
function 오늘쓴돈() {
  return 그날쓴금액(지출목록, 날짜글자(오늘0시()));
}

/* 오늘 더 쓸 수 있는 금액을 그립니다.
   기준에서 '오늘 이미 쓴 돈'을 빼는 것이 이 화면의 핵심입니다. */
function 안전금액그리기(입력잔액, 고정지출, 남은일수) {
  const 금액칸 = document.getElementById("safe-amount");
  const 라벨칸 = document.getElementById("today-label");
  const 안내칸 = document.getElementById("today-hint");
  const 계산식칸 = document.getElementById("today-formula");
  const 오늘쓴칸 = document.getElementById("today-spent");

  if (!(남은일수 > 0)) {
    라벨칸.textContent = "오늘 쓸 수 있는 금액";
    금액칸.textContent = "―";
    금액칸.classList.remove("today-amount--over");
    안내칸.textContent = "다음 입금 예정일을 내일 이후 날짜로 넣어 주세요";
    계산식칸.textContent = "";
    오늘쓴칸.textContent = "";
    return;
  }

  /* 잔액을 적은 뒤에 쓴 돈을 빼야 진짜 잔액이 됩니다.
       적은뒤쓴돈 = 오늘 쓴 돈 + 그 전에 쓴 돈
     오늘의 기준은 '오늘 아침에 남아 있던 돈'으로 계산해야 하므로
     오늘 쓴 돈은 빼지 않고, 오늘 쓴 돈은 기준에서 따로 뺍니다. */
  const 적은뒤쓴돈 = 기준이후쓴돈(지출목록, 내돈.입력시각);
  const 오늘쓴금액 = 오늘쓴돈();
  const 어제까지쓴돈 = Math.max(적은뒤쓴돈 - 오늘쓴금액, 0);

  const 오늘아침잔액 = 입력잔액 - 어제까지쓴돈;
  const 기준 = 안전금액계산(오늘아침잔액, 고정지출, 남은일수);
  const 남은금액 = 기준 - 오늘쓴금액;

  // 기준이 되는 계산은 늘 같은 자리에 보여 줍니다 (손 검산용)
  계산식칸.textContent =
    "오늘의 기준 (" + 원(오늘아침잔액) + " − " + 원(고정지출) + ") ÷ " + 남은일수 + "일 = " + 원(기준);

  if (오늘쓴금액 === 0) {
    라벨칸.textContent = "오늘 쓸 수 있는 금액";
    금액칸.textContent = 원(기준);
    금액칸.classList.remove("today-amount--over");
    안내칸.textContent = 기준 > 0
      ? "여기까지는 써도 괜찮아요"
      : "고정지출을 내고 나면 남는 돈이 없어요";
    오늘쓴칸.textContent = "오늘은 아직 쓴 기록이 없어요";
    return;
  }

  오늘쓴칸.textContent = "오늘 쓴 돈 " + 원(오늘쓴금액);

  if (남은금액 >= 0) {
    // 아직 여유가 있을 때
    라벨칸.textContent = "오늘 더 쓸 수 있는 금액";
    금액칸.textContent = 원(남은금액);
    금액칸.classList.remove("today-amount--over");
    안내칸.textContent = "여기까지는 더 써도 괜찮아요";
  } else {
    /* 기준을 넘겼을 때.
       "쓰지 마세요"라고 하지 않고 넘긴 금액과 그 결과만 숫자로 보여 줍니다
       (설계 원칙 1·2 - 잔소리하지 않는다 / 바뀐 숫자만 보여 준다) */
    const 초과 = -남은금액;
    const 내일기준 = 남은일수 > 1
      ? 안전금액계산(오늘아침잔액 - 오늘쓴금액, 고정지출, 남은일수 - 1)
      : null;

    라벨칸.textContent = "오늘 기준보다 더 쓴 금액";
    금액칸.textContent = 원(초과);
    금액칸.classList.add("today-amount--over");
    안내칸.textContent = 내일기준 !== null
      ? "이대로면 내일 기준은 " + 원(내일기준) + "이 됩니다"
      : "다음 입금일이 내일이라 더 쓰면 모자랄 수 있어요";
  }
}

/* (3) 카테고리별 남은 예산 (5차시)
   2차시에는 손으로 적은 숫자였지만, 이제는 실제 기록에서 계산합니다.
     사용액 = 이번 달 그 카테고리 지출의 합
     남은 예산 = 예산 − 사용액
     소진율 = 사용액 ÷ 예산 × 100 */
async function 카테고리그리기() {
  const 목록칸 = document.getElementById("category-list");
  // await = Supabase 에 다녀올 때까지 기다리기
  const 예산 = await 저장소.예산읽기();
  const 이번달 = 날짜글자(오늘0시()).slice(0, 7);          // "2026-11"
  const 이번달지출 = 그달지출(지출목록, 이번달);            // 시작할 때 읽어 둔 것을 재사용
  const 사용 = 카테고리별합계(이번달지출);

  목록칸.innerHTML = "";

  저장소.카테고리목록.forEach(function (이름) {
    const 예산액 = 예산[이름] || 0;
    const 사용액 = 사용[이름] || 0;
    const 남은액 = 예산액 - 사용액;
    // 예산이 0이면 나누기를 할 수 없으므로 0%로 둡니다
    const 소진율 = 예산액 > 0 ? Math.round((사용액 / 예산액) * 100) : 0;
    // 막대가 칸 밖으로 나가지 않게 100%에서 멈춥니다
    const 막대너비 = Math.min(소진율, 100);

    const li = document.createElement("li");
    li.innerHTML = `
      <div class="category-head">
        <span class="category-name">${이름}</span>
        <span class="category-left">${
          남은액 >= 0 ? "남은 " + 원(남은액) : 원(-남은액) + " 초과"
        } · ${소진율}% 사용</span>
      </div>
      <div class="bar">
        <div class="bar-fill ${막대색(소진율)}" style="width:${막대너비}%"></div>
      </div>
    `;
    목록칸.appendChild(li);
  });

  // 이번 달 쓴 돈 합계를 제목 옆에 보여 줍니다
  let 전체사용 = 0;
  이번달지출.forEach(function (항목) { 전체사용 += 항목.금액; });
  document.getElementById("category-summary").textContent =
    이번달지출.length + "건 · " + 원(전체사용) + " 사용";
}

/* ---------------- 고정지출 (항목별) ----------------
   계획서 Input ③ : 통신비·구독료 같은 항목을 이름·금액·결제일로 관리합니다.
   합계는 자동으로 계산돼 '오늘의 기준' 계산에 들어갑니다. */
function 고정지출합계() {
  let 합 = 0;
  고정지출목록.forEach(function (항목) { 합 += 항목.금액; });
  return 합;
}

function 고정지출그리기() {
  const 목록칸 = document.getElementById("fixed-list");
  const 합계칸 = document.getElementById("fixed-total");
  const 숨은칸 = document.getElementById("input-fixed");
  if (!목록칸) return;

  목록칸.innerHTML = "";

  /* 표를 아직 못 쓰는 상태(마이그레이션 전)라면
     예전 합계 값을 건드리지 않고 그대로 둡니다. 0 으로 덮어쓰면 안 됩니다. */
  if (!고정지출표사용가능) {
    합계칸.textContent = 원(Number(숨은칸.value || 0));
    목록칸.innerHTML = `<li class="record-empty">고정지출 표를 아직 만들지 않아 합계만 쓰고 있습니다.</li>`;
    return;
  }

  const 합 = 고정지출합계();
  합계칸.textContent = 고정지출목록.length + "건 · " + 원(합);
  숨은칸.value = 합;                     // 계산에 쓰이는 값

  if (고정지출목록.length === 0) {
    목록칸.innerHTML = `<li class="record-empty">등록한 고정지출이 없습니다.</li>`;
    return;
  }

  고정지출목록.forEach(function (항목) {
    const li = document.createElement("li");
    li.className = "record-item";
    li.innerHTML = `
      <div class="record-left">
        <span class="record-category">${항목.이름}</span>
        <span class="record-date">${항목.결제일 ? "매달 " + 항목.결제일 + "일" : "결제일 미정"}</span>
      </div>
      <span class="record-amount">${원(항목.금액)}</span>
    `;
    const 삭제 = document.createElement("button");
    삭제.className = "record-delete";
    삭제.type = "button";
    삭제.textContent = "삭제";
    삭제.setAttribute("aria-label", 항목.이름 + " 고정지출 삭제");
    삭제.addEventListener("click", async function () {
      if (!confirm(항목.이름 + " " + 원(항목.금액) + "을 지울까요?")) return;
      if (!(await 저장소.고정지출삭제(항목.번호))) { 알림("지우지 못했어요."); return; }
      고정지출목록 = 고정지출목록.filter(function (x) { return x.번호 !== 항목.번호; });
      고정지출그리기();
      다시계산(true);
    });
    li.appendChild(삭제);
    목록칸.appendChild(li);
  });
}

function 고정지출연결() {
  const 폼 = document.getElementById("fixed-form");
  if (!폼) return;
  폼.addEventListener("submit", async function (e) {
    e.preventDefault();
    const 이름 = document.getElementById("fixed-name").value.trim();
    const 금액 = Number(document.getElementById("fixed-amount").value);
    const 결제일 = Number(document.getElementById("fixed-day").value) || null;

    if (!이름 || !(금액 > 0)) { 알림("항목 이름과 금액을 넣어 주세요."); return; }

    const id = await 저장소.고정지출추가(이름, 금액, 결제일);
    if (id === null) { 알림("저장하지 못했어요."); return; }

    고정지출목록.push({ 번호: id, 이름: 이름, 금액: 금액, 결제일: 결제일 });
    document.getElementById("fixed-name").value = "";
    document.getElementById("fixed-amount").value = "";
    document.getElementById("fixed-day").value = "";
    알림(이름 + " 추가했어요");
    고정지출그리기();
    다시계산(true);
  });
}

/* 화면을 옮기지 않고 결과만 짧게 알려 줍니다 */
let 알림타이머 = null;
function 알림(글) {
  const 칸 = document.getElementById("toast");
  if (!칸) return;
  칸.textContent = 글;
  칸.hidden = false;
  clearTimeout(알림타이머);
  알림타이머 = setTimeout(function () { 칸.hidden = true; }, 2200);
}

// (4) 하단 - 빠른 입력 버튼 3개
function 빠른입력그리기() {
  const 목록칸 = document.getElementById("quick-list");
  목록칸.innerHTML = "";

  빠른입력목록.forEach(function (항목) {
    const button = document.createElement("button");
    button.className = "quick-btn";
    button.type = "button";
    button.innerHTML = `
      <span class="quick-btn-name">${항목.이름}</span>
      <span class="quick-btn-price">${원(항목.금액)}</span>
    `;
    /* ★ 화면을 옮기지 않고 여기서 바로 기록합니다.
       계획서의 "버튼 한 번으로 입력이 끝난다"가 이 부분입니다. */
    button.addEventListener("click", async function () {
      button.disabled = true;
      const id = await 저장소.지출추가(항목.금액, 항목.카테고리, 날짜글자(오늘0시()), 항목.이름);
      button.disabled = false;
      if (id === null) { 알림("저장하지 못했어요. 잠시 뒤 다시 눌러 주세요."); return; }

      지출목록.push({
        번호: id, 금액: 항목.금액, 카테고리: 항목.카테고리,
        날짜: 날짜글자(오늘0시()), 메모: 항목.이름,
        기록시각: new Date().toISOString()
      });
      알림(항목.이름 + " " + 원(항목.금액) + " 기록했어요");
      다시계산(false);
      await 카테고리그리기();
    });
    목록칸.appendChild(button);
  });
}


/* -------------------------------------------------------------------
   입력 칸 - 값이 바뀌면 다시 계산하고 저장까지 (5차시)
   ------------------------------------------------------------------- */

function 지금입력값() {
  return {
    잔액: Number(document.getElementById("input-balance").value),
    고정지출: Number(document.getElementById("input-fixed").value),
    입금일: document.getElementById("input-income-date").value,
    수입종류: document.getElementById("input-income-type").value,
    수입금액: Number(document.getElementById("input-income-amount").value)
  };
}

function 다시계산(저장할지) {
  const 값 = 지금입력값();
  const 남은일수 = 남은일수계산(값.입금일);

  // 상단에는 '적은 뒤에 쓴 돈'을 뺀 진짜 잔액을 보여 줍니다
  const 적은뒤쓴돈 = 기준이후쓴돈(지출목록, 내돈.입력시각);
  상단그리기(값.잔액 - 적은뒤쓴돈, 남은일수);
  안전금액그리기(값.잔액, 값.고정지출, 남은일수);

  // 잔액을 적은 뒤에 얼마를 썼는지 한 줄로 알려 줍니다
  const 차감칸 = document.getElementById("balance-note");
  if (차감칸) {
    차감칸.textContent = 적은뒤쓴돈 > 0
      ? "적어 둔 " + 원(값.잔액) + "에서 그 뒤 쓴 " + 원(적은뒤쓴돈) + "을 뺀 금액입니다"
      : "";
  }

  /* ★ 7차시: 입력한 값을 Supabase 에 저장합니다.
     글자를 칠 때마다 서버로 보내면 너무 잦으므로,
     마지막 입력에서 0.6초 쉬었을 때 한 번만 보냅니다. */
  /* ★ 화면을 열 때는 저장하지 않습니다.
     저장하면 '잔액을 적은 시각'이 지금으로 바뀌어,
     그 전에 쓴 돈이 잔액에서 빠지지 않게 되기 때문입니다. */
  if (저장할지) 저장예약(값);
}

/* 타자를 칠 때마다 저장하면 요청이 수십 번 날아갑니다.
   setTimeout 으로 예약해 두고, 또 입력이 들어오면 앞의 예약을 취소합니다. */
let 저장타이머 = null;
function 저장예약(값) {
  clearTimeout(저장타이머);
  저장타이머 = setTimeout(async function () {
    await 저장소.내돈정보쓰기(값);
    // 새 기준 시각으로 다시 읽어 와야 차감이 올바르게 됩니다
    내돈 = (await 저장소.내돈정보읽기()) || 내돈;
    다시계산(false);
  }, 600);
}

async function 입력연결() {
  const 잔액칸 = document.getElementById("input-balance");
  const 입금일칸 = document.getElementById("input-income-date");
  const 고정지출칸 = document.getElementById("input-fixed");

  const 수입종류칸 = document.getElementById("input-income-type");
  const 수입금액칸 = document.getElementById("input-income-amount");

  잔액칸.value = 내돈.잔액;
  고정지출칸.value = 내돈.고정지출;      // 표를 못 쓸 때의 보루
  입금일칸.value = 내돈.입금일;
  수입종류칸.value = 내돈.수입종류 || "알바비";
  수입금액칸.value = 내돈.수입금액 || "";

  // "input" = 칸의 내용이 한 글자라도 바뀔 때마다
  [잔액칸, 입금일칸, 수입종류칸, 수입금액칸].forEach(function (칸) {
    칸.addEventListener("input", function () { 다시계산(true); });
    칸.addEventListener("change", function () { 다시계산(true); });
  });
}


/* -------------------------------------------------------------------
   실행
   ★ 6차시: 로그인하지 않았으면 login.html 로 보냅니다.
     Supabase 를 쓰므로 순서대로 기다려야 해서 async 함수로 감쌌습니다.
   ------------------------------------------------------------------- */
(async function 시작() {
  const user = await 로그인확인();
  if (!user) return;              // 로그인 화면으로 넘어가는 중
  사용자띠그리기(user);

  const 저장된값 = await 저장소.내돈정보읽기();

  // 처음 로그인한 사람은 계산에 필요한 값이 없으므로 설정 화면으로 보냅니다
  if (!저장된값 || !저장된값.입금일) {
    location.href = "setup.html";
    return;
  }
  내돈 = 저장된값;
  지출목록 = await 저장소.지출목록읽기();

  const 읽은것 = await 저장소.고정지출읽기();
  고정지출표사용가능 = 읽은것 !== null;
  고정지출목록 = 읽은것 || [];

  /* 예전 방식(합계 한 칸)으로 넣어 둔 값이 있으면 표로 옮깁니다 */
  if (고정지출표사용가능 && 고정지출목록.length === 0 && 내돈.고정지출 > 0) {
    고정지출목록 = await 저장소.고정지출옮기기(내돈.고정지출);
  }

  await 입력연결();
  고정지출연결();
  고정지출그리기();
  다시계산(false);              // 화면을 열 때는 저장하지 않습니다
  await 카테고리그리기();
  빠른입력그리기();
})();
