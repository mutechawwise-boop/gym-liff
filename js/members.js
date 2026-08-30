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
let beltLevels = [];
let paymentHistory = [];
let beltHistory = [];


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
      beltLevels =
  Array.isArray(data.beltLevels)
    ? data.beltLevels
    : [];
    paymentHistory =
  Array.isArray(data.paymentHistory)
    ? data.paymentHistory
    : [];

beltHistory =
  Array.isArray(data.beltHistory)
    ? data.beltHistory
    : [];


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
const memberDetailModal =
  document.getElementById(
    "memberDetailModal"
  );

const memberDetailName =
  document.getElementById(
    "memberDetailName"
  );

const memberDetailCode =
  document.getElementById(
    "memberDetailCode"
  );

const closeMemberDetailButton =
  document.getElementById(
    "closeMemberDetailButton"
  );

const detailNickname =
  document.getElementById(
    "detailNickname"
  );

const detailStatus =
  document.getElementById(
    "detailStatus"
  );

const detailGroup =
  document.getElementById(
    "detailGroup"
  );

const detailPlan =
  document.getElementById(
    "detailPlan"
  );

const detailStartDate =
  document.getElementById(
    "detailStartDate"
  );

const detailExpiryDate =
  document.getElementById(
    "detailExpiryDate"
  );

const detailSessionFields =
  document.getElementById(
    "detailSessionFields"
  );

const detailRemainingSessions =
  document.getElementById(
    "detailRemainingSessions"
  );

const detailSessionHelp =
  document.getElementById(
    "detailSessionHelp"
  );

const detailBeltName =
  document.getElementById(
    "detailBeltName"
  );

const detailStripeCount =
  document.getElementById(
    "detailStripeCount"
  );

const detailBeltAwardedDate =
  document.getElementById(
    "detailBeltAwardedDate"
  );

const ownerMemberActions =
  document.getElementById(
    "ownerMemberActions"
  );

const editMemberButton =
  document.getElementById(
    "editMemberButton"
  );

const saveMemberButton =
  document.getElementById(
    "saveMemberButton"
  );

const cancelMemberEditButton =
  document.getElementById(
    "cancelMemberEditButton"
  );

const memberDetailMessage =
  document.getElementById(
    "memberDetailMessage"
  );


let selectedMemberId = null;
let memberEditMode = false;


function setMemberFormDisabled(disabled) {

  detailNickname.disabled =
    disabled;

  detailStatus.disabled =
    disabled;

  detailGroup.disabled =
    disabled;

  detailPlan.disabled =
    disabled;

  detailStartDate.disabled =
    disabled;

  detailExpiryDate.disabled =
    disabled;

  detailRemainingSessions.disabled =
    disabled;
}


function updateDetailSessionFields() {

  const plan =
    detailPlan.value;

  const isSessionBased =
    plan === "drop_in" ||
    plan.startsWith(
      "class_pass_"
    );

  if (!isSessionBased) {

    detailSessionFields.style.display =
      "none";

    return;
  }


  detailSessionFields.style.display =
    "flex";


  if (plan === "drop_in") {

    detailSessionHelp.textContent =
      "Drop-in มีสิทธิ์ทั้งหมด 1 ครั้ง";

    detailRemainingSessions.max =
      "1";

  } else {

    const match =
      plan.match(
        /^class_pass_(\d+)$/
      );

    const total =
      match
        ? Number(match[1])
        : 0;

    detailSessionHelp.textContent =
      `สิทธิ์ทั้งหมด ${total} ครั้ง`;

    detailRemainingSessions.max =
      String(total);
  }
}


