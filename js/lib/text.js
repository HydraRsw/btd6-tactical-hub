// Small text helpers shared by several tabs.

/** 12345 → "$12,345", -500 → "-$500" */
export function formatCash(amount) {
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${Math.round(Math.abs(amount)).toLocaleString('en-US')}`;
}

/** "Admiral Brickell" → "AB" */
export function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

/**
 * Scores how well `query` matches `text`. Higher is better, -1 means no match.
 * Exact substrings score highest; otherwise every query letter must appear in
 * order ("sun avtr" still finds "Sun Avatar"), with bonus points for runs.
 */
export function fuzzyScore(query, text) {
  const needle = query.toLowerCase().trim();
  const haystack = text.toLowerCase();
  if (!needle) return 0;

  const exactAt = haystack.indexOf(needle);
  if (exactAt !== -1) return 100 - exactAt + needle.length * 2;

  let matched = 0;
  let score = 0;
  let streak = 0;
  for (const letter of haystack) {
    if (matched === needle.length) break;
    if (letter === needle[matched]) {
      matched += 1;
      streak += 1;
      score += 1 + streak;
    } else {
      streak = 0;
    }
  }
  return matched === needle.length ? score : -1;
}

/** True when any of the given strings contains the query (or fuzzy-matches the first). */
export function matchesQuery(query, [primary, ...others]) {
  const needle = query.toLowerCase().trim();
  if (!needle) return true;
  const everything = [primary, ...others].join(' ').toLowerCase();
  return everything.includes(needle) || fuzzyScore(needle, primary) > 0;
}
