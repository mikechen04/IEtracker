import { useState } from 'react';
import { formatPrice, getRefPrice, passesPriceRange, passesLowDataFilter } from '../utils/dataUtils';
import LowDataBadge from './LowDataBadge';

const RARITY_COLORS = {
  COMMON: '#9ca3af',
  UNCOMMON: '#4ade80',
  RARE: '#60a5fa',
  EPIC: '#c084fc',
  LEGENDARY: '#fb923c',
  MYTHIC: '#f472b6',
};

const CATEGORY_GROUPS = [
  {
    label: 'Wearables',
    categories: ['HAT', 'HAIR', 'ACCESSORY', 'AURA', 'TRAIL', 'CLOAK', 'ROD'],
  },
  {
    label: 'Weapon Skins',
    categories: ['SWORD', 'BOW', 'CROSSBOW', 'HEAVY_CROSSBOW', 'SHORTBOW', 'DAGGER', 'AXE'],
  },
];

const CATEGORY_LABELS = {
  HAT: 'Hats',
  HAIR: 'Hair',
  ACCESSORY: 'Accessories',
  AURA: 'Auras',
  TRAIL: 'Trails',
  CLOAK: 'Cloaks',
  ROD: 'Fishing Rods',
  SWORD: 'Swords',
  BOW: 'Bows',
  CROSSBOW: 'Crossbows',
  HEAVY_CROSSBOW: 'Heavy XBows',
  SHORTBOW: 'Shortbows',
  DAGGER: 'Daggers',
  AXE: 'Axes',
};

