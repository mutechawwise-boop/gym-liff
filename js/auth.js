
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
    elements.loginError.textContent = "";
    const button = document.getElementById("coachLoginButton");
    if (button) button.disabled = true;
    try {
      if (!window.liff) throw new Error("ไม่สามารถโหลด LINE LIFF ได้");
      await window.liff.init({liffId:"2010879060-pNUb1Njk"});
      if (!window.liff.isLoggedIn()) { window.liff.login({redirectUri:window.location.href}); return; }
      const idToken = window.liff.getIDToken();
      if (!idToken) throw new Error("ไม่พบ LINE ID Token กรุณาเข้าสู่ระบบ LINE อีกครั้ง");
      const response = await fetch("/api/admin-dashboard?mode=coach-access", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"request",idToken})
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "ตรวจสอบ Coach ไม่สำเร็จ");
      if (data.state !== "active") {
        elements.loginError.textContent = "ส่งคำขอแล้ว กรุณารอ Owner อนุมัติ หรือสอบถาม Owner หากเคยได้รับสิทธิ์";
        return;
      }
      sessionStorage.removeItem("gambitAdminKey");
      sessionStorage.setItem("gambitCoachLineToken",idToken);
      state.adminKey = "";
      setRole(state,"coach");
      await loadAdminDashboard();
      await loadOverview();
      onAuthenticated?.();
    } catch(error) {
      elements.loginError.textContent = error.message || "LINE Login ไม่สำเร็จ";
    } finally { if (button) button.disabled = false; }
  }

  function logout() {
    sessionStorage.removeItem("gambitAdminKey");
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
      const token = sessionStorage.getItem("gambitCoachLineToken");
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
    logout,
    restoreSession
  };
}
