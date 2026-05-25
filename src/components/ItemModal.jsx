import { useEffect, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { formatPrice, getRefPrice } from '../utils/dataUtils';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const RARITY_COLORS = {
  COMMON: '#9ca3af',
  UNCOMMON: '#4ade80',
  RARE: '#60a5fa',
  EPIC: '#c084fc',
  LEGENDARY: '#fb923c',
  MYTHIC: '#f472b6',
};

// time period options for the chart
const TIME_PERIODS = [
  { label: '1D', days: 1 },
  { label: '7D', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: 'All', days: null }, // null = no filter
];

// filter a sales array to only include sales within the last N days
function filterByDays(sales, days) {
  if (!days) return sales;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return sales.filter(s => s.date && s.date >= cutoff);
}

// group sales by date and compute the avg price per day
function groupByDate(sales) {
  const groups = {};
  for (const sale of sales) {
    const key = sale.dateStr || 'unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(sale.price);
  }
  const labels = Object.keys(groups);
  const prices = labels.map(date => {
    const arr = groups[date];
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  });
  return { labels, prices };
}

export default function ItemModal({ item, onClose, darkMode, activeListings, customFilters }) {
  const overlayRef = useRef(null);
  const [timePeriod, setTimePeriod] = useState('All');

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!item) return null;

  // same avg last 3 used in listings / featured (respects outlier filter setting)
  const avgLast3Ref = getRefPrice(item, customFilters) || item.avgLast3 || item.medianPrice || 0;

  const rarityColor = RARITY_COLORS[item.rarity] || '#9ca3af';
  const textColor = darkMode ? '#e8e8e8' : '#111111';
  const gridColor = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';

  // sales are newest first, reverse for chart (oldest to newest)
  const salesOldFirst = [...item.sales].reverse();

  // apply the selected time period filter
  const selectedPeriod = TIME_PERIODS.find(p => p.label === timePeriod);
  const filteredSales = filterByDays(salesOldFirst, selectedPeriod?.days ?? null);
  const { labels: chartLabels, prices: chartPrices } = groupByDate(filteredSales);

  // current listings for this item from the live api feed
  const currentListings = (activeListings || [])
    .filter(l => l.itemName.toLowerCase() === item.name.toLowerCase() && l.status === 'active')
    .sort((a, b) => a.price - b.price); // cheapest first

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Avg Sale Price',
        data: chartPrices,
        borderColor: rarityColor,
        backgroundColor: rarityColor + '20',
        tension: 0.3,
        fill: true,
        pointRadius: chartPrices.length <= 20 ? 4 : 2,
        pointHoverRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${formatPrice(ctx.raw)} coins`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: textColor, maxTicksLimit: 8, font: { size: 11 } },
        grid: { color: gridColor },
      },
      y: {
        ticks: { color: textColor, font: { size: 11 }, callback: (val) => formatPrice(val) },
        grid: { color: gridColor },
      },
    },
  };

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="modal-box">

        {/* header */}
        <div className="modal-header">
          <div className="modal-header-left">
            {item.imageUrl && (
              <img
                className="modal-item-img"
                src={item.imageUrl}
                alt={item.name}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <div>
              <h2 className="modal-title">{item.name}</h2>
              <span className="rarity-badge" style={{ color: rarityColor }}>{item.rarity}</span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* stats, only the 3 most useful ones */}
        <div className="modal-stats">
          <div className="stat-block">
            <span className="stat-label">Latest Sale</span>
            <span className="stat-value">{formatPrice(item.latestPrice)}</span>
          </div>
          <div className="stat-block">
            <span className="stat-label">Avg Last 3 Sold</span>
            <span className="stat-value">
              {avgLast3Ref ? formatPrice(avgLast3Ref) : '-'}
            </span>
          </div>
          <div className="stat-block">
            <span className="stat-label">Median Price</span>
            <span className="stat-value">{formatPrice(item.medianPrice)}</span>
          </div>
        </div>

        {/* low data warning */}
        {item.isLowData && (
          <div className="low-data-warning">
            <span className="low-data-warning-icon">!!</span>
            <span>
              low data:{' '}
              {item.volume < 5
                ? `only ${item.volume} total sale${item.volume === 1 ? '' : 's'} recorded`
                : `only ${item.recentSalesCount} sale${item.recentSalesCount === 1 ? '' : 's'} in the last 30 days`
              }. price estimates may not be accurate.
            </span>
          </div>
        )}

        {/* current active listings for this item */}
        <div className="modal-section">
          <h3 className="modal-section-title">
            Current Listings
            {currentListings.length > 0 && (
              <span className="modal-count">{currentListings.length}</span>
            )}
          </h3>
          {currentListings.length === 0 ? (
            <p className="chart-empty">no active listings found for this item right now</p>
          ) : (
            <div className="sales-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Per Item</th>
                    <th>Qty</th>
                    <th>Total Cost</th>
                    <th>vs Avg Last 3</th>
                    <th>Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {currentListings.map((listing, idx) => {
                    const ref = avgLast3Ref;
                    const diff = ref > 0
                      ? ((listing.price - ref) / ref) * 100
                      : null;
                    const isBelow = diff !== null && diff < 0;
                    const endDate = listing.endTime
                      ? new Date(listing.endTime).toLocaleDateString('en-GB')
                      : '-';
                    // totalCost is stored on the listing, fallback to price * qty
                    const totalCost = listing.totalCost || listing.price * listing.qty;
                    return (
                      <tr key={idx} className={isBelow ? 'highlight-row' : ''}>
                        <td className="price-cell">{formatPrice(listing.price)}</td>
                        <td className="volume-cell">{listing.qty > 1 ? `x${listing.qty}` : '1'}</td>
                        <td className="price-cell">
                          {listing.qty > 1 ? formatPrice(totalCost) : '-'}
                        </td>
                        <td style={{ color: isBelow ? '#4ade80' : '#f87171' }}>
                          {diff !== null
                            ? `${isBelow ? '' : '+'}${diff.toFixed(1)}%`
                            : '-'
                          }
                        </td>
                        <td className="volume-cell">{endDate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* price history chart with time period selector */}
        <div className="modal-section">
          <div className="modal-section-header">
            <h3 className="modal-section-title">Price History</h3>
            <div className="time-period-btns">
              {TIME_PERIODS.map(p => (
                <button
                  key={p.label}
                  className={`time-btn ${timePeriod === p.label ? 'time-btn-active' : ''}`}
                  onClick={() => setTimePeriod(p.label)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-container">
            {chartPrices.length >= 2 ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <p className="chart-empty">
                {filteredSales.length === 0
                  ? `no sales in the last ${selectedPeriod?.days} days`
                  : 'not enough data points for a chart'
                }
              </p>
            )}
          </div>
        </div>

        {/* recent sales table */}
        <div className="modal-section">
          <h3 className="modal-section-title">Recent Sales</h3>
          <div className="sales-scroll">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Price</th>
                  <th>vs Avg Last 3</th>
                </tr>
              </thead>
              <tbody>
                {item.sales.slice(0, 20).map((sale, idx) => {
                  const ref = avgLast3Ref;
                  const diff = ref > 0
                    ? ((sale.price - ref) / ref) * 100
                    : 0;
                  const isBelow = diff < 0;
                  return (
                    <tr key={idx}>
                      <td>{sale.dateStr}</td>
                      <td>{formatPrice(sale.price)}</td>
                      <td style={{ color: isBelow ? '#4ade80' : '#f87171' }}>
                        {isBelow ? '' : '+'}{diff.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
