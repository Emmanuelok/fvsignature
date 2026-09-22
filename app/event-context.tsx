'use client';
import {createContext,useContext} from 'react';
import {defaultEvent,type WeddingEvent} from '@/lib/event-types';
const EventContext=createContext<WeddingEvent>(defaultEvent);
export function EventProvider({event,children}:{event:WeddingEvent;children:React.ReactNode}){return <EventContext.Provider value={event}>{children}</EventContext.Provider>}
export const useWeddingEvent=()=>useContext(EventContext);
