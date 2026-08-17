import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

function tryParseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/** Coerce an unknown JSON value to a string; non-strings → ''. */
function asString(val: unknown): string {
  return typeof val === 'string' ? val : '';
}

interface CommerceAction {
  label: string;
  keywords: string[];
}

const COMMERCE_ACTIONS: CommerceAction[] = [
  {
    label: 'Product Search',
    keywords: ['search', 'find', 'query', 'browse', 'filter', 'lookup', 'catalog'],
  },
  {
    label: 'Product Detail',
    keywords: ['product', 'detail', 'productdetail', 'getproduct', 'viewproduct', 'viewitem'],
  },
  { label: 'Add to Cart', keywords: ['cart', 'addtocart', 'basket', 'additem'] },
  {
    label: 'Checkout',
    keywords: ['checkout', 'purchase', 'placeorder', 'completepurchase', 'buyproduct'],
  },
  {
    label: 'Account/Auth',
    keywords: ['login', 'register', 'signup', 'signin', 'authenticate', 'createaccount'],
  },
  {
    label: 'Contact/Support',
    keywords: ['contact', 'support', 'inquiry', 'submitinquiry', 'sendmessage', 'helpdesk'],
  },
];

const MIN_COVERAGE = 2; // At least 2 commerce actions for a passing score

export class WebmcpActionCoverageAudit extends Audit {
  static override meta: AuditMeta = {
    id: '5.25',
    category: 'agent-tools',
    title: 'WebMCP commerce action coverage',
    failureTitle: 'WebMCP commerce action coverage',
    description:
      'For e-commerce sites, WebMCP tools should cover key commerce actions: product search, product detail, add to cart, checkout, and contact/support. Broader action coverage means AI agents can complete more user tasks without falling back to manual browsing.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI shopping agents need to complete full purchase journeys — search, view, add to cart, checkout. If your WebMCP tools only cover search but not checkout, agents abandon the flow and users turn to competitors with full coverage.',
      fix: 'Expose WebMCP tools for the key commerce actions: product search, product detail/view, add to cart, checkout/purchase, and contact/support.',
      code: `// /.well-known/webmcp — full commerce coverage
{
  "tools": [
    {
      "name": "searchProducts",
      "description": "Search the product catalog by keyword, category, or filters",
      "annotations": { "readOnlyHint": true },
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": { "type": "string" },
          "category": { "type": "string" },
          "maxPrice": { "type": "number" }
        },
        "required": ["query"]
      }
    },
    {
      "name": "getProductDetails",
      "description": "Get full details for a specific product by ID or URL",
      "annotations": { "readOnlyHint": true },
      "inputSchema": {
        "type": "object",
        "properties": { "productId": { "type": "string" } },
        "required": ["productId"]
      }
    },
    {
      "name": "addToCart",
      "description": "Add a product to the shopping cart with quantity",
      "annotations": { "readOnlyHint": false, "idempotentHint": false },
      "inputSchema": {
        "type": "object",
        "properties": {
          "productId": { "type": "string" },
          "quantity": { "type": "integer", "minimum": 1 }
        },
        "required": ["productId"]
      }
    },
    {
      "name": "checkout",
      "description": "Initiate checkout for the current cart",
      "annotations": { "readOnlyHint": false, "confirmationRequired": true },
      "inputSchema": {
        "type": "object",
        "properties": { "shippingMethod": { "type": "string" } }
      }
    }
  ]
}`,
      effort: 'moderate',
      docsUrl: 'https://webmcp.link/',
      tags: ['webmcp', 'commerce', 'coverage', 'chrome-146'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const toolSignatures: string[] = [];
    const seen = new Set<string>();

    // Collect tool names + descriptions from manifest (canonical source)
    const manifestResult = ctx.rootFiles['/.well-known/webmcp'];
    if (manifestResult?.status === 200 && manifestResult.body) {
      const parsed = tryParseJson(manifestResult.body);
      if (isObject(parsed) && Array.isArray(parsed['tools'])) {
        for (const tool of parsed['tools'] as unknown[]) {
          if (isObject(tool)) {
            const name = asString(tool['name']);
            const sig = `${name} ${asString(tool['description'])}`.toLowerCase();
            toolSignatures.push(sig);
            if (name) seen.add(name);
          }
        }
      }
    }

    // Collect from declarative forms, skip duplicates
    for (const page of ctx.pages) {
      page.$('form[toolname]').each((_, el) => {
        const name = page.$(el).attr('toolname') || '';
        if (name && seen.has(name)) return;
        const desc = page.$(el).attr('tooldescription') || '';
        const action = page.$(el).attr('action') || '';
        toolSignatures.push(`${name} ${desc} ${action}`.toLowerCase());
        if (name) seen.add(name);
      });
    }

    if (toolSignatures.length === 0) {
      return this.notApplicable(
        'No WebMCP tools found — commerce action coverage cannot be assessed.',
        `At least ${MIN_COVERAGE} commerce actions covered (search, product, cart, checkout, contact)`,
        'No WebMCP tools',
      );
    }

    // Match tools against commerce actions
    const coveredActions: string[] = [];
    const missingActions: string[] = [];

    for (const action of COMMERCE_ACTIONS) {
      const matched = toolSignatures.some((sig) =>
        action.keywords.some((kw) => new RegExp(`\\b${kw}\\b`).test(sig)),
      );
      if (matched) {
        coveredActions.push(action.label);
      } else {
        missingActions.push(action.label);
      }
    }

    const coverage = coveredActions.length;
    const total = COMMERCE_ACTIONS.length;

    if (coverage >= 4) {
      return this.pass(
        `${coverage}/${total} commerce actions covered: ${coveredActions.join(', ')}.`,
        `At least ${MIN_COVERAGE} commerce actions covered`,
        `${coverage}/${total} covered`,
      );
    }

    if (coverage >= MIN_COVERAGE) {
      return this.warn(
        `${coverage}/${total} commerce actions covered: ${coveredActions.join(', ')}. Missing: ${missingActions.join(', ')}.`,
        `At least 4 commerce actions covered for strong agent support`,
        `${coverage}/${total} covered`,
        'medium',
      );
    }

    return this.fail(
      `Only ${coverage}/${total} commerce actions covered: ${coveredActions.length > 0 ? coveredActions.join(', ') : 'none'}. Missing: ${missingActions.join(', ')}.`,
      `At least ${MIN_COVERAGE} commerce actions covered`,
      `${coverage}/${total} covered`,
      'medium',
    );
  }
}
