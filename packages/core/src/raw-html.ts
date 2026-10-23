/**
 * Raw-HTML patterns for the places that read markup as text instead of
 * parsing it. An end tag closes its element the way the HTML tokenizer
 * closes it: the name, then HTML whitespace, `/` or `>`, then anything up to
 * `>`. So `</style >`, `</style/>` and `</style x>` all end a style block,
 * and `</stylesheet>` does not.
 */
function endTag(name: string): string {
  return String.raw`<\/${name}(?=[\t\n\f\r />])[^>]*>`;
}

/** Every whole `<script>` element. Global: use with `replace` or `matchAll`. */
export const SCRIPT_ELEMENTS = new RegExp(
  String.raw`<script\b[\s\S]*?${endTag("script")}`,
  "gi",
);

/** Every whole `<style>` element. Global: use with `replace` or `matchAll`. */
export const STYLE_ELEMENTS = new RegExp(
  String.raw`<style\b[\s\S]*?${endTag("style")}`,
  "gi",
);

/** A fresh style end-tag pattern, for a scanner that moves `lastIndex`. */
export function styleEndTag(): RegExp {
  return new RegExp(endTag("style"), "gi");
}
