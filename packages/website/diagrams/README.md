# Website diagrams

These Mermaid sources generate the SVG images on the “How a scan works” page.
The website serves the exports directly. It needs no Mermaid browser runtime.
Keep both theme exports in `public/diagrams/` when editing a source.

From the repository root, with Chrome available to Puppeteer:

```sh
for diagram in scan-flow result-types; do
  for theme in light dark; do
    pnpm dlx @mermaid-js/mermaid-cli@11.17.0 \
      -i "packages/website/diagrams/$diagram.mmd" \
      -o "packages/website/public/diagrams/$diagram-$theme.svg" \
      -c "packages/website/diagrams/$theme.json" -b transparent
  done
done
```

Set `PUPPETEER_EXECUTABLE_PATH` to use an existing Chrome executable.
The diagrams repeat the page's plain-language explanation; adjacent prose and
image alt text provide a text equivalent. The site's theme switch selects the
matching export.
