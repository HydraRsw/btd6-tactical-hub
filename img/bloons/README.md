# Bloon pictures (optional)

The Rounds tab draws a simple icon for every bloon. If you'd rather show real
bloon pictures, put PNG files in this folder and the site uses them
automatically; any bloon without a file keeps the drawn icon.

## File names

All lowercase, `.png`:

| Bloon | File |
| --- | --- |
| Red, Blue, Green, Yellow, Pink | `red.png`, `blue.png`, `green.png`, `yellow.png`, `pink.png` |
| Black, White, Purple, Lead, Zebra | `black.png`, `white.png`, `purple.png`, `lead.png`, `zebra.png` |
| Rainbow, Ceramic | `rainbow.png`, `ceramic.png` |
| MOAB-class | `moab.png`, `bfb.png`, `zomg.png`, `ddt.png`, `bad.png` |

### Variants (optional)

For Camo, Regrow and Fortified versions, add the words in this order before the
bloon name, joined with `-`: `fortified`, `camo`, `regrow`. For example:

- `camo-green.png`
- `regrow-rainbow.png`
- `fortified-ceramic.png`
- `fortified-camo-regrow-lead.png`
- `fortified-moab.png`

If a variant file is missing, the plain bloon picture (`lead.png`) is used, and
if that's missing too, the drawn icon. DDTs are always Camo, so they just use
`ddt.png` (or `fortified-ddt.png`).

## Tips

- Square images with a transparent background look best; they're shown at about
  20 × 20 pixels (26 wide for blimps).
- After adding files, commit and push them; GitHub Pages picks them up within a
  few minutes.
- Bloon artwork belongs to Ninja Kiwi. Use pictures you're allowed to use, and
  keep the fan-content disclaimer in the footer.
