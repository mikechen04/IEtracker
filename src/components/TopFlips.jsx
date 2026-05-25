import { formatPrice, getRefPrice, passesPriceRange, passesLowDataFilter } from '../utils/dataUtils';

const RARITY_COLORS = {
  COMMON: '#9ca3af',
  UNCOMMON: '#4ade80',
  RARE: '#60a5fa',
  EPIC: '#c084fc',
  LEGENDARY: '#fb923c',
  MYTHIC: '#f472b6',
};

// emoji icon per cosmetic category — used as placeholder since mcci doesn't expose icon urls
const CATEGORY_ICONS = {
  HAT: '🎩',
  HAIR: '✂️',
  ACCESSORY: '💎',
  AURA: '✨',
  TRAIL: '🌊',
  CLOAK: '🧥',
  ROD: '🎣',
  SWORD: '⚔️',
  BOW: '🏹',
  CROSSBOW: '🏹',
  HEAVY_CROSSBOW: '🏹',
  SHORTBOW: '🏹',
  DAGGER: '🗡️',
  AXE: '🪓',
};

function getIcon(category) {
  return CATEGORY_ICONS[category] || '📦';
}

export default function TopFlips({ listings, itemStats, threshold, customFilters, onSelectItem }) {
  // join each listing with its price stats
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

      const statsWithImg = stats ? { ...stats, imageUrl: listing.imageUrl || stats.imageUrl || null } : null;

      return {
        ...listing,
        stats: statsWithImg,
        avgLast3,
        medianPrice,
        refPrice,
        rarity: listing.rarity || stats?.rarity || '',
        category,
        pctBelow,
        estProfit,
        isFlipEligible,
      };
    })
    // exclude low data when the setting is on
    .filter(l => l.isFlipEligible && l.estProfit > 0 && passesLowDataFilter(l.stats, customFilters));

  // sort by est profit descending, take top 9 listings
  const top9 = [...enriched]
    .sort((a, b) => b.estProfit - a.estProfit)
    .slice(0, 9);

  if (top9.length === 0) {
    return (
      <div className="top-flips-empty">
        <p>no flip eligible listings right now</p>
        <p className="empty-hint">lower the threshold or wait for new listings to come in</p>
      </div>
    );
  }

  return (
    <div className="top-flips-grid">
      {top9.map((listing, idx) => {
        const rarityColor = RARITY_COLORS[listing.rarity] || '#9ca3af';
        const icon = getIcon(listing.category);
        const rank = idx + 1;

        return (
          <div
            key={`${listing.id}-${idx}`}
            className="flip-card"
            onClick={() => listing.stats && onSelectItem(listing.stats)}
            style={{ cursor: listing.stats ? 'pointer' : 'default' }}
          >
            {/* rank badge */}
            <span className="flip-rank">#{rank}</span>

            {/* icon area — use cdn image if available, fall back to emoji */}
            <div className="flip-icon-wrap" style={{ borderColor: rarityColor + '55', background: rarityColor + '10' }}>
              {listing.imageUrl ? (
                <img
                  className="flip-item-img"
                  src={listing.imageUrl}
                  alt={listing.cosmeticName || listing.itemName}
                  onError={(e) => {
                    // cdn image 404d, show the emoji fallback instead
                    e.target.style.display = 'none';
                    const fallback = e.target.parentNode.querySelector('.flip-icon');
                    if (fallback) fallback.style.display = 'inline';
                  }}
                />
              ) : null}
              <span
                className="flip-icon"
                style={{ display: listing.imageUrl ? 'none' : 'inline' }}
              >{icon}</span>
            </div>

            {/* item info */}
            <div className="flip-info">
              <p className="flip-name">
                {listing.itemName}
                {listing.tier !== null && listing.tier !== undefined && (
                  <span className="tier-badge">T{listing.tier}</span>
                )}
              </p>
              <span className="flip-rarity" style={{ color: rarityColor }}>
                {listing.rarity.charAt(0) + listing.rarity.slice(1).toLowerCase()}
              </span>
            </div>

            {/* price details */}
            <div className="flip-prices">
              <div className="flip-price-row">
                <span className="flip-price-label">Buy for</span>
                <span className="flip-price-val">{formatPrice(listing.price)}</span>
              </div>
              <div className="flip-price-row">
                <span className="flip-price-label">Avg last 3</span>
                <span className="flip-price-val">{formatPrice(listing.avgLast3 || listing.medianPrice)}</span>
              </div>
            </div>

            {/* profit badge */}
            <div className="flip-profit-row">
              <span className="flip-pct" style={{ color: '#4ade80' }}>
                -{listing.pctBelow.toFixed(1)}%
              </span>
              <span className="flip-profit" style={{ color: '#4ade80' }}>
                +{formatPrice(listing.estProfit)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
