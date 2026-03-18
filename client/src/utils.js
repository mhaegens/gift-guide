export const AVATAR_COLORS = ['#d97706', '#e11d48', '#7c3aed', '#0d9488', '#0284c7', '#16a34a']

export function avatarColor(userId) {
  return AVATAR_COLORS[(userId - 1) % AVATAR_COLORS.length]
}

export function avatarInitial(name) {
  return name ? name[0].toUpperCase() : '?'
}

export const PRICE_LABELS = {
  free: 'Free',
  '0_20': '€0–20',
  '20_50': '€20–50',
  '50_100': '€50–100',
  '100_plus': '€100+',
}

export const PRICE_CHIPS = [
  { value: 'all', label: 'All' },
  { value: 'free', label: 'Free' },
  { value: '0_20', label: '€0–20' },
  { value: '20_50', label: '€20–50' },
  { value: '50_100', label: '€50–100' },
  { value: '100_plus', label: '€100+' },
]

export function priceLabel(cat) {
  return PRICE_LABELS[cat] || cat
}

export function priceBadgeClass(cat) {
  const map = {
    free: 'badge-emerald',
    '0_20': 'badge-amber',
    '20_50': 'badge-amber',
    '50_100': 'badge-rose',
    '100_plus': 'badge-rose',
  }
  return map[cat] || 'badge-stone'
}
