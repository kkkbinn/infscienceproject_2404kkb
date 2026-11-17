/* ===================================================================
   통계 화면 - stats.js  (5차시)

   계획서 처리 ⑤ 를 그대로 옮긴 화면입니다.
     "최근 7일간의 하루 평균 지출 속도를 구하고,
      이 속도가 유지될 경우 잔액이 0원이 되는 날짜를 예측한다"

   그래프는 라이브러리 없이 SVG 로 직접 그립니다.
   선 하나 그리는 데 외부 파일을 받아 오는 것보다,
   내가 좌표를 계산해 보는 편이 이해에 도움이 되기 때문입니다.
   =================================================================== */

/* Supabase 에서 불러온 뒤에야 계산할 수 있어서
   값을 담을 변수만 먼저 만들어 두고, 맨 아래 시작() 에서 채웁니다. */
let 내돈 = { 잔액: 0, 고정지출: 0, 입금일: "" };
let 지출목록 = [];
let 예산 = {};
let 하루평균 = 0;
let 남은일수 = 0;
let 고정지출목록 = [];
let 예정지출목록 = [];
let 추가입금목록 = [];
let 입금예정목록 = [];
let 예측 = null;          // 앞으로 6개월 잔액 시뮬레이션 결과
const 예측일수 = 180;     // 약 6개월


/* -------------------------------------------------------------------
   1) 앞으로 어떻게 되는지 한 줄로 알려 주기

   예전에는 '잔액 ÷ 하루 평균' 으로 0원이 되는 날만 보여 줬다.
   그런데 수입이 반복된다는 것을 빼먹은 계산이라, 돈이 남는 사람에게도
   몇 년 뒤 날짜가 나와서 오히려 헷갈렸다.
   이제는 6개월을 하루씩 따라가 보고, 돈이 모자라는지 남는지에 따라
   아예 다른 내용을 보여 준다.
   ------------------------------------------------------------------- */
function 예측그리기() {
  const 큰칸 = document.getElementById("zero-date");
  const 라벨 = document.getElementById("zero-label");
  const 안내칸 = document.getElementById("zero-hint");
  const 식칸 = document.getElementById("zero-formula");

  if (!(내돈.잔액 > 0)) {
    라벨.textContent = "앞으로의 잔액";
    큰칸.textContent = "―";
    큰칸.classList.remove("today-amount--over");
    안내칸.textContent = "메인 화면에서 현재 잔액을 먼저 입력해 주세요";
    식칸.textContent = "잔액을 넣어야 앞으로 어떻게 되는지 계산할 수 있습니다";
    return;
  }

  if (하루평균 <= 0) {
    라벨.textContent = "앞으로의 잔액";
    큰칸.textContent = "―";
    큰칸.classList.remove("today-amount--over");
    안내칸.textContent = "최근 7일 안에 기록된 지출이 없어 아직 예측할 수 없습니다";
    식칸.textContent = "지출 입력 화면에서 몇 건만 기록하면 그래프가 그려집니다";
    return;
  }

  /* 들어올 금액을 안 넣었으면 수입이 0원인 셈으로 계산된다.
     그러면 누구나 언젠가 0원이 되므로, 예측 대신 무엇을 넣어야 하는지 알려 준다. */
  const 수입없음 = 입금예정목록.length === 0;

  if (예측.영원일 !== null) {
    /* ---- 돈이 모자라는 경우 : 언제 0원이 되는지 ---- */
    const 그날 = new Date(오늘0시().getTime() + 예측.영원일 * 하루밀리초);
    const 해바뀜 = 그날.getFullYear() !== 오늘0시().getFullYear();

    라벨.textContent = "이대로 쓰면 잔액이 0원이 되는 날";
    큰칸.textContent = (해바뀜 ? 그날.getFullYear() + "년 " : "")
                     + (그날.getMonth() + 1) + "월 " + 그날.getDate() + "일";
    큰칸.classList.add("today-amount--over");

    안내칸.textContent = (남은일수 > 0 && 예측.영원일 < 남은일수)
      ? "다음 입금일(D-" + 남은일수 + ")보다 " + (남은일수 - 예측.영원일) + "일 빠릅니다"
      : "오늘부터 " + 예측.영원일 + "일 뒤입니다";

    식칸.textContent = 수입없음
      ? "메인 화면에 입금 예정을 등록하면 수입까지 넣어 다시 계산합니다"
      : "하루 " + 원(하루평균) + " 쓰고, 수입과 고정지출까지 넣어 하루씩 계산한 결과입니다";
    return;
  }

  /* ---- 돈이 남는 경우 : 얼마나 모이는지 ---- */
  const 모은돈 = 예측.끝잔액 - 내돈.잔액;
  const 한달 = Math.round(모은돈 / 6);

  라벨.textContent = "이대로 지내면 6개월 뒤 잔액";
  큰칸.textContent = 원(예측.끝잔액);
  큰칸.classList.remove("today-amount--over");

  안내칸.textContent = 모은돈 >= 0
    ? "지금보다 " + 원(모은돈) + " 늘어납니다 (한 달 약 " + 원(한달) + ")"
    : "지금보다 " + 원(-모은돈) + " 줄지만 0원이 되지는 않습니다";

  // 다음 입금일까지만 따로 떼어 보여 주면 더 와닿습니다
  if (남은일수 > 0 && 남은일수 <= 예측일수) {
    const 그때 = 예측.점들[남은일수];
    식칸.textContent = "다음 입금일(D-" + 남은일수 + ")에는 " + 원(그때.잔액) + " 남아 있을 예정입니다";
  } else {
    식칸.textContent = "하루 " + 원(하루평균) + " 쓰고, 수입과 고정지출까지 넣어 하루씩 계산한 결과입니다";
  }
}


