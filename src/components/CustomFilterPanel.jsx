import DualPriceSlider from './DualPriceSlider';

export default function CustomFilterPanel({ open, filters, onChange }) {
  if (!open) return null;

  function update(key, value) {
    onChange({ ...filters, [key]: value });
  }

  function handlePriceRange(minPrice, maxPrice) {
    onChange({ ...filters, minPrice, maxPrice });
  }

  return (
    <div className="custom-filter-panel">
      <div className="custom-filter-grid">

        {/* outlier filtering */}
        <div className="custom-filter-group">
          <label className="custom-filter-toggle">
            <input
              type="checkbox"
              checked={filters.filterOutliers}
              onChange={e => update('filterOutliers', e.target.checked)}
              className="toggle-checkbox"
            />
            filter outlier sales
          </label>
          {filters.filterOutliers && (
            <>
              <label className="custom-filter-label">
                outlier threshold
                <span className="control-value">{filters.outlierPercent}%</span>
              </label>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={filters.outlierPercent}
                onChange={e => update('outlierPercent', Number(e.target.value))}
                className="threshold-slider"
              />
              <span className="custom-filter-hint">
                skips sales more than {filters.outlierPercent}% above/below median
              </span>
            </>
          )}
        </div>

        {/* hide low data */}
        <div className="custom-filter-group">
          <label className="custom-filter-toggle">
            <input
              type="checkbox"
              checked={filters.hideLowData}
              onChange={e => update('hideLowData', e.target.checked)}
              className="toggle-checkbox"
            />
            hide low data items
          </label>
          <span className="custom-filter-hint">
            hides items with less than 5 total sales or less than 2 sales in 30d
          </span>
        </div>

        {/* min + max price on one slider */}
        <div className="custom-filter-group">
          <DualPriceSlider
            minPrice={filters.minPrice}
            maxPrice={filters.maxPrice}
            onChange={handlePriceRange}
          />
        </div>

      </div>
    </div>
  );
}