function openMemberDetail(member) {

  selectedMemberId =
    Number(member.id);

  memberEditMode =
    false;


  memberDetailName.textContent =
    member.nickname ||
    member.display_name ||
    "สมาชิก";

  memberDetailCode.textContent =
    getMemberCode(member);


  detailNickname.value =
    member.nickname || "";

  detailStatus.value =
    member.member_status ||
    "inactive";

  detailGroup.value =
    member.member_group ||
    "adult";

  detailPlan.value =
    member.membership_plan ||
    "adult_monthly";

  detailStartDate.value =
    member.membership_start_date ||
    "";

  detailExpiryDate.value =
    member.membership_expiry_date ||
    "";

  detailRemainingSessions.value =
    member.remaining_sessions ?? 0;


  updateDetailSessionFields();


  const belt =
    member.current_belt;


  detailBeltName.textContent =
    belt?.belt_name ||
    belt?.belt_code ||
    "-";


  detailStripeCount.textContent =
    belt
      ? `${Number(
          belt.stripe_count || 0
        )} ขีด`
      : "-";


  detailBeltAwardedDate.textContent =
    belt?.awarded_date
      ? formatThaiDate(
          belt.awarded_date
        )
      : "-";


  const role =
    sessionStorage.getItem(
      "gambitRole"
    );


  ownerMemberActions.style.display =
    role === "owner"
      ? "flex"
      : "none";


  editMemberButton.style.display =
    "inline-block";

  saveMemberButton.style.display =
    "none";

  cancelMemberEditButton.style.display =
    "none";


  setMemberFormDisabled(true);

  memberDetailMessage.textContent =
    "";
renderPaymentHistory(member.id);
renderBeltHistory(member.id);
prepareBeltEditor(member);
  memberDetailModal.classList.add(
    "open"
  );
}


function closeMemberDetail() {

  memberDetailModal.classList.remove(
    "open"
  );

  selectedMemberId =
    null;

  memberEditMode =
    false;

  memberDetailMessage.textContent =
    "";
}


function startMemberEdit() {

  memberEditMode =
    true;

  setMemberFormDisabled(false);

  editMemberButton.style.display =
    "none";

  saveMemberButton.style.display =
    "inline-block";

  cancelMemberEditButton.style.display =
    "inline-block";

  updateDetailSessionFields();
}


function cancelMemberEdit() {

  const member =
    members.find(
      (item) =>
        Number(item.id) ===
        selectedMemberId
    );

  if (!member) {
    closeMemberDetail();
    return;
  }

  openMemberDetail(member);
}


async function saveMemberEdit() {

  const adminKey =
    sessionStorage.getItem(
      "gambitAdminKey"
    );

  const role =
    sessionStorage.getItem(
      "gambitRole"
    );

  if (
    role !== "owner" ||
    !adminKey
  ) {
    memberDetailMessage.textContent =
      "ไม่มีสิทธิ์แก้ไขข้อมูลสมาชิก";

    return;
  }


  const plan =
    detailPlan.value;

  const isSessionBased =
    plan === "drop_in" ||
    plan.startsWith(
      "class_pass_"
    );


  saveMemberButton.disabled =
    true;

  saveMemberButton.textContent =
    "กำลังบันทึก...";

  memberDetailMessage.textContent =
    "";


  try {

    const response =
      await fetch(
        "/api/update-enrollment",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-admin-key":
              adminKey
          },

          body: JSON.stringify({
            mode:
              "update_member",

            memberId:
              selectedMemberId,

            nickname:
              detailNickname.value.trim(),

            memberStatus:
              detailStatus.value,

            memberGroup:
              detailGroup.value,

            membershipPlan:
              plan,

            membershipStartDate:
              detailStartDate.value,

            membershipExpiryDate:
              detailExpiryDate.value,

            remainingSessions:
              isSessionBased
                ? Number(
                    detailRemainingSessions.value
                  )
                : null
          })
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
        data.details ||
        "แก้ไขข้อมูลสมาชิกไม่สำเร็จ"
      );
    }


    memberDetailMessage.textContent =
      "บันทึกข้อมูลเรียบร้อยแล้ว";


    await loadMembers();


    const updatedMember =
      members.find(
        (item) =>
          Number(item.id) ===
          selectedMemberId
      );


    if (updatedMember) {
      openMemberDetail(
        updatedMember
      );
    }

  } catch (error) {

    memberDetailMessage.textContent =
      error instanceof Error
        ? error.message
        : "แก้ไขข้อมูลสมาชิกไม่สำเร็จ";

  } finally {

    saveMemberButton.disabled =
      false;

    saveMemberButton.textContent =
      "บันทึก";
  }
}
membersTableBody.addEventListener(
  "click",
  (event) => {

    const row =
      event.target.closest(
        "tr[data-member-id]"
      );

    if (!row) {
      return;
    }


    const memberId =
      Number(
        row.dataset.memberId
      );


    const member =
      members.find(
        (item) =>
          Number(item.id) ===
          memberId
      );


    if (!member) {
      return;
    }


    openMemberDetail(member);
  }
);


