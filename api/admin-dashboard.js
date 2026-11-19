import { activeCoach, issueCoachSession, passwordHash, newSalt } from "./lib/coach-auth.js";
import { supabase } from "./lib/supabase.js";

function getBangkokDateString() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function calculateDaysRemaining(expiryDate, todayDate) {
  const expiry = new Date(`${expiryDate}T00:00:00Z`);
  const today = new Date(`${todayDate}T00:00:00Z`);

  return Math.round(
    (expiry.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

// Coach enrollment and Owner management reuse this existing serverless function.
// These helpers never trust a LINE user ID supplied directly by the browser.
async function coachRows(query) { const r=await supabase.request(`gym_coaches?${query}`);if(!r.ok)throw new Error("Coach lookup failed");return r.json(); }
async function credentials(query){const r=await supabase.request(`gym_coach_credentials?${query}`);if(!r.ok)throw new Error("Coach credentials table missing; apply SQL migration");return r.json();}
async function handleCoachAccess(request,json,isOwner){
 let body;try{body=await request.json()}catch{return json({success:false,error:"Invalid JSON"},400)}
 const action=body?.action;
 if(action==="register"){
  const name=String(body.name||"").trim(),username=String(body.username||"").trim().toLowerCase(),password=String(body.password||"");
  if(name.length<2||name.length>100||!/^[a-z0-9_]{4,32}$/.test(username)||password.length<12||password.length>128)return json({success:false,error:"ชื่อ 2-100 ตัวอักษร ชื่อผู้ใช้ 4-32 ตัว (a-z, 0-9, _) และรหัสผ่าน 12-128 ตัว"},400);
  const exists=await credentials(`username=eq.${encodeURIComponent(username)}&select=coach_id&limit=1`);if(exists.length)return json({success:false,error:"ชื่อผู้ใช้นี้ถูกใช้แล้ว"},409);
  const r=await supabase.request("gym_coaches?select=id",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({display_name:name,role:"coach",is_active:false})});if(!r.ok)return json({success:false,error:"สร้างคำขอไม่สำเร็จ"},400);
  const [coach]=await r.json();const salt=newSalt();const hash=await passwordHash(password,salt);
  const cr=await supabase.request("gym_coach_credentials",{method:"POST",body:JSON.stringify({coach_id:coach.id,username,password_salt:salt,password_hash:hash})});if(!cr.ok){await supabase.request(`gym_coaches?id=eq.${coach.id}`,{method:"DELETE"});return json({success:false,error:"บันทึกบัญชีไม่สำเร็จ"},500)}
  return json({success:true,state:"pending"},201);
 }
 if(action==="login"){
  const username=String(body.username||"").trim().toLowerCase(),password=String(body.password||"");if(!username||!password)return json({success:false,error:"กรุณากรอกชื่อผู้ใช้และรหัสผ่าน"},400);
  const rows=await credentials(`username=eq.${encodeURIComponent(username)}&select=coach_id,password_salt,password_hash&limit=1`);
  if(!rows.length)return json({success:false,error:"ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"},401);
  const item=rows[0];const hash=await passwordHash(password,item.password_salt);if(hash.length!==item.password_hash.length||![...hash].every((c,i)=>c===item.password_hash[i]))return json({success:false,error:"ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"},401);
  const coaches=await coachRows(`id=eq.${item.coach_id}&select=id,display_name,is_active&limit=1`);if(!coaches[0]?.is_active)return json({success:false,error:"บัญชียังไม่ได้รับอนุมัติ หรือถูกระงับสิทธิ์"},403);
  return json({success:true,role:"coach",displayName:coaches[0].display_name,session:await issueCoachSession(coaches[0].id)});
 }
 if(!isOwner)return json({success:false,error:"Owner only"},403);
 if(action==="list"){const coaches=await coachRows("select=id,display_name,role,is_active,created_at&order=created_at.desc");return json({success:true,coaches});}
 if(action==="set_active"){const id=Number(body.id);if(!Number.isSafeInteger(id)||id<1||typeof body.isActive!=="boolean")return json({success:false,error:"Invalid input"},400);const r=await supabase.request(`gym_coaches?id=eq.${id}&select=id,is_active`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({is_active:body.isActive,updated_at:new Date().toISOString()})});if(!r.ok)return json({success:false,error:"Cannot update Coach"},500);const rows=await r.json();return json({success:!!rows.length,coach:rows[0]});}
 return json({success:false,error:"Unknown action"},400);
}
async function handleCoachAttendance(request,json,isOwner,coach){
 const url=new URL(request.url);
 const date=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const mode=url.searchParams.get("view");
 if(request.method==="GET" && mode==="classes"){
  if(!coach)return json({success:false,error:"Coach only"},403);
  const r=await supabase.request(`class_sessions?select=id,start_time,end_time,session_date,classes(name)&session_date=eq.${date}&status=eq.open&order=start_time.asc`);
  if(!r.ok)return json({success:false,error:"โหลดตารางเรียนไม่สำเร็จ"},500);
  return json({success:true,classes:await r.json()});
 }
 if(request.method==="GET" && mode==="monthly"){
  if(!isOwner)return json({success:false,error:"Owner only"},403);
  const month=url.searchParams.get("month");if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||""))return json({success:false,error:"Invalid month"},400);
  const from=month+"-01";const [year,mm]=month.split("-").map(Number);const to=new Date(Date.UTC(year,mm,1)).toISOString().slice(0,10);
  const coachId=url.searchParams.get("coach_id");if(coachId && !/^[1-9]\d*$/.test(coachId))return json({success:false,error:"Invalid coach"},400);
  const filter=coachId?`coach_id=eq.${coachId}&`:"";
  const r=await supabase.request(`gym_coach_shifts?${filter}work_date=gte.${from}&work_date=lt.${to}&select=id,coach_id,work_date,checked_in_at,checked_out_at&order=work_date.asc&limit=2000`);
  if(!r.ok)return json({success:false,error:"โหลดวันทำงานไม่สำเร็จ"},500);
  const shifts=await r.json();const ids=shifts.map(x=>Number(x.id));let assignments=[];
  if(ids.length){const ar=await supabase.request(`gym_coach_shift_classes?shift_id=in.(${ids.join(",")})&select=shift_id,class_session_id,class_sessions(id,session_date,start_time,end_time,classes(name))&limit=4000`);if(!ar.ok)return json({success:false,error:"โหลดคลาสที่สอนไม่สำเร็จ"},500);assignments=await ar.json();}
  return json({success:true,shifts,assignments});
 }
 if(request.method==="GET"){
  const day=url.searchParams.get("date");if(day&&!/^\d{4}-\d{2}-\d{2}$/.test(day))return json({success:false,error:"Invalid date"},400);
  const filter=isOwner?"":`coach_id=eq.${coach.id}&`;
  const q=`${filter}${day?`work_date=eq.${day}&`:""}select=id,coach_id,work_date,checked_in_at,checked_out_at&order=checked_in_at.desc&limit=200`;
  const r=await supabase.request(`gym_coach_shifts?${q}`);if(!r.ok)return json({success:false,error:"โหลดเวลาทำงานไม่สำเร็จ"},500);
  const shifts=await r.json();let assignments=[];
  if(shifts.length){const ids=shifts.map(x=>Number(x.id));const ar=await supabase.request(`gym_coach_shift_classes?shift_id=in.(${ids.join(",")})&select=shift_id,class_session_id,class_sessions(id,classes(name))`);if(!ar.ok)return json({success:false,error:"โหลดคลาสไม่สำเร็จ"},500);assignments=await ar.json();}
  return json({success:true,shifts,assignments});
 }
 if(!coach)return json({success:false,error:"Coach only"},403);
 let body;try{body=await request.json()}catch{return json({success:false,error:"Invalid JSON"},400)}
 if(!["checkin","checkout","add_class"].includes(body?.action))return json({success:false,error:"Invalid action"},400);
 const existing=await supabase.request(`gym_coach_shifts?coach_id=eq.${coach.id}&work_date=eq.${date}&select=id,checked_in_at,checked_out_at&limit=1`);
 if(!existing.ok)return json({success:false,error:"โหลดเวลาไม่สำเร็จ"},500);const shifts=await existing.json();const shift=shifts[0];
 if(body.action==="checkout"){
  if(!shift||shift.checked_out_at)return json({success:false,error:"ไม่พบการเช็กอินที่ยังไม่เช็กเอาต์"},409);
  const r=await supabase.request(`gym_coach_shifts?id=eq.${shift.id}&checked_out_at=is.null&select=id,checked_out_at`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({checked_out_at:new Date().toISOString()})});
  if(!r.ok)return json({success:false,error:"เช็กเอาต์ไม่สำเร็จ"},500);return json({success:true,shift:(await r.json())[0]});
 }
 const classId=Number(body.classSessionId);if(!Number.isSafeInteger(classId)||classId<1)return json({success:false,error:"กรุณาเลือกคลาสจากตารางเรียน"},400);
 const vr=await supabase.request(`class_sessions?id=eq.${classId}&session_date=eq.${date}&status=eq.open&select=id&limit=1`);
 if(!vr.ok||!(await vr.json()).length)return json({success:false,error:"คลาสไม่อยู่ในตารางเรียนวันนี้"},400);
 if(body.action==="checkin"&&shift)return json({success:false,error:"วันนี้เช็กอินแล้ว สามารถเพิ่มคลาสได้"},409);
 if(body.action==="add_class"&&(!shift||shift.checked_out_at))return json({success:false,error:"ต้องเช็กอินก่อน และยังไม่เช็กเอาต์"},409);
 let shiftId=shift?.id;
 if(body.action==="checkin"){
  const r=await supabase.request("gym_coach_shifts?select=id",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({coach_id:coach.id,work_date:date})});
  if(!r.ok)return json({success:false,error:"เช็กอินไม่สำเร็จ"},409);shiftId=(await r.json())[0].id;
 }
 const ar=await supabase.request("gym_coach_shift_classes?on_conflict=shift_id,class_session_id",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({shift_id:shiftId,class_session_id:classId})});
 if(!ar.ok)return json({success:false,error:"บันทึกคลาสไม่สำเร็จ กรุณาตรวจสอบตาราง SQL"},500);
 return json({success:true,shiftId});
}

