/* ===================================================================
   지출 입력 화면 - expense.js  (3차시 → 5차시)

   3차시: 저장을 누르면 목록에 한 줄 추가 (새로고침하면 사라짐)
   5차시: storage.js 를 통해 저장해서 새로고침해도 남음

   계산 함수와 저장 기능은 storage.js 에 있습니다.
   =================================================================== */

// 동료 피드백 ① : 메인 화면에서 등록한 항목을 그대로 가져옵니다
let 빠른입력목록 = [];

/* ★ 7차시: 기록을 Supabase 에서 불러옵니다.
   번호(id)는 데이터베이스가 붙여 주므로 여기서 셀 필요가 없어졌습니다. */
let 지출목록 = [];
let 내돈 = null;
let 추가입금목록 = [];
let 모드 = "지출";          // "지출" 또는 "입금"

/* 1514 조호준 : 기록이 쌓이면 찾기 어려워진다는 의견.
   목록을 거르기만 하므로 저장된 내용은 건드리지 않는다. */
let 거르기 = { 글자: "", 카테고리: "", 부터: "", 까지: "" };          // 오늘 한도를 계산하려면 잔액·입금일·고정지출이 필요합니다


/* -------------------------------------------------------------------
   화면 그리기
   ------------------------------------------------------------------- */

// (1) 카테고리 6개를 select 안의 option 으로
function 카테고리채우기() {
  const select = document.getElementById("category");
  저장소.카테고리목록.forEach(function (이름) {
    const option = document.createElement("option");
    option.value = 이름;
    option.textContent = 이름;
    select.appendChild(option);
  });
}

// (2) 빠른 입력 버튼 3개
function 빠른입력그리기() {
  const 자리 = document.getElementById("quick-list");
  자리.innerHTML = "";

  if (빠른입력목록.length === 0) {
    자리.innerHTML = '<p class="note">메인 화면에서 자주 쓰는 항목을 등록하면 여기에 버튼이 생깁니다.</p>';
    return;
  }

  빠른입력목록.forEach(function (항목) {
    const button = document.createElement("button");
    button.className = "quick-btn";
    button.type = "button";
    button.innerHTML = `
      <span class="quick-btn-name">${항목.이름}</span>
      <span class="quick-btn-price">${원(항목.금액)}</span>
    `;
    button.addEventListener("click", async function () {
      button.disabled = true;                 // 두 번 눌려 두 건 들어가는 것 방지
      await 지출추가(항목.금액, 항목.카테고리, 날짜글자(오늘0시()), 항목.이름);
      button.disabled = false;
    });
    자리.appendChild(button);
  });
}

