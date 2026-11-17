/* ===================================================================
   가입 전에 먼저 계산해 보는 화면 - try.js

   동료 피드백 (1114 이영재)
     "잔액이랑 다음 입금일만 넣으면 되는 서비스인 것 같은데,
      결과를 보려면 먼저 가입해야 해서 그냥 계산기를 켤 것 같음.
      첫 화면에서 예시 금액으로라도 계산해보고,
      기록을 저장하고 싶을 때 가입할 수 있으면 좋을 것 같다."

   그래서 로그인 없이 숫자만 먼저 보여 준다.
   Supabase 를 쓰지 않으므로 이 화면은 혼자서도 돌아간다.
   넣은 값은 가입 뒤 처음 설정 화면에 그대로 채워진다.
   =================================================================== */

const 넘길값키 = "oneulbudget.체험값";

function 원(숫자) {
  return Math.round(숫자).toLocaleString("ko-KR") + "원";
}

function 날짜글자(d) {
  const 년 = d.getFullYear();
  const 월 = String(d.getMonth() + 1).padStart(2, "0");
  const 일 = String(d.getDate()).padStart(2, "0");
  return 년 + "-" + 월 + "-" + 일;
}

function 남은일수(입금일글자) {
  if (!입금일글자) return 0;
  const 조각 = 입금일글자.split("-").map(Number);
  const 입금일 = new Date(조각[0], 조각[1] - 1, 조각[2]);
  const n = new Date();
  const 오늘 = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  return Math.round((입금일 - 오늘) / (1000 * 60 * 60 * 24));
}

function 값읽기() {
  return {
    잔액: Number(document.getElementById("try-balance").value),
    입금일: document.getElementById("try-date").value,
    고정지출: Number(document.getElementById("try-fixed").value)
  };
}

function 계산() {
  const v = 값읽기();
  const 금액칸 = document.getElementById("try-amount");
  const 안내칸 = document.getElementById("try-hint");
  const 식칸 = document.getElementById("try-formula");
  const 일수 = 남은일수(v.입금일);

  if (!(v.잔액 > 0)) {
    금액칸.textContent = "―";
    안내칸.textContent = "지금 가진 돈을 넣어 주세요";
    식칸.textContent = "";
    return;
  }
  if (!(일수 > 0)) {
    금액칸.textContent = "―";
    안내칸.textContent = "돈이 들어오는 날을 내일 이후로 골라 주세요";
    식칸.textContent = "";
    return;
  }

  const 쓸수있는돈 = v.잔액 - v.고정지출;
  const 하루 = 쓸수있는돈 > 0 ? Math.floor(쓸수있는돈 / 일수) : 0;

  금액칸.textContent = 원(하루);
  안내칸.textContent = 하루 > 0
    ? "여기까지는 써도 괜찮아요"
    : "고정지출을 내고 나면 남는 돈이 없어요";
  식칸.textContent = "(" + 원(v.잔액) + " − " + 원(v.고정지출) + ") ÷ " + 일수 + "일";

  // 가입으로 넘어갈 때 쓰도록 적어 둡니다
  try { localStorage.setItem(넘길값키, JSON.stringify(v)); } catch (e) { /* 저장 못 해도 그만 */ }
}

["try-balance", "try-date", "try-fixed"].forEach(function (id) {
  document.getElementById(id).addEventListener("input", 계산);
  document.getElementById(id).addEventListener("change", 계산);
});

// 날짜 기본값은 오늘 + 9일
const d = new Date();
d.setDate(d.getDate() + 9);
document.getElementById("try-date").value = 날짜글자(d);
계산();
