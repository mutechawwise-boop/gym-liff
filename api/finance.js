import { supabase } from "./lib/supabase.js";

const reply = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

async function readAll(table, select, order = "id.asc") {
  const rows = [];
  const batchSize = 500;
  for (let offset = 0; offset < 10000; offset += batchSize) {
    const query = `${table}?select=${select}&order=${order}&limit=${batchSize}&offset=${offset}`;
    const response = await supabase.request(query, { headers: { "Cache-Control": "no-store" } });
    if (!response.ok) {
      // Avoid exposing database internals to the browser.
      console.error(`Finance query failed: ${table}`, response.status, await response.text());
      throw new Error(`ไม่สามารถโหลดข้อมูล ${table} ได้`);
    }
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error(`รูปแบบข้อมูล ${table} ไม่ถูกต้อง`);
    rows.push(...batch);
    if (batch.length < batchSize) return rows;
  }
  throw new Error(`รายการ ${table} มีจำนวนมากเกินขีดจำกัด API กรุณาเพิ่มการแบ่งหน้า`);
}

const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export default {
  async fetch(request) {
    if (request.method !== "GET") return reply({ success: false, error: "Method not allowed" }, 405);
    const ownerKey = process.env.OWNER_KEY;
    const providedKey = request.headers.get("x-admin-key");
    if (!ownerKey || !providedKey || providedKey !== ownerKey) {
      return reply({ success: false, error: "ไม่มีสิทธิ์เข้าถึงข้อมูลการเงิน" }, 403);
    }
    try {
      const [categories, entries, installments, payments] = await Promise.all([
        readAll("finance_categories", "id,name,type,is_active"),
        readAll("finance_entries", "id,entry_type,category_id,description,counterparty_name,total_amount,entry_date,due_date,notes,status,created_at,updated_at", "entry_date.desc,id.desc"),
        readAll("finance_installments", "id,entry_id,installment_number,amount,due_date,notes", "entry_id.asc,installment_number.asc"),
        readAll("finance_payments", "id,entry_id,installment_id,amount,payment_date,payment_method,reference_number,notes", "payment_date.desc,id.desc")
      ]);

      const paidByEntry = new Map();
      for (const payment of payments) {
        const id = String(payment.entry_id);
        paidByEntry.set(id, money((paidByEntry.get(id) || 0) + Number(payment.amount || 0)));
      }
      const enrichedEntries = entries.map((entry) => {
        const paidAmount = paidByEntry.get(String(entry.id)) || 0;
        const outstandingAmount = money(Number(entry.total_amount) - paidAmount);
        return { ...entry, paid_amount: paidAmount, outstanding_amount: outstandingAmount };
      });
      const summary = { receivable: 0, payable: 0, recordedIncome: 0, recordedExpense: 0 };
      for (const entry of enrichedEntries) {
        if (entry.status !== "open") continue;
        if (entry.entry_type === "income") summary.receivable = money(summary.receivable + Math.max(0, entry.outstanding_amount));
        if (entry.entry_type === "expense") summary.payable = money(summary.payable + Math.max(0, entry.outstanding_amount));
      }
      const entryTypeById = new Map(entries.map((entry) => [String(entry.id), entry.entry_type]));
      for (const payment of payments) {
        const type = entryTypeById.get(String(payment.entry_id));
        if (type === "income") summary.recordedIncome = money(summary.recordedIncome + Number(payment.amount));
        if (type === "expense") summary.recordedExpense = money(summary.recordedExpense + Number(payment.amount));
      }
      return reply({ success: true, categories, entries: enrichedEntries, installments, payments, summary });
    } catch (error) {
      console.error("Finance API error:", error);
      return reply({ success: false, error: "โหลดข้อมูลการเงินไม่สำเร็จ กรุณาตรวจสอบการตั้งค่าและบันทึกเซิร์ฟเวอร์" }, 500);
    }
  }
};
