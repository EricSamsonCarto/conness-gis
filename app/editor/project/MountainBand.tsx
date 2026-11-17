import type { ReactNode } from 'react'

// the docs homepage's mountain, keep the paths in sync with home.html
const FAR_RANGE = 'M0 120 L90 96 L180 104 L260 78 L340 92 L430 70 L520 88 L600 80 L700 96 L800 84 L900 98 L1000 92 L1080 74 L1150 96 L1200 88 L1200 200 L0 200 Z'
const NEAR_RANGE = 'M0 140 L110 118 L200 128 L300 104 L380 116 L470 96 L560 110 L660 100 L760 112 L870 104 L980 112 L1060 98 L1130 120 L1200 112 L1200 200 L0 200 Z'
const MOUNTAIN = 'M0 177.6 L120 163.2 L240 170.4 L330 141.6 L420 148.8 L520 109.2 L600 116.4 L680 76.8 L740 69.6 L790 30 L820 12 L838 22.8 L870 51.6 L900 44.4 L940 91.2 L1010 123.6 L1080 116.4 L1140 152.4 L1200 166.8 L1200 200 L0 200 Z'
// lit from the northwest, so the east faces are in shade
const SHADE = [
  'M820 12 L838 22.8 L870 51.6 L900 44.4 L940 91.2 L1010 123.6 L975 200 L905 200 L880 150 L852 96 L834 50 Z',
  'M520 109.2 L600 116.4 L612 200 L566 200 L548 156 Z',
  'M1080 116.4 L1140 152.4 L1152 200 L1104 200 L1092 160 Z',
]
const CONTOURS = [
  'M0 182.1 L120 170.6 L240 176.3 L330 153.3 L420 159 L520 127.4 L600 133.1 L680 101.4 L740 95.7 L790 64 L820 49.6 L838 58.2 L870 81.3 L900 75.5 L940 113 L1010 138.9 L1080 133.1 L1140 161.9 L1200 173.4',
  'M0 185.7 L120 176.4 L240 181.1 L330 162.6 L420 167.2 L520 141.9 L600 146.5 L680 121.2 L740 116.5 L790 91.2 L820 79.7 L838 86.6 L870 105 L900 100.4 L940 130.4 L1010 151.1 L1080 146.5 L1140 169.5 L1200 178.8',
  'M0 189.2 L120 182.3 L240 185.8 L330 172 L420 175.4 L520 156.4 L600 159.9 L680 140.9 L740 137.4 L790 118.4 L820 109.8 L838 114.9 L870 128.8 L900 125.3 L940 147.8 L1010 163.3 L1080 159.9 L1140 177.2 L1200 184.1',
  'M0 192.8 L120 188.2 L240 190.5 L330 181.3 L420 183.6 L520 170.9 L600 173.2 L680 160.6 L740 158.3 L790 145.6 L820 139.8 L838 143.3 L870 152.5 L900 150.2 L940 165.2 L1010 175.6 L1080 173.2 L1140 184.8 L1200 189.4',
  'M0 196 L120 193.4 L240 194.7 L330 189.5 L420 190.8 L520 183.7 L600 185 L680 177.8 L740 176.5 L790 169.4 L820 166.2 L838 168.1 L870 173.3 L900 172 L940 180.4 L1010 186.2 L1080 185 L1140 191.4 L1200 194',
]
const SNOW = 'M800 24 L820 12 L838 22.8 L852 35.4 L847 49 L841 43 L835 64 L829 47 L819 55 L813 40 L806 51 L803 36 Z'
const RIDGE_LINE = 'M0 177.6 L120 163.2 L240 170.4 L330 141.6 L420 148.8 L520 109.2 L600 116.4 L680 76.8 L740 69.6 L790 30 L820 12 L838 22.8 L870 51.6 L900 44.4 L940 91.2 L1010 123.6 L1080 116.4 L1140 152.4 L1200 166.8'

export function MountainBand({ children }: { children: ReactNode }) {
  return (
    <header className="bg-ink text-white">
      <div className="mx-auto max-w-[880px] px-8 pt-12 pb-3">{children}</div>
      <div className="relative h-48">
        <svg aria-hidden="true" className="absolute inset-0 size-full" viewBox="0 0 1200 200" preserveAspectRatio="none">
          <path d={FAR_RANGE} fill="#2a3c46" />
          <path d={NEAR_RANGE} fill="#364b56" />
          <path d={MOUNTAIN} className="fill-granite" />
          {SHADE.map((p) => (
            <path key={p} d={p} fill="rgb(29 43 51 / 0.07)" />
          ))}
          {CONTOURS.map((p) => (
            <path key={p} d={p} fill="none" stroke="#c3ccc8" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          <path d={SNOW} fill="#fff" />
          <path
            d={RIDGE_LINE}
            fill="none"
            className="stroke-granite"
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* spot height, as a map marks a summit */}
        <span className="absolute bottom-[94%] left-[68.3%] -translate-x-1/2 -translate-y-1 text-xs tabular-nums text-white/55">
          12,590 ft
        </span>
      </div>
    </header>
  )
}
