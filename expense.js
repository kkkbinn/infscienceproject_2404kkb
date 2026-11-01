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

/* ★ 7차시: 기록을 Supabase 에서 불러옵니다.
   번호(id)는 데이터베이스가 붙여 주므로 여기서 셀 필요가 없어졌습니다. */
let 지출목록 = [];
let 내돈 = null;          // 오늘 한도를 계산하려면 잔액·입금일·고정지출이 필요합니다


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

/* 오늘 한도 띠.
   계획서·발표 자료의 '저장하는 순간 오늘의 한도가 얼마나 줄었는지 바로 보여 줌' 부분입니다. */
function 한도띠그리기() {
  const 띠 = document.getElementById("limit-strip");
  if (!띠) return;

  if (!내돈 || !내돈.입금일) {
    띠.textContent = "메인 화면에서 내 돈 정보를 먼저 넣어 주세요";
    띠.className = "limit-strip";
    return;
  }

  const 남은일수 = 남은일수계산(내돈.입금일);
  const 기준 = 안전금액계산(내돈.잔액, 내돈.고정지출, 남은일수);
  const 오늘쓴금액 = 그날쓴금액(지출목록, 날짜글자(오늘0시()));
  const 남은금액 = 기준 - 오늘쓴금액;

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
    await 지출추가(금액, 카테고리, 날짜, 메모);
    저장버튼.disabled = false;

    // 다음 입력을 위해 금액과 메모만 비웁니다
    document.getElementById("amount").value = "";
    document.getElementById("memo").value = "";
    document.getElementById("amount").focus();
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
  빠른입력그리기();
  document.getElementById("date").value = 날짜글자(오늘0시());
  폼연결();

  지출목록 = await 저장소.지출목록읽기();   // Supabase 에서 불러오기
  내돈 = await 저장소.내돈정보읽기();
  목록그리기();
  한도띠그리기();
})();
