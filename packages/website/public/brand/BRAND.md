# Agent Lighthouse brand guide

Agent Lighthouse is an open-source project for website AI readiness checks.
Use the name **Agent Lighthouse**. Keep both words capitalized.

## The approved mark

The uppercase A sits in its original position beside an I shaped like a lighthouse.
The A rises above the bar over the tower. Both share a baseline.
The dot and two beams form the beacon. Do not change these proportions.

## Choose a file

- `svg/rectangle-light.svg` and `rectangle-dark.svg`: the main framed logos.
- `svg/rectangle-*-transparent.svg`: the same logo without the outer frame.
- `svg/horizontal-light.svg`: one-line name for light backgrounds.
- `svg/horizontal-dark.svg`: one-line name for dark backgrounds.
- `svg/stacked-*.svg`: square layouts with the name below the mark.
- `svg/icon.svg`: the approved square icon, without the name.
- `svg/mark-*.svg`: transparent, single-color marks.
- `svg/horizontal-*-mono.svg`: single-color logos for print or limited-color use.
- `svg/social-card.svg`: a 1200 × 630 px social image. This is an asset, not a site metadata change.
- `png/`: raster copies. Logos are 2000 px wide; stacked versions are 1200 px;
  marks are 1024 px; the social image is 1200 × 630 px.
- `icons/`: 16, 32, 48, 64, 180, 192, 512 and 1024 px PNGs, SVG favicon,
  and a multi-size ICO. These are regular icons, not maskable app icons.
- `print/`: vector PDFs. These use RGB colors; ask your printer for a CMYK proof.
- `source/`: editable SVGs with live text.

All distribution SVGs use outlined letters. They need no installed font.
Editable sources use Avenir Next with Segoe UI and sans-serif fallbacks.
This set does not include font files or grant font licenses.

## Colors

| Color       | Hex       | Use                               |
| ----------- | --------- | --------------------------------- |
| Indigo      | `#4F46E5` | Icon tile and primary brand color |
| Pale indigo | `#C7D2FE` | Light beams                       |
| Night       | `#080E1C` | Dark background                   |
| Ink         | `#101828` | Name on light backgrounds         |
| White       | `#FFFFFF` | Mark and light background         |
| Soft white  | `#F5F7FF` | Name on dark backgrounds          |

## Space and size

Leave at least one beacon diameter of clear space around the visible mark.
Keep the full SVG canvas when placing assets; it includes spacing.
Use the icon at 32 px or larger when possible. Reserve 16 px for favicons.
Use the full-name logo at 240 px or wider. Use the icon when space is tighter.
Always check the final display size.

Use light-name assets on dark backgrounds and dark-name assets on light ones.
Do not stretch, rotate, crop the beacon, add shadows, change the AI proportions,
or place the transparent mark on a busy image. Do not add vendor marks or imply
endorsement. Keep Agentic Storefront separate from the open-source project logo.

## Rebuild

The three `agent-lighthouse-*.svg` files one level above this kit are the approved
masters. The export script reads them without changing them.

From the repository root:

```sh
node packages/website/scripts/export-brand.mjs
```

Requires Node.js, Inkscape, ImageMagick (`magick`), `xmllint`, `zip`, and the
chosen source font. The initial export used Inkscape 1.4.4 and Avenir Next on macOS.
Keep the outlined SVGs if you cannot reproduce that font environment.
