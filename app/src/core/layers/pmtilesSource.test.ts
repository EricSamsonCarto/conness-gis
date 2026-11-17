import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RangeOrWholeSource } from './pmtilesSource.ts'

const FILE = Uint8Array.from({ length: 100 }, (_, i) => i)

// a fake host: honors Range (206) or sends the whole file (200)
function stubFetch(honorsRange: boolean) {
  const calls: (string | null)[] = []
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    const range = new Headers(init?.headers).get('range')
    calls.push(range)
    const m = range?.match(/bytes=(\d+)-(\d+)/)
    if (honorsRange && m) {
      const body = FILE.slice(+m[1], +m[2] + 1)
      return new Response(body, { status: 206, headers: { 'Content-Length': String(body.length) } })
    }
    return new Response(FILE, { status: 200, headers: { 'Content-Length': String(FILE.length) } })
  }) as typeof fetch
  return calls
}

const bytes = (r: { data: ArrayBuffer }) => [...new Uint8Array(r.data)]

test('a host that honors Range: partial reads only', async () => {
  const calls = stubFetch(true)
  const source = new RangeOrWholeSource('https://x/a.pmtiles')
  assert.deepEqual(bytes(await source.getBytes(10, 3)), [10, 11, 12])
  assert.deepEqual(bytes(await source.getBytes(50, 2)), [50, 51])
  assert.deepEqual(calls, ['bytes=10-12', 'bytes=50-51'])
})

test('a host that ignores Range: the whole file once, then slices', async () => {
  const calls = stubFetch(false)
  const warn = console.warn
  console.warn = () => {}
  try {
    const source = new RangeOrWholeSource('https://x/b.pmtiles')
    const [a, b] = await Promise.all([source.getBytes(10, 3), source.getBytes(97, 3)])
    assert.deepEqual(bytes(a), [10, 11, 12])
    assert.deepEqual(bytes(b), [97, 98, 99])
    assert.deepEqual(bytes(await source.getBytes(0, 2)), [0, 1])
    // one request in all, its 200 body is the whole file
    assert.equal(calls.length, 1)
  } finally {
    console.warn = warn
  }
})

test('a failed first read retries on the next one', async () => {
  const calls = stubFetch(true)
  const ok = globalThis.fetch
  let failed = false
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (!failed) {
      failed = true
      return new Response(null, { status: 500 })
    }
    return ok(url, init)
  }) as typeof fetch
  const source = new RangeOrWholeSource('https://x/c.pmtiles')
  await assert.rejects(source.getBytes(10, 3), /500/)
  assert.deepEqual(bytes(await source.getBytes(10, 3)), [10, 11, 12])
  assert.deepEqual(calls, ['bytes=10-12'])
})
