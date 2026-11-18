export default { async fetch(request) {
 const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
 if(request.method!=='POST')return json({success:false,error:'Method not allowed'},405);
 const key=request.headers.get('x-admin-key');
 if(!process.env.OWNER_KEY||key!==process.env.OWNER_KEY)return json({success:false,error:'เฉพาะ Owner เท่านั้น'},403);
 const url=process.env.SUPABASE_URL, secret=process.env.SUPABASE_SECRET_KEY;
 if(!url||!secret)return json({success:false,error:'Supabase config ไม่ครบ'},500);
 try {
  const body=await request.json();const id=Number(body.memberId);
  if(!Number.isSafeInteger(id)||id<=0||body.confirmCode!==`GJ-${String(id).padStart(4,'0')}`)return json({success:false,error:'ข้อมูลยืนยันไม่ถูกต้อง'},400);
  const headers={apikey:secret,Authorization:`Bearer ${secret}`};
  const query=async(path)=>{const r=await fetch(`${url}/rest/v1/${path}`,{headers});if(!r.ok)throw new Error(`ตรวจสอบ ${path.split('?')[0]} ไม่สำเร็จ`);return r.json()};
  const rows=await query(`members?id=eq.${id}&select=id&limit=1`);
  if(!rows.length)return json({success:false,error:'ไม่พบสมาชิก'},404);
  // Fail closed: any historical data must be reviewed before deleting the parent member.
  const relations=[['attendance','member_id'],['member_belt_history','member_id'],['member_classes','member_id'],['membership_transactions','member_id'],['member_registration','member_id']];
  for(const [table,column] of relations){const refs=await query(`${table}?${column}=eq.${id}&select=${column}&limit=1`);if(refs.length)return json({success:false,error:`ยังลบไม่ได้: มีข้อมูลเชื่อมโยงใน ${table} กรุณาตรวจสอบประวัติและการเก็บรายงานย้อนหลังก่อน`},409)}
  const r=await fetch(`${url}/rest/v1/members?id=eq.${id}`,{method:'DELETE',headers:{...headers,Prefer:'return=representation'}});
  if(!r.ok)return json({success:false,error:'ฐานข้อมูลปฏิเสธการลบ อาจมีข้อมูลเชื่อมโยงอื่น กรุณาตรวจสอบก่อน',details:await r.text()},409);
  const deleted=await r.json();if(!deleted.length)return json({success:false,error:'ไม่พบรายการที่ถูกลบ'},409);
  return json({success:true,deletedMemberId:id});
 }catch(e){return json({success:false,error:e.message||'ลบไม่สำเร็จ'},500)}
}};
