import { z } from 'zod'
import { themeColorTokenSchema } from './theme.ts'
import { labelAnchorSchema, popupPositionSchema, popupTriggerSchema } from './layers.ts'

const UI_DOCS = 'https://conness-gis.com/configuration/ui-layout/'

export const widgetHeaderSchema = z
  .strictObject({
    showTitle: z.boolean().optional().meta({ description: "Show the widget's name.", default: true }),
    showDivider: z.boolean().optional().meta({ description: 'Line under the title.', default: true }),
    titleColor: themeColorTokenSchema.optional().meta({ description: 'Title color.', defaultText: 'theme.widgetTitleColor' }),
  })
  .meta({ description: "A widget panel's title bar.", see: `${UI_DOCS}#widget-header` })

export const exportFormatSchema = z
  .enum(['geojson', 'kml', 'geoparquet', 'csv'])
  .meta({ description: 'A download format. KML keeps colors only for `simple` symbology. CSV is layer list only.' })

export const floatingControlsUiSchema = z
  .strictObject({
    iconSize: z
      .number()
      .optional()
      .meta({ description: 'Icon size in px. The button is sized so the icon fills 75% of it.', default: 25 }),
    mobileIconSize: z.number().optional().meta({ description: 'Icon size on mobile.', defaultText: 'same as `iconSize`' }),
  })
  .meta({
    description: "Floating widget buttons and MapLibre's native controls.",
    see: `${UI_DOCS}#floating-controls-uifloatingcontrols`,
  })

export const topBarShadowSchema = z
  .strictObject({
    enabled: z.boolean().optional().meta({ description: 'Show the shadow.', default: false }),
    strength: z.number().min(0).max(1).optional().meta({ description: '0 to 1. Scales darkness and height.', default: 0.4 }),
  })
  .meta({ description: 'Shadow under the bar, over the map only.' })

export const topBarUiSchema = z
  .strictObject({
    height: z.number().optional().meta({ description: 'Bar height in px.', default: 56 }),
    mobileHeight: z.number().optional().meta({
      description: 'Height of the top bar on phones, in px. Below 45 the bar looks cramped.',
      defaultText: 'same as `height`, or 45 with the widget bar at the bottom',
    }),
    iconSize: z.number().optional().meta({ description: "Widget and info button icon size in px. A widget's button is twice the icon.", default: 20 }),
    mobileIconSize: z.number().optional().meta({ description: 'Widget icon size on mobile.', defaultText: 'same as `iconSize`' }),
    logoSize: z.number().optional().meta({ description: 'Logo height in px. Width follows the image.', default: 32 }),
    mobileLogoSize: z.number().optional().meta({ description: 'Logo height on mobile.', defaultText: 'same as `logoSize`, else 28' }),
    titleSize: z.number().optional().meta({ description: "The app title's text size in px.", default: 18 }),
    mobileTitleSize: z.number().optional().meta({ description: "The app title's text size on mobile.", default: 16 }),
    mobileVisibleCount: z
      .number()
      .optional()
      .meta({ description: 'Widget buttons the mobile carousel shows at once.', default: 3 }),
    mobileCarouselMode: z.enum(['step', 'paged']).optional().meta({
      description: '`"step"` moves one widget per arrow click. `"paged"` moves a full window.',
      default: 'step',
    }),
    shadow: topBarShadowSchema.optional(),
  })
  .meta({ description: 'The top bar.', see: `${UI_DOCS}#top-bar-uitopbar` })

export const shellSideSchema = z
  .enum(['left', 'right'])
  .meta({ description: 'Which side of the desktop layout a region sits on.' })

