# Interface

Themes and skins, typography, motion, screen layout and the Library's structure. Notes' own screens are in [notes.md](../NOTES.md); the status indicator in [status-indicator.md](status-indicator.md).

## Themes and skins

Glass + Dark is the default presentation for a new installation. Returning users restore their saved skin and theme through a synchronous first-paint mirror; canonical preferences repair that mirror after persistence hydration. Mobile layouts include safe-area support, dynamic viewport units, coarse-pointer target sizing and dedicated phone/tablet navigation behavior.

A theme (`dark` / `light`) chooses semantic colour roles; a skin (Director / Glass / Aurora) chooses how those roles look. Theme definitions never name a skin, and skin-specific styling is always scoped by `data-presentation`, never by the theme alone. Current theme and presentation identifiers come from the presentation manifest. Historical theme aliases and rewrite paths are absent from this branch.

Director keeps the host palettes: neon lime on black for Dark, and paper, ink and signal orange for Light (lime cannot carry text on a light ground). Glass is a separate visual language. It sets its own values for the same semantic roles for each theme (iris on midnight, indigo on cool daylight). It uses sentence-case Barlow with tabular figures instead of condensed capitals and terminal mono. Every text role stays at WCAG AA or better on its surfaces.

Aurora is a third skin and a preserved snapshot of Glass, taken before Glass is reimagined. It is its own startup pack (`external/aurora.js`), keyed to its own presentation, typography, shape, material and depth IDs (`aurora`), so later Glass work never changes it. It loads synchronously beside Glass, so a saved Aurora choice paints without a flash.

## Typography and heroes

Capitalisation and caps tracking are typography roles. Rules use `--sd-type-transform-title`, `--sd-type-transform-label` or `--sd-type-transform-control`, and scale any capitals letter-spacing by `--sd-type-caps-tracking-scale`. A skin therefore restyles them in one place, never selector by selector.

Each screen has one hero object, so pages are layered rather than uniform: the Execute countdown, the Review summary and the current Plan block. A hero may be a colour island, meaning it re-declares the semantic roles locally so its children keep reading ordinary tokens. Director Light renders its heroes as dark lime-on-black instruments set into the paper, and Notes as a white writing sheet. Glass Light renders vivid gradient heroes, and Glass Dark gives them a luminous gradient rim. Glass also has an atmosphere: navigation sets `data-sd-area` on the document, and four registered aurora colours glide between per-area moods behind a single fixed aurora and grain layer. The colours are set on that layer (`body::before`) and do not inherit, so the glide restyles one layer per frame, not the whole page.

Execute's Notes title and Area context share a typographic baseline in core CSS. Glass adjusts spacing only and inherits that alignment. Font sizes remain independent; no theme-specific centering or duplicate Execute alignment rules override the baseline.

## Motion

Motion is presentation-owned. Native View Transitions are used at exactly one boundary, `runAppearanceChange`. A theme or skin change is synchronous, so the snapshot never waits on storage, plugins or layout. The new appearance is revealed from the chosen control: Director scans it in with a hard edge, and Glass blooms it open with a feathered mask. Element transitions are suppressed while the reveal runs. Without the API, colour roles crossfade through `data-sd-appearance-shift`. Asynchronous tab navigation and the lazy Library, Guide and Insights surfaces stay snapshot-free, so a slow load can never freeze or ghost the screen. A tab change instead marks the arriving pane with `data-sd-enter` for one CSS entrance (Director: HUD flicker; Glass: soft float), which uses only opacity and transform with backwards fill. Insights arrives without it only on a first open, while it renders progressively behind its own loading panel (running both made that render about 300 ms slower); reopened, it shows the view it kept and animates like any pane. Beyond navigation and appearance, a small motion system covers the rest. Dialogs, the display menu and the nudge arrive with one surface entrance. Primary disclosures unfold through `::details-content` with interpolated height. Buttons give a press: a 1px drop in Director, a slight scale in Glass and Aurora. Finishing a Plan block gets a single completion moment. Rows are rebuilt on every render, so the Plan renderer remembers which rows it last saw incomplete. Only a row that flips to complete gets the moment; a rebuild during it resumes through a negative delay, and the marker is cleared once played, so it never replays. All timings are skin tokens (`--sd-motion-surface-*`, `--sd-motion-disclosure-*`, `--sd-motion-moment-duration`). Reduced motion removes every entrance, reveal, crossfade, unfold, press and moment.

## Library

The Library shows one of three sections, chosen by a switch at the top: **Notes** (the default), **Days** (the Diary panel, then Saved Days with their filters, list and expanded day) and **Data** (backup locations and versions, Files, which is the attachment manager, and storage use with the danger zone). `source/core/library.ts` owns the switch and remembers the section, whether the Diary panel is open, the notes order and the list width in one preference (`studyDirector.library.view.v1`). Only the shown section renders, and only while the Library tab is active; an attachment link opens Data → Files, a note reference opens Notes and a Saved Day opens Days. On a computer the Notes section fills the window, the list taking about a third of the width and the note two thirds. The list's right edge drags (or, focused, takes the arrow keys) to any width between 200 px and 60% of the panel; the width is remembered, and a double-click or Enter returns it to a third. Phones show the list, then the note.

## Quality bar

- Every text role passes WCAG AA contrast in all six skin and theme pairs; axe runs on the main screens in each.
- New screens follow the typography roles (capitals and tracking come from `--sd-type-transform-*`, never a hard-coded `uppercase`).
- Pop-ups, panels and dialogs are checked at laptop and phone widths with screenshots before a UI change is finished.
- Browser tests wait for motion to settle (`settleMotion` in the browser harness) before measuring or clicking.

## Safe areas

The page uses `viewport-fit=cover`, so on iPhone, iPad and notched Macs it reaches under the status bar and camera cut-out. Everything that touches an edge adds the matching `--sd-safe-*` inset (`env(safe-area-inset-*)`). A top navigation bar (narrow Director layout) carries the top inset itself. Where nothing sits at the top (the floating bottom bar of Glass and Aurora, and every layout wider than 900 px), the main area starts below it, so page titles, tabs and notices never sit under the status strip.
