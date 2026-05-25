// graphql client for the mcci island api
// docs: https://api.mccisland.net/docs
// endpoint goes through the vite proxy (/mcci-api) to avoid cors issues

// dev = vite proxy; prod = optional cloudflare worker (see workers/README.md)
function getApiEndpoint() {
  if (import.meta.env.DEV) {
    return {
      url: '/mcci-api/graphql',
      apiKey: import.meta.env.VITE_MCCI_API_KEY,
    };
  }

  const proxyUrl = import.meta.env.VITE_MCCI_PROXY_URL;
  if (proxyUrl) {
    // worker holds the key in MCCI_API_KEY secret
    return { url: proxyUrl.replace(/\/$/, ''), apiKey: null };
  }

  // direct call, usually blocked by cors on github.io
  return {
    url: 'https://api.mccisland.net/graphql',
    apiKey: import.meta.env.VITE_MCCI_API_KEY,
  };
}

// basic graphql fetch helper
async function gqlFetch(query) {
  const { url, apiKey } = getApiEndpoint();
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'ie-flipper/1.0 (personal tool)',
  };
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
    });
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.includes('NetworkError') || msg.includes('Failed to fetch')) {
      throw new Error(
        'Live API blocked by browser CORS. Deploy the Cloudflare proxy in workers/README.md, add VITE_MCCI_PROXY_URL to GitHub Actions secrets, then redeploy.'
      );
    }
    throw err;
  }

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }

  const json = await res.json();

  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0].message);
  }

  return json.data;
}

// the asset fragment we use on all listing queries
// category = HAT/SWORD/AXE etc (maps to cdn top-level folder)
// collection = legacy/standard_game/limited_weapon etc (maps to cdn subfolder)
const ASSET_FRAGMENT = `
  asset {
    name
    rarity
    uniqueIdentifier
    ... on CosmeticToken {
      weaponSkinData {
        tier
      }
      cosmetic {
        name
        category
        collection
      }
    }
    ... on Cosmetic {
      category
      collection
    }
  }
`;

// using stats.derniklaas.de/islandcdn as it has better coverage than islandcdn.themysterys.com
// (some items like blossom blade are missing from the original cdn)
const CDN = 'https://stats.derniklaas.de/islandcdn';

