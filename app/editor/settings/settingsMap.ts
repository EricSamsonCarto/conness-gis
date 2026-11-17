// where every setting lives. a test fails when one has no home, or two
export type SettingEntry = {
  // a trailing '.*' is a whole subtree on one row
  path: string
  label?: string
  advanced?: boolean
  // an array or keyed list, edited on its own screen
  list?: boolean
  // text for values that need real words
  optionLabels?: Record<string, string>
  // a whole block's switch, on writes {}, off removes it
  presence?: true
  dependsOn?: DependsOn
  // its default is another setting's value, per the merge convention
  fallbackFrom?: string
  // its default as a value, like a widget's manifest default
  fallbackValue?: unknown
  // on also writes `value` to an unset `path`, so that default shows
  fills?: { path: string; value: unknown }
  // changing it also removes these (a new preset drops hand-edited colors)
  clears?: string[]
}
// hidden settings keep their values, so turning the parent on restores them
export type DependsOn = { path: string; equals?: unknown; not?: unknown; empty?: true; fallbackFrom?: string }
// with `screen`, the sections only record which settings it covers
export type PanelEntry = {
  panel: string
  label: string
  advanced?: boolean
  sections: Section[]
  screen?:
    | 'layers'
    | 'layer'
    | 'layer-general'
    | 'source-layers'
    | 'source-layer-general'
    | 'layer-popup'
    | 'popup-fields'
    | 'popup-field'
    | 'layer-filters'
    | 'layer-filter'
    | 'layer-group'
    | 'layer-style'
    | 'layer-labels'
    | 'source-layer'
    | 'basemaps'
    | 'basemap'
    | 'custom-links'
    | 'custom-link'
    | 'search-layers'
    | 'search-layer'
    | 'placement-order'
    | 'corners'
    | 'dem-source'
  // the pop-out's heading when it isn't the label
  title?: string
  // a layer id, or '<layer id>|<part>'
  param?: string
  dependsOn?: DependsOn
  // a button atop the pop-out that resets these settings
  resetAll?: { label: string; paths: string[] }
}
export type Entry = SettingEntry | PanelEntry
// `toggle` is on while its path is set, `widget` shows while it's placed
export type Section = {
  // Make smaller or bigger, every one of these sizes by 1 px
  scale?: { what: string; paths: string[] }
  name?: string
  note?: string
  // the whole section hides while this is off
  dependsOn?: DependsOn
  // the Advanced fold's own name and a note inside it
  advancedLabel?: string
  advancedNote?: string
  toggle?: string
  // a switch beside the name, the other rows show only while it's on
  switch?: string
  widget?: string
  settings: Entry[]
  blocks?: Section[]
}
export type Group = { name: string; sections: Section[] }

export const isPanel = (entry: Entry): entry is PanelEntry => 'panel' in entry

const s = (path: string, extra: Omit<SettingEntry, 'path'> = {}): SettingEntry => ({ path: `settings:${path}`, ...extra })
const adv = (path: string, extra: Omit<SettingEntry, 'path' | 'advanced'> = {}): SettingEntry =>
  s(path, { ...extra, advanced: true })
const list = (path: string, extra: Omit<SettingEntry, 'path' | 'list'> = {}): SettingEntry =>
  s(path, { ...extra, list: true })

const SPIN = { path: 'settings:map.globe.spin' }
const LOADER = { path: 'settings:ui.loader.enabled' }
const MENU = { path: 'settings:contextMenu.enabled' }

// in the colors pop-out's order. two aren't in theme.colors but sit here
export const COLOR_TOKENS = [
  'primary',
  'text',
  'titleText',
  'strongText',
  'topBarBg',
  'topBarWidget',
  'panelWidget',
  'panelBg',
  'panelBorder',
  'surface',
  'layerGroupBg',
  'danger',
  'dangerHover',
  'success',
  'successHover',
  'disabledBg',
  'disabledText',
  'hover',
  'featureHighlight',
  'slider',
  'actionActive',
  'actionActiveHover',
  'actionNotActive',
  'actionNotActiveHover',
  'save',
  'saveHover',
  'popupHeaderBg',
  'popupArrow',
  'dropdownHover',
]
const COLOR_LABELS: Record<string, string> = {
  topBarBg: 'Top bar bg',
  panelBg: 'Panel bg',
  layerGroupBg: 'Layer group bg',
  hover: 'Hover (item list)',
  disabledBg: 'Disabled bg',
  popupHeaderBg: 'Popup header bg',
}
// every color a theme value can point at, for the color-name check
export const THEME_COLOR_NAMES = [...COLOR_TOKENS, 'mapControlBg']

