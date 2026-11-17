import { FetchSource, type RangeResponse, type Source } from 'pmtiles'

// the whole file once when the host ignores Range (Cloudflare Pages)
// shortcut: the whole file stays in memory, fine under the 25 MiB Pages cap
export class RangeOrWholeSource implements Source {
  private url: string
  private inner: FetchSource
  private ranges = false
  private whole: Promise<ArrayBuffer> | null = null
  private probe: Promise<unknown> | null = null

  constructor(url: string) {
    this.url = url
    this.inner = new FetchSource(url)
  }

  getKey(): string {
    return this.url
  }

  async getBytes(offset: number, length: number, signal?: AbortSignal, etag?: string): Promise<RangeResponse> {
    if (this.whole) return { data: (await this.whole).slice(offset, offset + length) }
    if (this.ranges) return this.inner.getBytes(offset, length, signal, etag)
    if (this.probe) {
      // parallel first reads share one request
      await this.probe.catch(() => {})
      return this.getBytes(offset, length, signal, etag)
    }
    const probe = this.first(offset, length, signal, etag)
    this.probe = probe
    try {
      return await probe
    } catch (err) {
      // a later read retries
      this.probe = null
      this.whole = null
      throw err
    }
  }

  // no caller signal, other reads wait on it
  // on a 200 its body is the whole file
  private async first(offset: number, length: number, signal?: AbortSignal, etag?: string): Promise<RangeResponse> {
    const res = await fetch(this.url, { headers: { range: `bytes=${offset}-${offset + length - 1}` } })
    if (res.status === 206) {
      this.ranges = true
      return { data: await res.arrayBuffer(), etag: res.headers.get('Etag') ?? undefined }
    }
    if (res.status === 200) {
      console.warn(`[conness-gis] ${this.url}: the server ignores HTTP Range requests, so the whole file was downloaded`)
      this.whole = res.arrayBuffer()
      return { data: (await this.whole).slice(offset, offset + length) }
    }
    // FetchSource knows the 416 retry
    if (res.status === 416) {
      this.ranges = true
      return this.inner.getBytes(offset, length, signal, etag)
    }
    throw new Error(`Bad response code: ${res.status}`)
  }
}
