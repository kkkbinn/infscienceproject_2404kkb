/* ===================================================================
   처음 사용 안내 (tour.js)

   회원가입하고 처음 들어온 사람에게, 화면의 각 부분이 무엇인지
   하나씩 짚어 가며 알려 줍니다. 게임의 튜토리얼처럼
   설명할 곳만 밝게 남기고 나머지는 어둡게 덮습니다.

   ★ 어떻게 '구멍'을 만드나
     박스그림자(box-shadow)를 아주 크게 주면, 그 요소 바깥이 전부
     어두워지고 요소 자리만 그대로 남습니다. 그림을 덧그리지 않아도
     구멍이 뚫린 것처럼 보입니다.

   한 번 본 사람에게는 다시 뜨지 않습니다.
   상단의 '사용법' 버튼을 누르면 언제든 다시 볼 수 있습니다.
   =================================================================== */

const 안내 = (function () {

  const 본적있음키 = "oneulbudget.안내봤음";

  // 짚어 줄 곳과 설명. 화면에 없는 것은 자동으로 건너뜁니다.
  const 단계들 = [
    {
      대상: ".today",
      제목: "이 숫자 하나만 보면 됩니다",
      설명: "다음 입금일까지 남은 돈을 남은 날로 나눈 금액이에요. 오늘 여기까지는 써도 괜찮습니다.",
      아래: true
    },
    {
      대상: "#today-formula",
      제목: "어떻게 나온 숫자인지도 보여 줍니다",
      설명: "계산 과정을 그대로 적어 두었어요. 직접 더하고 빼서 맞춰 볼 수 있습니다.",
      아래: true
    },
    {
      대상: "#input-balance",
      제목: "내 돈 정보를 넣어 주세요",
      설명: "지금 가진 돈, 다음에 돈이 들어오는 날, 들어올 금액이에요. 고치면 위 금액이 바로 다시 계산됩니다.",
      아래: true
    },
    {
      대상: "#fixed-form",
      제목: "매달 빠져나가는 돈",
      설명: "통신비·구독료처럼 고정으로 나가는 돈이에요. 먼저 빼고 계산하니 더 정확해집니다.",
      아래: true
    },
    {
      대상: "#planned-form",
      제목: "예정된 큰 지출도 미리",
      설명: "생일 선물처럼 그날 한 번 나갈 돈을 적어 두면, 그날까지 매일 조금씩 미리 떼어 둡니다.",
      아래: true
    },
    {
      대상: "#category-list",
      제목: "어디에 많이 썼는지",
      설명: "카테고리별로 남은 예산이에요. 빠듯한 항목은 색이 빨갛게 바뀝니다.",
      아래: true
    },
    {
      대상: "#quick-list",
      제목: "기록은 버튼 한 번으로",
      설명: "자주 쓰는 항목은 여기서 바로 기록돼요. 아래에서 내가 쓰는 항목을 직접 추가할 수도 있습니다.",
      아래: true
    },
    {
      대상: ".tabbar",
      제목: "지출 입력과 통계",
      설명: "'지출 입력'에서 자세히 적고 꽁돈도 기록할 수 있어요. '통계'에서는 앞으로 6개월이 어떻게 될지 보여 줍니다.",
      아래: false
    }
  ];

  let 현재 = 0;
  let 보일단계 = [];
  let 덮개, 구멍, 말풍선;
  let 그리기타이머 = null;

  function 만들기() {
    덮개 = document.createElement("div");
    덮개.className = "tour-layer";

    구멍 = document.createElement("div");
    구멍.className = "tour-spot";

    말풍선 = document.createElement("div");
    말풍선.className = "tour-box";
    말풍선.innerHTML = `
      <p class="tour-step"><span id="tour-now">1</span> / <span id="tour-total">1</span></p>
      <h3 class="tour-title" id="tour-title"></h3>
      <p class="tour-desc" id="tour-desc"></p>
      <div class="tour-btns">
        <button class="tour-skip" type="button" id="tour-skip">건너뛰기</button>
        <button class="tour-next" type="button" id="tour-next">다음</button>
      </div>
    `;

    덮개.appendChild(구멍);
    덮개.appendChild(말풍선);
    document.body.appendChild(덮개);

    document.getElementById("tour-skip").addEventListener("click", 끝내기);
    document.getElementById("tour-next").addEventListener("click", 다음);
    // 어두운 곳을 눌러도 넘어갑니다
    덮개.addEventListener("click", function (e) {
      if (e.target === 덮개) 다음();
    });
  }

  function 그리기() {
    const 단계 = 보일단계[현재];
    const el = document.querySelector(단계.대상);
    if (!el) { 다음(); return; }

    // 설명할 곳이 화면 가운데 오도록 먼저 옮깁니다
    el.scrollIntoView({ block: "center", behavior: "smooth" });

    /* 스크롤이 멈춘 뒤에 위치를 재야 정확합니다.
       다만 기다리는 사이에 건너뛰기를 누르면 안내가 이미 사라지고 없습니다.
       그 상태에서 글자를 바꾸려 하면 오류가 나므로 먼저 확인합니다. */
    clearTimeout(그리기타이머);
    그리기타이머 = setTimeout(function () {
      if (!덮개 || !document.body.contains(덮개)) return;
      const r = el.getBoundingClientRect();
      const 여유 = 8;
      구멍.style.top = (r.top - 여유) + "px";
      구멍.style.left = (r.left - 여유) + "px";
      구멍.style.width = (r.width + 여유 * 2) + "px";
      구멍.style.height = (r.height + 여유 * 2) + "px";

      // 말풍선은 대상 아래에 두되, 아래 공간이 모자라면 위로 올립니다
      const 말풍선높이 = 말풍선.offsetHeight || 170;
      let top = r.bottom + 16;
      if (!단계.아래 || top + 말풍선높이 > window.innerHeight - 12) {
        top = r.top - 말풍선높이 - 16;
      }
      if (top < 12) top = 12;
      말풍선.style.top = top + "px";

      document.getElementById("tour-now").textContent = 현재 + 1;
      document.getElementById("tour-total").textContent = 보일단계.length;
      document.getElementById("tour-title").textContent = 단계.제목;
      document.getElementById("tour-desc").textContent = 단계.설명;
      document.getElementById("tour-next").textContent =
        (현재 === 보일단계.length - 1) ? "다 봤어요" : "다음";
    }, 320);
  }

  function 다음() {
    현재 += 1;
    if (현재 >= 보일단계.length) { 끝내기(); return; }
    그리기();
  }

  function 끝내기() {
    try { localStorage.setItem(본적있음키, "1"); } catch (e) { /* 저장 못 해도 그만 */ }
    clearTimeout(그리기타이머);
    그리기타이머 = null;
    if (덮개) { 덮개.remove(); 덮개 = null; }
    window.removeEventListener("resize", 그리기);
  }

  function 시작(처음인가) {
    // 화면에 실제로 있는 것만 남깁니다
    보일단계 = 단계들.filter(function (s) { return document.querySelector(s.대상); });
    if (보일단계.length === 0) return;

    if (덮개) 끝내기();      // 이미 열려 있으면 먼저 닫습니다
    현재 = 0;
    만들기();
    그리기();
    window.addEventListener("resize", 그리기);
  }

  return {
    // 처음 들어온 사람에게만 저절로 뜹니다
    처음이면시작: function () {
      let 봤나 = "1";
      try { 봤나 = localStorage.getItem(본적있음키); } catch (e) { 봤나 = null; }
      if (!봤나) setTimeout(function () { 시작(true); }, 700);
    },
    // '사용법' 버튼으로 다시 보기
    다시보기: function () { 시작(false); }
  };
})();