// (3) 기록된 목록
function 목록그리기() {
  const 목록칸 = document.getElementById("record-list");
  const 요약칸 = document.getElementById("record-summary");
  목록칸.innerHTML = "";

  /* 지출과 추가 입금을 한 목록에 섞어서 보여 줍니다.
     종류를 함께 들고 다녀야 삭제할 때 어느 표에서 지울지 알 수 있습니다. */
  const 모두 = []
    .concat(지출목록.map(function (x) { return Object.assign({ 종류: "지출" }, x); }))
    .concat(추가입금목록.map(function (x) { return Object.assign({ 종류: "입금" }, x); }));

  if (모두.length === 0) {
    목록칸.innerHTML = `<li class="record-empty">아직 기록한 내역이 없습니다.</li>`;
    요약칸.textContent = "0건";
    return;
  }

  // 검색 조건에 맞는 것만 남깁니다
  const 전체 = 모두.filter(function (항목) {
    if (거르기.부터 && 항목.날짜 < 거르기.부터) return false;
    if (거르기.까지 && 항목.날짜 > 거르기.까지) return false;
    if (거르기.카테고리) {
      const 이름 = 항목.종류 === "입금" ? "추가 입금" : 항목.카테고리;
      if (이름 !== 거르기.카테고리) return false;
    }
    if (거르기.글자) {
      const 찾을말 = 거르기.글자.toLowerCase();
      const 대상 = ((항목.메모 || "") + " " + (항목.카테고리 || "") +
                   (항목.종류 === "입금" ? " 추가 입금" : "")).toLowerCase();
      if (대상.indexOf(찾을말) === -1) return false;
    }
    return true;
  });

  const 거르는중 = !!(거르기.글자 || 거르기.카테고리 || 거르기.부터 || 거르기.까지);

  let 쓴돈 = 0, 받은돈 = 0;
  전체.forEach(function (항목) {
    if (항목.종류 === "입금") 받은돈 += 항목.금액; else 쓴돈 += 항목.금액;
  });
  요약칸.textContent = (거르는중 ? "찾은 " + 전체.length + "건 · " : "")
    + (받은돈 > 0
        ? "지출 " + 원(쓴돈) + " · 입금 " + 원(받은돈)
        : (거르는중 ? 원(쓴돈) : 전체.length + "건 · " + 원(쓴돈)));

  if (전체.length === 0) {
    목록칸.innerHTML = `<li class="record-none">조건에 맞는 기록이 없습니다.<br>검색어나 날짜를 바꿔 보세요.</li>`;
    return;
  }

  // 날짜순으로 정렬한 뒤 최근 것이 위로 오게 뒤집습니다
  전체.sort(function (a, b) { return a.날짜 < b.날짜 ? -1 : (a.날짜 > b.날짜 ? 1 : a.번호 - b.번호); });

  전체.slice().reverse().forEach(function (항목) {
    const 입금 = 항목.종류 === "입금";
    const li = document.createElement("li");
    li.className = "record-item";
    li.innerHTML = `
      <div class="record-left">
        <span class="record-category">${입금 ? "추가 입금" : 항목.카테고리}</span>
        <span class="record-memo">${항목.메모 || ""}</span>
        <span class="record-date">${항목.날짜}</span>
      </div>
      <span class="record-amount${입금 ? " record-amount--in" : ""}">${입금 ? "+" : ""}${원(항목.금액)}</span>
    `;

    // 삭제 버튼은 따로 만듭니다. 버튼에 "눌리면 이 일을 해라"를 붙이려면
    // 글자가 아니라 요소가 필요하기 때문입니다.
    const 삭제버튼 = document.createElement("button");
    삭제버튼.className = "record-delete";
    삭제버튼.type = "button";
    삭제버튼.textContent = "삭제";
    const 이름 = 입금 ? "추가 입금" : 항목.카테고리;
    삭제버튼.setAttribute("aria-label", 이름 + " " + 원(항목.금액) + " 기록 삭제");
    삭제버튼.addEventListener("click", function () {
      // 잘못 눌러 기록이 사라지지 않도록 한 번 확인합니다
      const 설명 = 이름 + " " + 원(항목.금액) + (항목.메모 ? " (" + 항목.메모 + ")" : "");
      if (!confirm(설명 + " 기록을 지울까요?")) return;
      if (입금) 입금삭제(항목.번호); else 지출삭제(항목.번호);
    });
    li.appendChild(삭제버튼);

    목록칸.appendChild(li);
  });
}


/* -------------------------------------------------------------------
   기록 추가 / 삭제
   배열을 바꾼 다음에는 반드시 저장까지 해야 새로고침에도 남습니다.
   ------------------------------------------------------------------- */

/* 오늘 한도 띠.
   계획서·발표 자료의 '저장하는 순간 오늘의 한도가 얼마나 줄었는지 바로 보여 줌' 부분입니다. */
function 한도띠그리기() {
  const 띠 = document.getElementById("limit-strip");
  if (!띠) return;

  if (!내돈 || (!내돈.입금일 && 입금예정목록.length === 0)) {
    띠.textContent = "메인 화면에서 내 돈 정보를 먼저 넣어 주세요";
    띠.className = "limit-strip";
    return;
  }

  /* 메인 화면과 반드시 같은 값이 나오도록 공통 함수를 씁니다.
     예전에는 여기서 따로 계산해서 두 화면의 숫자가 달랐습니다. */
  const 값 = 오늘기준계산({
    내돈: 내돈, 지출목록: 지출목록, 추가입금: 추가입금목록,
    고정지출: 고정지출목록, 예정지출: 예정지출목록, 입금예정: 입금예정목록
  });
  const 기준 = 값.기준, 오늘쓴금액 = 값.오늘쓴금액, 남은금액 = 값.남은금액;

  if (남은금액 >= 0) {
    띠.textContent = "오늘 더 쓸 수 있는 금액 " + 원(남은금액)
                   + "  (기준 " + 원(기준) + " − 오늘 쓴 " + 원(오늘쓴금액) + ")";
    띠.className = "limit-strip";
  } else {
    띠.textContent = "오늘 기준보다 " + 원(-남은금액) + " 더 썼어요"
                   + "  (기준 " + 원(기준) + " − 오늘 쓴 " + 원(오늘쓴금액) + ")";
    띠.className = "limit-strip limit-strip--over";
  }
}

