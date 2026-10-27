/* ===================================================================
   저장 담당 - storage.js  (5차시)

   화면 세 개(메인·지출 입력·통계)가 같은 데이터를 봐야 하고,
   새로고침해도 남아 있어야 해서 저장을 한 곳에 모았습니다.

   ★ 왜 따로 떼어 놓았나
     지금은 localStorage(브라우저가 가진 작은 저장 공간)를 씁니다.
     나중에 Supabase로 바꿀 때, 다른 파일은 그대로 두고
     이 파일 안쪽만 고치면 되게 하려고 분리했습니다.

   ★ localStorage 의 한계 (그래서 Supabase 가 필요함)
     - 그 브라우저에만 남습니다. 휴대폰으로 열면 내 기록이 없습니다.
     - 시크릿 모드나 방문 기록 삭제로 날아갑니다.
     - 로그인 개념이 없어 '누구의 기록'인지 구분하지 못합니다.
   =================================================================== */

const 저장소 = (function () {

  // localStorage 안에서 쓸 이름표. 다른 사이트와 섞이지 않게 앞에 이름을 붙입니다.
  const 키 = {
    지출: "oneulbudget.지출목록",
    내돈: "oneulbudget.내돈정보",
    예산: "oneulbudget.카테고리예산"
  };

  /* localStorage 는 시크릿 모드나 저장 공간이 꽉 찼을 때 오류를 냅니다.
     try / catch 로 감싸 두면 오류가 나도 화면이 멈추지 않고,
     저장된 게 없는 것처럼 기본값으로 넘어갑니다. */
  function 읽기(이름표, 기본값) {
    try {
      const 글자 = localStorage.getItem(이름표);
      if (!글자) return 기본값;
      // 저장할 때 글자로 바꿨으므로, 읽을 때 다시 원래 모양으로 되돌립니다
      return JSON.parse(글자);
    } catch (e) {
      return 기본값;
    }
  }

  function 쓰기(이름표, 값) {
    try {
      // localStorage 에는 글자만 넣을 수 있어서 JSON.stringify 로 바꿉니다
      localStorage.setItem(이름표, JSON.stringify(값));
      return true;
    } catch (e) {
      return false;   // 저장 실패해도 앱은 계속 돌아갑니다
    }
  }

  /* 카테고리별 한 달 예산의 기본값.
     사용자가 고치면 그 값이 저장되고, 처음 열었을 땐 이 값이 쓰입니다. */
  const 기본예산 = {
    "식비": 150000,
    "배달": 60000,
    "카페": 40000,
    "유흥/모임": 160000,
    "교통": 100000,
    "기타": 50000
  };

  // 바깥에서 쓸 수 있게 내보내는 것들
  return {
    카테고리목록: ["식비", "배달", "카페", "유흥/모임", "교통", "기타"],

    지출목록읽기: function () {
      return 읽기(키.지출, []);
    },
    지출목록쓰기: function (목록) {
      return 쓰기(키.지출, 목록);
    },

    // 메인 화면의 '내 돈 정보' 세 칸
    내돈정보읽기: function () {
      return 읽기(키.내돈, null);
    },
    내돈정보쓰기: function (정보) {
      return 쓰기(키.내돈, 정보);
    },

    예산읽기: function () {
      return 읽기(키.예산, 기본예산);
    },
    예산쓰기: function (예산) {
      return 쓰기(키.예산, 예산);
    },

    전체지우기: function () {
      try {
        Object.values(키).forEach(function (이름표) {
          localStorage.removeItem(이름표);
        });
        return true;
      } catch (e) { return false; }
    }
  };
})();


/* ===================================================================
   계산 담당 - 화면과 상관없이 "숫자를 넣으면 숫자가 나오는" 함수들
   세 화면이 똑같은 계산을 써야 해서 여기에 모았습니다.
   값이 이상하면 여기부터 의심하면 됩니다.
   =================================================================== */

// 312000 -> "312,000원"
function 원(숫자) {
  return Math.round(숫자).toLocaleString("ko-KR") + "원";
}

// Date -> "2026-10-27"
function 날짜글자(d) {
  const 년 = d.getFullYear();
  const 월 = String(d.getMonth() + 1).padStart(2, "0");   // getMonth()는 0부터 시작
  const 일 = String(d.getDate()).padStart(2, "0");
  return 년 + "-" + 월 + "-" + 일;
}

// "2026-10-27" -> Date (시·분·초 없이 그날 0시)
function 글자날짜(글자) {
  const 조각 = 글자.split("-").map(Number);
  return new Date(조각[0], 조각[1] - 1, 조각[2]);
}

// 오늘 0시. 시·분·초를 버려야 날짜 빼기가 정확해집니다.
function 오늘0시() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

const 하루밀리초 = 1000 * 60 * 60 * 24;

// 오늘부터 입금일까지 며칠 남았는지
function 남은일수계산(입금일글자) {
  if (!입금일글자) return 0;
  return Math.round((글자날짜(입금일글자) - 오늘0시()) / 하루밀리초);
}

// 오늘의 안전 지출 금액 = (잔액 − 고정지출 − 이미 쓴 돈) ÷ 남은 일수
// Math.floor = 버림. 올리면 마지막 날 몇 원이 모자랄 수 있습니다.
function 안전금액계산(잔액, 고정지출, 남은일수) {
  const 쓸수있는돈 = 잔액 - 고정지출;
  if (남은일수 <= 0) return 0;
  if (쓸수있는돈 <= 0) return 0;
  return Math.floor(쓸수있는돈 / 남은일수);
}

// 어떤 달(예 "2026-10")의 지출만 걸러 냅니다
function 그달지출(목록, 달글자) {
  return 목록.filter(function (항목) {
    return 항목.날짜 && 항목.날짜.slice(0, 7) === 달글자;
  });
}

// 카테고리별로 얼마 썼는지 합계를 냅니다 -> { "식비": 12000, ... }
function 카테고리별합계(목록) {
  const 합 = {};
  저장소.카테고리목록.forEach(function (이름) { 합[이름] = 0; });
  목록.forEach(function (항목) {
    if (합[항목.카테고리] === undefined) 합[항목.카테고리] = 0;
    합[항목.카테고리] += 항목.금액;
  });
  return 합;
}

// 최근 N일 동안의 하루 평균 지출 (계획서 처리 ⑤)
function 하루평균지출(목록, 일수) {
  const 기준 = new Date(오늘0시().getTime() - (일수 - 1) * 하루밀리초);
  let 합 = 0;
  목록.forEach(function (항목) {
    if (!항목.날짜) return;
    const d = 글자날짜(항목.날짜);
    if (d >= 기준 && d <= 오늘0시()) 합 += 항목.금액;
  });
  return 합 / 일수;
}

// 소진율에 따른 막대 색 (빠듯한 항목은 색으로 구분)
function 막대색(소진율) {
  if (소진율 >= 80) return "bar-fill--danger";
  if (소진율 >= 50) return "bar-fill--warn";
  return "bar-fill--safe";
}
