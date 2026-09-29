// VULNERABLE (M2 prototype pollution): recurses into __proto__ / constructor.
export function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  for (const key of Object.keys(source)) {
    const sv = source[key]
    if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      target[key] = deepMerge((target[key] as any) ?? {}, sv as Record<string, unknown>)
    } else {
      target[key] = sv
    }
  }
  return target
}
