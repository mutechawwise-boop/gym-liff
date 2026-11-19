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

  const supabaseUrl =
    process.env.SUPABASE_URL;

  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY;

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
    class_pass_12: "Class Pass 12 ครั้ง",
    drop_in: "Drop-in"
  };

  const planText =
    planLabels[membershipPlan] ||
    membershipPlan ||
    "-";

  const isClassPass =
    membershipPlan.startsWith(
      "class_pass_"
    );
const isDropIn =
  membershipPlan === "drop_in";

const isSessionBased =
  isClassPass || isDropIn;
  const remaining =
    member.remaining_sessions ?? 0;

  const total =
    member.total_sessions ?? 0;

  const startDate =
    member.membership_start_date || "-";

  const expiryDate =
    member.membership_expiry_date || "-";

  // =====================================
  // อ่านระดับสายปัจจุบัน
  // =====================================

  let currentBelt = null;

  if (
    member.id &&
    supabaseUrl &&
    supabaseSecretKey
  ) {
    try {
      const beltResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/member_current_belts` +
            `?member_id=eq.${member.id}` +
            `&select=member_id,belt_code,belt_name,color_hex,awarded_date,stripe_count` +
            `&limit=1`,
          {
            headers: {
              apikey: supabaseSecretKey,
              Authorization:
                `Bearer ${supabaseSecretKey}`,
              Accept: "application/json"
            }
          }
        );

      if (beltResponse.ok) {
        const beltRows =
          await beltResponse.json();

        currentBelt =
          beltRows[0] || null;
      }
    } catch (error) {
      console.error(
        "Load member belt failed:",
        error
      );
    }
  }

  // =====================================
  // ข้อมูลสาย
  // =====================================

  const beltCode =
    String(
      currentBelt?.belt_code || ""
    ).toLowerCase();

  const beltNames = {
    white: "สายขาว",
    blue: "สายน้ำเงิน",
    purple: "สายม่วง",
    brown: "สายน้ำตาล",
    black: "สายดำ"
  };

  const beltEnglishNames = {
    white: "WHITE BELT",
    blue: "BLUE BELT",
    purple: "PURPLE BELT",
    brown: "BROWN BELT",
    black: "BLACK BELT"
  };

  const beltColors = {
    white: "#E5E7EB",
    blue: "#2563EB",
    purple: "#7E22CE",
    brown: "#92400E",
    black: "#111111"
  };

  const beltText =
    beltNames[beltCode] ||
    currentBelt?.belt_name ||
    "ยังไม่ระบุสาย";

  const beltEnglish =
    beltEnglishNames[beltCode] || "";

  const beltColor =
    beltColors[beltCode] ||
    currentBelt?.color_hex ||
    "#777777";

  const stripeCount =
    Math.max(
      0,
      Math.min(
        4,
        Number(
          currentBelt?.stripe_count || 0
        )
      )
    );

  const rankIcons =
    Array.from(
      { length: 4 },
      (_, index) =>
        index < stripeCount
          ? "♜"
          : "♖"
    ).join(" ");

  // =====================================
  // วันที่ได้รับสาย
  // =====================================

  let beltAwardedDate = "-";

  if (currentBelt?.awarded_date) {
    try {
      beltAwardedDate =
        new Intl.DateTimeFormat(
          "th-TH",
          {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone:
              "Asia/Bangkok"
          }
        ).format(
          new Date(
            `${currentBelt.awarded_date}T00:00:00+07:00`
          )
        );
    } catch {
      beltAwardedDate =
        currentBelt.awarded_date;
    }
  }

  // =====================================
  // การ์ด
  // =====================================

  const rightContents = [];

  // กล่องระดับสายด้านขวาบน
  rightContents.push({
    type: "box",
    layout: "vertical",
    paddingAll: "12px",
    backgroundColor: "#171717",
    cornerRadius: "12px",
    contents: [
      {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: "♜",
            size: "xxl",
            color: beltColor,
            flex: 0,
            gravity: "center"
          },
          {
            type: "box",
            layout: "vertical",
            flex: 1,
            contents: [
              {
                type: "text",
                text: "ระดับสาย",
                size: "xs",
                color: "#AAAAAA"
              },
              {
                type: "text",
                text: beltText,
                weight: "bold",
                size: "lg",
                color: beltColor
              },
              {
                type: "text",
                text: beltEnglish,
                size: "xs",
                color: "#CCCCCC"
              }
            ]
          }
        ]
      },

      {
        type: "separator",
        margin: "md",
        color: "#444444"
      },

      {
        type: "text",
        text: "RANK BAR",
        size: "xs",
        weight: "bold",
        color: "#CCCCCC",
        margin: "md"
      },

      {
        type: "text",
        text: rankIcons,
        size: "lg",
        weight: "bold",
        color: beltColor,
        margin: "sm"
      },

      {
        type: "separator",
        margin: "md",
        color: "#444444"
      },

      {
        type: "text",
        text:
          `📅 ได้รับสายเมื่อ ${beltAwardedDate}`,
        size: "xs",
        color: "#CCCCCC",
        wrap: true,
        margin: "md"
      }
    ]
  });

  if (isSessionBased) {
    rightContents.push({
      type: "box",
      layout: "vertical",
      margin: "xl",
      contents: [
       {
  type: "text",
  text: isDropIn
    ? "Drop-in"
    : "Class Pass",
  weight: "bold",
  size: "md",
  color: "#FFFFFF",
  align: "center"
},
        {
          type: "text",
          text: `${remaining} / ${total}`,
          weight: "bold",
          size: "xxl",
          color: "#ED1C24",
          align: "center",
          margin: "sm"
        },
        {
          type: "text",
          text:
            remaining <= 0
              ? "ใช้สิทธิ์ครบแล้ว"
              : `คงเหลือ ${remaining} ครั้ง`,
          size: "xs",
          color: "#AAAAAA",
          align: "center",
          margin: "sm"
        }
      ]
    });
  }

  const contents = {
    type: "bubble",
    size: "giga",

    body: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#101010",
      paddingAll: "18px",

      contents: [
        {
          type: "text",
          text: title,
          weight: "bold",
          size: "md",
          color: "#FFFFFF"
        },

        {
          type: "box",
          layout: "horizontal",
          spacing: "xl",
          margin: "lg",

          contents: [
            // =====================
            // ซ้าย
            // =====================
            {
              type: "box",
              layout: "vertical",
              flex: 5,

              contents: [
                {
                  type: "text",
                  text: displayName,
                  weight: "bold",
                  size: "xl",
                  color: "#FFFFFF",
                  wrap: true
                },

                {
                  type: "text",
                  text:
                    member.member_status ===
                    "active"
                      ? "● ACTIVE"
                      : "● INACTIVE",
                  weight: "bold",
                  size: "sm",
                  color:
                    member.member_status ===
                    "active"
                      ? "#00B950"
                      : "#999999",
                  margin: "sm"
                },

                {
                  type: "separator",
                  margin: "lg",
                  color: "#444444"
                },

                {
                  type: "box",
                  layout: "vertical",
                  spacing: "md",
                  margin: "lg",

                  contents: [
                    {
                      type: "text",
                      text:
                        `รหัสสมาชิก  ${memberCode}`,
                      size: "sm",
                      color: "#DDDDDD",
                      wrap: true
                    },

                    {
                      type: "text",
                      text:
                        `กลุ่มสมาชิก  ${
                          String(
                            member.member_group ||
                            "-"
                          ).toUpperCase()
                        }`,
                      size: "sm",
                      color: "#DDDDDD"
                    },

                    {
                      type: "text",
                      text:
                        `วันที่เริ่มต้น  ${startDate}`,
                      size: "sm",
                      color: "#DDDDDD"
                    },

                    {
                      type: "text",
                      text:
                        `วันหมดอายุ  ${expiryDate}`,
                      size: "sm",
                      color: "#DDDDDD"
                    },

                    {
                      type: "text",
                      text:
                        `แพ็กเกจ  ${planText}`,
                      size: "sm",
                      color: "#ED1C24",
                      weight: "bold",
                      wrap: true
                    }
                  ]
                }
              ]
            },

            // =====================
            // ขวา
            // =====================
            {
              type: "box",
              layout: "vertical",
              flex: 5,
              contents: rightContents
            }
          ]
        },

        {
          type: "separator",
          margin: "xl",
          color: "#ED1C24"
        },

        {
          type: "text",
          text: "✦  G A M B I T   J I U J I T S U  ✦",
          size: "xxs",
          color: "#CCCCCC",
          align: "center",
          margin: "md"
        }
      ]
    }
  };

  const response = await fetch(
    "https://api.line.me/v2/bot/message/push",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
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
            contents
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
