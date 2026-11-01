/* ===================================================================
   처음 설정 화면 - setup.js

   처음 로그인하면 계산에 꼭 필요한 네 가지를 먼저 물어봅니다.
   이게 없으면 '오늘 쓸 수 있는 금액'을 계산할 수 없기 때문입니다.
   =================================================================== */

function 값읽기() {
  return {
    잔액: Number(document.getElementById("s-balance").value),
    입금일: document.getElementById("s-date").value,
    수입종류: document.getElementById("s-income-type").value,
    수입금액: Number(document.getElementById("s-income-amount").value),
    고정지출: Number(document.getElementById("s-fixed").value)
  };
}

// 입력하는 즉시 결과를 미리 보여 줍니다 (뭘 위한 값인지 바로 알 수 있게)
function 미리보기() {
  const v = 값읽기();
  const 금액칸 = document.getElementById("s-preview");
  const 식칸 = document.getElementById("s-formula");
  const 남은일수 = 남은일수계산(v.입금일);

  if (!(남은일수 > 0) || !(v.잔액 > 0)) {
    금액칸.textContent = "―";
    식칸.textContent = "가진 돈과 입금일을 넣으면 계산됩니다";
    return;
  }
  const 안전금액 = 안전금액계산(v.잔액, v.고정지출, 남은일수);
  금액칸.textContent = "하루 " + 원(안전금액);
  식칸.textContent = "(" + 원(v.잔액) + " − " + 원(v.고정지출) + ") ÷ " + 남은일수 + "일";
}

["s-balance", "s-date", "s-income-amount", "s-fixed"].forEach(function (id) {
  document.getElementById(id).addEventListener("input", 미리보기);
});

document.getElementById("setup-form").addEventListener("submit", async function (e) {
  e.preventDefault();
  const v = 값읽기();
  const 오류칸 = document.getElementById("s-error");

  if (남은일수계산(v.입금일) <= 0) {
    오류칸.textContent = "다음에 돈이 들어오는 날을 내일 이후로 골라 주세요.";
    오류칸.hidden = false;
    return;
  }
  오류칸.hidden = true;

  const 버튼 = document.getElementById("s-save");
  버튼.disabled = true;
  const 성공 = await 저장소.내돈정보쓰기(v);
  버튼.disabled = false;

  if (!성공) {
    오류칸.textContent = "저장하지 못했습니다. 인터넷 연결을 확인하고 다시 눌러 주세요.";
    오류칸.hidden = false;
    return;
  }
  location.href = "index.html";
});

(async function 시작() {
  const user = await 로그인확인();
  if (!user) return;
  사용자띠그리기(user);

  // 날짜 칸 기본값은 오늘 + 9일
  const d = new Date();
  d.setDate(d.getDate() + 9);
  document.getElementById("s-date").value = 날짜글자(d);
  미리보기();
})();