// 저장에 실패하면 솔직하게 알려 줍니다
function 저장오류(보일지) {
  const 안내 = document.getElementById("storage-warning");
  if (안내) 안내.hidden = !보일지;
}

async function 지출추가(금액, 카테고리, 날짜, 메모) {
  // Supabase 가 붙여 준 id 를 받아 와야 삭제할 때 쓸 수 있습니다
  const id = await 저장소.지출추가(금액, 카테고리, 날짜, 메모);
  if (id === null) { 저장오류(true); return; }
  저장오류(false);

  지출목록.push({ 번호: id, 금액: 금액, 카테고리: 카테고리, 날짜: 날짜, 메모: 메모 });
  목록그리기();
  한도띠그리기();          // 기록한 즉시 오늘 한도가 줄어드는 것을 보여 줍니다
}

async function 입금추가(금액, 날짜, 메모) {
  const id = await 저장소.추가입금추가(금액, 날짜, 메모);
  if (id === null) { 저장오류(true); return; }
  저장오류(false);
  추가입금목록.push({ 번호: id, 금액: 금액, 날짜: 날짜, 메모: 메모, 기록시각: new Date().toISOString() });
  목록그리기();
  한도띠그리기();
}

async function 입금삭제(번호) {
  if (!(await 저장소.추가입금삭제(번호))) { 저장오류(true); return; }
  저장오류(false);
  추가입금목록 = 추가입금목록.filter(function (항목) { return 항목.번호 !== 번호; });
  목록그리기();
  한도띠그리기();
}

/* 화면은 최근 것이 위로 뒤집혀 있어서 '몇 번째 줄'로 지우면
   엉뚱한 기록이 지워집니다. 그래서 고유 번호(데이터베이스 id)로 찾아 지웁니다. */
async function 지출삭제(번호) {
  const 성공 = await 저장소.지출삭제(번호);
  if (!성공) { 저장오류(true); return; }
  저장오류(false);

  // filter = 조건에 맞는 것만 남겨 새 배열을 만들기
  지출목록 = 지출목록.filter(function (항목) {
    return 항목.번호 !== 번호;
  });
  목록그리기();
  한도띠그리기();
}


/* -------------------------------------------------------------------
   저장 버튼 처리
   ------------------------------------------------------------------- */
function 폼연결() {
  const form = document.getElementById("expense-form");
  const 오류칸 = document.getElementById("form-error");

  form.addEventListener("submit", async function (e) {
    // 이게 없으면 페이지가 새로고침되며 입력이 날아갑니다
    e.preventDefault();

    const 금액 = Number(document.getElementById("amount").value);
    const 카테고리 = document.getElementById("category").value;
    const 날짜 = document.getElementById("date").value;
    const 메모 = document.getElementById("memo").value;

    if (!금액 || 금액 <= 0) {
      오류칸.textContent = "금액을 1원 이상으로 입력해 주세요.";
      오류칸.hidden = false;
      return;
    }
    오류칸.hidden = true;

    const 저장버튼 = document.getElementById("save-btn");
    저장버튼.disabled = true;
    if (모드 === "입금") await 입금추가(금액, 날짜, 메모);
    else await 지출추가(금액, 카테고리, 날짜, 메모);
    저장버튼.disabled = false;

    // 다음 입력을 위해 금액과 메모만 비웁니다
    document.getElementById("amount").value = "";
    document.getElementById("memo").value = "";
    document.getElementById("amount").focus();
  });
}