const color = (t: string): SettingEntry => ({ path: `theme:colors.${t}`, label: COLOR_LABELS[t] })
// widget title after strong text, the map controls after layer group bg
const COLOR_ENTRIES: SettingEntry[] = COLOR_TOKENS.flatMap((t) => {
  if (t === 'strongText') return [color(t), { path: 'theme:widgetTitleColor', label: 'Widget title' }]
  if (t === 'layerGroupBg') {
    return [
      color(t),
      { path: 'theme:colors.mapControlBg', label: 'Map controls bg' },
      { path: 'theme:mapControlIcons', label: 'Map control icons' },
    ]
  }
  return [color(t)]
})

// one block per map control, on while its key is in mapControls
const control = (key: string, name: string, options: Entry[] = []): Section => ({
  name,
  toggle: `settings:mapControls.${key}`,
  settings: [s(`mapControls.${key}.position`, { label: 'Position' }), ...options],
})

const TEXT_SIZE_PATHS = ['small', 'medium', 'large', 'title', 'button', 'dialogButton']
  .map((k) => `settings:ui.textSizes.${k}`)
  .concat('settings:ui.topBar.titleSize')

const PRESET_COLOR_PATHS = ['theme:colors', 'theme:widgetTitleColor', 'theme:mapControlIcons']

// the mobile sizes follow the desktop ones until set
const ICON_SIZE_PATHS = [
  'topBar.iconSize', 'topBar.logoSize', 'layout.sideRailIconSize', 'layout.sideRailChevronSize',
  'floatingControls.iconSize', 'topBar.mobileIconSize', 'topBar.mobileLogoSize', 'floatingControls.mobileIconSize',
].map((k) => `settings:ui.${k}`)

