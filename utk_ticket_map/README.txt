UTK ticket risk map


Files
  index.html        page layout
  style.css         styling
  app.js            map, time slider, coloring (read-only, no editing on the page)
  data/lot_risk.js  ticket risk for each lot x 48 fifteen-minute windows (6:00 AM - 5:45 PM)
  data/lots.js      traced lot outlines - each lot has a list of "shapes", each a list of
                    [lat, lng] corners (split lots have more than one shape)

Lot outlines
  The outlines in data/lots.js were traced by hand over OpenStreetMap, using the official
  UTK campus map as a visual reference. They are fixed; the page has no edit mode.
  Only lots with an outline appear on the map and in the rankings. Motorcycle parking is
  left out on purpose: it is spread across too many small areas to rate.
  To change an outline later, edit the corner coordinates in data/lots.js directly.

Updating the data
  data/lot_risk.js holds, for each lot, the share of regular weekdays with at least one
  ticket in each 15-minute window. To show XGBoost predictions instead, regenerate the
  file with the same shape: one "risk" list of 48 numbers between 0 and 1 per lot.
  Lot names must match the names in data/lots.js exactly.
