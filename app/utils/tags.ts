export function normalizeTagName(value: string) {
  return value.trim().replace(/^#+/, "").trim()
}

export function mergeTagNames(...groups: string[][]) {
  const tags = new Map<string, string>()

  groups.flat().forEach((value) => {
    const tag = normalizeTagName(value)
    if (tag && !tags.has(tag.toLocaleLowerCase())) tags.set(tag.toLocaleLowerCase(), tag)
  })

  return Array.from(tags.values())
}
