import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import { escapeAttrValue, extractForms } from "../parser";
import { HoverOnlyContentAndNavigationAudit } from "../audits/operability-safety/hover-only-content-and-navigation";
import { mockCheckContext, mockPageContext } from "../__tests__/test-utils";

describe("Debt Item 4: CSS Selector Escaping for User/DOM Content", () => {
  describe("escapeAttrValue", () => {
    it("escapes double quotes and backslashes", () => {
      expect(escapeAttrValue('plain-id')).toBe('plain-id');
      expect(escapeAttrValue('user"name')).toBe('user\\"name');
      expect(escapeAttrValue('path\\to\\item')).toBe('path\\\\to\\\\item');
      expect(escapeAttrValue('quote"and\\slash')).toBe('quote\\"and\\\\slash');
    });
  });

  describe("extractForms with adversarial attribute values", () => {
    it("extracts labels for inputs with quotes in id without crashing Cheerio selector parser", () => {
      const html = `
        <form action="/login" method="POST">
          <label for='user"name'>Username</label>
          <input id='user"name' name="username" type="text" />
          <label for="pass\\word">Password</label>
          <input id="pass\\word" name="password" type="password" />
        </form>
      `;
      const $ = cheerio.load(html);

      // Should not throw "Attribute selector didn't terminate"
      const forms = extractForms($);
      expect(forms).toHaveLength(1);
      expect(forms[0].inputs).toHaveLength(2);
      expect(forms[0].inputs[0].label).toBe("Username");
      expect(forms[0].inputs[1].label).toBe("Password");
    });
  });

  describe("HoverOnlyContentAndNavigationAudit with adversarial id attributes", () => {
    it("safely evaluates elements with quotes and backslashes in id without throwing", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              .menu:hover .submenu { display: block; }
              .submenu { display: none; }
            </style>
          </head>
          <body>
            <button aria-controls='sub"menu'>Open</button>
            <div class="menu">
              <div id='sub"menu' class="submenu">
                <a href="/target">Target</a>
              </div>
            </div>
            <div class="hover-card" id='hover"card\\1'>Card content</div>
            <span aria-describedby='hover"card\\1'>Trigger</span>
          </body>
        </html>
      `;

      const audit = new HoverOnlyContentAndNavigationAudit();
      const ctx = mockCheckContext([
        mockPageContext("https://example.com/", html),
      ]);

      const result = await audit.audit(ctx);
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
    });
  });
});
