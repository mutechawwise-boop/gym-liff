export async function pushLineMessage(lineUserId, message) {
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!channelAccessToken) {
        throw new Error("LINE_CHANNEL_ACCESS_TOKEN is missing");
    }

    const response = await fetch(
        "https://api.line.me/v2/bot/message/push",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${channelAccessToken}`
            },
            body: JSON.stringify({
                to: lineUserId,
                messages: [
                    {
                        type: "text",
                        text: message
                    }
                ]
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
    }

    return true;
}
export async function pushMemberCard(
  lineUserId,
  member,
  title = "ข้อมูลสมาชิก"
) {
  const channelAccessToken =
    process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!channelAccessToken) {
    throw new Error(
      "LINE_CHANNEL_ACCESS_TOKEN is missing"
    );
  }

  if (!lineUserId) {
    throw new Error(
      "LINE user ID is missing"
    );
  }

  const displayName =
    member.display_name ||
    member.nickname ||
    "สมาชิก";

  const memberCode =
    member.memberCode ||
    member.member_code ||
    `GJ-${String(member.id).padStart(4, "0")}`;

  const membershipPlan =
    String(member.membership_plan || "");

const planLabels = {
  adult_monthly: "Adult Monthly",
  kids_monthly: "Kids Monthly",
  class_pass_4: "Class Pass 4 ครั้ง",
  class_pass_8: "Class Pass 8 ครั้ง",
  class_pass_12: "Class Pass 12 ครั้ง"
};

const planText =
  planLabels[membershipPlan] ||
  membershipPlan ||
  "-";

  const isClassPass =
    membershipPlan.startsWith("class_pass_");

  const remaining =
    member.remaining_sessions ?? 0;

  const total =
    member.total_sessions ?? 0;

  const startDate =
    member.membership_start_date || "-";

  const expiryDate =
    member.membership_expiry_date || "-";

  const bodyContents = [
    {
      type: "text",
      text: title,
      weight: "bold",
      size: "lg",
      color: "#111111"
    },
    {
      type: "text",
      text: displayName,
      weight: "bold",
      size: "xl",
      margin: "md"
    },
    {
      type: "separator",
      margin: "lg"
    },
    {
      type: "box",
      layout: "vertical",
      margin: "lg",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text: `รหัสสมาชิก  ${memberCode}`,
          size: "sm",
          color: "#555555"
        },
        {
          type: "text",
          text: `แพ็กเกจ  ${planText}`,
          size: "sm",
          color: "#555555",
          wrap: true
        },
        {
          type: "text",
          text: `เริ่มสมาชิก  ${startDate}`,
          size: "sm",
          color: "#555555"
        },
        {
          type: "text",
          text: `หมดอายุ  ${expiryDate}`,
          size: "sm",
          color: "#555555"
        }
      ]
    }
  ];

  if (isClassPass) {
    bodyContents.push(
      {
        type: "separator",
        margin: "lg"
      },
      {
        type: "box",
        layout: "horizontal",
        margin: "lg",
        contents: [
          {
            type: "text",
            text: "Class Pass",
            weight: "bold",
            size: "md",
            flex: 1
          },
          {
            type: "text",
            text: `${remaining} / ${total}`,
            weight: "bold",
            size: "xl",
            color: "#ED1C24",
            align: "end",
            flex: 1
          }
        ]
      }
    );
  }

  const response = await fetch(
    "https://api.line.me/v2/bot/message/push",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          `Bearer ${channelAccessToken}`
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [
          {
            type: "flex",
            altText:
              `${title} - GAMBIT JIUJITSU`,
            contents: {
              type: "bubble",
              body: {
                type: "box",
                layout: "vertical",
                contents: bodyContents
              }
            }
          }
        ]
      })
    }
  );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `LINE push failed: ${errorText}`
    );
  }

  return true;
}