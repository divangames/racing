# Race-control menu assets

Generated with imagegen from the supplied menu reference on 2026-10-03.
The reference is used for the industrial material treatment only. Background,
character, vehicle and game logo continue to use their existing game assets.

- `race-control-atlas.png`: three equal-height horizontal source bands: idle
  plate, selected plate, status material. Blank plates have no baked typography.
  The menu currently uses bands 0 and 1; the compact status uses token colors.
- `race-control-icons.png`: transparent atlas, three columns by two rows.
  Play, load, race flag; settings, developers, exit. Draw whole grid cells to
  retain their padding and consistent optical size.
- `race-control-status.png`: three transparent cells: helmet, car, pilot.

The refined reference layout uses a 1280 × 720 design space: shell at (33,217),
first idle row at (42,249), 428-wide idle rows, 44/59 row heights, 6-unit gaps.
The selected row extends left by 8 and grows in width by 18. Descriptions appear
on every row. Only blank center metal from the plate atlas is sampled; bevels,
indices, segment edges, guides and arrows are drawn as independent components.

Canvas components in `../title-ui.js` draw the images, live Bender text,
indices, status, focus edge and amber guide independently. CSS tokens are in
`../title-ui.css`. Do not replace these with a flattened menu screenshot.

QA: `node --test tests/title-ui.test.cjs` and
`electron tools/check-title-ui.cjs`. The Electron check uses a temporary profile
and mocks asset-save handlers; it must not write to user cars/tracks/chapters.

`camera-calibration-atlas.png` is the user-supplied `HUD/cursor/panel_cam.png`.
The camera screen samples blank perimeter strips, handles and the insignia only.
Its heading, instructions, slider, ticks, value, action and hotkeys are live Bender
Canvas elements. The baked full panel is never drawn. Camera QA:
`electron tools/check-camera-ui.cjs`, with temporary profile and save isolation.
