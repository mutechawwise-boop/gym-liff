
import { setRole, logoutRole, restoreRole } from "./role.js";

export function createAuth({
  elements,
  state,
  loadAdminDashboard,
  loadOverview,
  onAuthenticated
}) {
  async function login() {
    const value = elements.adminKeyInput.value.trim();

    if (!value) {
      elements.loginError.textContent = "กรุณากรอกรหัส Admin";
      return;
    }

    elements.loginButton.disabled = true;
    elements.loginButton.textContent = "กำลังตรวจสอบ...";
    elements.loginError.textContent = "";

    try {
      const response = await fetch(
        "/api/admin-dashboard?mode=auth",
        {
          method: "GET",
          headers: {
            "x-admin-key": value
          },
          cache: "no-store"
        }
      );

      const data = await response.json();

      if (
        !response.ok ||
        !data.success ||
        data.role !== "owner"
      ) {
        throw new Error(
          data.error || "รหัสไม่ถูกต้อง"
        );
      }

      state.adminKey = value;
      sessionStorage.setItem("gambitAdminKey", value);
      setRole(state, data.role);

      window.location.href = "owner.html";
      return;

    } catch (error) {
      sessionStorage.removeItem("gambitAdminKey");
      logoutRole();

      state.adminKey = "";
      state.role = "";

      elements.loginError.textContent =
        error instanceof Error
          ? error.message
          : "เข้าสู่ระบบไม่สำเร็จ";

    } finally {
      elements.loginButton.disabled = false;
      elements.loginButton.textContent = "เข้าสู่ระบบ";
    }
  }

  async function coachLogin() {
    const username=document.getElementById("coachUsername")?.value.trim();
    const password=document.getElementById("coachPassword")?.value||"";
    const button=document.getElementById("coachLoginButton");button.disabled=true;elements.loginError.textContent="";
    try {
      const response=await fetch("/api/admin-dashboard?mode=coach-access",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"login",username,password})});
      const data=await response.json();if(!response.ok||!data.success)throw new Error(data.error||"เข้าสู่ระบบ Coach ไม่สำเร็จ");
      sessionStorage.removeItem("gambitAdminKey");sessionStorage.setItem("gambitCoachSession",data.session);sessionStorage.setItem("gambitCoachDisplayName",data.displayName||"Coach");state.adminKey="";setRole(state,"coach");
      await loadAdminDashboard();await loadOverview();onAuthenticated?.();
    }catch(error){elements.loginError.textContent=error.message||"เข้าสู่ระบบไม่สำเร็จ";}finally{button.disabled=false;}
  }
  async function coachRegister(){
    const name=document.getElementById("coachRegisterName").value.trim(),username=document.getElementById("coachRegisterUsername").value.trim(),password=document.getElementById("coachRegisterPassword").value;
    const button=document.getElementById("coachRegisterButton");button.disabled=true;elements.loginError.textContent="";
    try{const r=await fetch("/api/admin-dashboard?mode=coach-access",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"register",name,username,password})});const d=await r.json();if(!r.ok||!d.success)throw new Error(d.error||"สมัครไม่สำเร็จ");const area=document.getElementById("loginArea");
      if(area){
        area.replaceChildren();
        const heading=document.createElement("h1");heading.textContent="✓ ส่งคำขอสมัคร Coach สำเร็จ";
        const status=document.createElement("h2");status.textContent="กำลังรอ Owner อนุมัติ";
        const note=document.createElement("p");note.textContent="เมื่อได้รับอนุมัติแล้ว สามารถกลับมาเข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่านที่ตั้งไว้";
        const back=document.createElement("a");back.href="admin.html";back.textContent="กลับไปหน้าเข้าสู่ระบบ";
        area.append(heading,status,note,back);
      }}
    catch(e){elements.loginError.textContent=e.message;}finally{button.disabled=false;}
  }

  function logout() {
    sessionStorage.removeItem("gambitAdminKey");
    sessionStorage.removeItem("gambitCoachSession");
    sessionStorage.removeItem("gambitCoachDisplayName");
    sessionStorage.removeItem("gambitCoachLineToken");
    logoutRole();

    state.adminKey = "";
    state.role = "";
    state.overview = null;

    elements.adminKeyInput.value = "";
    elements.adminArea.style.display = "none";
    elements.loginArea.style.display = "block";
  }

  function restoreSession() {
    const savedAdminKey =
      sessionStorage.getItem("gambitAdminKey");

    if (!savedAdminKey) {
      const token = sessionStorage.getItem("gambitCoachSession");
      if (!token) return false;
      state.adminKey = "";
      setRole(state,"coach");
      return true;
    }

    state.adminKey = savedAdminKey;
    restoreRole(state);

    return true;
  }

  return {
    login,
    coachLogin,
    coachRegister,
    logout,
    restoreSession
  };
}
