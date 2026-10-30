#!/bin/zsh
# Exports the runtime WebP of every 2.5D atlas in sliceAssets.ts from its PNG master in art-src/,
# at the size the game shows it (maxEdge on the longer side). Usage: zsh scripts/export-slice-webp.sh [name…]
# Needs ImageMagick (magick) and cwebp. Existing WebP files are overwritten.
set -e
cd "${0:A:h}/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
grep -o "url: '/assets/slice/chapter[0-9]*/[^']*\.webp', columns: [0-9]*, rows: [0-9]*, maxEdge: [0-9]*" src/components/render/sliceAssets.ts \
  | sed -E "s#url: '/assets/slice/([^']*)\.webp'.*maxEdge: ([0-9]+)#\1 \2#" | while read relative edge; do
  name=${relative:t}
  [[ $# -gt 0 && ${@[(Ie)$name]} -eq 0 && ${@[(Ie)$relative]} -eq 0 ]] && continue
  src=art-src/slice/$relative.png
  mkdir -p public/assets/slice/${relative:h}
  w=$(sips -g pixelWidth $src | tail -1 | awk '{print $2}')
  h=$(sips -g pixelHeight $src | tail -1 | awk '{print $2}')
  size=$(python3 -c "w,h,e=$w,$h,$edge;s=min(1,e/max(w,h));print(f'{max(1,round(w*s))}x{max(1,round(h*s))}')")
  magick $src -filter Lanczos -resize "${size}!" $tmp/$name.png
  cwebp -quiet -q 90 -alpha_q 100 -m 4 $tmp/$name.png -o public/assets/slice/$relative.webp
  echo "$name ${w}x$h -> $size"
done
