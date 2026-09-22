import { getDatabase } from '@/db';
import {readSubmission} from '@/lib/submission';
export async function POST(request: Request) {
 try {
  const origin=request.headers.get('origin');
  if(origin&&new URL(origin).host!==new URL(request.url).host)return Response.json({error:'Please send your message from this website.'},{status:403});
  let body,form=false;try{const parsed=await readSubmission(request,8000);body=parsed.body;form=parsed.form}catch{return Response.json({error:'The message could not be read. Please try again.'},{status:400})}
  if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Please enter your name and message.'},{status:400});
  if(body.website)return Response.json({error:'Unable to send this message.'},{status:400});
  const name=typeof body.name==='string'?body.name.trim():'';
  const message=typeof body.message==='string'?body.message.trim():'';
  const id=typeof body.id==='string'?body.id:(form?crypto.randomUUID():'');
  if(name.length<2||name.length>80||message.length<10||message.length>1500||!/^[-a-f0-9]{36}$/.test(id))return Response.json({error:'Please enter your name (2–80 characters) and a message (10–1,500 characters).'},{status:400});
  const db=getDatabase();
  await db.prepare('INSERT OR IGNORE INTO wishes (id, name, message, created_at) VALUES (?, ?, ?, ?)').bind(id,name,message,Date.now()).run();
  if(form)return Response.redirect(new URL('/thanks?kind=wish',request.url),303);
  return Response.json({success:true},{status:201,headers:{'Cache-Control':'no-store'}});
 } catch(error) {
  console.error('Guestbook save failed');
  return Response.json({error:'Your wish could not be saved just now. Your words are still here—please try again.'},{status:503});
 }
}
