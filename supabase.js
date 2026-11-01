/* ===================================================================
   Supabase 연결 설정 - supabase.js  (6차시)

   ★ 이 키를 코드에 그대로 적어도 되는 이유
     아래 anon 키는 '공개용 열쇠'입니다. 웹사이트 코드는 누구나 볼 수 있으니
     이 키도 당연히 보입니다. 그래도 괜찮은 이유는 테이블마다 RLS(행 수준 보안)를
     켜 두었기 때문입니다. RLS 가 켜져 있으면 데이터베이스가 줄마다 검사해서
     '지금 로그인한 사람의 줄'만 내어 줍니다.

     실제로 로그인 없이 지출을 넣어 보면 이렇게 거절당합니다.
       42501  new row violates row-level security policy for table "expenses"

     반대로 service_role 키는 RLS 를 무시하는 관리자 열쇠라
     절대 코드에 적으면 안 됩니다.
   =================================================================== */

const SUPABASE_URL = "https://xemhdplaeibojryughtc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlbWhkcGxhZWlib2pyeXVnaHRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1MTE3OTIsImV4cCI6MjEwOTA4Nzc5Mn0.yGV3LdaF62tNTwlHxpXTsijpDWQXno0eyj-N53dM3oQ";

// supabase-js 라이브러리가 만들어 둔 전역 객체로 연결을 만듭니다
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


/* ===================================================================
   로그인 상태 확인 / 로그아웃 / 상단 띠 그리기
   세 화면이 모두 쓰므로 여기에 모았습니다.
   =================================================================== */

// 지금 로그인한 사람. 로그인 안 했으면 null
async function 지금사용자() {
  const { data } = await sb.auth.getUser();
  return data.user || null;
}

/* 로그인이 필요한 화면에서 부릅니다.
   로그인 안 했으면 login.html 로 보냅니다. */
async function 로그인확인() {
  const user = await 지금사용자();
  if (!user) {
    location.href = "login.html";
    return null;
  }
  return user;
}

// 화면 맨 위에 "누구로 로그인했는지 + 로그아웃" 띠를 붙입니다
function 사용자띠그리기(user) {
  const 띠 = document.getElementById("user-bar");
  if (!띠) return;
  띠.innerHTML = `
    <span class="user-bar-email">${user.email}</span>
    <button class="user-bar-logout" type="button" id="logout-btn">로그아웃</button>
  `;
  document.getElementById("logout-btn").addEventListener("click", async function () {
    await sb.auth.signOut();
    location.href = "login.html";
  });
}
