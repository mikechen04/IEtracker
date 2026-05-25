import { formatPrice, PRICE_SLIDER_MAX, PRICE_SLIDER_STEP } from '../utils/dataUtils';

// one slider track with two thumbs for min/max price
export default function DualPriceSlider({ minPrice, maxPrice, onChange }) {
  const minPct = (minPrice / PRICE_SLIDER_MAX) * 100;
  const maxPct = (maxPrice / PRICE_SLIDER_MAX) * 100;

  const maxLabel = maxPrice >= PRICE_SLIDER_MAX ? 'no max' : formatPrice(maxPrice);

  function handleMin(val) {
    onChange(Math.min(val, maxPrice), maxPrice);
  }

  function handleMax(val) {
    onChange(minPrice, Math.max(val, minPrice));
  }

  return (
    <div className="dual-price-slider">
      <label className="custom-filter-label">
        price range
        <span className="control-value">
          {formatPrice(minPrice)} - {maxLabel}
        </span>
      </label>

      <div className="dual-range">
        <div className="dual-range-track">
          <div
            className="dual-range-fill"
            style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }}
          />
        </div>

        <input
          type="range"
          min={0}
          max={PRICE_SLIDER_MAX}
          step={PRICE_SLIDER_STEP}
          value={minPrice}
          onChange={e => handleMin(Number(e.target.value))}
          className="dual-range-input dual-range-min"
          style={{ zIndex: minPrice > maxPrice - PRICE_SLIDER_STEP * 3 ? 5 : 3 }}
        />
        <input
          type="range"
          min={0}
          max={PRICE_SLIDER_MAX}
          step={PRICE_SLIDER_STEP}
          value={maxPrice}
          onChange={e => handleMax(Number(e.target.value))}
          className="dual-range-input dual-range-max"
          style={{ zIndex: 4 }}
        />
      </div>
    </div>
  );
}
