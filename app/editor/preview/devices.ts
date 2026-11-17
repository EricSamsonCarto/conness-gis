// the app runs at a real window size, the iframe is scaled
export const DEVICES = {
  desktop: { width: 1440, height: 900, label: 'Desktop (1440 × 900)' },
  mobile: { width: 402, height: 874, label: 'Mobile (402 × 874)' },
}
export type Device = keyof typeof DEVICES
