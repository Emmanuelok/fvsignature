type VenuePhotographProps = {
  venue: string;
  address: string;
};

export function VenuePhotograph({venue, address}: VenuePhotographProps) {
  return (
    <figure className="venue-photograph">
      <div className="venue-photograph-frame">
        <img
          src="/photos/st-james-enhanced.png"
          alt="St. James United Church, with its distinctive steep roof, warm brick entrance and green spire."
          width={1821}
          height={864}
          loading="lazy"
          decoding="async"
        />
      </div>
      <figcaption>
        <span className="venue-photo-caption"><span>OUR PLACE OF CELEBRATION</span><strong>{venue}</strong></span>
        <span className="venue-photo-address">{address}</span>
      </figcaption>
    </figure>
  );
}
