'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Download, Heart, LoaderCircle, Pause, Play, RotateCw, Share2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Frame } from '../wedding';
import { galleryPhotos } from '@/lib/gallery-photos';

type Portrait = (typeof galleryPhotos)[number];
type Filter = 'All portraits' | 'Together' | 'Tradition' | 'Favourites';
const FAVOURITES_KEY = 'fv-photo-favourites-v1';
const FAVOURITES_EVENT = 'fv-gallery-favourites-changed';
function subscribeFavourites(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(FAVOURITES_EVENT, callback);
  return () => { window.removeEventListener('storage', callback); window.removeEventListener(FAVOURITES_EVENT, callback); };
}
function readFavourites() { try { return localStorage.getItem(FAVOURITES_KEY) || '[]'; } catch { return '[]'; } }
function validFavourites(raw: string): string[] {
  try { const values: unknown = JSON.parse(raw); return Array.isArray(values) ? values.filter((id): id is string => typeof id === 'string' && galleryPhotos.some(photo => photo.id === id)) : []; } catch { return []; }
}
type ViewerState = { requested: number; displayed: number; ready: Record<string, boolean>; failed: Record<string, boolean>; retries: Record<string, number> };
type ViewerAction = { type: 'move'; direction: number } | { type: 'select'; index: number } | { type: 'loaded' | 'failed' | 'retry'; id: string };
const filters: Filter[] = ['All portraits', 'Together', 'Tradition', 'Favourites'];
const photoSource = (photo: Portrait, small = false) => `/photos/${photo.id}${small ? '-small' : ''}.webp`;
const number = (value: number) => String(value).padStart(2, '0');

function AlbumViewer({ items, initialIndex, startPlaying, saved, onSave, onClose, opener }: {
  items: readonly Portrait[];
  initialIndex: number;
  startPlaying: boolean;
  saved: string[];
  onSave: (id: string) => void;
  onClose: () => void;
  opener: HTMLElement | null;
}) {
  const [state, dispatch] = useReducer((previous: ViewerState, action: ViewerAction): ViewerState => {
    if (action.type === 'move' || action.type === 'select') {
      const requested = action.type === 'select' ? action.index : (previous.requested + action.direction + items.length) % items.length;
      return { ...previous, requested, displayed: previous.ready[items[requested].id] ? requested : previous.displayed };
    }
    if (action.type === 'loaded') return { ...previous, ready: { ...previous.ready, [action.id]: true }, displayed: items[previous.requested].id === action.id ? previous.requested : previous.displayed };
    if (action.type === 'failed') return { ...previous, failed: { ...previous.failed, [action.id]: true } };
    return { ...previous, failed: { ...previous.failed, [action.id]: false }, retries: { ...previous.retries, [action.id]: (previous.retries[action.id] || 0) + 1 } };
  }, { requested: initialIndex, displayed: initialIndex, ready: {}, failed: {}, retries: {} });
  const { requested, displayed, ready, failed, retries } = state;
  const [playing, setPlaying] = useState(startPlaying);
  const closeButton = useRef<HTMLButtonElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const current = items[displayed];
  const pending = requested !== displayed || !ready[current.id];
  const error = failed[items[requested].id];
  const move = useCallback((direction: number) => dispatch({ type: 'move', direction }), []);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        move(event.key === 'ArrowRight' ? 1 : -1);
      }
    };
    const visibility = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('keydown', keyboard);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('keydown', keyboard);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [move]);

  useEffect(() => {
    if (!playing || pending || error || document.hidden || items.length < 2) return;
    const timer = window.setTimeout(() => move(1), 6000);
    return () => window.clearTimeout(timer);
  }, [displayed, error, items.length, move, pending, playing]);

  function retry() {
    const id = items[requested].id;
    dispatch({ type: 'retry', id });
  }

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="album-viewer" showCloseButton={false}
      onOpenAutoFocus={event => { event.preventDefault(); closeButton.current?.focus(); }}
      onCloseAutoFocus={event => { event.preventDefault(); opener?.focus(); }}>
      <DialogTitle className="sr-only">Frederick & Veronica — the photographs</DialogTitle>
      <DialogDescription className="sr-only">Use the previous and next buttons, left and right arrow keys, or swipe to browse. Press Escape to return to the gallery.</DialogDescription>
      <header className="album-viewer-top">
        <div className="album-viewer-wordmark">F<span>&</span>V <small>A LIFETIME OF US</small></div>
        <div className="album-viewer-actions">
          <button className="album-icon" onClick={() => setPlaying(value => !value)} aria-label={playing ? 'Pause slideshow' : 'Play slideshow'} aria-pressed={playing}>{playing ? <Pause size={19} /> : <Play size={19} />}</button>
          <button className={`album-icon ${saved.includes(current.id) ? 'is-saved' : ''}`} onClick={() => onSave(current.id)} aria-label={`${saved.includes(current.id) ? 'Unsave' : 'Save'} ${current.title}`} aria-pressed={saved.includes(current.id)}><Heart size={19} /></button>
          <a className="album-icon" href={photoSource(current)} download={`Frederick-Veronica-${current.id}.webp`} aria-label={`Download ${current.title}`}><Download size={19} /></a>
          <button ref={closeButton} className="album-icon album-viewer-close" onClick={onClose} aria-label="Close gallery"><X size={23} /></button>
        </div>
      </header>
      <div className="album-viewer-stage"
        onTouchStart={event => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
        onTouchEnd={event => {
          if (!touch.current) return;
          const dx = touch.current.x - event.changedTouches[0].clientX;
          const dy = touch.current.y - event.changedTouches[0].clientY;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
          touch.current = null;
        }}>
        {!ready[current.id] && <img className="album-viewer-preview" src={photoSource(current, true)} alt="" aria-hidden="true" />}
        {items.map((photo, index) => <img key={`${photo.id}-${retries[photo.id] || 0}`}
          className={`album-viewer-image ${index === displayed && ready[photo.id] ? 'is-active' : ''}`}
          src={`${photoSource(photo)}${retries[photo.id] ? `?retry=${retries[photo.id]}` : ''}`}
          alt={index === displayed ? photo.alt : ''} aria-hidden={index !== displayed}
          onLoad={() => dispatch({ type: 'loaded', id: photo.id })}
          onError={() => dispatch({ type: 'failed', id: photo.id })}
          decoding="async" draggable={false} />)}
        <button className="album-icon album-viewer-prev" onClick={() => move(-1)} aria-label="Previous photograph"><ChevronLeft size={27} /></button>
        <button className="album-icon album-viewer-next" onClick={() => move(1)} aria-label="Next photograph"><ChevronRight size={27} /></button>
        {pending && !error && <div className="album-viewer-loading" role="status"><LoaderCircle className="spin" size={17} /><span>Loading photograph</span></div>}
        {error && <div className="album-viewer-error" role="alert"><p>This photograph could not load.</p><button onClick={retry}><RotateCw size={16} />Try again</button></div>}
      </div>
      <footer className="album-viewer-bottom">
        <div className="album-viewer-caption" aria-live={playing ? 'off' : 'polite'} aria-atomic="true"><span>{current.collection}</span><p>{current.title}</p></div>
        <div className="album-filmstrip" role="group" aria-label="Choose a photograph">{items.map((photo, index) => <button key={photo.id} className={index === displayed ? 'is-active' : ''} onClick={() => dispatch({ type: 'select', index })} aria-label={`View ${photo.title}`} aria-pressed={index === displayed}><img src={photoSource(photo, true)} alt="" /><span>{number(index + 1)}</span></button>)}</div>
        <div className="album-viewer-count"><span>{number(displayed + 1)}</span><i>/</i>{number(items.length)}</div>
      </footer>
      <div className="album-viewer-progress" aria-hidden="true">{playing && !pending && !error && <span key={displayed} />}</div>
    </DialogContent>
  </Dialog>;
}

