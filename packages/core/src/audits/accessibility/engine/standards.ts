/**
 * Vendored axe-core v4.12.1 standards data (pure data tables, copied verbatim).
 * These describe ARIA roles/attributes and the HTML element spec used by the
 * accessibility checks. Loose typing (Record<string, any>) is intentional.
 */
/* eslint-disable */
// oxlint-disable

// Source: https://www.w3.org/TR/wai-aria-1.1/#states_and_properties
const ariaAttrs: Record<string, any> = {
  'aria-activedescendant': {
    type: 'idref',
    prop: 'ariaActiveDescendantElement',
    allowEmpty: true
  },
  'aria-atomic': {
    type: 'boolean',
    prop: 'ariaAtomic',
    global: true
  },
  'aria-autocomplete': {
    type: 'nmtoken',
    prop: 'ariaAutoComplete',
    values: ['inline', 'list', 'both', 'none']
  },
  'aria-braillelabel': {
    type: 'string',
    prop: 'ariaBrailleLabel',
    allowEmpty: true,
    global: true
  },
  'aria-brailleroledescription': {
    type: 'string',
    prop: 'ariaBrailleRoleDescription',
    allowEmpty: true,
    global: true
  },
  'aria-busy': {
    type: 'boolean',
    prop: 'ariaBusy',
    global: true
  },
  'aria-checked': {
    type: 'nmtoken',
    prop: 'ariaChecked',
    values: ['false', 'mixed', 'true', 'undefined']
  },
  'aria-colcount': {
    type: 'int',
    prop: 'ariaColCount',
    minValue: -1
  },
  'aria-colindex': {
    type: 'int',
    prop: 'ariaColIndex',
    minValue: 1
  },
  'aria-colspan': {
    type: 'int',
    prop: 'ariaColSpan',
    minValue: 1
  },
  'aria-controls': {
    type: 'idrefs',
    prop: 'ariaControlsElements',
    allowEmpty: true,
    global: true
  },
  'aria-current': {
    type: 'nmtoken',
    prop: 'ariaCurrent',
    allowEmpty: true,
    values: ['page', 'step', 'location', 'date', 'time', 'true', 'false'],
    global: true
  },
  'aria-describedby': {
    type: 'idrefs',
    prop: 'ariaDescribedByElements',
    allowEmpty: true,
    global: true
  },
  'aria-description': {
    type: 'string',
    prop: 'ariaDescription',
    allowEmpty: true,
    global: true
  },
  'aria-details': {
    type: 'idref',
    prop: 'ariaDetailsElements',
    allowEmpty: true,
    global: true
  },
  'aria-disabled': {
    type: 'boolean',
    prop: 'ariaDisabled',
    global: true
  },
  'aria-dropeffect': {
    type: 'nmtokens',
    values: ['copy', 'execute', 'link', 'move', 'none', 'popup'],
    global: true
  },
  'aria-errormessage': {
    type: 'idref',
    prop: 'ariaErrorMessageElements',
    allowEmpty: true,
    global: true
  },
  'aria-expanded': {
    type: 'nmtoken',
    prop: 'ariaExpanded',
    values: ['true', 'false', 'undefined']
  },
  'aria-flowto': {
    type: 'idrefs',
    prop: 'ariaFlowToElements',
    allowEmpty: true,
    global: true
  },
  'aria-grabbed': {
    type: 'nmtoken',
    values: ['true', 'false', 'undefined'],
    global: true
  },
  'aria-haspopup': {
    type: 'nmtoken',
    prop: 'ariaHasPopup',
    allowEmpty: true,
    values: ['true', 'false', 'menu', 'listbox', 'tree', 'grid', 'dialog'],
    global: true
  },
  'aria-hidden': {
    type: 'nmtoken',
    prop: 'ariaHidden',
    values: ['true', 'false', 'undefined'],
    global: true
  },
  'aria-invalid': {
    type: 'nmtoken',
    prop: 'ariaInvalid',
    values: ['grammar', 'false', 'spelling', 'true'],
    global: true
  },
  'aria-keyshortcuts': {
    type: 'string',
    prop: 'ariaKeyShortcuts',
    allowEmpty: true,
    global: true
  },
  'aria-label': {
    type: 'string',
    prop: 'ariaLabel',
    allowEmpty: true,
    global: true
  },
  'aria-labelledby': {
    type: 'idrefs',
    prop: 'ariaLabelledByElements',
    allowEmpty: true,
    global: true
  },
  'aria-level': {
    type: 'int',
    prop: 'ariaLevel',
    minValue: 1
  },
  'aria-live': {
    type: 'nmtoken',
    prop: 'ariaLive',
    values: ['assertive', 'off', 'polite'],
    global: true
  },
  'aria-modal': {
    type: 'boolean',
    prop: 'ariaModal'
  },
  'aria-multiline': {
    type: 'boolean',
    prop: 'ariaMultiline'
  },
  'aria-multiselectable': {
    type: 'boolean',
    prop: 'ariaMultiSelectable'
  },
  'aria-orientation': {
    type: 'nmtoken',
    prop: 'ariaOrientation',
    values: ['horizontal', 'undefined', 'vertical']
  },
  'aria-owns': {
    type: 'idrefs',
    prop: 'ariaOwnsElements',
    allowEmpty: true,
    global: true
  },
  'aria-placeholder': {
    type: 'string',
    prop: 'ariaPlaceholder',
    allowEmpty: true
  },
  'aria-posinset': {
    type: 'int',
    prop: 'ariaPosInSet',
    minValue: 1
  },
  'aria-pressed': {
    type: 'nmtoken',
    prop: 'ariaPressed',
    values: ['false', 'mixed', 'true', 'undefined']
  },
  'aria-readonly': {
    type: 'boolean',
    prop: 'ariaReadOnly'
  },
  'aria-relevant': {
    type: 'nmtokens',
    prop: 'ariaRelevant',
    values: ['additions', 'all', 'removals', 'text'],
    global: true
  },
  'aria-required': {
    type: 'boolean',
    prop: 'ariaRequired'
  },
  'aria-roledescription': {
    type: 'string',
    prop: 'ariaRoleDescription',
    allowEmpty: true,
    global: true
  },
  'aria-rowcount': {
    type: 'int',
    prop: 'ariaRowCount',
    minValue: -1
  },
  'aria-rowindex': {
    type: 'int',
    prop: 'ariaRowIndex',
    minValue: 1
  },
  'aria-rowspan': {
    type: 'int',
    prop: 'ariaRowSpan',
    minValue: 0
  },
  'aria-selected': {
    type: 'nmtoken',
    prop: 'ariaSelected',
    values: ['false', 'true', 'undefined']
  },
  'aria-setsize': {
    type: 'int',
    prop: 'ariaSetSize',
    minValue: -1
  },
  'aria-sort': {
    type: 'nmtoken',
    prop: 'ariaSort',
    values: ['ascending', 'descending', 'none', 'other']
  },
  'aria-valuemax': {
    type: 'decimal',
    prop: 'ariaValueMax'
  },
  'aria-valuemin': {
    type: 'decimal',
    prop: 'ariaValueMin'
  },
  'aria-valuenow': {
    type: 'decimal',
    prop: 'ariaValueNow'
  },
  'aria-valuetext': {
    type: 'string',
    prop: 'ariaValueText',
    allowEmpty: true
  }
};