/* -------------------------------------------------------------------
   2) 6개월 잔액 예측 그래프

   수입이 들어올 때마다 선이 위로 튀고, 쓰는 동안 아래로 내려가
   톱니(계단) 모양이 됩니다. 전체가 오른쪽 위로 가면 돈이 쌓이는 것이고,
   오른쪽 아래로 가면 줄어드는 것입니다.
   ------------------------------------------------------------------- */
function 꺾은선그리기() {
  const 자리 = document.getElementById("line-chart");
  const 범위칸 = document.getElementById("chart-range");
  const 범례0 = document.getElementById("legend-zero");
  const 범례입금 = document.getElementById("legend-income");

  if (!(내돈.잔액 > 0) || 하루평균 <= 0) {
    자리.innerHTML = `<p class="chart-empty">${
      !(내돈.잔액 > 0)
        ? "메인 화면에서 현재 잔액을 입력하면 여기에 6개월 예측 그래프가 그려집니다."
        : "지출을 기록하면 여기에 6개월 예측 그래프가 그려집니다."}</p>`;
    범위칸.textContent = "―";
    범례0.hidden = true;
    범례입금.hidden = true;
    return;
  }

  const 점들 = 예측.점들;
  const 일수 = 예측일수;

  // 세로 범위는 0부터 가장 높았던 잔액까지
  let 최대 = 0;
  점들.forEach(function (p) { if (p.잔액 > 최대) 최대 = p.잔액; });
  if (최대 <= 0) 최대 = 내돈.잔액;

  const 폭 = 320, 높이 = 180;
  const 여백 = { 왼: 46, 오: 10, 위: 12, 아래: 26 };
  const 그림폭 = 폭 - 여백.왼 - 여백.오;
  const 그림높이 = 높이 - 여백.위 - 여백.아래;

  function x(날) { return 여백.왼 + (날 / 일수) * 그림폭; }
  function y(잔액) { return 여백.위 + (1 - Math.max(잔액, 0) / 최대) * 그림높이; }

  /* 180일을 다 찍으면 점이 너무 많아 무거워지므로 이틀에 한 번만 찍습니다.
     단 입금일처럼 크게 튀는 날은 반드시 넣어야 계단 모양이 살아납니다. */
  const 고른점 = [];
  for (let i = 0; i <= 일수; i++) {
    const 튐 = i > 0 && Math.abs(점들[i].잔액 - 점들[i - 1].잔액) > 하루평균 * 2;
    if (i % 2 === 0 || i === 일수 || 튐) 고른점.push(점들[i]);
  }

  const 선 = 고른점.map(function (p) {
    return x(p.날).toFixed(1) + "," + y(p.잔액).toFixed(1);
  }).join(" ");
  const 면 = x(0).toFixed(1) + "," + y(0).toFixed(1) + " " + 선 + " " +
             x(일수).toFixed(1) + "," + y(0).toFixed(1);

  /* 세로축 단위는 금액 크기에 맞춰 (동료 피드백 ④ · 1413 정인영) */
  function 축글자(값) {
    if (최대 >= 100000) {
      const v = 값 / 10000;
      return (v >= 10 || v === 0 ? Math.round(v) : v.toFixed(1)) + "만";
    }
    if (최대 >= 10000) return Math.round(값 / 1000) + "천";
    return Math.round(값) + "원";
  }

  let 눈금 = "";
  [0, 0.5, 1].forEach(function (비율) {
    const 값 = 최대 * 비율;
    const yy = y(값).toFixed(1);
    눈금 += `<line class="grid" x1="${여백.왼}" y1="${yy}" x2="${폭 - 여백.오}" y2="${yy}" />`;
    눈금 += `<text class="axis" x="${여백.왼 - 6}" y="${yy}" text-anchor="end" dominant-baseline="middle">${축글자(값)}</text>`;
  });

  // 0원이 되는 날 / 다음 입금일 표시
  const 영원보임 = 예측.영원일 !== null && 예측.영원일 <= 일수;
  const 입금보임 = 남은일수 > 0 && 남은일수 <= 일수;
  범례0.hidden = !영원보임;
  범례입금.hidden = !입금보임;

  let 표시 = "";
  if (영원보임) {
    표시 += `<line class="mark mark--zero" x1="${x(예측.영원일)}" y1="${여백.위}" x2="${x(예측.영원일)}" y2="${y(0)}" />`;
    표시 += `<circle class="dot dot--zero" cx="${x(예측.영원일)}" cy="${y(0)}" r="4" />`;
  }
  if (입금보임) {
    표시 += `<line class="mark mark--income" x1="${x(남은일수)}" y1="${여백.위}" x2="${x(남은일수)}" y2="${y(0)}" />`;
  }

  // 가로축 : 오늘 / 3개월 / 6개월
  const 축 = [0, Math.round(일수 / 2), 일수].map(function (날, k) {
    const d = new Date(오늘0시().getTime() + 날 * 하루밀리초);
    const 글 = 날 === 0 ? "오늘" : (d.getMonth() + 1) + "/" + d.getDate();
    const anchor = k === 0 ? "start" : (k === 2 ? "end" : "middle");
    return `<text class="axis" x="${x(날)}" y="${높이 - 8}" text-anchor="${anchor}">${글}</text>`;
  }).join("");

  자리.innerHTML = `
    <svg viewBox="0 0 ${폭} ${높이}" class="chart" role="img"
         aria-label="오늘부터 6개월 동안의 예상 잔액 그래프">
      ${눈금}
      <polygon class="area" points="${면}" />
      <polyline class="line" points="${선}" />
      ${표시}
      ${축}
    </svg>
  `;

  범위칸.textContent = "오늘부터 6개월";
}


