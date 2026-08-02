export function createAuth({
  elements,
  state,
  loadAdminDashboard,
  loadOverview
}) {
  async function login() {
    const value = elements.adminKeyInput.value.trim();

    if (!value) {
      elements.loginError.textContent = "กรุณากรอกรหัส Admin";
      return;
    }

    state.adminKey = value;
    elements.loginButton.disabled = true;
    elements.loginButton.textContent = "กำลังตรวจสอบ...";
    elements.loginError.textContent = "";

    try {
      sessionStorage.setItem("gambitAdminKey", state.adminKey);

      await loadAdminDashboard();
      await loadOverview();
    } catch (error) {
      sessionStorage.removeItem("gambitAdminKey");
      state.adminKey = "";
      elements.loginError.textContent =
        error instanceof Error ? error.message : "เข้าสู่ระบบไม่สำเร็จ";
    } finally {
      elements.loginButton.disabled = false;
      elements.loginButton.textContent = "เข้าสู่ระบบ";
    }
  }

  function logout() {
    sessionStorage.removeItem("gambitAdminKey");
    sessionStorage.removeItem("gambitRole");

    state.adminKey = "";
    state.role = "";
    state.overview = null;

    elements.adminKeyInput.value = "";
    elements.adminArea.style.display = "none";
    elements.loginArea.style.display = "block";
  }

  function restoreSession() {
    const savedAdminKey = sessionStorage.getItem("gambitAdminKey");
    const savedRole = sessionStorage.getItem("gambitRole");

    if (!savedAdminKey) return false;

    state.adminKey = savedAdminKey;
    state.role = savedRole || "";

    return true;
  }

  return {
    login,
    logout,
    restoreSession
  };
}