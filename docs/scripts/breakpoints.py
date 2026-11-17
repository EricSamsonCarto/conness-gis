"""Writes docs/docs/stylesheets/extra.css: the full desktop layout (left nav
sidebar + table of contents) down to MIN_WIDTH, with no medium layout.

zensical's theme shows the nav sidebar only from 76.25em (1220px), turning it
into a slide-out drawer below that, and the table of contents only from 60em
(960px), turning it into a floating button below that. CSS can't move a media
query, so for each of the two, this copies the theme's desktop rules down to
MIN_WIDTH and undoes its mobile rules in that range.

The CSS is tied to the installed zensical version (pinned in requirements.txt).
After upgrading zensical, re-run from docs/:

    .venv/bin/python scripts/breakpoints.py

It stops with an error if the theme's drawer rules changed in a way the table
below doesn't cover, rather than writing CSS that's quietly wrong.
"""

import re
import sys
from importlib.metadata import version
from pathlib import Path

import zensical

# the narrowest width that keeps the desktop sidebars; below it, the theme's
# mobile layout (drawer nav, floating table-of-contents button).
MIN_WIDTH = "53.125em"  # 850px

# what each mobile-layout rule's properties go back to on desktop. Values come
# from the theme's base rules (outside any media query) for that element. None:
# nothing to undo, the rule has no effect once the desktop rules apply.
NAV_UNDO = {
    ".md-header__button.md-logo": "display: inline-block",
    ".md-nav--primary": "margin-left: 0; margin-right: 0",
    ".md-nav .md-nav__title[for=__drawer]": "display: none",
    ".md-nav .md-nav__title[for=__drawer] .md-logo": None,
    ".md-nav .md-nav__title[for=__drawer] .md-logo img,.md-nav .md-nav__title[for=__drawer] .md-logo svg": None,
    ".md-nav .md-nav__title[for=__drawer] .md-logo img.lucide,.md-nav .md-nav__title[for=__drawer] .md-logo svg.lucide": None,
    "[dir=ltr] .md-sidebar--primary": "left: auto",
    "[dir=rtl] .md-sidebar--primary": "right: auto",
    ".md-sidebar--primary": (
        "-webkit-backdrop-filter: none; backdrop-filter: none; background-color: transparent; "
        "border-radius: 0; position: sticky; top: 2.4rem; transform: none; transition: none; z-index: auto"
    ),
    "[data-md-toggle=drawer]:checked~.md-container .md-sidebar--primary": "box-shadow: none; transform: none",
    "[dir=rtl] [data-md-toggle=drawer]:checked~.md-container .md-sidebar--primary": "transform: none",
    ".md-sidebar--primary .md-sidebar__scrollwrap": "position: static; overscroll-behavior-y: auto",
    "[dir=ltr] .md-sidebar__inner": "padding-right: calc(100% - 11.5rem)",
    "[dir=rtl] .md-sidebar__inner": "padding-left: calc(100% - 11.5rem)",
    ".md-overlay": "display: none",
    "[data-md-toggle=drawer]:checked~.md-overlay": "display: none",
    ".md-tabs": None,  # the navigation.tabs feature is off
    # blog post layout (zensical 0.0.71+); this site has no blog
    ".md-post__back": None,
    ".md-content--post": None,
    ".md-sidebar.md-sidebar--post": None,
    ".md-sidebar.md-sidebar--post .md-sidebar__scrollwrap": None,
    ".md-sidebar.md-sidebar--post .md-sidebar__inner": None,
    ".md-sidebar.md-sidebar--post .md-post__meta": None,
    ".md-sidebar.md-sidebar--post .md-nav__item": None,
    ".md-sidebar.md-sidebar--post .md-nav__list": None,
    ".md-sidebar.md-sidebar--post .md-nav__link": None,
    ".md-sidebar.md-sidebar--post .md-nav": None,
}