export const SETTINGS_MAP: Group[] = [
  {
    name: 'Branding',
    sections: [
      {
        settings: [
          s('branding.title'),
          s('branding.description'),
          s('branding.logo'),
          s('branding.favicon'),
          s('commercialUse'),
          adv('branding.appId', { label: 'Storage ID' }),
        ],
      },
      {
        name: 'Info Modal',
        note: "The info modal's text is in your project's info.md. Edit it there.",
        settings: [
          s('ui.layout.showInfo', { label: 'Show info button' }),
          s('ui.info.autoOpen'),
          s('ui.info.allowDismiss', { dependsOn: { path: 'settings:ui.info.autoOpen' } }),
          s('ui.info.width'),
          s('ui.info.maxHeight', { label: 'Max height (% of screen)' }),
          adv('ui.info.watermark', { label: 'Conness watermark' }),
        ],
      },
    ],
  },
  {
    name: 'App Style',
    sections: [
      {
        settings: [
          { path: 'theme:preset', label: 'Theme preset', clears: PRESET_COLOR_PATHS },
          {
            panel: 'colors',
            label: 'Edit individual colors',
            resetAll: { label: "Reset to the preset's colors", paths: PRESET_COLOR_PATHS },
            sections: [{ settings: COLOR_ENTRIES }],
          },
        ],
      },
      {
        scale: { what: 'text', paths: TEXT_SIZE_PATHS },
        settings: [
          s('ui.textSizes.small', { label: 'Small text' }),
          s('ui.textSizes.medium', { label: 'Medium text' }),
          s('ui.textSizes.large', { label: 'Large text' }),
          s('ui.topBar.titleSize', { label: 'App title text' }),
          s('ui.textSizes.title', { label: 'Widget title text' }),
          s('ui.textSizes.button', { label: 'Button text' }),
          s('ui.textSizes.dialogButton', { label: 'Dialog button text' }),
        ],
      },
    ],
  },
  {
    name: 'Layout',
    sections: [
      { scale: { what: 'logos/icons', paths: ICON_SIZE_PATHS }, settings: [] },
      {
        name: 'Arrangement',
        settings: [
          s('ui.layout.sideRailSide', { dependsOn: { path: 'settings:ui.layout.showSideRail' } }),
          // it follows the side rail, only a project without rail widgets picks it
          s('ui.layout.topBarPanelSide', { dependsOn: { path: 'settings:sidePanelWidgets', empty: true } }),
          s('ui.layout.topBarWidgetsSide', { dependsOn: { path: 'settings:ui.layout.showTopBar' } }),
        ],
      },
      {
        name: 'Top Bar',
        switch: 'settings:ui.layout.showTopBar',
        settings: [
          s('ui.layout.showTopBar'),
          s('ui.topBar.height'),
          s('ui.topBar.iconSize'),
          s('ui.topBar.logoSize'),
          s('ui.layout.showBranding'),
          s('ui.layout.topBarOpenOnLoad', { label: 'Open at start' }),
          adv('ui.topBar.shadow.enabled', { label: 'Shadow' }),
          adv('ui.topBar.shadow.strength', {
            label: 'Shadow strength',
            dependsOn: { path: 'settings:ui.topBar.shadow.enabled' },
          }),
        ],
      },
      {
        name: 'Side Rail',
        switch: 'settings:ui.layout.showSideRail',
        settings: [
          s('ui.layout.showSideRail'),
          s('ui.layout.sideRailOpenOnLoad', { label: 'Open at start' }),
          s('ui.layout.sideRailPanelWidth', { label: 'Panel width' }),
          s('ui.layout.sideRailIconSize', { label: 'Icon size' }),
          adv('ui.layout.sideRailStripWidth', { label: 'Strip width' }),
          adv('ui.layout.sideRailChevronSize', { label: 'Chevron size' }),
          adv('ui.layout.sideRailShadow.enabled', { label: 'Shadow' }),
          adv('ui.layout.sideRailShadow.strength', {
            label: 'Shadow strength',
            dependsOn: { path: 'settings:ui.layout.sideRailShadow.enabled' },
          }),
        ],
      },
      { name: 'Floating Buttons', settings: [s('ui.floatingControls.iconSize')] },
      {
        name: 'Mobile',
        settings: [
          s('ui.layout.mobileWidgetBar', { label: 'Widget buttons' }),
          s('ui.topBar.mobileVisibleCount', { label: 'Visible widget icons' }),
          s('ui.topBar.mobileCarouselMode', { label: 'Widget carousel' }),
          s('ui.mobile.initialSheetVh', { label: 'Sheet height when opened' }),
          adv('ui.mobile.minSheetVh', { label: 'Smallest sheet height' }),
          adv('ui.mobile.maxSheetVh', { label: 'Largest sheet height' }),
          adv('ui.mobile.widgetBarHeight', { label: 'Widget bar height' }),
          adv('ui.topBar.mobileHeight', { label: 'Top bar height' }),
          adv('ui.topBar.mobileIconSize', { label: 'Top bar icon size' }),
          adv('ui.topBar.mobileLogoSize', { label: 'Logo size' }),
          adv('ui.topBar.mobileTitleSize', { label: 'App title text' }),
          adv('ui.floatingControls.mobileIconSize', { label: 'Floating button size' }),
        ],
      },
      {
        name: 'Loading Screen',
        settings: [
          s('ui.loader.enabled'),
          s('ui.loader.label', { dependsOn: LOADER }),
          adv('ui.loader.labelInterval', { dependsOn: LOADER }),
          adv('ui.loader.showDetails', { dependsOn: LOADER }),
        ],
      },
    ],
  },
  {
    name: 'Map',
    sections: [
      {
        name: 'Starting View',
        settings: [
          s('map.center'),
          s('map.zoom'),
          s('map.bearing'),
          s('map.pitch'),
          s('map.style', { label: 'Basemap' }),
          adv('map.minZoom'),
          adv('map.maxZoom'),
          adv('map.maxBounds'),
          adv('map.backgroundColor'),
        ],
      },
      {
        name: 'Globe',
        settings: [
          s('map.globe.enabled', { label: 'Start as globe' }),
          s('map.globe.stars'),
          s('map.globe.comets', { dependsOn: { path: 'settings:map.globe.stars' } }),
          s('map.globe.atmosphere'),
          adv('map.globe.spin', { label: 'Spin', presence: true }),
          adv('map.globe.spin.direction', { label: 'Spin direction', dependsOn: SPIN }),
          adv('map.globe.spin.speed', { label: 'Spin speed', dependsOn: SPIN }),
          adv('map.globe.spin.continuous', { label: 'Keep spinning', dependsOn: SPIN }),
          // its order (and corner, by dragging) are in Map Controls › Arrange corners
          adv('mapControls.spin', { label: 'Pause / play button', presence: true, dependsOn: SPIN }),
          adv('mapControls.spin.position', { label: 'Button position', dependsOn: { path: 'settings:mapControls.spin' } }),
          adv('map.globe.starsZoomCutoff', { dependsOn: { path: 'settings:map.globe.stars' } }),
        ],
      },
      { name: 'Navigation', settings: [s('map.scrollZoom', { label: 'Scroll to zoom' })] },
    ],
  },
  {
    name: 'Map Controls',
    sections: [
      {
        settings: [
          {
            panel: 'arrange-corners',
            label: 'Arrange corners',
            screen: 'corners',
            sections: [
              {
                settings: [
                  list('floatingWidgets', { label: 'Floating widgets' }),
                  ...['navigation', 'geolocate', 'fullscreen', 'scale', 'globe', 'spin', 'terrain', 'zoomLevel', 'attribution'].map((key) =>
                    s(`mapControls.${key}.order`),
                  ),
                ],
              },
            ],
          },
        ],
      },
      control('globe', 'Globe Button'),
      control('navigation', 'Zoom & Compass', [
        s('mapControls.navigation.showZoom'),
        s('mapControls.navigation.showCompass'),
        s('mapControls.navigation.visualizePitch'),
      ]),
      control('geolocate', 'Locate Me', [
        s('mapControls.geolocate.trackUserLocation'),
        adv('mapControls.geolocate.showUserLocation'),
        adv('mapControls.geolocate.showUserHeading'),
        adv('mapControls.geolocate.showAccuracyCircle'),
      ]),
      control('fullscreen', 'Fullscreen'),
      control('scale', 'Scale Bar', [
        s('mapControls.scale.style', { label: 'Style' }),
        s('mapControls.scale.unit', { label: 'Unit' }),
        s('mapControls.scale.maxWidth', { label: 'Width' }),
      ]),
      control('terrain', 'Terrain Button', [
        s('mapControls.terrain.exaggeration'),
        s('mapControls.terrain.enabled'),
        {
          panel: 'terrain-source',
          label: 'Terrain source',
          // tiles or a TileJSON url, one at a time (screens.tsx)
          screen: 'dem-source',
          param: 'settings:mapControls.terrain.source',
          sections: [
            {
              settings: [
                s('mapControls.terrain.source.tiles'),
                s('mapControls.terrain.source.url'),
                s('mapControls.terrain.source.encoding'),
                s('mapControls.terrain.source.tileSize'),
                s('mapControls.terrain.source.maxzoom'),
              ],
            },
          ],
        },
      ]),
      control('zoomLevel', 'Zoom Level Readout', [s('mapControls.zoomLevel.precision', { label: 'Decimals' })]),
      // always on (the licenses require it), so no On/Off
      {
        name: 'Credits',
        note: 'The map’s credits button is always shown, since the data and tile licenses require it.',
        settings: [s('mapControls.attribution.position', { label: 'Position' })],
      },
    ],
  },
  {
    name: 'Layers',
    sections: [
      {
        settings: [
          {
            panel: 'popup-defaults',
            label: 'Popup defaults',
            sections: [
              {
                note: 'Every layer with popups on uses these defaults, unless it sets its own. Templates are designed in your project’s popups.tsx.',
                settings: [
                  s('ui.popups.displayType', { label: 'Popup Template' }),
                  s('ui.popups.trigger'),
                  s('ui.popups.position'),
                  s('ui.popups.highlight'),
                  s('ui.popups.zoomToFeature'),
                  s('ui.popups.copyCoordinates'),
                  s('ui.popups.viewInGoogleMaps'),
                  s('ui.popups.headerSize', { label: 'Header text' }),
                  s('ui.popups.titleSize', { label: 'Title text' }),
                  s('ui.popups.bodySize', { label: 'Body text' }),
                  s('ui.popups.height'),
                  s('ui.popups.maxHeight'),
                  s('ui.popups.width'),
                  s('ui.popups.maxWidth'),
                  adv('ui.popups.draggable'),
                  adv('ui.popups.resizable'),
                  adv('ui.popups.closeOnMapClick'),
                ],
              },
            ],
          },
          {
            panel: 'label-defaults',
            label: 'Label defaults',
            sections: [
              {
                settings: [
                  s('ui.layerDefaults.label.fontSize'),
                  s('ui.layerDefaults.label.bold'),
                  s('ui.layerDefaults.label.color'),
                  s('ui.layerDefaults.label.haloColor'),
                  adv('ui.layerDefaults.label.haloWidth'),
                  adv('ui.layerDefaults.label.anchor'),
                  adv('ui.layerDefaults.label.offset', { dependsOn: { path: 'settings:ui.layerDefaults.label.anchor', not: 'center' } }),
                  adv('ui.layerDefaults.label.allowOverlap'),
                  adv('ui.layerDefaults.label.spacing'),
                ],
              },
            ],
          },
          {
            panel: 'layers',
            label: 'Layers',
            screen: 'layers',
            sections: [
              {
                settings: [
                  { path: 'layers:layers', list: true },
                  { path: 'symbology:', label: 'Symbology', list: true },
                  list('layerGroups'),
                ],
              },
            ],
          },
          s('map.onlyVisibleOnLoad', { label: 'Load only visible layers' }),
          adv('duckdb.bundleUrl', { label: 'DuckDB bundle URL' }),
          adv('duckdb.extensionsUrl', { label: 'DuckDB extensions URL' }),
        ],
      },
    ],
  },
  {
    name: 'Widgets',
    sections: [
      {
        settings: [
          {
            panel: 'placement-order',
            label: 'Reorder widgets',
            screen: 'placement-order',
            sections: [
              {
                settings: [
                  list('topBarWidgets', { label: 'Top bar' }),
                  list('sidePanelWidgets', { label: 'Side panel' }),
                  list('mobileWidgets', { label: 'Mobile' }),
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'Widget Headers',
        settings: [
          s('ui.widgetHeader.showTitle'),
          s('ui.widgetHeader.showDivider'),
          // edited per widget, listed here so it has a home
          list('ui.hideWidgetInfo', { label: 'Widgets without info', advanced: true }),
        ],
      },
      // only what a widget's block shows beyond its settings.ts
      {
        widget: 'basemap',
        settings: [
          {
            panel: 'basemaps',
            label: 'Basemaps',
            screen: 'basemaps',
            sections: [{ settings: [{ path: 'basemaps:basemaps', list: true }] }],
          },
        ],
      },
    ],
  },
  {
    name: 'Interaction',
    sections: [
      {
        name: 'Right-Click Menu',
        settings: [
          s('contextMenu.enabled', { label: 'Right-click menu' }),
          s('contextMenu.centerHere', { dependsOn: MENU }),
          s('contextMenu.googleMaps', { label: 'Google Maps', dependsOn: MENU }),
          s('contextMenu.googleStreetView', { label: 'Google Street View', dependsOn: MENU }),
          s('contextMenu.osm', { label: 'OpenStreetMap', dependsOn: MENU }),
          s('contextMenu.appleMaps', { label: 'Apple Maps', dependsOn: MENU }),
          s('contextMenu.copernicus', { dependsOn: MENU }),
          {
            panel: 'custom-links',
            label: 'Custom links',
            advanced: true,
            dependsOn: MENU,
            screen: 'custom-links',
            sections: [{ settings: [list('contextMenu.custom')] }],
          },
        ],
      },
      { settings: [s('ui.buttonCursor', { optionLabels: { pointer: 'Pointer', default: 'Arrow' } })] },
    ],
  },
]

// every section, through blocks, panels and their sub-panels
export function allSections(sections: Section[] = SETTINGS_MAP.flatMap((g) => g.sections)): Section[] {
  return sections.flatMap((section) => [
    section,
    ...allSections(section.blocks ?? []),
    ...section.settings.flatMap((e) => (isPanel(e) ? allSections(e.sections) : [])),
  ])
}

export function allEntries(): Entry[] {
  return allSections().flatMap((section) => section.settings)
}

// a description that repeats the label opens nothing, hover still shows it
const NO_INFO = new Set([
  'settings:contextMenu.osm',
  'settings:ui.popups.copyCoordinates',
  'settings:ui.popups.zoomToFeature',
  'settings:mapControls.geolocate.showUserLocation',
  'settings:mapControls.geolocate.showUserHeading',
  'settings:mapControls.geolocate.showAccuracyCircle',
  'settings:widgets.measure.precision',
  'settings:mapControls.zoomLevel.precision',
  'settings:ui.topBar.shadow.enabled',
  'settings:ui.loader.enabled',
  'settings:widgets.search.placeholder',
  'settings:widgets.search.layers',
  'settings:ui.widgetHeader.showTitle',
  'settings:map.zoom',
  'theme:colors.disabledBg',
  'theme:colors.topBarBg',
  'theme:colors.disabledText',
  'theme:colors.dangerHover',
  'theme:colors.successHover',
  'theme:colors.actionActiveHover',
  'theme:colors.actionNotActiveHover',
  'theme:colors.saveHover',
])
export const showsInfo = (entry: SettingEntry) => !NO_INFO.has(entry.path)

const ACRONYMS = new Set(['url', 'id', 'api', 'json', 'px', 'vh'])

// sentence case from the path's last key, bundleUrl reads "Bundle URL"
export function labelFor(entry: Entry): string {
  if (entry.label) return entry.label
  const key = (entry as SettingEntry).path.split(':')[1].replace(/\.\*$/, '').split('.').pop() ?? ''
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(' ')
    .map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w))
    .join(' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