export const layoutUiSchema = z
  .strictObject({
    sideRailSide: shellSideSchema
      .optional()
      .meta({ description: 'Side of the side rail (icon strip and its panel).', default: 'left' }),
    topBarPanelSide: shellSideSchema.optional().meta({
      description:
        "Side a top-bar widget's panel opens on. Only needed without side rail widgets. Otherwise it opens opposite the side rail.",
      defaultText: 'the side opposite `sideRailSide`',
    }),
    topBarWidgetsSide: shellSideSchema
      .optional()
      .meta({ description: 'Side of the top-bar widget buttons. The title and logo take the other side.', default: 'right' }),
    showInfo: z.boolean().optional().meta({ description: 'Info button in the top bar.', default: true }),
    showBranding: z.boolean().optional().meta({ description: 'Logo and title in the top bar.', default: true }),
    mobileWidgetBar: z.enum(['top', 'bottom']).optional().meta({
      description:
        'Where the widget buttons sit on phones. `"bottom"` gives them their own bar under the map, where thumbs reach (`ui.mobile.widgetBarHeight`). The top bar keeps the logo, title and info button, at `ui.topBar.mobileHeight`.',
      default: 'top',
    }),
    showTopBar: z.boolean().optional().meta({
      description:
        'The top bar, on desktop. Off hides it with its title, logo, info button and top-bar widgets (mobile keeps its own bar).',
      default: true,
    }),
    showSideRail: z.boolean().optional().meta({
      description: 'The side rail, on desktop. Off hides it with its widgets (mobile still offers them in its carousel).',
      default: true,
    }),
    sideRailPanelWidth: z.number().optional().meta({ description: 'Side panel width in px.', default: 288 }),
    sideRailStripWidth: z.number().optional().meta({ description: 'Icon strip width in px.', default: 48 }),
    sideRailOpenOnLoad: z.string().optional().meta({
      description:
        "A side panel widget's id (e.g. `\"layer-list\"`) to have its panel open when the app loads, on desktop. Unset starts closed.",
      defaultText: 'closed',
    }),
    topBarOpenOnLoad: z.string().optional().meta({
      description:
        "A top bar widget's id (e.g. `\"bookmarks\"`) to have its panel open when the app loads, on desktop. Unset starts closed.",
      defaultText: 'closed',
    }),
    sideRailChevronSize: z
      .number()
      .optional()
      .meta({ description: "The side panel's collapse chevron, in px.", default: 16 }),
    sideRailIconSize: z.number().optional().meta({
      description: 'Side rail icon size in px. The button adds 12px. Above ~36, widen `sideRailStripWidth`.',
      default: 20,
    }),
    sideRailShadow: topBarShadowSchema.optional().meta({ description: 'Shadow beside the side rail, over the map only.' }),
  })
  .meta({ description: 'The layout. Mobile ignores the side settings.', see: `${UI_DOCS}#layout-uilayout` })

export const mobileUiSchema = z
  .strictObject({
    initialSheetVh: z.number().optional().meta({ description: 'Height when it opens.', default: 25 }),
    minSheetVh: z.number().optional().meta({ description: 'Smallest drag height.', default: 12 }),
    maxSheetVh: z.number().optional().meta({ description: 'Largest drag height.', default: 65 }),
    widgetBarHeight: z.number().optional().meta({
      description: 'Height in px of the widget bar under the map, with `ui.layout.mobileWidgetBar` at `"bottom"`.',
      default: 35,
    }),
  })
  .meta({
    description: 'The phone layout: the bottom sheet heights, in % of screen height, and the widget bar.',
    see: `${UI_DOCS}#mobile-uimobile`,
  })

