/* ===================================================================
   로그인 화면 - login.js  (6차시)
   이메일과 비밀번호로 가입하고 로그인합니다.
   =================================================================== */

const 오류칸 = document.getElementById("login-error");
const 안내칸 = document.getElementById("login-ok");

function 오류(글) { 오류칸.textContent = 글; 오류칸.hidden = false; 안내칸.hidden = true; }
function 안내(글) { 안내칸.textContent = 글; 안내칸.hidden = false; 오류칸.hidden = true; }

function 입력값() {
  return {
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value
  };
}

/* Supabase 가 돌려주는 오류 메시지는 영어라서,
   자주 나오는 것만 한국어로 바꿔 줍니다. */
function 한국어오류(message) {
  if (!message) return "알 수 없는 오류가 났습니다.";
  if (message.includes("Invalid login credentials"))
    return "이메일이나 비밀번호가 맞지 않습니다.";
  if (message.includes("already registered"))
    return "이미 가입된 이메일입니다. 로그인을 눌러 주세요.";
  if (message.includes("Password should be"))
    return "비밀번호는 6자 이상이어야 합니다.";
  if (message.includes("Email address") && message.includes("invalid"))
    return "이메일 형식이 올바르지 않습니다.";
  return message;
}

// 로그인
document.getElementById("login-form").addEventListener("submit", async function (e) {
  e.preventDefault();
  const { email, password } = 입력값();
  안내("로그인 중…");

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { 오류(한국어오류(error.message)); return; }

  location.href = "index.html";
});

// 회원가입
document.getElementById("signup-btn").addEventListener("click", async function () {
  const { email, password } = 입력값();
  if (!email || password.length < 6) {
    오류("이메일을 넣고 비밀번호를 6자 이상으로 입력해 주세요.");
    return;
  }
  안내("가입 중…");

  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) { 오류(한국어오류(error.message)); return; }

  // 이메일 확인이 켜져 있으면 session 이 비어 있습니다
  if (!data.session) {
    안내("가입은 됐습니다. 메일함에서 확인 링크를 누른 뒤 로그인해 주세요.");
    return;
  }
  location.href = "index.html";
});

// 이미 로그인돼 있으면 바로 메인으로
(async function () {
  const user = await 지금사용자();
  if (user) location.href = "index.html";
})();