/* -------------------------------------------------------------------
   3) 이번 달 지출 구성 (어디로 돈이 새는지)
   ------------------------------------------------------------------- */
function 구성그리기() {
  const 목록칸 = document.getElementById("compose-list");
  const 합계칸 = document.getElementById("month-total");

  const 이번달 = 날짜글자(오늘0시()).slice(0, 7);
  const 이번달지출 = 그달지출(지출목록, 이번달);
  const 사용 = 카테고리별합계(이번달지출);

  let 전체 = 0;
  이번달지출.forEach(function (항목) { 전체 += 항목.금액; });
  합계칸.textContent = 전체 > 0 ? 원(전체) : "기록 없음";

  목록칸.innerHTML = "";

  if (전체 === 0) {
    목록칸.innerHTML = `<li class="record-empty">이번 달 기록된 지출이 없습니다.</li>`;
    return;
  }

  // 많이 쓴 카테고리가 위로 오게 정렬합니다 ('배달이 가장 크다'만 보여 주기)
  const 정렬 = 저장소.카테고리목록.slice().sort(function (a, b) {
    return (사용[b] || 0) - (사용[a] || 0);
  });

  정렬.forEach(function (이름) {
    const 금액 = 사용[이름] || 0;
    if (금액 === 0) return;                       // 안 쓴 카테고리는 건너뜁니다
    const 비율 = Math.round((금액 / 전체) * 100);
    const 예산액 = 예산[이름] || 0;
    const 소진율 = 예산액 > 0 ? Math.round((금액 / 예산액) * 100) : 0;

    const li = document.createElement("li");
    li.innerHTML = `
      <div class="category-head">
        <span class="category-name">${이름}</span>
        <span class="category-left">${원(금액)} · 전체의 ${비율}%</span>
      </div>
      <div class="bar">
        <div class="bar-fill ${막대색(소진율)}" style="width:${비율}%"></div>
      </div>
    `;
    목록칸.appendChild(li);
  });
}


