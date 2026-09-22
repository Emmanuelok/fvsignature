import {getDatabase} from '@/db';
import {readSubmission,hexId} from '@/lib/submission';
export async function POST(request:Request){try{
 const origin=request.headers.get('origin');if(origin&&new URL(origin).host!==new URL(request.url).host)return Response.json({error:'Please respond from this website.'},{status:403});
 let b,form=false;try{const parsed=await readSubmission(request);b=parsed.body;form=parsed.form}catch{return Response.json({error:'Please check your response.'},{status:400})}
 if(!b||typeof b!=='object'||b.website)return Response.json({error:'Please check your response.'},{status:400});
 const str=(k:string)=>typeof b[k]==='string'?b[k].trim():'';
 const id=str('id')||(form?hexId():''),name=str('name'),email=str('email').toLowerCase(),attendance=str('attendance'),guestNames=str('guestNames'),dietary=str('dietary'),song=str('song'),note=str('note'),accessNeeds=attendance==='attending'?str('accessNeeds'):'';
 const guests=attendance==='declined'?0:Number(b.guests);
 const children=attendance==='declined'?0:Number(b.children??0);
 if(!Number.isInteger(children)||children<0||children>guests||accessNeeds.length>1000)return Response.json({error:'Check the number of children and keep access needs within 1,000 characters.'},{status:400});
 if(!/^[a-f0-9]{32}$/.test(id)||name.length<2||name.length>100||email.length>160||!/^\S+@\S+\.\S+$/.test(email)||!['attending','declined'].includes(attendance)||!Number.isInteger(guests)||guests<0||guests>10||(attendance==='attending'&&guests<1)||(attendance==='attending'&&guests>1&&guestNames.length<2)||guestNames.length>600||dietary.length>600||song.length>180||note.length>1000)return Response.json({error:'Please enter a valid name, email, response, and party size.'},{status:400});
 await getDatabase().prepare('INSERT OR IGNORE INTO rsvps (id,name,email,attendance,guests,children,access_needs,guest_names,dietary,song,note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,name,email,attendance,guests,children,accessNeeds,guestNames,dietary,song,note,Date.now()).run();
 if(form)return Response.redirect(new URL('/thanks?kind=rsvp&ref=FV-'+id.slice(0,8).toUpperCase(),request.url),303);
 return Response.json({success:true,reference:'FV-'+id.slice(0,8).toUpperCase()},{status:201,headers:{'Cache-Control':'no-store'}});
}catch(error){console.error('RSVP failed');return Response.json({error:'Your response could not be saved. Your details are still here; please try again.'},{status:503})}}