# the table of contents' floating-button rules. The header's compact search
# and the language select (also in this block) are left as they are.
TOC_UNDO = {
    "body[data-md-scrolllock]": None,
    ".md-search": None,
    ".md-select__inner": None,
    ".md-select:focus-within .md-select__inner,.md-select:hover .md-select__inner": None,
    ".md-select__inner:after": None,
    ".md-sidebar--secondary": (
        "bottom: auto; padding: 1.1rem 0; position: sticky; right: auto; top: 2.4rem; width: 12.1rem; z-index: auto"
    ),
    ".md-sidebar--secondary .md-nav--secondary": "margin-top: .1rem",
    ".md-sidebar--secondary .md-nav__title": "padding: .35rem .6rem",
    ".md-sidebar--secondary .md-sidebar__scrollwrap": (
        "display: block; flex-direction: row; overflow-y: auto; position: static"
    ),
    ".md-sidebar--secondary .md-sidebar__inner": (
        "background-color: transparent; border-radius: 0; bottom: auto; box-shadow: none; max-height: none; "
        "opacity: 1; overflow-y: visible; padding-bottom: 0; pointer-events: auto; position: static; "
        "right: auto; transform: none; transition: none; width: auto"
    ),
    ".md-sidebar--secondary [type=checkbox]:checked~.md-sidebar__inner": None,
    # the button itself is hidden by the copied desktop rule.
    ".md-sidebar--secondary .md-sidebar-button": None,
    ".md-sidebar--secondary .md-sidebar-button:after": None,
    ".md-sidebar--secondary .md-sidebar-button:focus,.md-sidebar--secondary .md-sidebar-button:hover": None,
    ".md-sidebar--secondary .md-sidebar-button__wrapper": None,
}

# (desktop query to copy, mobile query to undo, undo table, which desktop rules
# to copy, top of the range the override covers)
RANGES = [
    ("screen and (min-width:76.25em)", "screen and (max-width:76.234375em)", NAV_UNDO, None, "76.234375em"),
    ("screen and (min-width:60em)", "screen and (max-width:59.984375em)", TOC_UNDO, "md-sidebar", "59.984375em"),
]

# the theme's JavaScript sizes each sidebar only above its own breakpoint, and
# its desktop CSS sets `height: 0` for the script to replace, so give them a
# height in the override's range.
SIZE_SIDEBARS = (
    ".md-sidebar--primary, .md-sidebar--secondary { height: calc(100vh - 2.4rem); }\n"
    "  .md-sidebar .md-sidebar__scrollwrap { max-height: 100%; }"
)


def media_blocks(css, query):
    out, i, head = [], 0, "@media " + query + "{"
    while (k := css.find(head, i)) != -1:
        start = j = k + len(head)
        depth = 1
        while depth:
            depth += {"{": 1, "}": -1}.get(css[j], 0)
            j += 1
        out.append(css[start : j - 1])
        i = j
    return out


def rules(block):
    return re.findall(r"([^{}]+)(\{[^{}]*\})", block)


def main():
    stylesheets = Path(zensical.__file__).parent / "templates/assets/stylesheets/modern"
    theme = next(stylesheets.glob("main.*.min.css"))
    css = theme.read_text()

    sections = []
    for desktop_q, mobile_q, undo, only, top in RANGES:
        mobile = [sel.strip() for b in media_blocks(css, mobile_q) for sel, _ in rules(b)]
        unknown = [sel for sel in mobile if sel not in undo]
        if unknown:
            sys.exit(f"zensical's ({mobile_q}) rules changed; add these first:\n  " + "\n  ".join(unknown))
        undone = "\n  ".join(f"{sel} {{ {decl}; }}" for sel, decl in undo.items() if decl and sel in mobile)
        desktop = "".join(
            sel + body
            for b in media_blocks(css, desktop_q)
            for sel, body in rules(b)
            if only is None or only in sel
        )
        sections.append(
            f"@media screen and (min-width: {MIN_WIDTH}) and (max-width: {top}) {{\n"
            f"  /* undo the theme's {mobile_q} rules */\n"
            f"  {undone}\n"
            f"  /* the theme's {desktop_q} rules{', sidebar ones only' if only else ''} */\n"
            f"  {desktop}\n"
            "}\n"
        )

    out = Path(__file__).parent.parent / "docs/stylesheets/extra.css"
    out.parent.mkdir(exist_ok=True)
    out.write_text(
        f"/* generated by docs/scripts/breakpoints.py from zensical {version('zensical')} ({theme.name});\n"
        f"   don't edit by hand. Desktop sidebars down to {MIN_WIDTH} (850px): no medium layout. */\n"
        + "\n".join(sections)
        + f"\n@media screen and (min-width: {MIN_WIDTH}) and (max-width: 76.234375em) {{\n"
        "  /* sized here because the theme's JS only sizes the sidebars above their breakpoints */\n"
        f"  {SIZE_SIDEBARS}\n"
        "}\n"
    )
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