// build the cdn image url for an asset
// CosmeticToken/Cosmetic: CDN/cosmetics/{category}/{collection}/{Name}.png
// generic assets (style shards, chroma sets, etc): matched by name pattern
export function getItemImageUrl(asset) {
  if (!asset) return null;

  // for CosmeticToken, details are nested under .cosmetic
  // for plain Cosmetic, they sit directly on asset
  const category = asset.cosmetic?.category || asset.category || null;
  const collection = asset.cosmetic?.collection || asset.collection || null;

  // prefer the nested cosmetic name (always tier-agnostic, e.g. "Knightly Blade")
  // if it's missing, strip " Token" and "- Tier X" from the asset name as a fallback
  // so T1/T2/T3 listings still resolve to the same T0 image on the cdn
  let cosmeticName = asset.cosmetic?.name || null;
  if (!cosmeticName && asset.name) {
    cosmeticName = asset.name
      .replace(/\s*-\s*Tier\s*\d+/i, '')  // strip "- Tier 0"
      .replace(/\s+Token\b/i, '')          // strip " Token"
      .trim();
  }

  if (!cosmeticName) return null;

  const nameLower = cosmeticName.toLowerCase();
  // lowercase + underscores, no apostrophes (for icon paths like deaths_chest)
  const nameUnder = nameLower.replace(/ /g, '_').replace(/'/g, '');

  // ---- name-based fallbacks for GenericAsset items ----

  // weapon cores → icons/core/weapon_*.png
  if (nameLower.includes('weapon core')) {
    if (nameLower.includes('bronze')) return `${CDN}/icons/core/weapon_bronze.png`;
    if (nameLower.includes('silver')) return `${CDN}/icons/core/weapon_silver.png`;
    if (nameLower.includes('golden')) return `${CDN}/icons/core/weapon_golden.png`;
  }

  // collector cosmetic core
  if (nameLower.includes('collector cosmetic core')) {
    return `${CDN}/icons/core/collector.png`;
  }

  // elimination effects → cosmetics/elimination_effect/{name_without_suffix}.png
  if (nameLower.endsWith(' elimination effect')) {
    const base = nameUnder.replace(/_elimination_effect$/, '');
    return `${CDN}/cosmetics/elimination_effect/${base}.png`;
  }

  // chroma sets → cosmetics/chroma_set/{name_without_chroma_set}.png
  if (nameLower.endsWith(' chroma set')) {
    const base = nameUnder.replace(/_chroma_set$/, '');
    return `${CDN}/cosmetics/chroma_set/${base}.png`;
  }

  // style shards → icons/material/{full_name}.webp (these stay as .webp on the cdn)
  if (nameLower.endsWith(' style shard')) {
    return `${CDN}/icons/material/${nameUnder}.webp`;
  }

  // style soul
  if (nameLower === 'style soul') {
    return `${CDN}/icons/material/style_soul.png`;
  }

  // mcc+ token
  if (nameLower.includes('mcc+')) {
    return `${CDN}/icons/misc/mcc_plus.png`;
  }

  // cosmetic crates → icons/openable/ (name varies a lot on cdn)
  if (nameLower.includes('cosmetic crate') || nameLower.includes('limited cosmetic crate')) {
    const crateKey = nameUnder
      .replace(/_cosmetic_crate/g, '')
      .replace(/_limited_cosmetic_crate/g, '')
      .replace(/_/g, '_');
    // try a few common path shapes
    const guesses = [
      `${CDN}/icons/openable/crate_${crateKey}.png`,
      `${CDN}/icons/openable/crate_cosmetic_${crateKey}.png`,
    ];
    return guesses[0];
  }

  // ---- CosmeticToken / Cosmetic with full category + collection ----
  // filename keeps original capitalization + apostrophes, just spaces -> underscores
  if (category && collection) {
    const catPath = category.toLowerCase();
    const colPath = collection.toLowerCase().replace(/ /g, '_');
    const fileName = cosmeticName.replace(/ /g, '_');
    return `${CDN}/cosmetics/${catPath}/${colPath}/${fileName}.png`;
  }

  return null;
}

// strip tier/token suffix so "Apex Axe Token - Tier 2" -> "Apex Axe"
export function getBaseCosmeticName(name) {
  if (!name) return '';
  return name
    .replace(/\s*-\s*Tier\s*\d+/i, '')
    .replace(/\s+Token\b/i, '')
    .trim();
}

// get image url for a market data item (uses stored url or builds from name/category)
export function resolveItemImageUrl(item) {
  if (!item) return null;
  if (item.imageUrl) return item.imageUrl;

  const cosmeticName = item.cosmeticName || getBaseCosmeticName(item.name);

  // name-only patterns (elimination effects, shards, etc)
  const direct = getItemImageUrl({ name: item.name });
  if (direct) return direct;

  // need real category + collection from api (sheet data doesn't have these)
  if (!item.category || !item.cosmeticType) return null;

  return getItemImageUrl({
    name: item.name,
    category: item.category,
    collection: item.cosmeticType,
    cosmetic: {
      name: cosmeticName,
      category: item.category,
      collection: item.cosmeticType,
    },
  });
}

// build the full display name for an asset
// if it's a weapon skin token, append the tier so it matches sheet data like "Apex Axe Token - Tier 2"
function buildAssetName(asset) {
  if (!asset) return 'Unknown';
  const tier = asset.weaponSkinData?.tier;
  // tier 0 is still a valid tier (base level), so check for null/undefined specifically
  if (tier !== null && tier !== undefined) {
    return `${asset.name} - Tier ${tier}`;
  }
  return asset.name;
}

// fetch all currently active island exchange listings
// note: listings have an anti-sniping delay before appearing here
export async function fetchActiveListings() {
  const data = await gqlFetch(`
    query {
      activeIslandExchangeListings {
        identifier
        cost
        amount
        creationTime
        endTime
        ${ASSET_FRAGMENT}
      }
    }
  `);

  return data.activeIslandExchangeListings || [];
}

// fetch all ie sales from the last 24 hours
export async function fetchRecentSales() {
  const data = await gqlFetch(`
    query {
      soldIslandExchangeListings {
        identifier
        cost
        amount
        creationTime
        endTime
        ${ASSET_FRAGMENT}
      }
    }
  `);

  return data.soldIslandExchangeListings || [];
}

// pull the cosmetic category (HAT, SWORD, etc) from an asset
function getCategory(asset) {
  if (!asset) return null;
  // CosmeticToken has category nested inside .cosmetic
  if (asset.cosmetic?.category) return asset.cosmetic.category;
  // plain Cosmetic has it directly
  if (asset.category) return asset.category;
  return null;
}

// pull the collection string (legacy, standard_game, etc) from an asset
function getCosmeticType(asset) {
  if (!asset) return null;
  if (asset.cosmetic?.collection) return asset.cosmetic.collection;
  if (asset.collection) return asset.collection;
  return null;
}

// convert raw api listing to a normalized object
export function normalizeApiListing(raw) {
  const qty = raw.amount || 1;
  // cost is total for the listing, divide to get per-item price
  const pricePerItem = Math.round((raw.cost || 0) / qty);
  return {
    id: raw.identifier,
    itemName: buildAssetName(raw.asset),
    // the actual cosmetic name (no "Token" or tier suffix) used for cdn urls
    cosmeticName: raw.asset?.cosmetic?.name || raw.asset?.name || '',
    rarity: raw.asset?.rarity || '',
    uniqueId: raw.asset?.uniqueIdentifier || '',
    tier: raw.asset?.weaponSkinData?.tier ?? null,
    category: getCategory(raw.asset),
    cosmeticType: getCosmeticType(raw.asset),
    imageUrl: getItemImageUrl(raw.asset),
    price: pricePerItem,
    totalCost: raw.cost || 0,
    qty: qty,
    creationTime: raw.creationTime,
    endTime: raw.endTime,
    source: 'api',
    status: 'active',
    addedAt: new Date().toISOString(),
  };
}

// convert raw api sale to a normalized sale object (for price history)
export function normalizeApiSale(raw) {
  const qty = raw.amount || 1;
  // same deal, normalize to per-item price so medians match
  const pricePerItem = Math.round((raw.cost || 0) / qty);
  return {
    itemName: buildAssetName(raw.asset),
    cosmeticName: raw.asset?.cosmetic?.name || raw.asset?.name || '',
    rarity: raw.asset?.rarity || '',
    tier: raw.asset?.weaponSkinData?.tier ?? null,
    category: getCategory(raw.asset),
    cosmeticType: getCosmeticType(raw.asset),
    imageUrl: getItemImageUrl(raw.asset),
    price: pricePerItem,
    qty: qty,
    dateStr: raw.endTime ? new Date(raw.endTime).toLocaleDateString('en-GB') : '',
    date: raw.endTime ? new Date(raw.endTime) : null,
    source: 'api',
  };
}
