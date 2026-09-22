import {getDatabase} from '@/db';
import {isOrganizer} from '@/lib/organizer';
import {sameOrigin} from '@/lib/organizer-security';
import {defaultEvent} from '@/lib/event-types';
import {readSubmission} from '@/lib/submission';
export async function POST(request:Request){if(!await isOrganizer())return Response.json({error:'Organizer access required.'},{status:403});try{
 if(!sameOrigin(request))return Response.json({error:'Please use this website.'},{status:403});
 const {body:b,form}=await readSubmission(request,8000);if(!b||typeof b!=='object')return Response.json({error:'Invalid details.'},{status:400});
 if(b.action==='update_rsvp'){
  const {id,attendance}=b;const guests=attendance==='attending'?Number(b.guests):0;const children=attendance==='attending'?Number(b.children??0):0;
  if(typeof id!=='string'||!/^[a-f0-9]{32}$/.test(id)||!['attending','declined','archived'].includes(attendance)||!Number.isInteger(children)||children<0||children>guests||!Number.isInteger(guests)||guests<0||guests>10||(attendance==='attending'&&guests<1))return Response.json({error:'Check the response status and party size.'},{status:400});
  const result=await getDatabase().prepare('UPDATE rsvps SET attendance=?,guests=?,children=? WHERE id=?').bind(attendance,guests,children,id).run();
  if(!result.meta.changes)return Response.json({error:'This response was not found.'},{status:404});
  if(form)return Response.redirect(new URL('/manage',request.url),303);
  return Response.json({success:true},{headers:{'Cache-Control':'no-store'}});
 }
 const e={...defaultEvent};for(const k of Object.keys(e) as (keyof typeof e)[]){if(typeof b[k]!=='string')return Response.json({error:'Please complete the event details.'},{status:400});e[k]=b[k].trim();}
 if((e.date&&!/^\d{4}-\d{2}-\d{2}$/.test(e.date))||!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time)||e.venue.length>200||e.address.length>400||e.dressCode.length>200||e.note.length>1000)return Response.json({error:'Check the date, time, and text lengths.'},{status:400});
 if(e.date&&(Number.isNaN(Date.parse(e.date+'T12:00:00Z'))||new Date(e.date+'T12:00:00Z').toISOString().slice(0,10)!==e.date))return Response.json({error:'Please enter a valid date.'},{status:400});
 if(e.timezone){try{new Intl.DateTimeFormat('en',{timeZone:e.timezone})}catch{return Response.json({error:'Enter a valid timezone, such as America/Toronto or Africa/Accra.'},{status:400})}}
 await getDatabase().prepare('INSERT INTO wedding_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('event',JSON.stringify(e)).run();
 if(form)return Response.redirect(new URL('/manage',request.url),303);
 return Response.json({success:true},{headers:{'Cache-Control':'no-store'}});
}catch(error){console.error('Wedding settings failed');return Response.json({error:'The details could not be saved. Please try again.'},{status:503})}}
