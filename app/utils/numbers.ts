export function roundToTwoDecimals(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function formatDisplayNumber(value: number, useGrouping = true) {
  if (!Number.isFinite(value)) return "0"

  return roundToTwoDecimals(value).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
    useGrouping,
  })
}
