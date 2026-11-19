export function isOwner(state) {
    return state.role === "owner";
}

export function isCoach(state) {
    return state.role === "coach";
}

export function setRole(state, role) {
    state.role = role;
    sessionStorage.setItem("gambitRole", role);
}

export function restoreRole(state) {
    const role = sessionStorage.getItem("gambitRole");

    if (role) {
        state.role = role;
    }
}

export function logoutRole() {
    sessionStorage.removeItem("gambitRole");
}