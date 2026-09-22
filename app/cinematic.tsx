'use client';

import {useState} from 'react';
import {ArrowUpRight,ArrowRight,ArrowDown,CalendarDays,Clock,MapPin,Navigation,Copy,Check} from 'lucide-react';
import {Frame,Photo,photos,Gallery,Guestbook} from './wedding';
import {CalendarButton,Countdown,RSVP,GuestGuide} from './experience';
import {useWeddingEvent} from './event-context';
import {displayDate,displayTime,displayTimezone} from '@/lib/event-types';
import {guestDetails} from '@/lib/guest-details';
import {VenuePhotograph} from './venue-photograph';

export function Home(){
 const event=useWeddingEvent();
 const [copied,setCopied]=useState(false);
 const [copyError,setCopyError]=useState(false);
 const place=[event.venue,event.address].filter(Boolean).join(', ');
 const directions=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}`;
 const map=`https://www.google.com/maps?q=${encodeURIComponent(place)}&output=embed`;
 const noon=event.time==='12:00'?'12:00 noon':displayTime(event.time);
 const dateParts=event.date.split('-');
 const dayOfWeek=event.date?new Intl.DateTimeFormat('en',{weekday:'long',timeZone:'UTC'}).format(new Date(event.date+'T12:00:00Z')):'';
 async function copyAddress(){try{await navigator.clipboard.writeText(place);setCopied(true);setCopyError(false);setTimeout(()=>setCopied(false),3000)}catch{setCopyError(true)}}
 return <Frame page="home">
  <section className="cover" id="home" aria-labelledby="couple-names">
   <div className="cover-pictures"><img className="cover-colour" src="/photos/IMG_5392.webp" alt={photos[0].alt} width={1536} height={2048} fetchPriority="high"/><img className="cover-mono" src="/photos/IMG_5390.webp" alt={photos[3].alt} width={1536} height={2048}/></div>
   <div className="cover-top"><span>A CELEBRATION OF LOVE</span><a href="#the-day">{dateParts[2]} . {dateParts[1]} . {dateParts[0]} <span className="cover-time">· {noon}</span> <ArrowUpRight size={16}/></a></div>
   <div className="cover-title"><p>Together with our families, we’re getting married</p><h1 id="couple-names"><span>Frederick</span><i>&</i><span>Veronica</span></h1><div className="cover-signoff"><span>FREDERICK AMOKOHENE & VERONICA OWUSU</span><a href="#our-story">This is our story <ArrowDown size={17}/></a></div></div>
  </section>
  <div className="wedding-at-a-glance"><a href="#the-day"><CalendarDays/><span><small>{dayOfWeek.toUpperCase()}</small><strong>{displayDate(event.date)}</strong></span></a><a href="#the-day"><Clock/><span><small>THE CEREMONY</small><strong>{noon}</strong></span></a><a href="#venue"><MapPin/><span><small>ST. JOHN’S, NEWFOUNDLAND</small><strong>{event.venue}</strong></span></a><a href="#rsvp" className="cover-rsvp">Reply by October 5 <ArrowUpRight size={22}/><span>RSVP</span></a></div>
  <section className="home-story home-section" id="our-story" aria-labelledby="story-title">
   <div className="section-kicker"><span>01 / OUR STORY</span><span>A LIFETIME OF US</span></div>
   <div className="story-composition"><div className="story-photographs"><figure className="story-image-main"><Photo id="IMG_5386" alt={photos[1].alt}/><figcaption>In your company, always.</figcaption></figure><figure className="story-image-inset"><Photo id="IMG_5090" alt={photos[5].alt}/></figure></div><div className="story-words"><span className="eyebrow">FREDERICK & VERONICA</span><h2 id="story-title">All the little things.<br/><i>One beautiful us.</i></h2><p>A shared glance. A hand to hold. The comfort of simply being together. The moments that say everything, without saying a word.</p><p>Now, a new chapter begins. A celebration of love, of family, and of all the people who make this day our own. We’re so happy you’re part of it.</p><div className="story-signature">With love, <i>F & V</i></div><a className="text-link" href="#gallery">Our story in photographs <ArrowRight size={18}/></a></div></div>
  </section>
  <section className="home-day home-section" id="the-day" aria-labelledby="day-title"><div className="section-kicker"><span>02 / THE WEDDING DAY</span><span>{dayOfWeek.toUpperCase()} · {dateParts[0]}</span></div><div className="day-composition"><div className="day-heading"><span className="eyebrow">THE BEGINNING OF ALWAYS</span><h2 id="day-title">One day.<br/><i>A whole lifetime.</i></h2><p>Join us as we say “I do” and begin our next chapter together.</p><p className="after-ceremony-note">{guestDetails.afterCeremony}</p><div className="day-date-art" aria-hidden="true"><span>{dateParts[2]}</span><i>/</i><span>{dateParts[1]}</span></div><Countdown event={event}/></div><div className="day-invitation"><span className="invitation-wordmark">F <i>&</i> V</span><p className="day-invite-text">Together with their families</p><h3>Frederick Amokohene<br/><i>and</i><br/>Veronica Owusu</h3><p className="day-invite-text">invite you to celebrate their wedding</p><div className="ceremony-facts"><div><span>THE DATE</span><strong>{dayOfWeek}, {displayDate(event.date)}</strong></div><div><span>THE CEREMONY</span><strong>{noon}</strong><small>{displayTimezone(event.timezone)}</small></div><div><span>THE VENUE</span><strong>{event.venue}</strong><small>{event.address}</small></div></div>{event.note&&<p className="day-announcement">{event.note}</p>}<p className="arrival-note">Please allow time to arrive and settle in before the ceremony.</p><CalendarButton event={event}/></div></div></section>
  <section className="home-venue home-section" id="venue" aria-labelledby="venue-title"><div className="section-kicker"><span>03 / VENUE & DIRECTIONS</span><span>MEET US IN ST. JOHN’S</span></div><VenuePhotograph venue={event.venue} address={event.address}/><div className="venue-composition"><div className="venue-words"><span className="eyebrow">THE PLACE WE SAY “I DO”</span><h2 id="venue-title">Find your<br/><i>way to us.</i></h2><h3>{event.venue}</h3><address>{event.address}</address><p>Our ceremony begins at <strong>{noon}</strong>, {displayTimezone(event.timezone)}.</p><p>{guestDetails.parking}</p><a className="button button-burgundy" href={directions} target="_blank" rel="noopener noreferrer"><Navigation size={18}/> Get directions <ArrowUpRight size={18}/></a><button className="text-link copy-address" onClick={copyAddress}>{copied?'Address copied':'Copy venue address'}{copied?<Check size={17}/>:<Copy size={17}/>}</button><span className="copy-status" role="status">{copyError?'Please select and copy the address above.':copied?'Ready to paste into your maps app.':''}</span></div><div className="venue-map"><iframe title={`Map showing ${place}`} src={map} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen/><a className="map-caption" href={directions} target="_blank" rel="noopener noreferrer"><span><MapPin size={20}/><span>{event.venue}<small>{event.address}</small></span></span><ArrowUpRight size={22}/></a></div></div></section>
  <div className="home-gallery-section" id="gallery"><div className="section-kicker"><span>04 / THE PHOTO ALBUM</span><span>TOGETHER & TRADITION</span></div><Gallery embedded/></div>
  <section className="home-reply" id="rsvp" aria-label="RSVP"><div className="section-kicker"><span>05 / YOUR INVITATION</span><span>THE PLEASURE OF YOUR COMPANY</span></div><RSVP embedded/></section>
  <div className="home-guest-info" id="guest-info"><GuestGuide embedded/></div>
  <section className="home-guestbook" id="guestbook" aria-label="Guestbook"><div className="section-kicker"><span>06 / THE GUESTBOOK</span><span>WORDS WE’LL KEEP FOREVER</span></div><Guestbook embedded/></section>
 </Frame>
}
