
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
        !["owner", "coach"].includes(data.role)
      ) {
        throw new Error(
          data.error || "รหัสไม่ถูกต้อง"
        );
      }

      state.adminKey = value;
      sessionStorage.setItem("gambitAdminKey", value);
      setRole(state, data.role);

      if (data.role === "owner") {
        window.location.href = "owner.html";
        return;
      }

      await loadAdminDashboard();
      await loadOverview();
      onAuthenticated?.();

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

  function logout() {
    sessionStorage.removeItem("gambitAdminKey");
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

    if (!savedAdminKey) return false;

    state.adminKey = savedAdminKey;
    restoreRole(state);

    return true;
  }

  return {
    login,
    logout,
    restoreSession
  };
}
