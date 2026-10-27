/* ===================================================================
   통계 화면 - stats.js  (5차시)

   계획서 처리 ⑤ 를 그대로 옮긴 화면입니다.
     "최근 7일간의 하루 평균 지출 속도를 구하고,
      이 속도가 유지될 경우 잔액이 0원이 되는 날짜를 예측한다"

   그래프는 라이브러리 없이 SVG 로 직접 그립니다.
   선 하나 그리는 데 외부 파일을 받아 오는 것보다,
   내가 좌표를 계산해 보는 편이 이해에 도움이 되기 때문입니다.
   =================================================================== */

const 내돈 = 저장소.내돈정보읽기() || { 잔액: 0, 고정지출: 0, 입금일: "" };
const 지출목록 = 저장소.지출목록읽기();
const 예산 = 저장소.예산읽기();

const 하루평균 = 하루평균지출(지출목록, 7);          // 최근 7일 하루 평균
const 남은일수 = 남은일수계산(내돈.입금일);


/* -------------------------------------------------------------------
   1) 0원이 되는 날 예측
      잔액을 하루 평균 지출로 나누면 "며칠 뒤에 0원이 되는가"가 나옵니다.
   ------------------------------------------------------------------- */
function 영원예상일수() {
  if (하루평균 <= 0) return null;                   // 쓴 기록이 없으면 예측 불가
  return Math.floor(내돈.잔액 / 하루평균);
}

function 영원그리기() {
  const 날짜칸 = document.getElementById("zero-date");
  const 안내칸 = document.getElementById("zero-hint");
  const 식칸 = document.getElementById("zero-formula");

  /* 잔액을 아직 안 넣었으면 계산이 성립하지 않습니다.
     이 경우 0원을 0으로 나눠 '오늘 0원이 된다'는 엉뚱한 답이 나오므로
     계산하지 말고 무엇을 해야 하는지 알려 줍니다. */
  if (!(내돈.잔액 > 0)) {
    날짜칸.textContent = "―";
    안내칸.textContent = "메인 화면에서 현재 잔액을 먼저 입력해 주세요";
    식칸.textContent = "잔액을 넣어야 며칠 뒤에 0원이 되는지 계산할 수 있습니다";
    return;
  }

  const 일수 = 영원예상일수();

  if (일수 === null) {
    날짜칸.textContent = "―";
    안내칸.textContent = "최근 7일 안에 기록된 지출이 없어 아직 예측할 수 없습니다";
    식칸.textContent = "지출 입력 화면에서 몇 건만 기록하면 그래프가 그려집니다";
    return;
  }

  const 그날 = new Date(오늘0시().getTime() + 일수 * 하루밀리초);
  날짜칸.textContent = (그날.getMonth() + 1) + "월 " + 그날.getDate() + "일";

  // 경고 대신 사실만 (설계 원칙 1·2)
  if (남은일수 > 0 && 일수 < 남은일수) {
    안내칸.textContent =
      "다음 입금일(D-" + 남은일수 + ")보다 " + (남은일수 - 일수) + "일 빠릅니다";
  } else if (남은일수 > 0) {
    안내칸.textContent = "다음 입금일까지 잔액이 남습니다";
  } else {
    안내칸.textContent = "오늘부터 " + 일수 + "일 뒤입니다";
  }

  // 손 검산을 할 수 있게 계산 과정을 그대로
  식칸.textContent =
    원(내돈.잔액) + " ÷ 하루 " + 원(하루평균) + " = " + 일수 + "일";
}


/* -------------------------------------------------------------------
   2) 잔액 예측 꺾은선 그래프
      오늘부터 하루에 '하루평균'씩 줄어든다고 보고 선을 그립니다.
   ------------------------------------------------------------------- */