export const infoUiSchema = z
  .strictObject({
    autoOpen: z
      .boolean()
      .optional()
      .meta({ description: 'Open on load. Closing it only lasts until the next load.', default: false }),
    allowDismiss: z
      .boolean()
      .optional()
      .meta({ description: 'With `autoOpen`: add a "don\'t show again" checkbox. Editing `info.md` shows it again.', default: true }),
    watermark: z.boolean().optional().meta({
      description: 'A small "Made with Conness GIS" line at the bottom of the info modal. The map\'s credits always include it.',
      default: true,
    }),
    width: z
      .number()
      .optional()
      .meta({ description: 'Widest the info modal gets, in px. Narrow screens use their width.', default: 672 }),
    maxHeight: z
      .number()
      .optional()
      .meta({ description: 'Tallest the info modal gets, in % of the screen height. Longer text scrolls.', default: 80 }),
  })
  .meta({ description: "The info modal, rendered from the project's `info.md`.", see: `${UI_DOCS}#info-modal-uiinfo` })

export const loaderUiSchema = z
  .strictObject({
    enabled: z.boolean().optional().meta({ description: 'Show the overlay.', default: true }),
    label: z.union([z.string(), z.string().array()]).optional().meta({
      description:
        'Text under the spinner, e.g. `"Loading…"`. A list of lines shows one at a time, looping, each for `labelInterval`.',
    }),
    labelInterval: z
      .number()
      .optional()
      .meta({ description: 'With a `label` list: how long each line shows, in ms.', default: 2500 }),
    showDetails: z.boolean().optional().meta({
      description: "Show the line under the label naming what's loading (DuckDB, each layer).",
      default: true,
    }),
  })
  .meta({ description: 'Overlay that blocks clicks while startup layers load.', see: `${UI_DOCS}#loading-overlay-uiloader` })

export const labelDefaultsSchema = z
  .strictObject({
    fontSize: z.number().optional().meta({ default: 12 }),
    bold: z.boolean().optional().meta({ description: 'Bold text (Noto Sans Bold instead of Regular).', default: false }),
    color: z.string().optional().meta({ default: '#333333' }),
    haloColor: z.string().optional().meta({ default: '#ffffff' }),
    haloWidth: z.number().optional().meta({ default: 1 }),
    anchor: labelAnchorSchema.optional().meta({ default: 'center' }),
    offset: z.number().min(0).optional().meta({ description: "How far a label at a corner sits from its feature, in px, across and up or down. Unset, it's as far as the text is tall. Has no effect when the label is centered." }),
    allowOverlap: z.boolean().optional().meta({ default: false }),
    spacing: z.number().min(1).optional().meta({ description: 'Line layers only: px between repeats of the label along a line.', default: 500 }),
  })
  .meta({ description: "Label style defaults. Same fields as a layer's `label`, minus its content." })

export const layerDefaultsUiSchema = z
  .strictObject({
    label: labelDefaultsSchema.optional().meta({ description: 'Label style for layers that have a `label`.' }),
  })
  .meta({ description: "Defaults for every layer. A layer's own values win.", see: `${UI_DOCS}#global-layer-defaults` })