/* -------------------------------------------------------------------
   4) 최근 7일 막대 그래프
   ------------------------------------------------------------------- */
function 주간그리기() {
  const 자리 = document.getElementById("week-chart");
  document.getElementById("week-avg").textContent =
    하루평균 > 0 ? "하루 평균 " + 원(하루평균) : "기록 없음";

  // 오늘을 포함한 최근 7일을 날짜별로 더합니다
  const 날들 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(오늘0시().getTime() - i * 하루밀리초);
    const 글자 = 날짜글자(d);
    let 합 = 0;
    지출목록.forEach(function (항목) {
      if (항목.날짜 === 글자) 합 += 항목.금액;
    });
    날들.push({ 날짜: d, 금액: 합 });
  }

  let 최대 = 0;
  날들.forEach(function (n) { if (n.금액 > 최대) 최대 = n.금액; });

  if (최대 === 0) {
    자리.innerHTML = `<p class="chart-empty">최근 7일 동안 기록된 지출이 없습니다.</p>`;
    return;
  }

  // 막대 7개를 세로로 세웁니다. 높이는 가장 많이 쓴 날을 100%로 잡습니다.
  let 막대들 = "";
  날들.forEach(function (n) {
    const 높이비율 = Math.round((n.금액 / 최대) * 100);
    const 요일 = ["일", "월", "화", "수", "목", "금", "토"][n.날짜.getDay()];
    막대들 += `
      <div class="wbar">
        <span class="wbar-value">${n.금액 > 0 ? Math.round(n.금액 / 1000) + "천" : ""}</span>
        <div class="wbar-track"><div class="wbar-fill" style="height:${높이비율}%"></div></div>
        <span class="wbar-day">${요일}</span>
      </div>
    `;
  });
  자리.innerHTML = `<div class="wbar-list">${막대들}</div>`;
}


/* -------------------------------------------------------------------
   실행
   ------------------------------------------------------------------- */
(async function 시작() {
  const user = await 로그인확인();
  if (!user) return;
  사용자띠그리기(user);

  내돈 = (await 저장소.내돈정보읽기()) || { 잔액: 0, 고정지출: 0, 입금일: "", 수입금액: 0 };
  지출목록 = await 저장소.지출목록읽기();
  예산 = await 저장소.예산읽기();
  고정지출목록 = (await 저장소.고정지출읽기()) || [];
  예정지출목록 = (await 저장소.예정지출읽기()) || [];
  추가입금목록 = (await 저장소.추가입금읽기()) || [];
  입금예정목록 = (await 저장소.입금예정읽기()) || [];

  하루평균 = 하루평균지출(지출목록, 7);      // 최근 7일 하루 평균
  // 6개월을 하루씩 따라가 보며 앞으로의 잔액을 구합니다
  /* 시뮬레이션은 '지금 진짜 가진 돈'에서 시작해야 합니다.
     전에는 적어 둔 잔액에서 시작해, 그 뒤에 쓰거나 받은 돈이
     빠져 있어서 메인 화면 잔액과 숫자가 달랐습니다. */
  const 현재 = 오늘기준계산({
    내돈: 내돈, 지출목록: 지출목록, 추가입금: 추가입금목록,
    고정지출: 고정지출목록, 예정지출: 예정지출목록, 입금예정: 입금예정목록
  });
  남은일수 = 현재.남은일수;

  예측 = 잔액시뮬레이션({
    잔액: 현재.실제잔액,
    하루평균: 하루평균,
    입금예정: 입금예정목록,
    고정지출: 고정지출목록,
    예정지출: 예정지출목록,
    추가입금: 추가입금목록
  }, 예측일수);

  예측그리기();
  꺾은선그리기();
  구성그리기();
  주간그리기();
})();