export default function EditorialGallery({ initialCollection = 'All portraits' }: { initialCollection?: Filter }) {
  const [filter, setFilter] = useState<Filter>(initialCollection);
  const stored = useSyncExternalStore(subscribeFavourites, readFavourites, () => '[]');
  const persisted = useMemo(() => validFavourites(stored), [stored]);
  const [sessionSaved, setSessionSaved] = useState<string[] | null>(null);
  const saved = sessionSaved ?? persisted;
  const [viewer, setViewer] = useState<{ index: number; play: boolean; items: readonly Portrait[]; opener: HTMLElement } | null>(null);
  const album = useRef<HTMLDivElement>(null);
  const filtered = galleryPhotos.filter(photo => filter === 'All portraits' || (filter === 'Favourites' ? saved.includes(photo.id) : photo.collection === filter));

  useEffect(() => {
    try { const cleaned = JSON.stringify(persisted); if (stored !== cleaned) { localStorage.setItem(FAVOURITES_KEY, cleaned); window.dispatchEvent(new Event(FAVOURITES_EVENT)); } } catch { /* Storage is optional. */ }
  }, [persisted, stored]);

  useEffect(() => {
    const root = album.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const elements = Array.from(root.querySelectorAll<HTMLElement>('[data-album-reveal]'));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-revealed'); observer.unobserve(entry.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -20px 0px' });
    elements.forEach(element => {
      if (element.getBoundingClientRect().top > window.innerHeight - 30) element.classList.add('will-reveal');
      observer.observe(element);
    });
    return () => observer.disconnect();
  }, [filter, saved.length]);

  function favourite(id: string) {
    const next = saved.includes(id) ? saved.filter(value => value !== id) : [...saved, id];
    try { localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next)); window.dispatchEvent(new Event(FAVOURITES_EVENT)); setSessionSaved(null); }
    catch { setSessionSaved(next); toast('Your favourites will stay saved for this visit.'); }
  }

  function open(event: MouseEvent<HTMLElement>, index: number, play = false, items: readonly Portrait[] = filtered) {
    setViewer({ index, play, items, opener: event.currentTarget });
  }

  async function share() {
    const url = `${window.location.origin}/gallery`;
    try {
      if (navigator.share) await navigator.share({ title: 'Frederick & Veronica — The Photographs', text: 'A lifetime, in frames. The photographs of Frederick and Veronica.', url });
      else { await navigator.clipboard.writeText(url); toast.success('Gallery link copied'); }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') toast.error('You can share this gallery by copying its address from your browser.');
    }
  }

  return <Frame page="gallery"><div className="signature-album" ref={album}>
    <section className="album-introduction" aria-labelledby="album-title">
      <div className="album-overline"><span>FREDERICK & VERONICA</span><span>THE PHOTOGRAPHS — VOL. 01</span></div>
      <div className="album-intro-main">
        <h1 id="album-title">A lifetime,<br /><i>in frames.</i><span className="album-title-star" aria-hidden="true">✳</span></h1>
        <div className="album-intro-aside"><p>The little glances.<br />The beautiful in-between.<br />Our favourite kind of forever.</p><button className="album-play" onClick={event => open(event, 0, true, galleryPhotos)}><span><Play size={19} fill="currentColor" /></span><span>Play the collection<small>Four moments. One love.</small></span></button></div>
      </div>
      <div className="album-intro-bottom"><span>A COLLECTION TO COME BACK TO.</span><a href="#the-portraits">Explore the photographs <ArrowDown size={18} /></a></div>
    </section>
    <section className="album-collection" id="the-portraits" aria-label="The portrait collection">
      <div className="album-toolbar"><div className="album-filters" role="group" aria-label="Filter photographs">{filters.map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}{value === 'Favourites' && <span>{saved.length}</span>}</button>)}</div><span className="album-result-count" aria-live="polite">{number(filtered.length)} {filtered.length === 1 ? 'PORTRAIT' : 'PORTRAITS'}</span></div>
      {filter === 'Favourites' && <p className="album-device-note">A little collection of your own, saved on this device.</p>}
      <div className="album-spreads" key={filter}>
        {filtered.map((photo, index) => {
          const originalIndex = galleryPhotos.findIndex(item => item.id === photo.id);
          return <article className={`album-spread album-spread-${originalIndex + 1}`} key={photo.id} id={photo.collection === 'Tradition' && !filtered.slice(0, index).some(item => item.collection === 'Tradition') ? 'tradition' : undefined} data-album-reveal style={{ '--frame-number': `"${number(originalIndex + 1)}"` } as CSSProperties}>
            <div className="album-portrait-wrap"><button className="album-portrait" onClick={event => open(event, index)} aria-label={`Open ${photo.title} in the gallery viewer`}><img src={photoSource(photo)} alt={photo.alt} loading={index === 0 ? 'eager' : 'lazy'} decoding="async" width={1536} height={2048} /><span className="album-portrait-open"><span>View photograph</span><ArrowUpRight size={21} /></span></button><div className="album-photo-credit"><span>FREDERICK & VERONICA</span><span>{number(originalIndex + 1)} / {number(galleryPhotos.length)}</span></div></div>
            <div className="album-spread-copy"><span className="album-frame-label">FRAME {number(originalIndex + 1)} <i /> {photo.collection}</span><h2>{photo.title}</h2><p>{photo.caption}</p><div className="album-frame-actions"><button className="album-open-link" onClick={event => open(event, index)}>A closer look <ArrowUpRight size={18} /></button><button className={`album-save ${saved.includes(photo.id) ? 'is-saved' : ''}`} onClick={() => favourite(photo.id)} aria-label={`${saved.includes(photo.id) ? 'Unsave' : 'Save'} ${photo.title}`} aria-pressed={saved.includes(photo.id)}><Heart size={21} /><span>{saved.includes(photo.id) ? 'Saved' : 'Save'}</span></button></div><span className="album-frame-number" aria-hidden="true">{number(originalIndex + 1)}</span></div>
          </article>;
        })}
        {!filtered.length && <div className="album-empty"><Heart size={31} strokeWidth={1} /><h2>Keep a little<br /><i>of what you love.</i></h2><p>Save a photograph with the heart button and you’ll find it here.</p><button className="album-open-link" onClick={() => setFilter('All portraits')}>Explore the photographs <ArrowRight size={18} /></button></div>}
      </div>
    </section>
    <section className="album-endnote" aria-labelledby="album-end-title"><span className="album-end-mark" aria-hidden="true">F<i>&</i>V</span><span className="album-end-label">SOME THINGS ARE WORTH KEEPING.</span><h2 id="album-end-title">A little piece<br /><i>of forever.</i></h2><p>Take these moments with you.</p><div className="album-end-actions"><a className="album-download" href="/Frederick-Veronica-Selected-Photographs.zip" download>Download the collection <Download size={18} /></a><button className="album-share" onClick={share}>Share the gallery <Share2 size={17} /></button></div><Link className="album-return" href="/#home">Back to the celebration <ArrowUpRight size={17} /></Link></section>
    {viewer && <AlbumViewer items={viewer.items} initialIndex={viewer.index} startPlaying={viewer.play} saved={saved} onSave={favourite} onClose={() => setViewer(null)} opener={viewer.opener} />}
  </div></Frame>;
}