export const popupUiSchema = z
  .strictObject({
    trigger: popupTriggerSchema.optional().meta({ description: 'Click or hover.', default: 'click' }),
    position: popupPositionSchema.optional().meta({
      description:
        'Where popups open: a map corner, or `"feature"` next to the clicked or hovered spot. Users can still drag a popup.',
      default: 'bottom-left',
    }),
    displayType: z
      .string()
      .optional()
      .meta({ description: "Template name from the project's `popups.tsx`.", default: 'standard' }),
    height: z
      .union([z.number(), z.literal('auto')])
      .optional()
      .meta({ description: 'Height in px, or `"auto"` to fit content up to `maxHeight`.', default: 300 }),
    maxHeight: z
      .number()
      .optional()
      .meta({ description: 'Tallest the popup gets: fitting its content (`"auto"`) or resized by the user.', default: 500 }),
    draggable: z.boolean().optional().meta({ description: 'Let users drag the desktop popup by its header.', default: true }),
    resizable: z.boolean().optional().meta({
      description: 'Let users resize the desktop popup from its bottom-right corner. The size is kept until the page reloads.',
      default: false,
    }),
    width: z.number().optional().meta({ description: 'Desktop popup width in px.', default: 320 }),
    maxWidth: z.number().optional().meta({ description: 'Widest a user can resize the popup, in px.', default: 440 }),
    closeOnMapClick: z
      .boolean()
      .optional()
      .meta({ description: 'Close a click popup when the user clicks empty map.', default: true }),
    zoomToFeature: z.boolean().optional().meta({ description: 'Zoom-to-feature button.', default: true }),
    highlight: z.boolean().optional().meta({
      description: 'Outline the feature whose popup is open, in the theme\'s `featureHighlight` color.',
      default: true,
    }),
    copyCoordinates: z.boolean().optional().meta({ description: 'Copy-coordinates button.', default: false }),
    viewInGoogleMaps: z
      .boolean()
      .optional()
      .meta({ description: 'View-in-Google-Maps button (drops a pin).', default: false }),
    headerSize: z
      .number()
      .optional()
      .meta({ description: "Text size of the popup's header bar, next to the close button, in px.", default: 14 }),
    titleSize: z.number().optional().meta({
      description: "Text size of the title inside the popup, in px. Templates without a title ignore it.",
      default: 16,
    }),
    bodySize: z
      .number()
      .optional()
      .meta({ description: "Text size of the popup's fields table and body text, in px.", default: 14 }),
  })
  .meta({
    description: "Popup defaults for every layer. A layer's own `popup` wins.",
    see: 'https://conness-gis.com/configuration/popups/#global-defaults-uipopups',
  })

export const textSizesUiSchema = z
  .strictObject({
    small: z
      .number()
      .optional()
      .meta({ description: 'Fine print in px: coordinates, opacity percentages, badges, hints.', default: 11 }),
    medium: z.number().optional().meta({
      description:
        "Layer names in the layer list, captions, widgets' info sections and any text without its own size, in px.",
      default: 12,
    }),
    large: z.number().optional().meta({
      description: 'Layer group names, list rows, menus, popup titles, the info modal and the loading screen, in px.',
      default: 14,
    }),
    title: z.number().optional().meta({ description: 'Widget and side panel titles, in px.', default: 14 }),
    button: z.number().optional().meta({ description: 'Buttons inside widgets, in px.', default: 14 }),
    dialogButton: z.number().optional().meta({ description: 'Cancel and confirm buttons in dialogs, in px.', default: 12 }),
  })
  .meta({
    description:
      "The text sizes the shell and widgets use (the app's title has its own, `ui.topBar.titleSize`). Set in px. They still follow the browser font size.",
    see: `${UI_DOCS}#text-sizes-uitextsizes`,
  })

export const uiConfigSchema = z
  .strictObject({
    widgetHeader: widgetHeaderSchema
      .omit({ titleColor: true })
      .optional()
      .meta({ description: 'Widget panel title bar. Title color is `theme.widgetTitleColor`.' }),
    layout: layoutUiSchema.optional(),
    info: infoUiSchema.optional(),
    floatingControls: floatingControlsUiSchema.optional(),
    topBar: topBarUiSchema.optional(),
    popups: popupUiSchema.optional(),
    loader: loaderUiSchema.optional(),
    layerDefaults: layerDefaultsUiSchema.optional(),
    mobile: mobileUiSchema.optional(),
    textSizes: textSizesUiSchema.optional(),
    hideWidgetInfo: z.string().array().optional().meta({
      description: 'Widget ids whose info section (the short help at the top of the widget) is hidden.',
      defaultText: 'none: every widget shows it',
    }),
    buttonCursor: z
      .enum(['pointer', 'default'])
      .optional()
      .meta({
        description:
          'Cursor over buttons. `"pointer"`: the hand, as over links on the web. `"default"` (Arrow in the editor): the arrow, as over buttons in desktop apps.',
        default: 'pointer',
      }),
  })
  .meta({ description: 'Shell settings: layout, top bar, panels, popups and more.', see: UI_DOCS })