export default {
  async fetch(request) {
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        }
      });

if (!["GET", "POST"].includes(request.method)) {
  return json({ error: "Method not allowed" }, 405);
}




    try {
      const adminKey = request.headers.get("x-admin-key");

const isOwner = Boolean(process.env.OWNER_KEY) && adminKey === process.env.OWNER_KEY;
const isCoach = !isOwner && Boolean(await activeCoach(request));

// Coach requests may be submitted without a shared password; management is Owner-only.
      const requestUrl = new URL(request.url);
      if (request.method === "POST" && requestUrl.searchParams.get("mode") === "coach-access") {
        return await handleCoachAccess(request, json, isOwner);
      }
      if (requestUrl.searchParams.get("mode") === "coach-attendance") {
        if (!isOwner && !isCoach) return json({success:false,error:"ไม่มีสิทธิ์"},401);
        return await handleCoachAttendance(request,json,isOwner,isCoach ? await activeCoach(request) : null);
      }

if (!isCoach && !isOwner) {
  return json(
    {
      success: false,
      error: "ไม่มีสิทธิ์ใช้งาน"
    },
    401
  );
}
      
if (request.method === "POST") {
  if (!isOwner) {
    return json({
      success: false,
      error: "Owner only"
    }, 403);
  }

  
const url = new URL(request.url);

if (url.searchParams.get("mode") !== "finance") {
  return json({ success: false, error: "Unknown mode" }, 404);
}

const body = await request.json();

// Owner-only: record actual cash/bank movement through the database RPC.
if (body?.action === "record_payment") {
  const entryId = Number(body.entry_id);
  const installmentId = body.installment_id == null || body.installment_id === ""
    ? null : Number(body.installment_id);
  const paymentAmount = Number(body.amount);
  const paymentDate = body.payment_date;
  const paymentMethod = body.payment_method;

  const validDate = typeof paymentDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(paymentDate) &&
    !Number.isNaN(Date.parse(`${paymentDate}T00:00:00Z`)) &&
    new Date(`${paymentDate}T00:00:00Z`).toISOString().slice(0, 10) === paymentDate;

  if (!Number.isSafeInteger(entryId) || entryId <= 0 ||
      (installmentId !== null && (!Number.isSafeInteger(installmentId) || installmentId <= 0)) ||
      !Number.isFinite(paymentAmount) || paymentAmount <= 0 ||
      !Number.isSafeInteger(Math.round(paymentAmount * 100)) ||
      Math.abs(paymentAmount * 100 - Math.round(paymentAmount * 100)) > 0.000001 ||
      !validDate || !["cash", "transfer"].includes(paymentMethod) ||
      (body.reference_number != null && typeof body.reference_number !== "string") ||
      (body.notes != null && typeof body.notes !== "string") ||
      (body.slip_path != null && typeof body.slip_path !== "string") ||
      String(body.reference_number || "").length > 200 ||
      String(body.notes || "").length > 2000 ||
      String(body.slip_path || "").length > 500) {
    return json({ success: false, error: "ข้อมูลการชำระเงินไม่ถูกต้อง" }, 400);
  }

  const paymentResponse = await supabase.request("rpc/finance_record_payment", {
    method: "POST",
    body: JSON.stringify({
      p_entry_id: entryId,
      p_installment_id: installmentId,
      p_amount: paymentAmount,
      p_payment_date: paymentDate,
      p_payment_method: paymentMethod,
      p_reference_number: body.reference_number?.trim() || null,
      p_slip_path: body.slip_path?.trim() || null,
      p_notes: body.notes?.trim() || null
    })
  });

  if (!paymentResponse.ok) {
    const details = await paymentResponse.text();
    console.error("Finance payment RPC failed:", details);
    return json({ success: false, error: "บันทึกชำระเงินไม่สำเร็จ กรุณาตรวจสอบยอดคงค้างและข้อมูลรายการ" }, 400);
  }

  return json({ success: true, message: "บันทึกการชำระเงินจริงสำเร็จ" });
}

const { entry_type, category_id, description, counterparty_name,
  total_amount, entry_date, due_date, notes } = body;

if (!["income", "expense"].includes(entry_type)) {
  return json({ success: false, error: "ประเภทรายการไม่ถูกต้อง" }, 400);
}


const amount = Number(total_amount);
const categoryId = Number(category_id);

function isValidDate(value) {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

if (
  !Number.isFinite(amount) ||
  amount <= 0 ||
  !Number.isSafeInteger(Math.round(amount * 100)) ||
  Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001 ||
  !Number.isSafeInteger(categoryId) ||
  categoryId <= 0 ||
  typeof description !== "string" ||
  !description.trim() ||
  description.length > 500 ||
  !isValidDate(entry_date) ||
  (due_date != null && due_date !== "" && !isValidDate(due_date))
) {
  return json({
    success: false,
    error: "ข้อมูลรายการไม่ถูกต้อง"
  }, 400);
}


const categoryResponse = await supabase.request(
  `finance_categories?id=eq.${categoryId}&type=eq.${entry_type}&is_active=eq.true&select=id`
);

if (!categoryResponse.ok) {
  return json({ success: false, error: "ตรวจสอบหมวดหมู่ไม่สำเร็จ" }, 500);
}

const categories = await categoryResponse.json();

if (categories.length !== 1) {
  return json({ success: false, error: "หมวดหมู่ไม่ถูกต้อง" }, 400);
}

const response = await supabase.request("finance_entries", {
  method: "POST",
  headers: { Prefer: "return=representation" },
  body: JSON.stringify({
    entry_type,
    category_id: categoryId,
    description: description.trim(),
    counterparty_name: counterparty_name || null,
    total_amount: amount,
    entry_date,
    due_date: due_date || null,
    notes: notes || null,
    status: "open"
  })
});

if (!response.ok) {
  console.error("Finance insert failed:", await response.text());
  return json({ success: false, error: "บันทึกรายการไม่สำเร็จ" }, 500);
}

const rows = await response.json();

return json({ success: true, entry: rows[0] }, 201);

}

const url = new URL(request.url);

if (url.searchParams.get("mode") === "yearly-report") {
  if (!isOwner) return json({ success: false, error: "Owner only" }, 403);
  const year = Number(url.searchParams.get("year"));
  if (!Number.isSafeInteger(year) || year < 2020 || year > 2100) {
    return json({ success: false, error: "Invalid year" }, 400);
  }
  const start = `${year}-01-01T00:00:00+07:00`;
  const end = `${year + 1}-01-01T00:00:00+07:00`;
  const monthRows = Array.from({ length: 12 }, (_, index) => ({
    month: `${year}-${String(index + 1).padStart(2, "0")}`,
    memberIncome: 0, newMembers: 0, renewals: 0
  }));
  // Paginate so that a growing membership history is not silently truncated.
  async function allRows(path) {
    const rows = [];
    for (let offset = 0; offset < 100000; offset += 500) {
      const response = await supabase.request(`${path}&limit=500&offset=${offset}`);
      if (!response.ok) {
        console.error("Yearly report query failed:", await response.text());
        throw new Error("โหลดข้อมูลรายงานย้อนหลังไม่สำเร็จ");
      }
      const batch = await response.json();
      rows.push(...batch);
      if (batch.length < 500) return rows;
    }
    throw new Error("ข้อมูลรายงานมากเกินขีดจำกัด กรุณาติดต่อผู้ดูแลระบบ");
  }
  const [registrations, renewals] = await Promise.all([
    allRows(`member_registration?select=id,payment_amount,approved_at&registration_status=eq.approved&approved_at=gte.${encodeURIComponent(start)}&approved_at=lt.${encodeURIComponent(end)}&order=approved_at.asc,id.asc`),
    allRows(`membership_transactions?select=id,amount,approved_at&transaction_type=eq.renewal&payment_status=eq.paid&approved_at=gte.${encodeURIComponent(start)}&approved_at=lt.${encodeURIComponent(end)}&order=approved_at.asc,id.asc`)
  ]);
  const bangkokMonth = value => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit"
    }).formatToParts(date);
    const partsByType = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${partsByType.year}-${partsByType.month}`;
  };
  for (const item of registrations) {
    const month = bangkokMonth(item.approved_at);
    const row = monthRows.find(row => row.month === month);
    if (!row) continue;
    row.newMembers += 1; // Approved registrations, not a historical active-member snapshot.
    row.memberIncome += Number(item.payment_amount || 0);
  }
  for (const item of renewals) {
    const month = bangkokMonth(item.approved_at);
    const row = monthRows.find(row => row.month === month);
    if (!row) continue;
    row.renewals += 1;
    row.memberIncome += Number(item.amount || 0);
  }
  return json({ success: true, year, months: monthRows,
    note: "Member income is grouped by approval date in Bangkok; November 2026 is a trial month." });
}

if (url.searchParams.get("mode") === "finance") {
  if (!isOwner) {
    return json({ error: "Owner only" }, 403);
  }

  const tables = [
    "finance_categories",
    "finance_entries",
    "finance_installments",
    "finance_payments"
  ];

  const results = await Promise.all(
    tables.map(async (table) => {
      const response = await supabase.request(
        `${table}?select=*`
      );

      if (!response.ok) {
        throw new Error(`โหลด ${table} ไม่สำเร็จ`);
      }

      return response.json();
    })
  );

  return json({
    success: true,
    categories: results[0],
    entries: results[1],
    installments: results[2],
    payments: results[3]
  });
}
if (url.searchParams.get("mode") === "auth") {
  return json({
    success: true,
    role: isOwner ? "owner" : "coach"
  });
}
      const today = getBangkokDateString();

    const [
  membersResponse,
  sessionsResponse,
  attendanceResponse,
  beltLevelsResponse,
  currentBeltsResponse,
  beltHistoryResponse
] = await Promise.all([
 supabase.request(
  "members?select=id,display_name,nickname,member_status,member_group,membership_plan,membership_start_date,membership_expiry_date,total_sessions,remaining_sessions,is_guest,created_at"
),

  supabase.request(
  `class_sessions?select=id,start_time,end_time,class_id,status,classes(id,name)&session_date=eq.${today}&status=eq.open`
),

  supabase.request(
    "attendance?select=id,session_id,member_id"
  ),

  supabase.request(
    "belt_levels" +
      "?active=eq.true" +
      "&select=id,code,name_th,rank_order,color_hex" +
      "&order=rank_order.asc"
  ),
supabase.request(
  "member_current_belts" +
    "?select=member_id,belt_level_id,belt_code,belt_name,color_hex,stripe_count,awarded_date"
),

supabase.request(
  "member_belt_history" +
    "?select=id,member_id,belt_level_id,stripe_count,awarded_date,awarded_by,note,belt_levels(id,code,name_th,color_hex)" +
    "&order=awarded_date.desc,id.desc"
)
]);

      if (!membersResponse.ok) {
        const errorText = await membersResponse.text();

        return json(
          {
            success: false,
            error: errorText
          },
          500
        );
      }

      if (!sessionsResponse.ok) {
        const errorText = await sessionsResponse.text();

        return json(
          {
            success: false,
            error: errorText
          },
          500
        );
      }

      if (!attendanceResponse.ok) {
        const errorText = await attendanceResponse.text();

        return json(
          {
            success: false,
            error: errorText
          },
          500
        );
      }
if (!beltLevelsResponse.ok) {
  const errorText =
    await beltLevelsResponse.text();

  return json(
    {
      success: false,
      error: "โหลดระดับสายไม่สำเร็จ",
      details: errorText
    },
    500
  );
}
      const members = await membersResponse.json();
      const sessions = await sessionsResponse.json();
      const attendance = await attendanceResponse.json();
      const beltLevels = await beltLevelsResponse.json();
      if (!currentBeltsResponse.ok) {
  const errorText =
    await currentBeltsResponse.text();

  return json(
    {
      success: false,
      error:
        "โหลดข้อมูลสายปัจจุบันของสมาชิกไม่สำเร็จ",
      details: errorText
    },
    500
  );
}

const currentBelts =
  await currentBeltsResponse.json();
  if (!beltHistoryResponse.ok) {
  const details =
    await beltHistoryResponse.text();

  return json(
    {
      success: false,
      error:
        "โหลดประวัติระดับสายไม่สำเร็จ",
      details
    },
    500
  );
}

const beltHistory =
  await beltHistoryResponse.json();

const beltByMemberId = new Map(
  currentBelts.map((belt) => [
    Number(belt.member_id),
    belt
  ])
);

const membersWithBelts =
  members.map((member) => ({
    ...member,
    current_belt:
      beltByMemberId.get(Number(member.id)) ||
      null
  }));
      let pendingRegistrations = [];
let approvedRegistrations = [];
let rejectedRegistrations = [];

if (isOwner) {
  const registrationResponse = await supabase.request(
    "member_registration" +
      "?select=" +
      [
        "id",
        "created_at",
        "line_user_id",
        "line_display_name",
        "line_picture_url",
        "first_name",
        "last_name",
        "nickname",
        "phone",
        "email",
        "birth_date",
        "gender",
        "medical_conditions",
        "allergies",
        "emergency_contact_name",
        "emergency_contact_relationship",
        "emergency_contact_phone",
        "membership_plan",
        "payment_method",
        "payment_status",
        "registration_status",
        "slip_url",
        "payment_amount",
        "member_id",
        "approved_at",
        "approved_by",
        "coach_note",
        "rejected_at",
        "rejected_by",
        "rejection_reason"
      ].join(",") +
      "&registration_status=in.(pending,approved,rejected)" +
      "&order=created_at.desc"
  );

  if (!registrationResponse.ok) {
    const errorText =
      await registrationResponse.text();

    return json(
      {
        success: false,
        error:
          "โหลดคำขอสมัครสมาชิกไม่สำเร็จ",
        details: errorText
      },
      500
    );
  }

  const registrationRows =
  await registrationResponse.json();

const registrationsWithSlips =
  await Promise.all(
    registrationRows.map(async (registration) => {
      let slipSignedUrl = null;

      if (registration.slip_url) {
        slipSignedUrl =
          await supabase.createSignedUrl(
            "payment-slips",
            registration.slip_url,
            3600
          );
      }

      return {
        ...registration,
        slip_signed_url: slipSignedUrl
      };
    })
  );
  pendingRegistrations = registrationsWithSlips.filter(r => r.registration_status === "pending");
  approvedRegistrations = registrationsWithSlips.filter(r => r.registration_status === "approved").sort((a,b) => (Date.parse(b.approved_at || b.created_at) || 0) - (Date.parse(a.approved_at || a.created_at) || 0));
  rejectedRegistrations = registrationsWithSlips.filter(r => r.registration_status === "rejected").sort((a,b) => (Date.parse(b.rejected_at || b.created_at) || 0) - (Date.parse(a.rejected_at || a.created_at) || 0));
}

      let activeMembers = 0;
      let expiringSoon = 0;
      let expiredMembers = 0;

      for (const member of members) {
        if (
          member.is_guest ||
          !member.membership_expiry_date
        ) {
          continue;
        }

        const daysRemaining = calculateDaysRemaining(
          member.membership_expiry_date,
          today
        );

        if (daysRemaining < 0) {
          expiredMembers += 1;
        } else {
          activeMembers += 1;

          if (daysRemaining <= 7) {
            expiringSoon += 1;
          }
        }
      }

      const expiringMembers = members
        .filter((member) => {
          if (
            member.is_guest ||
            !member.membership_expiry_date
          ) {
            return false;
          }

          const daysLeft = calculateDaysRemaining(
            member.membership_expiry_date,
            today
          );

          return daysLeft >= 0 && daysLeft <= 7;
        })
        .map((member) => ({
          id: member.id,
          name: member.display_name,
          expiry_date: member.membership_expiry_date,
          daysLeft: calculateDaysRemaining(
            member.membership_expiry_date,
            today
          )
        }));

      const todayNewMemberCount = members.filter((member) => {
        if (member.is_guest || !member.created_at) {
          return false;
        }

        return member.created_at.slice(0, 10) === today;
      }).length;

      const todaySessionIds = new Set(
        sessions.map((session) => Number(session.id))
      );

      const todayAttendance = attendance.filter((record) =>
        todaySessionIds.has(Number(record.session_id))
      );

      const classes = sessions.map((session) => {
        const attendanceCount = todayAttendance.filter(
          (record) =>
            Number(record.session_id) === Number(session.id)
        ).length;

        return {
          id: session.id,
          name:
            session.classes?.name ||
            `คลาส ${session.class_id || ""}`.trim(),
          startTime: session.start_time,
          endTime: session.end_time,
          attendanceCount
        };
      });
let pendingRenewals = [];

if (isOwner) {
  const renewalResponse = await supabase.request(
    "membership_transactions" +
      "?transaction_type=eq.renewal" +
      "&payment_status=eq.pending" +
      "&select=" +
      [
        "id",
        "member_id",
        "line_user_id",
        "transaction_type",
        "membership_plan",
        "amount",
        "payment_method",
        "payment_status",
        "slip_url",
        "requested_at",
        "members(id,display_name,nickname,member_group)"
      ].join(",") +
      "&order=requested_at.asc"
  );

  if (!renewalResponse.ok) {
    const details =
      await renewalResponse.text();

    return json(
      {
        success: false,
        error:
          "โหลดคำขอต่ออายุสมาชิกไม่สำเร็จ",
        details
      },
      500
    );
  }

 const renewalRows =
  await renewalResponse.json();

pendingRenewals =
  await Promise.all(
    renewalRows.map(async (renewal) => {
      let slipSignedUrl = null;

      if (renewal.slip_url) {
        slipSignedUrl =
          await supabase.createSignedUrl(
            "payment-slips",
            renewal.slip_url,
            3600
          );
      }

      return {
        ...renewal,
        slip_signed_url: slipSignedUrl
      };
    })
  );
}
// ==============================
// Dashboard การเงิน
// รวมสมัครสมาชิกใหม่ + ต่ออายุ
// ==============================

let finance = {
  todayRevenue: 0,
  monthRevenue: 0,
  todayCash: 0,
  todayTransfer: 0
};
let recentPayments = [];
let paymentHistory = [];

if (isOwner) {
  const [
    renewalFinanceResponse,
    registrationFinanceResponse
  ] = await Promise.all([
    // รายรับจากการต่ออายุ
    supabase.request(
  "membership_transactions" +
    "?payment_status=eq.paid" +
    "&select=id,member_id,amount,payment_method,approved_at,membership_plan,slip_url,members(display_name,nickname)"
),
    // รายรับจากการสมัครสมาชิกใหม่
   supabase.request(
  "member_registration" +
  "?registration_status=eq.approved" +
  "&select=id,member_id,payment_amount,payment_method,approved_at,membership_plan,slip_url,line_display_name,nickname,first_name,last_name"
)
  ]);

  if (!renewalFinanceResponse.ok) {
    const details =
      await renewalFinanceResponse.text();

    return json(
      {
        success: false,
        error:
          "โหลดข้อมูลการเงินจากการต่ออายุไม่สำเร็จ",
        details
      },
      500
    );
  }

  if (!registrationFinanceResponse.ok) {
    const details =
      await registrationFinanceResponse.text();

    return json(
      {
        success: false,
        error:
          "โหลดข้อมูลการเงินจากการสมัครสมาชิกไม่สำเร็จ",
        details
      },
      500
    );
  }

  const renewalTransactions =
    await renewalFinanceResponse.json();

  const registrationTransactions =
    await registrationFinanceResponse.json();

  // รวมข้อมูลให้อยู่ในรูปแบบเดียวกัน
const allTransactions = [
  ...renewalTransactions.map((item) => ({
    id: `renewal-${item.id}`,
    type: "renewal",
    memberId:
  item.member_id == null ? null : Number(item.member_id),
    memberName:
      item.members?.display_name ||
      item.members?.nickname ||
      "สมาชิก",
    membershipPlan:
      item.membership_plan || "-",
    amount:
      Number(item.amount || 0),
    paymentMethod:
      item.payment_method || "",
    approvedAt:
      item.approved_at || null,
    slipPath: item.slip_url || null
  })),

  ...registrationTransactions.map((item) => ({
    id: `registration-${item.id}`,
    type: "registration",
    memberId:
    item.member_id == null ? null : Number(item.member_id),
    memberName:
      item.nickname ||
      item.line_display_name ||
      [item.first_name, item.last_name]
        .filter(Boolean)
        .join(" ") ||
      "สมาชิก",
    membershipPlan:
      item.membership_plan || "-",
    amount:
      Number(item.payment_amount || 0),
    paymentMethod:
      item.payment_method || "",
    approvedAt:
      item.approved_at || null,
    slipPath: item.slip_url || null
  }))
];

  // Signed links are generated only for owner-authorized payment history.
  // Never return raw storage paths to the browser.
  const transactionsWithSlips = await Promise.all(allTransactions.map(async (item) => {
    let slipSignedUrl = null;
    if (item.slipPath) {
      try {
        slipSignedUrl = await supabase.createSignedUrl("payment-slips", item.slipPath, 3600);
      } catch (error) {
        console.error("Could not sign payment slip", item.id, error);
      }
    }
    const { slipPath, ...safeItem } = item;
    return { ...safeItem, slipSignedUrl };
  }));

  const currentMonth =
    today.slice(0, 7);

  finance = transactionsWithSlips.reduce(
    (summary, transaction) => {
      if (
        !transaction.amount ||
        !transaction.approvedAt
      ) {
        return summary;
      }

      const approvedDate =
        new Intl.DateTimeFormat(
          "en-CA",
          {
            timeZone: "Asia/Bangkok",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
          }
        ).format(
          new Date(
            transaction.approvedAt
          )
        );

      const approvedMonth =
        approvedDate.slice(0, 7);

      // รายรับเดือนนี้
      if (
        approvedMonth === currentMonth
      ) {
        summary.monthRevenue +=
          transaction.amount;
      }

      // รายรับวันนี้
      if (approvedDate === today) {
        summary.todayRevenue +=
          transaction.amount;

        if (
          transaction.paymentMethod ===
          "cash"
        ) {
          summary.todayCash +=
            transaction.amount;
        }

        if (
          transaction.paymentMethod ===
          "transfer"
        ) {
          summary.todayTransfer +=
            transaction.amount;
        }
      }

      return summary;
    },
    {
      todayRevenue: 0,
      monthRevenue: 0,
      todayCash: 0,
      todayTransfer: 0
    }
  );
 recentPayments =
transactionsWithSlips
 .filter(
 (transaction) =>
 transaction.approvedAt
 ).sort(
(a, b) =>
 new Date(b.approvedAt) -
 new Date(a.approvedAt)
 )
.slice(0, 10);
paymentHistory =
  transactionsWithSlips
    .filter(
      (transaction) =>
        transaction.approvedAt &&
        transaction.memberId
    )
    .sort(
      (a, b) =>
        new Date(b.approvedAt) -
        new Date(a.approvedAt)
    );
}
   
return json({
        success: true,
        today,
        members: membersWithBelts.filter(
  (member) => !member.is_guest
),

        totalMembers: members.filter(
          (member) => !member.is_guest
        ).length,
        activeMembers,
        expiringSoon,
        expiredMembers,
        expiringMembers,

        todayClassCount: sessions.length,
        todayAttendanceCount: todayAttendance.length,
        todayNewMemberCount,
        todayExpiringCount: expiringMembers.length,
        pendingRegistrationCount:
         pendingRegistrations.length,

       pendingRegistrations,
       approvedRegistrations,
       rejectedRegistrations,
       approvedRegistrationCount: approvedRegistrations.length,
       rejectedRegistrationCount: rejectedRegistrations.length,
       pendingRenewalCount:
  pendingRenewals.length,

pendingRenewals,

finance,

recentPayments,

paymentHistory,

beltLevels,

beltHistory,

classes
      });
    } catch (error) {
      console.error("Admin dashboard error:", error);

      return json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "เกิดข้อผิดพลาด"
        },
        500
      );
    }
  }
};
