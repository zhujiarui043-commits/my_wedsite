# Welcome handwriting

`glyphs.json` contains only the characters needed by the homepage's three greetings and welcome message. These are centerline pen strokes, not font outlines, so each stroke can be drawn in writing order with SVG dash animation.

The glyphs are from the original Hershey **cursive** font ("Script 1-stroke (alt)"), converted to JSON by James T / techninja:

- Source: https://github.com/techninja/hersheytextjs/blob/master/hersheytext.json
- Data license: **Public Domain**, as stated at https://github.com/techninja/hersheytextjs#readme ("JSON data Public Domain, All other code MIT Licensed.")

Only font data is included; no renderer or library code is copied. Glyph advances are twice the source's `o` values. Each `M` command starts a separate pen stroke. The original polylines are rounded with quadratic curves: each interior point is a control point, and adjacent segment midpoints are curve endpoints. Stored lengths approximate these curves with 12 samples per segment, plus the straight ends. The local welcome renderer centers the lines and sets stroke duration from those lengths.
