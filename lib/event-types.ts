import {guestDetails} from './guest-details';
export type WeddingEvent = {date:string;time:string;venue:string;address:string;timezone:string;dressCode:string;note:string};
export const defaultEvent:WeddingEvent={date:'2026-10-10',time:'12:00',venue:'St. James United Church',address:"330 Elizabeth Ave, St. John's, NL A1B 1T9",timezone:'America/St_Johns',dressCode:guestDetails.dressCode,note:''};
export function displayTimezone(timezone:string){return timezone==='America/St_Johns'?"St. John’s local time":timezone.replaceAll('_',' ');}
export function displayTime(time:string){const [h,m]=time.split(':').map(Number);return `${h%12||12}:${String(m||0).padStart(2,'0')} ${h>=12?'p.m.':'a.m.'}`;}
export function displayDate(date:string){if(!date)return 'Date to be confirmed';return new Intl.DateTimeFormat('en',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));}