closeMemberDetailButton.addEventListener(
  "click",
  closeMemberDetail
);


memberDetailModal.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      memberDetailModal
    ) {
      closeMemberDetail();
    }
  }
);


editMemberButton.addEventListener(
  "click",
  startMemberEdit
);


cancelMemberEditButton.addEventListener(
  "click",
  cancelMemberEdit
);


saveMemberButton.addEventListener(
  "click",
  saveMemberEdit
);


detailPlan.addEventListener(
  "change",
  updateDetailSessionFields
);
const ownerBeltEditArea =
  document.getElementById(
    "ownerBeltEditArea"
  );

const editBeltButton =
  document.getElementById(
    "editBeltButton"
  );

const beltEditForm =
  document.getElementById(
    "beltEditForm"
  );

const detailBeltLevel =
  document.getElementById(
    "detailBeltLevel"
  );

const detailBeltStripe =
  document.getElementById(
    "detailBeltStripe"
  );

const detailBeltDate =
  document.getElementById(
    "detailBeltDate"
  );

const detailBeltBy =
  document.getElementById(
    "detailBeltBy"
  );

const detailBeltNote =
  document.getElementById(
    "detailBeltNote"
  );

const saveBeltDetailButton =
  document.getElementById(
    "saveBeltDetailButton"
  );

const cancelBeltDetailButton =
  document.getElementById(
    "cancelBeltDetailButton"
  );

const beltDetailMessage =
  document.getElementById(
    "beltDetailMessage"
  );

function prepareBeltEditor(member) {

  const role =
    sessionStorage.getItem(
      "gambitRole"
    );

  ownerBeltEditArea.style.display =
    role === "owner"
      ? "block"
      : "none";

  beltEditForm.style.display =
    "none";

  beltDetailMessage.textContent =
    "";

  detailBeltLevel.innerHTML =
    `<option value="">-- เลือกระดับสาย --</option>` +
    beltLevels
      .map(
        (belt) => `
          <option value="${belt.id}">
            ${belt.name_th}
          </option>
        `
      )
      .join("");


  const currentBelt =
    member.current_belt;


  if (currentBelt) {

    detailBeltLevel.value =
      String(
        currentBelt.belt_level_id || ""
      );

    detailBeltStripe.value =
      String(
        currentBelt.stripe_count ?? 0
      );

    detailBeltDate.value =
      currentBelt.awarded_date || "";

  } else {

    detailBeltLevel.value = "";
    detailBeltStripe.value = "0";
    detailBeltDate.value = "";
  }


  detailBeltBy.value =
    "Owner";

  detailBeltNote.value =
    "";
}
editBeltButton.addEventListener(
  "click",
  () => {
    beltEditForm.style.display =
      "block";

    beltDetailMessage.textContent =
      "";
  }
);


cancelBeltDetailButton.addEventListener(
  "click",
  () => {
    const member =
      members.find(
        (item) =>
          Number(item.id) ===
          selectedMemberId
      );

    if (!member) {
      return;
    }

    prepareBeltEditor(member);
  }
);