const RARITIES = ['ALL', 'COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];

export default function ListingsView({
  listings,
  itemStats,
  threshold,
  customFilters,
  apiLoading,
  apiListingCount,
  onSelectItem,
  onRefresh,
}) {
  const [sortCol, setSortCol] = useState('pctBelow');
  const [sortDir, setSortDir] = useState('desc');
  const [rarityFilter, setRarityFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [flipOnly, setFlipOnly] = useState(false);

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  // enrich each listing with price stats from historical data
  const enriched = listings
    .filter(l => l.status === 'active' && passesPriceRange(l.price, customFilters))
    .map(listing => {
      const stats = itemStats.find(
        i => i.name.toLowerCase() === listing.itemName.toLowerCase()
      );
      const refPrice = getRefPrice(stats, customFilters);
      const avgLast3 = refPrice;
      const medianPrice = stats?.medianPrice || null;
      const pctBelow = refPrice && refPrice > 0
        ? ((refPrice - listing.price) / refPrice) * 100
        : null;
      const estProfit = refPrice ? refPrice - listing.price : null;
      const isFlipEligible = pctBelow !== null && pctBelow >= threshold;
      const category = listing.category || stats?.category || null;

      // attach imageUrl to stats so the modal can show it
      const statsWithImg = stats ? { ...stats, imageUrl: listing.imageUrl || stats.imageUrl || null } : null;

      return {
        ...listing,
        stats: statsWithImg,
        medianPrice,
        avgLast3,
        refPrice,
        rarity: listing.rarity || stats?.rarity || '',
        category,
        pctBelow,
        estProfit,
        isFlipEligible,
      };
    })
    .filter(l => {
      if (rarityFilter !== 'ALL' && l.rarity !== rarityFilter) return false;
      if (categoryFilter !== 'ALL') {
        if (categoryFilter === 'OTHER') {
          if (l.category) return false;
        } else {
          if (l.category !== categoryFilter) return false;
        }
      }
      if (search && !l.itemName.toLowerCase().includes(search.toLowerCase())) return false;
      if (flipOnly && !l.isFlipEligible) return false;
      if (!passesLowDataFilter(l.stats, customFilters)) return false;
      return true;
    });

  const sorted = [...enriched].sort((a, b) => {
    let valA = a[sortCol];
    let valB = b[sortCol];
    if (valA === null && valB === null) return 0;
    if (valA === null) return 1;
    if (valB === null) return -1;
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const flipCount = enriched.filter(l => l.isFlipEligible).length;

  // count per category for sidebar badges — use unfiltered enriched (before category filter)
  const allEnriched = listings
    .filter(l => l.status === 'active' && passesPriceRange(l.price, customFilters))
    .map(listing => {
      const stats = itemStats.find(i => i.name.toLowerCase() === listing.itemName.toLowerCase());
      const category = listing.category || stats?.category || null;
      const refPrice = getRefPrice(stats, customFilters);
      const pctBelow = refPrice && refPrice > 0 ? ((refPrice - listing.price) / refPrice) * 100 : null;
      const isFlipEligible = pctBelow !== null && pctBelow >= threshold;
      return { ...listing, category, isFlipEligible, stats };
    })
    .filter(l => passesLowDataFilter(l.stats, customFilters));

  const categoryCounts = {};
  for (const l of allEnriched) {
    const key = l.category || 'OTHER';
    categoryCounts[key] = (categoryCounts[key] || 0) + 1;
  }
  const totalCount = allEnriched.length;

  function SortTh({ label, col }) {
    const active = sortCol === col;
    return (
      <th onClick={() => handleSort(col)} style={{ cursor: 'pointer', userSelect: 'none' }}>
        {label}
        <span className="sort-indicator">
          {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
        </span>
      </th>
    );
  }

  return (
    <div className="listings-view">
      {/* top status bar */}
      <div className="live-status-bar">
        <div className="live-status-left">
          <span className={`live-dot ${apiLoading ? 'loading' : 'live'}`} />
          <span className="live-label">
            {apiLoading ? 'refreshing...' : `${apiListingCount} live listings`}
          </span>
          {!apiLoading && <span className="live-note">&gt;_&lt;</span>}
        </div>
        <div className="live-status-right">
          <button className="small-btn" onClick={onRefresh} disabled={apiLoading}>
            {apiLoading ? '...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* main layout: sidebar + content */}
      <div className="listings-layout">

        {/* left sidebar: category filter */}
        <div className="cat-sidebar">
          <button
            className={`cat-sidebar-btn ${categoryFilter === 'ALL' ? 'cat-active' : ''}`}
            onClick={() => setCategoryFilter('ALL')}
          >
            <span>All</span>
            <span className="cat-count">{totalCount}</span>
          </button>

          {CATEGORY_GROUPS.map(group => {
            // only render the group if any of its categories have listings
            const groupHasItems = group.categories.some(c => (categoryCounts[c] || 0) > 0);
            if (!groupHasItems) return null;
            return (
              <div key={group.label} className="cat-sidebar-group">
                <span className="cat-sidebar-group-label">{group.label}</span>
                {group.categories.map(cat => {
                  const count = categoryCounts[cat] || 0;
                  if (count === 0) return null;
                  return (
                    <button
                      key={cat}
                      className={`cat-sidebar-btn ${categoryFilter === cat ? 'cat-active' : ''}`}
                      onClick={() => setCategoryFilter(cat)}
                    >
                      <span>{CATEGORY_LABELS[cat]}</span>
                      <span className="cat-count">{count}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}

          {(categoryCounts['OTHER'] || 0) > 0 && (
            <div className="cat-sidebar-group">
              <span className="cat-sidebar-group-label">Other</span>
              <button
                className={`cat-sidebar-btn ${categoryFilter === 'OTHER' ? 'cat-active' : ''}`}
                onClick={() => setCategoryFilter('OTHER')}
              >
                <span>Misc</span>
                <span className="cat-count">{categoryCounts['OTHER']}</span>
              </button>
            </div>
          )}
        </div>

        {/* right: filters + table */}
        <div className="listings-main">
          {/* filter bar */}
          <div className="listings-filter-bar">
            <div className="filter-left">
              {flipCount > 0 && (
                <span className="flip-count-badge">{flipCount} flip eligible</span>
              )}
              <label className="toggle-label small">
                <input
                  type="checkbox"
                  checked={flipOnly}
                  onChange={e => setFlipOnly(e.target.checked)}
                  className="toggle-checkbox"
                />
                flip only
              </label>
            </div>
            <div className="filter-right">
              <input
                type="text"
                className="search-input"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
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

          <div className="results-info">
            {sorted.length} listing{sorted.length !== 1 ? 's' : ''}
          </div>

          {sorted.length === 0 ? (
            <div className="empty-state">
              {apiLoading
                ? 'loading listings...'
                : listings.filter(l => l.status === 'active').length === 0
                  ? 'no listings yet, waiting for API data'
                  : 'no listings match your filters'
              }
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="flipper-table">
                <thead>
                  <tr>
                    <SortTh label="Item" col="itemName" />
                    <th>Rarity</th>
                    <SortTh label="Listing Price" col="price" />
                    <th>Qty</th>
                    <SortTh label="Avg Last 3" col="avgLast3" />
                    <SortTh label="Median" col="medianPrice" />
                    <SortTh label="% Below" col="pctBelow" />
                    <SortTh label="Est. Profit" col="estProfit" />
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((listing, idx) => {
                    const rarityColor = RARITY_COLORS[listing.rarity] || '#9ca3af';
                    return (
                      <tr
                        key={listing.id || idx}
                        className="item-row"
                        onClick={() => listing.stats && onSelectItem(listing.stats)}
                        style={{ cursor: listing.stats ? 'pointer' : 'default' }}
                      >
                        <td className="item-name-cell">
                          {listing.imageUrl && (
                            <img
                              className="item-row-img"
                              src={listing.imageUrl}
                              alt=""
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          )}
                          {listing.itemName}
                          {listing.tier !== null && listing.tier !== undefined && (
                            <span className="tier-badge">T{listing.tier}</span>
                          )}
                          {listing.stats?.isLowData && (
                            <LowDataBadge
                              volume={listing.stats.volume}
                              recentSalesCount={listing.stats.recentSalesCount}
                            />
                          )}
                        </td>
                        <td>
                          {listing.rarity && (
                            <span className="rarity-tag" style={{ color: rarityColor }}>
                              {listing.rarity.charAt(0) + listing.rarity.slice(1).toLowerCase()}
                            </span>
                          )}
                        </td>
                        <td className="price-cell">{formatPrice(listing.price)}</td>
                        <td className="volume-cell">{listing.qty > 1 ? `x${listing.qty}` : '-'}</td>
                        <td className="price-cell">
                            {listing.avgLast3 ? formatPrice(listing.avgLast3) : <span className="no-data">-</span>}
                        </td>
                        <td className="price-cell">
                            {listing.medianPrice ? formatPrice(listing.medianPrice) : <span className="no-data">-</span>}
                        </td>
                        <td>
                          {listing.pctBelow !== null ? (
                            <span className="pct-badge" style={{ color: listing.pctBelow > 0 ? '#4ade80' : '#f87171' }}>
                              {listing.pctBelow > 0 ? '-' : '+'}{Math.abs(listing.pctBelow).toFixed(1)}%
                            </span>
                          ) : <span className="no-data">-</span>}
                        </td>
                        <td className="price-cell">
                          {listing.estProfit !== null ? (
                            <span style={{ color: listing.estProfit > 0 ? '#4ade80' : '#f87171' }}>
                              {listing.estProfit > 0 ? '+' : ''}{formatPrice(listing.estProfit)}
                            </span>
                          ) : <span className="no-data">-</span>}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          {listing.stats && (
                            <button className="chart-btn" onClick={() => onSelectItem(listing.stats)}>↗</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
