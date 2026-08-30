export default {

  async fetch(request) {

    const json = (data, status = 200) =>
      new Response(
        JSON.stringify(data),
        {
          status,
          headers: {
            "Content-Type":
              "application/json; charset=utf-8",

            "Cache-Control":
              "no-store"
          }
        }
      );


    if (request.method !== "POST") {

      return json(
        {
          error:
            "Method not allowed"
        },
        405
      );
    }


    try {

      // =========================
      // COACH ONLY
      // =========================

      const adminKey =
        request.headers.get(
          "x-admin-key"
        );


      if (
        !process.env.ADMIN_KEY ||
        adminKey !==
          process.env.ADMIN_KEY
      ) {

        return json(
          {
            error:
              "ไม่มีสิทธิ์จัดการคลาส"
          },
          401
        );
      }


      const supabaseUrl =
        process.env.SUPABASE_URL;

      const secretKey =
        process.env.SUPABASE_SECRET_KEY;


      if (
        !supabaseUrl ||
        !secretKey
      ) {

        return json(
          {
            error:
              "ตั้งค่า Supabase ไม่ครบ"
          },
          500
        );
      }


      const headers = {

        apikey:
          secretKey,

        Authorization:
          `Bearer ${secretKey}`,

        "Content-Type":
          "application/json",

        Accept:
          "application/json"
      };


      const body =
        await request.json();


      const mode =
        String(
          body.mode ||
          "create_session"
        ).trim();


      // =========================
      // วันที่วันนี้ Bangkok
      // =========================

      const today =
        new Intl.DateTimeFormat(
          "en-CA",
          {
            timeZone:
              "Asia/Bangkok",

            year:
              "numeric",

            month:
              "2-digit",

            day:
              "2-digit"
          }
        ).format(
          new Date()
        );


      // =====================================
      // CREATE SESSION
      // เพิ่มคลาส / Private / คลาสพิเศษ
      // =====================================

      if (
        mode === "create_session"
      ) {

        const classId =
          Number(
            body.classId
          );


        const sessionDate =
          String(
            body.sessionDate ||
            today
          ).trim();


        const startTime =
          String(
            body.startTime || ""
          ).trim();


        const endTime =
          String(
            body.endTime || ""
          ).trim();


        const note =
          String(
            body.note || ""
          ).trim();


        if (
          !Number.isInteger(
            classId
          ) ||
          classId <= 0
        ) {

          return json(
            {
              error:
                "กรุณาเลือกประเภทคลาส"
            },
            400
          );
        }


        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(
            sessionDate
          )
        ) {

          return json(
            {
              error:
                "วันที่คลาสไม่ถูกต้อง"
            },
            400
          );
        }


        if (
          !/^\d{2}:\d{2}$/.test(
            startTime
          )
        ) {

          return json(
            {
              error:
                "เวลาเริ่มไม่ถูกต้อง"
            },
            400
          );
        }


        if (
          !/^\d{2}:\d{2}$/.test(
            endTime
          )
        ) {

          return json(
            {
              error:
                "เวลาสิ้นสุดไม่ถูกต้อง"
            },
            400
          );
        }


        if (
          endTime <= startTime
        ) {

          return json(
            {
              error:
                "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม"
            },
            400
          );
        }


        // กันสร้างคลาสซ้ำ

        const existingResponse =
          await fetch(

            `${supabaseUrl}/rest/v1/class_sessions` +

            `?class_id=eq.${classId}` +

            `&session_date=eq.${sessionDate}` +

            `&start_time=eq.${startTime}` +

            `&select=id,status` +

            `&limit=1`,

            {
              headers
            }
          );


        if (
          !existingResponse.ok
        ) {

          const details =
            await existingResponse.text();


          return json(
            {
              error:
                "ตรวจสอบคลาสเดิมไม่สำเร็จ",

              details
            },
            500
          );
        }


        const existingSessions =
          await existingResponse.json();


        if (
          existingSessions.length >
          0
        ) {

          return json(
            {
              error:
                "มีคลาสนี้ในวันและเวลาดังกล่าวแล้ว"
            },
            409
          );
        }


        const insertResponse =
          await fetch(

            `${supabaseUrl}/rest/v1/class_sessions`,

            {
              method:
                "POST",

              headers: {
                ...headers,

                Prefer:
                  "return=representation"
              },

              body:
                JSON.stringify({

                  class_id:
                    classId,

                  session_date:
                    sessionDate,

                  start_time:
                    startTime,

                  end_time:
                    endTime,

                  status:
                    "open",

                  note:
                    note || null

                })
            }
          );


        if (
          !insertResponse.ok
        ) {

          const details =
            await insertResponse.text();


          return json(
            {
              error:
                "เพิ่มคลาสไม่สำเร็จ",

              details
            },
            500
          );
        }


        const rows =
          await insertResponse.json();


        return json({

          success:
            true,

          message:
            "เพิ่มคลาสเรียบร้อยแล้ว",

          session:
            rows[0] || null
        });
      }


      // =====================================
      // UPDATE SESSION
      // Coach แก้วัน / เวลา / ประเภทคลาส
      // =====================================

      if (
        mode === "update_session"
      ) {

        const sessionId =
          Number(
            body.sessionId
          );


        const classId =
          Number(
            body.classId
          );


        const sessionDate =
          String(
            body.sessionDate || ""
          ).trim();


        const startTime =
          String(
            body.startTime || ""
          ).trim();


        const endTime =
          String(
            body.endTime || ""
          ).trim();


        const note =
          String(
            body.note || ""
          ).trim();


        if (
          !Number.isInteger(
            sessionId
          ) ||
          sessionId <= 0
        ) {

          return json(
            {
              error:
                "Session ID ไม่ถูกต้อง"
            },
            400
          );
        }


        if (
          !Number.isInteger(
            classId
          ) ||
          classId <= 0
        ) {

          return json(
            {
              error:
                "กรุณาเลือกประเภทคลาส"
            },
            400
          );
        }


        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(
            sessionDate
          )
        ) {

          return json(
            {
              error:
                "วันที่คลาสไม่ถูกต้อง"
            },
            400
          );
        }


        if (
          !/^\d{2}:\d{2}$/.test(
            startTime
          ) ||
          !/^\d{2}:\d{2}$/.test(
            endTime
          )
        ) {

          return json(
            {
              error:
                "เวลาคลาสไม่ถูกต้อง"
            },
            400
          );
        }


        if (
          endTime <= startTime
        ) {

          return json(
            {
              error:
                "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม"
            },
            400
          );
        }


        // ตรวจว่าชนกับ Session อื่นหรือไม่

        const duplicateResponse =
          await fetch(

            `${supabaseUrl}/rest/v1/class_sessions` +

            `?class_id=eq.${classId}` +

            `&session_date=eq.${sessionDate}` +

            `&start_time=eq.${startTime}` +

            `&id=neq.${sessionId}` +

            `&select=id` +

            `&limit=1`,

            {
              headers
            }
          );


        if (
          !duplicateResponse.ok
        ) {

          const details =
            await duplicateResponse.text();


          return json(
            {
              error:
                "ตรวจสอบคลาสซ้ำไม่สำเร็จ",

              details
            },
            500
          );
        }


        const duplicates =
          await duplicateResponse.json();


        if (
          duplicates.length > 0
        ) {

          return json(
            {
              error:
                "วันและเวลานี้มีคลาสเดียวกันอยู่แล้ว"
            },
            409
          );
        }


        const updateResponse =
          await fetch(

            `${supabaseUrl}/rest/v1/class_sessions` +
            `?id=eq.${sessionId}`,

            {
              method:
                "PATCH",

              headers: {
                ...headers,

                Prefer:
                  "return=representation"
              },

              body:
                JSON.stringify({

                  class_id:
                    classId,

                  session_date:
                    sessionDate,

                  start_time:
                    startTime,

                  end_time:
                    endTime,

                  note:
                    note || null

                })
            }
          );


        if (
          !updateResponse.ok
        ) {

          const details =
            await updateResponse.text();


          return json(
            {
              error:
                "แก้ไขคลาสไม่สำเร็จ",

              details
            },
            500
          );
        }


        const rows =
          await updateResponse.json();


        return json({

          success:
            true,

          message:
            "แก้ไขคลาสเรียบร้อยแล้ว",

          session:
            rows[0] || null
        });
      }


      // =====================================
      // CANCEL SESSION
      // ไม่ลบออก เพื่อเก็บประวัติ
      // =====================================

      if (
        mode === "cancel_session"
      ) {

        const sessionId =
          Number(
            body.sessionId
          );


        const cancelNote =
          String(
            body.note || ""
          ).trim();


        if (
          !Number.isInteger(
            sessionId
          ) ||
          sessionId <= 0
        ) {

          return json(
            {
              error:
                "Session ID ไม่ถูกต้อง"
            },
            400
          );
        }


        const cancelResponse =
          await fetch(

            `${supabaseUrl}/rest/v1/class_sessions` +
            `?id=eq.${sessionId}`,

            {
              method:
                "PATCH",

              headers: {
                ...headers,

                Prefer:
                  "return=representation"
              },

              body:
                JSON.stringify({

                  status:
                    "cancelled",

                  note:
                    cancelNote ||
                    "ยกเลิกโดย Coach"

                })
            }
          );


        if (
          !cancelResponse.ok
        ) {

          const details =
            await cancelResponse.text();


          return json(
            {
              error:
                "ยกเลิกคลาสไม่สำเร็จ",

              details
            },
            500
          );
        }


        const rows =
          await cancelResponse.json();


        return json({

          success:
            true,

          message:
            "ยกเลิกคลาสเรียบร้อยแล้ว",

          session:
            rows[0] || null
        });
      }


      return json(
        {
          error:
            "Mode ไม่ถูกต้อง"
        },
        400
      );


    } catch (error) {

      return json(
        {
          error:
            "ระบบจัดการคลาสเกิดข้อผิดพลาด",

          details:
            error instanceof Error
              ? error.message
              : String(error)
        },
        500
      );
    }
  }
};