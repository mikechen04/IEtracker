import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchSheetData, processData, mergeApiSales, enrichItemsWithApiMeta, getRefPrice, passesPriceRange, passesLowDataFilter, DEFAULT_CUSTOM_FILTERS } from './utils/dataUtils';
import { fetchActiveListings, fetchRecentSales, normalizeApiListing, normalizeApiSale } from './utils/apiClient';
import FlipperTable from './components/FlipperTable';
import ListingsView from './components/ListingsView';
import TopFlips from './components/TopFlips';
import ItemModal from './components/ItemModal';
import CustomFilterPanel from './components/CustomFilterPanel';

const AUTO_REFRESH_INTERVAL = 60 * 1000;

export default function App() {
  const [itemStats, setItemStats] = useState([]);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState(null);

  const [apiListings, setApiListings] = useState([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [lastApiRefresh, setLastApiRefresh] = useState(null);

  const [selectedItem, setSelectedItem] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState('top');
  const [threshold, setThreshold] = useState(10);
  const [customFilters, setCustomFilters] = useState(DEFAULT_CUSTOM_FILTERS);
  const [customFilterOpen, setCustomFilterOpen] = useState(false);

  const autoRefreshTimer = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const loadSheetData = useCallback(async () => {
    setSheetLoading(true);
    setSheetError(null);
    try {
      const raw = await fetchSheetData();
      const processed = processData(raw);
      setItemStats(processed);
    } catch (err) {
      console.error('sheet error:', err);
      setSheetError(err.message || 'failed to load sheet data');
    } finally {
      setSheetLoading(false);
    }
  }, []);

  const loadApiData = useCallback(async () => {
    setApiLoading(true);
    setApiError(null);
    try {
      const [activeRaw, soldRaw] = await Promise.all([
        fetchActiveListings(),
        fetchRecentSales(),
      ]);
      const normalized = activeRaw.map(normalizeApiListing);
      setApiListings(normalized);
      const recentSales = soldRaw.map(normalizeApiSale);
      setItemStats(prev => {
        let items = recentSales.length > 0 ? mergeApiSales(prev, recentSales) : prev;
        // sheet items only have names - pull category/png from listings + recent sales
        items = enrichItemsWithApiMeta(items, normalized, recentSales);
        return items;
      });
      setLastApiRefresh(new Date());
    } catch (err) {
      console.error('api error:', err);
      setApiError(
        (err.message || 'failed to connect to mcci api')
          .replace(/^mcci api error:\s*/i, '')
          .replace(/^graphql error:\s*/i, '')
      );
    } finally {
      setApiLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSheetData();
    loadApiData();
  }, [loadSheetData, loadApiData]);

  useEffect(() => {
    autoRefreshTimer.current = setInterval(loadApiData, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(autoRefreshTimer.current);
  }, [loadApiData]);

  // format timestamp in UTC
  function formatTime(date) {
    if (!date) return '';
    const h = String(date.getUTCHours()).padStart(2, '0');
    const m = String(date.getUTCMinutes()).padStart(2, '0');
    const s = String(date.getUTCSeconds()).padStart(2, '0');
    return `${h}:${m}:${s} UTC`;
  }

  function handleRefreshAll() {
    loadSheetData();
    loadApiData();
  }

  // count flip eligible for tab badge (matches top flips logic)
  const flipCount = apiListings.filter(l => {
    if (l.status !== 'active') return false;
    if (!passesPriceRange(l.price, customFilters)) return false;
    const stats = itemStats.find(i => i.name.toLowerCase() === l.itemName.toLowerCase());
    if (!stats || !passesLowDataFilter(stats, customFilters)) return false;
    const ref = getRefPrice(stats, customFilters);
    if (!ref) return false;
    const pctBelow = ((ref - l.price) / ref) * 100;
    const estProfit = ref - l.price;
    return pctBelow >= threshold && estProfit > 0;
  }).length;

  const isLoading = sheetLoading || apiLoading;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">meow</h1>
          <span className="app-subtitle">MCCI Island Exchange</span>
        </div>
        <div className="header-right">
          {lastApiRefresh && (
            <span className="last-updated">
              {formatTime(lastApiRefresh)}
            </span>
          )}
          <button
            className="refresh-btn"
            onClick={handleRefreshAll}
            disabled={isLoading}
            title="Refresh all data"
          >
            {isLoading ? '...' : '↻'}
          </button>
          <button
            className="theme-toggle"
            onClick={() => setDarkMode(d => !d)}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? '☀' : '☾'}
          </button>
        </div>
      </header>

      {/* tab bar + threshold */}
      <div className="tab-bar">
        <div className="tab-bar-left">
          <button
            className={`tab-btn ${activeTab === 'top' ? 'active' : ''}`}
            onClick={() => setActiveTab('top')}
          >
            Featured
            {flipCount > 0 && <span className="tab-badge">{flipCount}</span>}
          </button>
          <button
            className={`tab-btn ${activeTab === 'listings' ? 'active' : ''}`}
            onClick={() => setActiveTab('listings')}
          >
            Live Listings
          </button>
          <button
            className={`tab-btn ${activeTab === 'market' ? 'active' : ''}`}
            onClick={() => setActiveTab('market')}
          >
            Market Data
          </button>
          <button
            className={`tab-btn ${activeTab === 'credits' ? 'active' : ''}`}
            onClick={() => setActiveTab('credits')}
          >
            Credits
          </button>
        </div>
        <div className="tab-bar-right">
          <button
            className={`small-btn ${customFilterOpen ? 'active-btn' : ''}`}
            onClick={() => setCustomFilterOpen(o => !o)}
          >
            custom filter
          </button>
          <div className="threshold-control">
            <label className="control-label">
              profit % threshold
              <span className="control-value">{threshold}%</span>
            </label>
            <input
              type="range"
              min={1}
              max={60}
              value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              className="threshold-slider"
            />
          </div>
        </div>
      </div>

      <CustomFilterPanel
        open={customFilterOpen}
        filters={customFilters}
        onChange={setCustomFilters}
      />

      <main className="app-main">
        {apiError && (
          <div className="error-banner">
            <strong>MCCI API error:</strong> {apiError}
            <button className="retry-btn" onClick={loadApiData}>Retry</button>
          </div>
        )}
        {sheetError && (
          <div className="error-banner">
            <strong>Sheet data error:</strong> {sheetError}
            <br />
            <small>Price history may be limited. Make sure the Google Sheet is set to "Anyone with the link can view".</small>
            <button className="retry-btn" onClick={loadSheetData}>Retry</button>
          </div>
        )}

        {activeTab === 'top' && (
          <TopFlips
            listings={apiListings}
            itemStats={itemStats}
            threshold={threshold}
            customFilters={customFilters}
            onSelectItem={setSelectedItem}
          />
        )}

        {activeTab === 'listings' && (
          <ListingsView
            listings={apiListings}
            itemStats={itemStats}
            threshold={threshold}
            customFilters={customFilters}
            apiLoading={apiLoading}
            apiListingCount={apiListings.length}
            onSelectItem={setSelectedItem}
            onRefresh={loadApiData}
          />
        )}

        {activeTab === 'market' && (
          sheetLoading && itemStats.length === 0 ? (
            <div className="loading-state">loading market data...</div>
          ) : (
            <FlipperTable
              items={itemStats}
              threshold={threshold}
              customFilters={customFilters}
              onSelectItem={setSelectedItem}
            />
          )
        )}

        {activeTab === 'credits' && (
          <div className="credits-page">
            <h2 className="credits-title">Credits</h2>
            <div className="credits-grid">

              <div className="credits-card">
                <div className="credits-card-header">Island CDN</div>
                <p className="credits-card-desc">
                  all assets were grabbed from here
                </p>
                <div className="credits-links">
                  <a href="https://islandcdn.themysterys.com/" target="_blank" rel="noreferrer">CDN</a>
                  <a href="https://themysterys.com/projects/" target="_blank" rel="noreferrer">Projects page</a>
                </div>
              </div>

              <div className="credits-card">
                <div className="credits-card-header">MCCI Public API</div>
                <p className="credits-card-desc">
                  all api related things come from here
                </p>
                <div className="credits-links">
                  <a href="https://api.mccisland.net/docs" target="_blank" rel="noreferrer">API Docs</a>
                  <a href="https://gateway.noxcrew.com/" target="_blank" rel="noreferrer">Noxcrew Gateway</a>
                </div>
              </div>

              <div className="credits-card">
                <div className="credits-card-header">Price History</div>
                <p className="credits-card-desc">
                  random google sheet i dont know who to credit :(
                </p>
                <div className="credits-links">
                  <a href="https://docs.google.com/spreadsheets/d/1A1Vskm5Td0Vo0KGCGr4iBM5ajb_QVmJqCYUv3lMPskI/edit" target="_blank" rel="noreferrer">Google Sheet</a>
                </div>
              </div>

              <div className="credits-card">
                <div className="credits-card-header">Created by</div>
                <p className="credits-card-desc">
                  created by aheriez
                </p>
                <div className="credits-links">
                  <a href="https://github.com/mikechen04" target="_blank" rel="noreferrer">GitHub</a>
                </div>
              </div>

            </div>
          </div>
        )}
      </main>

      {selectedItem && (
        <ItemModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          darkMode={darkMode}
          activeListings={apiListings}
          customFilters={customFilters}
        />
      )}
    </div>
  );
}
