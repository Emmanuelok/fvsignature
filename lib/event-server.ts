import { getDatabase } from '@/db';
import {defaultEvent, type WeddingEvent} from './event-types';
export async function getWeddingEvent():Promise<WeddingEvent>{try{const row=await getDatabase().prepare('SELECT value FROM wedding_settings WHERE key = ?').bind('event').first<{value:string}>();return row?{...defaultEvent,...JSON.parse(row.value)}:defaultEvent;}catch{return defaultEvent;}}
