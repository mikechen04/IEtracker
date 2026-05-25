import { useState, useRef, useEffect } from 'react';
import { formatPrice } from '../utils/dataUtils';

// form to add a new current listing
// itemNames is the list of known items from historical data (for autocomplete)
export default function AddListingForm({ itemNames, itemStats, onAdd }) {
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const suggestRef = useRef(null);

  // close suggestions when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (!suggestRef.current?.contains(e.target) && e.target !== inputRef.current) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleItemInput(val) {
    setItemName(val);
    if (val.length < 2) {
      setSuggestions([]);
      return;
    }
    const lower = val.toLowerCase();
    const matches = itemNames.filter(n => n.toLowerCase().includes(lower)).slice(0, 8);
    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  }

  function pickSuggestion(name) {
    setItemName(name);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const cleanName = itemName.trim();
    const cleanPrice = parseFloat(String(price).replace(/,/g, ''));
    const cleanQty = parseInt(qty) || 1;

    if (!cleanName || isNaN(cleanPrice) || cleanPrice <= 0) return;

    onAdd({
      id: Date.now().toString(), // simple unique id
      itemName: cleanName,
      price: cleanPrice,
      qty: cleanQty,
      addedAt: new Date().toISOString(),
      status: 'active',
    });

    // reset form
    setItemName('');
    setPrice('');
    setQty('1');
    inputRef.current?.focus();
  }

  // show a live preview of how this listing compares to median
  const matchedItem = itemStats ? itemStats.find(
    i => i.name.toLowerCase() === itemName.toLowerCase()
  ) : null;
  const listingPrice = parseFloat(String(price).replace(/,/g, ''));
  const previewPct = matchedItem && listingPrice > 0
    ? ((matchedItem.medianPrice - listingPrice) / matchedItem.medianPrice) * 100
    : null;

  return (
    <form className="add-listing-form" onSubmit={handleSubmit} autoComplete="off">
      {/* item name with autocomplete */}
      <div className="form-field autocomplete-wrap">
        <label className="form-label">Item name</label>
        <input
          ref={inputRef}
          type="text"
          className="form-input"
          placeholder="e.g. Bronze Weapon Core"
          value={itemName}
          onChange={e => handleItemInput(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        />
        {showSuggestions && (
          <ul className="autocomplete-list" ref={suggestRef}>
            {suggestions.map(s => (
              <li key={s} className="autocomplete-item" onMouseDown={() => pickSuggestion(s)}>
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* listing price */}
      <div className="form-field">
        <label className="form-label">Listing price</label>
        <input
          type="text"
          className="form-input"
          placeholder="e.g. 2500000"
          value={price}
          onChange={e => setPrice(e.target.value)}
        />
      </div>

      {/* quantity */}
      <div className="form-field form-field-sm">
        <label className="form-label">Qty</label>
        <input
          type="number"
          className="form-input"
          min={1}
          value={qty}
          onChange={e => setQty(e.target.value)}
        />
      </div>

      {/* live preview */}
      {matchedItem && listingPrice > 0 && (
        <div className="form-preview">
          <span className="preview-label">vs median {formatPrice(matchedItem.medianPrice)}</span>
          {previewPct !== null && (
            <span
              className="preview-pct"
              style={{ color: previewPct > 0 ? '#4ade80' : '#f87171' }}
            >
              {previewPct > 0 ? '-' : '+'}{Math.abs(previewPct).toFixed(1)}%
            </span>
          )}
        </div>
      )}
      {itemName.trim().length > 2 && !matchedItem && (
        <div className="form-preview">
          <span className="preview-label" style={{ color: 'var(--text-faint)' }}>
            no history for this item yet
          </span>
        </div>
      )}

      <button type="submit" className="add-btn">Add listing</button>
    </form>
  );
}
