// HACCP temperature norms for delivery categories — shared between the
// delivery list, the new-delivery wizard, and the edit modal.

export const CHILLED_TEMP_MAX: Record<string, number> = {
  mieso: 7,
  drob: 4,
  ryby: 4,
  wedliny: 7,
  nabiał: 8,
  gotowe: 4,
}

export const FROZEN_TEMP_MAX = -18

export function chilledMaxAllowed(categoryIds: string[]): number | null {
  const relevant = categoryIds.filter(c => CHILLED_TEMP_MAX[c] !== undefined)
  if (relevant.length === 0) return null
  return Math.max(...relevant.map(c => CHILLED_TEMP_MAX[c]))
}

export function isChilledTempOk(temp: number, categoryIds: string[]): boolean {
  const maxAllowed = chilledMaxAllowed(categoryIds)
  if (maxAllowed === null) return true
  return temp >= 0 && temp <= maxAllowed
}

export function isFrozenTempOk(temp: number): boolean {
  return temp <= FROZEN_TEMP_MAX
}