export { ariaAttrs };

// Source: https://www.w3.org/TR/wai-aria-1.1/#roles
// Source for abstract roles (types): https://www.w3.org/TR/wai-aria/#abstract_roles

/* easiest way to see allowed roles is to filter out the global ones
   from the list of inherited states and properties. The dpub spec
   does not have the global list so you'll need to copy over from
   the wai-aria one:

  const globalAttrs = Array.from(
    document.querySelectorAll('#global_states li')
  ).map(li => li.textContent.replace(/\s*\(.*\)/, ''));

  const globalRoleAttrs = Array.from(
    document.querySelectorAll('.role-inherited li')
  ).filter(li => globalAttrs.includes(li.textContent.replace(/\s*\(.*\)/, '')))

  globalRoleAttrs.forEach(li => li.style.display = 'none');
*/
const ariaRolesBase: Record<string, any> = {
  alert: {
    type: 'structure',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['section']
  },
  alertdialog: {
    type: 'window',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded', 'aria-modal'],
    superclassRole: ['alert', 'dialog'],
    accessibleNameRequired: true
  },
  application: {
    // Note: spec difference
    type: 'landmark',
    // Note: aria-expanded is not in the 1.1 spec but is
    // consistently supported in ATs and was added in 1.2
    allowedAttrs: ['aria-activedescendant', 'aria-expanded'],
    superclassRole: ['structure'],
    accessibleNameRequired: true
  },
  article: {
    type: 'structure',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-posinset', 'aria-setsize', 'aria-expanded'],
    superclassRole: ['document']
  },
  banner: {
    type: 'landmark',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  blockquote: {
    type: 'structure',
    superclassRole: ['section']
  },
  button: {
    type: 'widget',
    allowedAttrs: ['aria-expanded', 'aria-pressed'],
    superclassRole: ['command'],
    accessibleNameRequired: true,
    nameFromContent: true,
    childrenPresentational: true
  },
  caption: {
    type: 'structure',
    requiredContext: ['figure', 'table', 'grid', 'treegrid'],
    superclassRole: ['section'],
    prohibitedAttrs: ['aria-label', 'aria-labelledby']
  },
  cell: {
    type: 'structure',
    requiredContext: ['row'],
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: [
      'aria-colindex',
      'aria-colspan',
      'aria-rowindex',
      'aria-rowspan',
      'aria-expanded'
    ],
    superclassRole: ['section'],
    nameFromContent: true
  },
  checkbox: {
    type: 'widget',
    // Note: aria-required is not in the 1.1 spec but is
    // consistently supported in ATs and was added in 1.2
    requiredAttrs: ['aria-checked'],
    allowedAttrs: ['aria-readonly', 'aria-expanded', 'aria-required'],
    superclassRole: ['input'],
    accessibleNameRequired: true,
    nameFromContent: true,
    childrenPresentational: true
  },
  code: {
    type: 'structure',
    superclassRole: ['section'],
    prohibitedAttrs: ['aria-label', 'aria-labelledby']
  },
  columnheader: {
    type: 'structure',
    requiredContext: ['row'],
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: [
      'aria-sort',
      'aria-colindex',
      'aria-colspan',
      'aria-expanded',
      'aria-readonly',
      'aria-required',
      'aria-rowindex',
      'aria-rowspan',
      'aria-selected'
    ],
    superclassRole: ['cell', 'gridcell', 'sectionhead'],
    // Note: spec difference
    accessibleNameRequired: false,
    nameFromContent: true
  },
  combobox: {
    // Note: spec difference
    type: 'widget',
    requiredAttrs: ['aria-expanded', 'aria-controls'],
    allowedAttrs: [
      'aria-owns',
      'aria-autocomplete',
      'aria-readonly',
      'aria-required',
      'aria-activedescendant',
      'aria-orientation'
    ],
    superclassRole: ['select'],
    accessibleNameRequired: true
  },
  command: {
    type: 'abstract',
    superclassRole: ['widget']
  },
  complementary: {
    type: 'landmark',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  composite: {
    type: 'abstract',
    superclassRole: ['widget']
  },
  contentinfo: {
    type: 'landmark',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  comment: {
    type: 'structure',
    allowedAttrs: ['aria-level', 'aria-posinset', 'aria-setsize'],
    superclassRole: ['article']
  },
  definition: {
    type: 'structure',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['section']
  },
  deletion: {
    type: 'structure',
    superclassRole: ['section'],
    prohibitedAttrs: ['aria-label', 'aria-labelledby']
  },
  dialog: {
    type: 'window',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded', 'aria-modal'],
    superclassRole: ['window'],
    accessibleNameRequired: true
  },
  directory: {
    type: 'structure',
    deprecated: true,
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['list'],
    // Note: spec difference
    nameFromContent: true
  },
  document: {
    type: 'structure',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['structure']
  },
  emphasis: {
    type: 'structure',
    superclassRole: ['section'],
    prohibitedAttrs: ['aria-label', 'aria-labelledby']
  },
  feed: {
    type: 'structure',
    requiredOwned: ['article'],
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['list']
  },
  figure: {
    type: 'structure',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['section'],
    // Note: spec difference
    nameFromContent: true
  },
  form: {
    type: 'landmark',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  grid: {
    type: 'composite',
    requiredOwned: ['rowgroup', 'row'],
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: [
      'aria-level',
      'aria-multiselectable',
      'aria-readonly',
      'aria-activedescendant',
      'aria-colcount',
      'aria-expanded',
      'aria-rowcount'
    ],
    superclassRole: ['composite', 'table'],
    // Note: spec difference
    accessibleNameRequired: false
  },
  gridcell: {
    type: 'widget',
    requiredContext: ['row'],
    allowedAttrs: [
      'aria-readonly',
      'aria-required',
      'aria-selected',
      'aria-colindex',
      'aria-colspan',
      'aria-expanded',
      'aria-rowindex',
      'aria-rowspan'
    ],
    superclassRole: ['cell', 'widget'],
    nameFromContent: true
  },
  group: {
    type: 'structure',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-activedescendant', 'aria-expanded'],
    superclassRole: ['section']
  },
  heading: {
    type: 'structure',
    requiredAttrs: ['aria-level'],
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['sectionhead'],
    // Note: spec difference
    accessibleNameRequired: false,
    nameFromContent: true
  },
  img: {
    type: 'structure',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['section'],
    accessibleNameRequired: true,
    childrenPresentational: true
  },
  input: {
    type: 'abstract',
    superclassRole: ['widget']
  },
  insertion: {
    type: 'structure',
    superclassRole: ['section'],
    prohibitedAttrs: ['aria-label', 'aria-labelledby']
  },
  landmark: {
    type: 'abstract',
    superclassRole: ['section']
  },
  link: {
    type: 'widget',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['command'],
    accessibleNameRequired: true,
    nameFromContent: true
  },
  list: {
    type: 'structure',
    requiredOwned: ['listitem'],
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['section']
  },
  listbox: {
    // Note: spec difference
    type: 'widget',
    requiredOwned: ['group', 'option'],
    allowedAttrs: [
      'aria-multiselectable',
      'aria-readonly',
      'aria-required',
      'aria-activedescendant',
      'aria-expanded',
      'aria-orientation'
    ],
    superclassRole: ['select'],
    accessibleNameRequired: true
  },
  listitem: {
    type: 'structure',
    requiredContext: ['list'],
    allowedAttrs: [
      'aria-level',
      'aria-posinset',
      'aria-setsize',
      'aria-expanded'
    ],
    superclassRole: ['section'],
    // Note: spec difference
    nameFromContent: true
  },
  log: {
    type: 'structure',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['section']
  },
  main: {
    type: 'landmark',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  marquee: {
    type: 'structure',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['section']
  },
  math: {
    type: 'structure',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['section'],
    childrenPresentational: true
  },
  menu: {
    type: 'composite',
    // Note: spec difference (menu & separator as required owned)
    requiredOwned: [
      'group',
      'menuitemradio',
      'menuitem',
      'menuitemcheckbox',
      'menu',
      'separator'
    ],
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: [
      'aria-activedescendant',
      'aria-expanded',
      'aria-orientation'
    ],
    superclassRole: ['select']
  },
  menubar: {
    type: 'composite',
    // Note: spec difference (menu & separator as required owned)
    requiredOwned: [
      'group',
      'menuitemradio',
      'menuitem',
      'menuitemcheckbox',
      'menu',
      'separator'
    ],
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: [
      'aria-activedescendant',
      'aria-expanded',
      'aria-orientation'
    ],
    superclassRole: ['menu']
  },
  menuitem: {
    type: 'widget',
    requiredContext: ['menu', 'menubar', 'group'],
    // Note: aria-expanded is not in the 1.1 spec but is
    // consistently supported in ATs and was added in 1.2
    allowedAttrs: ['aria-posinset', 'aria-setsize', 'aria-expanded'],
    superclassRole: ['command'],
    accessibleNameRequired: true,
    nameFromContent: true
  },
  menuitemcheckbox: {
    type: 'widget',
    requiredContext: ['menu', 'menubar', 'group'],
    requiredAttrs: ['aria-checked'],
    allowedAttrs: [
      'aria-expanded',
      'aria-posinset',
      'aria-readonly',
      'aria-setsize'
    ],
    superclassRole: ['checkbox', 'menuitem'],
    accessibleNameRequired: true,
    nameFromContent: true,
    childrenPresentational: true
  },
  menuitemradio: {
    type: 'widget',
    requiredContext: ['menu', 'menubar', 'group'],
    requiredAttrs: ['aria-checked'],
    allowedAttrs: [
      'aria-expanded',
      'aria-posinset',
      'aria-readonly',
      'aria-setsize'
    ],
    superclassRole: ['menuitemcheckbox', 'radio'],
    accessibleNameRequired: true,
    nameFromContent: true,
    childrenPresentational: true
  },
  meter: {
    type: 'structure',
    requiredAttrs: ['aria-valuenow'],
    allowedAttrs: ['aria-valuemax', 'aria-valuemin', 'aria-valuetext'],
    superclassRole: ['range'],
    accessibleNameRequired: true,
    childrenPresentational: true
  },
  mark: {
    type: 'structure',
    superclassRole: ['section'],
    prohibitedAttrs: ['aria-label', 'aria-labelledby']
  },
  navigation: {
    type: 'landmark',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  none: {
    type: 'structure',
    superclassRole: ['structure'],
    prohibitedAttrs: ['aria-label', 'aria-labelledby']
  },
  note: {
    type: 'structure',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['section']
  },
  option: {
    type: 'widget',
    requiredContext: ['group', 'listbox'],
    // Note: since the option role has an implicit
    // aria-selected value it is not required to be added by
    // the user
    allowedAttrs: [
      'aria-selected',
      'aria-checked',
      'aria-posinset',
      'aria-setsize'
    ],
    superclassRole: ['input'],
    accessibleNameRequired: true,
    nameFromContent: true,
    childrenPresentational: true
  },
  paragraph: {
    type: 'structure',
    superclassRole: ['section'],
    prohibitedAttrs: ['aria-label', 'aria-labelledby']
  },
  presentation: {
    type: 'structure',
    superclassRole: ['structure'],
    prohibitedAttrs: ['aria-label', 'aria-labelledby']
  },
  progressbar: {
    type: 'widget',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: [
      'aria-expanded',
      'aria-valuemax',
      'aria-valuemin',
      'aria-valuenow',
      'aria-valuetext'
    ],
    superclassRole: ['range'],
    accessibleNameRequired: true,
    childrenPresentational: true
  },
  radio: {
    type: 'widget',
    // Note: aria-required is not in the 1.1 or 1.2 specs but is
    // consistently supported in ATs on the individual radio element
    requiredAttrs: ['aria-checked'],
    allowedAttrs: ['aria-posinset', 'aria-setsize', 'aria-required'],
    superclassRole: ['input'],
    accessibleNameRequired: true,
    nameFromContent: true,
    childrenPresentational: true
  },
  radiogroup: {
    type: 'composite',
    // Note: spec difference (no required owned)
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: [
      'aria-readonly',
      'aria-required',
      'aria-activedescendant',
      'aria-expanded',
      'aria-orientation'
    ],
    superclassRole: ['select'],
    // Note: spec difference
    accessibleNameRequired: false
  },
  range: {
    type: 'abstract',
    superclassRole: ['widget']
  },
  region: {
    type: 'landmark',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark'],
    // Note: spec difference
    accessibleNameRequired: false
  },
  roletype: {
    type: 'abstract',
    superclassRole: []
  },
  row: {
    type: 'structure',
    requiredContext: ['grid', 'rowgroup', 'table', 'treegrid'],
    requiredOwned: ['cell', 'columnheader', 'gridcell', 'rowheader'],
    allowedAttrs: [
      'aria-colindex',
      'aria-level',
      'aria-rowindex',
      'aria-selected',
      'aria-activedescendant',
      'aria-expanded',
      'aria-posinset',
      'aria-setsize'
    ],
    superclassRole: ['group', 'widget'],
    nameFromContent: true
  },
  rowgroup: {
    type: 'structure',
    requiredContext: ['grid', 'table', 'treegrid'],
    requiredOwned: ['row'],
    superclassRole: ['structure'],
    nameFromContent: true
  },
  rowheader: {
    type: 'structure',
    requiredContext: ['row'],
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: [
      'aria-sort',
      'aria-colindex',
      'aria-colspan',
      'aria-expanded',
      'aria-readonly',
      'aria-required',
      'aria-rowindex',
      'aria-rowspan',
      'aria-selected'
    ],
    superclassRole: ['cell', 'gridcell', 'sectionhead'],
    // Note: spec difference
    accessibleNameRequired: false,
    nameFromContent: true
  },
  scrollbar: {
    type: 'widget',
    requiredAttrs: ['aria-valuenow'],
    // Note: since the scrollbar role has implicit
    // aria-orientation, aria-valuemax, aria-valuemin values it
    // is not required to be added by the user
    //
    // Note: because aria-controls is not well supported we will not
    // make it a required attribute even though it is required in the
    // spec
    allowedAttrs: [
      'aria-controls',
      'aria-orientation',
      'aria-valuemax',
      'aria-valuemin',
      'aria-valuetext'
    ],
    superclassRole: ['range'],
    childrenPresentational: true
  },
  search: {
    type: 'landmark',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  searchbox: {
    type: 'widget',
    allowedAttrs: [
      'aria-activedescendant',
      'aria-autocomplete',
      'aria-multiline',
      'aria-placeholder',
      'aria-readonly',
      'aria-required'
    ],
    superclassRole: ['textbox'],
    accessibleNameRequired: true
  },
  section: {
    type: 'abstract',
    superclassRole: ['structure'],
    // Note: spec difference
    nameFromContent: true
  },
  sectionhead: {
    type: 'abstract',
    superclassRole: ['structure'],
    // Note: spec difference
    nameFromContent: true
  },
  select: {
    type: 'abstract',
    superclassRole: ['composite', 'group']
  },
  separator: {
    type: 'structure',
    requiredAttrs: ['aria-valuenow'],
    // Note: since the separator role has implicit
    // aria-orientation, aria-valuemax, aria-valuemin, and
    // values it is not required to be added by
    // the user
    allowedAttrs: [
      'aria-valuemax',
      'aria-valuemin',
      'aria-orientation',
      'aria-valuetext'
    ],
    superclassRole: ['structure', 'widget'],
    childrenPresentational: true
  },
  slider: {
    type: 'widget',
    requiredAttrs: ['aria-valuenow'],
    // Note: since the slider role has implicit
    // aria-orientation, aria-valuemax, aria-valuemin values it
    // is not required to be added by the user
    // Note: aria-required is not in the 1.1 or 1.2 specs but is
    // consistently supported in ATs
    allowedAttrs: [
      'aria-valuemax',
      'aria-valuemin',
      'aria-orientation',
      'aria-readonly',
      'aria-required',
      'aria-valuetext'
    ],
    superclassRole: ['input', 'range'],
    accessibleNameRequired: true,
    childrenPresentational: true
  },
  spinbutton: {
    type: 'widget',
    // Note: since the spinbutton role has implicit
    // aria-valuenow, aria-valuemax, aria-valuemin values it
    // is not required to be added by the user
    allowedAttrs: [
      'aria-valuemax',
      'aria-valuemin',
      'aria-readonly',
      'aria-required',
      'aria-activedescendant',
      'aria-valuetext',
      'aria-valuenow'
    ],
    superclassRole: ['composite', 'input', 'range'],
    accessibleNameRequired: true
  },
  status: {
    type: 'structure',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['section']
  },
  strong: {
    type: 'structure',
    superclassRole: ['section'],
    prohibitedAttrs: ['aria-label', 'aria-labelledby']
  },
  structure: {
    type: 'abstract',
    superclassRole: ['roletype']
  },
  subscript: {
    type: 'structure',
    superclassRole: ['section'],
    prohibitedAttrs: ['aria-label', 'aria-labelledby']
  },
  superscript: {
    type: 'structure',
    superclassRole: ['section'],
    prohibitedAttrs: ['aria-label', 'aria-labelledby']
  },
  switch: {
    type: 'widget',
    requiredAttrs: ['aria-checked'],
    allowedAttrs: ['aria-expanded', 'aria-readonly', 'aria-required'],
    superclassRole: ['checkbox'],
    accessibleNameRequired: true,
    nameFromContent: true,
    childrenPresentational: true
  },
  suggestion: {
    type: 'structure',
    requiredOwned: ['insertion', 'deletion'],
    superclassRole: ['section'],
    prohibitedAttrs: ['aria-label', 'aria-labelledby']
  },
  tab: {
    type: 'widget',
    requiredContext: ['tablist'],
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: [
      'aria-posinset',
      'aria-selected',
      'aria-setsize',
      'aria-expanded'
    ],
    superclassRole: ['sectionhead', 'widget'],
    nameFromContent: true,
    childrenPresentational: true
  },
  table: {
    type: 'structure',
    requiredOwned: ['rowgroup', 'row'],
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-colcount', 'aria-rowcount', 'aria-expanded'],
    // NOTE: although the spec says this is not named from contents,
    // the accessible text acceptance tests (#139 and #140) require
    // table be named from content (we even had to special case
    // table in commons/aria/named-from-contents)
    superclassRole: ['section'],
    // Note: spec difference
    accessibleNameRequired: false,
    nameFromContent: true
  },
  tablist: {
    type: 'composite',
    requiredOwned: ['tab'],
    // NOTE: aria-expanded is from the 1.0 spec but is still
    // consistently supported in ATs
    allowedAttrs: [
      'aria-level',
      'aria-multiselectable',
      'aria-orientation',
      'aria-activedescendant',
      'aria-expanded'
    ],
    superclassRole: ['composite']
  },
  tabpanel: {
    // Spec ambiguity: Aria 1.1 and 1.2 both say that tabpanel rolls up to
    // structure via its section superclass, but also include it as a widget
    // in §5.3.2 Widget Roles.
    type: 'structure',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['section'],
    // Note: spec difference
    accessibleNameRequired: false
  },
  term: {
    type: 'structure',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['section'],
    // Note: spec difference
    nameFromContent: true
  },
  text: {
    type: 'structure',
    superclassRole: ['section'],
    nameFromContent: true
  },
  textbox: {
    type: 'widget',
    allowedAttrs: [
      'aria-activedescendant',
      'aria-autocomplete',
      'aria-multiline',
      'aria-placeholder',
      'aria-readonly',
      'aria-required'
    ],
    superclassRole: ['input'],
    accessibleNameRequired: true
  },
  time: {
    type: 'structure',
    superclassRole: ['section']
  },
  timer: {
    type: 'structure',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['status']
  },
  toolbar: {
    type: 'structure',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: [
      'aria-orientation',
      'aria-activedescendant',
      'aria-expanded'
    ],
    superclassRole: ['group'],
    accessibleNameRequired: true
  },
  tooltip: {
    type: 'structure',
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['section'],
    nameFromContent: true
  },
  tree: {
    type: 'composite',
    requiredOwned: ['group', 'treeitem'],
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: [
      'aria-multiselectable',
      'aria-required',
      'aria-activedescendant',
      'aria-expanded',
      'aria-orientation'
    ],
    superclassRole: ['select'],
    // Note: spec difference
    accessibleNameRequired: false
  },
  treegrid: {
    type: 'composite',
    requiredOwned: ['rowgroup', 'row'],
    // Spec difference: Aria-expanded removed in 1.2
    allowedAttrs: [
      'aria-activedescendant',
      'aria-colcount',
      'aria-expanded',
      'aria-level',
      'aria-multiselectable',
      'aria-orientation',
      'aria-readonly',
      'aria-required',
      'aria-rowcount'
    ],
    superclassRole: ['grid', 'tree'],
    // Note: spec difference
    accessibleNameRequired: false
  },
  treeitem: {
    type: 'widget',
    requiredContext: ['group', 'tree'],
    allowedAttrs: [
      'aria-checked',
      'aria-expanded',
      'aria-level',
      'aria-posinset',
      'aria-selected',
      'aria-setsize'
    ],
    superclassRole: ['listitem', 'option'],
    accessibleNameRequired: true,
    nameFromContent: true
  },
  widget: {
    type: 'abstract',
    superclassRole: ['roletype']
  },
  window: {
    type: 'abstract',
    superclassRole: ['roletype']
  }
};

// Source https://www.w3.org/TR/dpub-aria-1.0/
const dpubRoles: Record<string, any> = {
  'doc-abstract': {
    type: 'section',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['section']
  },
  'doc-acknowledgments': {
    type: 'landmark',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  'doc-afterword': {
    type: 'landmark',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  'doc-appendix': {
    type: 'landmark',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  'doc-backlink': {
    type: 'link',
    allowedAttrs: ['aria-expanded'],
    nameFromContent: true,
    superclassRole: ['link']
  },
  'doc-biblioentry': {
    type: 'listitem',
    allowedAttrs: [
      'aria-expanded',
      'aria-level',
      'aria-posinset',
      'aria-setsize'
    ],
    superclassRole: ['listitem'],
    deprecated: true
  },
  'doc-bibliography': {
    type: 'landmark',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  'doc-biblioref': {
    type: 'link',
    allowedAttrs: ['aria-expanded'],
    nameFromContent: true,
    superclassRole: ['link']
  },
  'doc-chapter': {
    type: 'landmark',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  'doc-colophon': {
    type: 'section',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['section']
  },
  'doc-conclusion': {
    type: 'landmark',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  'doc-cover': {
    type: 'img',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['img']
  },
  'doc-credit': {
    type: 'section',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['section']
  },
  'doc-credits': {
    type: 'landmark',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  'doc-dedication': {
    type: 'section',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['section']
  },
  'doc-endnote': {
    type: 'listitem',
    allowedAttrs: [
      'aria-expanded',
      'aria-level',
      'aria-posinset',
      'aria-setsize'
    ],
    superclassRole: ['listitem'],
    deprecated: true
  },
  'doc-endnotes': {
    type: 'landmark',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  'doc-epigraph': {
    type: 'section',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['section']
  },
  'doc-epilogue': {
    type: 'landmark',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  'doc-errata': {
    type: 'landmark',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  'doc-example': {
    type: 'section',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['section']
  },
  'doc-footnote': {
    type: 'section',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['section']
  },
  'doc-foreword': {
    type: 'landmark',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  'doc-glossary': {
    type: 'landmark',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  'doc-glossref': {
    type: 'link',
    allowedAttrs: ['aria-expanded'],
    nameFromContent: true,
    superclassRole: ['link']
  },
  'doc-index': {
    type: 'navigation',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['navigation']
  },
  'doc-introduction': {
    type: 'landmark',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  'doc-noteref': {
    type: 'link',
    allowedAttrs: ['aria-expanded'],
    nameFromContent: true,
    superclassRole: ['link']
  },
  'doc-notice': {
    type: 'note',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['note']
  },
  'doc-pagebreak': {
    type: 'separator',
    allowedAttrs: ['aria-expanded', 'aria-orientation'],
    superclassRole: ['separator'],
    childrenPresentational: true
  },
  'doc-pagelist': {
    type: 'navigation',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['navigation']
  },
  'doc-part': {
    type: 'landmark',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  'doc-preface': {
    type: 'landmark',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  'doc-prologue': {
    type: 'landmark',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['landmark']
  },
  'doc-pullquote': {
    type: 'none',
    superclassRole: ['none']
  },
  'doc-qna': {
    type: 'section',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['section']
  },
  'doc-subtitle': {
    type: 'sectionhead',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['sectionhead']
  },
  'doc-tip': {
    type: 'note',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['note']
  },
  'doc-toc': {
    type: 'navigation',
    allowedAttrs: ['aria-expanded'],
    superclassRole: ['navigation']
  }
};
export { dpubRoles };

// Source: https://www.w3.org/TR/graphics-aria-1.0/

const graphicsRoles: Record<string, any> = {
  'graphics-document': {
    type: 'structure',
    superclassRole: ['document'],
    accessibleNameRequired: true
  },
  'graphics-object': {
    type: 'structure',
    superclassRole: ['group'],
    nameFromContent: true
  },
  'graphics-symbol': {
    type: 'structure',
    superclassRole: ['img'],
    accessibleNameRequired: true,
    childrenPresentational: true
  }
};
export { graphicsRoles };

// Source: https://www.w3.org/TR/html-aria/#allowed-aria-roles-states-and-properties
// Source: https://www.w3.org/TR/html-aam-1.0/#html-element-role-mappings
// Source https://html.spec.whatwg.org/multipage/dom.html#content-models
// Source https://dom.spec.whatwg.org/#dom-element-attachshadow
const htmlElms: Record<string, any> = {
  a: {
    // Note: variants work by matching the node against the
    // `matches` attribute. if the variant matches AND has the
    // desired property (contentTypes, etc.) then we use it,
    // otherwise we move on to the next matching variant
    variant: {
      href: {
        matches: '[href]',
        contentTypes: ['interactive', 'phrasing', 'flow'],
        allowedRoles: [
          'button',
          'checkbox',
          'menuitem',
          'menuitemcheckbox',
          'menuitemradio',
          'option',
          'radio',
          'switch',
          'tab',
          'treeitem',
          'doc-backlink',
          'doc-biblioref',
          'doc-glossref',
          'doc-noteref'
        ],
        namingMethods: ['subtreeText']
      },
      // Note: the default variant is a special variant and is
      // used as the last match if none of the other variants
      // match or have the desired attribute
      default: {
        contentTypes: ['phrasing', 'flow'],
        allowedRoles: true
      }
    }
  },
  abbr: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  address: {
    contentTypes: ['flow'],
    allowedRoles: true
  },
  area: {
    variant: {
      href: {
        matches: '[href]',
        allowedRoles: false
      },
      default: {
        allowedRoles: ['button', 'link']
      }
    },
    contentTypes: ['phrasing', 'flow'],
    namingMethods: ['altText']
  },
  article: {
    contentTypes: ['sectioning', 'flow'],
    allowedRoles: [
      'feed',
      'presentation',
      'none',
      'document',
      'application',
      'main',
      'region'
    ],
    shadowRoot: true
  },
  aside: {
    contentTypes: ['sectioning', 'flow'],
    allowedRoles: [
      'feed',
      'note',
      'presentation',
      'none',
      'region',
      'search',
      'doc-dedication',
      'doc-example',
      'doc-footnote',
      'doc-glossary',
      'doc-pullquote',
      'doc-tip'
    ]
  },
  audio: {
    variant: {
      controls: {
        matches: '[controls]',
        contentTypes: ['interactive', 'embedded', 'phrasing', 'flow']
      },
      default: {
        contentTypes: ['embedded', 'phrasing', 'flow']
      }
    },
    // Note: if the property applies regardless of variants it is
    // placed at the top level instead of the default variant
    allowedRoles: ['application'],
    chromiumRole: 'Audio'
  },
  b: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  base: {
    allowedRoles: false,
    noAriaAttrs: true
  },
  bdi: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  bdo: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  blockquote: {
    contentTypes: ['flow'],
    allowedRoles: true,
    shadowRoot: true
  },
  body: {
    allowedRoles: false,
    shadowRoot: true
  },
  br: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: ['presentation', 'none'],
    namingMethods: ['titleText', 'singleSpace'],
    allowedAriaAttrs: ['aria-hidden']
  },
  button: {
    contentTypes: ['interactive', 'phrasing', 'flow'],
    allowedRoles: [
      'checkbox',
      'combobox',
      'gridcell',
      'link',
      'menuitem',
      'menuitemcheckbox',
      'menuitemradio',
      'option',
      'radio',
      'separator',
      'slider',
      'switch',
      'tab',
      'treeitem'
    ],
    // 5.4 button Element
    namingMethods: ['subtreeText']
  },
  canvas: {
    allowedRoles: true,
    contentTypes: ['embedded', 'phrasing', 'flow'],
    chromiumRole: 'Canvas'
  },
  caption: {
    allowedRoles: false
  },
  cite: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  code: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  col: {
    allowedRoles: false,
    noAriaAttrs: true
  },
  colgroup: {
    allowedRoles: false,
    noAriaAttrs: true
  },
  data: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  datalist: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: false,
    noAriaAttrs: true,
    implicitAttrs: {
      // Note: even though the value of aria-multiselectable is based
      // on the attributes, we don't currently need to know the
      // precise value. however, this allows us to make the attribute
      // future proof in case we ever do need to know it
      'aria-multiselectable': 'false'
    }
  },
  dd: {
    allowedRoles: false
  },
  del: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  dfn: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  details: {
    contentTypes: ['interactive', 'flow'],
    allowedRoles: false
  },
  dialog: {
    contentTypes: ['flow'],
    allowedRoles: ['alertdialog']
  },
  div: {
    contentTypes: ['flow'],
    allowedRoles: true,
    shadowRoot: true
  },
  dl: {
    contentTypes: ['flow'],
    allowedRoles: ['group', 'list', 'presentation', 'none'],
    chromiumRole: 'DescriptionList'
  },
  dt: {
    allowedRoles: ['listitem']
  },
  em: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  embed: {
    contentTypes: ['interactive', 'embedded', 'phrasing', 'flow'],
    allowedRoles: ['application', 'document', 'img', 'presentation', 'none'],
    chromiumRole: 'EmbeddedObject'
  },
  fieldset: {
    contentTypes: ['flow'],
    allowedRoles: ['none', 'presentation', 'radiogroup'],
    // 5.5 fieldset and legend Elements
    namingMethods: ['fieldsetLegendText']
  },
  figcaption: {
    allowedRoles: ['group', 'none', 'presentation']
  },
  figure: {
    contentTypes: ['flow'],
    // Note: technically you're allowed no role when a figcaption
    // descendant, but we can't match that so we'll go with any role
    allowedRoles: true,
    // 5.9 figure and figcaption Elements
    namingMethods: ['figureText', 'titleText']
  },
  footer: {
    contentTypes: ['flow'],
    allowedRoles: ['group', 'none', 'presentation', 'doc-footnote'],
    shadowRoot: true
  },
  form: {
    contentTypes: ['flow'],
    allowedRoles: ['form', 'search', 'none', 'presentation']
  },
  h1: {
    contentTypes: ['heading', 'flow'],
    allowedRoles: ['none', 'presentation', 'tab', 'doc-subtitle'],
    shadowRoot: true,
    implicitAttrs: {
      'aria-level': '1'
    }
  },
  h2: {
    contentTypes: ['heading', 'flow'],
    allowedRoles: ['none', 'presentation', 'tab', 'doc-subtitle'],
    shadowRoot: true,
    implicitAttrs: {
      'aria-level': '2'
    }
  },
  h3: {
    contentTypes: ['heading', 'flow'],
    allowedRoles: ['none', 'presentation', 'tab', 'doc-subtitle'],
    shadowRoot: true,
    implicitAttrs: {
      'aria-level': '3'
    }
  },
  h4: {
    contentTypes: ['heading', 'flow'],
    allowedRoles: ['none', 'presentation', 'tab', 'doc-subtitle'],
    shadowRoot: true,
    implicitAttrs: {
      'aria-level': '4'
    }
  },
  h5: {
    contentTypes: ['heading', 'flow'],
    allowedRoles: ['none', 'presentation', 'tab', 'doc-subtitle'],
    shadowRoot: true,
    implicitAttrs: {
      'aria-level': '5'
    }
  },
  h6: {
    contentTypes: ['heading', 'flow'],
    allowedRoles: ['none', 'presentation', 'tab', 'doc-subtitle'],
    shadowRoot: true,
    implicitAttrs: {
      'aria-level': '6'
    }
  },
  head: {
    allowedRoles: false,
    noAriaAttrs: true
  },
  header: {
    contentTypes: ['flow'],
    allowedRoles: ['group', 'none', 'presentation', 'doc-footnote'],
    shadowRoot: true
  },
  hgroup: {
    contentTypes: ['heading', 'flow'],
    allowedRoles: true
  },
  hr: {
    contentTypes: ['flow'],
    allowedRoles: ['none', 'presentation', 'doc-pagebreak'],
    namingMethods: ['titleText', 'singleSpace']
  },
  html: {
    allowedRoles: false,
    noAriaAttrs: true
  },
  i: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  iframe: {
    contentTypes: ['interactive', 'embedded', 'phrasing', 'flow'],
    allowedRoles: ['application', 'document', 'img', 'none', 'presentation'],
    chromiumRole: 'Iframe'
  },
  img: {
    variant: {
      nonEmptyAlt: {
        matches: [
          {
            // Because <img role="none" alt="foo" /> has no accessible name:
            attributes: {
              alt: '/.+/'
            }
          },
          {
            hasAccessibleName: true
          }
        ],
        allowedRoles: [
          'button',
          'checkbox',
          'link',
          'math',
          'menuitem',
          'menuitemcheckbox',
          'menuitemradio',
          'meter',
          'option',
          'progressbar',
          'radio',
          'scrollbar',
          'separator',
          'slider',
          'switch',
          'tab',
          'treeitem',
          'doc-cover'
        ]
      },
      usemap: {
        matches: '[usemap]',
        contentTypes: ['interactive', 'embedded', 'flow']
      },
      default: {
        // Note: allow role presentation and none on image with no
        // alt as a way to prevent axe from flagging the image as
        // needing an alt
        allowedRoles: ['presentation', 'none'],
        // Note: spec change (do not count as phrasing), because browsers
        // insert a space between an img's accessible name and other
        // elements' accessible names
        contentTypes: ['embedded', 'flow']
      }
    },
    // 5.10 img Element
    namingMethods: ['altText']
  },
  input: {
    variant: {
      button: {
        matches: {
          properties: {
            type: 'button'
          }
        },
        allowedRoles: [
          'checkbox',
          'combobox',
          'link',
          'menuitem',
          'menuitemcheckbox',
          'menuitemradio',
          'option',
          'radio',
          'switch',
          'tab'
        ]
      },
      // 5.2 input type="button", input type="submit" and input type="reset"
      buttonType: {
        matches: {
          properties: {
            type: ['button', 'submit', 'reset']
          }
        },
        namingMethods: ['valueText', 'titleText', 'buttonDefaultText']
      },
      checkboxPressed: {
        matches: {
          properties: {
            type: 'checkbox'
          },
          attributes: {
            'aria-pressed': '/.*/'
          }
        },
        allowedRoles: ['button', 'menuitemcheckbox', 'option', 'switch'],
        implicitAttrs: {
          'aria-checked': 'false'
        }
      },
      checkbox: {
        matches: {
          properties: {
            type: 'checkbox'
          },
          attributes: {
            'aria-pressed': null
          }
        },
        allowedRoles: ['menuitemcheckbox', 'option', 'switch'],
        implicitAttrs: {
          'aria-checked': 'false'
        }
      },
      noRoles: {
        matches: {
          properties: {
            // Note: types of url, search, tel, and email are listed
            // as not allowed roles however since they are text
            // types they should be allowed to have role=combobox
            type: [
              'color',
              'date',
              'datetime-local',
              'file',
              'month',
              'number',
              'password',
              'range',
              'reset',
              'submit',
              'time',
              'week'
            ]
          }
        },
        allowedRoles: false
      },
      hidden: {
        matches: {
          properties: {
            type: 'hidden'
          }
        },
        // Note: spec change (do not count as phrasing)
        contentTypes: ['flow'],
        allowedRoles: false,
        noAriaAttrs: true
      },
      image: {
        matches: {
          properties: {
            type: 'image'
          }
        },
        allowedRoles: [
          'link',
          'menuitem',
          'menuitemcheckbox',
          'menuitemradio',
          'radio',
          'switch'
        ],
        // 5.3 input type="image"
        namingMethods: [
          'altText',
          'valueText',
          'labelText',
          'titleText',
          'buttonDefaultText'
        ]
      },
      radio: {
        matches: {
          properties: {
            type: 'radio'
          }
        },
        allowedRoles: ['menuitemradio'],
        implicitAttrs: {
          'aria-checked': 'false'
        }
      },
      textWithList: {
        matches: {
          properties: {
            type: 'text'
          },
          attributes: {
            list: '/.*/'
          }
        },
        allowedRoles: false
      },
      default: {
        // Note: spec change (do not count as phrasing)
        contentTypes: ['interactive', 'flow'],
        allowedRoles: ['combobox', 'searchbox', 'spinbutton'],
        implicitAttrs: {
          'aria-valuenow': ''
        },
        // 5.1 input type="text", input type="password", input type="search", input type="tel", input type="url"
        // 5.7 Other Form Elements
        namingMethods: ['labelText', 'placeholderText']
      }
    }
  },
  ins: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  kbd: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  label: {
    contentTypes: ['interactive', 'phrasing', 'flow'],
    allowedRoles: false,
    chromiumRole: 'Label'
  },
  legend: {
    allowedRoles: false
  },
  li: {
    allowedRoles: [
      'menuitem',
      'menuitemcheckbox',
      'menuitemradio',
      'option',
      'none',
      'presentation',
      'radio',
      'separator',
      'tab',
      'treeitem',
      'doc-biblioentry',
      'doc-endnote'
    ],
    implicitAttrs: {
      'aria-setsize': '1',
      'aria-posinset': '1'
    }
  },
  link: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: false,
    noAriaAttrs: true
  },
  main: {
    contentTypes: ['flow'],
    allowedRoles: false,
    shadowRoot: true
  },
  map: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: false,
    noAriaAttrs: true
  },
  math: {
    contentTypes: ['embedded', 'phrasing', 'flow'],
    allowedRoles: false
  },
  mark: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  menu: {
    contentTypes: ['flow'],
    allowedRoles: [
      'directory',
      'group',
      'listbox',
      'menu',
      'menubar',
      'none',
      'presentation',
      'radiogroup',
      'tablist',
      'toolbar',
      'tree'
    ]
  },
  meta: {
    variant: {
      itemprop: {
        matches: '[itemprop]',
        contentTypes: ['phrasing', 'flow']
      }
    },
    allowedRoles: false,
    noAriaAttrs: true
  },
  meter: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: false,
    chromiumRole: 'progressbar'
  },
  nav: {
    contentTypes: ['sectioning', 'flow'],
    allowedRoles: [
      'doc-index',
      'doc-pagelist',
      'doc-toc',
      'menu',
      'menubar',
      'none',
      'presentation',
      'tablist'
    ],
    shadowRoot: true
  },
  noscript: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: false,
    noAriaAttrs: true
  },
  object: {
    variant: {
      usemap: {
        matches: '[usemap]',
        contentTypes: ['interactive', 'embedded', 'phrasing', 'flow']
      },
      default: {
        contentTypes: ['embedded', 'phrasing', 'flow']
      }
    },
    allowedRoles: ['application', 'document', 'img'],
    chromiumRole: 'PluginObject'
  },
  ol: {
    contentTypes: ['flow'],
    allowedRoles: [
      'directory',
      'group',
      'listbox',
      'menu',
      'menubar',
      'none',
      'presentation',
      'radiogroup',
      'tablist',
      'toolbar',
      'tree'
    ]
  },
  optgroup: {
    allowedRoles: false
  },
  option: {
    allowedRoles: false,
    implicitAttrs: {
      'aria-selected': 'false'
    }
  },
  output: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true,
    // 5.6 output Element
    namingMethods: ['subtreeText']
  },
  p: {
    contentTypes: ['flow'],
    allowedRoles: true,
    shadowRoot: true
  },
  param: {
    allowedRoles: false,
    noAriaAttrs: true
  },
  picture: {
    // Note: spec change (do not count as embedded), because browsers do not hide text inside the picture element
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: false,
    noAriaAttrs: true
  },
  pre: {
    contentTypes: ['flow'],
    allowedRoles: true
  },
  progress: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: false,
    implicitAttrs: {
      'aria-valuemax': '100',
      'aria-valuemin': '0',
      'aria-valuenow': '0'
    }
  },
  q: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  rp: {
    allowedRoles: true
  },
  rt: {
    allowedRoles: true
  },
  ruby: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  s: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  samp: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  script: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: false,
    noAriaAttrs: true
  },
  search: {
    contentTypes: ['flow'],
    allowedRoles: ['form', 'group', 'none', 'presentation', 'region', 'search']
  },
  section: {
    contentTypes: ['sectioning', 'flow'],
    allowedRoles: [
      'alert',
      'alertdialog',
      'application',
      'banner',
      'complementary',
      'contentinfo',
      'dialog',
      'document',
      'feed',
      'group',
      'log',
      'main',
      'marquee',
      'navigation',
      'none',
      'note',
      'presentation',
      'search',
      'status',
      'tabpanel',
      'doc-abstract',
      'doc-acknowledgments',
      'doc-afterword',
      'doc-appendix',
      'doc-bibliography',
      'doc-chapter',
      'doc-colophon',
      'doc-conclusion',
      'doc-credit',
      'doc-credits',
      'doc-dedication',
      'doc-endnotes',
      'doc-epigraph',
      'doc-epilogue',
      'doc-errata',
      'doc-example',
      'doc-foreword',
      'doc-glossary',
      'doc-index',
      'doc-introduction',
      'doc-notice',
      'doc-pagelist',
      'doc-part',
      'doc-preface',
      'doc-prologue',
      'doc-pullquote',
      'doc-qna',
      'doc-toc'
    ],
    shadowRoot: true
  },
  select: {
    variant: {
      combobox: {
        matches: {
          attributes: {
            multiple: null,
            size: [null, '1']
          }
        },
        allowedRoles: ['menu']
      },
      default: {
        allowedRoles: false
      }
    },
    contentTypes: ['interactive', 'phrasing', 'flow'],
    implicitAttrs: {
      'aria-valuenow': ''
    },
    // 5.7 Other form elements
    namingMethods: ['labelText']
  },
  slot: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: false,
    noAriaAttrs: true
  },
  small: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  source: {
    allowedRoles: false,
    noAriaAttrs: true
  },
  span: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true,
    shadowRoot: true
  },
  strong: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  style: {
    allowedRoles: false,
    noAriaAttrs: true
  },
  svg: {
    contentTypes: ['embedded', 'phrasing', 'flow'],
    allowedRoles: true,
    chromiumRole: 'SVGRoot',
    namingMethods: ['svgTitleText']
  },
  sub: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  summary: {
    allowedRoles: false,
    // 5.8 summary Element
    namingMethods: ['subtreeText']
  },
  sup: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  table: {
    contentTypes: ['flow'],
    allowedRoles: true,
    // 5.11 table Element
    namingMethods: ['tableCaptionText', 'tableSummaryText']
  },
  tbody: {
    allowedRoles: true
  },
  template: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: false,
    noAriaAttrs: true
  },
  textarea: {
    contentTypes: ['interactive', 'phrasing', 'flow'],
    allowedRoles: false,
    implicitAttrs: {
      'aria-valuenow': '',
      'aria-multiline': 'true'
    },
    // 5.1 textarea
    namingMethods: ['labelText', 'placeholderText']
  },
  tfoot: {
    allowedRoles: true
  },
  thead: {
    allowedRoles: true
  },
  time: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  title: {
    allowedRoles: false,
    noAriaAttrs: true
  },
  td: {
    allowedRoles: true
  },
  th: {
    allowedRoles: true
  },
  tr: {
    allowedRoles: true
  },
  track: {
    allowedRoles: false,
    noAriaAttrs: true
  },
  u: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  ul: {
    contentTypes: ['flow'],
    allowedRoles: [
      'directory',
      'group',
      'listbox',
      'menu',
      'menubar',
      'none',
      'presentation',
      'radiogroup',
      'tablist',
      'toolbar',
      'tree'
    ]
  },
  var: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: true
  },
  video: {
    variant: {
      controls: {
        matches: '[controls]',
        contentTypes: ['interactive', 'embedded', 'phrasing', 'flow']
      },
      default: {
        contentTypes: ['embedded', 'phrasing', 'flow']
      }
    },
    allowedRoles: ['application'],
    chromiumRole: 'video'
  },
  wbr: {
    contentTypes: ['phrasing', 'flow'],
    allowedRoles: ['presentation', 'none'],
    allowedAriaAttrs: ['aria-hidden']
  }
};
export { htmlElms };


// axe merges dpub + graphics roles into the ariaRoles table.
export const ariaRoles: Record<string, any> = { ...ariaRolesBase, ...dpubRoles, ...graphicsRoles };
