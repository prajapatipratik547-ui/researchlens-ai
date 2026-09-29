// Confidence bands from the integration guide: 0-39 Low, 40-69 Medium, 70-100 High.
export function confidenceLevel(score) {
  if (score >= 70) {
    return { label: 'High', bar: 'bg-emerald-500', text: 'text-emerald-700', pill: 'bg-emerald-50 text-emerald-800 ring-emerald-200' };
  }
  if (score >= 40) {
    return { label: 'Medium', bar: 'bg-amber-500', text: 'text-amber-700', pill: 'bg-amber-50 text-amber-800 ring-amber-200' };
  }
  return { label: 'Low', bar: 'bg-rose-500', text: 'text-rose-700', pill: 'bg-rose-50 text-rose-700 ring-rose-200' };
}