/* 검색·필터 연결 (1514 조호준) */
function 거르기연결() {
  const 글자칸 = document.getElementById("filter-word");
  const 카테고리칸 = document.getElementById("filter-category");
  const 부터칸 = document.getElementById("filter-from");
  const 까지칸 = document.getElementById("filter-to");
  if (!글자칸) return;

  // 카테고리 고르는 칸 채우기 (추가 입금도 찾을 수 있게)
  저장소.카테고리목록.concat(["추가 입금"]).forEach(function (이름) {
    const o = document.createElement("option");
    o.value = 이름; o.textContent = 이름;
    카테고리칸.appendChild(o);
  });

  function 바뀜() {
    거르기 = {
      글자: 글자칸.value.trim(),
      카테고리: 카테고리칸.value,
      부터: 부터칸.value,
      까지: 까지칸.value
    };
    목록그리기();
  }

  [글자칸, 카테고리칸, 부터칸, 까지칸].forEach(function (칸) {
    칸.addEventListener("input", 바뀜);
    칸.addEventListener("change", 바뀜);
  });

  document.getElementById("filter-reset").addEventListener("click", function () {
    글자칸.value = ""; 카테고리칸.value = ""; 부터칸.value = ""; 까지칸.value = "";
    바뀜();
  });
}

/* 결과만 짧게 알려 줍니다 */
let 알림타이머 = null;
function 알림(글) {
  const 칸 = document.getElementById("toast");
  if (!칸) return;
  칸.textContent = 글;
  칸.hidden = false;
  clearTimeout(알림타이머);
  알림타이머 = setTimeout(function () { 칸.hidden = true; }, 2200);
}

/* 지출 / 입금 전환 */
function 모드바꾸기(새모드) {
  모드 = 새모드;
  const 칸 = document.getElementById("mode-switch");
  칸.querySelectorAll(".mode-btn").forEach(function (x) {
    x.classList.toggle("mode-btn--on", x.dataset.mode === 새모드);
  });
  // 입금에는 카테고리가 없습니다
  document.getElementById("category-field").hidden = (새모드 === "입금");
  document.getElementById("save-btn").textContent = (새모드 === "입금") ? "입금 저장" : "저장";
  document.getElementById("memo").placeholder = (새모드 === "입금")
    ? "세뱃돈, 길에서 주움, 용돈 …" : "학식, 친구 생일 모임 …";
}

function 모드연결() {
  const 칸 = document.getElementById("mode-switch");
  if (!칸) return;
  칸.querySelectorAll(".mode-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      모드바꾸기(b.dataset.mode);
      document.getElementById("amount").focus();
    });
  });

  /* 금액에 빼기를 붙여 넣으면 알아서 입금으로 바꿔 줍니다.
     '예기치 못하게 생긴 돈은 음수 지출로 적으면 되지 않나' 라는 생각에서 나온 것인데,
     음수를 그대로 저장하면 카테고리가 이상해지고 하루 평균 지출까지 틀어지므로
     입력만 그렇게 받고 저장은 입금으로 한다. */
  const 금액칸 = document.getElementById("amount");
  금액칸.addEventListener("input", function () {
    const 값 = 금액칸.value.trim();
    if (값.charAt(0) === "-" && 모드 !== "입금") {
      금액칸.value = 값.slice(1);     // 빼기는 떼고
      모드바꾸기("입금");
      알림("빼기를 붙이셨네요. 입금으로 바꿨어요");
    }
  });
}


/* -------------------------------------------------------------------
   실행
   ------------------------------------------------------------------- */
(async function 시작() {
  const user = await 로그인확인();
  if (!user) return;
  사용자띠그리기(user);

  카테고리채우기();
  빠른입력목록 = (await 저장소.빠른입력읽기()) || 저장소.기본빠른입력;
  빠른입력그리기();
  document.getElementById("date").value = 날짜글자(오늘0시());
  폼연결();
  모드연결();
  거르기연결();

  지출목록 = await 저장소.지출목록읽기();   // Supabase 에서 불러오기
  추가입금목록 = (await 저장소.추가입금읽기()) || [];
  고정지출목록 = (await 저장소.고정지출읽기()) || [];
  예정지출목록 = (await 저장소.예정지출읽기()) || [];
  입금예정목록 = (await 저장소.입금예정읽기()) || [];
  내돈 = await 저장소.내돈정보읽기();
  목록그리기();
  한도띠그리기();
})();
