import { describe, expect, it } from "vitest";
import { SCRIPT_ELEMENTS, STYLE_ELEMENTS, styleEndTag } from "./raw-html";

const strip = (html: string, pattern: RegExp) => html.replace(pattern, "");

describe("raw-html element patterns", () => {
  it.each([
    "</style>",
    "</style >",
    "</style\n>",
    "</style/>",
    "</style />",
    '</style class="x">',
    "</STYLE foo>",
  ])("ends a style element at %j", (endTag) => {
    expect(
      strip(`<style>a{}${endTag}<p>Keep</p><style>b{}</style>`, STYLE_ELEMENTS),
    ).toBe("<p>Keep</p>");
  });

  it.each(["</script >", "</script/>", "</SCRIPT x>"])(
    "ends a script element at %j",
    (endTag) => {
      expect(
        strip(
          `<script>1${endTag}<p>Keep</p><script>2</script>`,
          SCRIPT_ELEMENTS,
        ),
      ).toBe("<p>Keep</p>");
    },
  );

  it.each(["</stylesheet>", "</style\v>", "</style >"])(
    "does not end a style element at %j",
    (notEnd) => {
      expect(
        strip(
          `<style>a{}${notEnd}<p>Gone</p></style><p>Keep</p>`,
          STYLE_ELEMENTS,
        ),
      ).toBe("<p>Keep</p>");
    },
  );

  it("does not take a longer tag name for the element", () => {
    expect(strip("<styles>x</styles>", STYLE_ELEMENTS)).toBe(
      "<styles>x</styles>",
    );
  });

  it("hands out a fresh end-tag pattern each time", () => {
    const first = styleEndTag();
    first.exec("</style>");
    expect(styleEndTag().lastIndex).toBe(0);
  });
});
