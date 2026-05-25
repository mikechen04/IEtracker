import { useState } from 'react'; // eslint-disable-line
import { formatPrice, passesLowDataFilter } from '../utils/dataUtils';
import { resolveItemImageUrl } from '../utils/apiClient';
import LowDataBadge from './LowDataBadge';

const RARITY_COLORS = {
  COMMON: '#9ca3af',
  UNCOMMON: '#4ade80',
  RARE: '#60a5fa',
  EPIC: '#c084fc',
  LEGENDARY: '#fb923c',
  MYTHIC: '#f472b6',
};

const RARITIES = ['ALL', 'COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];

// sort column header button
function SortHeader({ label, col, sortCol, sortDir, onSort }) {
  const active = sortCol === col;
  return (
    <th onClick={() => onSort(col)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      {label}
      <span className="sort-indicator">
        {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
      </span>
    </th>
  );
}

// threshold is now passed in from App so it stays in sync with the listings tab
export default function FlipperTable({ items, threshold, customFilters, onSelectItem }) {
  const [rarityFilter, setRarityFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('pctBelowMedian');
  const [sortDir, setSortDir] = useState('desc');
  const [showAll, setShowAll] = useState(false); // toggle: show only flips or all items

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  // filter and sort items
  let filtered = items.filter(item => {
    // rarity filter
    if (rarityFilter !== 'ALL' && item.rarity !== rarityFilter) return false;
    // search filter
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    // threshold filter - only show items below threshold % of median
    if (!showAll && item.pctBelowMedian < threshold) return false;
    if (!passesLowDataFilter(item, customFilters)) return false;
    return true;
  });

  // apply sort
  filtered = [...filtered].sort((a, b) => {
    let valA = a[sortCol];
    let valB = b[sortCol];
    // handle string sort
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="flipper-container">
      {/* controls bar */}
      <div className="controls-bar">
        <div className="controls-left">
          {/* show all toggle */}
          <div className="control-group">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={showAll}
                onChange={e => setShowAll(e.target.checked)}
                className="toggle-checkbox"
              />
              Show all items
            </label>
          </div>
        </div>

        <div className="controls-right">
          {/* search */}
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="search-input"
          />

          {/* rarity filter */}
          <div className="rarity-filters">
            {RARITIES.map(r => (
              <button
                key={r}
                className={`rarity-btn ${rarityFilter === r ? 'active' : ''}`}
                style={rarityFilter === r && r !== 'ALL' ? { borderColor: RARITY_COLORS[r], color: RARITY_COLORS[r] } : {}}
                onClick={() => setRarityFilter(r)}
              >
                {r === 'ALL' ? 'All' : r.charAt(0) + r.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* results count */}
      <div className="results-info">
        {showAll
          ? `showing all ${filtered.length} items`
          : `${filtered.length} item${filtered.length !== 1 ? 's' : ''} at least ${threshold}% below median`
        }
      </div>

      {/* table */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          no items match those filters, try lowering the threshold
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="flipper-table">
            <thead>
              <tr>
                <SortHeader label="Item" col="name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Rarity" col="rarity" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Latest Sale" col="latestPrice" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Median Price" col="medianPrice" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="% Below Median" col="pctBelowMedian" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Est. Profit" col="estProfit" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Sales Vol." col="volume" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <th>Chart</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const isFlip = item.pctBelowMedian >= threshold;
                const rarityColor = RARITY_COLORS[item.rarity] || '#9ca3af';
                const imageUrl = resolveItemImageUrl(item);
                return (
                  <tr
                    key={item.name}
                    className="item-row"
                    onClick={() => onSelectItem(item)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="item-name-cell">
                      {imageUrl && (
                        <img
                          className="item-row-img"
                          src={imageUrl}
                          alt=""
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )}
                      {item.name}
                      {item.isLowData && (
                        <LowDataBadge
                          volume={item.volume}
                          recentSalesCount={item.recentSalesCount}
                        />
                      )}
                    </td>
                    {/* name already includes "- Tier X" from the sheet data */}
                    <td>
                      <span className="rarity-tag" style={{ color: rarityColor }}>
                        {item.rarity.charAt(0) + item.rarity.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="price-cell">{formatPrice(item.latestPrice)}</td>
                    <td className="price-cell">{formatPrice(item.medianPrice)}</td>
                    <td>
                      <span
                        className="pct-badge"
                        style={{
                          color: item.pctBelowMedian > 0 ? '#4ade80' : '#f87171',
                        }}
                      >
                        {item.pctBelowMedian > 0 ? '-' : '+'}{Math.abs(item.pctBelowMedian).toFixed(1)}%
                      </span>
                    </td>
                    <td className="price-cell" style={{ color: item.estProfit > 0 ? '#4ade80' : '#f87171' }}>
                      {item.estProfit > 0 ? '+' : ''}{formatPrice(item.estProfit)}
                    </td>
                    <td className="volume-cell">{item.volume}</td>
                    <td onClick={e => { e.stopPropagation(); onSelectItem(item); }}>
                      <button className="chart-btn">↗</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