function 꺾은선그리기() {
  const 자리 = document.getElementById("line-chart");
  const 범위칸 = document.getElementById("chart-range");

  if (하루평균 <= 0 || 내돈.잔액 <= 0) {
    // 왜 못 그리는지 이유를 정확히 알려 줍니다
    const 이유 = !(내돈.잔액 > 0)
      ? "메인 화면에서 현재 잔액을 입력하면 여기에 잔액 예측 그래프가 그려집니다."
      : "지출을 기록하면 여기에 잔액 예측 그래프가 그려집니다.";
    자리.innerHTML = `<p class="chart-empty">${이유}</p>`;
    범위칸.textContent = "―";
    document.getElementById("legend-zero").hidden = true;
    document.getElementById("legend-income").hidden = true;
    return;
  }

  // 며칠치를 그릴지 정합니다. 0원이 되는 날과 입금일 중 더 먼 쪽까지,
  // 너무 길어지지 않게 최대 60일로 자릅니다.
  const 영원일수 = 영원예상일수();
  let 일수 = Math.max(영원일수, 남은일수 > 0 ? 남은일수 : 0) + 1;
  일수 = Math.min(Math.max(일수, 5), 60);

  // 날짜별 예상 잔액을 미리 계산해 둡니다
  const 점들 = [];
  for (let i = 0; i <= 일수; i++) {
    점들.push({ 날: i, 잔액: Math.max(내돈.잔액 - 하루평균 * i, 0) });
  }

  // --- SVG 좌표 계산 ---
  // viewBox 는 '그림 안쪽의 좌표계'입니다. 실제 화면 크기와 상관없이
  // 이 안에서 0~320, 0~180 으로 계산하면 브라우저가 알아서 늘려 그립니다.
  const 폭 = 320, 높이 = 180;
  const 여백 = { 왼: 44, 오: 10, 위: 12, 아래: 26 };
  const 그림폭 = 폭 - 여백.왼 - 여백.오;
  const 그림높이 = 높이 - 여백.위 - 여백.아래;

  function x(날) { return 여백.왼 + (날 / 일수) * 그림폭; }
  function y(잔액) { return 여백.위 + (1 - 잔액 / 내돈.잔액) * 그림높이; }

  // 선은 "x1,y1 x2,y2 ..." 형태의 글자로 적어 줍니다
  const 선 = 점들.map(function (p) {
    return x(p.날).toFixed(1) + "," + y(p.잔액).toFixed(1);
  }).join(" ");

  // 선 아래를 옅게 칠하려면 시작점과 끝점을 바닥까지 내려 닫아 줍니다
  const 면 = x(0).toFixed(1) + "," + y(0).toFixed(1) + " " + 선 + " " +
             x(일수).toFixed(1) + "," + y(0).toFixed(1);

  // 가로 눈금선 3개 (0원 / 절반 / 전액)
  let 눈금 = "";
  [0, 0.5, 1].forEach(function (비율) {
    const 값 = 내돈.잔액 * 비율;
    const yy = y(값).toFixed(1);
    눈금 += `<line class="grid" x1="${여백.왼}" y1="${yy}" x2="${폭 - 여백.오}" y2="${yy}" />`;
    눈금 += `<text class="axis" x="${여백.왼 - 6}" y="${yy}" text-anchor="end" dominant-baseline="middle">${Math.round(값 / 10000)}만</text>`;
  });

  /* 0원이 되는 지점과 입금일 표시.
     그래프 범위(최대 60일) 밖이면 선을 그릴 수 없으므로
     범례도 같이 숨겨서 그림과 설명이 어긋나지 않게 합니다. */
  const 영원보임 = 영원일수 <= 일수;
  const 입금보임 = 남은일수 > 0 && 남은일수 <= 일수;
  document.getElementById("legend-zero").hidden = !영원보임;
  document.getElementById("legend-income").hidden = !입금보임;

  let 표시 = "";
  if (영원보임) {
    표시 += `<line class="mark mark--zero" x1="${x(영원일수)}" y1="${여백.위}" x2="${x(영원일수)}" y2="${y(0)}" />`;
    표시 += `<circle class="dot dot--zero" cx="${x(영원일수)}" cy="${y(0)}" r="4" />`;
  }
  // 다음 입금일 표시
  if (입금보임) {
    표시 += `<line class="mark mark--income" x1="${x(남은일수)}" y1="${여백.위}" x2="${x(남은일수)}" y2="${y(0)}" />`;
  }

  // 가로축 날짜 (오늘 / 끝)
  const 끝날 = new Date(오늘0시().getTime() + 일수 * 하루밀리초);
  const 축 =
    `<text class="axis" x="${x(0)}" y="${높이 - 8}" text-anchor="start">오늘</text>` +
    `<text class="axis" x="${x(일수)}" y="${높이 - 8}" text-anchor="end">${끝날.getMonth() + 1}/${끝날.getDate()}</text>`;

  자리.innerHTML = `
    <svg viewBox="0 0 ${폭} ${높이}" class="chart" role="img"
         aria-label="오늘부터 ${일수}일 동안의 예상 잔액 그래프">
      ${눈금}
      <polygon class="area" points="${면}" />
      <polyline class="line" points="${선}" />
      ${표시}
      ${축}
    </svg>
  `;

  범위칸.textContent = "오늘부터 " + 일수 + "일";
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
영원그리기();
꺾은선그리기();
구성그리기();
주간그리기();
