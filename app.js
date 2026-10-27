/* ===================================================================
   메인 화면 - app.js  (2차시 → 5차시)

   2차시: 손으로 적은 임시 숫자를 화면에 넣음
   4차시: '오늘 쓸 수 있는 금액'을 실제로 계산
   5차시: 입력값이 새로고침해도 남고,
          카테고리 막대가 실제 지출 기록으로 계산됨

   계산 함수와 저장 기능은 storage.js 에 있습니다.
   =================================================================== */

// 처음 열었을 때 '내 돈 정보'에 들어갈 값.
// 발표 자료 예시와 같게 맞춰, 손 검산과 비교할 수 있게 했습니다.
//   (312,000 − 200,400) ÷ 9일 = 12,400원
const 처음값 = {
  잔액: 312000,
  고정지출: 200400,
  입금까지일수: 9,
  수입종류: "과외비",
  수입금액: 478000
};

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
  document.getElementById("next-income").textContent =
    처음값.수입종류 + " " + 원(처음값.수입금액);
}

// (2) 중앙 - 오늘의 안전 지출 금액
function 안전금액그리기(잔액, 고정지출, 남은일수) {
  const 금액칸 = document.getElementById("safe-amount");
  const 안내칸 = document.getElementById("today-hint");
  const 계산식칸 = document.getElementById("today-formula");

  if (!(남은일수 > 0)) {
    금액칸.textContent = "―";
    안내칸.textContent = "다음 입금 예정일을 내일 이후 날짜로 넣어 주세요";
    계산식칸.textContent = "";
    return;
  }

  const 안전금액 = 안전금액계산(잔액, 고정지출, 남은일수);
  금액칸.textContent = 원(안전금액);

  // 잔소리 대신 사실만 (설계 원칙 1)
  안내칸.textContent = 안전금액 > 0
    ? "여기까지는 써도 괜찮아요"
    : "고정지출을 내고 나면 남는 돈이 없어요";

  // 손 검산과 비교할 수 있게 계산 과정을 그대로 보여 줍니다
  계산식칸.textContent =
    "(" + 원(잔액) + " − " + 원(고정지출) + ") ÷ " + 남은일수 + "일";
}

/* (3) 카테고리별 남은 예산 (5차시)
   2차시에는 손으로 적은 숫자였지만, 이제는 실제 기록에서 계산합니다.
     사용액 = 이번 달 그 카테고리 지출의 합
     남은 예산 = 예산 − 사용액
     소진율 = 사용액 ÷ 예산 × 100 */
function 카테고리그리기() {
  const 목록칸 = document.getElementById("category-list");
  const 예산 = 저장소.예산읽기();
  const 이번달 = 날짜글자(오늘0시()).slice(0, 7);          // "2026-10"
  const 이번달지출 = 그달지출(저장소.지출목록읽기(), 이번달);
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
    입금일: document.getElementById("input-income-date").value
  };
}

function 다시계산() {
  const 값 = 지금입력값();
  const 남은일수 = 남은일수계산(값.입금일);

  상단그리기(값.잔액, 남은일수);
  안전금액그리기(값.잔액, 값.고정지출, 남은일수);

  // ★ 5차시: 입력한 값을 저장해 둡니다.
  //   그래서 새로고침해도, 통계 화면으로 갔다 와도 그대로 남아 있습니다.
  저장소.내돈정보쓰기(값);
}

function 입력연결() {
  const 잔액칸 = document.getElementById("input-balance");
  const 입금일칸 = document.getElementById("input-income-date");
  const 고정지출칸 = document.getElementById("input-fixed");

  // 저장해 둔 값이 있으면 그걸 쓰고, 없으면(처음 방문) 예시 값을 넣습니다
  const 저장된값 = 저장소.내돈정보읽기();

  if (저장된값) {
    잔액칸.value = 저장된값.잔액;
    고정지출칸.value = 저장된값.고정지출;
    입금일칸.value = 저장된값.입금일;
  } else {
    잔액칸.value = 처음값.잔액;
    고정지출칸.value = 처음값.고정지출;
    const 입금일 = new Date();
    입금일.setDate(입금일.getDate() + 처음값.입금까지일수);
    입금일칸.value = 날짜글자(입금일);
  }

  // "input" = 칸의 내용이 한 글자라도 바뀔 때마다
  잔액칸.addEventListener("input", 다시계산);
  입금일칸.addEventListener("input", 다시계산);
  고정지출칸.addEventListener("input", 다시계산);
}


/* -------------------------------------------------------------------
   실행
   ------------------------------------------------------------------- */
입력연결();
다시계산();
카테고리그리기();
빠른입력그리기();