saveBeltDetailButton.addEventListener(
  "click",
  async () => {

    const adminKey =
      sessionStorage.getItem(
        "gambitAdminKey"
      );

    const role =
      sessionStorage.getItem(
        "gambitRole"
      );


    if (
      role !== "owner" ||
      !adminKey
    ) {
      beltDetailMessage.textContent =
        "ไม่มีสิทธิ์แก้ไขระดับสาย";

      return;
    }


    const beltLevelId =
      Number(
        detailBeltLevel.value
      );

    const stripeCount =
      Number(
        detailBeltStripe.value
      );

    const awardedDate =
      detailBeltDate.value;


    if (!beltLevelId) {
      beltDetailMessage.textContent =
        "กรุณาเลือกระดับสาย";

      return;
    }


    if (!awardedDate) {
      beltDetailMessage.textContent =
        "กรุณาระบุวันที่ได้รับสาย";

      return;
    }


    saveBeltDetailButton.disabled =
      true;

    saveBeltDetailButton.textContent =
      "กำลังบันทึก...";

    beltDetailMessage.textContent =
      "";


    try {

      const response =
        await fetch(
          "/api/update-belt",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "x-admin-key":
                adminKey
            },

            body: JSON.stringify({
              memberId:
                selectedMemberId,

              beltLevelId,

              stripeCount,

              awardedDate,

              awardedBy:
                detailBeltBy.value.trim() ||
                "Owner",

              note:
                detailBeltNote.value.trim()
            })
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
          data.details ||
          "บันทึกระดับสายไม่สำเร็จ"
        );
      }


      beltDetailMessage.textContent =
        "บันทึกระดับสายเรียบร้อยแล้ว";


      await loadMembers();


      const updatedMember =
        members.find(
          (item) =>
            Number(item.id) ===
            selectedMemberId
        );


      if (updatedMember) {
        openMemberDetail(
          updatedMember
        );
      }

    } catch (error) {

      beltDetailMessage.textContent =
        error instanceof Error
          ? error.message
          : "บันทึกระดับสายไม่สำเร็จ";

    } finally {

      saveBeltDetailButton.disabled =
        false;

      saveBeltDetailButton.textContent =
        "บันทึกระดับสาย";
    }
  }
);
const memberPaymentHistory =
  document.getElementById(
    "memberPaymentHistory"
  );

const memberBeltHistory =
  document.getElementById(
    "memberBeltHistory"
  );


function formatDateTime(value) {

  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "th-TH",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Bangkok"
    }
  ).format(
    new Date(value)
  );
}


function renderPaymentHistory(memberId) {

  const rows =
    paymentHistory.filter(
      (item) =>
        Number(item.memberId) ===
        Number(memberId)
    );


  if (!rows.length) {

    memberPaymentHistory.innerHTML =
      `<p style="color:#777;">ยังไม่มีประวัติต่ออายุ</p>`;

    return;
  }


  memberPaymentHistory.innerHTML =
    rows
      .map((item) => {

        const paymentMethod =
          item.paymentMethod === "cash"
            ? "เงินสด"
            : item.paymentMethod === "transfer"
              ? "เงินโอน"
              : "-";

        return `
          <div
            style="
              padding:12px 0;
              border-bottom:1px solid #eeeeee;
            "
          >
            <strong>
              ${formatPlan(item.membershipPlan)}
            </strong>

            <div style="margin-top:5px; font-size:13px;">
  ${
    item.type === "registration"
      ? "สมัครสมาชิกครั้งแรก"
      : "ต่ออายุสมาชิก"
  }
</div>

            <div style="margin-top:5px; font-size:13px; color:#666;">
              ${Number(item.amount || 0).toLocaleString("th-TH")} บาท
              · ${paymentMethod}
            </div>

            <div style="margin-top:5px; font-size:12px; color:#888;">
              ${formatDateTime(item.approvedAt)}
            </div>
          </div>
        `;
      })
      .join("");
}


function renderBeltHistory(memberId) {

  const rows =
    beltHistory.filter(
      (item) =>
        Number(item.member_id) ===
        Number(memberId)
    );


  if (!rows.length) {

    memberBeltHistory.innerHTML =
      `<p style="color:#777;">ยังไม่มีประวัติระดับสาย</p>`;

    return;
  }


  memberBeltHistory.innerHTML =
    rows
      .map((item) => {

        const belt =
          item.belt_levels || {};

        const beltName =
          belt.name_th ||
          belt.code ||
          "ไม่ระบุสาย";

        const stripeCount =
          Number(
            item.stripe_count || 0
          );

        return `
          <div
            style="
              padding:12px 0;
              border-bottom:1px solid #eeeeee;
            "
          >
            <strong>
              ${beltName}
            </strong>

            <div style="margin-top:5px; font-size:13px;">
              Rank Bar ${stripeCount} ขีด
            </div>

            <div style="margin-top:5px; font-size:12px; color:#888;">
              ได้รับเมื่อ ${formatThaiDate(item.awarded_date)}
            </div>

            ${
              item.awarded_by
                ? `
                  <div style="margin-top:4px; font-size:12px; color:#888;">
                    โดย ${item.awarded_by}
                  </div>
                `
                : ""
            }

            ${
              item.note
                ? `
                  <div style="margin-top:4px; font-size:12px; color:#666;">
                    ${item.note}
                  </div>
                `
                : ""
            }
          </div>
        `;
      })
      .join("");
}
loadMembers();