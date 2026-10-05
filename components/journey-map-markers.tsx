'use client';

import { useId, useState } from 'react';

type Place = { id: string; name: string; x: number; y: number };
type Selection = { place: Place; nearby: boolean; scale: number };

export default function JourneyMapMarkers({ places, width, height }: { places: Place[]; width: number; height: number }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const tooltipId = useId();
  const selectedPlaces = selection
    ? [selection.place, ...places.filter(place => selection.nearby && place.id !== selection.place.id
      && Math.hypot(place.x - selection.place.x, place.y - selection.place.y) < 14)]
    : [];
  const tooltipScale = selection?.scale ?? 1;
  const tooltipWidth = Math.max(100, ...selectedPlaces.map(place => place.name.length * 10 + 28)) * tooltipScale;
  const tooltipHeight = (selectedPlaces.length * 25 + 18) * tooltipScale;
  const tooltipX = selection ? Math.min(Math.max(selection.place.x - tooltipWidth / 2, 8), width - tooltipWidth - 8) : 0;
  const tooltipY = selection
    ? (selection.place.y - tooltipHeight - 16 >= 8
      ? selection.place.y - tooltipHeight - 16
      : Math.min(selection.place.y + 16, height - tooltipHeight - 8))
    : 0;

  function selectPlace(place: Place, nearby: boolean, element: SVGGElement) {
    const renderedWidth = element.ownerSVGElement?.getBoundingClientRect().width || width;
    setSelection({ place, nearby, scale: Math.max(1, width / renderedWidth * 14 / 18) });
  }

  return (
    <g className="journey-map-markers" onKeyDown={event => {
      if (event.key === 'Escape') setSelection(null);
    }}>
      {places.map(place => (
        <g
          key={place.id}
          className={`journey-map-place${selection?.place.id === place.id ? ' is-active' : ''}`}
          data-city={place.id}
          transform={`translate(${place.x.toFixed(2)} ${place.y.toFixed(2)})`}
          role="button"
          tabIndex={0}
          aria-label={`${place.name} — Visited`}
          aria-describedby={selection?.place.id === place.id ? tooltipId : undefined}
          onPointerEnter={event => {
            if (event.pointerType === 'mouse') selectPlace(place, true, event.currentTarget);
          }}
          onPointerLeave={event => {
            if (event.pointerType === 'mouse') {
              setSelection(current => current?.place.id === place.id && current.nearby ? null : current);
            }
          }}
          onFocus={event => selectPlace(place, false, event.currentTarget)}
          onBlur={() => setSelection(current => current?.place.id === place.id ? null : current)}
          onClick={event => selectPlace(place, true, event.currentTarget)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              selectPlace(place, false, event.currentTarget);
            }
          }}
        >
          <circle className="journey-map-hit" r="8" />
          <circle className="journey-map-glow" r="7" filter="url(#journey-map-glow)" />
          <circle className="journey-map-halo" r="6" />
          <circle className="journey-map-dot" r="3.5" />
        </g>
      ))}
      {selection && (
        <g id={tooltipId} className="journey-map-tooltip" role="tooltip" transform={`translate(${tooltipX.toFixed(2)} ${tooltipY.toFixed(2)})`}>
          <rect width={tooltipWidth} height={tooltipHeight} rx={7 * tooltipScale} />
          <g transform={`scale(${tooltipScale})`}>
            {selectedPlaces.map((place, index) => (
              <text key={place.id} x="14" y={index * 25 + 26}>{place.name}</text>
            ))}
          </g>
        </g>
      )}
    </g>
  );
}
