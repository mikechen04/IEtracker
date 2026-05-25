// small !! badge with a hover tooltip for low sales data warning
export default function LowDataBadge({ volume, recentSalesCount }) {
  let warningText = 'this item has low data';

  if (volume < 5) {
    warningText = `this item has low data - only ${volume} total sale${volume === 1 ? '' : 's'}`;
  } else if (recentSalesCount < 2) {
    warningText = `this item has low data - only ${recentSalesCount} sale${recentSalesCount === 1 ? '' : 's'} in the last 30 days`;
  }

  return (
    <span className="low-data-badge-wrap">
      <span className="low-data-badge">!!</span>
      <span className="low-data-tooltip">{warningText}</span>
    </span>
  );
}
