export function configError(input: {
  where: string
  why: string
  fix: string
}): Error {
  const fix = input.fix.charAt(0).toUpperCase() + input.fix.slice(1)
  // a why ending in a list (a line break) takes no period
  const sep = input.why.endsWith('\n') ? '' : '. '
  return new Error(`[conness-gis] ${input.where}: ${input.why}${sep}${fix}`)
}
