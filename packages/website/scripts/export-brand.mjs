import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  copyFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

// Mechanical exports from the approved SVG masters. Never overwrite the masters.
const root = fileURLToPath(new URL("../public/brand/", import.meta.url));
const out = join(root, "kit");
for (const dir of ["source", "svg", "png", "icons", "print"])
  mkdirSync(join(out, dir), { recursive: true });
const icon = readFileSync(join(root, "agent-lighthouse-icon.svg"), "utf8");
const mark = icon.slice(icon.indexOf("  <rect"), icon.lastIndexOf("</svg>"));
const bare = mark.replace(/\s*<rect[^>]*\/>/, "");
const wrap = (width, height, body, title = "Agent Lighthouse") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title"><title id="title">${title}</title>${body}</svg>`;
const type = (body, color) =>
  `<g font-family="Avenir Next, Segoe UI, sans-serif" fill="${color}">${body}</g>`;
const variants = new Map();
variants.set("icon", icon);
for (const [mode, ink, surface] of [
  ["light", "#101828", "#ffffff"],
  ["dark", "#f5f7ff", "#080e1c"],
]) {
  const master = readFileSync(
    join(root, `agent-lighthouse-logo${mode === "dark" ? "-dark" : ""}.svg`),
    "utf8",
  );
  variants.set(`rectangle-${mode}`, master);
  variants.set(
    `rectangle-${mode}-transparent`,
    master.replace(/\s*<rect x="1"[^>]*\/>/, ""),
  );
  variants.set(
    `horizontal-${mode}`,
    wrap(
      1000,
      200,
      `<g transform="translate(20 20) scale(.625)">${mark}</g>` +
        type(
          '<text x="216" y="124" font-size="66" font-weight="750" letter-spacing="-2.5">Agent Lighthouse</text>',
          ink,
        ),
    ),
  );
  variants.set(
    `stacked-${mode}`,
    wrap(
      600,
      600,
      `<rect width="600" height="600" rx="48" fill="${surface}"/><g transform="translate(156 64) scale(1.125)">${mark}</g>` +
        type(
          '<text x="300" y="432" text-anchor="middle" font-size="40" font-weight="500" letter-spacing="-1">Agent</text><text x="300" y="498" text-anchor="middle" font-size="64" font-weight="750" letter-spacing="-2.5">Lighthouse</text>',
          ink,
        ),
    ),
  );
}
for (const [name, color] of [
  ["black", "#000000"],
  ["white", "#ffffff"],
  ["indigo", "#4f46e5"],
]) {
  const mono = bare.replace(/#fff\b|#c7d2fe/g, color);
  variants.set(
    `mark-${name}`,
    wrap(256, 256, mono, `Agent Lighthouse ${name} mark`),
  );
  if (name !== "indigo")
    variants.set(
      `horizontal-${name}-mono`,
      wrap(
        1000,
        200,
        `<g transform="translate(20 20) scale(.625)">${mono}</g>` +
          type(
            '<text x="216" y="124" font-size="66" font-weight="750" letter-spacing="-2.5">Agent Lighthouse</text>',
            color,
          ),
      ),
    );
}
variants.set(
  "social-card",
  wrap(
    1200,
    630,
    '<rect width="1200" height="630" fill="#080e1c"/>' +
      `<g transform="translate(80 120) scale(1.125)">${mark}</g>` +
      type(
        '<text x="424" y="230" font-size="48" font-weight="500">Agent</text><text x="420" y="316" font-size="84" font-weight="750" letter-spacing="-3">Lighthouse</text><text x="84" y="492" font-size="32" font-weight="500">Open-source website checks for AI readiness.</text>',
        "#f5f7ff",
      ),
  ),
);

const run = (cmd, args) =>
  execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
for (const [name, source] of variants) {
  const input = join(out, "source", `${name}.svg`);
  const svg = join(out, "svg", `${name}.svg`);
  writeFileSync(input, source);
  run("inkscape", [
    input,
    "--export-text-to-path",
    "--export-plain-svg",
    `--export-filename=${svg}`,
  ]);
  if (/<text\b/.test(readFileSync(svg, "utf8")))
    throw new Error(`Text remains in ${name}`);
  const width =
    name === "social-card"
      ? 1200
      : name.startsWith("mark-") || name === "icon"
        ? 1024
        : name.startsWith("stacked")
          ? 1200
          : 2000;
  run("inkscape", [
    svg,
    `--export-width=${width}`,
    `--export-filename=${join(out, "png", `${name}.png`)}`,
  ]);
  console.log(`Exported ${name}`);
}
for (const size of [16, 32, 48, 64, 180, 192, 512, 1024]) {
  run("inkscape", [
    join(out, "svg/icon.svg"),
    `--export-width=${size}`,
    `--export-filename=${join(out, "icons", `icon-${size}.png`)}`,
  ]);
}
copyFileSync(join(out, "svg/icon.svg"), join(out, "icons/favicon.svg"));
// GitHub recommends a 2:1 preview; extend the canvas without distorting the mark.
run("inkscape", [
  join(out, "svg/social-card.svg"),
  "--export-area=-40:-5:1240:635",
  "--export-width=1280",
  "--export-background=#080e1c",
  "--export-background-opacity=1",
  `--export-filename=${join(root, "github-social-preview.png")}`,
]);
run("magick", [
  join(out, "icons/icon-16.png"),
  join(out, "icons/icon-32.png"),
  join(out, "icons/icon-48.png"),
  join(out, "icons/favicon.ico"),
]);
for (const name of ["rectangle-light", "horizontal-black-mono", "mark-black"]) {
  run("inkscape", [
    join(out, "svg", `${name}.svg`),
    `--export-filename=${join(out, "print", `${name}.pdf`)}`,
  ]);
}
copyFileSync(join(root, "BRAND.md"), join(out, "README.md"));

const cards = [...variants.keys()]
  .map(
    (name) =>
      `<figure class="${/dark|white|social/.test(name) ? "dark" : ""}"><img src="svg/${name}.svg" alt="${name.replaceAll("-", " ")}"><figcaption>${name} <a href="svg/${name}.svg" download>SVG</a> / <a href="png/${name}.png" download>PNG</a></figcaption></figure>`,
  )
  .join("");
writeFileSync(
  join(out, "index.html"),
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Agent Lighthouse brand set</title><style>*{box-sizing:border-box}body{margin:0;background:#f6f7fb;color:#101828;font-family:"Avenir Next","Segoe UI",sans-serif}main{max-width:1200px;padding:48px 24px;margin:auto}h1{font-size:clamp(36px,6vw,64px);letter-spacing:-.05em;margin:12px 0}p{max-width:640px;line-height:1.6;color:#526078}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}figure{min-width:0;margin:0;padding:24px;border:1px solid #dde2ec;border-radius:24px;background:#fff;display:flex;flex-direction:column;justify-content:space-between;gap:24px}.dark{background:#080e1c;color:#f5f7ff;border-color:#29364b}img{display:block;width:100%;height:200px;object-fit:contain}figcaption{font-size:13px;overflow-wrap:anywhere}a{color:inherit;text-underline-offset:3px}.eyebrow{font:12px monospace;letter-spacing:.15em;color:#4338ca}.swatches{display:flex;gap:12px;flex-wrap:wrap;margin:32px 0}.swatches span{padding:16px 20px;border-radius:12px;border:1px solid #dde2ec}.small{display:flex;gap:24px;align-items:end;margin:32px 0;flex-wrap:wrap}.small img{width:auto;height:auto}.small figure{padding:16px;gap:12px}@media(max-width:650px){.grid{grid-template-columns:minmax(0,1fr)}main{padding:32px 16px}}</style><main><div class="eyebrow">AGENT LIGHTHOUSE / BRAND SET</div><h1>A clear mark. In every format.</h1><p>The approved AI lighthouse. The A uses its original position beside the lighthouse. The beacon stays the focus. This set follows the website's colors and type.</p><p><a href="README.md">Usage guide</a> · SVG text is outlined for consistent display. Editable text remains in the source folder.</p><div class="swatches"><span style="background:#4f46e5;color:white">Indigo #4F46E5</span><span style="background:#c7d2fe">Beam #C7D2FE</span><span style="background:#080e1c;color:white">Night #080E1C</span><span style="background:#101828;color:white">Ink #101828</span><span>White #FFFFFF</span></div><div class="grid">${cards}</div><h2>Small-size icons</h2><div class="small">${[16, 32, 48, 64].map((n) => `<figure><img src="icons/icon-${n}.png" width="${n}" height="${n}" alt="${n} pixel icon"><figcaption>${n} px</figcaption></figure>`).join("")}</div><p>Use 32 px or larger when space allows. The 16 px favicon has less detail.</p></main></html>`,
);
// Validate every shipped SVG, including the editable sources.
for (const dir of ["svg", "source"])
  for (const file of readdirSync(join(out, dir)))
    run("xmllint", ["--noout", join(out, dir, file)]);
execFileSync(
  "zip",
  ["-qr", join(root, "agent-lighthouse-brand-kit.zip"), "kit"],
  { cwd: root },
);
console.log(
  `Brand set complete: ${variants.size} SVG variants, PNGs, icons, PDFs, guide and ZIP.`,
);
