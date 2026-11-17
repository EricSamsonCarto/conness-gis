# The Conness editor

The editor is the app `npm start` opens. It lists the projects in `app/projects/`, edits their settings with a live preview, and builds them. It's part of Conness GIS itself, so it isn't meant to be changed or extended per project. If something in it is wrong or missing, open an issue on the repository.

## Folders

| Folder | What's in it |
|---|---|
| `project/` | The projects page, the project menu, Build, the upgrade notice, the projects API client, the check Add layer runs on a URL, and the checkbox list several dialogs use |
| `settings/` | The sidebar: the settings map, search, the schema readers, widget blocks and Reset all |
| `edits/` | The editor's state and the edits it makes to a project's files |
| `preview/` | The Preview Pane and which changes it can take without a reload |
| `panel/` | The pieces every screen is built from (below), the pop-out, its screens, the file picker and the sortable list |

## Building a screen

A screen in the sidebar or a pop-out is built only from these pieces, so the spacing stays the same everywhere. Most are in `panel/parts.tsx`, and the controls are in `panel/controls.tsx`.

| Piece | Use it for |
|---|---|
| `PanelSection` | A section of mapped settings, with its title, note and Advanced fold |
| `ToggleBlock` | A feature that is on while its key exists, like a map control |
| `SettingRow` / `EntryRow` | One mapped setting, or a mapped setting or a pop-out link |
| `PanelLink` | A row that opens a screen in the pop-out |
| `Block` | A pop-out section written by hand. It owns the padding, and the pop-out draws the dividers |
| `ControlRow` | A label and its own control on one line. Use `wide` for fields and dropdowns |
| `PlainRow` | A label and a value that can't be edited here |
| `PanelButton` | A full-width button: `secondary`, `danger` or `add` |
| `InlineButton` | A small button beside a value, like Rename or Upload |
| `Note` / `PanelNote` | A short explanation inside a section, or at the top of a screen |
| `ProblemText` | A problem under the thing it's about |
| `Gone` | A screen whose item was removed while it was open |
| `Subtitle` / `HEADING` | A section title. `HEADING` is its class, for when the title is a different element |
| `TEXT_LINK` | The class for a small text link |
| `ListItem` / `SortableList` | A list of items, and one that can be reordered |
| `Switch`, `Select`, `TextField`, … | The controls (`panel/controls.tsx`) |

Nothing goes under a control but the control. Defaults, fallbacks and notes go in the setting's description, which opens from its name. Problems and action buttons like Use current view are the only exceptions.

The Modals, the projects page and the buttons in the top bar have their own light look (`Modal.tsx`, `ui.ts`) and don't use these.
