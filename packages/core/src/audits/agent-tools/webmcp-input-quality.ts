import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class WebmcpInputQualityAudit extends Audit {
  static override meta: AuditMeta = {
    id: '5.22',
    category: 'agent-tools',
    title: 'WebMCP tool input quality',
    failureTitle: 'WebMCP tool input quality',
    description:
      'For AI agents to correctly invoke WebMCP tools, form inputs must have descriptive name attributes, appropriate type attributes, and associated labels or descriptions. Poor input quality leads to agents guessing parameter values or skipping the tool entirely.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI agents map form inputs to tool parameters. Inputs without meaningful names (e.g., "field1"), missing types, or no labels force agents to guess what data to provide, resulting in failed submissions or incorrect values.',
      fix: 'Ensure every input in a WebMCP-declared form has a descriptive name, an appropriate type, and an associated label element or aria-label.',
      code: `<form toolname="searchProducts"
      tooldescription="Search products by keyword and filters">
  <label for="search-query">Search query</label>
  <input id="search-query" type="text" name="query"
         placeholder="e.g., red running shoes" required />

  <label for="price-max">Maximum price</label>
  <input id="price-max" type="number" name="maxPrice"
         placeholder="100" min="0" />

  <label for="category">Category</label>
  <select id="category" name="category">
    <option value="">All categories</option>
    <option value="shoes">Shoes</option>
  </select>
</form>`,
      effort: 'easy',
      docsUrl: 'https://webmcp.link/',
      tags: ['webmcp', 'inputs', 'quality', 'chrome-146'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let webmcpFormCount = 0;
    let totalInputs = 0;
    let inputsWithName = 0;
    let inputsWithLabel = 0;
    let firstPageUrl = '';

    for (const page of ctx.pages) {
      page.$('form[toolname]').each((_, formEl) => {
        webmcpFormCount++;
        if (!firstPageUrl) firstPageUrl = page.url;

        page
          .$(formEl)
          .find('input, select, textarea')
          .each((_j, inputEl) => {
            const $input = page.$(inputEl);
            const inputType = $input.attr('type') || '';
            // Skip non-data input types
            if (['hidden', 'submit', 'button', 'reset', 'image'].includes(inputType)) return;

            totalInputs++;
            const name = $input.attr('name');
            if (name && name.length > 0) inputsWithName++;

            // Check for label association
            const id = $input.attr('id');
            const ariaLabel = $input.attr('aria-label');
            const placeholder = $input.attr('placeholder');
            const escapedId = id ? id.replace(/(["\\\]:])/g, '\\$1') : '';
            const hasLabel =
              (escapedId && page.$(`label[for="${escapedId}"]`).length > 0) ||
              (ariaLabel && ariaLabel.length > 0) ||
              (placeholder && placeholder.length > 0);
            if (hasLabel) inputsWithLabel++;
          });
      });
    }

    if (webmcpFormCount === 0) {
      return this.notApplicable(
        'No WebMCP-declared forms found — input quality cannot be assessed.',
        'WebMCP form inputs have name, type, and label',
        'No WebMCP forms',
      );
    }

    if (totalInputs === 0) {
      return this.warn(
        `Found ${webmcpFormCount} WebMCP form(s) but no visible inputs.`,
        'WebMCP forms contain labeled inputs',
        '0 visible inputs',
        'medium',
        firstPageUrl,
      );
    }

    const nameRatio = inputsWithName / totalInputs;
    const labelRatio = inputsWithLabel / totalInputs;
    const allGood = nameRatio === 1 && labelRatio >= 0.8;

    if (allGood) {
      return this.pass(
        `All ${totalInputs} input(s) across ${webmcpFormCount} WebMCP form(s) have names; ${inputsWithLabel}/${totalInputs} have labels.`,
        'Inputs have name, type, and label attributes',
        `${inputsWithName}/${totalInputs} named, ${inputsWithLabel}/${totalInputs} labeled`,
        firstPageUrl,
      );
    }

    if (nameRatio >= 0.5) {
      return this.warn(
        `${inputsWithName}/${totalInputs} inputs have names, ${inputsWithLabel}/${totalInputs} have labels.`,
        'All inputs have name and label attributes',
        `${inputsWithName}/${totalInputs} named, ${inputsWithLabel}/${totalInputs} labeled`,
        'medium',
        firstPageUrl,
      );
    }

    return this.fail(
      `Only ${inputsWithName}/${totalInputs} inputs have names in WebMCP forms — agents cannot identify parameters.`,
      'All inputs have name and label attributes',
      `${inputsWithName}/${totalInputs} named, ${inputsWithLabel}/${totalInputs} labeled`,
      'medium',
      firstPageUrl,
    );
  }
}
