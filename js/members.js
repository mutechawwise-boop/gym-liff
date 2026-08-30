const membersStatus =
  document.getElementById("membersStatus");

const membersTableWrap =
  document.getElementById("membersTableWrap");

const membersTableBody =
  document.getElementById("membersTableBody");

const memberSearch =
  document.getElementById("memberSearch");

const statusFilter =
  document.getElementById("statusFilter");

const groupFilter =
  document.getElementById("groupFilter");

const summaryTotal =
  document.getElementById("summaryTotal");

const summaryActive =
  document.getElementById("summaryActive");

const summaryInactive =
  document.getElementById("summaryInactive");

const summaryExpiring =
  document.getElementById("summaryExpiring");

const backButton =
  document.getElementById("backButton");


let members = [];
let today = "";


function formatThaiDate(dateValue) {
  if (!dateValue) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "th-TH",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Bangkok"
    }
  ).format(
    new Date(`${dateValue}T00:00:00`)
  );
}


function formatPlan(plan) {
  const labels = {
    drop_in: "Drop-in 1 ครั้ง",
    adult_monthly: "Adult Monthly",
    kids_monthly: "Kids Monthly",
    class_pass_4: "Class Pass 4 ครั้ง",
    class_pass_8: "Class Pass 8 ครั้ง",
    class_pass_12: "Class Pass 12 ครั้ง",
    private: "Private"
  };

  return labels[plan] || plan || "-";
}


function getMemberCode(member) {
  return `GJ-${String(member.id).padStart(4, "0")}`;
}


function getBeltText(member) {
  const belt =
    member.current_belt;

  if (!belt) {
    return "-";
  }

  return (
    belt.belt_name ||
    belt.belt_code ||
    "-"
  );
}


function getStripeText(member) {
  const belt =
    member.current_belt;

  if (!belt) {
    return "-";
  }

  const count =
    Math.max(
      0,
      Math.min(
        4,
        Number(belt.stripe_count || 0)
      )
    );

  return Array.from(
    { length: 4 },
    (_, index) =>
      index < count
        ? "♜"
        : "♖"
  ).join(" ");
}


function getSessionText(member) {
  const plan =
    String(
      member.membership_plan || ""
    );

  const isSessionBased =
    plan === "drop_in" ||
    plan.startsWith("class_pass_");

  if (!isSessionBased) {
    return "-";
  }

  const remaining =
    Number(
      member.remaining_sessions ?? 0
    );

  const total =
    Number(
      member.total_sessions ?? 0
    );

  return `${remaining} / ${total}`;
}


function getStatusClass(status) {
  if (status === "active") {
    return "status-active";
  }

  if (status === "suspended") {
    return "status-suspended";
  }

  return "status-inactive";
}


function calculateDaysRemaining(
  expiryDate
) {
  if (!expiryDate || !today) {
    return null;
  }

  const expiry =
    new Date(
      `${expiryDate}T00:00:00Z`
    );

  const current =
    new Date(
      `${today}T00:00:00Z`
    );

  return Math.round(
    (
      expiry.getTime() -
      current.getTime()
    ) /
    (1000 * 60 * 60 * 24)
  );
}


function updateSummary(list) {
  const total =
    list.length;

  const active =
    list.filter(
      (member) =>
        member.member_status ===
        "active"
    ).length;

  const inactive =
    list.filter(
      (member) =>
        member.member_status ===
        "inactive"
    ).length;

  const expiring =
    list.filter((member) => {
      const days =
        calculateDaysRemaining(
          member.membership_expiry_date
        );

      return (
        days !== null &&
        days >= 0 &&
        days <= 7
      );
    }).length;

  summaryTotal.textContent =
    total;

  summaryActive.textContent =
    active;

  summaryInactive.textContent =
    inactive;

  summaryExpiring.textContent =
    expiring;
}


