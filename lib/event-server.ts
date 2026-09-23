import { getDatabase } from '@/db';
import {defaultEvent, type WeddingEvent} from './event-types';
import {WEDDING_GUEST_BACKEND_ENABLED} from './backend-config';
import {publicWeddingBackend} from './public-backend';
export async function getWeddingEvent():Promise<WeddingEvent>{
 if(WEDDING_GUEST_BACKEND_ENABLED)return await publicWeddingBackend.getEvent()??defaultEvent;
 try{const row=await getDatabase().prepare('SELECT value FROM wedding_settings WHERE key = ?').bind('event').first<{value:string}>();return row?{...defaultEvent,...JSON.parse(row.value)}:defaultEvent;}catch{return defaultEvent;}
}
