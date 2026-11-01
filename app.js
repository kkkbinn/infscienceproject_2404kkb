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
let 내돈 = { 잔액: 0, 고정지출: 0, 입금일: "", 수입종류: "", 수입금액: 0 };
let 지출목록 = [];

const 빠른입력목록 = [
  { 이름: "학식", 금액: 5000, 카테고리: "식비" },
  { 이름: "버스", 금액: 1500, 카테고리: "교통" },
  { 이름: "커피", 금액: 1500, 카테고리: "카페" }
];


/* -------------------------------------------------------------------
   화면에 그리기
   ------------------------------------------------------------------- */

// (1) 상단 - 잔액과 D-day
function 상단그리기(잔액, 남은일수) {
  document.getElementById("balance").textContent = 원(잔액);
  document.getElementById("dday").textContent = 남은일수 > 0 ? "D-" + 남은일수 : "―";

  const 수입칸 = document.getElementById("next-income");
  const 종류 = document.getElementById("input-income-type").value;
  const 금액 = Number(document.getElementById("input-income-amount").value);
  수입칸.textContent = 금액 > 0 ? 종류 + " " + 원(금액) : 종류;
}

// (2) 중앙 - 오늘의 안전 지출 금액
/* 오늘 더 쓸 수 있는 금액을 그립니다.
   기준에서 '오늘 이미 쓴 돈'을 빼는 것이 이 화면의 핵심입니다. */
function 안전금액그리기(잔액, 고정지출, 남은일수) {
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

  const 기준 = 안전금액계산(잔액, 고정지출, 남은일수);
  const 오늘쓴금액 = 그날쓴금액(지출목록, 날짜글자(오늘0시()));
  const 남은금액 = 기준 - 오늘쓴금액;

  // 기준이 되는 계산은 늘 같은 자리에 보여 줍니다 (손 검산용)
  계산식칸.textContent =
    "오늘의 기준 (" + 원(잔액) + " − " + 원(고정지출) + ") ÷ " + 남은일수 + "일 = " + 원(기준);

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
      ? 안전금액계산(잔액 - 오늘쓴금액, 고정지출, 남은일수 - 1)
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
    button.addEventListener("click", function () {
      location.href = "expense.html";
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

function 다시계산() {
  const 값 = 지금입력값();
  const 남은일수 = 남은일수계산(값.입금일);

  상단그리기(값.잔액, 남은일수);
  안전금액그리기(값.잔액, 값.고정지출, 남은일수);

  /* ★ 7차시: 입력한 값을 Supabase 에 저장합니다.
     글자를 칠 때마다 서버로 보내면 너무 잦으므로,
     마지막 입력에서 0.6초 쉬었을 때 한 번만 보냅니다. */
  저장예약(값);
}

/* 타자를 칠 때마다 저장하면 요청이 수십 번 날아갑니다.
   setTimeout 으로 예약해 두고, 또 입력이 들어오면 앞의 예약을 취소합니다. */
let 저장타이머 = null;
function 저장예약(값) {
  clearTimeout(저장타이머);
  저장타이머 = setTimeout(function () {
    저장소.내돈정보쓰기(값);
  }, 600);
}

async function 입력연결() {
  const 잔액칸 = document.getElementById("input-balance");
  const 입금일칸 = document.getElementById("input-income-date");
  const 고정지출칸 = document.getElementById("input-fixed");

  const 수입종류칸 = document.getElementById("input-income-type");
  const 수입금액칸 = document.getElementById("input-income-amount");

  잔액칸.value = 내돈.잔액;
  고정지출칸.value = 내돈.고정지출;
  입금일칸.value = 내돈.입금일;
  수입종류칸.value = 내돈.수입종류 || "알바비";
  수입금액칸.value = 내돈.수입금액 || "";

  // "input" = 칸의 내용이 한 글자라도 바뀔 때마다
  [잔액칸, 입금일칸, 고정지출칸, 수입종류칸, 수입금액칸].forEach(function (칸) {
    칸.addEventListener("input", 다시계산);
    칸.addEventListener("change", 다시계산);
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

  await 입력연결();
  다시계산();
  await 카테고리그리기();
  빠른입력그리기();
})();