function renderMembers() {
  const searchText =
    memberSearch.value
      .trim()
      .toLowerCase();

  const selectedStatus =
    statusFilter.value;

  const selectedGroup =
    groupFilter.value;

  const filteredMembers =
    members.filter((member) => {

      const searchableText = [
        member.display_name,
        member.nickname,
        getMemberCode(member)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchSearch =
        !searchText ||
        searchableText.includes(
          searchText
        );

      const matchStatus =
        !selectedStatus ||
        member.member_status ===
          selectedStatus;

      const matchGroup =
        !selectedGroup ||
        member.member_group ===
          selectedGroup;

      return (
        matchSearch &&
        matchStatus &&
        matchGroup
      );
    });


  updateSummary(filteredMembers);

  if (!filteredMembers.length) {
    membersTableWrap.style.display =
      "none";

    membersStatus.style.display =
      "block";

    membersStatus.className =
      "empty";

    membersStatus.textContent =
      "ไม่พบสมาชิก";

    return;
  }


  membersStatus.style.display =
    "none";

  membersTableWrap.style.display =
    "block";


  membersTableBody.innerHTML =
    filteredMembers
      .map((member) => {

        const status =
          String(
            member.member_status ||
            "inactive"
          );

        return `
          <tr
            data-member-id="${member.id}"
          >

            <td>
              <div class="member-name">
                ${
                  member.nickname ||
                  member.display_name ||
                  "สมาชิก"
                }
              </div>

              <div class="member-code">
                ${getMemberCode(member)}
              </div>
            </td>

            <td>
              <span
                class="status-badge ${getStatusClass(status)}"
              >
                ${status.toUpperCase()}
              </span>
            </td>

            <td>
              ${
                member.member_group
                  ? String(
                      member.member_group
                    ).toUpperCase()
                  : "-"
              }
            </td>

            <td class="belt">
              ${getBeltText(member)}
            </td>

            <td class="stripe">
              ${getStripeText(member)}
            </td>

            <td>
              ${
                formatPlan(
                  member.membership_plan
                )
              }
            </td>

            <td>
              ${getSessionText(member)}
            </td>

            <td>
              ${
                formatThaiDate(
                  member.membership_expiry_date
                )
              }
            </td>

          </tr>
        `;
      })
      .join("");
}


async function loadMembers() {

  const adminKey =
  sessionStorage.getItem(
    "gambitAdminKey"
  );

const role =
  sessionStorage.getItem(
    "gambitRole"
  );

if (
  !adminKey ||
  !["owner", "coach"].includes(role)
) {
  window.location.href =
    "admin.html";

  return;
}


  membersStatus.className =
    "loading";

  membersStatus.textContent =
    "กำลังโหลดข้อมูลสมาชิก...";


  try {

    const response =
      await fetch(
        "/api/admin-dashboard",
        {
          headers: {
            "x-admin-key":
              adminKey
          }
        }
      );


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.error ||
        "โหลดข้อมูลสมาชิกไม่สำเร็จ"
      );
    }


    members =
      Array.isArray(data.members)
        ? data.members
        : [];

    today =
      data.today || "";


    renderMembers();

  } catch (error) {

    console.error(error);

    membersTableWrap.style.display =
      "none";

    membersStatus.style.display =
      "block";

    membersStatus.className =
      "error";

    membersStatus.textContent =
      error instanceof Error
        ? error.message
        : "โหลดข้อมูลสมาชิกไม่สำเร็จ";
  }
}


memberSearch.addEventListener(
  "input",
  renderMembers
);

statusFilter.addEventListener(
  "change",
  renderMembers
);

groupFilter.addEventListener(
  "change",
  renderMembers
);


backButton.addEventListener(
  "click",
  () => {

    const role =
      sessionStorage.getItem(
        "gambitRole"
      );

    if (role === "owner") {
      window.location.href =
        "owner.html";
    } else {
      window.location.href =
        "admin.html";
    }
  }
);

loadMembers();