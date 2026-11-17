import { z } from 'zod'

const THEME_DOCS = 'https://conness-gis.com/configuration/theme/'

const tailwindColor = (description: string, def: string) =>
  z.string().optional().meta({ description, default: def })

export const themeColorTokenSchema = z
  .enum(['primary', 'text'])
  .meta({ description: 'Theme tokens a widget title can use.' })

export const themeColorsSchema = z
  .strictObject({
    primary: tailwindColor('Brand color: active states, focus rings, primary buttons.', 'blue-900'),
    text: tailwindColor('Body text, inputs, dropdowns, readouts and idle icons: most of the text in panels, popups and the info modal.', 'slate-600'),
    strongText: tailwindColor('Names, titles and emphasized text: layer, legend and basemap names, bookmark and drawing names, dialog titles, popup titles and values. Icon buttons turn this color on hover.', 'slate-900'),
    surface: tailwindColor("Info sections, the popup header and footer, section headers, chips, Measure's unit boxes.", 'slate-100'),
    layerGroupBg: tailwindColor('Layer list group header rows.', 'surface'),
    danger: tailwindColor('Delete and clear buttons.', 'rose-600'),
    dangerHover: tailwindColor('Hover color for `danger`.', 'rose-700'),
    success: tailwindColor('Confirm buttons, like draw\'s "done".', 'emerald-600'),
    successHover: tailwindColor('Hover color for `success`.', 'emerald-700'),
    disabledBg: tailwindColor('Disabled button fill.', 'gray-200'),
    disabledText: tailwindColor('Disabled button text.', 'gray-400'),
    hover: tailwindColor('Item list hover tint.', 'amber-500'),
    featureHighlight: tailwindColor('Outline of the feature whose popup is open (`ui.popups.highlight`).', 'cyan-400'),
    slider: tailwindColor('Toggle switches and range sliders.', 'primary'),
    actionActive: tailwindColor('Selected tool button (draw, measure).', 'primary'),
    actionActiveHover: tailwindColor('Hover color for `actionActive`.', 'primaryDarker'),
    actionNotActive: tailwindColor('Idle tool button.', 'white'),
    actionNotActiveHover: tailwindColor('Hover color for `actionNotActive`.', 'slate-50'),
    save: tailwindColor('Save buttons (bookmarks, draw).', 'primary'),
    saveHover: tailwindColor('Hover color for `save`.', 'primaryDarker'),
    popupHeaderBg: tailwindColor('Popup title bar.', 'surface'),
    popupArrow: tailwindColor('Popup pager arrows.', 'text'),
    dropdownHover: tailwindColor("Dropdown focus (measure's unit selectors).", 'primary'),
    panelBg: tailwindColor('Panels, popups, dialogs, dropdowns and inputs.', 'white'),
    panelBorder: tailwindColor('Panel borders and dividers.', 'slate-200'),
    panelWidget: tailwindColor(
      'Side rail widget icons and the side panel collapse chevron. Black on light themes and white on dark ones, like the top bar icons where the top bar shares the panel color.',
      'black',
    ),
    topBarBg: tailwindColor('Top bar background.', 'primary'),
    titleText: tailwindColor('The app title in the top bar. Must contrast with `topBarBg`.', 'white'),
    topBarWidget: tailwindColor(
      'Top bar widget icons, the info button and the mobile carousel. Must contrast with `topBarBg`.',
      'white',
    ),
    mapControlBg: z.string().optional().meta({
      description: "Background of the map's controls and the floating widget buttons. Their icons are black or white (`mapControlIcons`).",
      defaultText: 'the panel color (`panelBg`)',
    }),
  })
  .meta({
    description:
      'Color tokens. Each value is a Tailwind color name and shade, like `"red-500"`, or another token\'s name, like `"primary"`, to follow that token. Every token is optional and falls back to the preset.',
    see: THEME_DOCS,
  })

export const themeNameSchema = z
  .enum(['conness', 'light', 'grays', 'dark', 'dark-blues', 'mars', 'evergreen', 'ocean', 'lavender', 'meadow', 'sand'])
  .meta({ description: 'Built-in color presets.' })

export const themeSettingsSchema = z
  .strictObject({
    preset: themeNameSchema.optional().meta({
      description:
        'Built-in color palette: `conness` (light, navy top bar), `light` (white, sky blue), `grays` (light grays), `dark` (black and white), `dark-blues` (slate blues), `mars` (dark, rust red), `evergreen` (dark greens), `ocean` (light cyan), `lavender` (light purples), `meadow` (light greens) or `sand` (light, warm stone). Individual colors (`colors`) override it.',
      default: 'conness',
    }),
    colors: themeColorsSchema.optional().meta({ description: 'Per-token overrides on top of the preset.' }),
    widgetTitleColor: themeColorTokenSchema
      .optional()
      .meta({ description: "Widget panel title color. A placement's `header.titleColor` wins.", default: 'text' }),
    mapControlIcons: z.enum(['black', 'white']).optional().meta({
      description:
        "Icons on the map's controls and the floating widget buttons: one color for all of them, so MapLibre's own icons and the widgets' match. Locate me's state and the compass tip keep their colors.",
      defaultText: 'whichever reads on `mapControlBg`',
    }),
  })
  .meta({ description: "The project's colors (`theme.json`). Resolves as preset ← `colors`.", see: THEME_DOCS })
