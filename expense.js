/* ===================================================================
   지출 입력 화면 - expense.js  (3차시 → 5차시)

   3차시: 저장을 누르면 목록에 한 줄 추가 (새로고침하면 사라짐)
   5차시: storage.js 를 통해 저장해서 새로고침해도 남음

   계산 함수와 저장 기능은 storage.js 에 있습니다.
   =================================================================== */

const 빠른입력목록 = [
  { 이름: "학식", 금액: 5000, 카테고리: "식비" },
  { 이름: "버스", 금액: 1500, 카테고리: "교통" },
  { 이름: "커피", 금액: 1500, 카테고리: "카페" }
];

// ★ 5차시: 화면을 열 때 저장해 둔 기록을 먼저 불러옵니다.
//   3차시에는 여기가 항상 빈 배열이라 새로고침하면 사라졌습니다.
let 지출목록 = 저장소.지출목록읽기();

/* 기록마다 붙는 고유 번호.
   저장된 기록 중 가장 큰 번호 다음부터 이어 붙여야
   새로고침 뒤에 번호가 겹치지 않습니다. */
let 다음번호 = 1;
지출목록.forEach(function (항목) {
  if (항목.번호 >= 다음번호) 다음번호 = 항목.번호 + 1;
});


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

  빠른입력목록.forEach(function (항목) {
    const button = document.createElement("button");
    button.className = "quick-btn";
    button.type = "button";
    button.innerHTML = `
      <span class="quick-btn-name">${항목.이름}</span>
      <span class="quick-btn-price">${원(항목.금액)}</span>
    `;
    button.addEventListener("click", function () {
      지출추가(항목.금액, 항목.카테고리, 날짜글자(오늘0시()), 항목.이름);
    });
    자리.appendChild(button);
  });
}

// (3) 기록된 목록
function 목록그리기() {
  const 목록칸 = document.getElementById("record-list");
  const 요약칸 = document.getElementById("record-summary");
  목록칸.innerHTML = "";

  if (지출목록.length === 0) {
    목록칸.innerHTML = `<li class="record-empty">아직 기록한 지출이 없습니다.</li>`;
    요약칸.textContent = "0건";
    return;
  }

  let 합계 = 0;
  지출목록.forEach(function (항목) { 합계 += 항목.금액; });
  요약칸.textContent = 지출목록.length + "건 · " + 원(합계);

  // slice().reverse() = 원본은 그대로 두고 순서만 뒤집기 (최근 것이 위로)
  지출목록.slice().reverse().forEach(function (항목) {
    const li = document.createElement("li");
    li.className = "record-item";
    li.innerHTML = `
      <div class="record-left">
        <span class="record-category">${항목.카테고리}</span>
        <span class="record-memo">${항목.메모 || ""}</span>
        <span class="record-date">${항목.날짜}</span>
      </div>
      <span class="record-amount">${원(항목.금액)}</span>
    `;

    // 삭제 버튼은 따로 만듭니다. 버튼에 "눌리면 이 일을 해라"를 붙이려면
    // 글자가 아니라 요소가 필요하기 때문입니다.
    const 삭제버튼 = document.createElement("button");
    삭제버튼.className = "record-delete";
    삭제버튼.type = "button";
    삭제버튼.textContent = "삭제";
    삭제버튼.setAttribute("aria-label", 항목.카테고리 + " " + 원(항목.금액) + " 기록 삭제");
    삭제버튼.addEventListener("click", function () {
      지출삭제(항목.번호);
    });
    li.appendChild(삭제버튼);

    목록칸.appendChild(li);
  });
}


/* -------------------------------------------------------------------
   기록 추가 / 삭제
   배열을 바꾼 다음에는 반드시 저장까지 해야 새로고침에도 남습니다.
   ------------------------------------------------------------------- */

function 저장하고다시그리기() {
  const 성공 = 저장소.지출목록쓰기(지출목록);
  목록그리기();

  // 저장이 안 되는 환경(시크릿 모드 등)이면 솔직하게 알려 줍니다
  const 안내 = document.getElementById("storage-warning");
  if (안내) 안내.hidden = 성공;
}

function 지출추가(금액, 카테고리, 날짜, 메모) {
  지출목록.push({
    번호: 다음번호,
    금액: 금액,
    카테고리: 카테고리,
    날짜: 날짜,
    메모: 메모
  });
  다음번호 = 다음번호 + 1;
  저장하고다시그리기();
}

/* 화면은 최근 것이 위로 뒤집혀 있어서 '몇 번째 줄'로 지우면
   엉뚱한 기록이 지워집니다. 그래서 고유 번호로 찾아 지웁니다. */
function 지출삭제(번호) {
  // filter = 조건에 맞는 것만 남겨 새 배열을 만들기
  지출목록 = 지출목록.filter(function (항목) {
    return 항목.번호 !== 번호;
  });
  저장하고다시그리기();
}


/* -------------------------------------------------------------------
   저장 버튼 처리
   ------------------------------------------------------------------- */
function 폼연결() {
  const form = document.getElementById("expense-form");
  const 오류칸 = document.getElementById("form-error");

  form.addEventListener("submit", function (e) {
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

    지출추가(금액, 카테고리, 날짜, 메모);

    // 다음 입력을 위해 금액과 메모만 비웁니다
    document.getElementById("amount").value = "";
    document.getElementById("memo").value = "";
    document.getElementById("amount").focus();
  });
}


/* -------------------------------------------------------------------
   실행
   ------------------------------------------------------------------- */
카테고리채우기();
빠른입력그리기();
document.getElementById("date").value = 날짜글자(오늘0시());
폼연결();
목록그리기();
