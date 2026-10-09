import { allJsonLdNodes } from "#core/parser";

type SchemaNode = Record<string, unknown>;

/** schema.org types that name one purchasable product. */
export const PRODUCT_TYPES = ["Product", "IndividualProduct", "ProductModel"];

const PRODUCT_GROUP = "ProductGroup";

/**
 * ProductGroup properties that describe the group, not a variant. Everything
 * else on the group (brand, name, aggregateRating, offers, category, ...) is
 * shared by every variant: Google's product variant documentation places
 * common properties on the ProductGroup and only the varying ones on each
 * `hasVariant` entry.
 */
const GROUP_ONLY = new Set([
  "@context",
  "@id",
  "@type",
  "hasVariant",
  "productGroupID",
  "url",
  "variesBy",
]);

function isNode(value: unknown): value is SchemaNode {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Every schema.org type a node declares, without the vocabulary prefix. */
export function typesOf(node: SchemaNode): string[] {
  const declared = node["@type"];
  const names = Array.isArray(declared) ? declared : [declared];
  return names
    .filter((name): name is string => typeof name === "string")
    .map((name) => name.replace(/^https?:\/\/schema\.org\//, ""));
}

function isProduct(node: SchemaNode): boolean {
  return typesOf(node).some((type) => PRODUCT_TYPES.includes(type));
}

/**
 * Follows a bare `{"@id": ...}` reference to the node that carries that
 * `@id` and its properties. JSON-LD lets `offers` or `hasVariant` name a node
 * declared elsewhere in the graph instead of nesting it.
 */
function dereference(value: unknown, byId: Map<unknown, SchemaNode>): unknown {
  if (!isNode(value) || value["@type"] !== undefined) return value;
  return byId.get(value["@id"]) ?? value;
}

function dereferenceAll(
  value: unknown,
  byId: Map<unknown, SchemaNode>,
): unknown[] {
  return (Array.isArray(value) ? value : [value]).map((v) =>
    dereference(v, byId),
  );
}

/** A copy whose `offers` are dereferenced, or the node itself if none are references. */
function withOffers(
  node: SchemaNode,
  byId: Map<unknown, SchemaNode>,
): SchemaNode {
  const offers = node["offers"];
  if (offers === undefined) return node;
  const resolved = dereferenceAll(offers, byId);
  const original = Array.isArray(offers) ? offers : [offers];
  if (resolved.every((v, i) => v === original[i])) return node;
  return { ...node, offers: Array.isArray(offers) ? resolved : resolved[0] };
}

function refersTo(value: unknown, group: SchemaNode): boolean {
  if (value === group) return true;
  const id = group["@id"];
  if (id === undefined) return false;
  return value === id || (isNode(value) && value["@id"] === id);
}

/**
 * The products a page's structured data describes, in document order, as an
 * agent reads them.
 *
 * A variant of a ProductGroup is returned with the group's shared properties
 * beneath its own, so `brand` or `aggregateRating` declared once on the group
 * is found on each variant. A variant belongs to a group through the group's
 * `hasVariant`, through its own `isVariantOf`, or through an
 * `inProductGroupWithID` equal to the group's `productGroupID`; a
 * `hasVariant` entry may be an `@id` reference to a Product declared
 * elsewhere. A ProductGroup with no variants describes the product itself.
 * Products outside any group are returned as declared. In every returned
 * product, `offers` given as `@id` references are replaced by the Offer nodes
 * they name.
 */
export function resolveProducts(blocks: object[]): SchemaNode[] {
  const nodes = allJsonLdNodes(blocks).filter(isNode);
  // Only a node with a type is a definition; `{"@id": ...}` is a reference.
  const byId = new Map<unknown, SchemaNode>();
  for (const node of nodes)
    if (node["@id"] !== undefined && node["@type"] !== undefined)
      if (!byId.has(node["@id"])) byId.set(node["@id"], node);
  const groups = nodes.filter((node) => typesOf(node).includes(PRODUCT_GROUP));

  const groupOf = new Map<SchemaNode, SchemaNode>();
  for (const group of groups) {
    for (const variant of dereferenceAll(group["hasVariant"], byId))
      if (isNode(variant) && isProduct(variant) && !groupOf.has(variant))
        groupOf.set(variant, group);
  }
  for (const node of nodes) {
    if (groupOf.has(node) || !isProduct(node)) continue;
    const group = groups.find(
      (g) =>
        refersTo(node["isVariantOf"], g) ||
        (g["productGroupID"] !== undefined &&
          node["inProductGroupWithID"] === g["productGroupID"]),
    );
    if (group) groupOf.set(node, group);
  }

  const withVariants = new Set(groupOf.values());
  const products: SchemaNode[] = [];
  for (const node of nodes) {
    if (typesOf(node).includes(PRODUCT_GROUP)) {
      if (!withVariants.has(node)) products.push(withOffers(node, byId));
      continue;
    }
    if (!isProduct(node)) continue;
    const group = groupOf.get(node);
    if (!group) {
      products.push(withOffers(node, byId));
      continue;
    }
    const shared = Object.fromEntries(
      Object.entries(group).filter(([key]) => !GROUP_ONLY.has(key)),
    );
    products.push(withOffers({ ...shared, ...node }, byId));
  }
  return products;
}
