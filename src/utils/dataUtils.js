import Papa from 'papaparse';
import { resolveItemImageUrl, getBaseCosmeticName } from './apiClient';

const SHEET_ID = '1A1Vskm5Td0Vo0KGCGr4iBM5ajb_QVmJqCYUv3lMPskI';
const GID = '216023178';

// fetch csv data from the public google sheet
export async function fetchSheetData() {
  // gviz endpoint works in browser without cors issues (sheet must be public/view-only)
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to fetch sheet: ${response.status}`);
  }
  const text = await response.text();

  // parse the csv - first row is headers
  const result = Papa.parse(text, {
    header: false,
    skipEmptyLines: true,
  });

  return result.data;
}

// clean up a price string like "2,500,000" or "2500000" into a number
function parsePrice(str) {
  if (!str) return null;
  // remove commas, quotes, and whitespace
  const cleaned = String(str).replace(/[,"\s]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// parse "20/05/2026" into a proper Date object
function parseDate(str) {
  if (!str) return null;
  const cleaned = String(str).replace(/"/g, '').trim();
  const parts = cleaned.split('/');
  if (parts.length !== 3) return null;
  // format is DD/MM/YYYY
  return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
}

// get the median of a number array
function getMedian(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

// get the average of a number array
function getAverage(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

// simple avg of the 3 most recent sales (no filtering)
function getRawAvgLast3(salesNewestFirst) {
  const last3 = salesNewestFirst.slice(0, 3);
  return last3.length > 0 ? getAverage(last3.map(s => s.price)) : 0;
}

// slider max for min/max price filters - at max means no upper cap
export const PRICE_SLIDER_MAX = 30000000;
export const PRICE_SLIDER_STEP = 100000;

export const DEFAULT_CUSTOM_FILTERS = {
  filterOutliers: true,
  outlierPercent: 50,
  minPrice: 0,
  maxPrice: PRICE_SLIDER_MAX,
  hideLowData: true,
};

// avg of last 3 sales, optionally skipping outlier prices in recent history
export function calcFilteredAvgLast3(salesNewestFirst, customFilters) {
  if (!salesNewestFirst || salesNewestFirst.length === 0) return 0;

  const filters = customFilters || DEFAULT_CUSTOM_FILTERS;

  // always work from the newest sales first (not the whole history)
  const recentWindow = salesNewestFirst.slice(0, 10);

  if (!filters.filterOutliers || filters.outlierPercent <= 0 || recentWindow.length < 2) {
    return getRawAvgLast3(salesNewestFirst);
  }

  // use median of recent sales only so old spikes don't skew the filter
  const median = getMedian(recentWindow.map(s => s.price));
  if (median <= 0) return getRawAvgLast3(salesNewestFirst);

  const pct = filters.outlierPercent / 100;
  const upper = median * (1 + pct);
  const lower = median * (1 - pct);

  let pool = recentWindow.filter(s => s.price >= lower && s.price <= upper);
  if (pool.length === 0) pool = recentWindow;

  const last3 = pool.slice(0, 3);
  return last3.length > 0 ? getAverage(last3.map(s => s.price)) : 0;
}

// check if a listing price fits the min/max slider range
export function passesPriceRange(price, customFilters) {
  if (price == null) return false;
  const filters = customFilters || DEFAULT_CUSTOM_FILTERS;
  if (filters.minPrice > 0 && price < filters.minPrice) return false;
  if (filters.maxPrice < PRICE_SLIDER_MAX && price > filters.maxPrice) return false;
  return true;
}

// hide items flagged as low data when the setting is on
export function passesLowDataFilter(stats, customFilters) {
  const filters = customFilters || DEFAULT_CUSTOM_FILTERS;
  if (!filters.hideLowData) return true;
  if (!stats) return true;
  return !stats.isLowData;
}

// takes the raw 2d array from papaparse and builds processed item stats
export function processData(rawRows) {
  if (!rawRows || rawRows.length < 2) return [];

  // figure out which row is headers (look for "Date" or "Item")
  // row 0 might be headers, might be data
  let startRow = 1; // default: row 0 is headers
  const firstRow = rawRows[0];

  // check if first row looks like headers
  const isHeaderRow = firstRow.some(cell =>
    String(cell).toLowerCase().includes('date') ||
    String(cell).toLowerCase().includes('item')
  );
  if (!isHeaderRow) {
    startRow = 0; // no headers, start from row 0
  }

  // based on the sheet structure we know:
  // col 0: row index, col 1: date, col 2: item, col 3: rarity, col 4: amount, col 5: (empty), col 6: cost
  // but let's try to detect the columns from the header row
  let colDate = 1, colItem = 2, colRarity = 3, colAmount = 4, colCost = 6;

  if (isHeaderRow) {
    firstRow.forEach((cell, i) => {
      const c = String(cell).toLowerCase().replace(/"/g, '').trim();
      if (c === 'date') colDate = i;
      if (c === 'item') colItem = i;
      if (c === 'rarity') colRarity = i;
      if (c === 'amount') colAmount = i;
      if (c === 'cost') colCost = i;
    });
  }

  // group all sales by item name
  const grouped = {};

  for (let i = startRow; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length < colCost + 1) continue;

    const dateStr = String(row[colDate] || '').replace(/"/g, '').trim();
    const itemName = String(row[colItem] || '').replace(/"/g, '').trim();
    const rarity = String(row[colRarity] || '').replace(/"/g, '').trim();
    const costRaw = String(row[colCost] || '').replace(/"/g, '').trim();
    const amountRaw = String(row[colAmount] || '').replace(/"/g, '').trim();

    if (!itemName || !costRaw) continue;

    const totalCost = parsePrice(costRaw);
    if (totalCost === null || totalCost < 1000) continue;

    // normalize to per-item price, sheet records total cost for the whole listing
    const qty = parseInt(amountRaw) || 1;
    const price = Math.round(totalCost / qty);

    // skip very low per-item prices (likely junk/test entries)
    if (price < 10000) continue;

    const parsedDate = parseDate(dateStr);

    if (!grouped[itemName]) {
      grouped[itemName] = {
        name: itemName,
        rarity: rarity,
        sales: [],
      };
    }

    grouped[itemName].sales.push({
      date: parsedDate,
      dateStr: dateStr,
      price: price,
    });
  }

  // now calculate stats per item and build the final list
  const items = [];

  for (const data of Object.values(grouped)) {
    // sort newest first
    data.sales.sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return b.date - a.date;
    });

    const prices = data.sales.map(s => s.price);
    const medianPrice = getMedian(prices);
    const avgPrice = getAverage(prices);
    const latestPrice = data.sales[0]?.price || 0;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    const avgLast3 = getRawAvgLast3(data.sales);

    // how many sales happened in the last 30 days
    const cutoff30d = new Date();
    cutoff30d.setDate(cutoff30d.getDate() - 30);
    const recentSalesCount = data.sales.filter(s => s.date && s.date >= cutoff30d).length;

    // flag items with not enough data to trust the price estimate
    const isLowData = data.sales.length < 5 || recentSalesCount < 2;

    // how far below median is the latest sale, as a percentage
    const pctBelowMedian = medianPrice > 0
      ? ((medianPrice - latestPrice) / medianPrice) * 100
      : 0;

    // estimated profit based on avg of last 3 (more current than median)
    const estProfit = avgLast3 > 0 ? avgLast3 - latestPrice : medianPrice - latestPrice;

    items.push({
      name: data.name,
      rarity: data.rarity,
      category: data.category || null,
      cosmeticType: data.cosmeticType || null,
      sales: data.sales,
      medianPrice,
      avgPrice,
      avgLast3,
      latestPrice,
      minPrice,
      recentSalesCount,
      isLowData,
      maxPrice,
      volume: data.sales.length,
      pctBelowMedian,
      estProfit,
    });
  }

  // sort by most discounted first
  items.sort((a, b) => b.pctBelowMedian - a.pctBelowMedian);

  return items;
}

// merge recent api sales into already-processed item stats
// this adds any api sales to the existing sales array and recalculates stats
export function mergeApiSales(processedItems, apiSales) {
  if (!apiSales || apiSales.length === 0) return processedItems;

  // group api sales by item name
  const apiByItem = {};
  for (const sale of apiSales) {
    const name = sale.itemName;
    if (!apiByItem[name]) apiByItem[name] = [];
    apiByItem[name].push(sale);
  }

  // update each item with fresh api sales
  const updated = processedItems.map(item => {
    const fresh = apiByItem[item.name];
    if (!fresh || fresh.length === 0) return item;

    // combine old sales with new api sales, deduplicate by dateStr+price (rough check)
    const existingKeys = new Set(item.sales.map(s => `${s.dateStr}-${s.price}`));
    const newSales = fresh.filter(s => !existingKeys.has(`${s.dateStr}-${s.price}`));

    if (newSales.length === 0) return item;

    const allSales = [...newSales, ...item.sales];
    // resort newest first
    allSales.sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return b.date - a.date;
    });

    const prices = allSales.map(s => s.price);
    const medianPrice = getMedian(prices);
    const avgPrice = getAverage(prices);
    const latestPrice = allSales[0]?.price || 0;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgLast3 = getRawAvgLast3(allSales);
    const pctBelowMedian = medianPrice > 0
      ? ((medianPrice - latestPrice) / medianPrice) * 100
      : 0;

    const cutoff30d = new Date();
    cutoff30d.setDate(cutoff30d.getDate() - 30);
    const recentSalesCount = allSales.filter(s => s.date && s.date >= cutoff30d).length;
    const isLowData = allSales.length < 5 || recentSalesCount < 2;

    // pick up category/imageUrl from fresh api sales if we didn't have it from the sheet
    const category = item.category || fresh[0]?.category || null;
    const cosmeticType = item.cosmeticType || fresh[0]?.cosmeticType || null;
    const merged = {
      ...item,
      category,
      cosmeticType,
      cosmeticName: item.cosmeticName || fresh[0]?.cosmeticName || null,
      imageUrl: item.imageUrl || fresh[0]?.imageUrl || null,
    };
    const imageUrl = resolveItemImageUrl(merged);

    return {
      ...merged,
      imageUrl,
      sales: allSales,
      medianPrice,
      avgPrice,
      avgLast3,
      latestPrice,
      minPrice,
      maxPrice,
      volume: allSales.length,
      recentSalesCount,
      isLowData,
      pctBelowMedian,
      estProfit: avgLast3 > 0 ? avgLast3 - latestPrice : medianPrice - latestPrice,
    };
  });

  // also add any items that are in api sales but not in the sheet data at all
  const existingNames = new Set(processedItems.map(i => i.name));
  for (const [name, sales] of Object.entries(apiByItem)) {
    if (existingNames.has(name)) continue;
    const prices = sales.map(s => s.price);
    const medianPrice = getMedian(prices);
    const avgPrice = getAverage(prices);
    const latestPrice = sales[0]?.price || 0;
    const avgLast3 = getRawAvgLast3(sales);
    const newItem = {
      name,
      rarity: sales[0]?.rarity || '',
      category: sales[0]?.category || null,
      cosmeticType: sales[0]?.cosmeticType || null,
      cosmeticName: sales[0]?.cosmeticName || null,
      imageUrl: sales[0]?.imageUrl || null,
      sales,
      medianPrice,
      avgPrice,
      avgLast3,
      latestPrice,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      volume: sales.length,
      pctBelowMedian: 0,
      estProfit: avgLast3 > 0 ? avgLast3 - latestPrice : 0,
    };
    updated.push({
      ...newItem,
      imageUrl: resolveItemImageUrl(newItem),
    });
  }

  return updated;
}

// add api listing/sale metadata into lookup maps
function addToMetaMap(byName, entry) {
  if (!entry) return;

  const imageUrl = entry.imageUrl || null;
  const category = entry.category || null;
  const cosmeticType = entry.cosmeticType || null;
  const cosmeticName = entry.cosmeticName || null;
  const itemName = entry.itemName || entry.name || null;

  if (!itemName && !cosmeticName) return;

  const meta = { imageUrl, category, cosmeticType, cosmeticName };

  if (itemName) {
    byName[itemName.toLowerCase()] = meta;
    const base = getBaseCosmeticName(itemName).toLowerCase();
    if (!byName[base]) byName[base] = meta;
  }

  if (cosmeticName) {
    byName[cosmeticName.toLowerCase()] = meta;
  }
}

// share category/image info across tiers (T0, T1, T2 all use same cosmetic png)
function propagateCosmeticMeta(items) {
  const byBase = {};

  for (const item of items) {
    const base = getBaseCosmeticName(item.name).toLowerCase();
    if (!base) continue;

    if (item.category || item.imageUrl) {
      const existing = byBase[base];
      if (!existing || (item.imageUrl && !existing.imageUrl)) {
        byBase[base] = {
          category: item.category || existing?.category || null,
          cosmeticType: item.cosmeticType || existing?.cosmeticType || null,
          cosmeticName: item.cosmeticName || getBaseCosmeticName(item.name),
          imageUrl: item.imageUrl || existing?.imageUrl || null,
        };
      }
    }
  }

  return items.map(item => {
    const base = getBaseCosmeticName(item.name).toLowerCase();
    const shared = byBase[base];
    if (!shared) return item;

    const merged = {
      ...item,
      category: item.category || shared.category,
      cosmeticType: item.cosmeticType || shared.cosmeticType,
      cosmeticName: item.cosmeticName || shared.cosmeticName,
      imageUrl: item.imageUrl || shared.imageUrl,
    };

    return { ...merged, imageUrl: resolveItemImageUrl(merged) || merged.imageUrl };
  });
}

// fill in images + category from api listings and recent sales (for market data tab)
export function enrichItemsWithApiMeta(items, listings = [], sales = []) {
  if (!items || items.length === 0) return items;

  const byName = {};

  for (const l of listings) addToMetaMap(byName, l);
  for (const s of sales) addToMetaMap(byName, { ...s, itemName: s.itemName });

  let enriched = items.map(item => {
    const key = item.name.toLowerCase();
    const base = getBaseCosmeticName(item.name).toLowerCase();
    const meta = byName[key] || byName[base] || null;

    const merged = {
      ...item,
      category: item.category || meta?.category || null,
      cosmeticType: item.cosmeticType || meta?.cosmeticType || null,
      cosmeticName: item.cosmeticName || meta?.cosmeticName || null,
      imageUrl: item.imageUrl || meta?.imageUrl || null,
    };

    return { ...merged, imageUrl: resolveItemImageUrl(merged) || merged.imageUrl };
  });

  return propagateCosmeticMeta(enriched);
}

// format a number as a price string like "2,500,000"
export function formatPrice(num) {
  if (!num && num !== 0) return '-';
  return Math.round(num).toLocaleString();
}

// pick the reference price used for flip calculations
export function getRefPrice(stats, customFilters) {
  if (!stats) return null;

  if (stats.sales && stats.sales.length > 0) {
    const avg = calcFilteredAvgLast3(stats.sales, customFilters);
    if (avg > 0) return avg;
  }

  return stats.medianPrice || stats.avgLast3 || null;
}
