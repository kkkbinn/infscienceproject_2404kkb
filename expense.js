/* ===================================================================
   지출 입력 화면 - expense.js  (3차시)

   하는 일은 두 가지입니다.
   1) 저장 버튼을 누르면 입력한 내용을 목록에 한 줄 추가한다
   2) 빠른 입력 버튼을 누르면 미리 정해 둔 항목을 바로 한 줄 추가한다

   ★ 오늘도 계산은 하지 않습니다.
     안전 지출 금액을 다시 구하는 일은 4차시,
     새로고침해도 목록이 남게 만드는 일은 8차시(Supabase)입니다.
   =================================================================== */


/* -------------------------------------------------------------------
   1) 기본 데이터
   ------------------------------------------------------------------- */

// 계획서에서 정한 지출 카테고리 6개
const 카테고리목록 = ["식비", "배달", "카페", "유흥/모임", "교통", "기타"];

// 원터치 빠른 입력 버튼 3개
const 빠른입력목록 = [
  { 이름: "학식", 금액: 5000, 카테고리: "식비" },
  { 이름: "버스", 금액: 1500, 카테고리: "교통" },
  { 이름: "커피", 금액: 1500, 카테고리: "카페" }
];

// 기록된 지출이 쌓이는 곳.
// 이건 컴퓨터가 잠깐 기억하는 값이라, 새로고침하면 빈 배열로 돌아갑니다.
let 지출목록 = [];


/* -------------------------------------------------------------------
   2) 도우미 함수
   ------------------------------------------------------------------- */

// 12000 -> "12,000원"
function 원(숫자) {
  return 숫자.toLocaleString("ko-KR") + "원";
}

// 오늘 날짜를 "2026-09-29" 모양으로 만듭니다.
// padStart(2, "0") 은 9를 09로 바꿔 주는 것입니다.
function 오늘날짜() {
  const d = new Date();
  const 년 = d.getFullYear();
  const 월 = String(d.getMonth() + 1).padStart(2, "0");  // getMonth()는 0부터 시작
  const 일 = String(d.getDate()).padStart(2, "0");
  return 년 + "-" + 월 + "-" + 일;
}


/* -------------------------------------------------------------------
   3) 화면 그리기
   ------------------------------------------------------------------- */

// (1) 카테고리 6개를 select 안의 option 으로 만들어 넣기
function 카테고리채우기() {
  const select = document.getElementById("category");
  카테고리목록.forEach(function (이름) {
    const option = document.createElement("option");
    option.value = 이름;
    option.textContent = 이름;
    select.appendChild(option);
  });
}

// (2) 빠른 입력 버튼 3개 만들기
function 빠른입력그리기() {
  const 자리 = document.getElementById("quick-list");
  자리.innerHTML = "";

  빠른입력목록.forEach(function (항목) {
    const button = document.createElement("button");
    button.className = "quick-btn";
    button.type = "button";          // form 안이 아니어도 실수로 제출되지 않게
    button.innerHTML = `
      <span class="quick-btn-name">${항목.이름}</span>
      <span class="quick-btn-price">${원(항목.금액)}</span>
    `;
    // addEventListener = "이 버튼이 눌리면 이 일을 해라"
    button.addEventListener("click", function () {
      지출추가(항목.금액, 항목.카테고리, 오늘날짜(), 항목.이름);
    });
    자리.appendChild(button);
  });
}

// (3) 기록된 목록을 화면에 다시 그리기
function 목록그리기() {
  const 목록 = document.getElementById("record-list");
  const 요약 = document.getElementById("record-summary");
  목록.innerHTML = "";

  if (지출목록.length === 0) {
    목록.innerHTML = `<li class="record-empty">아직 기록한 지출이 없습니다.</li>`;
    요약.textContent = "0건";
    return;                    // 여기서 함수를 끝냅니다
  }

  // 합계 = 기록한 금액을 전부 더한 값
  let 합계 = 0;
  지출목록.forEach(function (항목) {
    합계 = 합계 + 항목.금액;
  });
  요약.textContent = 지출목록.length + "건 · " + 원(합계);

  // slice().reverse() = 원본을 건드리지 않고 순서만 뒤집기 (최근 것이 위로)
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
    목록.appendChild(li);
  });
}


/* -------------------------------------------------------------------
   4) 지출 한 건 추가하기
      직접 입력과 빠른 입력이 똑같이 이 함수를 부릅니다.
   ------------------------------------------------------------------- */
function 지출추가(금액, 카테고리, 날짜, 메모) {
  // push = 배열 맨 뒤에 하나 붙이기
  지출목록.push({
    금액: 금액,
    카테고리: 카테고리,
    날짜: 날짜,
    메모: 메모
  });
  목록그리기();     // 배열이 바뀌었으니 화면도 다시 그립니다
}


/* -------------------------------------------------------------------
   5) 저장 버튼 처리
   ------------------------------------------------------------------- */
function 폼연결() {
  const form = document.getElementById("expense-form");
  const 오류칸 = document.getElementById("form-error");

  form.addEventListener("submit", function (e) {
    // 이게 없으면 저장을 누를 때 페이지가 새로고침돼 목록이 날아갑니다
    e.preventDefault();

    // Number(...) = 입력칸의 글자를 숫자로 바꾸기
    const 금액 = Number(document.getElementById("amount").value);
    const 카테고리 = document.getElementById("category").value;
    const 날짜 = document.getElementById("date").value;
    const 메모 = document.getElementById("memo").value;

    // 금액이 비었거나 0 이하이면 여기서 멈춥니다
    if (!금액 || 금액 <= 0) {
      오류칸.textContent = "금액을 1원 이상으로 입력해 주세요.";
      오류칸.hidden = false;
      return;
    }
    오류칸.hidden = true;

    지출추가(금액, 카테고리, 날짜, 메모);

    // 다음 입력을 위해 금액과 메모만 비웁니다 (카테고리·날짜는 그대로 두면 편함)
    document.getElementById("amount").value = "";
    document.getElementById("memo").value = "";
    document.getElementById("amount").focus();
  });
}


/* -------------------------------------------------------------------
   6) 실행
   ------------------------------------------------------------------- */
카테고리채우기();
빠른입력그리기();
document.getElementById("date").value = 오늘날짜();   // 날짜 기본값 = 오늘
폼연결();
목록그리기();
