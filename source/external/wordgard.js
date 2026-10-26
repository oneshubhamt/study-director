/* Wordgard 0.6.2 · MIT · Marijn Haverbeke. Built for Study Director @@SD_RELEASE@@ from vendor/wordgard
 * (exact upstream source) with the build-time rewrites in build/wordgard-source-patches.mjs. Holds the parts of
 * each package that Study Director's editor uses, on globalThis.StudyDirectorWordgard. A new Wordgard replaces this
 * module: replace vendor/wordgard and run npm run build:richtext. */
var StudyDirectorWordgard = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // rich-text/wordgard-module.ts
  var wordgard_module_exports = {};
  __export(wordgard_module_exports, {
    command: () => command_exports,
    doc: () => doc_exports,
    editor: () => editor_exports,
    history: () => history_exports,
    inertHtml: () => inert_html_exports,
    phrases: () => phrases_exports,
    set: () => set_exports,
    state: () => state_exports,
    table: () => table_exports,
    types: () => types_exports
  });

  // rich-text/wordgard-source/doc.ts
  var doc_exports = {};
  __export(doc_exports, {
    Attributes: () => Attributes,
    ChangeSet: () => ChangeSet,
    Elt: () => Elt,
    Leaf: () => Leaf,
    Mark: () => Mark,
    Node: () => Node,
    Plot: () => Plot,
    Pos: () => Pos,
    Schema: () => Schema,
    SchemaError: () => SchemaError,
    Slice: () => Slice,
    Token: () => Token,
    ValidationError: () => ValidationError,
    parse: () => parse,
    serialize: () => serialize
  });

  // vendor/wordgard/src/doc/text.ts
  var TextOutput = class {
    constructor(blockSep, leafText) {
      __publicField(this, "blockSep", blockSep);
      __publicField(this, "leafText", leafText);
      __publicField(this, "text", "");
      __publicField(this, "started", false);
    }
    serialize(node) {
      let nodeText = node.isPlot ? null : node.isText ? node.param : node.type.spec.toText ? node.type.spec.toText(node) : this.leafText ? this.leafText(node) : "";
      if (node.isLeaf ? node.isBlock && nodeText : node.isTextblock) this.openBlock();
      if (nodeText != null) {
        this.text += nodeText;
        this.started = true;
      }
      return nodeText != null;
    }
    openBlock() {
      if (this.started) this.text += this.blockSep;
      else this.started = true;
    }
  };

  // vendor/wordgard/src/doc/error.ts
  var SchemaError = class extends Error {
  };
  var ValidationError = class extends Error {
  };

  // vendor/wordgard/src/doc/slice.ts
  var Token;
  ((Token6) => {
    let Type;
    ((Type2) => {
      Type2[Type2["Open"] = 0] = "Open";
      Type2[Type2["Close"] = 1] = "Close";
      Type2[Type2["Node"] = 2] = "Node";
    })(Type = Token6.Type || (Token6.Type = {}));
    Token6.End = {
      tokenType: 1 /* Close */,
      /// @internal
      toString() {
        return "[end]";
      },
      toJSON() {
        return ".";
      }
    };
    function fromJSON(schema, value) {
      if (value === ".") return Token6.End;
      if (!value || typeof value.type != "string")
        throw new ValidationError("Invalid slice JSON");
      let type = schema.getNode(value.type);
      return type?.isLeaf || "content" in value ? schema.nodeFromJSON(value) : schema.tagFromJSON(value);
    }
    Token6.fromJSON = fromJSON;
  })(Token || (Token = {}));
  var _Slice = class _Slice {
    constructor(content, context) {
      __publicField(this, "content", content);
      __publicField(this, "context", context);
      /// The length of the slice's content.
      __publicField(this, "length");
      this.length = content.reduce((l, e) => l + (e.tokenType == 2 /* Node */ ? e.length : 1), 0);
    }
    /// Create a slice.
    static of(content, context) {
      return content.length || context && context.length ? new _Slice(content, context || _Slice.empty.context) : _Slice.empty;
    }
    /// Concatenate this slice to another slice.
    concat(other) {
      return new _Slice(_Slice.concat(this.content, other.content), this.context);
    }
    /// Get the text content of the slice's tokens.
    textContent(options = {}) {
      let { blockSeparator = "\n", leafText } = options;
      let out = new TextOutput(blockSeparator, leafText == null ? void 0 : typeof leafText == "string" ? () => leafText : leafText);
      for (let tok of this.content) {
        if (tok.tokenType == 0 /* Open */) {
          if (tok.isTextblock) out.openBlock();
        } else if (tok.tokenType == 2 /* Node */) {
          if (tok.isLeaf) out.serialize(tok);
          else tok.iterate((node) => !out.serialize(node));
        }
      }
      return out.text;
    }
    /// @internal
    toString() {
      return `<${this.content.join()}>`;
    }
    /// Create a slice (with context) from the given range of document
    /// content. `to` defaults to the end of the document.
    static get(doc2, from, to) {
      return new _Slice(doc2.slice(from, to), doc2.contextAt(from));
    }
    /// @internal
    static run(tokens, track, startPos = 0) {
      let pos = startPos;
      for (let elt of tokens) {
        if (elt.tokenType == 0 /* Open */) track.open(elt, pos++);
        else if (elt.tokenType == 2 /* Node */) {
          track.node(elt, pos);
          pos += elt.length;
        } else track.close(pos++);
      }
    }
    /// @internal
    static concat(a, b) {
      let tokens = a.slice();
      let i = 0;
      if (a.length && b.length && b[0].tokenType == 2 /* Node */ && a[a.length - 1].tokenType == 2 /* Node */) {
        b[0].pushTo(tokens);
        i = 1;
      }
      for (; i < b.length; i++) tokens.push(b[i]);
      return tokens;
    }
    /// @internal
    static slice(tokens, from, to = 1e9) {
      if (from == to) return _Slice.empty.content;
      let result = [], off = 0;
      for (let elt of tokens) {
        let start = off;
        off += elt.tokenType == 2 /* Node */ ? elt.length : 1;
        if (off <= from) continue;
        if (start < from || off > to) {
          let inner = elt.sliceInner(Math.max(0, from - start), Math.min(elt.length, to - start));
          for (let elt2 of inner) result.push(elt2);
        } else {
          result.push(elt);
        }
        if (off >= to) break;
      }
      return result;
    }
    /// @internal
    static eq(a, b) {
      if (a.length != b.length) return false;
      for (let i = 0; i < a.length; i++) {
        let tA = a[i], tB = b[i];
        if (tA.tokenType != tB.tokenType || tA.tokenType != 1 /* Close */ && !tA.eq(tB))
          return false;
      }
      return true;
    }
  };
  /// The empty slice.
  __publicField(_Slice, "empty", new _Slice([], []));
  var Slice = _Slice;

  // vendor/wordgard/src/doc/shape.ts
  var noChildren = [];
  var _Elt = class _Elt {
    constructor(tagName, attrs, children) {
      __publicField(this, "tagName", tagName);
      __publicField(this, "attrs", attrs);
      __publicField(this, "children", children);
    }
    /// Create an element. See also {@link Elt.mk} for a more ergonomic
    /// creation function.
    static create(tagName, attrs, children) {
      return new _Elt(tagName, attrs, children);
    }
    static mk(name, arg1, arg2) {
      let [attrs, children] = arg2 ? [Attributes.read(arg1), arg2] : !arg1 ? [Attributes.none, noChildren] : Array.isArray(arg1) ? [Attributes.none, arg1] : [Attributes.read(arg1), noChildren];
      if (children.length == 1 && children[0] === 0) children = _Elt.hole;
      return new _Elt(name, attrs, children);
    }
    /// True if this element or one of its children has a content hole.
    get hasContent() {
      return this.children.some((ch) => ch === 0 || ch instanceof _Elt && ch.hasContent);
    }
    /// Compare this element's tag name and attributes (not its
    /// children) to another element.
    eqTag(elt) {
      return elt.tagName == this.tagName && Attributes.eq(this.attrs, elt.attrs);
    }
    /// @internal
    eqChildren(elt) {
      if (elt.children == this.children) return true;
      if (this.children.length != elt.children.length) return false;
      for (let i = 0; i < this.children.length; i++) {
        let a = this.children[i], b = elt.children[i];
        if (a !== b && (!a || !b || typeof a != "object" || typeof b != "object" || a.constructor != b.constructor || !a.eq || !a.eq(b)))
          return false;
      }
      return true;
    }
    /// Compare this element (including its children) to another
    /// element.
    eq(other) {
      return other instanceof _Elt && this.eqTag(other) && this.eqChildren(other);
    }
    /// @internal
    outerDOM(doc2 = document) {
      let { tagName: name, attrs } = this;
      let dom = /^svg:/.test(name) ? doc2.createElementNS("http://www.w3.org/2000/svg", name.slice(4)) : /^math:/.test(name) ? doc2.createElementNS("http://www.w3.org/1998/Math/MathML", name.slice(5)) : doc2.createElement(name);
      for (let i = 0; i < attrs.length; ) dom.setAttribute(attrs[i++], attrs[i++]);
      return dom;
    }
    /// @internal
    wrap(wrapper, target) {
      if (target) {
        let added = this.modifyBySelector(wrapper, target);
        if (added) return added;
      }
      return wrapper.fill([this]);
    }
    /// @internal
    addAttrs(attrs, target) {
      if (target) {
        let added = this.modifyBySelector(attrs, target);
        if (added) return added;
      }
      return _Elt.create(this.tagName, Attributes.merge(this.attrs, attrs), this.children);
    }
    /// @internal
    fill(content) {
      let children = [];
      for (let ch of this.children) {
        if (ch === 0) {
          for (let c of content) children.push(c);
        } else if (ch instanceof _Elt && ch.hasContent) {
          children.push(ch.fill(content));
        } else {
          children.push(ch);
        }
      }
      return new _Elt(this.tagName, this.attrs, children);
    }
    modifyBySelector(mod, target) {
      if (target.match(this)) return mod instanceof _Elt ? mod.fill([this]) : this.addAttrs(mod);
      for (let i = 0; i < this.children.length; i++) {
        let ch = this.children[i], matched;
        if (ch instanceof _Elt && (matched = ch.modifyBySelector(mod, target))) {
          let copy2 = this.children.slice();
          copy2[i] = matched;
          return _Elt.create(this.tagName, this.attrs, copy2);
        }
      }
      return null;
    }
    /// Convert an element with string content to an HTML string.
    toHTML() {
      return toHTML(this);
    }
    /// Convert an element (with only string content) to a DOM tree.
    toDOM(doc2) {
      return toDOM(this, doc2);
    }
  };
  /// @internal
  __publicField(_Elt, "empty", []);
  /// @internal
  __publicField(_Elt, "hole", [0]);
  var Elt = _Elt;
  var selfClosing = /* @__PURE__ */ new Set([
    "area",
    "base",
    "br",
    "col",
    "command",
    "embed",
    "frame",
    "hr",
    "img",
    "input",
    "keygen",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
    "menuitem"
  ]);
  ((Elt2) => {
    class Fragment {
      constructor(content) {
        __publicField(this, "content", content);
      }
      /// Create a fragment.
      static create(content) {
        return new Fragment(content);
      }
      /// Convert this fragment to an HTML string.
      toHTML() {
        return toHTML(this);
      }
      /// Convert this fragment to a DOM fragment.
      toDOM(doc2) {
        let frag = getDoc(doc2).createDocumentFragment();
        for (let ch of this.content) frag.appendChild(toDOM(ch, doc2));
        return frag;
      }
    }
    Elt2.Fragment = Fragment;
    class Selector {
      constructor(tag, classes) {
        __publicField(this, "tag", tag);
        __publicField(this, "classes", classes);
      }
      eq(other) {
        return other.tag == this.tag && this.classes.length == other.classes.length && this.classes.every((c, i) => c == other.classes[i]);
      }
      match(elt) {
        if (this.tag && elt.tagName != this.tag) return false;
        if (this.classes.length) {
          let tagCls = Attributes.get(elt.attrs, "class");
          if (!tagCls) return false;
          let pieces = tagCls.split(/ +/);
          for (let cls of this.classes) if (!pieces.includes(cls)) return false;
        }
        return true;
      }
      static parse(selector) {
        let m, tag = null, classes = [], txt = selector;
        if (m = /^[\w\d\-_\u0c00-\uffff]+/.exec(txt)) {
          tag = m[0];
          txt = txt.slice(m[0].length);
        }
        while (m = /^\.[\w\d\-_\u0c00-\uffff]+/.exec(txt)) {
          classes.push(m[0].slice(1));
          txt = txt.slice(m[0].length);
        }
        if (txt) throw new Error("Invalid element selector " + selector);
        return new Selector(tag, classes);
      }
    }
    Elt2.Selector = Selector;
  })(Elt || (Elt = {}));
  function toHTML(content) {
    let html = "";
    function scan(elt) {
      if (typeof elt == "string") {
        html += elt.replace(/[<&]/g, (ch) => ch == "<" ? "&lt;" : "&amp;");
        return;
      } else if (elt === 0) {
        return;
      }
      let { tagName: name, attrs } = elt, svg, math;
      if (svg = /^svg:/.test(name)) name = name.slice(4);
      if (math = /^math:/.test(name)) name = name.slice(5);
      if (svg && name == "svg") html += `<svg xmlns="http://www.w3.org/2000/svg"`;
      if (math && name == "math") html += `<math xmlns="http://www.w3.org/1998/Math/MathML"`;
      else html += `<${name}`;
      for (let i = 0; i < attrs.length; ) {
        let name2 = attrs[i++], val = attrs[i++];
        html += ` ${name2}="${val.replace(/["&]/g, (ch) => ch == '"' ? "&quot;" : "&amp;")}"`;
      }
      if ((math || svg) && !elt.children.length) {
        html += "/>";
      } else if (!math && !svg && selfClosing.has(name)) {
        html += ">";
      } else {
        html += ">";
        for (let ch of elt.children) scan(ch);
        html += `</${name}>`;
      }
    }
    if (content instanceof Elt.Fragment) for (let elt of content.content) scan(elt);
    else scan(content);
    return html;
  }
  function getDoc(doc2) {
    if (doc2) return doc2;
    if (typeof document != "object" || !document.createElement) throw new Error("No document available");
    return document;
  }
  function toDOM(elt, doc2) {
    doc2 = getDoc(doc2);
    if (typeof elt == "string") {
      return doc2.createTextNode(elt);
    } else {
      let dom = elt.outerDOM(doc2);
      for (let ch of elt.children) if (ch !== 0) dom.appendChild(toDOM(ch, doc2));
      return dom;
    }
  }
  var Attributes;
  ((Attributes2) => {
    Attributes2.none = [];
    function eq(a, b) {
      if (a == b) return true;
      if (a.length != b.length) return false;
      for (let i = 0; i < a.length; i++) if (a[i] != b[i]) return false;
      return true;
    }
    Attributes2.eq = eq;
    function compare(a, b) {
      for (let iA = 0, iB = 0, score = 0; ; ) {
        if (iA < a.length && iB < b.length && a[iA] == b[iB]) {
          if (a[iA + 1] != b[iB + 1]) score--;
          iA += 2;
          iB += 2;
        } else if (iA < a.length && (iB == b.length || a[iA] < b[iB])) {
          score--;
          iA += 2;
        } else if (iB < b.length && iA == a.length) {
          score--;
          iB += 2;
        } else {
          return score;
        }
      }
    }
    Attributes2.compare = compare;
    function merge(a, b) {
      if (!a.length) return b;
      if (!b.length) return a;
      let result = [];
      for (let iA = 0, iB = 0; ; ) {
        let kA = iA < a.length ? a[iA] : null, kB = iB < b.length ? b[iB] : null;
        if (kA == kB) {
          if (kA == null) return result;
          let value = b[iB + 1];
          if (kA == "class") value = a[iA + 1] + " " + value;
          else if (kA == "style") value = a[iA + 1] + ";" + value;
          result.push(kA, value);
          iA += 2;
          iB += 2;
        } else if (kA != null && (kB == null || kA < kB)) {
          result.push(kA, a[iA + 1]);
          iA += 2;
        } else {
          result.push(kB, b[iB + 1]);
          iB += 2;
        }
      }
    }
    Attributes2.merge = merge;
    function push(a, name, value) {
      let i = 0;
      while (i < a.length && a[i] < name) i += 2;
      if (i < a.length && a[i] == name) {
        if (name == "class") a[i + 1] += " " + value;
        else if (name == "style") a[i + 1] += ";" + value;
        else a[i + 1] = value;
      } else {
        a.splice(i, 0, name, value);
      }
    }
    Attributes2.push = push;
    function read(obj) {
      let result = [];
      for (let prop in obj) if (prop != "_") {
        let value = obj[prop];
        if (value != null) {
          if (/^style\//.test(prop)) {
            value = prop.slice(6) + ": " + value;
            prop = "style";
          }
          Attributes2.push(result, prop, value);
        }
      }
      return result.length ? result : Attributes2.none;
    }
    Attributes2.read = read;
    function get(attrs, name) {
      for (let i = 0; i < attrs.length; i += 2) if (attrs[i] == name) return attrs[i + 1];
      return null;
    }
    Attributes2.get = get;
  })(Attributes || (Attributes = {}));
  var NodeShape = class _NodeShape {
    constructor(atom, create) {
      __publicField(this, "atom", atom);
      __publicField(this, "create", create);
    }
    static from(name, leaf, spec) {
      let atom = spec.atom, create;
      if ("element" in spec) {
        if (atom == null) atom = leaf;
        let { element, attributes } = spec;
        if (typeof attributes == "function") {
          create = (param) => Elt.create(element, Attributes.read(attributes(param)), atom ? Elt.empty : Elt.hole);
        } else {
          let elt = Elt.create(element, attributes ? Attributes.read(attributes) : Attributes.none, atom ? Elt.empty : Elt.hole);
          create = () => elt;
        }
      } else {
        if (leaf) atom = true;
        let { structure } = spec;
        if (typeof structure == "function") {
          if (atom == null) throw new Error(`Dynamic structure for tag ${name} must define an \`atom\` field`);
          create = structure;
        } else {
          if (atom == null)
            atom = !structure.hasContent;
          else if (atom != !structure.hasContent)
            throw new Error(`Disagreement between \`atom\` field and structure for tag ${name}`);
          create = () => structure;
        }
      }
      if (atom == false && leaf) throw new Error(`Leaf tag ${name}'s shape must be atomic`);
      return new _NodeShape(atom, create);
    }
  };

  // vendor/wordgard/src/doc/helper.ts
  var none = [];
  function compareDeep(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a != "object" || typeof b != "object") return false;
    let array = Array.isArray(a);
    if (Array.isArray(b) != array) return false;
    if (array) {
      if (a.length != b.length) return false;
      for (let i = 0; i < a.length; i++) if (!compareDeep(a[i], b[i])) return false;
    } else {
      for (let p in a) if (!(p in b) || !compareDeep(a[p], b[p])) return false;
      for (let p in b) if (!(p in a)) return false;
    }
    return true;
  }
  function eqArray(a, b) {
    if (a == b) return true;
    if (a.length != b.length) return false;
    for (let i = 0; i < a.length; i++) if (!a[i].eq(b[i])) return false;
    return true;
  }
  function validate(validator, value) {
    if (typeof validator == "string") {
      let types2 = validator.split("|");
      let name = value === null ? "null" : typeof value;
      if (types2.indexOf(name) < 0) throw new RangeError(`Expected value of type ${validator} got ${name}`);
    } else if (validator) {
      validator(value);
    }
    return value;
  }

  // vendor/wordgard/src/doc/mark.ts
  function remove(arr, index) {
    return arr.length == 1 ? none : arr.filter((_, i) => i != index);
  }
  function addSet(a, b, compare) {
    let result = [];
    for (let i = 0, j = 0; ; ) {
      if (i == a.length) {
        if (j == b.length) return result;
        result.push(b[j++]);
      } else if (j == b.length) {
        result.push(a[i++]);
      } else {
        let cmp = compare(a[i], b[j]);
        if (cmp == 0) i++;
        else if (cmp < 0) result.push(a[i++]);
        else result.push(b[j++]);
      }
    }
  }
  function subtractSet(a, b, compare) {
    let result = [];
    for (let i = 0, j = 0; ; ) {
      if (i == a.length) return result;
      if (j == b.length) {
        result.push(a[i++]);
      } else {
        let cmp = compare(a[i], b[j]);
        if (cmp == 0) i++;
        else if (cmp < 0) result.push(a[i++]);
        else j++;
      }
    }
  }
  var _Mark = class _Mark {
    constructor(type, value) {
      __publicField(this, "type", type);
      __publicField(this, "value", value);
    }
    /// @internal
    static create(type, value) {
      return new _Mark(type, value);
    }
    /// Compare this mark to another one. Parameter values are compared
    /// by structure.
    eq(other) {
      return this.type == other.type && compareDeep(this.value, other.value);
    }
    /// The name of this mark's type.
    get name() {
      return this.type.name;
    }
    /// @internal
    get rank() {
      return this.type.rank;
    }
    /// @internal
    get spanning() {
      return this.type.spanning;
    }
    /// @internal
    toString() {
      return this.value == null ? this.name : `${this.name}=${JSON.stringify(this.value)}`;
    }
    /// Define a singleton mark, without parameter.
    static define(name, spec) {
      return _Mark.Type.define(name, spec, true).default;
    }
    /// Add this mark to the given set. Will overwrite existing
    /// instances of the mark in the set, unless this is a {@link
    /// Mark.Spec.set set-valued} mark.
    addToSet(set) {
      let placed = null, copy2 = [];
      for (let i = 0; i < set.length; i++) {
        let other = set[i];
        if (this.eq(other)) return set;
        if (other.type != this.type) {
          if (!placed && this.type.compareRank(other.type) < 0) copy2.push(placed = this);
          copy2.push(other);
        } else if (this.type.set) {
          copy2.push(placed = new _Mark(this.type, addSet(other.value, this.value, this.type.set)));
        }
      }
      if (!placed) copy2.push(this);
      return copy2;
    }
    /// Remove this mark from the given set.
    removeFromSet(set) {
      let type = this.type;
      for (var i = 0; i < set.length; i++) if (set[i].type == type) {
        let val = set[i], newSet;
        if (type.set) {
          let rest = subtractSet(val.value, this.value, type.set);
          if (!rest.length) {
            newSet = remove(set, i);
          } else {
            newSet = set.slice();
            newSet[i] = new _Mark(type, rest);
          }
        } else if (!val.eq(this)) {
          continue;
        } else {
          newSet = remove(set, i);
        }
        return newSet;
      }
      return set;
    }
    /// Test whether this mark is in the given set.
    isInSet(set) {
      for (let v of set) if (v.eq(this)) return v;
      return null;
    }
    /// Compare two sets of marks.
    static sameSet(a, b) {
      return eqArray(a, b);
    }
  };
  /// The empty mark set.
  __publicField(_Mark, "none", none);
  var Mark = _Mark;
  ((Mark8) => {
    class Type {
      constructor(name, spec, isFlag) {
        __publicField(this, "name", name);
        /// @internal
        __publicField(this, "rank");
        /// @internal
        __publicField(this, "set");
        /// The {@link Mark.Spec.defaultParam default} mark for this type,
        /// if any.
        __publicField(this, "default");
        /// Whether this is an {@link Mark.Spec.inclusive inclusive} mark.
        __publicField(this, "inclusive");
        /// @internal
        __publicField(this, "element", null);
        /// @internal
        __publicField(this, "attribute", null);
        /// Whether this is a {@link Mark.Spec.spanning spanning} mark.
        __publicField(this, "spanning");
        /// The spec used to define this mark. (Its type parameter is set
        /// to `any` to circumvent a typing issue where `Mark<T>` isn't a
        /// subtype of `Mark<unknown>`.)
        __publicField(this, "spec");
        this.spec = spec;
        this.rank = Math.max(0, Math.min(spec.rank ?? 100, 100));
        this.set = spec.set ? spec.set.compare : null;
        this.default = isFlag || "defaultParam" in spec ? Mark8.create(this, isFlag ? null : spec.defaultParam) : null;
        this.inclusive = spec.inclusive !== false;
        if ("element" in spec.shape) this.element = new ElementShape(spec.shape);
        else this.attribute = new AttributeShape(spec.shape, this);
        this.spanning = this.element ? spec.spanning !== false : !!spec.spanning;
      }
      /// Create a mark of this type.
      of(value) {
        return Mark8.create(this, value);
      }
      /// @internal
      compareRank(other) {
        return this.rank - other.rank || (other.name < this.name ? 1 : -1);
      }
      /// Remove the mark of this type from the given set, if present.
      removeFromSet(set) {
        for (var i = 0; i < set.length; i++) if (set[i].type == this) return remove(set, i);
        return set;
      }
      /// Test whether there is a mark of this type in the given set. If
      /// so, return it.
      isInSet(set) {
        for (let v of set) if (v.type == this) return v;
        return null;
      }
      /// Whether this mark is rendered with an element.
      get isElement() {
        return !!this.element;
      }
      /// Define a mark type with the given parameter type.
      static define(name, spec, isFlag = false) {
        return new Mark8.Type(name, spec, isFlag);
      }
    }
    Mark8.Type = Type;
  })(Mark || (Mark = {}));
  var ElementShape = class {
    constructor(spec) {
      __publicField(this, "name");
      __publicField(this, "attrs");
      this.name = spec.element;
      const { attributes } = spec;
      if (typeof attributes == "function") {
        this.attrs = (value) => Attributes.read(attributes(value));
      } else {
        let attrs = attributes ? Attributes.read(attributes) : Attributes.none;
        this.attrs = () => attrs;
      }
    }
  };
  var AttributeShape = class {
    constructor(spec, type) {
      __publicField(this, "get");
      __publicField(this, "target");
      if ("attribute" in spec) {
        const { value, attribute } = spec, style = /^style\//.test(attribute) ? attribute.slice(6) + ": " : null;
        if (value === 0) {
          if (type.default) throw new SchemaError("Attribute shapes for parameter-less marks cannot use 0 as value");
          if (style) this.get = (param) => ["style", style + param];
          else this.get = (param) => [attribute, String(param)];
        } else if (typeof value == "function") {
          if (style)
            this.get = (param) => {
              let val = value(param);
              return val == null ? Attributes.none : ["style", style + val];
            };
          else
            this.get = (param) => {
              let val = value(param);
              return val == null ? Attributes.none : [attribute, val];
            };
        } else {
          let attrs = style ? ["style", style + value] : [attribute, value];
          this.get = () => attrs;
        }
      } else {
        const { attributes } = spec;
        if (typeof attributes == "function") {
          this.get = (param) => Attributes.read(attributes(param));
        } else {
          let attrs = Attributes.read(attributes);
          this.get = () => attrs;
        }
      }
      this.target = spec.preferTarget ? Elt.Selector.parse(spec.preferTarget) : null;
    }
  };

  // vendor/wordgard/src/doc/pos.ts
  var Pos = class _Pos {
    constructor(parent, pos, index, inText) {
      __publicField(this, "parent", parent);
      __publicField(this, "pos", pos);
      __publicField(this, "index", index);
      __publicField(this, "inText", inText);
    }
    /// @internal
    static create(parent, pos, index, inText) {
      return new _Pos(parent, pos, index, inText);
    }
    /// Find the innermost parent plot for which the given predicate
    /// returns true.
    matchingParent(pred) {
      for (let { parent } = this; ; ) {
        if (pred(parent.node)) return parent;
        if (!parent.parent) return null;
        ({ parent } = parent);
      }
    }
    /// Move ahead through the document the given number of positions.
    /// Don't descend into nodes that fall entirely within the skipped
    /// range. If `walk` is given, call methods on it for each node
    /// entered, skipped, or left. Return a new position at the end of
    /// the range.
    advance(distance, walk) {
      return distance ? advancePos(distance, this.parent, this.pos, this.index, this.inText, walk) : this;
    }
    /// Move ahead through the document, always entering every plot. If
    /// `walk` is given, call methods on it for each node or node
    /// boundary passed. Return a new position.
    walk(distance, walk) {
      return distance ? advancePos(distance, this.parent, this.pos, this.index, this.inText, walk, true) : this;
    }
    /// Get the node directly after this position. If `inText` is
    /// non-zero, return only the part of the text node that's after the
    /// position.
    get nodeAfter() {
      if (this.index == this.parent.node.content.length) return null;
      let node = this.parent.node.content[this.index];
      return this.inText ? node.sliceText(this.inText) : node;
    }
    /// Get the node directly before this position. If `inText` is
    /// non-zero, return only the part of the text node before the
    /// position.
    get nodeBefore() {
      if (this.inText) return this.parent.node.content[this.index].sliceText(0, this.inText);
      return this.index ? this.parent.node.content[this.index - 1] : null;
    }
    /// Get the nearest parent that is a {@link Plot.isTextblock
    /// textblock}.
    get textblockParent() {
      for (let p = this.parent; ; p = p.parent) {
        if (!p || !p.node.inlineContent) return null;
        if (p.node.isTextblock) return p;
      }
    }
    /// Get the depth of this position (the amount of plots that wrap
    /// it, not counting the document).
    get depth() {
      return this.parent.depth;
    }
    /// Get the parent plot at the given depth.
    parentAt(depth2) {
      let d = this.depth;
      if (depth2 > d) throw new RangeError("Asking for parent deeper than position depth");
      for (let d2 = this.depth, p = this.parent; ; p = p.parent)
        if (d2 == depth2) return p;
    }
    /// Returns true if this position is right at the start of the given
    /// parent plot, or transitively at the start of its first child.
    isAtStart(parent) {
      if (this.inText) return false;
      for (let p = this.parent, index = this.index; ; index = p.index, p = p.parent) {
        if (!p || index) return false;
        if (p.pos == parent.pos) return true;
      }
    }
    /// Returns true if this position is right at the end of the given
    /// parent plot, or transitively at the end of its last child.
    isAtEnd(parent) {
      if (this.inText) return false;
      for (let p = this.parent, index = this.index; ; index = p.index + 1, p = p.parent) {
        if (!p || index < p.node.content.length) return false;
        if (p.pos == parent.pos) return true;
      }
    }
    /// Get the document that this position points into.
    get doc() {
      return this.parent.doc;
    }
    /// Get the set of active inline marks at this position or, if
    /// `across` is given, the marks that would apply to content
    /// replacing the range between that `this` and `across`.
    marks(across) {
      if (this.inText && (!across || across.pos == this.pos)) return this.parent.node.content[this.index].tag.marks;
      let [from, to] = !across ? [this, this] : across.pos > this.pos ? [this, across] : [across, this];
      if (!from.parent.node.inlineContent || !to.parent.node.inlineContent) return Mark.none;
      let before = from.nodeBefore, after = to.nodeAfter;
      let [main, sec] = before ? [before.tag.marks, after ? after.tag.marks : none] : [after ? after.tag.marks : none, none];
      return main.filter((p) => p.spanning && (p.type.inclusive || p.isInSet(sec)));
    }
    /// @internal
    static resolve(doc2, pos) {
      if (pos < 0 || pos > doc2.length) throw new RangeError(`Resolving invalid position ${pos}`);
      let { top: top2, cache: cache3 } = cacheFor(doc2), nearest, nearestDist = 0, result;
      if (pos == 0) return _Pos.create(top2, 0, 0, 0);
      for (let elt of cache3) {
        if (elt.pos == pos) return elt;
        let dist2 = Math.abs(elt.pos - pos);
        if (!nearest || dist2 < nearestDist) {
          nearest = elt;
          nearestDist = dist2;
        }
      }
      if (nearest) {
        let { parent } = nearest;
        while (parent.start > pos || parent.end < pos) parent = parent.parent;
        result = advancePos(pos - parent.start, parent, parent.start, 0, 0);
      } else {
        result = advancePos(pos, top2, 0, 0, 0);
      }
      return cache3[cache3.length < cacheSize ? cache3.length : cachePos = (cachePos + 1) % cacheSize] = result;
    }
    /// @internal
    static resolveNode(doc2, pos) {
      let base = this.resolve(doc2, pos);
      if (base.inText) return null;
      let after = base.nodeAfter;
      return !after || after.isText ? null : after.isLeaf ? _Pos.Node.create(base.parent, after, pos, base.index) : _Pos.Plot.create(base.parent, after, pos, base.index);
    }
  };
  ((Pos10) => {
    class Node9 {
      /// @hidden
      constructor(parent, node, pos, index) {
        __publicField(this, "parent", parent);
        __publicField(this, "node", node);
        __publicField(this, "pos", pos);
        __publicField(this, "index", index);
      }
      /// @internal
      static create(parent, node, pos, index) {
        return new Node9(parent, node, pos, index);
      }
      /// The position before the node. Will raise an error if this is
      /// the document top node.
      get before() {
        if (this.pos < 0) throw new RangeError("Accessing `before` on the top level node");
        return this.pos;
      }
      /// The position after the node. Throws if this is a document.
      get after() {
        if (this.pos < 0) throw new RangeError("Accessing `after` on the top level node");
        return this.pos + this.node.length;
      }
      /// The depth of this node (the number of parent nodes, not
      /// counting the document).
      get depth() {
        let d = 0;
        for (let n = this; n.parent; n = n.parent) d++;
        return d;
      }
      /// The document that this position points into.
      get doc() {
        let n = this;
        while (n.parent) n = n.parent;
        if (!n.node.isDoc) throw new Error("Outer parent not a document");
        return n.node;
      }
      /// Returns true if this is either a document node or the first
      /// node in its parent.
      get isFirst() {
        return !this.parent || this.index == 0;
      }
      /// Returns true if this is a document node or the last node in its parent.
      get isLast() {
        return !this.parent || this.index == this.parent.node.content.length - 1;
      }
      /// The node before this one, if any.
      get nextSibling() {
        return this.isLast ? null : this.parent.node.content[this.index + 1];
      }
      /// The node after this node, if any.
      get previousSibling() {
        return this.isFirst ? null : this.parent.node.content[this.index - 1];
      }
    }
    Pos10.Node = Node9;
    class Plot12 extends Pos10.Node {
      constructor(parent, node, pos, index) {
        super(parent, node, pos, index);
      }
      /// @internal
      static create(parent, node, pos, index) {
        return new Plot12(parent, node, pos, index);
      }
      /// The position at the start of this plot's content.
      get start() {
        return this.pos + 1;
      }
      /// The position at end of this plot's content.
      get end() {
        return this.pos + 1 + this.node.contentLength;
      }
    }
    Pos10.Plot = Plot12;
  })(Pos || (Pos = {}));
  var posCache = /* @__PURE__ */ new WeakMap();
  var cacheSize = 8;
  var cachePos = 0;
  function cacheFor(doc2) {
    let found = posCache.get(doc2);
    if (!found) posCache.set(doc2, found = { top: Pos.Plot.create(null, doc2, -1, 0), cache: [] });
    return found;
  }
  function advancePos(distance, parent, pos, index, inText, walk, full = false) {
    let target = pos + distance, { node } = parent;
    if (inText) {
      let text = node.content[index];
      let textStart = pos - inText, textEnd = textStart + text.length;
      if (walk) walk.skip(text.sliceText(inText, Math.min(text.length, target - textStart)), pos, parent, index);
      if (target < textEnd)
        return Pos.create(parent, target, index, target - textStart);
      pos = textEnd;
      index++;
    }
    while (pos < target) {
      if (index == node.content.length) {
        if (!parent.parent) throw new Error("Moving past end of document");
        if (walk) walk.leavePlot(node.tag, pos, parent.parent, parent.index);
        ({ index, parent } = parent);
        node = parent.node;
        index++;
        pos++;
      } else {
        let next = node.content[index], end = pos + next.length;
        if (next.isLeaf) {
          if (next.isText && target < end) {
            if (walk) walk.skip(next.sliceText(0, target - pos), pos, parent, index);
            return Pos.create(parent, target, index, target - pos);
          } else {
            if (walk) walk.skip(next, pos, parent, index);
            pos = end;
            index++;
          }
        } else {
          let enter2 = full || target < end;
          if (walk) {
            if (!enter2) walk.skip(next, pos, parent, index);
            else if (walk.enterPlot(next, pos, parent, index) === false && target >= end) enter2 = false;
          }
          if (enter2) {
            parent = Pos.Plot.create(parent, next, pos, index);
            pos++;
            node = next;
            index = 0;
          } else {
            pos = end;
            index++;
          }
        }
      }
    }
    return Pos.create(parent, pos, index, 0);
  }

  // vendor/wordgard/src/doc/node.ts
  var BaseType = class {
    /// @internal
    constructor(name, flags, spec, shape) {
      __publicField(this, "name", name);
      __publicField(this, "flags", flags);
      __publicField(this, "shape", shape);
      /// @internal
      __publicField(this, "roles", /* @__PURE__ */ new Set());
      if (spec.role instanceof Node.Role) this.roles.add(spec.role);
      else if (spec.role) for (let role of spec.role) this.roles.add(role);
      if (this.shape.atom) this.flags |= 4 /* Atom */;
    }
    /// Test whether this node has the given role.
    hasRole(role) {
      return this.roles.has(role);
    }
    /// True when this is an inline node type.
    get isInline() {
      return (this.flags & 1 /* Inline */) > 0;
    }
    /// True when this is a block node type.
    get isBlock() {
      return (this.flags & 1 /* Inline */) == 0;
    }
    /// @internal used by Configuration.isAtom
    get isAtom() {
      return (this.flags & 4 /* Atom */) > 0;
    }
    /// Whether this node is {@link Node.Spec.selectable selectable}.
    get isSelectable() {
      return (this.flags & 32 /* Selectable */) > 0;
    }
  };
  var BaseTag = class {
    constructor(param, marks) {
      __publicField(this, "param", param);
      __publicField(this, "marks", marks);
    }
    mark(mark) {
      for (let v of this.marks) if (v.type == mark) return v.value;
      return void 0;
    }
    get name() {
      return this.type.name;
    }
    get isText() {
      return this.type == Leaf.Text;
    }
    is(type) {
      return this.type == type;
    }
    toJSON() {
      let result = { type: this.name };
      if (this != this.type.default) result.param = this.param;
      if (this.marks.length) {
        result.marks = /* @__PURE__ */ Object.create(null);
        for (let { name, value } of this.marks) result.marks[name] = value;
      }
      return result;
    }
  };
  var Node;
  ((Node9) => {
    let Type;
    ((Type2) => {
      function get(ref) {
        return ref instanceof BaseType ? ref : ref.type;
      }
      Type2.get = get;
    })(Type = Node9.Type || (Node9.Type = {}));
    const _Group = class _Group {
      constructor(parent) {
        __publicField(this, "parent", parent);
      }
      /// Define a custom node group.
      static define(parent) {
        return new _Group(parent);
      }
    };
    /// A group that contains every node type.
    __publicField(_Group, "All", _Group.define());
    /// All inline nodes are automatically assigned to this group.
    __publicField(_Group, "Inline", _Group.define());
    /// Block elements automatically get assigned to this group.
    __publicField(_Group, "Block", _Group.define());
    /// The group of all leaf nodes.
    __publicField(_Group, "Leaf", _Group.define());
    /// The group of all non-leaf nodes.
    __publicField(_Group, "Plot", _Group.define());
    /// Block plots with inline content are tagged as textblocks.
    __publicField(_Group, "Textblock", _Group.define());
    /// A group used for generic block content, such as paragraphs and
    /// lists. The basic schema uses this as the content type for the
    /// top level document, blockquotes, and list items.
    __publicField(_Group, "Content", _Group.define());
    /// Group for the cell nodes in tables.
    __publicField(_Group, "TableCell", _Group.define());
    /// Generic list item group.
    __publicField(_Group, "ListItem", _Group.define());
    /// @internal
    __publicField(_Group, "builtin", [_Group.All, _Group.Inline, _Group.Block, _Group.Leaf, _Group.Plot, _Group.Textblock]);
    let Group = _Group;
    Node9.Group = _Group;
    const _Role = class _Role {
      constructor() {
      }
      /// Define a new role.
      static define() {
        return new _Role();
      }
    };
    /// This role indicates that a plot contains code, and makes some
    /// commands behave differently inside such a plot.
    __publicField(_Role, "Code", _Role.define());
    /// Identifies a plot as a list container. This makes some
    /// commands treat the plot specially.
    __publicField(_Role, "List", _Role.define());
    /// A single leaf type in a schema may have the `LineBreak` role,
    /// which identifies it as the canonical node that represents a
    /// line break. Nodes marked as line breaks will be parsed from
    /// and serialized to newline characters inside {@link
    /// Plot.Spec.preserveWhitespace whitespace-preserving} nodes.
    __publicField(_Role, "LineBreak", _Role.define());
    let Role = _Role;
    Node9.Role = _Role;
  })(Node || (Node = {}));
  var Leaf = class _Leaf extends BaseTag {
    constructor(type, param, marks) {
      super(param, marks);
      __publicField(this, "type", type);
    }
    /// @internal
    static new(type, param, marks) {
      return new _Leaf(type, param, marks);
    }
    get tag() {
      return this;
    }
    eq(other) {
      return this == other || other.isLeaf && this.type == other.type && compareDeep(this.param, other.param) && Mark.sameSet(this.marks, other.marks);
    }
    /// Define a singleton leaf type, without parameter. If you need to
    /// store a parameter value in each leaf of the type, use {@link
    /// Leaf.Type.define} instead.
    static define(name, spec) {
      return _Leaf.Type.new(name, flagsFor(spec) | 16 /* NullParam */, spec).default;
    }
    withMarks(marks) {
      return Mark.sameSet(this.marks, marks) ? this : this.type.of(this.param, marks);
    }
    /// In {@link Slice slices}, leaf nodes count as node {@link Token
    /// tokens}.
    get tokenType() {
      return Token.Type.Node;
    }
    get isLeaf() {
      return true;
    }
    get isPlot() {
      return false;
    }
    get isInline() {
      return this.type.isInline;
    }
    get isBlock() {
      return this.type.isBlock;
    }
    get length() {
      return this.is(_Leaf.Text) ? this.param.length : 1;
    }
    /// @internal
    pushTo(nodes) {
      if (this.is(_Leaf.Text)) {
        let prevI = nodes.length - 1, prev = prevI >= 0 ? nodes[prevI] : null;
        if (prev && prev.is(_Leaf.Text) && Mark.sameSet(prev.marks, this.marks)) {
          nodes[prevI] = _Leaf.text(prev.param + this.param, this.marks);
          return;
        }
      }
      nodes.push(this);
    }
    /// @internal
    sliceInner(from, to) {
      return from == to ? Slice.empty.content : [this.is(_Leaf.Text) ? this.sliceText(from, to) : this];
    }
    /// @internal
    sliceText(from, to) {
      if (!this.is(_Leaf.Text)) throw new Error("Calling sliceText on a non-text node");
      if (to == null) to = this.param.length;
      if (!from && to == this.param.length) return this;
      return _Leaf.Text.of(this.param.slice(Math.max(from, 0), Math.max(0, to)), this.marks);
    }
    /// Create a text node with the given text and mark set.
    static text(text, marks = Mark.none) {
      return _Leaf.Text.of(text, marks);
    }
    /// @internal
    toString() {
      return (this.is(_Leaf.Text) ? JSON.stringify(this.param) : this.name) + markString(this.marks);
    }
  };
  ((Leaf3) => {
    class Type extends BaseType {
      constructor(name, flags, spec) {
        super(name, flags, spec, NodeShape.from(name, true, spec.shape));
        /// A default leaf for this type. Available if the leaf was
        /// defined with {@link Leaf.define}, or a {@link
        /// Node.Spec.defaultParam} was given.
        __publicField(this, "default");
        /// The spec used to define this type. Its type parameter is
        /// cleared to avoid this field making the class invariant (in the
        /// type system sense), which would prevent `Leaf.Type<unknown>`
        /// from being a supertype of specific leaf types.
        __publicField(this, "spec");
        this.spec = spec;
        this.default = "defaultParam" in spec ? Leaf3.new(this, spec.defaultParam, none) : flags & 16 /* NullParam */ ? Leaf3.new(this, null, none) : null;
      }
      /// @internal
      static new(name, flags, spec) {
        return new Type(name, flags, spec);
      }
      /// Define a new leaf type.
      static define(name, spec) {
        return new Leaf3.Type(name, flagsFor(spec), spec);
      }
      /// Create a leaf with this type.
      of(param, marks = Mark.none) {
        if (!marks.length && this.default && compareDeep(this.default.param, param)) return this.default;
        return Leaf3.new(this, param, marks);
      }
      /// Used to narrow {@link Node.Type} values to {@link Leaf}.
      get isLeaf() {
        return true;
      }
      /// Leaves are not plots.
      get isPlot() {
        return false;
      }
    }
    Leaf3.Type = Type;
    Leaf3.Text = Leaf3.Type.new("Text", 1 /* Inline */, {
      shape: { element: "" }
    });
  })(Leaf || (Leaf = {}));
  var Plot = class _Plot {
    /// @internal
    constructor(tag, content) {
      __publicField(this, "tag", tag);
      __publicField(this, "content", content);
      /// The sum of the length of this plot's content nodes.
      __publicField(this, "contentLength");
      this.tag = tag;
      this.contentLength = content.reduce((s, c) => s + c.length, 0);
    }
    /// @internal
    static create(tag, content) {
      return new _Plot(tag, content);
    }
    get name() {
      return this.tag.name;
    }
    /// The type of this plot's tag.
    get type() {
      return this.tag.type;
    }
    get marks() {
      return this.tag.marks;
    }
    get length() {
      return 2 + this.contentLength;
    }
    eq(other) {
      return this == other || other instanceof _Plot && this.tag.eq(other.tag) && this.contentEq(other);
    }
    /// Compare the content of this plot to the content of the given
    /// plot.
    contentEq(other) {
      return eqArray(this.content, other.content);
    }
    /// @internal
    sliceInner(from, to) {
      if (from == to) return Slice.empty.content;
      let content = [];
      this.slicePlot(content, from, to);
      return content;
    }
    /// @internal
    slicePlot(out, from, to) {
      if (from <= 0) {
        if (to >= this.length) {
          out.push(this);
          return;
        }
        out.push(this.tag);
      }
      sliceContent(out, this.content, from - 1, to - 1);
      if (to >= this.length) out.push(_Plot.End);
    }
    /// @hidden
    is(type) {
      return false;
    }
    get isText() {
      return false;
    }
    /// Tells you whether the content of this plot is inline.
    get inlineContent() {
      return this.type.inlineContent;
    }
    /// True if this is a block node with inline content.
    get isTextblock() {
      return this.type.isTextblock;
    }
    get isLeaf() {
      return false;
    }
    get isPlot() {
      return true;
    }
    get isInline() {
      return this.type.isInline;
    }
    get isBlock() {
      return this.type.isBlock;
    }
    /// True if this is a document node.
    get isDoc() {
      return this.type.isDoc;
    }
    /// Get the plot's first child, if any.
    get firstChild() {
      return this.content.length ? this.content[0] : null;
    }
    /// Get the plot's first child.
    get lastChild() {
      let last = this.content.length - 1;
      return last < 0 ? null : this.content[last];
    }
    iterate(a, b, c) {
      let [from, to, f] = typeof a == "number" ? [a, b, c] : [0, this.length, a];
      if (this.isDoc || f(this, 0, null, 0) !== false) {
        if (to < from) this.iterBack(this.contentLength, to, from, f);
        else this.iterInner(0, from, to, f);
      }
    }
    /// Return the node that starts at the given offset from this node's
    /// content start, if any. Will not return text nodes.
    nodeAt(pos) {
      for (let node of this.content) {
        if (pos == 0) return node.isText ? null : node;
        if (pos < node.length) return node.isLeaf ? null : node.nodeAt(pos - 1);
        pos -= node.length;
      }
      return null;
    }
    /// Return the plot at the given offset, if any.
    plotAt(pos) {
      let node = this.nodeAt(pos);
      return node instanceof _Plot ? node : null;
    }
    /// Return the text content of this plot.
    textContent(options = {}) {
      let { from = 0, to = this.length, blockSeparator = "\n", leafText } = options;
      let out = new TextOutput(blockSeparator, leafText == null ? void 0 : typeof leafText == "string" ? () => leafText : leafText);
      this.iterate(from, to, (node, pos) => {
        return !out.serialize(node.is(Leaf.Text) ? node.sliceText(
          Math.max(0, from - pos),
          Math.min(node.length, to - pos)
        ) : node);
      });
      return out.text;
    }
    /// @internal
    iterInner(contentStart, from, to, f) {
      for (let pos = contentStart, i = 0; i < this.content.length; i++) {
        if (pos >= to) break;
        let node = this.content[i], start = pos;
        pos += node.length;
        if (pos > from && f(node, start, this, i) !== false && node.isPlot) node.iterInner(start + 1, from, to, f);
      }
    }
    /// @internal
    iterBack(contentEnd, from, to, f) {
      for (let pos = contentEnd, i = this.content.length - 1; i >= 0; i--) {
        if (pos <= from) break;
        let node = this.content[i], end = pos;
        pos -= node.length;
        if (pos < to && f(node, pos, this, i) !== false && node.isPlot) node.iterBack(end - 1, from, to, f);
      }
    }
    /// @internal
    toString() {
      return this.name + markString(this.tag.marks) + "(" + this.content.join() + ")";
    }
    toJSON() {
      let result = this.tag.toJSON();
      result.content = this.content.map((c) => c.toJSON());
      return result;
    }
    mark(mark) {
      return this.tag.mark(mark);
    }
    /// @internal
    pushTo(nodes) {
      nodes.push(this);
    }
    withMarks(marks) {
      return Mark.sameSet(this.tag.marks, marks) ? this : this.tag.withMarks(marks).create(this.content);
    }
    /// Plot nodes count as node {@link Token tokens} in a {@link
    /// Slice}.
    get tokenType() {
      return Token.Type.Node;
    }
    /// Define a singleton plot type. If the plot needs a parameter
    /// value, use {@link Plot.Type.define} instead.
    static define(name, spec) {
      return _Plot.Type.new(name, flagsFor(spec) | 16 /* NullParam */, spec).default;
    }
    /// Define a document plot type. Exactly one of these must occur in a schema.
    static defineDoc(spec) {
      if (!spec.inlineContent && !spec.blockContent) throw new SchemaError("Doc nodes must allow content");
      let flags = 16 /* NullParam */ | 8 /* Doc */ | 16 /* NullParam */;
      if (spec.inlineContent) flags |= 2 /* InlineContent */;
      if (spec.inlineContent || spec.canBeEmpty) flags |= 64 /* CanBeEmpty */;
      return _Plot.Type.new("Doc", flags, {
        ...spec,
        shape: { element: "" }
      });
    }
  };
  ((Plot12) => {
    Plot12.End = Token.End;
    class Tag extends BaseTag {
      constructor(type, param, marks) {
        super(param, marks);
        __publicField(this, "type", type);
      }
      /// @internal
      static new(type, param, marks) {
        return new Tag(type, param, marks);
      }
      eq(other) {
        return this == other || other instanceof Plot12.Tag && this.type == other.type && compareDeep(this.param, other.param) && Mark.sameSet(this.marks, other.marks);
      }
      /// Create a plot with this tag and the given content.
      create(content) {
        if (this.isDoc) throw new Error("Document nodes must be created with schema.doc()");
        return Plot12.create(this, content ? joinText(content) : none);
      }
      /// Create a copy of this tag with the given marks.
      withMarks(marks) {
        return Mark.sameSet(this.marks, marks) ? this : this.type.of(this.param, marks);
      }
      /// Return a tag that represents content split off from the plot
      /// with this tag. Will respect the {@link Mark.Spec.keepOnSplit}
      /// mark property. `atEnd` should be set to true if the split
      /// happens at the end of the plot's content.
      split(atEnd) {
        return this.marks.length ? this.withMarks(this.marks.filter((p) => {
          let { keepOnSplit } = p.type.spec;
          return keepOnSplit && (keepOnSplit === true || keepOnSplit(this, atEnd));
        })) : this;
      }
      /// A plot tag counts as an open {@link Token token} in a {@link
      /// Slice slice}.
      get tokenType() {
        return Token.Type.Open;
      }
      /// True when this plot type contains inline content.
      get inlineContent() {
        return this.type.inlineContent;
      }
      /// True when this is a block plot with inline content.
      get isTextblock() {
        return this.type.isTextblock;
      }
      get isLeaf() {
        return false;
      }
      get isPlot() {
        return true;
      }
      /// Test whether this is a document plot.
      get isDoc() {
        return this.type.isDoc;
      }
      /// @internal
      toString() {
        return this.type.name + markString(this.marks);
      }
    }
    Plot12.Tag = Tag;
    class Type extends BaseType {
      constructor(name, flags, spec) {
        super(name, flags, spec, NodeShape.from(name, false, spec.shape));
        /// A default tag for this plot type.
        __publicField(this, "default");
        /// Whether the {@link Plot.Spec.isolating} flag is set on this
        /// plot type.
        __publicField(this, "isolating");
        /// The plot's {@link Plot.Spec.defining} flag.
        __publicField(this, "defining");
        /// The plot's {@link Plot.Spec.neutral} flag.
        __publicField(this, "neutral");
        /// Whether whitespace should be preserved inside this plot.
        __publicField(this, "preserveWhitespace");
        /// The orientation of the content of the plot. Will be `"row"`
        /// for plots with inline content, and defaults to `"column"` for
        /// plots with block content unless explicitly {@link
        /// Plot.Spec.orientation set}.
        __publicField(this, "orientation");
        /// The spec used to define this plot type.
        __publicField(this, "spec");
        this.spec = spec;
        if (!spec.inlineContent && !spec.blockContent)
          throw new SchemaError("Plot definitions must specify either inlineContent or blockContent");
        this.isolating = !!spec.isolating;
        this.defining = !!spec.defining;
        this.neutral = spec.neutral ?? !this.defining;
        this.preserveWhitespace = spec.preserveWhitespace ?? !!this.hasRole(Node.Role.Code);
        this.orientation = flags & 2 /* InlineContent */ ? "row" : spec.orientation || "column";
        this.default = "defaultParam" in spec ? Plot12.Tag.new(this, spec.defaultParam, none) : flags & 16 /* NullParam */ ? Plot12.Tag.new(this, null, none) : null;
        if (!this.shape.atom && this.isInline && !this.inlineContent)
          throw new SchemaError("Inline tags with block content must be marked as atoms");
      }
      /// @internal
      static new(name, flags, spec) {
        return new Type(name, flags, spec);
      }
      /// Define a plot type.
      static define(name, spec) {
        return new Plot12.Type(name, flagsFor(spec), spec);
      }
      /// Create a plot tag of this type with the given parameter and
      /// mark set.
      of(param, marks = Mark.none) {
        if (!marks.length && this.default && compareDeep(this.default.param, param)) return this.default;
        return Plot12.Tag.new(this, param, marks);
      }
      /// Tells you whether this plot type has inline content.
      get inlineContent() {
        return (this.flags & 2 /* InlineContent */) > 0;
      }
      /// True if this is a block plot with inline content.
      get isTextblock() {
        return this.isBlock && this.inlineContent;
      }
      /// True if this is a document plot type.
      get isDoc() {
        return (this.flags & 8 /* Doc */) > 0;
      }
      /// Tells you that this is not a leaf type.
      get isLeaf() {
        return false;
      }
      /// This is a plot type. Can be used to narrow `Node.Type` to
      /// `Plot.Type`.
      get isPlot() {
        return true;
      }
      /// Tells you whether this plot type is allowed {@link
      /// Plot.Spec.canBeEmpty to be empty}.
      get canBeEmpty() {
        return (this.flags & 64 /* CanBeEmpty */) > 0;
      }
    }
    Plot12.Type = Type;
    let validate2 = true;
    class Doc2 extends Plot12 {
      constructor(schema, children) {
        super(schema.docTag, children);
        __publicField(this, "schema", schema);
        if (validate2) schema.validate(this);
      }
      /// @internal
      static new(schema, children) {
        return new Doc2(schema, children);
      }
      /// The length of the document's content.
      get length() {
        return this.contentLength;
      }
      /// @internal
      slicePlot(content, from, to) {
        sliceContent(content, this.content, from, to);
      }
      /// Resolve the given position in the document, returning an
      /// object describing its context.
      resolve(pos) {
        return Pos.resolve(this, pos);
      }
      /// Resolve the node at the given position, providing information
      /// about its context.
      resolveNode(pos) {
        return Pos.resolveNode(this, pos);
      }
      /// Like {@link Plot.Doc.resolveNode}, but only resolves plot
      /// nodes.
      resolvePlot(pos) {
        let r = this.resolveNode(pos);
        return r instanceof Pos.Plot ? r : null;
      }
      /// Get the context stack (the array of wrapping plot tags,
      /// inner-to-outer) at the given position.
      contextAt(pos, maxDepth) {
        for (let { parent } = this.resolve(pos), context = []; ; ) {
          if (!parent.parent || maxDepth != null && context.length == maxDepth) return context;
          context.push(parent.node.tag);
          parent = parent.parent;
        }
      }
      /// Create a token slice of the content between `from` and `to`.
      slice(from, to) {
        return this.sliceInner(from, to === void 0 ? this.length : to);
      }
      /// @internal
      static noValidate(f) {
        let prev = validate2;
        validate2 = false;
        try {
          return f();
        } finally {
          validate2 = prev;
        }
      }
    }
    Plot12.Doc = Doc2;
  })(Plot || (Plot = {}));
  function flagsFor(spec) {
    let flags = spec.inline ? 1 /* Inline */ : 0 /* None */;
    if (spec.inlineContent && spec.blockContent) throw new SchemaError("A tag cannot have both block and inline content");
    if (spec.inlineContent) flags |= 2 /* InlineContent */;
    if (spec.inlineContent || spec.canBeEmpty) flags |= 64 /* CanBeEmpty */;
    if (spec.selectable) flags |= 32 /* Selectable */;
    return flags;
  }
  function markString(marks) {
    let values = [];
    for (let mark of marks) {
      if (mark.type.default == mark) values.push(mark.type.name);
      else values.push(`${mark.type.name}=${mark.value}`);
    }
    return values.length ? `[${values.join()}]` : "";
  }
  function sliceContent(out, content, from, to) {
    let off = 0;
    for (let child of content) {
      if (off >= to) break;
      let start = off;
      off += child.length;
      if (off <= from) continue;
      if (child.isPlot) {
        child.slicePlot(out, from - start, to - start);
      } else if (child.isText) {
        out.push(child.sliceText(from - start, to - start));
      } else {
        out.push(child);
      }
    }
  }
  function joinText(nodes) {
    if (!nodes.length || nodes[0].isBlock) return nodes;
    let joined;
    for (let i = 0, last = null; i < nodes.length; i++) {
      let node = nodes[i];
      if (node.is(Leaf.Text)) {
        if (last && Mark.sameSet(last.marks, node.marks)) {
          if (!joined) joined = nodes.slice(0, i);
          last = joined[joined.length - 1] = Leaf.text(last.param + node.param, node.marks);
          continue;
        } else {
          last = node;
        }
      } else {
        last = null;
      }
      if (joined) joined.push(node);
    }
    return joined || nodes;
  }

  // vendor/wordgard/src/doc/schema.ts
  var Schema = class _Schema {
    constructor(elements, nodes, marks, plotContent, markTarget, nodeGroup, docTag, lineBreak) {
      __publicField(this, "elements", elements);
      __publicField(this, "nodes", nodes);
      __publicField(this, "marks", marks);
      __publicField(this, "plotContent", plotContent);
      __publicField(this, "markTarget", markTarget);
      __publicField(this, "nodeGroup", nodeGroup);
      __publicField(this, "docTag", docTag);
      __publicField(this, "lineBreak", lineBreak);
      __publicField(this, "nodesByName", /* @__PURE__ */ Object.create(null));
      __publicField(this, "marksByName", /* @__PURE__ */ Object.create(null));
      __publicField(this, "wrappingCache", /* @__PURE__ */ Object.create(null));
      __publicField(this, "validated", /* @__PURE__ */ new WeakSet());
      for (let tag of nodes) this.nodesByName[tag.name] = tag;
      for (let mark of marks) this.marksByName[mark.name] = mark;
    }
    /// Create a document in this schema.
    doc(children) {
      return Plot.Doc.new(this, children);
    }
    /// Validate that a node and its content conform to this schema.
    /// Will run automatically when creating a document.
    validate(node) {
      if (this.validated.has(node)) return;
      if (node.isLeaf) {
        this.validateTag(node);
      } else {
        this.validateTag(node.tag);
        if (!node.type.canBeEmpty && node.content.length == 0)
          throw new ValidationError(`Node ${node.name} with block content may not be empty`);
        for (let ch of node.content) {
          if (!this.canContain(node.type, ch.type) || node.inlineContent != ch.isInline)
            throw new ValidationError(`Node type ${node.name} cannot contain child ${ch.name}`);
          this.validate(ch);
        }
      }
      this.validated.add(node);
    }
    /// @internal
    validateTag(tag) {
      if (this.nodesByName[tag.name] != tag.type)
        throw new ValidationError(`Tag type ${tag.name} not in schema`);
      for (let mark of tag.marks) this.validateMark(mark, tag.type);
    }
    /// @internal
    validateMark(mark, node) {
      if (this.marksByName[mark.name] != mark.type)
        throw new ValidationError(`Mark type ${mark.name} not in schema`);
      if (!this.markAllowed(mark.type, node))
        throw new ValidationError(`Mark type ${mark.name} cannot target node ${node.name}`);
    }
    /// Test whether the given mark or tag type is included in this
    /// schema.
    has(elt) {
      if (elt instanceof Mark || elt instanceof BaseTag) elt = elt.type;
      return (elt instanceof Mark.Type ? this.marksByName : this.nodesByName)[elt.name] == elt;
    }
    /// Test whether a node type matches the given {@link Node.Query
    /// node query}.
    matchNode(node, q) {
      if (q instanceof Node.Group) {
        let groups = this.nodeGroup.get(node);
        return groups ? groups.has(q) : false;
      }
      if (q instanceof BaseType) return q == node;
      if (q instanceof BaseTag) return q.type == node;
      if ("and" in q) return q.and.every((q2) => this.matchNode(node, q2));
      return q.some((q2) => this.matchNode(node, q2));
    }
    /// Test whether the given mark is allowed on the given node type.
    markAllowed(mark, node) {
      let target = this.markTarget.get(mark);
      return target ? this.matchNode(node, target) : false;
    }
    /// Returns true if there's at least one node type in the schema
    /// that may occur in both `a` and `b`.
    sharesContent(a, b) {
      for (let tp of this.nodes) if (this.canContain(a, tp) && this.canContain(b, tp)) return true;
      return false;
    }
    /// Returns a copy of `to` with all the marks from `from` that it
    /// doesn't already have, and that aren't dropped by the mark's
    /// {@link Mark.Spec.keepOnTypeChange} configuration.
    withMarksFrom(from, to) {
      if (!from.marks.length) return to;
      let marks = to.marks;
      for (let mark of from.marks) if (this.markAllowed(mark.type, to.type) && (mark.type.set || !mark.isInSet(marks))) {
        let { keepOnTypeChange } = mark.type.spec;
        if (keepOnTypeChange && (keepOnTypeChange === true || keepOnTypeChange(from, to)))
          marks = mark.addToSet(marks);
      }
      return to.withMarks(marks);
    }
    /// Check whether a given plot type can contain a given node type.
    canContain(parent, child) {
      if (child.isPlot && child.isDoc) return false;
      let content = this.plotContent.get(parent);
      return content ? this.matchNode(child, content) : false;
    }
    /// Return the first {@link Leaf.Type.default defaultable} node tag that
    /// can occur as a child of `parent`.
    defaultContentTag(parent) {
      for (let tag of this.nodes) if (tag.default && this.canContain(parent, tag)) return tag.default;
      return null;
    }
    /// Return the first {@link Plot.Type.default defaultable} plot tag
    /// that can be a child of `parent`.
    defaultContentPlot(parent) {
      for (let tag of this.nodes) if (tag.default && tag.isPlot && this.canContain(parent, tag)) return tag.default;
      return null;
    }
    /// @internal
    createDefault(parent) {
      let child = this.defaultContentTag(parent);
      if (!child) throw new Error(`No defaultable child node for ${parent.name}`);
      return this.createAndFill(child);
    }
    /// Create a node from a tag, optionally adding a default child if
    /// this is a plot that cannot be empty.
    createAndFill(parent) {
      if (parent.isLeaf) return parent;
      return parent.create(parent.type.canBeEmpty ? [] : [this.createDefault(parent.type)]);
    }
    /// Find a set of tags that `child` must be wrapped in to be able to
    /// occur in `parent`. Will return the empty array if it fits
    /// directly, and `null` if it cannot occur at all.
    findWrapping(parent, child) {
      let key = `${parent.name}-${child.name}`, cached = this.wrappingCache[key];
      if (cached !== void 0) return cached;
      return this.wrappingCache[key] = this.findWrappingInner(parent, child);
    }
    findWrappingInner(parent, child) {
      let seen = /* @__PURE__ */ new Set(), work = [[]];
      for (let i = 0; i < work.length; i++) {
        let path = work[i], at = path.length ? path[path.length - 1].type : parent;
        for (let tag of this.nodes) if (this.canContain(at, tag)) {
          if (tag == child) return path;
          if (!seen.has(tag) && !tag.isLeaf && tag.default) {
            seen.add(tag);
            work.push(path.concat(tag.default));
          }
        }
      }
      return null;
    }
    /// Get the mark type with the given name in this schema.
    getMark(name) {
      return this.marksByName[name];
    }
    /// Get the node type with the given name.
    getNode(name) {
      return this.nodesByName[name];
    }
    /// Define a schema from a set of schema elements. The set must
    /// contain precisely one document type, and no conflicting node or
    /// mark names.
    static define(spec) {
      let cached = findCachedSchema(spec);
      if (cached) return cached;
      let tags = [Leaf.Text], marks = [];
      let defaultI = 0;
      let tagNames = /* @__PURE__ */ new Set(), markNames = /* @__PURE__ */ new Set();
      let plotContent = /* @__PURE__ */ new Map();
      let markTarget = /* @__PURE__ */ new Map();
      let nodeGroup = /* @__PURE__ */ new Map();
      nodeGroup.set(Leaf.Text, /* @__PURE__ */ new Set([Node.Group.Inline, Node.Group.Leaf, Node.Group.All]));
      let overrides = spec.filter((e) => e instanceof _Schema.Override).reverse();
      let elements = [];
      for (let e of spec) {
        let elt = normalizeElt(e);
        elements.push(elt);
        if (elt instanceof Plot.Type || elt instanceof Leaf.Type) {
          if (tags.includes(elt)) continue;
          if (tagNames.has(elt.name)) throw new SchemaError(`Duplicate use of tag name ${elt.name} in schema`);
          tagNames.add(elt.name);
          if (elt.isPlot) {
            let content = elt.spec.inlineContent === true ? Node.Group.Inline : elt.spec.inlineContent || elt.spec.blockContent;
            for (let o of overrides) if (o.type == elt && o.content) content = o.content(content);
            plotContent.set(elt, content);
          }
          if (elt.isPlot && elt.spec.defaultBlock) tags.splice(defaultI++, 0, elt);
          else tags.push(elt);
          let groups = /* @__PURE__ */ new Set();
          groups.add(Node.Group.All);
          groups.add(elt.isInline ? Node.Group.Inline : Node.Group.Block);
          groups.add(elt.isLeaf ? Node.Group.Leaf : Node.Group.Plot);
          if (elt.isPlot && elt.isBlock && elt.inlineContent) groups.add(Node.Group.Textblock);
          let given = elt.spec.group instanceof Node.Group ? [elt.spec.group] : elt.spec.group;
          for (let o of overrides) if (o.type == elt && o.group) given = o.group;
          if (given) for (let g of given) for (let cur = g; cur; cur = cur.parent) {
            if (!Node.Group.builtin.includes(cur)) groups.add(cur);
          }
          nodeGroup.set(elt, groups);
        } else if (elt instanceof Mark.Type) {
          if (marks.includes(elt)) continue;
          if (markNames.has(elt.name)) throw new SchemaError(`Duplicate use of mark name ${elt.name} in schema`);
          let target = elt.spec.target || { and: [Node.Group.Inline, Node.Group.Leaf] };
          for (let o of overrides) if (o.type == elt && o.target) target = o.target(target);
          markTarget.set(elt, target);
          markNames.add(elt.name);
          marks.push(elt);
        } else if (!(elt instanceof _Schema.Override)) {
          throw new SchemaError("Unexpected schema element type. You may have multiple versions of @wordgard/doc loaded");
        }
      }
      let docType = null;
      let lineBreak = null;
      for (let tag of tags) {
        if (tag.isLeaf) {
          if (tag.hasRole(Node.Role.LineBreak)) {
            if (tag.isBlock || !tag.default)
              throw new SchemaError("Line break tags must be inline leaves with a default param");
            if (lineBreak) throw new SchemaError("Multiple line break tags provided");
            lineBreak = tag.default;
          }
        } else {
          if (tag.isDoc) {
            if (docType) throw new SchemaError("Multiple document types specified");
            docType = tag;
          }
        }
      }
      if (!docType) throw new SchemaError("A schema must define a document type");
      let schema = new _Schema(
        elements,
        tags,
        marks,
        plotContent,
        markTarget,
        nodeGroup,
        docType.default,
        lineBreak
      );
      for (let tag of tags) if (tag.isPlot) {
        let sawDefaultable = false;
        for (let child of tags) if (schema.canContain(tag, child)) {
          if (child.default) sawDefaultable = true;
          if (child.isInline != tag.inlineContent)
            throw new SchemaError(`Node type ${tag.name} has ${tag.inlineContent ? "block" : "inline"} content, but allows ${child.name} as a child`);
        }
        if (!tag.canBeEmpty && !sawDefaultable)
          throw new SchemaError(`Node ${tag.name} has required content, but all possible children require non-default parameters`);
      }
      schemaCache.set(spec, new WeakRef(schema));
      return schema;
    }
    /// Deserialize a node from its JSON representation.
    nodeFromJSON(json) {
      let tag = this.tagFromJSON(json), children = none;
      if (tag.isLeaf) return tag;
      if (json.content && Array.isArray(json.content))
        children = json.content.map((c) => this.nodeFromJSON(c));
      if (tag.type.isDoc) return this.doc(children);
      return tag.create(children);
    }
    /// Deserialize a tag from its JSON representation.
    tagFromJSON(json) {
      if (!json || typeof json != "object" || !(json.type in this.nodesByName))
        throw new ValidationError("Invalid tag JSON");
      let type = this.nodesByName[json.type];
      let marks = json.marks ? this.marksFromJSON(json.marks) : none;
      let tag = "param" in json ? type.of(validate(type.spec.validate, json.param), marks) : !type.default ? null : marks.length ? type.of(type.default.param, marks) : type.default;
      if (!tag) throw new ValidationError(`Missing param for tag type ${type.name}`);
      return tag;
    }
    /// Read a set of marks from their JSON representation.
    marksFromJSON(json) {
      if (!json || typeof json != "object") throw new ValidationError("Invalid mark JSON");
      let marks = none;
      for (let name in json) {
        let mark = this.marksByName[name];
        if (!mark) throw new ValidationError(`Unrecognized mark ${name} in JSON`);
        marks = mark.of(validate(mark.spec.validate, json[name])).addToSet(marks);
      }
      return marks;
    }
    /// Read a document from JSON.
    docFromJSON(json) {
      if (!json || json.type != this.docTag.name)
        throw new ValidationError("Invalid document JSON");
      return this.nodeFromJSON(json);
    }
  };
  var schemaCache = /* @__PURE__ */ new Map();
  function findCachedSchema(spec) {
    search: for (let [elts, ref] of schemaCache) {
      let active = ref.deref();
      if (!active) {
        schemaCache.delete(elts);
      } else if (elts.length == spec.length) {
        for (let i = 0; i < spec.length; i++) {
          let a = normalizeElt(spec[i]), b = normalizeElt(elts[i]);
          if (a != b && !(a instanceof Schema.Override && b instanceof Schema.Override && a.eq(b))) continue search;
        }
        return active;
      }
    }
  }
  function normalizeElt(elt) {
    return elt instanceof Plot.Tag || elt instanceof Leaf || elt instanceof Mark ? elt.type : elt;
  }
  ((Schema6) => {
    class Override {
      constructor(type, target, content, group) {
        __publicField(this, "type", type);
        __publicField(this, "target", target);
        __publicField(this, "content", content);
        __publicField(this, "group", group);
      }
      /// @internal
      eq(other) {
        return this == other || this.type == other.type && this.target == other.target && this.content == other.content && this.group == other.group;
      }
      /// Create a schema override that changes the target nodes for a
      /// mark.
      static markTarget(mark, target) {
        return new Schema6.Override(mark instanceof Mark.Type ? mark : mark.type, typeof target == "function" ? target : () => target);
      }
      /// Create a schema override that changes the content specification
      /// for a given node. Note that this can not change a node with
      /// inline content to block content or vice versa.
      static plotContent(plot, content) {
        return new Schema6.Override(
          plot instanceof Plot.Tag ? plot.type : plot,
          void 0,
          typeof content == "function" ? content : () => content
        );
      }
      /// Override the set of groups that a node may be part of.
      static nodeGroup(node, group) {
        return new Schema6.Override(
          node instanceof BaseTag ? node.type : node,
          void 0,
          void 0,
          group instanceof Node.Group ? [group] : group
        );
      }
    }
    Schema6.Override = Override;
  })(Schema || (Schema = {}));

  // vendor/wordgard/src/doc/change.ts
  var BuildContext = class {
    constructor(tag, parent) {
      __publicField(this, "tag", tag);
      __publicField(this, "parent", parent);
      __publicField(this, "children", []);
    }
  };
  var noTokens = Slice.empty.content;
  var Builder = class {
    constructor(doc2) {
      __publicField(this, "stack");
      __publicField(this, "modifications", null);
      __publicField(this, "schema");
      this.schema = doc2.schema;
      this.stack = new BuildContext(doc2.tag, null);
    }
    add(node) {
      if (this.modifications) {
        if (node.isPlot) throw new ValidationError("Invalid modification on non-leaf node");
        node = node.withMarks(applyModifications(this.modifications, node.marks, node.type));
      }
      node.pushTo(this.stack.children);
    }
    enterPlot(plot) {
      this.open(plot.tag);
    }
    leavePlot() {
      if (this.modifications) throw new ValidationError("Invalid modification on close token");
      if (!this.stack.parent) throw new ValidationError("Surplus close token after " + this.stack.children);
      let top2 = this.stack;
      this.stack = this.stack.parent;
      this.add(top2.tag.create(top2.children));
    }
    skip(node) {
      this.add(node);
    }
    open(tag) {
      if (this.modifications) tag = tag.withMarks(applyModifications(this.modifications, tag.marks, tag.type));
      this.stack = new BuildContext(tag, this.stack);
    }
    close() {
      this.leavePlot();
    }
    node(node) {
      this.skip(node);
    }
    finish() {
      if (this.stack.parent) throw new ValidationError("Invalid change");
      return this.schema.doc(this.stack.children);
    }
  };
  function isAdd(m) {
    return !!m.add;
  }
  function isRemove(m) {
    return !!m.remove;
  }
  function applyModifications(modifications, marks, type) {
    for (const m of modifications) {
      if (isAdd(m)) {
        marks = m.add.addToSet(marks);
      } else {
        marks = m.remove.removeFromSet(marks);
      }
    }
    return marks;
  }
  function modificationToJSON(m) {
    return isAdd(m) ? { add: m.add.name, value: m.add.value } : { remove: m.remove.name, value: m.remove.value };
  }
  function modificationFromJSON(schema, json) {
    let { add, remove: remove2 } = json;
    if (typeof add == "string" || typeof remove2 == "string") {
      let mark = schema.getMark(add || remove2);
      if (!mark) throw new ValidationError(`Unknown mark ${add || remove2}`);
      let value = mark.of(validate(mark.spec.validate, json.value));
      if (mark) return add ? { add: value } : { remove: value };
    }
    throw new ValidationError("Invalid modification JSON");
  }
  function compareModifications(a, b) {
    if (a == b) return true;
    if (a.length != b.length) return false;
    for (let i = 0; i < a.length; i++) if (!compareModification(a[i], b[i])) return false;
    return true;
  }
  function compareModification(a, b) {
    return isAdd(a) ? isAdd(b) && a.add.eq(b.add) : isRemove(b) && a.remove.eq(b.remove);
  }
  function isNatNum(value) {
    return typeof value == "number" && Math.floor(value) == value && value >= 0;
  }
  var applyCache = /* @__PURE__ */ new WeakMap();
  var ChangeSet = class _ChangeSet {
    constructor(sections, data) {
      __publicField(this, "sections", sections);
      __publicField(this, "data", data);
      __publicField(this, "_length", -1);
      __publicField(this, "_newLength", -1);
    }
    /// @internal
    static new(sections, data) {
      return new _ChangeSet(sections, data);
    }
    /// The length of the start document.
    get length() {
      if (this._length < 0) {
        this._length = 0;
        for (let i = 0; i < this.sections.length; i += 2) this._length += this.sections[i];
      }
      return this._length;
    }
    /// The length of the updated document.
    get newLength() {
      if (this._newLength < 0) {
        this._newLength = 0;
        for (let i = 0; i < this.sections.length; i += 2) {
          let ins = this.sections[i + 1];
          this._newLength += ins < 0 ? this.sections[i] : ins;
        }
      }
      return this._newLength;
    }
    /// Returns true if this set makes no changes.
    get empty() {
      return this.sections.length == 0 || this.sections.length == 2 && this.sections[1] < 0;
    }
    /// Compare this change set to another one.
    eq(other) {
      if (other.sections.length != this.sections.length) return false;
      for (let i = 0; i < this.sections.length; i++)
        if (this.sections[i] != other.sections[i]) return false;
      for (let i = 0; i < this.data.length; i++) {
        let a = this.data[i], b = other.data[i];
        if (a && !(this.sections[(i << 1) + 1] < 0 ? compareModifications(a, b) : Slice.eq(a, b))) return false;
      }
      return true;
    }
    /// Apply the changes to the given document, producing a new
    /// document. Will raise an error if the document length doesn't
    /// match or the change is not well-formed for this document.
    ///
    /// The result of this method is cached, so applying the same change
    /// set to the same document multiple times is cheap.
    apply(doc2) {
      if (this.length != doc2.length)
        throw new ValidationError(`Trying to apply change of length ${this.length} to doc of length ${doc2.length}`);
      if (this.empty) return doc2;
      let cached = applyCache.get(this);
      if (cached && doc2.eq(cached.a)) return cached.b;
      let builder = new Builder(doc2);
      let cursor = doc2.resolve(0);
      for (let i = 0, iS = 0; i < this.data.length; i++) {
        let lenA = this.sections[iS++], lenB = this.sections[iS++];
        if (lenB < 0) {
          builder.modifications = this.data[i];
          cursor = cursor.advance(lenA, builder);
          builder.modifications = null;
        } else {
          cursor = cursor.advance(lenA);
          Slice.run(this.data[i], builder);
        }
      }
      if (cursor.pos != doc2.length)
        throw new ValidationError("Change doesn't cover the entire document");
      let newDoc = builder.finish();
      applyCache.set(this, { a: doc2, b: newDoc });
      return newDoc;
    }
    /// Convert this change set to a JSON-serializeable representation.
    toJSON() {
      let result = [];
      for (let i = 0; i < this.data.length; i++) {
        let len = this.sections[i << 1], ins = this.sections[(i << 1) + 1];
        if (ins == -1)
          result.push(len);
        else if (ins == -2)
          result.push([len, this.data[i].map(modificationToJSON)]);
        else
          result.push([len, this.data[i].map((t) => t.toJSON())]);
      }
      return result;
    }
    /// Parse a JSON representation into a change set.
    static fromJSON(schema, json) {
      if (!Array.isArray(json)) throw new ValidationError("Invalid ChangeSet JSON");
      let sections = [], data = [];
      for (let elt of json) {
        if (isNatNum(elt)) {
          sections.push(elt, -1);
          data.push(null);
        } else {
          if (!Array.isArray(elt) || elt.length != 2 || !isNatNum(elt[0]) || !Array.isArray(elt[1]))
            throw new ValidationError("Invalid ChangeSet JSON");
          let [len, val] = elt;
          if (val.length && typeof val[0] == "object" && ("add" in val[0] || "remove" in val[0])) {
            sections.push(len, -2);
            data.push(val.map((m) => modificationFromJSON(schema, m)));
          } else {
            if (!Array.isArray(val)) throw new ValidationError("Invalid ChangeSet JSON");
            let tokens = val.map((v) => Token.fromJSON(schema, v));
            sections.push(len, sliceLen(tokens));
            data.push(tokens);
          }
        }
      }
      return new _ChangeSet(sections, data);
    }
    /// Perform an [operational
    /// transformation](https://en.wikipedia.org/wiki/Operational_transformation)
    /// on this change and the given other change. Both changes should
    /// start with the given document `doc`. Returns a modified version
    /// of the change that can be applied _after_ the other change has
    /// been applied to `doc`.
    ///
    /// By default, the semantics of conflicting changes are resolved as
    /// if `this` came after `other`. That means content inserted in the
    /// same position by both will put the content inserted by `this`
    /// last. You can set `before` to true to invert this, making `this`
    /// come before `other`. Setting this correctly is necessary to make
    /// the result of independently applied transformed changes converge.
    transform(doc2, other, before = false) {
      let { set, fix } = transform(this, other, doc2, before, true);
      return fix ? set.compose(fix) : set;
    }
    /// Compose two change sets, where `other` starts from the document
    /// produced by `this`, into a single change set.
    compose(other) {
      let { sections, data } = compose(this.sections, other.sections, this.data, other.data);
      return new _ChangeSet(sections, data);
    }
    /// Compute the inverse of this change set. `doc` is the document
    /// that the change starts from. For a given change `A`,
    /// `doc.apply(A).apply(A.invert(doc))` equals `doc`.
    invert(doc2) {
      let sections = [], data = [];
      for (let i = 0, iS = 0, pos = 0; iS < this.sections.length; iS += 2, i++) {
        let len = this.sections[iS], ins = this.sections[iS + 1];
        if (ins >= 0) {
          addSection(sections, data, ins, len, doc2.slice(pos, pos + len));
        } else {
          let mods = this.data[i];
          let at = pos, end = pos + len;
          if (mods) doc2.iterate(pos, end, (node, nodePos) => {
            if (node.isLeaf || nodePos >= pos && nodePos < end) {
              let [from, to] = node.isText ? [Math.max(at, nodePos), Math.min(end, nodePos + node.length)] : [nodePos, nodePos + 1];
              if (at < from) addSection(sections, data, from - at, -1, null);
              addSection(sections, data, to - from, -2, invertMods(mods, node.tag));
              at = to;
            }
          });
          if (at < end) addSection(sections, data, end - at, -1, null);
        }
        pos += len;
      }
      return new _ChangeSet(sections, data);
    }
    /// Returns the change itself if it can be applied to this document
    /// and produce a valid new document, or a modified version of the
    /// change that _is_ correct.
    correct(doc2, local = false) {
      let fitter = new ChangeFitter(doc2, local);
      for (let i = 0, iS = 0, pos = 0; i < this.data.length; i++) {
        let len = this.sections[iS++], ins = this.sections[iS++];
        if (ins < 0) fitter.preserved(pos, pos += len);
        else fitter.replaced(this.data[i], pos, pos += len);
      }
      let fit = fitter.finish();
      return fit ? this.compose(fit) : this;
    }
    mapPos(pos, assoc = -1, track) {
      let posA = 0, posB = 0;
      for (let i = 0; i < this.sections.length; ) {
        let len = this.sections[i++], type = this.sections[i++], endA = posA + len;
        if (type < 0) {
          if (endA > pos) return posB + (pos - posA);
          posB += len;
        } else {
          if (track && endA >= pos && (track == "around" && posA < pos && endA > pos || track == "before" && posA < pos || track == "after" && endA > pos)) return null;
          if (endA > pos || endA == pos && assoc < 0 && !len)
            return pos == posA || assoc < 0 ? posB : posB + type;
          posB += type;
        }
        posA = endA;
      }
      if (pos > posA) throw new RangeError(`Position ${pos} is out of range for changeset of length ${posA}`);
      return posB;
    }
    /// Scan through the content inserted by this change until a tag
    /// that matches the predicate is found. If successful, return the
    /// position (in the new document) of the tag. This can be useful
    /// for when creating a new selection after a fitted change.
    findInserted(pred) {
      let found = null;
      this.iterChanges((_f, _t, pos, _to, inserted) => {
        if (found != null) return;
        for (let tok of inserted) {
          if (tok.tokenType == Token.Type.Node) {
            if (pred(tok.tag)) return found = pos;
            pos += tok.length;
          } else {
            if (tok.tokenType == Token.Type.Open && pred(tok)) return found = pos;
            pos++;
          }
        }
      });
      return found;
    }
    /// Returns true if any of the replaced ranges in this change set
    /// overlaps or is adjacent to the given range.
    touchesRange(from, to) {
      for (let i = 0, pos = 0; i < this.sections.length && pos <= to; ) {
        let len = this.sections[i++], ins = this.sections[i++], end = pos + len;
        if (ins >= 0 && pos <= to && end >= from) return pos < from && end > to ? "cover" : true;
        pos = end;
      }
      return false;
    }
    /// Iterate over the ranges in this changeset, calling `replaced`
    /// for ranges that have been replaced, and `preserved` for ranges
    /// that are either preserved as-is (when `modifications` is null)
    /// or only have marks modified.
    iterChanges(replaced, preserved) {
      for (let posA = 0, posB = 0, i = 0, iS = 0; i < this.data.length; ) {
        let len = this.sections[iS++], ins = this.sections[iS++], data = this.data[i++];
        if (ins < 0) {
          if (preserved) preserved(posA, posA + len, posB, posB + len, data);
          posA += len;
          posB += len;
        } else {
          replaced(posA, posA += len, posB, posB += ins, data);
        }
      }
    }
    /// Iterate over the sections of the document this change leaves
    /// unchanged or which have only mark changes. `posA` provides the
    /// position of the range in the original document, `posB` the
    /// position in the changed document.
    iterGaps(gap, change) {
      for (let i = 0, posA = 0, posB = 0; i < this.sections.length; ) {
        let len = this.sections[i++], ins = this.sections[i++];
        if (ins < 0) {
          while (i < this.sections.length && this.sections[i + 1] < 0) {
            len += this.sections[i];
            i += 2;
          }
          gap(posA, posA + len, posB, posB + len, i == this.sections.length);
          posB += len;
        } else {
          while (i < this.sections.length && this.sections[i + 1] >= 0) {
            len += this.sections[i++];
            ins += this.sections[i++];
          }
          if (change) change(posA, posA + len, posB, posB + ins);
          posB += ins;
        }
        posA += len;
      }
    }
    /// Iterate over the ranges changed (either replaced or modified) by
    /// this change desc. Joins adjacent changed ranges together.
    iterChangedRanges(range) {
      for (let i = 0, posA = 0, posB = 0; i < this.sections.length; ) {
        let len = this.sections[i++], ins = this.sections[i++];
        if (ins == -1) {
          posB += len;
        } else {
          if (ins == -2) ins = len;
          while (i < this.sections.length && this.sections[i + 1] != -1) {
            let addLen = this.sections[i++], addIns = this.sections[i++];
            len += addLen;
            ins += addIns == -2 ? addLen : addIns;
          }
          range(posA, posA + len, posB, posB + ins);
          posB += ins;
        }
        posA += len;
      }
    }
    /// Add skipped sections before and after this change set, so that
    /// it can apply to a larger document. Mostly useful when
    /// propagating changes from an editor displaying a smaller part of
    /// a document into the full document.
    pad(before, after) {
      if (this.empty) return _ChangeSet.empty(this.length + before + after);
      let sections = this.sections.slice(), data = this.data.slice();
      if (before) {
        if (sections[1] == -1) {
          sections[0] += before;
        } else {
          sections.splice(0, 0, before, -1);
          data.splice(0, 0, null);
        }
      }
      if (after) {
        if (sections[sections.length - 1] == -1) {
          sections[sections.length - 2] += after;
        } else {
          sections.push(after, -1);
          data.push(null);
        }
      }
      return new _ChangeSet(sections, data);
    }
    /// Clip the set to only a sub-region. This can fail, if there are
    /// replacements across the region's sides, in which case the
    /// method returns null
    clip(from, to) {
      let sections = [], data = [];
      for (let i = 0, pos = 0; i < this.sections.length && pos <= to; ) {
        let value = this.data[i >> 1], len = this.sections[i++], ins = this.sections[i++];
        let end = pos + len;
        if (ins > 0) {
          if (pos >= from && end <= to) addSection(sections, data, end - pos, ins, value);
          else if (end > from && pos < from) return null;
        } else if (pos < to && end > from) {
          addSection(sections, data, Math.min(end, to) - Math.max(pos, from), ins, value);
        }
        pos = end;
      }
      return new _ChangeSet(sections, data);
    }
    /// Create a change set. All positions in the given change
    /// description refer to positions in the starting document.
    static create(doc2, spec) {
      return createChangeSet(doc2, spec);
    }
    /// Returns an empty change set for a document of the given length.
    static empty(length) {
      return length ? new _ChangeSet([length, -1], [null]) : new _ChangeSet([], []);
    }
    /// @internal
    toString() {
      let result = "";
      for (let i = 0, iS = 0, pos = 0; i < this.data.length; i++) {
        let len = this.sections[iS++], ins = this.sections[iS++], data = this.data[i];
        let text = "";
        if (ins >= 0) {
          text += data;
        } else if (data) {
          text += `[${data.map((mod) => {
            return `${isAdd(mod) ? "+" + mod.add : "-" + mod.remove}`;
          })}]`;
        }
        if (text) result += `${result ? "," : ""}${pos}${len ? `-${pos + len}` : ""}${text}`;
        pos += len;
      }
      return result;
    }
    /// @internal
    static composeSections(a, b) {
      return compose(a, b).sections;
    }
    /// Transform two change set starting from the same document over
    /// each other, returning two transformed change sets. The returned
    /// `a` can be applied after the `b` passed in, and the returned `b`
    /// can be applied after the `a` passed in, resulting the same final
    /// document on both sides. `a` is taken to happen before `b` when insertions
    /// at the same position need to be merged.
    ///
    /// This method is slightly more efficient than transforming both steps
    /// separately.
    static transform(doc2, a, b) {
      let { set: mA, fix } = transform(a, b, doc2, true, true);
      let mB = transform(b, a, doc2, false, false).set;
      return fix ? { a: mA.compose(fix), b: mB.compose(fix) } : { a: mA, b: mB };
    }
  };
  var ChangeSetBuilder = class {
    constructor(docLen) {
      __publicField(this, "docLen", docLen);
      __publicField(this, "sections", []);
      __publicField(this, "data", []);
      __publicField(this, "pos", 0);
    }
  };
  function sliceLen(tokens) {
    return tokens.reduce((l, e) => l + (e.tokenType == Token.Type.Node ? e.length : 1), 0);
  }
  function createChangeSet(doc2, spec, mayCorrect = true) {
    let cur = null;
    let accum = null;
    let doCorrect = false;
    let flush = () => {
      if (cur) {
        if (cur.pos < cur.docLen) addSection(cur.sections, cur.data, cur.docLen - cur.pos, -1, null);
        push(ChangeSet.new(cur.sections, cur.data));
        cur = null;
      }
    };
    let push = (set) => {
      accum = accum ? accum.compose(transform(set, accum, doc2, false, false).set) : set;
    };
    let section = (from, to, ins, value) => {
      if (!cur || from < cur.pos) {
        flush();
        cur = new ChangeSetBuilder(doc2.length);
      }
      if (from > cur.pos) addSection(cur.sections, cur.data, from - cur.pos, -1, null);
      addSection(cur.sections, cur.data, to - from, ins, value);
      cur.pos = to;
    };
    let build = (spec2) => {
      if (Array.isArray(spec2)) {
        for (let elt of spec2) build(elt);
      } else if (spec2 instanceof ChangeSet) {
        flush();
        push(spec2);
      } else if ("correct" in spec2) {
        flush();
        let { correct, local } = spec2;
        let inner = createChangeSet(doc2, correct, false);
        push(mayCorrect || local ? inner.correct(doc2, local) : inner);
      } else {
        let { from, to, add, remove: remove2, insert, fit } = spec2;
        let modifies = add || remove2;
        if (modifies) {
          if (insert)
            throw new ValidationError(`A Change object cannot both ${add ? "add" : "remove"} a mark and replace a range`);
          if (to == null) to = from + 1;
          if (add) {
            let mods = [{ add }];
            markableSections(doc2, from, to, add.type.spanning, (node, from2, to2) => {
              if (!doc2.schema.markAllowed(add.type, node.type)) return false;
              let has = add.type.isInSet(node.tag.marks);
              if (add.type.set) {
                let modsHere = mods;
                if (has) {
                  let left = subtractSet(add.value, has.value, add.type.set);
                  if (!left.length) return false;
                  modsHere = [{ add: add.type.of(left) }];
                }
                section(from2, to2, -2, modsHere);
              } else if (!has || !has.eq(add)) {
                section(from2, to2, -2, mods);
              }
              return true;
            });
          }
          if (remove2) {
            let mods = [{ remove: remove2 }];
            markableSections(doc2, from, to, remove2.type.spanning, (node, from2, to2) => {
              const has = remove2.isInSet(node.tag.marks);
              if (!has || !doc2.schema.markAllowed(remove2.type, node.type)) return false;
              let modsHere = mods;
              if (remove2.type.set) {
                let left = subtractSet(remove2.value, has.value, remove2.type.set);
                if (!left.length) return false;
                modsHere = [{ remove: remove2.type.of(left) }];
              }
              section(from2, to2, -2, modsHere);
              return true;
            });
          }
        } else {
          if (to == null) to = from;
          let context = insert instanceof Slice ? insert.context : Slice.empty.context;
          insert = !insert ? noTokens : insert instanceof Slice ? insert.content : insert;
          if (to <= from) to = from;
          if (fit) {
            doCorrect = true;
            ({ from, to, tokens: insert } = fitReplacement(doc2, doc2.resolve(from), doc2.resolve(to), insert, context));
          }
          if (insert.length || to != from)
            section(from, to, sliceLen(insert), insert);
        }
      }
    };
    build(spec);
    flush();
    return !accum ? ChangeSet.empty(doc2.length) : doCorrect && mayCorrect ? accum.correct(doc2) : accum;
  }
  function transform(setA, setB, doc2, before, fit) {
    if (setA.length != doc2.length || setB.length != doc2.length)
      throw new ValidationError("Transforming a change that doesn't match the start document");
    let sections = [], data = [];
    let fitter = fit ? new ChangeFitter(doc2, false) : null;
    let a = new SectionIter(setA.sections, setA.data), b = new SectionIter(setB.sections, setB.data), pos = 0;
    for (let inserted = -1; ; ) {
      if (a.keep && b.keep) {
        let len = Math.min(a.len, b.len);
        let mods = before ? a.mods : filterMods(a.mods, b.mods);
        addSection(sections, data, len, mods ? -2 : -1, mods);
        a.forward(len);
        b.forward(len);
        if (fitter) fitter.preserved(pos, pos + len);
        pos += len;
      } else if (b.ins >= 0 && (a.ins < 0 || inserted == a.i || a.off == 0 && (b.len < a.len || b.len == a.len && !before))) {
        let end = pos + b.len;
        addSection(sections, data, b.ins, -1, null);
        if (fitter) fitter.replaced(b.tokens, pos, end, true);
        while (pos < end) {
          if (a.done) throw new ValidationError("Mismatched change sets");
          let piece = Math.min(a.len, end - pos);
          if (a.ins >= 0 && inserted < a.i && a.len <= piece) {
            addSection(sections, data, 0, a.ins, a.tokens);
            if (fitter) fitter.replaced(a.tokens, pos - a.off, pos + a.len);
            inserted = a.i;
          }
          a.forward(piece);
          pos += piece;
        }
        b.next();
      } else if (a.ins >= 0) {
        let start = pos, end = pos + a.len, len = 0;
        while (pos < end) {
          if (b.keep) {
            let piece = Math.min(end - pos, b.len);
            pos += piece;
            len += piece;
            b.forward(piece);
          } else if (b.ins == 0 && pos + b.len < end) {
            if (fitter) fitter.replaced(b.tokens, pos, pos + b.len, true);
            pos += b.len;
            b.next();
          } else {
            break;
          }
        }
        if (inserted < a.i) {
          addSection(sections, data, len, a.ins, a.tokens);
          if (fitter) fitter.replaced(a.tokens, start - a.off, start + a.len);
          inserted = a.i;
        } else {
          addSection(sections, data, len, 0, noTokens);
        }
        a.forward(pos - start);
      } else {
        return {
          set: ChangeSet.new(sections, data),
          fix: fitter && fitter.finish()
        };
      }
    }
  }
  function compose(sectionsA, sectionsB, dataA, dataB) {
    let sections = [], data = dataA ? [] : null;
    let a = new SectionIter(sectionsA, dataA), b = new SectionIter(sectionsB, dataB);
    for (let open = false; ; ) {
      if (a.done && b.done) {
        return { sections, data };
      } else if (a.ins == 0) {
        addSection(sections, data, a.len, 0, a.tokens, open);
        a.next();
      } else if (b.len == 0 && !b.done) {
        addSection(sections, data, 0, b.ins, b.tokens, open);
        b.next();
      } else if (a.done || b.done) {
        throw new ValidationError("Mismatched change set lengths");
      } else {
        let len = Math.min(a.len2, b.len), sectionLen = sections.length;
        if (a.keep && b.keep) {
          let mods = combineMods(a.mods, b.mods);
          addSection(sections, data, len, (data ? mods : a.ins == -2 || b.ins == -2) ? -2 : -1, mods, open);
        } else if (a.keep) {
          addSection(sections, data, len, b.off ? 0 : b.ins, b.off ? noTokens : b.tokens, open);
        } else if (b.keep) {
          addSection(sections, data, a.off ? 0 : a.len, len, data ? applyModsToSlice(a.slicePart(len), b.mods) : null, open);
        } else {
          addSection(sections, data, a.off ? 0 : a.len, b.off ? 0 : b.ins, b.off ? noTokens : b.tokens, open);
        }
        open = (a.ins > len || b.ins >= 0 && b.len > len) && (open || sections.length > sectionLen);
        a.forward2(len);
        b.forward(len);
      }
    }
  }
  function combineMods(a, b) {
    return !a ? b : !b ? a : a.concat(b);
  }
  function filterMods(mods, against) {
    if (!mods || !against) return mods;
    return mods.filter((m) => !against.some((a) => modCancels(a, m)));
  }
  function modCancels(mod, other) {
    if (isAdd(other)) {
      return isAdd(mod) ? mod.add.type == other.add.type && !mod.add.type.set : mod.remove.eq(other.add);
    } else {
      return isAdd(mod) && mod.add.eq(isAdd(other) ? other.add : other.remove);
    }
  }
  function invertMods(mods, target) {
    return mods.map((mod) => {
      if (isRemove(mod)) return { add: mod.remove };
      if (!mod.add.type.set) {
        let existed = mod.add.type.isInSet(target.marks);
        if (existed) return { add: existed };
      }
      return { remove: mod.add };
    });
  }
  function applyModsToSlice(tokens, mods) {
    if (!mods) return tokens;
    let content = [];
    for (let tok of tokens) {
      if (tok.tokenType == Token.Type.Open) {
        content.push(tok.withMarks(applyModifications(mods, tok.marks, tok.type)));
      } else if (tok.tokenType == Token.Type.Node) {
        let node = tok.withMarks(applyModifications(mods, tok.marks, tok.type));
        if (content.length && content[content.length - 1].tokenType == Token.Type.Node)
          node.pushTo(content);
        else
          content.push(node);
      } else {
        content.push(tok);
      }
    }
    return content;
  }
  var FitLevel = class {
    constructor(tag, next) {
      __publicField(this, "tag", tag);
      __publicField(this, "next", next);
      __publicField(this, "flags", 0 /* None */);
      if (!this.tag.type.canBeEmpty) this.flags |= 1 /* NeedsChild */;
    }
  };
  var counter = {
    count: 0,
    skip() {
    },
    enterPlot() {
      this.count++;
    },
    leavePlot() {
      this.count--;
    },
    countDelta(pos, distance) {
      this.count = 0;
      return pos.advance(distance, this);
    }
  };
  var ChangeFitter = class {
    constructor(doc2, local) {
      __publicField(this, "local", local);
      __publicField(this, "stack");
      __publicField(this, "inputPos");
      __publicField(this, "delInputPos");
      __publicField(this, "pos", 0);
      __publicField(this, "patches", []);
      __publicField(this, "stackDelta", 0);
      __publicField(this, "inputDelta", 0);
      __publicField(this, "inserting", false);
      __publicField(this, "activeContext", null);
      __publicField(this, "activeContextPos", -1);
      __publicField(this, "nextSync", -1);
      __publicField(this, "schema");
      __publicField(this, "lastCoverFrom", -1);
      __publicField(this, "lastCoverTo", -1);
      __publicField(this, "doubleDeleteDelta", 0);
      this.schema = doc2.schema;
      this.stack = new FitLevel(doc2.tag, null);
      this.inputPos = this.delInputPos = doc2.resolve(0);
    }
    getPos(at) {
      let { inputPos, delInputPos } = this;
      if (inputPos.pos == at) return inputPos;
      if (delInputPos.pos == at) return delInputPos;
      return inputPos.advance(at - inputPos.pos);
    }
    preserved(from, to) {
      let { nextSync } = this;
      if (nextSync >= from && nextSync <= to) {
        this.stackDelta = 0;
        this.nextSync = -1;
        if (nextSync > from) this.preserved(from, nextSync);
        this.syncToContext(this.inputPos);
        if (to > nextSync) this.preserved(nextSync, to);
        return;
      }
      let inputPos = this.getPos(from);
      if (!this.inputDelta && this.stackDelta) {
        this.syncToContext(inputPos);
        this.stackDelta = 0;
      }
      this.activeContext = inputPos;
      this.activeContextPos = this.pos;
      this.inputPos = inputPos.advance(to - from, this);
    }
    replaced(tokens, from, to, covering = false) {
      this.doubleDeleteDelta = 0;
      if (covering) {
        this.lastCoverFrom = from;
        this.lastCoverTo = to;
      } else if (tokens.length) {
        let overlapFrom = Math.max(from, this.lastCoverFrom);
        let overlapTo = Math.min(to, this.lastCoverTo);
        if (overlapFrom < overlapTo) {
          counter.countDelta(this.getPos(overlapFrom), overlapTo - overlapFrom);
          this.doubleDeleteDelta = counter.count;
        }
      }
      if (from != to) {
        this.delInputPos = counter.countDelta(this.getPos(from), to - from);
        this.inputDelta -= counter.count;
      }
      this.inserting = true;
      Slice.run(tokens, this, this.pos);
      this.inserting = false;
      if (this.local)
        this.nextSync = Math.max(this.nextSync, localSyncPosAfter(this.inputPos = this.getPos(to)));
    }
    fit(tag) {
      if (this.schema.canContain(this.stack.tag.type, tag.type)) return true;
      let fix = null;
      let dDelta = this.stackDelta - this.inputDelta;
      for (let level = this.stack, leave = 0, leaveCost = 0; level; level = level.next, leave++) {
        if (fix && leaveCost > fix.cost) break;
        let enter2 = this.schema.findWrapping(level.tag.type, tag.type);
        if (enter2) {
          let cost = leaveCost + enter2.length * 2 - Math.max(0, Math.min(-dDelta, enter2.length));
          if (!fix || fix.cost > cost && !fix.context)
            fix = { leave, enter: enter2, cost, context: false };
        }
        if (this.activeContextPos == this.pos) {
          let top2 = this.activeContext?.parent || null;
          for (let cx = top2, i = 1; cx; cx = cx.parent, i++) {
            if (this.schema.canContain(level.tag.type, cx.node.type)) {
              let cost = leaveCost + i * 2 - Math.max(0, Math.min(-dDelta, i));
              if (!fix || fix.cost > cost || !fix.context) {
                let enter3 = [];
                for (let scan = top2; ; scan = scan.parent) {
                  enter3.unshift(scan.node.tag);
                  if (scan == cx) break;
                }
                fix = { leave, enter: enter3, cost, context: true };
              }
              break;
            }
          }
        }
        leaveCost += level.flags & 2 /* Synthetic */ ? 0 : dDelta > leave ? 1 : 2;
      }
      if (!fix) return false;
      for (let i = 0; i < fix.leave; i++) {
        this.insertClose();
        this.stackDelta--;
      }
      for (let wrapper of fix.enter) {
        this.patch(0, wrapper);
        this.stack.flags &= ~1 /* NeedsChild */;
        this.stack = new FitLevel(wrapper, this.stack);
        this.stack.flags |= 2 /* Synthetic */;
        this.stackDelta++;
      }
      return true;
    }
    syncToContext(context) {
      let cur = [], sync = [];
      for (let l = this.stack; l; l = l.next) cur.push(l);
      cur.reverse();
      for (let level = context.parent; level; level = level.parent) sync.push(level.node.tag);
      sync.reverse();
      while (cur.length > sync.length) {
        this.insertClose();
        cur.pop();
      }
      for (let d = 1; d < Math.min(sync.length, cur.length); d++) {
        if (!this.schema.sharesContent(sync[d].type, cur[d].tag.type)) {
          while (cur.length > d) {
            this.insertClose();
            cur.pop();
          }
          break;
        }
      }
      for (let i = cur.length; i < sync.length; i++) {
        let tag = sync[i];
        this.stack = new FitLevel(tag, this.stack);
        this.patch(0, tag);
      }
    }
    insertClose() {
      if (this.stack.flags & 1 /* NeedsChild */) this.patch(0, this.schema.createDefault(this.stack.tag.type), Plot.End);
      else this.patch(0, Plot.End);
      this.stack = this.stack.next;
    }
    patch(length, ...insert) {
      let prev = this.patches.length ? this.patches[this.patches.length - 1] : null;
      if (prev && prev.to == this.pos) {
        prev.to += length;
        for (let tok of insert) prev.insert.push(tok);
      } else {
        this.patches.push({ from: this.pos, to: this.pos + length, insert });
      }
    }
    open(tag) {
      this.enter(tag);
    }
    close() {
      this.leavePlot();
    }
    node(node) {
      this.skip(node);
    }
    skip(node) {
      if (this.fit(node.tag))
        this.stack.flags &= ~1 /* NeedsChild */;
      else
        this.patch(node.length);
      this.pos += node.length;
    }
    enterPlot(node) {
      this.enter(node.tag);
    }
    enter(tag) {
      if (this.inserting) this.inputDelta++;
      if (this.doubleDeleteDelta > 0) {
        this.doubleDeleteDelta--;
        this.patch(1);
      } else if (this.fit(tag)) {
        this.stack.flags &= ~1 /* NeedsChild */;
        this.stack = new FitLevel(tag, this.stack);
        if (this.inserting) this.stackDelta++;
      } else {
        this.patch(1);
      }
      this.pos++;
    }
    leavePlot() {
      if (this.inserting) this.inputDelta--;
      if (this.doubleDeleteDelta < 0) {
        this.doubleDeleteDelta++;
        this.patch(1);
      } else if (this.stack.next) {
        if (this.stack.flags & 1 /* NeedsChild */) this.patch(0, this.schema.createDefault(this.stack.tag.type));
        this.stack = this.stack.next;
        if (this.inserting) this.stackDelta++;
      } else {
        this.patch(1);
      }
      this.pos++;
    }
    finish() {
      while (this.stack.next || this.stack.flags && 1 /* NeedsChild */) {
        if (this.stack.flags & 1 /* NeedsChild */) {
          this.patch(0, this.schema.createDefault(this.stack.tag.type));
          this.stack.flags &= ~1 /* NeedsChild */;
        } else {
          this.patch(0, Plot.End);
          this.stack = this.stack.next;
        }
      }
      if (!this.patches.length) return null;
      let sections = [], data = [], pos = 0;
      for (let { from, to, insert } of this.patches) {
        addSection(sections, data, from - pos, -1, null);
        addSection(sections, data, to - from, sliceLen(insert), insert);
        pos = to;
      }
      addSection(sections, data, this.pos - pos, -1, null);
      return ChangeSet.new(sections, data);
    }
  };
  function localSyncPosAfter(pos) {
    let found = pos.pos;
    for (let cx = pos.parent, index = pos.index; ; index = cx.index, cx = cx.parent) {
      if (!cx.parent || !cx.node.inlineContent && index != cx.node.content.length - 1) break;
      found = cx.after;
    }
    return found;
  }
  function markableSections(doc2, from, to, spanning, f) {
    doc2.iterate(from, to, (node, pos) => {
      if (pos >= from && pos + (spanning ? node.length : 1) <= to || node.isText) {
        if (node.isText ? f(node, Math.max(pos, from), Math.min(pos + node.length, to)) : f(node, pos, pos + 1))
          return false;
      }
    });
  }
  var SectionIter = class {
    constructor(sections, data) {
      __publicField(this, "sections", sections);
      __publicField(this, "data", data);
      __publicField(this, "i", 0);
      __publicField(this, "len");
      __publicField(this, "off");
      __publicField(this, "ins");
      this.next();
    }
    next() {
      let { sections } = this;
      this.off = 0;
      if (this.i < sections.length) {
        this.len = sections[this.i++];
        this.ins = sections[this.i++];
        if (this.len == 0 && this.ins < 0) this.next();
      } else {
        this.len = 0;
        this.ins = -3;
      }
    }
    get keep() {
      return this.ins == -1 || this.ins == -2;
    }
    get done() {
      return this.ins == -3;
    }
    get len2() {
      return this.ins < 0 ? this.len : this.ins;
    }
    get mods() {
      return this.data ? this.data[this.i - 2 >> 1] : null;
    }
    get tokens() {
      return this.data ? this.data[this.i - 2 >> 1] : noTokens;
    }
    slicePart(len) {
      return Slice.slice(this.tokens, this.off, len == null ? void 0 : this.off + len);
    }
    forward(len) {
      if (len == this.len) this.next();
      else {
        this.len -= len;
        this.off += len;
      }
    }
    forward2(len) {
      if (this.keep) this.forward(len);
      else if (len == this.ins) this.next();
      else {
        this.ins -= len;
        this.off += len;
      }
    }
  };
  function addSection(sections, data, len, ins, value, forceJoin = false) {
    if (len == 0 && ins <= 0) return;
    let last = sections.length - 2;
    if (last >= 0 && ins <= 0 && ins == sections[last + 1]) {
      let lastValue = data ? data[data.length - 1] : null;
      let match = ins == 0 ? true : value ? lastValue && compareModifications(lastValue, value) : !lastValue;
      if (match) {
        sections[last] += len;
        return;
      }
    }
    if (forceJoin || last >= 0 && len == 0 && sections[last] == 0) {
      sections[last] += len;
      sections[last + 1] += ins;
      if (data) data[data.length - 1] = Slice.concat(data[data.length - 1], value);
    } else {
      sections.push(len, ins);
      if (data) data.push(value);
    }
  }
  function finishCx(cx, schema) {
    return cx.tag.create(cx.children.length || cx.tag.type.canBeEmpty ? cx.children : [schema.createDefault(cx.tag.type)]);
  }
  function closeSlice(schema, tokens, context, depth2, closeEnd = false) {
    let top2 = [], stack = null;
    for (let i = depth2 - 1; i >= 0; i--) stack = new BuildContext(context[i], stack);
    for (let token of tokens) {
      if (token.tokenType == Token.Type.Close) {
        if (stack) {
          let node = finishCx(stack, schema);
          stack = stack.parent;
          (stack ? stack.children : top2).push(node);
        } else {
          top2.push(token);
        }
      } else if (token.tokenType == Token.Type.Open) {
        stack = new BuildContext(token, stack);
      } else {
        ;
        (stack ? stack.children : top2).push(token);
      }
    }
    if (closeEnd) while (stack) {
      let node = finishCx(stack, schema);
      stack = stack.parent;
      (stack ? stack.children : top2).push(node);
    }
    if (stack) splatContext(top2, stack);
    return top2;
  }
  function splatContext(top2, cx) {
    if (cx.parent) splatContext(top2, cx.parent);
    top2.push(cx.tag);
    for (let ch of cx.children) top2.push(ch);
  }
  function isFitBarrier(plot) {
    return plot.isolating || plot.isInline;
  }
  function fitReplacement(doc2, from, to, tokens, context) {
    if (!tokens.length) return fitDeletion(doc2, from, to);
    let preferredContext = -1;
    for (let i = 0; i < context.length; i++) {
      let next = context[i];
      if (next.type.defining) preferredContext = i;
      else if (!next.isTextblock) break;
    }
    let firstType = null, closeCount = 0;
    for (let i = 0, opened = 0; i < tokens.length; i++) {
      let tok = tokens[i];
      if (tok.tokenType == Token.Type.Close) {
        if (opened) opened--;
        else closeCount++;
      } else {
        if (!i) firstType = tok.type;
        if (tok.tokenType == Token.Type.Open) opened++;
      }
    }
    let found, foundCost = 1e8;
    let neutral = true, toEnd = true;
    scan: for (let cxFrom = from.parent, cxTo = to.parent, fromDepth = from.depth, toDepth = to.depth, start = from.pos, end = to.pos; cxFrom.parent; cxFrom = cxFrom.parent, start--, fromDepth--) {
      if (cxFrom.start != start || isFitBarrier(cxFrom.node.type)) break;
      while (toDepth > fromDepth) {
        if (isFitBarrier(cxTo.node.type)) break scan;
        cxTo = cxTo.parent;
        toDepth--;
        end++;
      }
      if (cxTo.end != end) {
        if (!closeCount) break;
        toEnd = false;
      }
      if (!cxFrom.node.type.neutral) neutral = false;
      if (fromDepth == toDepth) for (let i = -1, type; i < context.length; i++) {
        if (i >= 0) type = context[i].type;
        else if (!firstType) continue;
        else type = firstType;
        if (doc2.schema.canContain(cxFrom.parent.node.type, type)) {
          let cost = (neutral ? 0 : 2) + (i < preferredContext ? context.length - i : i - preferredContext) + (toEnd ? 0 : 1e7);
          if (foundCost > cost) {
            found = {
              from: cxFrom.before,
              to: toEnd ? cxTo.after : to.pos,
              tokens: i >= 0 ? closeSlice(doc2.schema, tokens, context, i + 1, toEnd) : tokens
            };
            foundCost = cost;
          }
        }
      }
    }
    if (found) return found;
    if (from.pos == to.pos && !from.inText) {
      let cx = from.parent;
      for (let before = from.index ? -1 : from.pos, after = from.pos == from.parent.end ? from.pos : -1; before > -1 || after > -1; ) {
        for (let i = -1; i < context.length; i++) {
          let type = i >= 0 ? context[i].type : firstType;
          if (!type) continue;
          if (doc2.schema.canContain(cx.node.type, type)) {
            let pos = before > -1 ? before : after;
            return { from: pos, to: pos, tokens: i >= 0 ? closeSlice(doc2.schema, tokens, context, i + 1, true) : tokens };
          }
        }
        if (isFitBarrier(cx.node.type) || !cx.parent) break;
        before = before == cx.start ? before - 1 : -1;
        after = after == cx.end ? after + 1 : -1;
        cx = cx.parent;
      }
    }
    for (let i = -1; i < context.length; i++) {
      if (i == preferredContext) continue;
      let depth2 = i < 0 ? preferredContext : i;
      if (doc2.schema.canContain(from.parent.node.type, context[depth2].type)) {
        tokens = closeSlice(doc2.schema, tokens, context, depth2 + 1, true);
        break;
      }
    }
    return { from: from.pos, to: to.pos, tokens };
  }
  function fitDeletion(doc2, from, to) {
    let toDepth = to.depth;
    let covered;
    for (let cx = from.parent, cxTo = to.parent, depth2 = from.depth, start = from.pos, end = to.pos; cx.parent; start--, cx = cx.parent, depth2--) {
      if (cx.start != start || isFitBarrier(cx.node.type)) break;
      while (toDepth > depth2) {
        cxTo = cxTo.parent;
        toDepth--;
        end++;
      }
      let toAtEnd = toDepth == depth2 && cxTo.end == end;
      if (cx.end < to.pos && cx.parent.end > to.pos && !toAtEnd)
        return { from: cx.before, to: to.pos, tokens: noTokens };
      if (!cx.node.inlineContent && toAtEnd && cx.parent.start == cxTo.parent.start && !(from.parent.start == to.parent.start && from.parent.node.inlineContent))
        covered = { from: cx.before, to: cxTo.after, tokens: noTokens };
    }
    return covered || { from: from.pos, to: to.pos, tokens: noTokens };
  }

  // vendor/wordgard/src/doc/parse.ts
  function parse(schema, doc2, options = {}) {
    let top2 = new NodeContext(schema.docTag, 4 /* Solid */, null);
    let cx = new ParseContext(schema, options, top2);
    cx.parseChildren(doc2, [], false);
    cx.sync(top2);
    return cx.finishNode(cx.top);
  }
  ((parse2) => {
    function slice(schema, doc2, options = {}) {
      let top2 = new NodeContext(guessParent(doc2, schema), 4 /* Solid */ | 1 /* OpenStart */ | 2 /* OpenEnd */, null);
      let cx = new ParseContext(schema, options, top2);
      cx.parseChildren(doc2, [], true);
      cx.sync(top2);
      let tokens = [], context = [];
      let emitTokens = (children, openStart, openEnd) => {
        for (let i = 0; i < children.length; i++) {
          let child = children[i];
          if (openStart && i == 0 && child.isPlot && (cx.open.get(child) || 0) & 1 /* OpenStart */) {
            if (children.length == 1 && openEnd && (cx.open.get(child) || 0) & 2 /* OpenEnd */) {
              emitTokens(child.content, true, true);
            } else {
              emitTokens(child.content, true, false);
              tokens.push(Plot.End);
            }
            context.push(child.tag);
          } else if (openEnd && i == children.length - 1 && child.isPlot && (cx.open.get(child) || 0) & 2 /* OpenEnd */) {
            tokens.push(child.tag);
            emitTokens(child.content, false, true);
          } else {
            tokens.push(child);
          }
        }
      };
      emitTokens(top2.children, true, true);
      return Slice.of(tokens, context);
    }
    parse2.slice = slice;
    let Rule;
    ((Rule2) => {
      const schemaCache2 = /* @__PURE__ */ new WeakMap();
      function addByPrec(array, value) {
        let prec = value.precedence ?? 0, i = array.length;
        while (i > 0 && prec > (array[i - 1].precedence ?? 0)) i--;
        array.splice(i, 0, value);
      }
      class Set4 {
        constructor(rules) {
          __publicField(this, "rules", rules);
          /// @internal
          __publicField(this, "elementRules", []);
          /// @internal
          __publicField(this, "attributeRules", []);
          for (let rule of rules) addByPrec("selector" in rule ? this.elementRules : this.attributeRules, rule);
        }
        /// Create a rule set with the given parse rules.
        static of(rules) {
          return new Set4(rules);
        }
        /// Create a rule set containing all the parse rules attached to
        /// nodes and marks in the given schema, as well as the rules that
        /// can be derived from the node and mark shape declarations.
        static fromSchema(schema) {
          let cached = schemaCache2.get(schema);
          if (cached) return cached;
          let rules = [];
          for (let tag of schema.nodes) {
            let { spec: { shape, parseRules } } = tag;
            if ("element" in shape && shape.element && (shape.readElement || tag.default)) rules.push({
              selector: shape.selector || shape.element,
              readElement: shape.readElement,
              tag
            });
            if (parseRules) for (let rule of parseRules) rules.push({
              ...rule,
              tag: rule.tag || tag
            });
          }
          for (let mark of schema.marks) {
            let { shape, parseRules } = mark.spec;
            if (parseRules) for (let rule of parseRules) rules.push({ ...rule, mark: rule.mark || mark });
            if ("element" in shape && (shape.readElement || mark.default)) {
              rules.push({
                selector: shape.selector || shape.element,
                readElement: shape.readElement,
                mark
              });
            } else if ("attribute" in shape) {
              if (shape.readAttribute) {
                rules.push({
                  attribute: shape.attribute,
                  readAttribute: shape.readAttribute,
                  mark
                });
              } else if (typeof shape.value == "string") {
                rules.push({
                  attribute: shape.attribute,
                  value: shape.value,
                  mark
                });
              } else if (shape.value === 0) {
                rules.push({
                  attribute: shape.attribute,
                  readAttribute: (param) => param,
                  mark
                });
              }
            }
          }
          let result = new Rule2.Set(rules);
          schemaCache2.set(schema, result);
          return result;
        }
        /// @internal
        matchElement(elt) {
          for (let rule of this.elementRules) {
            if (elt.matches(rule.selector)) {
              if (!rule.readElement) return Object.prototype.hasOwnProperty.call(rule, "param") ? { rule, value: rule.param } : { rule };
              let result = rule.readElement(elt);
              if (result === parse2.Reject) continue;
              return { rule, value: result };
            }
          }
          return null;
        }
      }
      Rule2.Set = Set4;
    })(Rule = parse2.Rule || (parse2.Rule = {}));
    parse2.Reject = /* @__PURE__ */ Symbol("reject");
  })(parse || (parse = {}));
  var ParseContext = class {
    constructor(schema, options, top2) {
      __publicField(this, "schema", schema);
      __publicField(this, "options", options);
      __publicField(this, "top", top2);
      __publicField(this, "rules");
      __publicField(this, "open", /* @__PURE__ */ new Map());
      this.rules = options.ruleSet || parse.Rule.Set.fromSchema(schema);
    }
    parseChildren(parent, marks, endOfSlice, ignore) {
      for (let ch = parent.firstChild; ch; ch = ch.nextSibling) {
        if (ch.nodeType == 1)
          this.parseElement(ch, marks, endOfSlice && !ch.nextSibling);
        else if (ch.nodeType == 3 && !(ignore && (typeof ignore == "string" ? ch.matches(ignore) : ignore(ch))))
          this.parseTextNode(ch, marks);
      }
    }
    ignoreElement(elt, marks) {
      if (elt.nodeName == "BR" && !this.top.tag.inlineContent)
        this.findPlace(Leaf.Text.of("-"), marks, false);
    }
    parseElement(elt, marks, endOfSlice) {
      let name = elt.nodeName.toLowerCase();
      if (name in normalizers) normalizers[name](elt);
      let match = this.rules.matchElement(elt);
      if (match ? match.rule.ignore === true : ignoreTags.has(name)) {
        this.ignoreElement(elt, marks);
      } else if (!match || match.rule.ignore === "skip") {
        let sync, top2 = this.top;
        if (blockTags.has(name)) {
          if (top2.children.length && top2.children[0].isInline && top2.parent) this.close();
          sync = true;
        }
        let innerMarks = match && match.rule.ignore ? marks : this.parseAttributes(elt, marks);
        if (innerMarks) this.parseChildren(elt, innerMarks, endOfSlice);
        if (sync) this.sync(top2);
      } else {
        let innerMarks = this.parseAttributes(elt, marks);
        if (innerMarks && match.rule.marksFrom) {
          let inner = elt.querySelector(match.rule.marksFrom);
          if (inner) innerMarks = this.parseAttributes(inner, innerMarks);
        }
        if (innerMarks)
          this.parseElementByRule(elt, match, innerMarks, endOfSlice);
      }
    }
    parseElementByRule(elt, match, marks, endOfSlice) {
      let sync, isLeaf = false, { rule } = match, hasValue = Object.prototype.hasOwnProperty.call(match, "value");
      if (rule.tag) {
        let tag = rule.tag instanceof BaseTag ? rule.tag : hasValue ? rule.tag.of(match.value) : rule.tag.default;
        if (!tag) throw new SchemaError(`Parse rule for ${rule.selector} is missing a parameter`);
        if (tag.isPlot) {
          let innerMarks = this.enter(tag, marks, endOfSlice, elt);
          if (innerMarks) {
            sync = true;
            marks = innerMarks;
          }
        } else {
          this.insertNode(tag, marks);
          isLeaf = true;
        }
      } else {
        let mark = rule.mark instanceof Mark ? rule.mark : rule.mark instanceof Mark.Type ? hasValue ? rule.mark.of(match.value) : rule.mark.default : null;
        if (!mark) throw new Error(`Parse rule for ${rule.selector} does not produce a mark`);
        marks = marks.concat(mark);
      }
      let startIn = this.top;
      if (!isLeaf) {
        let content = elt;
        if (typeof rule.contentElement == "string") content = elt.querySelector(rule.contentElement) || elt;
        else if (typeof rule.contentElement == "function") content = rule.contentElement(elt);
        this.parseChildren(content, marks, endOfSlice, rule.ignoreContent);
      }
      if (sync && this.sync(startIn)) this.close();
    }
    parseTextNode(dom, marks) {
      let text = dom.nodeValue;
      if (!this.top.tag.type.preserveWhitespace && this.options.collapseWhiteSpace !== false) {
        if (!this.top.tag.inlineContent && !/[^ \t\r\n\u000c]/.test(text)) return;
        text = text.replace(/[ \t\r\n\u000c]+/g, " ");
        if (/^ /.test(text)) {
          let nodeBefore = this.top.children[this.top.children.length - 1];
          if (nodeBefore ? nodeBefore == this.schema.lineBreak || nodeBefore.is(Leaf.Text) && / $/.test(nodeBefore.param) : !(this.top.flags & 1 /* OpenStart */))
            text = text.slice(1);
        }
        if (text) this.insertNode(Leaf.text(text), marks);
      } else if (this.top.tag.type.preserveWhitespace && this.schema.lineBreak) {
        let lines = text.split(/\r?\n|\r/g);
        for (let i = 0; i < lines.length; i++) {
          if (i) this.insertNode(this.schema.lineBreak, marks);
          if (lines[i]) this.insertNode(Leaf.text(lines[i]), marks);
        }
      } else {
        text = text.replace(/\r?\n|\r/g, " ");
        if (text) this.insertNode(Leaf.text(text), marks);
      }
    }
    parseAttributes(elt, marks) {
      let matched = /* @__PURE__ */ new Set(), style = elt.style, hasStyles = style && style.length > 0;
      for (let rule of this.rules.attributeRules) if (!matched.has(rule.attribute)) {
        let isStyle = /^style\//.test(rule.attribute);
        let value = !isStyle ? elt.getAttribute(rule.attribute) : hasStyles ? style.getPropertyValue(rule.attribute.slice(6)) : "";
        if (!value) continue;
        let hasParam = Object.prototype.hasOwnProperty.call(rule, "param"), param = rule.param;
        if (rule.readAttribute) {
          param = rule.readAttribute(value);
          hasParam = true;
          if (param == parse.Reject) continue;
        } else if (rule.value != null && rule.value != value) {
          continue;
        }
        if (rule.ignore) return null;
        if (rule.consuming !== false) matched.add(rule.attribute);
        if (rule.clearMark) {
          marks = marks.filter((p) => !rule.clearMark(p));
        } else {
          let mark = rule.mark instanceof Mark ? rule.mark : rule.mark instanceof Mark.Type ? hasParam ? rule.mark.of(param) : rule.mark.default : null;
          if (!mark) throw new Error(`Parse rule for ${rule.attribute} does not produce a mark (or have ignore/clearMark properties)`);
          marks = marks.concat(mark);
        }
      }
      return marks;
    }
    insertNode(node, marks) {
      let innerMarks = this.findPlace(node.tag, marks, false);
      if (innerMarks) {
        let top2 = this.top;
        for (let p of innerMarks) if (this.schema.markAllowed(p.type, node.type)) node = node.withMarks(p.addToSet(node.marks));
        for (let p of node.tag.marks) node = node.withMarks(p.addToSet(node.marks));
        node.pushTo(top2.children);
        return true;
      }
      return false;
    }
    // Try to find a way to fit the given node type into the current
    // context. May add intermediate wrappers and/or leave non-solid
    // nodes that we're in. Returns null if no place could be created, a
    // set of mark values not applied to wrappers otherwise.
    findPlace(tag, marks, endOfSlice) {
      let route, under;
      for (let cx = this.top; ; cx = cx.parent) {
        let found = this.schema.findWrapping(cx.tag.type, tag.type);
        if (found && (!route || route.length > found.length)) {
          route = found;
          under = cx;
          if (!found.length) break;
        }
        if (cx.flags & 4 /* Solid */) break;
      }
      if (!route) return null;
      this.sync(under);
      for (let i = 0; i < route.length; i++)
        marks = this.enterInner(route[i], marks, endOfSlice, null);
      return marks;
    }
    enter(tag, marks, endOfSlice, elt) {
      let innerMarks = this.findPlace(tag, marks, endOfSlice);
      if (innerMarks) innerMarks = this.enterInner(tag, marks, endOfSlice, elt);
      return innerMarks;
    }
    // Open a node of the given type. Return the set of marks not
    // assigned to that node.
    enterInner(tag, marks, endOfSlice, element) {
      marks = marks.filter((p) => {
        if (!this.schema.markAllowed(p.type, tag.type)) return true;
        tag = tag.withMarks(p.addToSet(tag.marks));
        return false;
      });
      let test, open = (this.top.children.length ? 0 : this.top.flags & 1 /* OpenStart */) | (endOfSlice ? this.top.flags & 2 /* OpenEnd */ : 0);
      if (open && element && this.options.isOpen && (test = this.options.isOpen(element))) {
        open &= ~(1 /* OpenStart */ | 2 /* OpenEnd */);
        if (test == "start") open |= 1 /* OpenStart */;
        else if (test == "end") open |= 2 /* OpenEnd */;
        else if (test == "start end") open |= 1 /* OpenStart */ | 2 /* OpenEnd */;
      }
      this.top = new NodeContext(tag, (element ? 4 /* Solid */ : 0 /* None */) | open, this.top);
      return marks;
    }
    sync(to) {
      if (!this.top.isIn(to)) return false;
      while (this.top != to) this.close();
      return true;
    }
    close() {
      let parent = this.top.parent;
      parent.children.push(this.finishNode(this.top));
      this.top = parent;
    }
    finishNode(cx) {
      if (!(cx.flags & 2 /* OpenEnd */) && cx.children.length && !cx.tag.type.preserveWhitespace && this.options.collapseWhiteSpace !== false) {
        let last = cx.children[cx.children.length - 1].tag, m;
        if (last.is(Leaf.Text) && (m = /[ \t\r\n\u000c]+$/.exec(last.param))) {
          let len = last.length - m[0].length;
          if (!len) cx.children.pop();
          else cx.children[cx.children.length - 1] = last.sliceText(0, len);
        }
      }
      let open = cx.flags & (2 /* OpenEnd */ | 1 /* OpenStart */);
      if (!open && !cx.tag.type.canBeEmpty && cx.tag.isPlot && !cx.children.length)
        cx.children.push(this.schema.createDefault(cx.tag.type));
      let node = cx.tag.isDoc ? this.schema.doc(cx.children) : cx.tag.create(cx.children);
      if (open) this.open.set(node, open);
      return node;
    }
  };
  var NodeContext = class {
    constructor(tag, flags, parent) {
      __publicField(this, "tag", tag);
      __publicField(this, "flags", flags);
      __publicField(this, "parent", parent);
      __publicField(this, "children", []);
    }
    isIn(parent) {
      for (let cx = this; cx; cx = cx.parent) if (cx == parent) return true;
      return false;
    }
  };
  function normalizeList(dom) {
    for (let child = dom.firstChild, prevItem = null; child; child = child.nextSibling) {
      if (child.nodeType != 1) continue;
      let name = child.nodeName.toLowerCase();
      if (prevItem && (name == "ol" || name == "ul")) {
        prevItem.appendChild(child);
        child = prevItem;
      } else {
        prevItem = name == "li" ? child : null;
      }
    }
  }
  var normalizers = { ol: normalizeList, ul: normalizeList };
  var ignoreTags = /* @__PURE__ */ new Set(["head", "noscript", "object", "script", "style", "title"]);
  var blockTags = /* @__PURE__ */ new Set([
    "address",
    "article",
    "aside",
    "blockquote",
    "canvas",
    "dd",
    "div",
    "dl",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hgroup",
    "hr",
    "li",
    "noscript",
    "ol",
    "output",
    "p",
    "pre",
    "section",
    "table",
    "tfoot",
    "ul"
  ]);
  function guessParent(content, schema) {
    let rules = parse.Rule.Set.fromSchema(schema);
    let tags = [], blocks = 0;
    let explore = (node) => {
      if (node.nodeType == 3) {
        tags.push(Leaf.Text);
      } else if (node.nodeType == 1) {
        if (blockTags.has(node.nodeName.toLowerCase())) blocks++;
        let match = rules.matchElement(node);
        if (match && match.rule.tag) {
          tags.push(Node.Type.get(match.rule.tag));
        } else if (!(match && match.rule.ignore)) {
          for (let ch = node.firstChild; ch; ch = ch.nextSibling) explore(ch);
        }
      }
    };
    explore(content);
    let best, bestCost = 0;
    for (let parent of schema.nodes) if (parent.isPlot && parent.default) {
      let cost = parent.isDoc ? -1 : 0;
      if (blocks > 1 && parent.inlineContent) cost += 5;
      for (let child of tags) {
        let fit = schema.findWrapping(parent, child);
        cost += fit ? fit.length * 2 : 1e3;
      }
      if (!best || bestCost > cost) {
        best = parent.default;
        bestCost = cost;
      }
    }
    return best;
  }

  // vendor/wordgard/src/doc/serialize.ts
  var SerializeContext = class {
    constructor(options, openAttr) {
      __publicField(this, "openAttr", openAttr);
      __publicField(this, "emitNewlines");
      __publicField(this, "override");
      this.emitNewlines = options.emitNewlines !== false;
      this.override = options.override;
    }
  };
  function serialize(doc2, options = {}) {
    return Elt.Fragment.create(serializeChildren(doc2.content, new SerializeContext(options)));
  }
  ((serialize2) => {
    function node(node2, options = {}) {
      return serializeChildren([node2], new SerializeContext(options))[0];
    }
    serialize2.node = node;
    function slice(slice2, options = {}) {
      return Elt.Fragment.create(
        serializeChildren(
          flattenSlice(slice2.content, slice2.context, options.includeContext || 0, !!options.openAttr),
          new SerializeContext(options, options.openAttr)
        )
      );
    }
    serialize2.slice = slice;
  })(serialize || (serialize = {}));
  var genericTag = Plot.define("generic", {
    blockContent: Node.Group.All,
    shape: { element: "div" }
  });
  var openMark = Mark.Type.define("Open", {
    shape: { attribute: "wg-open", value: 0 },
    target: Node.Group.All
  });
  function flattenSlice(content, context, includeContext, markOpen) {
    let depth2 = 0, i = 0, scan = (inner) => {
      let result2 = [];
      for (; i < content.length; ) {
        let tok = content[i++];
        if (tok.tokenType == Token.Type.Close) {
          if (inner) break;
          let tag = depth2 < context.length ? context[depth2++] : genericTag;
          if (markOpen) tag = tag.withMarks(openMark.of("start").addToSet(tag.marks));
          result2 = [tag.create(result2)];
        } else if (tok.tokenType == Token.Type.Open) {
          let content2 = scan(true), tag = tok;
          if (markOpen) tag = tag.withMarks(openMark.of("end").addToSet(tag.marks));
          result2.push(tag.create(content2));
        } else {
          result2.push(tok);
        }
      }
      return result2;
    };
    let result = scan(false);
    while (depth2 < includeContext && depth2 < context.length) {
      let tag = context[depth2++];
      if (markOpen) tag = tag.withMarks(openMark.of("start end").addToSet(tag.marks));
      result = [tag.create(result)];
    }
    return result;
  }
  function serializeNodeInner(node, cx) {
    let markAttrs = Attributes.none, targeted;
    for (let mark of node.tag.marks) if (mark.type.attribute) {
      if (mark.type == openMark) {
        markAttrs = Attributes.merge(markAttrs, [cx.openAttr, mark.value]);
      } else {
        let { target, get } = mark.type.attribute, attrs = get(mark.value);
        if (target && !node.isText) {
          ;
          (targeted || (targeted = [])).push({ attrs, target });
        } else if (!node.isText || mark.spanning) {
          markAttrs = Attributes.merge(markAttrs, attrs);
        }
      }
    }
    if (node.is(Leaf.Text))
      return markAttrs.length ? Elt.create("span", markAttrs, [node.param]) : node.param;
    let children;
    if (node.isLeaf) {
      children = [];
    } else {
      let { content } = node;
      if (cx.emitNewlines && node.type.preserveWhitespace)
        content = lineBreaksToNewlines(content);
      children = serializeChildren(content, cx);
    }
    let elt = cx.override && cx.override(node.tag) || node.type.shape.create(node.tag.param);
    if (markAttrs.length) elt = elt.addAttrs(markAttrs);
    if (targeted) for (let { attrs, target } of targeted) elt = elt.addAttrs(attrs, target);
    return elt.hasContent ? withContent(elt, children) : elt;
  }
  function withContent(elt, content) {
    let children = [];
    for (let ch of elt.children) {
      if (ch === 0) for (let inner of content) children.push(inner);
      else if (typeof ch == "string") children.push(ch);
      else children.push(withContent(ch, content));
    }
    return Elt.create(elt.tagName, elt.attrs, children);
  }
  function lineBreaksToNewlines(nodes) {
    if (!nodes.some((n) => n.type.hasRole(Node.Role.LineBreak))) return nodes;
    let result = [], lastText = false;
    for (let node of nodes) {
      let next = node.type.hasRole(Node.Role.LineBreak) ? Leaf.text("\n", node.marks) : node;
      if (lastText && next instanceof Plot) next.pushTo(result);
      else result.push(next);
      lastText = next.isText;
    }
    return result;
  }
  var EltCx = class {
    constructor(tagName, attrs, parent) {
      __publicField(this, "tagName", tagName);
      __publicField(this, "attrs", attrs);
      __publicField(this, "parent", parent);
      __publicField(this, "children", []);
    }
    pop() {
      let repr = Elt.create(this.tagName, this.attrs, this.children);
      let parent = this.parent;
      parent.children.push(repr);
      return parent;
    }
  };
  function serializeChildren(children, cx) {
    let active = [], top2 = new EltCx("", Attributes.none, null);
    for (let child of children) {
      if (active.length || child.marks.some((p) => p.type.element)) {
        let keep = 0, rendered = 0, eltMarks = [];
        for (let mark of child.marks)
          if (mark.type.element) eltMarks.push(mark);
        while (keep < active.length && rendered < eltMarks.length) {
          let next = eltMarks[rendered];
          if (!next.eq(active[keep]) || !next.type.spanning) break;
          keep++;
          rendered++;
        }
        while (keep < active.length) {
          top2 = top2.pop();
          active.pop();
        }
        while (rendered < eltMarks.length) {
          let add = eltMarks[rendered++];
          let repr = add.type.element;
          top2 = new EltCx(repr.name, repr.attrs(add.value), top2);
          active.push(add);
        }
      }
      top2.children.push(serializeNodeInner(child, cx));
    }
    for (let i = 0; i < active.length; i++) top2 = top2.pop();
    return top2.children;
  }

  // rich-text/wordgard-source/types.ts
  var types_exports = {};
  __export(types_exports, {
    Alignment: () => Alignment,
    BackgroundColor: () => BackgroundColor,
    BlockCell: () => BlockCell,
    BlockHeaderCell: () => BlockHeaderCell,
    Blockquote: () => Blockquote,
    BulletList: () => BulletList,
    CaptionedFigure: () => CaptionedFigure,
    Cell: () => Cell,
    Code: () => Code,
    CodeBlock: () => CodeBlock,
    CodeBlockLanguage: () => CodeBlockLanguage,
    ColSpan: () => ColSpan,
    Color: () => Color,
    Direction: () => Direction,
    Doc: () => Doc,
    Emphasis: () => Emphasis,
    Figure: () => Figure,
    HeaderCell: () => HeaderCell,
    Heading: () => Heading,
    HorizontalRule: () => HorizontalRule,
    Image: () => Image,
    ImageAlt: () => ImageAlt,
    ImageSize: () => ImageSize,
    InlineDoc: () => InlineDoc,
    InlineListItem: () => InlineListItem,
    LineBreak: () => LineBreak,
    Link: () => Link,
    ListItem: () => ListItem,
    OrderedList: () => OrderedList,
    Paragraph: () => Paragraph,
    RowSpan: () => RowSpan,
    Strikethrough: () => Strikethrough,
    Strong: () => Strong,
    Subscript: () => Subscript,
    Superscript: () => Superscript,
    Table: () => Table,
    TableRow: () => TableRow,
    Underline: () => Underline
  });

  // vendor/wordgard/src/types/schema.ts
  var G = Node.Group;
  var LineBreak = Leaf.define("LineBreak", {
    inline: true,
    role: Node.Role.LineBreak,
    toText: () => "\n",
    shape: { element: "br" }
  });
  var Paragraph = Plot.define("Paragraph", {
    inlineContent: true,
    group: G.Content,
    defaultBlock: true,
    shape: { element: "p" }
  });
  var Heading = Plot.Type.define("Heading", {
    defaultParam: 1,
    validate: (value) => {
      if (typeof value != "number" || Math.floor(value) != value || value < 1 || value > 6)
        throw new ValidationError(`Invalid heading level: ${value}`);
    },
    inlineContent: true,
    group: G.Content,
    shape: { structure: (level) => Elt.mk("h" + level, [0]), atom: false },
    defining: true,
    parseRules: [
      { selector: "h1", param: 1 },
      { selector: "h2", param: 2 },
      { selector: "h3", param: 3 },
      { selector: "h4", param: 4 },
      { selector: "h5", param: 5 },
      { selector: "h6", param: 6 }
    ]
  });
  var CodeBlock = Plot.define("CodeBlock", {
    inlineContent: [Leaf.Text, LineBreak],
    group: G.Content,
    role: Node.Role.Code,
    shape: { element: "pre" }
  });
  var CodeBlockLanguage = Mark.Type.define("CodeBlockLanguage", {
    target: CodeBlock,
    validate: "string",
    shape: { attribute: "data-language", value: 0 }
  });
  var Blockquote = Plot.define("Blockquote", {
    blockContent: G.Content,
    group: G.Content,
    shape: { element: "blockquote" },
    autoJoin: true
  });
  var ListItem = Plot.define("ListItem", {
    blockContent: G.Content,
    shape: { element: "li" },
    defining: true
  });
  var InlineListItem = Plot.define("ListItem", {
    inlineContent: true,
    shape: { element: "li" },
    defining: true
  });
  var OrderedList = Plot.Type.define("OrderedList", {
    defaultParam: 1,
    validate: "number",
    blockContent: [ListItem, InlineListItem],
    group: G.Content,
    role: Node.Role.List,
    defining: true,
    shape: {
      element: "ol",
      attributes: (start) => start == 1 ? {} : { start: String(start) },
      readElement: (elt) => Number(elt.getAttribute("start") || "1")
    },
    autoJoin: (_a, b) => b.param == 1
  });
  var BulletList = Plot.define("BulletList", {
    blockContent: [ListItem, InlineListItem],
    group: G.Content,
    role: Node.Role.List,
    defining: true,
    shape: { element: "ul" },
    autoJoin: true
  });
  var HorizontalRule = Leaf.define("HorizontalRule", {
    group: G.Content,
    shape: { element: "hr" },
    toText: () => "---",
    selectable: true
  });
  var Cell = Plot.define("Cell", {
    inlineContent: true,
    group: G.TableCell,
    isolating: true,
    cursorBarrier: false,
    shape: { element: "td" }
  });
  var HeaderCell = Plot.define("HeaderCell", {
    inlineContent: true,
    group: G.TableCell,
    isolating: true,
    cursorBarrier: false,
    shape: { element: "th" }
  });
  var BlockCell = Plot.define("Cell", {
    blockContent: G.Content,
    group: G.TableCell,
    isolating: true,
    cursorBarrier: false,
    shape: { element: "td" }
  });
  var BlockHeaderCell = Plot.define("HeaderCell", {
    blockContent: G.Content,
    group: G.TableCell,
    isolating: true,
    cursorBarrier: false,
    shape: { element: "th" }
  });
  var TableRow = Plot.define("TableRow", {
    blockContent: G.TableCell,
    canBeEmpty: true,
    orientation: "row",
    shape: { element: "tr" }
  });
  var Table = Plot.define("Table", {
    blockContent: TableRow,
    isolating: true,
    group: G.Content,
    shape: { structure: Elt.mk("table", [Elt.mk("tbody", [0])]) },
    parseRules: [{ selector: "table" }]
  });
  function validatePosInt(value) {
    if (typeof value != "number" || Math.round(value) != value || value < 1)
      throw new RangeError(`${value} is not a positive integer`);
  }
  function readPosInt(value) {
    let num = Number.parseInt(value);
    if (Number.isNaN(num) || num < 1) return parse.Reject;
    return num;
  }
  var ColSpan = Mark.Type.define("ColSpan", {
    target: G.TableCell,
    validate: validatePosInt,
    shape: { attribute: "colspan", value: (span) => String(span), readAttribute: readPosInt }
  });
  var RowSpan = Mark.Type.define("RowSpan", {
    target: G.TableCell,
    validate: validatePosInt,
    shape: { attribute: "rowspan", value: (span) => String(span), readAttribute: readPosInt }
  });
  var Image = Leaf.Type.define("Image", {
    inline: true,
    validate: "string",
    shape: { element: "img", attributes: (src) => ({ src }) },
    selectable: true,
    parseRules: [{
      selector: "img[src]",
      readElement: (elt) => elt.src
    }]
  });
  var Figure = Leaf.Type.define("Figure", {
    validate: "string",
    shape: { structure: (src) => Elt.mk("figure", [Elt.mk("img", { src })]) },
    selectable: true,
    group: G.Content,
    parseRules: [{
      selector: "figure:has(img[src])",
      marksFrom: "img[src]",
      readElement: (elt) => elt.querySelector("img[src]").src,
      precedence: 2
    }]
  });
  var CaptionedFigure = Plot.Type.define("CaptionedFigure", {
    inlineContent: true,
    validate: "string",
    shape: { structure: (src) => Elt.mk("figure", [Elt.mk("img", { src }), Elt.mk("figcaption", [0])]), atom: false },
    group: G.Content,
    parseRules: [{
      selector: "figure:has(img[src]):has(figcaption)",
      marksFrom: "img[src]",
      readElement: (elt) => elt.querySelector("img[src]").src,
      contentElement: "figcaption",
      precedence: 4
    }]
  });
  var ImageAlt = Mark.Type.define("ImageAlt", {
    target: [Image, Figure, CaptionedFigure],
    validate: "string",
    shape: { attribute: "alt", value: 0, preferTarget: "img" }
  });
  var ImageSize = Mark.Type.define("ImageSize", {
    target: [Image, Figure, CaptionedFigure],
    validate: "number",
    shape: { attribute: "style", value: (size) => `width: ${size}px`, preferTarget: "img" }
  });
  var Alignment = Mark.Type.define("Alignment", {
    target: [G.Textblock, Figure],
    keepOnSplit: true,
    keepOnTypeChange: true,
    shape: { attribute: "style", value: (align) => `text-align: ${align}` },
    parseRules: [
      { attribute: "style/text-align", readAttribute: (value) => /^(end|center)$/.test(value) ? value : parse.Reject }
    ]
  });
  var Direction = Mark.Type.define("Direction", {
    target: G.Textblock,
    keepOnSplit: true,
    keepOnTypeChange: true,
    validate: (val) => {
      if (val != "ltr" && val != "rtl" && val != "auto") throw new ValidationError(`Invalid direction value: ${val}`);
    },
    shape: { attribute: "dir", value: 0 }
  });
  var Emphasis = Mark.define("Emphasis", {
    rank: 50,
    shape: { element: "em" },
    parseRules: [
      { attribute: "style/font-style", value: "italic" },
      { attribute: "style/font-style", value: "normal", clearMark: (p) => p.name == "Emphasis" }
    ]
  });
  var Strong = Mark.define("Strong", {
    rank: 60,
    shape: { element: "strong" },
    parseRules: [
      {
        attribute: "style/font-weight",
        readAttribute: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) ? null : parse.Reject
      },
      {
        attribute: "style/font-weight",
        readAttribute: (value) => /^(normal|lighter|[1-4]\d{2})$/.test(value) ? null : parse.Reject,
        clearMark: (p) => p.name == "Strong"
      }
    ]
  });
  var Underline = Mark.define("Underline", {
    rank: 40,
    shape: { element: "u" },
    parseRules: [
      { attribute: "style/text-decoration", value: "underline" }
    ]
  });
  var Strikethrough = Mark.define("Strikethrough", {
    rank: 42,
    shape: { element: "s" },
    parseRules: [
      { attribute: "style/text-decoration", value: "line-through" }
    ]
  });
  var Superscript = Mark.define("Superscript", {
    rank: 45,
    shape: { element: "sup" }
  });
  var Subscript = Mark.define("Subscript", {
    rank: 47,
    shape: { element: "sub" }
  });
  var Link = Mark.Type.define("Link", {
    rank: 20,
    validate: "string",
    inclusive: false,
    shape: {
      element: "a",
      preferTarget: "a[href]",
      attributes: (href) => ({ href }),
      readElement: (dom) => dom.href
    }
  });
  var Code = Mark.define("Code", {
    rank: 80,
    shape: { element: "code" }
  });
  var Color = Mark.Type.define("Color", {
    rank: 30,
    shape: { attribute: "style/color", value: 0 },
    spanning: true
  });
  var BackgroundColor = Mark.Type.define("BackgroundColor", {
    rank: 35,
    shape: { attribute: "style/background-color", value: 0 },
    spanning: true
  });
  var Doc = Plot.defineDoc({
    blockContent: G.Content
  });
  var InlineDoc = Plot.defineDoc({
    inlineContent: true
  });

  // rich-text/wordgard-source/state.ts
  var state_exports = {};
  __export(state_exports, {
    BidiSpan: () => BidiSpan,
    Correction: () => Correction,
    GardSelection: () => GardSelection,
    GardState: () => GardState,
    TextblockMap: () => TextblockMap,
    Transaction: () => Transaction
  });

  // rich-text/wordgard-patches/inert-html.ts
  var inert_html_exports = {};
  __export(inert_html_exports, {
    parseInertHTML: () => parseInertHTML
  });
  var detachedDoc = null;
  var policy;
  function getDetachedDoc() {
    if (typeof document != "object" || !document.implementation)
      throw new Error("Trying to parse an HTML string in a non-browser context.");
    return detachedDoc || (detachedDoc = document.implementation.createHTMLDocument("title"));
  }
  function parseInertHTML(html) {
    const doc2 = getDetachedDoc();
    const types2 = globalThis.trustedTypes;
    if (types2 && !policy) policy = types2.createPolicy("sd-inert-html", { createHTML: (value) => value });
    const root = doc2.createElement("div");
    root.innerHTML = types2 ? policy.createHTML(html) : html;
    return root;
  }

  // node_modules/@marijn/find-cluster-break/src/index.js
  var rangeFrom = [];
  var rangeTo = [];
  (() => {
    let numbers = "lc,34,7n,7,7b,19,,,,2,,2,,,20,b,1c,l,g,,2t,7,2,6,2,2,,4,z,,u,r,2j,b,1m,9,9,,o,4,,9,,3,,5,17,3,1n,9,16,o,,x,1i,3,,i,,7,a,2,t,3,1k,,,7,2,2,2,3,9,,a,2,q,,2,3,1k,,,5,4,2,2,3,3,,u,2,3,,b,3,1k,,,8,,3,,3,k,2,m,6,,3,1k,,,7,2,2,2,3,7,3,a,2,u,,1n,5,3,3,,4,9,,14,5,1j,,,7,,3,,4,7,2,b,2,t,3,1k,,,7,,3,,4,7,2,b,2,f,,c,4,1j,2,,7,,3,,4,9,,a,2,t,3,1y,,4,6,,,,8,i,2,1p,,,8,c,8,2q,,,a,b,7,21,2,r,,,,,,4,2,1d,k,,2,5,b,,10,9,,2u,b,,6,n,4,4,3,g,4,d,,,3,6,,f,,jj,3,qa,4,s,3,t,2,u,2,1s,w,9,,19,3,,,39,2,y,,3a,c,4,c,63,5,1l,a,,,,,2,o,2,,1c,1a,2,c,k,5,1b,h,12,9,c,3,u,d,1k,e,1c,k,48,3,,l,4,,6,,2,3,5i,1s,ek,,5f,x,2da,3,3x,,2o,w,fe,6,2x,2,n9w,4,,a,w,2,28,2,7k,,3,,4,,n,5,4,,2b,2,1e,i,q,i,d,,12,8,p,d,18,4,1b,e,10,,1v,e,c,,8,2,1a,,1f,,,3,2,2,5,2,,,15,5,5,2,6k,8,,2,fn4,,kh,g,g,g,a6,2,gt,,6a,,45,5,1ae,3,,2,5,4,14,3,4,,4l,2,fx,4,1t,5,8t,2,25,6,1y,b,1d,4,3e,3,1h,f,15,,2,2,a,4,19,b,7,,1p,3,10,e,g,2,18,,c,3,1c,e,8,4,,2,2k,c,6,,2,,4d,c,l,4,1j,2,,7,2,2,2,3,9,,a,2,2,7,3,5,1v,9,,,2,,,4,,5,,,e,2,2a,i,n,,29,k,6j,7,2,9,r,2,2a,h,2y,d,2t,3,2,a,74,f,6t,6,,2,2,4,,,,2,3x,7,2,7,3,,s,a,14,7,,4,8,,9,b,1a,g,5i,8,5j,8,,8,2a,m,,e,3e,6,3,,,2,,7,,,1u,5,,2,,5,9n,4,9,2,,,1c,7,3,5,n,,44l,,6,f,8ug,i,1xc,5,1n,7,t4,,,1j,7,4,29,,b,2,f57,2,3mp,1a,2,n,f2,5,3,6,8,8,2,7,u,4,44,3,1iz,1j,4,1e,8,,e,,m,5,,f,11s,7,,h,2,7,,2,,5,2s,,4g,7,af,,1p,4,e4,4,72,2,6r,,2,,7,2,5,,d6,7,31,7,240,5".split(",").map((s) => s ? parseInt(s, 36) : 1);
    for (let i = 0, n = 0; i < numbers.length; i++)
      (i % 2 ? rangeTo : rangeFrom).push(n = n + numbers[i]);
  })();
  function isExtendingChar(code) {
    if (code < 768) return false;
    for (let from = 0, to = rangeFrom.length; ; ) {
      let mid = from + to >> 1;
      if (code < rangeFrom[mid]) to = mid;
      else if (code >= rangeTo[mid]) from = mid + 1;
      else return true;
      if (from == to) return false;
    }
  }
  function isRegionalIndicator(code) {
    return code >= 127462 && code <= 127487;
  }
  var ZWJ = 8205;
  function findClusterBreak(str, pos, forward = true, includeExtending = true) {
    return (forward ? nextClusterBreak : prevClusterBreak)(str, pos, includeExtending);
  }
  function nextClusterBreak(str, pos, includeExtending) {
    if (pos == str.length) return pos;
    if (pos && surrogateLow(str.charCodeAt(pos)) && surrogateHigh(str.charCodeAt(pos - 1))) pos--;
    let prev = codePointAt(str, pos);
    pos += codePointSize(prev);
    while (pos < str.length) {
      let next = codePointAt(str, pos);
      if (prev == ZWJ || next == ZWJ || includeExtending && isExtendingChar(next)) {
        pos += codePointSize(next);
        prev = next;
      } else if (isRegionalIndicator(next)) {
        let countBefore = 0, i = pos - 2;
        while (i >= 0 && isRegionalIndicator(codePointAt(str, i))) {
          countBefore++;
          i -= 2;
        }
        if (countBefore % 2 == 0) break;
        else pos += 2;
      } else {
        break;
      }
    }
    return pos;
  }
  function prevClusterBreak(str, pos, includeExtending) {
    while (pos > 1) {
      let found = nextClusterBreak(str, pos - 2, includeExtending);
      if (found < pos) return found;
      pos--;
    }
    return 0;
  }
  function codePointAt(str, pos) {
    let code0 = str.charCodeAt(pos);
    if (!surrogateHigh(code0) || pos + 1 == str.length) return code0;
    let code1 = str.charCodeAt(pos + 1);
    if (!surrogateLow(code1)) return code0;
    return (code0 - 55296 << 10) + (code1 - 56320) + 65536;
  }
  function surrogateLow(ch) {
    return ch >= 56320 && ch < 57344;
  }
  function surrogateHigh(ch) {
    return ch >= 55296 && ch < 56320;
  }
  function codePointSize(code) {
    return code < 65536 ? 1 : 2;
  }

  // vendor/wordgard/src/state/bidi.ts
  function dec(str) {
    let result = [];
    for (let i = 0; i < str.length; i++) result.push(1 << +str[i]);
    return result;
  }
  var LowTypes = dec("88888888888888888888888888888888888666888888787833333333337888888000000000000000000000000008888880000000000000000000000000088888888888888888888888888888888888887866668888088888663380888308888800000000000000000000000800000000000000000000000000000008");
  var ArabicTypes = dec("4444448826627288999999999992222222222222222222222222222222222222222222222229999999999999999999994444444444644222822222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222999999949999999229989999223333333333");
  var Brackets = (() => {
    let result = /* @__PURE__ */ Object.create(null);
    for (let p of ["()", "[]", "{}"]) {
      let l = p.charCodeAt(0), r = p.charCodeAt(1);
      result[l] = r;
      result[r] = -l;
    }
    return result;
  })();
  var BracketStack = [];
  function charType(ch) {
    return ch <= 247 ? LowTypes[ch] : 1424 <= ch && ch <= 1524 ? 2 /* R */ : 1536 <= ch && ch <= 1785 ? ArabicTypes[ch - 1536] : 1774 <= ch && ch <= 2220 ? 4 /* AL */ : 8192 <= ch && ch <= 8204 ? 256 /* NI */ : 64336 <= ch && ch <= 65023 ? 4 /* AL */ : ch == 65532 ? 256 /* NI */ : 1 /* L */;
  }
  var BidiRE = /[\u0590-\u05f4\u0600-\u06ff\u0700-\u08ac\ufb50-\ufdff]/;
  var BidiSpan = class {
    /// @internal
    constructor(from, to, level) {
      __publicField(this, "from", from);
      __publicField(this, "to", to);
      __publicField(this, "level", level);
    }
    /// The direction of this span.
    get ltr() {
      return this.level % 2 == 0;
    }
    /// @internal
    side(end, ltr) {
      return this.ltr == ltr == end ? this.to : this.from;
    }
    /// @internal
    forward(forward, ltr) {
      return forward == (this.ltr == ltr);
    }
    /// @internal
    static find(order, index, assoc) {
      let maybe = -1;
      for (let i = 0; i < order.length; i++) {
        let span = order[i];
        if (span.from <= index && span.to >= index && (maybe < 0 || (assoc != 0 ? assoc < 0 ? span.from < index : span.to > index : order[maybe].level > span.level)))
          maybe = i;
      }
      if (maybe < 0) throw new RangeError("Index out of range");
      return maybe;
    }
    /// Query whether the given character has a strong direction.
    /// Returns null when not, true when left-to-right, and false when
    /// right-to-left.
    static strongDir(ch) {
      let type = charType(ch);
      if (type == 1 /* L */) return true;
      if (type == 2 /* R */ || type == 4 /* AL */) return false;
      return null;
    }
  };
  var types = [];
  function computeCharTypes(line, rFrom, rTo, isolates, outerType) {
    for (let iI = 0; iI <= isolates.length; iI++) {
      let from = iI ? isolates[iI - 1].to : rFrom, to = iI < isolates.length ? isolates[iI].from : rTo;
      let prevType = iI ? 256 /* NI */ : outerType;
      for (let i = from, prev = prevType, prevStrong = prevType; i < to; i++) {
        let type = charType(line.charCodeAt(i));
        if (type == 512 /* NSM */) type = prev;
        else if (type == 8 /* EN */ && prevStrong == 4 /* AL */) type = 16 /* AN */;
        types[i] = type == 4 /* AL */ ? 2 /* R */ : type;
        if (type & 7 /* Strong */) prevStrong = type;
        prev = type;
      }
      for (let i = from, prev = prevType, prevStrong = prevType; i < to; i++) {
        let type = types[i];
        if (type == 128 /* CS */) {
          if (i < to - 1 && prev == types[i + 1] && prev & 24 /* Num */) type = types[i] = prev;
          else types[i] = 256 /* NI */;
        } else if (type == 64 /* ET */) {
          let end = i + 1;
          while (end < to && types[end] == 64 /* ET */) end++;
          let replace = i && prev == 8 /* EN */ || end < rTo && types[end] == 8 /* EN */ ? prevStrong == 1 /* L */ ? 1 /* L */ : 8 /* EN */ : 256 /* NI */;
          for (let j = i; j < end; j++) types[j] = replace;
          i = end - 1;
        } else if (type == 8 /* EN */ && prevStrong == 1 /* L */) {
          types[i] = 1 /* L */;
        }
        prev = type;
        if (type & 7 /* Strong */) prevStrong = type;
      }
    }
  }
  function processBracketPairs(line, rFrom, rTo, isolates, outerType) {
    let oppositeType = outerType == 1 /* L */ ? 2 /* R */ : 1 /* L */;
    for (let iI = 0, sI = 0, context = 0; iI <= isolates.length; iI++) {
      let from = iI ? isolates[iI - 1].to : rFrom, to = iI < isolates.length ? isolates[iI].from : rTo;
      for (let i = from, ch, br, type; i < to; i++) {
        if (br = Brackets[ch = line.charCodeAt(i)]) {
          if (br < 0) {
            for (let sJ = sI - 3; sJ >= 0; sJ -= 3) {
              if (BracketStack[sJ + 1] == -br) {
                let flags = BracketStack[sJ + 2];
                let type2 = flags & 2 /* EmbedInside */ ? outerType : !(flags & 4 /* OppositeInside */) ? 0 : flags & 1 /* OppositeBefore */ ? oppositeType : outerType;
                if (type2) types[i] = types[BracketStack[sJ]] = type2;
                sI = sJ;
                break;
              }
            }
          } else if (BracketStack.length == 189 /* MaxDepth */) {
            break;
          } else {
            BracketStack[sI++] = i;
            BracketStack[sI++] = ch;
            BracketStack[sI++] = context;
          }
        } else if ((type = types[i]) == 2 /* R */ || type == 1 /* L */) {
          let embed = type == outerType;
          context = embed ? 0 : 1 /* OppositeBefore */;
          for (let sJ = sI - 3; sJ >= 0; sJ -= 3) {
            let cur = BracketStack[sJ + 2];
            if (cur & 2 /* EmbedInside */) break;
            if (embed) {
              BracketStack[sJ + 2] |= 2 /* EmbedInside */;
            } else {
              if (cur & 4 /* OppositeInside */) break;
              BracketStack[sJ + 2] |= 4 /* OppositeInside */;
            }
          }
        }
      }
    }
  }
  function processNeutrals(rFrom, rTo, isolates, outerType) {
    for (let iI = 0, prev = outerType; iI <= isolates.length; iI++) {
      let from = iI ? isolates[iI - 1].to : rFrom, to = iI < isolates.length ? isolates[iI].from : rTo;
      for (let i = from; i < to; ) {
        let type = types[i];
        if (type == 256 /* NI */) {
          let end = i + 1;
          for (; ; ) {
            if (end == to) {
              if (iI == isolates.length) break;
              end = isolates[iI++].to;
              to = iI < isolates.length ? isolates[iI].from : rTo;
            } else if (types[end] == 256 /* NI */) {
              end++;
            } else {
              break;
            }
          }
          let beforeL = prev == 1 /* L */;
          let afterL = (end < rTo ? types[end] : outerType) == 1 /* L */;
          let replace = beforeL == afterL ? beforeL ? 1 /* L */ : 2 /* R */ : outerType;
          for (let j = end, jI = iI, fromJ = jI ? isolates[jI - 1].to : rFrom; j > i; ) {
            if (j == fromJ) {
              j = isolates[--jI].from;
              fromJ = jI ? isolates[jI - 1].to : rFrom;
            }
            types[--j] = replace;
          }
          i = end;
        } else {
          prev = type;
          i++;
        }
      }
    }
  }
  function emitSpans(line, from, to, level, baseLevel, isolates, order) {
    let ourType = level % 2 ? 2 /* R */ : 1 /* L */;
    if (level % 2 == baseLevel % 2) {
      for (let iCh = from, iI = 0; iCh < to; ) {
        let sameDir = true, isNum = false;
        if (iI == isolates.length || iCh < isolates[iI].from) {
          let next = types[iCh];
          if (next != ourType) {
            sameDir = false;
            isNum = next == 16 /* AN */;
          }
        }
        let recurse = !sameDir && ourType == 1 /* L */ ? [] : null;
        let localLevel = sameDir ? level : level + 1;
        let iScan = iCh;
        run: for (; ; ) {
          if (iI < isolates.length && iScan == isolates[iI].from) {
            if (isNum) break run;
            let iso = isolates[iI];
            if (!sameDir) for (let upto = iso.to, jI = iI + 1; ; ) {
              if (upto == to) break run;
              if (jI < isolates.length && isolates[jI].from == upto) upto = isolates[jI++].to;
              else if (types[upto] == ourType) break run;
              else break;
            }
            iI++;
            if (recurse) {
              recurse.push(iso);
            } else {
              if (iso.from > iCh) order.push(new BidiSpan(iCh, iso.from, localLevel));
              let dirSwap = iso.ltr != !(localLevel % 2);
              computeSectionOrder(line, dirSwap ? level + 1 : level, baseLevel, iso.inner, iso.from, iso.to, order);
              iCh = iso.to;
            }
            iScan = iso.to;
          } else if (iScan == to || (sameDir ? types[iScan] != ourType : types[iScan] == ourType)) {
            break;
          } else {
            iScan++;
          }
        }
        if (recurse)
          emitSpans(line, iCh, iScan, level + 1, baseLevel, recurse, order);
        else if (iCh < iScan)
          order.push(new BidiSpan(iCh, iScan, localLevel));
        iCh = iScan;
      }
    } else {
      for (let iCh = to, iI = isolates.length; iCh > from; ) {
        let sameDir = true, isNum = false;
        if (!iI || iCh > isolates[iI - 1].to) {
          let next = types[iCh - 1];
          if (next != ourType) {
            sameDir = false;
            isNum = next == 16 /* AN */;
          }
        }
        let recurse = !sameDir && ourType == 1 /* L */ ? [] : null;
        let localLevel = sameDir ? level : level + 1;
        let iScan = iCh;
        run: for (; ; ) {
          if (iI && iScan == isolates[iI - 1].to) {
            if (isNum) break run;
            let iso = isolates[--iI];
            if (!sameDir) for (let upto = iso.from, jI = iI; ; ) {
              if (upto == from) break run;
              if (jI && isolates[jI - 1].to == upto) upto = isolates[--jI].from;
              else if (types[upto - 1] == ourType) break run;
              else break;
            }
            if (recurse) {
              recurse.push(iso);
            } else {
              if (iso.to < iCh) order.push(new BidiSpan(iso.to, iCh, localLevel));
              let dirSwap = iso.ltr != !(localLevel % 2);
              computeSectionOrder(line, dirSwap ? level + 1 : level, baseLevel, iso.inner, iso.from, iso.to, order);
              iCh = iso.from;
            }
            iScan = iso.from;
          } else if (iScan == from || (sameDir ? types[iScan - 1] != ourType : types[iScan - 1] == ourType)) {
            break;
          } else {
            iScan--;
          }
        }
        if (recurse)
          emitSpans(line, iScan, iCh, level + 1, baseLevel, recurse, order);
        else if (iScan < iCh)
          order.push(new BidiSpan(iScan, iCh, localLevel));
        iCh = iScan;
      }
    }
  }
  function computeSectionOrder(line, level, baseLevel, isolates, from, to, order) {
    let outerType = level % 2 ? 2 /* R */ : 1 /* L */;
    computeCharTypes(line, from, to, isolates, outerType);
    processBracketPairs(line, from, to, isolates, outerType);
    processNeutrals(from, to, isolates, outerType);
    emitSpans(line, from, to, level, baseLevel, isolates, order);
  }
  function computeOrder(line, ltr, isolates) {
    if (!line) return [new BidiSpan(0, 0, ltr ? 0 : 1)];
    if (ltr && !isolates.length && !BidiRE.test(line)) return trivialOrder(line.length);
    if (isolates.length) while (line.length > types.length) types[types.length] = 256 /* NI */;
    let order = [], level = ltr ? 0 : 1;
    computeSectionOrder(line, level, level, isolates, 0, line.length, order);
    return order;
  }
  function trivialOrder(length) {
    return [new BidiSpan(0, length, 0)];
  }

  // vendor/wordgard/src/state/textblock.ts
  var cache = /* @__PURE__ */ new WeakMap();
  var TextblockMap = class _TextblockMap {
    constructor(start, node, ltr, text, _order, config, sections) {
      __publicField(this, "start", start);
      __publicField(this, "node", node);
      __publicField(this, "ltr", ltr);
      __publicField(this, "text", text);
      __publicField(this, "_order", _order);
      __publicField(this, "config", config);
      __publicField(this, "sections", sections);
    }
    /// The text order of the text in this block. Will generally be a
    /// single span, but if the block mixes left-to-right and
    /// right-to-left text, this describes the individual sections,
    /// ordered from the block's start to its end.
    get order() {
      return this._order || (this._order = computeOrder(this.text, this.ltr, []));
    }
    /// Get the map for the given textblock. Will use a cache to reuse
    /// results for unchanged blocks.
    static get(cx, start, node) {
      let cached = cache.get(node);
      if (cached && cached.config == cx.config)
        return cached.start == start ? cached : new _TextblockMap(start, node, cached.ltr, cached.text, cached._order, cx.config, cached.sections);
      let result = _TextblockMap.create(start, node, cx.config);
      cache.set(node, result);
      return result;
    }
    static create(start, node, config) {
      let text = "", sections = [], sectionPos = 0;
      let flush = (upto) => {
        if (upto > sectionPos) sections.push(upto - sectionPos << 2 /* Shift */);
      };
      let scan = (node2, pos) => {
        for (let ch of node2.content) {
          if (ch.is(Leaf.Text)) {
            text += ch.param;
          } else if (ch.isLeaf || config.isAtom(ch.type)) {
            text += "\uFFFC";
            if (ch.length > 1) {
              flush(pos);
              sections.push(ch.length << 2 /* Shift */ | 1 /* Atom */);
              sectionPos = pos + ch.length;
            }
          } else {
            text += " ";
            scan(ch, pos + 1);
            text += " ";
          }
          pos += ch.length;
        }
      };
      scan(node, 0);
      flush(node.contentLength);
      return new _TextblockMap(start, node, config.textblockLTR(node), text, null, config, sections);
    }
    /// Get the string index for a document position. Positions outside
    /// of the textblock will be clipped to its start or end.
    toIndex(pos) {
      if (pos < this.start) return 0;
      let off = pos - this.start, idx = 0;
      for (let n of this.sections) {
        let len = n >> 2 /* Shift */, flag = n & 3 /* Flag */;
        if (flag == 0 /* Text */) {
          if (off <= len) return idx + off;
          off -= len;
          idx += len;
        } else if (flag == 1 /* Atom */) {
          off = Math.max(0, off - len);
          if (off < 0) return idx;
          idx++;
        } else {
          if (off > 0) off--;
        }
      }
      return idx;
    }
    /// Get the document position for a given string index.
    fromIndex(index) {
      let off = this.start;
      for (let n of this.sections) {
        let len = n >> 2 /* Shift */, flag = n & 3 /* Flag */;
        if (flag == 0 /* Text */) {
          if (len > index) return off + index;
          index -= len;
        } else if (flag == 1 /* Atom */) {
          if (!index) return off;
          index--;
        } else {
          if (!index) return off + (flag == 2 /* BoundBefore */ ? 1 : 0);
        }
        off += len;
      }
      return off;
    }
    /// @internal
    moveVisually(start, side, forward, skipped) {
      if (!this.text.length) return null;
      let startIndex = this.toIndex(start), { order, ltr } = this, spanI;
      if (startIndex == 0 && side < 0) {
        if (!forward) return null;
        startIndex = order[spanI = 0].side(false, this.ltr);
      } else if (startIndex == this.text.length && side > 0) {
        if (forward) return null;
        startIndex = order[spanI = order.length - 1].side(true, this.ltr);
      } else {
        spanI = BidiSpan.find(order, startIndex, side);
      }
      let span = order[spanI], spanEnd = span.side(forward, ltr);
      if (startIndex == spanEnd) {
        let nextI = spanI += forward ? 1 : -1;
        if (nextI < 0 || nextI >= order.length) return null;
        span = order[spanI = nextI];
        startIndex = span.side(!forward, ltr);
        spanEnd = span.side(forward, ltr);
      }
      let nextIndex = findClusterBreak(this.text, startIndex, span.forward(forward, ltr));
      if (nextIndex == startIndex) return null;
      if (nextIndex < span.from || nextIndex > span.to) nextIndex = spanEnd;
      if (skipped) skipped[0] = this.text.slice(Math.min(startIndex, nextIndex), Math.max(startIndex, nextIndex));
      let nextSpan = spanI == (forward ? order.length - 1 : 0) ? null : order[spanI + (forward ? 1 : -1)];
      if (nextIndex == spanEnd) {
        if (!nextSpan) return forward ? { pos: this.start + this.node.contentLength, side: 1 } : { pos: this.start, side: -1 };
        if (nextSpan.level + (forward ? 0 : 1) < span.level)
          return {
            pos: this.fromIndex(nextSpan.side(!forward, this.ltr)),
            side: nextSpan.forward(forward, this.ltr) ? 1 : -1
          };
      }
      return { pos: this.fromIndex(nextIndex), side: nextIndex != spanEnd ? 1 : span.forward(forward, ltr) ? -1 : 1 };
    }
    /// @internal
    skipWord(start, side, forward, visually) {
      let word = "", skipped = [""], cur = null;
      let history2 = /* @__PURE__ */ new Map();
      for (; ; ) {
        let next, char, from = cur ? cur.pos : start;
        if (visually) {
          next = this.moveVisually(from, cur ? cur.side : side, forward, skipped);
          char = skipped[0];
        } else {
          next = this.moveLogically(from, forward);
          char = next ? this.text.slice(Math.min(next.pos, from), Math.max(next.pos, from)) : "";
        }
        if (!next) break;
        if (/\p{L}|\p{N}/u.test(char)) {
          if (forward) word += char;
          else word = skipped[0] + word;
          history2.set(word.length, next);
        } else if (word) {
          break;
        }
        cur = next;
      }
      if (!word) return null;
      if (!Intl.Segmenter) return cur;
      let segments = [...new Intl.Segmenter(void 0, { granularity: "word" }).segment(word)];
      return history2.get(segments[forward ? 0 : segments.length - 1].segment.length) || cur;
    }
    /// @internal
    moveLogically(start, forward) {
      let index = this.toIndex(start);
      let next = findClusterBreak(this.text, index, forward);
      return next == index ? null : { pos: this.fromIndex(next), side: 1 };
    }
  };

  // vendor/wordgard/src/state/selection.ts
  var SelectionType = class {
    constructor(tag, cls, toJSON, fromJSON) {
      __publicField(this, "tag", tag);
      __publicField(this, "cls", cls);
      __publicField(this, "toJSON", toJSON);
      __publicField(this, "fromJSON", fromJSON);
    }
  };
  var GardSelection = class _GardSelection {
    constructor(anchor, head, goalColumn) {
      __publicField(this, "anchor", anchor);
      __publicField(this, "head", head);
      __publicField(this, "goalColumn", goalColumn);
    }
    /// The lower boundary of the selected range.
    get from() {
      return Math.min(this.anchor, this.head);
    }
    /// The upper boundary of the range.
    get to() {
      return Math.max(this.anchor, this.head);
    }
    /// True when `anchor` and `head` are at the same position.
    get empty() {
      return this.anchor == this.head;
    }
    /// Returns true when this is an empty text selection.
    get isCursor() {
      return this.empty && this instanceof _GardSelection.Text;
    }
    /// The set of ranges covered by this selection, sorted. By default,
    /// this is just the selection's main `from` to `to`, but custom
    /// selection implementations can override it.
    get ranges() {
      return [this];
    }
    /// The range that should be used when replacing this selection with
    /// other content (for example when typing or pasting over it) or
    /// deleting it. The default implementation returns `this.from` to
    /// `this.to`.
    get replacementRange() {
      return this;
    }
    /// This can be overridden to control the DOM selection created for
    /// a selection. The default is to just return the selection's own
    /// head and anchor.
    get domSelection() {
      return this;
    }
    /// Create a content slice and context from this selection. The
    /// default implementation concatenates the slices for the
    /// selection's `ranges`.
    toSlice(doc2) {
      let slice;
      for (let range of this.ranges) {
        let cur = Slice.get(doc2, range.from, range.to);
        slice = slice ? slice.concat(cur) : cur;
      }
      return slice;
    }
    /// The side that the selection head is associated with. -1 means it
    /// is after the element before its position, 1 means it is before
    /// the element after its position. This influences where the
    /// cursor is drawn (for example when on a line wrapping boundary
    /// or in bidirectional text) and where further motion takes it. It
    /// is valid for it to point in a direction where the is no element
    /// (say, -1 when at the start of its parent node).
    ///
    /// By default, this points in the direction of the anchor or
    /// forward if that is equal to the head, but selection types like
    /// {@link GardSelection.Text} can override it.
    get headSide() {
      return this.head > this.anchor ? -1 : 1;
    }
    /// The {@link GardSelection.headSide side} associated with the
    /// selection anchor. Also by default points towards the head, or if
    /// that is the same position, forward.
    get anchorSide() {
      return this.anchor > this.head ? -1 : 1;
    }
    /// Returns true if this selection has the same head and anchor as
    /// the given selection.
    eqPos(other) {
      return this.anchor == other.anchor && this.head == other.head;
    }
    /// @internal
    check(config, doc2) {
      if (!config.staticFacet(_GardSelection.selectionType).some((t) => this instanceof t.cls))
        throw new RangeError("Unsupported selection type");
      for (let { from, to } of this.ranges)
        if (from < 0 || to > doc2.length)
          throw new RangeError(`Selection out of document range`);
    }
    /// @internal
    resolve(doc2) {
      return _GardSelection.Resolved.create(doc2, this);
    }
    /// Convert this selection to an object that can be serialized to
    /// JSON. Each selection type may define its own JSON representation
    /// format.
    toJSON(state) {
      let type = state.facet(_GardSelection.selectionType).find((tp) => this instanceof tp.cls);
      if (!type) throw new Error("Selection type not enabled in state given to GardSelection.toJSON");
      let result = type.toJSON(this);
      result.type = type.tag;
      return result;
    }
    /// Deserialize a selection. The configuration is used to associate
    /// custom selection types with their implementation.
    static fromJSON(cx, json) {
      let { doc: doc2, config } = cx, tag = json.type;
      let types2 = config.staticFacet(_GardSelection.selectionType);
      let type = types2.find((tp) => tp.tag == tag);
      if (!type) throw new Error(`Unknown selection type '${tag}' in GardSelection.fromJSON`);
      return type.fromJSON(doc2, json);
    }
    /// Create a cursor text selection at the given position.
    static cursor(pos, side, goalColumn) {
      return _GardSelection.Text.createInner(pos, pos, side, true, goalColumn);
    }
    /// Find a normal cursor near the given position.
    static near(cx, pos, side = 1, goalColumn) {
      let norm = findNormalAt(cx, pos, side);
      return _GardSelection.cursor(norm.pos, norm.side, goalColumn);
    }
    /// Create a text selection.
    static range(anchor, head, headSide, goalColumn) {
      return _GardSelection.Text.createInner(anchor, head ?? anchor, headSide, true, goalColumn);
    }
    /// Create a text selection.
    static undirectionalRange(from, to) {
      return _GardSelection.Text.createInner(from, to, 1, false);
    }
    /// Create a node selection.
    static node(pos, node, goalColumn) {
      return _GardSelection.Node.create(pos, node, goalColumn);
    }
    /// Find the next normal cursor position after or before this selection's
    /// head. Normal cursor positions are:
    ///
    /// - Any inline position.
    ///
    /// - Positions between two cursor barriers, if not already an
    ///   inline position. Cursor barriers are the sides of the
    ///   document, any block leaves, or plots that are {@link
    ///   Plot.Spec.isolating isolating}, {@link
    ///   Plot.Spec.preserveWhitespace whitespace-preserving}, or
    ///   explicitly defined as a {@link Plot.Spec.cursorBarrier
    ///   cursor barrier}.
    nextNormalCursor(cx, forward = true) {
      let found = scanNormalFrom(cx, this.head, this.headSide, forward);
      return found && _GardSelection.cursor(found.pos, found.side);
    }
    /// Move across one word starting from this selection's head.
    skipWord(cx, forward = true) {
      let found = skipWord(cx, this.head, this.headSide, forward);
      return found && _GardSelection.cursor(found.pos, found.side);
    }
    /// Find a normal selection at the start of the document or the
    /// given textblock.
    static atStart(cx, block) {
      return cursorAtStart(cx, block);
    }
    /// Find a normal selection at the end of the document or the given
    /// textblock.
    static atEnd(cx, block) {
      let found = block ? { pos: block.end, side: 1 } : cx.doc.inlineContent ? { pos: cx.doc.length, side: 1 } : findNormalAt(cx, cx.doc.length, -1);
      return _GardSelection.cursor(found.pos, found.side);
    }
  };
  ((GardSelection3) => {
    function define(tag, cls, toJSON, fromJSON) {
      return GardSelection3.selectionType.of(new SelectionType(tag, cls, toJSON, fromJSON));
    }
    GardSelection3.define = define;
    class Text extends GardSelection3 {
      constructor(anchor, head, _headSide, directional, goalColumn, marks) {
        super(anchor, head, goalColumn);
        __publicField(this, "_headSide", _headSide);
        __publicField(this, "directional", directional);
        __publicField(this, "marks", marks);
      }
      /// @internal
      static createInner(anchor, head, side, directional, goalColumn, marks) {
        return new Text(anchor, head, side ?? (head > anchor ? -1 : 1), directional, goalColumn, marks);
      }
      get headSide() {
        return this._headSide;
      }
      get anchorSide() {
        return this.anchor == this.head ? this._headSide : super.anchorSide;
      }
      /// Create a text selection.
      static create(spec) {
        let { anchor, head = anchor } = spec;
        return Text.createInner(anchor, head, spec.headSide, spec.directional !== false, spec.goalColumn, spec.marks);
      }
      map(change, cx, assoc = -1) {
        let from, to;
        if (this.empty) {
          from = to = change.mapPos(this.from, assoc);
        } else {
          from = change.mapPos(this.from, 1);
          to = Math.max(from, change.mapPos(this.to, -1));
        }
        return Text.createInner(from, to, this.headSide, this.directional, this.goalColumn, this.marks);
      }
      eq(other) {
        return other instanceof Text && this.eqPos(other) && this.headSide == other.headSide && (this.marks == other.marks || !!(this.marks && other.marks && this.marks.length == other.marks.length && this.marks.every((p, i) => p.eq(other.marks[i]))));
      }
    }
    GardSelection3.Text = Text;
    ((Text2) => {
      Text2.type = new SelectionType("text", Text2, ((sel) => {
        let result = { anchor: sel.anchor };
        if (sel.headSide != (sel.head > sel.anchor ? -1 : 1)) result.side = sel.headSide;
        if (!sel.empty) result.head = sel.head;
        if (sel.marks) {
          result.marks = {};
          for (let mark of sel.marks) result.marks[mark.name] = mark.value;
        }
        return result;
      }), ((doc2, json) => {
        if (!json || typeof json.anchor != "number")
          throw new ValidationError("Invalid JSON representation for GardSelection.Text");
        let anchor = json.anchor, head = typeof json.head == "number" ? json.head : anchor;
        let marks = json.marks ? doc2.schema.marksFromJSON(json.marks) : void 0;
        return Text2.createInner(
          anchor,
          head,
          json.side == 1 || json.side == -1 ? json.side : void 0,
          json.directional !== false,
          void 0,
          marks
        );
      }));
    })(Text = GardSelection3.Text || (GardSelection3.Text = {}));
    class Node9 extends GardSelection3 {
      constructor(from, to, node, goalColumn) {
        super(from, to, goalColumn);
        __publicField(this, "node", node);
      }
      /// @internal
      static create(pos, node, goalColumn) {
        return new Node9(pos, pos + node.length, node, goalColumn);
      }
      map(change, cx, assoc = -1) {
        let newPos = change.mapPos(this.anchor, 1, "after");
        if (newPos == null) return GardSelection3.near(cx, change.mapPos(this.anchor, assoc), assoc);
        return Node9.create(newPos, cx.doc.nodeAt(newPos));
      }
      eq(other) {
        return other instanceof Node9 && other.anchor == this.anchor;
      }
    }
    GardSelection3.Node = Node9;
    ((Node10) => {
      Node10.type = new SelectionType("node", Node10, (sel) => ({ pos: sel.anchor }), (doc2, json) => {
        let node = json && typeof json.pos == "number" && doc2.nodeAt(json.pos);
        if (!node || node.isText || !node.type.isSelectable)
          throw new ValidationError("Invalid GardSelection.Node JSON representation");
        return Node10.create(json.pos, node);
      });
    })(Node9 = GardSelection3.Node || (GardSelection3.Node = {}));
    class Resolved {
      constructor(doc2, selection) {
        __publicField(this, "doc", doc2);
        __publicField(this, "selection", selection);
        /// The selection anchor.
        __publicField(this, "anchor");
        /// The head of the selection.
        __publicField(this, "head");
        __publicField(this, "_ranges", null);
        this.anchor = doc2.resolve(selection.anchor);
        this.head = selection.empty ? this.anchor : doc2.resolve(selection.head);
      }
      /// @internal
      static create(doc2, selection) {
        return new Resolved(doc2, selection);
      }
      /// The lower bound of the selection.
      get from() {
        return this.anchor.pos < this.head.pos ? this.anchor : this.head;
      }
      /// The upper bound of the selection.
      get to() {
        return this.anchor.pos > this.head.pos ? this.anchor : this.head;
      }
      /// The selection ranges.
      get ranges() {
        return this._ranges || (this._ranges = this.resolveRanges());
      }
      resolveRanges() {
        return this.selection.ranges.map(({ from, to }) => ({ from: this.doc.resolve(from), to: this.doc.resolve(to) }));
      }
      /// The resolved replacement range.
      get replacementRange() {
        let repl = this.selection.replacementRange;
        if (repl.from == this.selection.from && repl.to == this.selection.to) return this;
        return { from: this.doc.resolve(repl.from), to: this.doc.resolve(repl.to) };
      }
      /// The active marks for this selection. If this is a cursor
      /// selection with explicitly stored {@link
      /// GardSelection.Text.Spec.marks marks}, those are returned.
      /// Otherwise, this computes the marks that should be applied to
      /// content inserted in the selection's position, based on
      /// spanning marks on the surrounding nodes.
      get activeMarks() {
        let repl = this.replacementRange;
        return this.selection instanceof GardSelection3.Text && this.selection.marks || repl.from.marks(repl.to);
      }
    }
    GardSelection3.Resolved = Resolved;
  })(GardSelection || (GardSelection = {}));
  function cursorAtStart(cx, block) {
    let found = block ? { pos: block.start, side: -1 } : cx.doc.inlineContent ? { pos: 0, side: -1 } : findNormalAt(cx, 0, 1);
    return GardSelection.cursor(found.pos, found.side);
  }
  function isBarrier(cx, node) {
    if (node.isLeaf) return node.isBlock;
    let override = node.type.spec.cursorBarrier;
    if (override != null) return override;
    return node.isBlock && (node.type.isolating || node.type.preserveWhitespace || cx.config.isAtom(node.type));
  }
  function scanNormalFrom(cx, from, side, forward) {
    let pos = cx.doc.resolve(from), pastBarrier = false;
    if (pos.parent.node.inlineContent) {
      let block = pos.textblockParent;
      let map = TextblockMap.get(cx, block.start, block.node);
      let next = cx.config.visualCursorMotion ? map.moveVisually(pos.pos, side, forward) : map.moveLogically(pos.pos, forward);
      if (next != null) return next;
      if (!block.parent) return null;
      pos = Pos.create(block.parent, forward ? block.after : block.before, block.index + (forward ? 1 : 0), 0);
      pastBarrier = isBarrier(cx, block.node);
    } else {
      pastBarrier = !pos.parent.parent && pos.index == (forward ? 0 : pos.parent.node.content.length);
      for (let { parent: { node }, index } = pos; !pastBarrier && (forward ? index : index < node.content.length); ) {
        let next = node.content[forward ? index - 1 : index];
        if (isBarrier(cx, next)) pastBarrier = true;
        if (next.isLeaf) {
          index += forward ? 1 : -1;
        } else {
          if (next.inlineContent) break;
          node = next;
          index = forward ? next.content.length : 0;
        }
      }
    }
    let bottom = pos.pos, step = forward ? 1 : -1;
    for (let { parent, index } = pos, p = pos.pos; ; ) {
      let { node, parent: next } = parent;
      if (node.inlineContent) return { pos: p, side: forward ? -1 : 1 };
      if (index == (forward ? node.content.length : 0)) {
        let barrier = !next || isBarrier(cx, node);
        if (bottom != from && pastBarrier && barrier) return { pos: bottom, side: forward ? -1 : 1 };
        if (!next) return null;
        index = parent.index + (forward ? 1 : 0);
        parent = next;
        p += step;
        bottom = p;
        if (barrier) pastBarrier = true;
      } else {
        let nextNode = node.content[index - (forward ? 0 : 1)];
        let barrier = isBarrier(cx, nextNode);
        if (pastBarrier && bottom != from && barrier) return { pos: bottom, side: forward ? -1 : 1 };
        if (nextNode.isLeaf || cx.config.isAtom(nextNode.type)) {
          index += step;
          p += nextNode.length * step;
        } else {
          if (!forward) index--;
          parent = Pos.Plot.create(parent, nextNode, forward ? p : p - nextNode.length, index);
          p += step;
          index = forward ? 0 : nextNode.content.length;
        }
        if (barrier) {
          pastBarrier = true;
          bottom = p;
        }
      }
    }
  }
  function findNormalAt(cx, pos, bias) {
    let res = cx.doc.resolve(pos), lowest = pos;
    if (res.inText) {
      let text = res.parent.node.content[res.index].tag.param;
      let off = bias > 0 ? findClusterBreak(text, res.inText - 1) : findClusterBreak(text, res.inText + 1, false);
      pos += off - res.inText;
      if (off > 0 && off < text.length)
        return { pos, side: bias };
      res = Pos.create(res.parent, pos, res.index + (off ? 1 : 0), 0);
    }
    for (let pass = 0; pass < 2; pass++) {
      let dir = !pass ? bias : -bias, { parent, index } = res, curPos = pos;
      for (; ; ) {
        if (parent.node.inlineContent) return { pos: curPos, side: bias };
        if (index == (dir > 0 ? parent.node.content.length : 0)) {
          if (isBarrier(cx, parent.node) || !parent.parent) break;
          lowest = curPos = curPos + dir;
          index = parent.index + (dir > 0 ? 1 : 0);
          parent = parent.parent;
        } else {
          let nextIndex = index + (dir > 0 ? 0 : -1), next = parent.node.content[nextIndex];
          if (next.isLeaf || isBarrier(cx, next)) break;
          if (!parent.node.inlineContent && next.inlineContent)
            return { pos: curPos + dir, side: -dir };
          parent = Pos.Plot.create(parent, next, curPos, nextIndex);
          index = dir > 0 ? 0 : next.content.length;
          curPos += dir;
        }
      }
    }
    return { pos: lowest, side: bias };
  }
  function skipWord(cx, start, side, forward) {
    let last = null;
    for (let pos = start, visually = cx.config.visualCursorMotion; ; ) {
      let block = cx.doc.resolve(pos).textblockParent;
      if (!block) {
        let next = scanNormalFrom(cx, pos, side, forward);
        if (!next) return last;
        ({ pos, side } = next);
      } else {
        let map = TextblockMap.get(cx, block.start, block.node);
        let next = map.skipWord(pos, side, forward, visually);
        if (next) return next;
        if (!block.parent) return last;
        let end = forward ? { pos: block.end, side: 1 } : { pos: block.start, side: -1 };
        if (end.pos != start) last = end;
        pos = forward ? block.after : block.before;
      }
    }
  }
  function wordAt(state, pos, bias) {
    let res = state.doc.resolve(pos);
    if (!res.parent.node.inlineContent) return GardSelection.cursor(pos, bias);
    let start = pos, end = pos, text = "";
    scanBack: for (let i = res.index - (res.inText ? 0 : 1), cur = res.nodeBefore; cur; ) {
      if (!cur.is(Leaf.Text)) break;
      for (let j = cur.length; j > 0; ) {
        let next = findClusterBreak(cur.param, j, false);
        let ch = cur.param.slice(next, j);
        if (!/\p{L}|\p{N}/u.test(ch)) break scanBack;
        text = ch + text;
        start -= j - next;
        j = next;
      }
      if (!i) break;
      cur = res.parent.node.content[--i];
    }
    scanForward: for (let i = res.index + 1, cur = res.nodeAfter; cur; ) {
      if (!cur.is(Leaf.Text)) break;
      for (let j = 0; j < cur.length; ) {
        let next = findClusterBreak(cur.param, j, true);
        let ch = cur.param.slice(j, next);
        if (!/\p{L}|\p{N}/u.test(ch)) break scanForward;
        text += ch;
        end += next - j;
        j = next;
      }
      if (i == res.parent.node.content.length) break;
      cur = res.parent.node.content[i++];
    }
    if (!Intl.Segmenter) return GardSelection.undirectionalRange(start, end);
    let best = null, local = pos - start;
    for (let segment of new Intl.Segmenter(void 0, { granularity: "word" }).segment(text)) {
      if (segment.isWordLike && segment.index <= local && segment.index + segment.segment.length >= local && (!best || bias > 0))
        best = segment;
    }
    return best ? GardSelection.undirectionalRange(start + best.index, start + best.index + best.segment.length) : GardSelection.cursor(pos, bias);
  }

  // vendor/wordgard/src/state/transaction.ts
  var Transaction = class _Transaction {
    constructor(startState, changes, selection, effects, annotations, scrollIntoView2) {
      __publicField(this, "startState", startState);
      __publicField(this, "changes", changes);
      __publicField(this, "selection", selection);
      __publicField(this, "effects", effects);
      __publicField(this, "annotations", annotations);
      __publicField(this, "scrollIntoView", scrollIntoView2);
      /// @internal
      __publicField(this, "_state", null);
      /// The new selection produced by the transaction. If {@link
      /// Transaction.selection `this.selection`} is undefined, this will
      /// {@link GardSelection.map map} the start state's current
      /// selection through the changes made by the transaction.
      __publicField(this, "newSelection");
      /// The new document produced by the transaction. Contrary to
      /// {@link Transaction.state `.state`}`.doc`, accessing this won't
      /// force the entire new state to be computed right away, so it is
      /// recommended that {@link Transaction.extender transaction
      /// extenders} use this property when they need to look at the new
      /// document.
      __publicField(this, "newDoc");
      if (!annotations.some((a) => a.type == _Transaction.time))
        this.annotations = annotations.concat(_Transaction.time.of(Date.now()));
      this.newDoc = this.changes.apply(this.startState.doc);
      this.newSelection = selection || startState.selection.map(changes, { doc: this.newDoc, config: this.startState.config });
      this.newSelection.check(startState.config, this.newDoc);
    }
    /// @internal
    static create(startState, spec) {
      return new _Transaction(startState, spec.changes, spec.selection, spec.effects, spec.annotations, spec.scrollIntoView);
    }
    /// The new state created by the transaction. Lazily computed so
    /// that the state is resolved the first time this property is
    /// accessed.
    get state() {
      if (!this._state) this.startState.applyTransaction(this);
      return this._state;
    }
    /// Get the value of the given transaction {@link
    /// Transaction.Annotation annotation} type, if any.
    annotation(type) {
      for (let ann of this.annotations) if (ann.type == type) return ann.value;
      return void 0;
    }
    /// Indicates whether the transaction changed the document.
    get docChanged() {
      return !this.changes.empty;
    }
    /// Indicates whether this transaction reconfigures the state
    /// (through a {@link GardState.Compartment configuration
    /// compartment}, {@link GardState.reconfigure reconfiguration}, or
    /// {@link GardState.appendConfig appended configuration}).
    get reconfigured() {
      return this.startState.config != this.state.config;
    }
    /// Returns true if the transaction has a {@link
    /// Transaction.userEvent user event} annotation that is equal to or
    /// more specific than `event`. For example, if the transaction has
    /// `"select.pointer"` as user event, `"select"` and
    /// `"select.pointer"` will match it.
    isUserEvent(event) {
      let e = this.annotation(_Transaction.userEvent);
      return !!(e && (e == event || e.length > event.length && e.startsWith(event) && e[event.length] == "."));
    }
  };
  ((Transaction3) => {
    function merge(state, a, b) {
      let rA = resolveTransactionInner(state, null, a);
      return mergeTransaction(state, rA, resolveTransactionInner(state, rA.changes, b));
    }
    Transaction3.merge = merge;
    function append(tr) {
      let result = [tr], top2 = tr.state;
      let appenders = tr.startState.facet(Transaction3.appender);
      if (!appenders.length) return result;
      for (let seen = appenders.map(() => 0); ; ) {
        let done = true;
        for (let i = 0; i < appenders.length; i++) {
          let from = seen[i];
          if (from < result.length) {
            let add = appenders[i](from ? result.slice(from) : result, top2);
            if (add) {
              let tr2 = top2.update(Transaction3.merge(top2, add, { annotations: Transaction3.appended.of(true) }));
              result.push(tr2);
              top2 = tr2.state;
              done = false;
            }
            seen[i] = result.length;
          }
        }
        if (done) return result;
      }
    }
    Transaction3.append = append;
    class Annotation {
      /// @internal
      constructor(type, value) {
        __publicField(this, "type", type);
        __publicField(this, "value", value);
      }
      /// Define a new type of annotation.
      static define() {
        return new Transaction3.Annotation.Type();
      }
    }
    Transaction3.Annotation = Annotation;
    ((Annotation2) => {
      class Type {
        /// Create an instance of this annotation.
        of(value) {
          return new Transaction3.Annotation(this, value);
        }
      }
      Annotation2.Type = Type;
    })(Annotation = Transaction3.Annotation || (Transaction3.Annotation = {}));
    Transaction3.time = Transaction3.Annotation.define();
    Transaction3.userEvent = Annotation.define();
    Transaction3.addToHistory = Annotation.define();
    Transaction3.remote = Annotation.define();
    Transaction3.appended = Annotation.define();
    class Effect {
      /// @internal
      constructor(type, value) {
        __publicField(this, "type", type);
        __publicField(this, "value", value);
      }
      /// Map this effect through a position mapping. Will return
      /// `undefined` when the changes deleted the effect.
      map(mapping) {
        let mapped = this.type.map(this.value, mapping);
        return mapped === void 0 ? void 0 : mapped == this.value ? this : new Transaction3.Effect(this.type, mapped);
      }
      /// Tells you whether this effect object is of a given
      /// {@link Transaction.Effect.Type type}.
      is(type) {
        return this.type == type;
      }
      /// Define a new effect type. The type parameter indicates the
      /// type of values that his effect holds. It should be a type that
      /// doesn't include `undefined`, since that is used in {@link
      /// Transaction.Effect.map mapping} to indicate that an effect is
      /// removed.
      static define(spec = {}) {
        return new Transaction3.Effect.Type(spec.map || ((v) => v));
      }
    }
    Transaction3.Effect = Effect;
    ((Effect2) => {
      function mapEffects(effects, mapping) {
        if (!effects.length) return effects;
        let result = [];
        for (let effect of effects) {
          let mapped = effect.map(mapping);
          if (mapped) result.push(mapped);
        }
        return result;
      }
      Effect2.mapEffects = mapEffects;
      class Type {
        /// @internal
        constructor(map) {
          __publicField(this, "map", map);
        }
        /// Create an {@link Transaction.Effect effect} instance of this
        /// type.
        of(value) {
          return new Transaction3.Effect(this, value);
        }
      }
      Effect2.Type = Type;
    })(Effect = Transaction3.Effect || (Transaction3.Effect = {}));
  })(Transaction || (Transaction = {}));
  function selCx(config, doc2, changes) {
    let newDoc;
    return { get doc() {
      return newDoc || (newDoc = changes.apply(doc2));
    }, config };
  }
  function mergeTransaction(state, a, b) {
    let changes = a.changes.compose(b.changes);
    return {
      changes,
      selection: b.selection || a.selection && a.selection.map(b.changes, selCx(state.config, state.doc, changes)),
      effects: Transaction.Effect.mapEffects(a.effects, b.changes).concat(b.effects),
      annotations: a.annotations.length ? a.annotations.concat(b.annotations) : b.annotations,
      scrollIntoView: a.scrollIntoView || b.scrollIntoView
    };
  }
  function resolveTransactionInner(state, after, spec) {
    let { changes, sequential } = spec;
    if (after && after.empty) after = null;
    let doc2 = after && sequential ? after.apply(state.doc) : state.doc;
    if (!(changes instanceof ChangeSet)) changes = ChangeSet.create(doc2, changes || []);
    let effects = asArray(spec.effects), annotations = asArray(spec.annotations);
    if (spec.userEvent) annotations = annotations.concat(Transaction.userEvent.of(spec.userEvent));
    let selection = !spec.selection ? void 0 : spec.selection instanceof GardSelection ? spec.selection : typeof spec.selection == "function" ? spec.selection({ doc: changes.apply(doc2), config: state.config }, changes) ?? void 0 : GardSelection.Text.create(spec.selection);
    if (after && !sequential) {
      if (selection) {
        let { a, b } = ChangeSet.transform(state.doc, after, changes);
        selection = selection.map(a, selCx(state.config, doc2, changes));
        changes = b;
      } else {
        changes = changes.transform(state.doc, after);
      }
      effects = Transaction.Effect.mapEffects(effects, after);
    }
    return { changes, selection, effects, annotations, scrollIntoView: !!spec.scrollIntoView };
  }
  function resolveTransaction(state, spec) {
    let s = resolveTransactionInner(state, null, spec);
    let extenders = state.facet(Transaction.extender), tr = Transaction.create(state, s);
    for (let i = extenders.length - 1; i >= 0; i--) {
      let extension = extenders[i](tr);
      if (extension) {
        s = mergeTransaction(state, s, resolveTransactionInner(state, tr.changes, extension));
        tr = Transaction.create(state, s);
      }
    }
    return tr;
  }
  var none2 = [];
  function asArray(value) {
    return value == null ? none2 : Array.isArray(value) ? value : [value];
  }

  // vendor/wordgard/src/state/state.ts
  var nextID = 0;
  var none3 = [];
  var readHTML = parseInertHTML;
  function readDoc(schema, doc2) {
    if (!doc2) return schema.doc(schema.docTag.type.canBeEmpty ? [] : [
      schema.createAndFill(schema.defaultContentTag(schema.docTag.type))
    ]);
    if (doc2 instanceof Plot.Doc)
      return doc2.schema == schema ? doc2 : schema.doc(doc2.content);
    if (typeof doc2 == "function") return doc2(schema);
    if (typeof doc2 == "string") doc2 = readHTML(doc2);
    let { nodeType } = doc2;
    if (nodeType === 1 || nodeType === 11) return parse(schema, doc2);
    return schema.docFromJSON(doc2);
  }
  var _GardState = class _GardState {
    constructor(config, _doc, _selection, values, computeSlot, tr) {
      __publicField(this, "config", config);
      __publicField(this, "_doc", _doc);
      __publicField(this, "_selection", _selection);
      __publicField(this, "values", values);
      /// @internal
      __publicField(this, "status");
      /// @internal
      __publicField(this, "computeSlot");
      __publicField(this, "resolvedSel", null);
      __publicField(this, "trackAccess", null);
      this.status = config.statusTemplate.slice();
      this.computeSlot = computeSlot;
      if (tr) tr._state = this;
      for (let i = 0; i < this.config.dynamicSlots.length; i++) ensureAddr(this, i << 1);
      this.computeSlot = null;
    }
    /// Create a new state. You'll usually only need this when
    /// initializing an editor or loading a new document—updated states
    /// are created by applying transactions.
    ///
    /// The schema of the state can be provided either via the {@link
    /// GardState.schemaElement configuration} or by passing in an
    /// initialized document (which will have its own schema). If the
    /// configuration contains a document plot type, the schema from the
    /// configuration will be used, even if a document was provided.
    static create(spec) {
      let config = spec.config instanceof _GardState.Configuration ? spec.config : _GardState.Configuration.resolve(spec.config || [], /* @__PURE__ */ new Map());
      let schema = config.schema;
      if (!schema) {
        if (spec.doc instanceof Plot.Doc) schema = spec.doc.schema;
        else throw new SchemaError(`No document plot provided, unable to create schema`);
      }
      let doc2 = readDoc(schema, spec.doc);
      let selection = !spec.selection ? cursorAtStart({ doc: doc2, config }) : typeof spec.selection == "function" ? spec.selection({ doc: doc2, config }) : spec.selection instanceof GardSelection ? spec.selection : GardSelection.Text.create(spec.selection);
      return _GardState.fromConfig(config, doc2, selection);
    }
    /// The current document.
    get doc() {
      if (this.trackAccess) addValue(this.trackAccess, "doc");
      return this._doc;
    }
    /// The document's schema.
    get schema() {
      if (this.trackAccess) addValue(this.trackAccess, "schema");
      return this._doc.schema;
    }
    /// The current selection.
    get selection() {
      if (this.trackAccess) addValue(this.trackAccess, "selection");
      return this._selection;
    }
    /// A resolved form of the state's selection. Instead of raw
    /// positions, this object holds {@link Pos document position}
    /// objects for `head`, `anchor`, `from`, and `to`.
    get sel() {
      return this.resolvedSel || (this.resolvedSel = this.selection.resolve(this.doc));
    }
    field(field, require2 = true) {
      let addr = this.config.address[field.id];
      if (addr == null) {
        if (require2) throw new RangeError("Field is not present in this state");
        return field instanceof _GardState.Field ? void 0 : field.value(this);
      }
      let track = this.trackAccess;
      if (track) {
        addValue(track, field);
        track = null;
      }
      ensureAddr(this, addr);
      if (track) this.trackAccess = track;
      return getAddr(this, addr);
    }
    /// Get the value of a state {@link GardState.Facet facet}.
    facet(facet) {
      if (this.trackAccess) addValue(this.trackAccess, facet);
      let addr = this.config.address[facet.id];
      if (addr == null) return facet.default;
      ensureAddr(this, addr);
      return getAddr(this, addr);
    }
    /// Create a {@link Transaction transaction} that updates this
    /// state.
    update(spec) {
      return resolveTransaction(this, spec);
    }
    /// @internal
    applyTransaction(tr) {
      let conf = this.config, { base, compartments } = conf;
      for (let effect of tr.effects) {
        if (effect.is(_GardState.Compartment.reconfigureCompartment)) {
          if (conf) {
            compartments = /* @__PURE__ */ new Map();
            conf.compartments.forEach((val, key) => compartments.set(key, val));
            conf = null;
          }
          compartments.set(effect.value.compartment, effect.value.extension);
        } else if (effect.is(_GardState.reconfigure)) {
          conf = null;
          base = effect.value;
        } else if (effect.is(_GardState.appendConfig)) {
          conf = null;
          base = asArray(base).concat(effect.value);
        }
      }
      let startValues, doc2 = tr.newDoc;
      if (!conf) {
        conf = _GardState.Configuration.resolve(base, compartments, this);
        let intermediateState = new _GardState(
          conf,
          this.doc,
          this.selection,
          conf.dynamicSlots.map(() => null),
          (state, slot) => slot.reconfigure(state, this),
          null
        );
        startValues = intermediateState.values;
        if (conf.staticFacet(_GardState.schemaElement) != this.facet(_GardState.schemaElement)) {
          let schema = conf.schema;
          if (schema) doc2 = schema.doc(doc2.content);
        }
      } else {
        startValues = tr.startState.values.slice();
      }
      new _GardState(conf, doc2, tr.newSelection, startValues, (state, slot) => slot.update(state, tr), tr);
    }
    /// @internal
    recordAccess(slots, f) {
      let prev = this.trackAccess;
      this.trackAccess = slots;
      let result = f(this);
      this.trackAccess = prev;
      return result;
    }
    /// Compute the textblock map for the given plot (which should be a
    /// textblock).
    textblockMap(node) {
      return TextblockMap.get(this, node.start, node.node);
    }
    // FIXME is this interface a good idea? Or should fields be able to
    // provide their own prop names?
    /// Convert this state to a JSON-serializable object. When custom
    /// fields should be serialized, you can pass them in as an object
    /// mapping property names (in the resulting object, which should
    /// not use `doc` or `selection`) to fields.
    toJSON(fields) {
      let result = {
        doc: this.doc.toJSON(),
        selection: this.selection.toJSON(this)
      };
      if (fields) for (let prop in fields) {
        let value = fields[prop];
        if (value instanceof _GardState.Field && this.config.address[value.id] != null)
          result[prop] = value.spec.toJSON(this.field(fields[prop]), this);
      }
      return result;
    }
    /// Deserialize a state from its JSON representation. When custom
    /// fields should be deserialized, pass the same object you passed
    /// to {@link GardState.toJSON `toJSON`} when serializing as third
    /// argument.
    static fromJSON(json, extensions, fields) {
      if (!json)
        throw new ValidationError("Invalid JSON representation for GardState");
      let fieldInit = [];
      if (fields) for (let prop in fields) {
        if (Object.prototype.hasOwnProperty.call(json, prop)) {
          let field = fields[prop], value = json[prop];
          fieldInit.push(field.init((state) => field.spec.fromJSON(value, state)));
        }
      }
      let config = _GardState.Configuration.create([extensions, fieldInit]);
      let schema = config.schema;
      if (!schema) throw new SchemaError("No document plot provided to GardState.fromJSON");
      let doc2 = schema.docFromJSON(json.doc);
      return _GardState.fromConfig(config, doc2, GardSelection.fromJSON({ config, doc: doc2 }, json.selection));
    }
    /// @internal
    static fromConfig(config, doc2, selection) {
      selection.check(config, doc2);
      return new _GardState(
        config,
        doc2,
        selection,
        config.dynamicSlots.map(() => null),
        (state, slot) => slot.create(state),
        null
      );
    }
    /// Returns true when the editor is {@link GardState.readOnly} to be
    /// read-only.
    get readOnly() {
      return this.facet(_GardState.readOnly);
    }
    /// Get the global text direction (true when left-to-right, false
    /// when right-to-left) for the document. Note that the direction of
    /// individual blocks can be overridden with {@link
    /// GardState.textblockLTR}.
    get textLTR() {
      return this.config.textLTR;
    }
    /// Return the text direction in a given textblock (by tag).
    textblockLTR(plot) {
      return this.config.textblockLTR(plot);
    }
    /// Tells you whether a node type is an atom (a leaf or a plot with
    /// an atomic shape).
    isAtom(type) {
      return this.config.isAtom(type);
    }
    /// Return the extent of the word around the given position, as a
    /// text selection.
    wordAt(pos, bias = 1) {
      return wordAt(this, pos, bias);
    }
  };
  /// This effect can be used to reconfigure the root extensions of
  /// the editor. Doing this will discard any extensions {@link
  /// GardState.appendConfig appended}, but does not reset the
  /// content of {@link GardState.Compartment.reconfigure
  /// reconfigured} compartments.
  __publicField(_GardState, "reconfigure", Transaction.Effect.define());
  /// Append extensions to the top-level configuration of the editor.
  __publicField(_GardState, "appendConfig", Transaction.Effect.define());
  var GardState = _GardState;
  ((GardState7) => {
    class Field {
      constructor(id, createF, updateF, compareF, spec) {
        __publicField(this, "id", id);
        __publicField(this, "createF", createF);
        __publicField(this, "updateF", updateF);
        __publicField(this, "compareF", compareF);
        __publicField(this, "spec", spec);
        /// @internal
        __publicField(this, "provides");
      }
      /// Define a state field.
      static define(config) {
        let field = new GardState7.Field(
          nextID++,
          config.create,
          config.update,
          config.compare || ((a, b) => a === b),
          config
        );
        if (config.provide) field.provides = config.provide(field);
        return field;
      }
      create(state) {
        let init = state.facet(initField).find((i) => i.field == this);
        return (init?.create || this.createF)(state);
      }
      /// @internal
      slot(addresses) {
        let idx = addresses[this.id] >> 1;
        return {
          create: (state) => {
            state.values[idx] = this.create(state);
            return 1 /* Changed */;
          },
          update: (state, tr) => {
            let oldVal = state.values[idx];
            let value = this.updateF(oldVal, tr);
            if (this.compareF(oldVal, value)) return 0;
            state.values[idx] = value;
            return 1 /* Changed */;
          },
          reconfigure: (state, oldState) => {
            if (oldState.config.address[this.id] != null) {
              state.values[idx] = oldState.field(this);
              return 0;
            }
            state.values[idx] = this.create(state);
            return 1 /* Changed */;
          }
        };
      }
      /// State field instances can be used as {@link
      /// GardState.Extension `Extension`} values to enable the field in
      /// a given state.
      get extension() {
        return this;
      }
      /// Returns an extension that enables this field and overrides the
      /// way it is initialized. Can be useful when you need to provide a
      /// non-default starting value for the field.
      init(create) {
        return [this, initField.of({ field: this, create })];
      }
    }
    GardState7.Field = Field;
    ((Field2) => {
      class Derived {
        constructor(value, compareF) {
          __publicField(this, "value", value);
          __publicField(this, "compareF", compareF);
          /// @internal
          __publicField(this, "id", nextID++);
          /// @internal
          __publicField(this, "dependencies", []);
        }
        /// Define a derived field.
        static define(compute, spec = {}) {
          return new Derived(compute, spec.compare || ((a, b) => a === b));
        }
        /// Derived fields must be included in your state configuration
        /// for them to be used.
        get extension() {
          return this;
        }
        /// @internal
        slot(addresses) {
          let idx = addresses[this.id] >> 1;
          let depSet = new DependencySet();
          return {
            create: (state) => {
              state.values[idx] = state.recordAccess(this.dependencies, this.value);
              return 1 /* Changed */;
            },
            update: (state, tr) => {
              depSet.update(this.dependencies, addresses);
              if (depSet.doc && tr.docChanged || depSet.sel && (tr.docChanged || tr.selection) || depSet.schema && tr.startState.schema != state.schema || ensureAll(state, depSet.addrs)) {
                let newVal = state.recordAccess(this.dependencies, this.value);
                if (!this.compareF(newVal, state.values[idx])) {
                  state.values[idx] = newVal;
                  return 1 /* Changed */;
                }
              }
              return 0;
            },
            reconfigure: (state, oldState) => {
              let newVal, oldAddr = oldState.config.address[this.id];
              if (oldAddr != null) {
                let oldVal = getAddr(oldState, oldAddr);
                if (this.dependencies.every((dep) => {
                  return dep instanceof GardState7.Facet ? oldState.facet(dep) === state.facet(dep) : dep instanceof GardState7.Field ? oldState.field(dep, false) == state.field(dep, false) : true;
                }) || this.compareF(newVal = state.recordAccess(this.dependencies, this.value), oldVal)) {
                  state.values[idx] = oldVal;
                  return 0;
                }
              } else {
                newVal = state.recordAccess(this.dependencies, this.value);
              }
              state.values[idx] = newVal;
              return 1 /* Changed */;
            }
          };
        }
      }
      Field2.Derived = Derived;
    })(Field = GardState7.Field || (GardState7.Field = {}));
    class Facet {
      constructor(combine, compareInput, compare, isStatic, enables) {
        __publicField(this, "combine", combine);
        __publicField(this, "compareInput", compareInput);
        __publicField(this, "compare", compare);
        __publicField(this, "isStatic", isStatic);
        /// @internal
        __publicField(this, "id", nextID++);
        /// The output of the facet when it has no inputs.
        __publicField(this, "default");
        /// @internal
        __publicField(this, "extensions");
        __publicField(this, "tag");
        this.default = combine(none3);
        this.extensions = typeof enables == "function" ? enables(this) : enables;
      }
      /// A facet reader for this facet, which can be used to {@link
      /// GardState.facet read} it but not to define values for it.
      get reader() {
        return this;
      }
      /// Defines a facet with the given input an output types.
      static define(config = {}) {
        return new GardState7.Facet(
          config.combine || ((a) => a),
          config.compareInput || ((a, b) => a === b),
          config.compare || (!config.combine ? sameArray : (a, b) => a === b),
          !!config.static,
          config.enables
        );
      }
      /// Returns an extension that provides the given value to this
      /// facet.
      of(value) {
        return new FacetProvider(this, nextID++, 1 /* Static */, value);
      }
      /// Create an extension that derives a value for the facet from a
      /// state. The given function should only depend on the state, not
      /// any external non-constant inputs. Its return value will be kept
      /// on state update, unless any of the fields or facets (including
      /// document and selection) that it read are changed by the update,
      /// in which case it is called again.
      ///
      /// In cases where your value depends only on a single field, you
      /// can use the {@link GardState.Facet.from `from`} method
      /// instead.
      derive(get) {
        if (this.isStatic) throw new Error("Can't derive a static facet");
        let field = Field.Derived.define(get, { compare: this.compareInput });
        return [field, new FacetProvider(this, field.id, 0 /* None */, null)];
      }
      /// Create an extension that derives zero or more values for this
      /// facet from a state.
      deriveN(get) {
        if (this.isStatic) throw new Error("Can't derive a static facet");
        let field = Field.Derived.define(get, { compare: (a, b) => compareArray(a, b, this.compareInput) });
        return [field, new FacetProvider(this, field.id, 2 /* Multi */, null)];
      }
      from(field, get) {
        if (this.isStatic) throw new Error("Can't derive a static facet");
        if (!get) return new FacetProvider(this, field.id, 0 /* None */, null);
        return this.derive((s) => get(s.field(field)));
      }
    }
    GardState7.Facet = Facet;
    ((Facet2) => {
      function combineConfig(configs, defaults, combine = {}) {
        let result = {};
        for (let config of configs) for (let key of Object.keys(config)) {
          let value = config[key], current = result[key];
          if (current === void 0) result[key] = value;
          else if (current === value || value === void 0) {
          } else if (Object.hasOwnProperty.call(combine, key)) result[key] = combine[key](current, value);
          else throw new Error("Config merge conflict for field " + key);
        }
        for (let key in defaults) if (result[key] === void 0) result[key] = defaults[key];
        return result;
      }
      Facet2.combineConfig = combineConfig;
    })(Facet = GardState7.Facet || (GardState7.Facet = {}));
    class Configuration {
      constructor(base, compartments, dynamicSlots, address, staticValues, facets) {
        __publicField(this, "base", base);
        __publicField(this, "compartments", compartments);
        __publicField(this, "dynamicSlots", dynamicSlots);
        __publicField(this, "address", address);
        __publicField(this, "staticValues", staticValues);
        __publicField(this, "facets", facets);
        /// @internal
        __publicField(this, "statusTemplate", []);
        while (this.statusTemplate.length < dynamicSlots.length)
          this.statusTemplate.push(0 /* Unresolved */);
      }
      /// Read the value of a static facet.
      staticFacet(facet) {
        if (!facet.isStatic) throw new Error("Only static facets can be accessed from a configuration");
        let addr = this.address[facet.id];
        return addr == null ? facet.default : this.staticValues[addr >> 1];
      }
      /// @internal
      static resolve(base, compartments, oldState) {
        let fields = [];
        let facets = /* @__PURE__ */ Object.create(null);
        let newCompartments = /* @__PURE__ */ new Map();
        for (let ext of flatten(base, compartments, newCompartments)) {
          if (ext instanceof FacetProvider) (facets[ext.facet.id] || (facets[ext.facet.id] = [])).push(ext);
          else fields.push(ext);
        }
        let address = /* @__PURE__ */ Object.create(null);
        let staticValues = [];
        let dynamicSlots = [];
        for (let field of fields) {
          address[field.id] = dynamicSlots.length << 1;
          dynamicSlots.push((a) => field.slot(a));
        }
        let oldFacets = oldState?.config.facets;
        for (let id in facets) {
          let providers = facets[id], facet = providers[0].facet;
          let oldProviders = oldFacets && oldFacets[id] || none3;
          if (providers.every((p) => p.flags & 1 /* Static */)) {
            address[facet.id] = staticValues.length << 1 | 1;
            if (sameArray(oldProviders, providers)) {
              staticValues.push(oldState.facet(facet));
            } else {
              let value = facet.combine(providers.map((p) => p.value));
              staticValues.push(oldState && facet.compare(value, oldState.facet(facet)) ? oldState.facet(facet) : value);
            }
          } else {
            for (let p of providers) {
              if (p.flags & 1 /* Static */) {
                address[p.id] = staticValues.length << 1 | 1;
                staticValues.push(p.value);
              }
            }
            address[facet.id] = dynamicSlots.length << 1;
            dynamicSlots.push((a) => dynamicFacetSlot(a, facet, providers));
          }
        }
        let dynamic = dynamicSlots.map((f) => f(address));
        return new GardState7.Configuration(base, newCompartments, dynamic, address, staticValues, facets);
      }
      /// Create a configuration from the given set of extensions.
      static create(extensions) {
        return GardState7.Configuration.resolve(extensions, /* @__PURE__ */ new Map());
      }
      /// Get the schema defined by this configuration. Will be null if
      /// the schema does not contain a document plot type.
      get schema() {
        let elts = this.staticFacet(GardState7.schemaElement);
        if (!elts.some((elt) => elt instanceof Plot.Type && elt.isDoc)) return null;
        return Schema.define(elts);
      }
      // Kludge to avoid cyclic dep with ./selection
      /// @internal
      get textLTR() {
        return this.staticFacet(GardState7.textLTR);
      }
      /// @internal
      textblockLTR(plot) {
        for (let f of this.staticFacet(GardState7.textblockLTR)) {
          let result = f(plot);
          if (result != null) return result;
        }
        return this.textLTR;
      }
      /// @internal
      get visualCursorMotion() {
        return this.staticFacet(GardState7.visualCursorMotion);
      }
      /// @internal
      isAtom(type) {
        return type.isLeaf || (this.staticFacet(GardState7.isAtom).get(type) ?? type.isAtom);
      }
    }
    GardState7.Configuration = Configuration;
    function flatten(extension, compartments, newCompartments) {
      let result = [[], [], [], [], []];
      let seen = /* @__PURE__ */ new Map();
      function inner(ext, prec2) {
        let known = seen.get(ext);
        if (known != null) {
          if (known <= prec2) return;
          let found = result[known].indexOf(ext);
          if (found > -1) result[known].splice(found, 1);
          if (ext instanceof CompartmentInstance) newCompartments.delete(ext.compartment);
        }
        seen.set(ext, prec2);
        if (Array.isArray(ext)) {
          for (let e of ext) inner(e, prec2);
        } else if (ext instanceof CompartmentInstance) {
          if (newCompartments.has(ext.compartment))
            throw new RangeError(`Duplicate use of compartment in extensions`);
          let content = compartments.get(ext.compartment) || ext.inner;
          newCompartments.set(ext.compartment, content);
          inner(content, prec2);
        } else if (ext instanceof PrecExtension) {
          inner(ext.inner, ext.prec);
        } else if (ext instanceof GardState7.Field) {
          result[prec2].push(ext);
          if (ext.provides) inner(ext.provides, prec2);
        } else if (ext instanceof GardState7.Field.Derived) {
          result[prec2].push(ext);
        } else if (ext instanceof FacetProvider) {
          result[prec2].push(ext);
          if (ext.facet.extensions) inner(ext.facet.extensions, 2 /* Default */);
        } else {
          let content = ext.extension;
          if (!content) throw new Error(`Unrecognized extension value in extension set (${ext}). This sometimes happens because multiple instances of wordgard/state are loaded, breaking instanceof checks.`);
          inner(content, prec2);
        }
      }
      inner(extension, 2 /* Default */);
      return result.reduce((a, b) => a.concat(b));
    }
    GardState7.prec = {
      /// The highest precedence level, for extensions that should end up
      /// near the start of the precedence ordering.
      highest: mkPrec(0 /* Highest */),
      /// A higher-than-default precedence, for extensions that should
      /// come before those with default precedence.
      high: mkPrec(1 /* High */),
      /// The default precedence, which is also used for extensions
      /// without an explicit precedence.
      default: mkPrec(2 /* Default */),
      /// A lower-than-default precedence.
      low: mkPrec(3 /* Low */),
      /// The lowest precedence level. Meant for things that should end up
      /// near the end of the extension order.
      lowest: mkPrec(4 /* Lowest */)
    };
    const _Compartment = class _Compartment {
      constructor() {
      }
      /// Define a new compartment.
      static define() {
        return new _Compartment();
      }
      /// Create an instance of this compartment to add to your {@link
      /// GardState.Spec.config state configuration}.
      of(ext) {
        return new CompartmentInstance(this, ext);
      }
      /// Create an {@link Transaction.Spec.effects effect} that
      /// reconfigures this compartment.
      reconfigure(content) {
        return GardState7.Compartment.reconfigureCompartment.of({ compartment: this, extension: content });
      }
      /// Get the current content of the compartment in the state, or
      /// `undefined` if it isn't present.
      get(state) {
        return state.config.compartments.get(this);
      }
    };
    /// @internal
    __publicField(_Compartment, "reconfigureCompartment", Transaction.Effect.define());
    let Compartment = _Compartment;
    GardState7.Compartment = _Compartment;
    GardState7.schemaElement = GardState7.Facet.define({
      combine: (values) => values.reduce((set, elt) => set.concat(elt), none3),
      static: true
    });
    GardState7.readOnly = GardState7.Facet.define({
      combine: (values) => values.length ? values[0] : false
    });
    GardState7.textLTR = GardState7.Facet.define({
      combine: (values) => values.length ? values[0] : true,
      static: true
    });
    GardState7.textblockLTR = GardState7.Facet.define({
      static: true
    });
    GardState7.visualCursorMotion = GardState7.Facet.define({
      combine(values) {
        return !values.length ? true : values[0];
      },
      static: true
    });
    GardState7.isAtom = GardState7.Facet.define({
      static: true,
      combine(inputs) {
        let map = /* @__PURE__ */ new Map();
        for (let i = inputs.length - 1; i >= 0; i--) map.set(inputs[i][0], inputs[i][1]);
        return map;
      }
    });
  })(GardState || (GardState = {}));
  var initField = GardState.Facet.define({ static: true });
  function addValue(set, value) {
    if (set.indexOf(value) < 0) set.push(value);
  }
  function mkPrec(value) {
    return (ext) => new PrecExtension(ext, value);
  }
  var PrecExtension = class {
    constructor(inner, prec) {
      __publicField(this, "inner", inner);
      __publicField(this, "prec", prec);
      __publicField(this, "extension");
    }
  };
  function sameArray(a, b) {
    return a == b || a.length == b.length && a.every((e, i) => e === b[i]);
  }
  var DependencySet = class {
    constructor() {
      __publicField(this, "doc", false);
      __publicField(this, "sel", false);
      __publicField(this, "schema", false);
      __publicField(this, "addrs", []);
      __publicField(this, "count", 0);
    }
    update(deps, addresses) {
      while (this.count < deps.length) {
        let dep = deps[this.count++];
        if (dep === "doc") this.doc = true;
        else if (dep === "selection") this.sel = true;
        else if (dep === "schema") this.schema = true;
        else if (((addresses[dep.id] ?? 1) & 1) == 0) this.addrs.push(addresses[dep.id]);
      }
    }
  };
  var FacetProvider = class {
    // Kludge to convince the type system these count as extensions
    constructor(facet, id, flags, value) {
      __publicField(this, "facet", facet);
      __publicField(this, "id", id);
      __publicField(this, "flags", flags);
      __publicField(this, "value", value);
      __publicField(this, "extension");
    }
  };
  function compareArray(a, b, compare) {
    if (a.length != b.length) return false;
    for (let i = 0; i < a.length; i++) if (!compare(a[i], b[i])) return false;
    return true;
  }
  function ensureAll(state, addrs) {
    let changed = false;
    for (let addr of addrs)
      if (ensureAddr(state, addr) & 1 /* Changed */) changed = true;
    return changed;
  }
  function dynamicFacetSlot(addresses, facet, providers) {
    let providerAddrs = providers.map((p) => addresses[p.id]);
    let dynamic = providerAddrs.filter((p) => !(p & 1));
    let idx = addresses[facet.id] >> 1;
    function get(state) {
      let values = [];
      for (let i = 0; i < providerAddrs.length; i++) {
        let value = getAddr(state, providerAddrs[i]);
        if (providers[i].flags & 2 /* Multi */) for (let val of value) values.push(val);
        else values.push(value);
      }
      return facet.combine(values);
    }
    return {
      create(state) {
        for (let addr of providerAddrs) ensureAddr(state, addr);
        state.values[idx] = get(state);
        return 1 /* Changed */;
      },
      update(state, tr) {
        if (!ensureAll(state, dynamic)) return 0;
        let value = get(state);
        if (facet.compare(value, state.values[idx])) return 0;
        state.values[idx] = value;
        return 1 /* Changed */;
      },
      reconfigure(state, oldState) {
        let depChanged = ensureAll(state, providerAddrs);
        let oldProviders = oldState.config.facets[facet.id], oldValue = oldState.facet(facet);
        if (oldProviders && !depChanged && sameArray(providers, oldProviders)) {
          state.values[idx] = oldValue;
          return 0;
        }
        let value = get(state);
        if (facet.compare(value, oldValue)) {
          state.values[idx] = oldValue;
          return 0;
        }
        state.values[idx] = value;
        return 1 /* Changed */;
      }
    };
  }
  function ensureAddr(state, addr) {
    if (addr & 1) return 2 /* Computed */;
    let idx = addr >> 1;
    let status = state.status[idx];
    if (status == 4 /* Computing */) throw new Error("Cyclic dependency between fields and/or facets");
    if (status & 2 /* Computed */) return status;
    state.status[idx] = 4 /* Computing */;
    let changed = state.computeSlot(state, state.config.dynamicSlots[idx]);
    return state.status[idx] = 2 /* Computed */ | changed;
  }
  function getAddr(state, addr) {
    return addr & 1 ? state.config.staticValues[addr >> 1] : state.values[addr >> 1];
  }
  var CompartmentInstance = class {
    constructor(compartment, inner) {
      __publicField(this, "compartment", compartment);
      __publicField(this, "inner", inner);
      __publicField(this, "extension");
    }
  };
  GardSelection.selectionType = GardState.Facet.define({
    combine(values) {
      let types2 = [GardSelection.Text.type, GardSelection.Node.type, ...values];
      for (let i = 0; i < types2.length; i++) for (let j = i + 1; j < types2.length; j++) {
        if (types2[i].tag == types2[j].tag) throw new Error("Duplicate selection JSON tag: " + types2[i].tag);
      }
      return types2;
    },
    static: true
  });
  Transaction.extender = GardState.Facet.define();
  Transaction.appender = GardState.Facet.define();

  // vendor/wordgard/src/state/correction.ts
  function scanChanges(changes, doc2, corrections2) {
    let buckets = [[], [], []], [childList, content, marks] = buckets;
    for (let c of corrections2) buckets[c.event].push(c);
    let plan = [];
    let queried = /* @__PURE__ */ new Set(), newNode = childList.concat(content);
    let updateWalker, { schema } = doc2;
    let checkMarks = (node, pos2, parent, index) => {
      for (let correction of marks) if (schema.matchNode(node.type, correction.query))
        plan.push({ node: Pos.Node.create(parent, node, pos2, index), correction });
    };
    if (marks.length) updateWalker = {
      enterPlot: checkMarks,
      skip(node, pos2, parent, index) {
        if (node.isText && !parent.node.content.includes(node)) {
          for (let off = parent.start, i = 0; ; i++) {
            let next = parent.node.content[i], end = off + next.length;
            if (end > pos2) {
              node = next;
              pos2 = off;
              break;
            }
            off = end;
          }
          if (queried.has(pos2)) return;
          queried.add(pos2);
        }
        checkMarks(node, pos2, parent, index);
      },
      leavePlot() {
      }
    };
    let changeWalker = {
      enterPlot(node, pos2, parent, index) {
        queried.add(pos2);
        this.skip(node, pos2, parent, index);
      },
      skip(node, pos2, parent, index) {
        if (node.isPlot) {
          for (let correction of newNode) if (schema.matchNode(node.type, correction.query))
            plan.push({ node: Pos.Plot.create(parent, node, pos2, index), correction });
        }
      },
      leavePlot() {
      }
    };
    let pos = doc2.resolve(0);
    for (let i = 0, { sections } = changes; i < sections.length; ) {
      let len = sections[i++], ins = sections[i++];
      if (ins == -1 || ins == -2 && !updateWalker) {
        if (i == sections.length) break;
        pos = pos.advance(len);
      } else if (ins == -2) {
        while (i < sections.length && sections[i + 1] == -2) {
          len += sections[i++];
          i++;
        }
        pos = pos.walk(len, updateWalker);
      } else {
        while (i < sections.length && sections[i + 1] >= 0) {
          len += sections[i++];
          ins += sections[i++];
        }
        let start = pos.pos, end = start + ins;
        for (let checkChildList = childList.length > 0, parent = pos.parent; ; ) {
          if (queried.has(parent.start - 1)) break;
          queried.add(parent.start - 1);
          if (checkChildList) {
            for (let correction of childList)
              if (schema.matchNode(parent.node.type, correction.query)) plan.push({ node: parent, correction });
            if (start >= parent.start && end <= parent.end) checkChildList = false;
          }
          for (let correction of content)
            if (schema.matchNode(parent.node.type, correction.query)) plan.push({ node: parent, correction });
          if (!parent.parent || !content.length && !checkChildList) break;
          parent = parent.parent;
        }
        pos = pos.walk(ins, changeWalker);
      }
    }
    return plan;
  }
  var corrections = GardState.Facet.define();
  var planCache = /* @__PURE__ */ new WeakMap();
  var Correction = class _Correction {
    constructor(event, query, correct) {
      __publicField(this, "event", event);
      __publicField(this, "query", query);
      __publicField(this, "correct", correct);
      /// To take effect, corrections must be included in an editor
      /// configuration.
      __publicField(this, "extension");
      this.extension = [
        corrections.of(this),
        Transaction.extender.of((tr) => this.extend(tr))
      ];
    }
    /// @internal
    extend(tr) {
      if (!tr.docChanged || tr.annotation(Transaction.remote)) return null;
      let plan = planCache.get(tr);
      if (!plan)
        planCache.set(tr, plan = scanChanges(tr.changes, tr.newDoc, tr.startState.facet(corrections)));
      let changes = [];
      for (let elt of plan) if (elt.correction == this) {
        let change = this.correct(elt.node);
        if (change) changes.push(change);
      }
      return changes.length ? { changes, sequential: true } : null;
    }
    /// This method can be used to run a correction agains all matching
    /// nodes in an existing document. If the correction makes any
    /// changes, the method returns a transaction with those changes.
    scan(state) {
      let changes = [];
      state.doc.iterate((node, pos) => {
        if (state.schema.matchNode(node.type, this.query) && (this.event == 2 /* Marks */ || node.isPlot)) {
          let change = this.correct(state.doc.resolveNode(pos));
          if (change) changes.push(change);
        }
      });
      if (changes.length) return state.update({ changes });
      return null;
    }
    /// Create a correction that runs whenever the child list of a node
    /// that matches the given query changes, or such a node is inserted
    /// into the document.
    static onChildList(query, correct) {
      return new _Correction(0 /* ChildList */, query, correct);
    }
    /// Create a correction that runs whenever any content inside a node
    /// that matches the given query changes, or such a node is inserted
    /// into the document.
    static onContent(query, correct) {
      return new _Correction(1 /* Content */, query, correct);
    }
    /// Define a correction that runs whenever the set of marks on a
    /// matching tag changes.
    static onMarks(query, correct) {
      return new _Correction(2 /* Marks */, query, correct);
    }
    /// Check the ranges touched by the given change set against the
    /// given list of corrections. Return a change set if any changes
    /// need to be made. (This isn't how you normally use corrections,
    /// but can be useful in a situation where you aren't working with
    /// an editor state transaction.)
    static check(changes, doc2, corrections2) {
      if (!corrections2.length || changes.empty) return null;
      let plan = scanChanges(changes, doc2, corrections2), changed = [];
      for (let c of corrections2) for (let elt of plan) if (elt.correction == c) {
        let change = c.correct(elt.node);
        if (change) changed.push(change);
      }
      return changed.length ? ChangeSet.create(doc2, changed) : null;
    }
  };

  // rich-text/wordgard-source/editor.ts
  var editor_exports = {};
  __export(editor_exports, {
    Decoration: () => Decoration,
    InputRule: () => InputRule,
    KeyBinding: () => KeyBinding,
    Widget: () => Widget,
    Wordgard: () => Wordgard,
    placeholder: () => placeholder
  });

  // node_modules/style-mod/src/style-mod.js
  var C = "\u037C";
  var COUNT = typeof Symbol == "undefined" ? "__" + C : Symbol.for(C);
  var SET = typeof Symbol == "undefined" ? "__styleSet" + Math.floor(Math.random() * 1e8) : /* @__PURE__ */ Symbol("styleSet");
  var top = typeof globalThis != "undefined" ? globalThis : typeof window != "undefined" ? window : {};
  var StyleModule = class {
    // :: (Object<Style>, ?{finish: ?(string) → string})
    // Create a style module from the given spec.
    //
    // When `finish` is given, it is called on regular (non-`@`)
    // selectors (after `&` expansion) to compute the final selector.
    constructor(spec, options) {
      this.rules = [];
      let { finish } = options || {};
      function splitSelector(selector) {
        return /^@/.test(selector) ? [selector] : selector.split(/,\s*/);
      }
      function render(selectors, spec2, target, isKeyframes) {
        let local = [], isAt = /^@(\w+)\b/.exec(selectors[0]), keyframes = isAt && isAt[1] == "keyframes";
        if (isAt && spec2 == null) return target.push(selectors[0] + ";");
        for (let prop in spec2) {
          let value = spec2[prop];
          if (/&/.test(prop)) {
            render(
              prop.split(/,\s*/).map((part) => selectors.map((sel) => part.replace(/&/, sel))).reduce((a, b) => a.concat(b)),
              value,
              target
            );
          } else if (value && typeof value == "object") {
            if (!isAt) throw new RangeError("The value of a property (" + prop + ") should be a primitive value.");
            render(splitSelector(prop), value, local, keyframes);
          } else if (value != null) {
            local.push(prop.replace(/_.*/, "").replace(/[A-Z]/g, (l) => "-" + l.toLowerCase()) + ": " + value + ";");
          }
        }
        if (local.length || keyframes) {
          target.push((finish && !isAt && !isKeyframes ? selectors.map(finish) : selectors).join(", ") + " {" + local.join(" ") + "}");
        }
      }
      for (let prop in spec) render(splitSelector(prop), spec[prop], this.rules);
    }
    // :: () → string
    // Returns a string containing the module's CSS rules.
    getRules() {
      return this.rules.join("\n");
    }
    // :: () → string
    // Generate a new unique CSS class name.
    static newName() {
      let id = top[COUNT] || 1;
      top[COUNT] = id + 1;
      return C + id.toString(36);
    }
    // :: (union<Document, ShadowRoot>, union<[StyleModule], StyleModule>, ?{nonce: ?string})
    //
    // Mount the given set of modules in the given DOM root, which ensures
    // that the CSS rules defined by the module are available in that
    // context.
    //
    // Rules are only added to the document once per root.
    //
    // Rule order will follow the order of the modules, so that rules from
    // modules later in the array take precedence of those from earlier
    // modules. If you call this function multiple times for the same root
    // in a way that changes the order of already mounted modules, the old
    // order will be changed.
    //
    // If a Content Security Policy nonce is provided, it is added to
    // the `<style>` tag generated by the library.
    static mount(root, modules, options) {
      let set = root[SET], nonce = options && options.nonce;
      if (!set) set = new StyleSet(root, nonce);
      else if (nonce) set.setNonce(nonce);
      set.mount(Array.isArray(modules) ? modules : [modules], root);
    }
  };
  var adoptedSet = /* @__PURE__ */ new Map();
  var StyleSet = class {
    constructor(root, nonce) {
      let doc2 = root.ownerDocument || root, win = doc2.defaultView;
      if (!root.head && root.adoptedStyleSheets && win.CSSStyleSheet) {
        let adopted = adoptedSet.get(doc2);
        if (adopted) return root[SET] = adopted;
        this.sheet = new win.CSSStyleSheet();
        adoptedSet.set(doc2, this);
      } else {
        this.styleTag = doc2.createElement("style");
        if (nonce) this.styleTag.setAttribute("nonce", nonce);
      }
      this.modules = [];
      root[SET] = this;
    }
    mount(modules, root) {
      let sheet = this.sheet;
      let pos = 0, j = 0;
      let changed = false;
      for (let i = 0; i < modules.length; i++) {
        let mod = modules[i], index = this.modules.indexOf(mod);
        if (index < j && index > -1) {
          this.modules.splice(index, 1);
          changed = true;
          j--;
          index = -1;
        }
        if (index == -1) {
          this.modules.splice(j++, 0, mod);
          changed = true;
          if (sheet) for (let k = 0; k < mod.rules.length; k++)
            sheet.insertRule(mod.rules[k], pos++);
        } else {
          while (j < index) pos += this.modules[j++].rules.length;
          pos += mod.rules.length;
          j++;
        }
      }
      if (sheet) {
        if (root.adoptedStyleSheets.indexOf(this.sheet) < 0)
          root.adoptedStyleSheets = [this.sheet, ...root.adoptedStyleSheets];
      } else {
        if (changed) {
          let text = "";
          for (let i = 0; i < this.modules.length; i++)
            text += this.modules[i].getRules() + "\n";
          this.styleTag.textContent = text;
        }
        let target = root.head || root;
        if (this.styleTag.parentNode != target)
          target.insertBefore(this.styleTag, target.firstChild);
      }
    }
    setNonce(nonce) {
      if (this.styleTag && this.styleTag.getAttribute("nonce") != nonce)
        this.styleTag.setAttribute("nonce", nonce);
    }
  };

  // rich-text/wordgard-source/set.ts
  var set_exports = {};
  __export(set_exports, {
    PointSet: () => PointSet,
    RangeSet: () => RangeSet,
    Set: () => Set2,
    findAbove: () => findAbove
  });

  // vendor/wordgard/src/set/set.ts
  var Set2 = class {
  };

  // vendor/wordgard/src/set/util.ts
  function findAbove(array, start, n) {
    let from = start, to = array.length;
    for (; ; ) {
      if (from == to) return from;
      let mid = from + to >> 1;
      if (array[mid] > n) to = mid;
      else from = mid + 1;
    }
  }
  function addReplacements(changes, replace) {
    let add = [], at = 0, len = changes.newLength;
    for (let repl of replace) {
      if (repl.from < at) throw new Error("Replacing ranges must be ordered and non-overlapping");
      if (repl.to > len) throw new Error("Replacing range out of bounds");
      if (repl.from > at) add.push(repl.from - at, -1);
      add.push(repl.to - repl.from, repl.to - repl.from);
      at = repl.to;
    }
    if (len > at) add.push(len - at, -1);
    return ChangeSet.composeSections(changes.sections, add);
  }

  // vendor/wordgard/src/set/heapcursor.ts
  function heapBubble(heap, index, cmp) {
    for (let cur = heap[index]; ; ) {
      let childIndex = (index << 1) + 1;
      if (childIndex >= heap.length) break;
      let child = heap[childIndex];
      if (childIndex + 1 < heap.length && cmp(child, heap[childIndex + 1]) >= 0) {
        child = heap[childIndex + 1];
        childIndex++;
      }
      if (cmp(cur, child) < 0) break;
      heap[childIndex] = cur;
      heap[index] = child;
      index = childIndex;
    }
  }
  function heapSink(heap, index, cmp) {
    let elt = heap[index];
    while (index > 0) {
      let parent = index - 1 >> 1;
      if (cmp(heap[parent], elt) < 0) break;
      heap[index] = heap[parent];
      heap[parent] = elt;
      index = parent;
    }
  }
  function heapPop(heap, cmp) {
    let last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      heapBubble(heap, 0, cmp);
    }
  }
  var HeapCursor = class {
    constructor(cmp, cursors) {
      __publicField(this, "cmp", cmp);
      __publicField(this, "cursors", cursors);
      __publicField(this, "heap", []);
      for (let cur of cursors) if (cur.value) {
        this.heap.push(cur);
        heapSink(this.heap, this.heap.length - 1, cmp);
      }
      this.fill();
    }
    fill() {
      if (this.heap.length) {
        ;
        ({ from: this.from, to: this.to, value: this.value } = this.heap[0]);
      } else {
        this.from = this.to = 1e9;
        this.value = null;
      }
    }
    goto(pos, side) {
      this.heap = [];
      for (let cur of this.cursors) {
        cur.goto(pos, side);
        if (cur.value) {
          this.heap.push(cur);
          heapSink(this.heap, this.heap.length - 1, this.cmp);
        }
      }
      this.fill();
    }
    next() {
      if (this.heap.length) {
        this.heap[0].next();
        if (this.heap[0].value) heapBubble(this.heap, 0, this.cmp);
        else heapPop(this.heap, this.cmp);
        this.fill();
      }
    }
    get set() {
      return this.heap.length ? this.heap[0].set : null;
    }
  };

  // vendor/wordgard/src/set/range.ts
  var Chunk = class _Chunk {
    constructor(start, from, to, value) {
      __publicField(this, "start", start);
      __publicField(this, "from", from);
      __publicField(this, "to", to);
      __publicField(this, "value", value);
    }
    get end() {
      return this.start + this.to[this.to.length - 1];
    }
    move(start) {
      return start == this.start ? this : new _Chunk(start, this.from, this.to, this.value);
    }
  };
  var SetBuilder = class _SetBuilder {
    constructor() {
      __publicField(this, "chunks", []);
      __publicField(this, "spilled", null);
      __publicField(this, "lastTo", -1);
      __publicField(this, "lastFrom", -1);
    }
    get next() {
      return this.spilled || (this.spilled = new _SetBuilder());
    }
    addChunk(chunk) {
      if (chunk.start < this.lastTo) {
        this.next.addChunk(chunk);
      } else {
        this.chunks.push(chunk);
        this.lastTo = chunk.end;
      }
    }
    add(source, pre) {
      if (typeof source != "function") {
        let array = source;
        source = (add) => {
          for (let [from, to, value] of array) add(from, to, value);
        };
      }
      source((value, from, to = from) => {
        if (pre) pre(from, to);
        this.addRange(value, from, to);
      });
    }
    addRange(value, from, to) {
      if (from >= to) throw new Error("Ranges cannot be empty");
      (this.lastTo <= from ? this : this.next).addInner(value, from, to);
    }
    addInner(value, from, to) {
      let chunk;
      if (this.chunks.length) {
        chunk = this.chunks[this.chunks.length - 1];
        if (chunk.value.length >= 512 /* Max */) chunk = void 0;
      }
      if (!chunk) {
        this.chunks.push(chunk = new Chunk(from, [], [], []));
      }
      chunk.from.push(from - chunk.start);
      chunk.to.push(to - chunk.start);
      chunk.value.push(value);
      this.lastFrom = from;
      this.lastTo = to;
    }
    finish(plus = null) {
      let next = this.spilled ? this.spilled.finish(plus) : plus;
      if (!this.chunks.length) return next || RangeSet.empty;
      return RangeSet.new(this.chunks, next);
    }
  };
  var _RangeSet = class _RangeSet extends Set2 {
    constructor(chunks, next) {
      super();
      __publicField(this, "chunks", chunks);
      __publicField(this, "next", next);
    }
    /// @internal
    static new(chunks, next) {
      return new _RangeSet(chunks, next);
    }
    /// Create a range set from an iterable of `[from, to, value]`
    /// tuples, or a function that calls its argument for every range to
    /// add.
    static create(source) {
      let build = new SetBuilder();
      build.add(source, (from) => {
        if (from < build.lastFrom) throw new Error("Ranges must be added in order");
      });
      return build.finish();
    }
    get length() {
      return Math.max(this.chunks.length ? this.chunks[this.chunks.length - 1].end : 0, this.next ? this.next.length : 0);
    }
    get empty() {
      return this == _RangeSet.empty;
    }
    cursor(from = 0) {
      if (!this.next) return new LayerCursor(this, this.chunks, from);
      let cursors = [];
      for (let layer = this; layer; layer = layer.next)
        cursors.push(new LayerCursor(this, layer.chunks, from));
      return new HeapCursor(cmpCursor, cursors);
    }
    /// Create a cursor over a collection of range sets.
    static cursor(sets, from = 0) {
      let cursors = [];
      for (let set of sets) if (!set.empty) {
        for (let layer = set; layer; layer = layer.next)
          cursors.push(new LayerCursor(set, layer.chunks, from));
      }
      return cursors.length == 0 ? _RangeSet.empty.cursor() : cursors.length == 1 ? cursors[0] : new HeapCursor(cmpCursor, cursors);
    }
    map(map, replace = []) {
      let { sections } = map;
      if (replace.length) sections = addReplacements(map, replace);
      else if (map.empty) return this;
      return this.mapInner(sections, map, replace);
    }
    mapInner(sections, map, replace) {
      let cursor = new LayerCursor(this, this.chunks, 0);
      let replI = 0, posA = 0, posB = 0;
      let build = new SetBuilder();
      for (let i = 0; i < sections.length; ) {
        let len = sections[i++], ins = sections[i++];
        if (ins < 0) {
          while (i < sections.length && sections[i + 1] < 0) {
            len += sections[i];
            i += 2;
          }
          let upto = i == sections.length ? 1e9 : posA + len, off = posB - posA;
          while (cursor.cur) {
            let chunk = cursor.cur;
            if (cursor.i == 0 && chunk.end < upto) {
              build.addChunk(chunk.move(chunk.start + off));
              cursor.next(true);
            } else if (cursor.to < upto) {
              build.addRange(cursor.value, cursor.from + off, cursor.to + off);
              cursor.next();
            } else {
              break;
            }
          }
          posB += len;
        } else {
          let replStartI = replI, endB = posB + ins;
          copyMappedUpto(cursor, posA, map, build, replace, replStartI);
          while (replI < replace.length && replace[replI].from < endB) {
            let repl = replace[replI++];
            if (repl.add) build.add(repl.add);
          }
          if (len) cursor.goto(posA + len - 1);
          copyMappedUpto(cursor, posA + len, map, build, replace, replStartI);
          posB = endB;
        }
        posA += len;
      }
      return build.finish(this.next && this.next.mapInner(sections, map, replace));
    }
    modify(spec) {
      let { replace, add, filter } = spec;
      let result = this;
      if (replace && replace.length) {
        result = result.map(ChangeSet.empty(Math.max(result.length, replace[replace.length - 1].to)), replace);
      }
      return add || filter ? result.modifyInner(add, filter) : result;
    }
    modifyInner(add, filter) {
      let build = new SetBuilder();
      let cursor = new LayerCursor(this, this.chunks, 0);
      let advance = (pos) => {
        for (; ; ) {
          let { cur } = cursor;
          if (!cur) return;
          if (cursor.i == 0 && cur.end <= pos && !filter) {
            build.addChunk(cur);
            cursor.next(true);
          } else if (cursor.from > pos) {
            break;
          } else {
            if (!filter || filter(cursor.value, cursor.from, cursor.to))
              build.addRange(cursor.value, cursor.from, cursor.to);
            cursor.next();
          }
        }
      };
      if (add) build.add(add, advance);
      advance(1e9);
      return build.finish(this.next && this.next.modifyInner(add, filter));
    }
    /// Compare a section of this set with a section of the same length
    /// in another set. Calls `change` for any range where the two do
    /// not contain identical ranges.
    compareRange(fromA, b, fromB, len, change) {
      if (this == b) return;
      let curA = new LayerCursor(this, this.chunks, fromA), curB = new LayerCursor(b, b.chunks, fromB), off = fromB - fromA;
      let end = fromB + len, startA = -1, endA = -1, startB = -1, endB = -1;
      for (; ; ) {
        if (startA >= endA)
          [startA, endA] = curA.value ? [Math.max(fromB, curA.from + off), Math.min(end, curA.to + off)] : [1e9, 1e9];
        if (startB >= endB)
          [startB, endB] = curB.value ? [Math.max(fromB, curB.from), Math.min(end, curB.to)] : [1e9, 1e9];
        let start = Math.min(startA, startB), upto;
        if (start >= end) break;
        if (startA < startB) {
          change(startA, upto = Math.min(endA, startB));
          startA = upto;
        } else if (startB < startA) {
          change(startB, upto = Math.min(endB, startA));
          startB = upto;
        } else if (curA.cur.value == curB.cur.value) {
          curA.next(true);
          curB.next(true);
          startA = startB = 1e9;
        } else {
          upto = Math.min(endA, endB);
          if (!curA.value.eq(curB.value)) change(startA, upto);
          startA = startB = upto;
        }
        if (startA >= endA) curA.next();
        if (startB >= endB) curB.next();
      }
      if (this.next || b.next)
        (this.next || _RangeSet.empty).compareRange(fromA, b.next || _RangeSet.empty, fromB, len, change);
    }
  };
  /// The empty range set.
  __publicField(_RangeSet, "empty", new _RangeSet([], null));
  var RangeSet = _RangeSet;
  function copyMappedUpto(cursor, upto, map, build, replace, replI) {
    while (cursor.value && cursor.from <= upto) {
      let value = cursor.value;
      let from = map.mapPos(cursor.from, value.inclusiveStart ? -1 : 1);
      let to = map.mapPos(cursor.to, value.inclusiveEnd ? 1 : -1);
      let filtered = from >= to;
      for (let i = replI; !filtered && i < replace.length && replace[i].from < to; i++) {
        if (replace[i].to > from) filtered = true;
      }
      if (!filtered) build.addRange(value, from, to);
      cursor.next();
    }
  }
  var LayerCursor = class {
    constructor(set, chunks, start) {
      __publicField(this, "set", set);
      __publicField(this, "chunks", chunks);
      __publicField(this, "chunkI", 0);
      __publicField(this, "i", 0);
      __publicField(this, "from", 0);
      this.goto(start);
    }
    goto(pos) {
      if (pos < this.from) this.chunkI = this.i = 0;
      else if (pos < this.to) return;
      let { chunks } = this;
      while (this.chunkI < chunks.length && chunks[this.chunkI].end <= pos) {
        this.chunkI++;
        this.i = 0;
      }
      if (this.chunkI == chunks.length) {
        this.i = 0;
        this.from = this.to = 1e9;
        this.cur = this.value = null;
      } else {
        let chunk = this.cur = chunks[this.chunkI];
        let i = this.i = findAbove(chunk.to, this.i, pos - chunk.start);
        this.from = chunk.from[i] + chunk.start;
        this.to = chunk.to[i] + chunk.start;
        this.value = chunk.value[i];
      }
    }
    next(chunk) {
      let { cur } = this;
      if (!cur) return;
      if (!chunk && this.i < cur.value.length - 1) {
        this.i++;
      } else {
        this.chunkI++;
        this.i = 0;
        if (this.chunkI == this.chunks.length) {
          this.from = this.to = 1e9;
          this.value = this.cur = null;
          return;
        } else {
          cur = this.cur = this.chunks[this.chunkI];
        }
      }
      this.from = cur.from[this.i] + cur.start;
      this.to = cur.to[this.i] + cur.start;
      this.value = cur.value[this.i];
    }
  };
  var cmpCursor = (a, b) => {
    return a.from - b.from || (a.value.inclusiveStart ? b.value.inclusiveStart ? 0 : 1 : -1) || a.to - b.to;
  };

  // vendor/wordgard/src/set/point.ts
  var Chunk2 = class _Chunk {
    constructor(start, pos, value) {
      __publicField(this, "start", start);
      __publicField(this, "pos", pos);
      __publicField(this, "value", value);
    }
    get end() {
      return this.start + this.pos[this.pos.length - 1];
    }
    get startSide() {
      return this.value[0].side;
    }
    get endSide() {
      return this.value[this.value.length - 1].side;
    }
    move(start) {
      return start == this.start ? this : new _Chunk(start, this.pos, this.value);
    }
  };
  var SetBuilder2 = class {
    constructor() {
      __publicField(this, "chunks", []);
      __publicField(this, "lastPos", -1);
      __publicField(this, "lastSide", -1);
    }
    addChunk(chunk) {
      this.chunks.push(chunk);
      this.lastPos = chunk.end;
      this.lastSide = chunk.endSide;
    }
    add(source, pre) {
      if (typeof source != "function") {
        let array = source;
        source = (add) => {
          for (let [value, from, to] of array) add(value, from, to);
        };
      }
      source((value, from, to) => {
        if (to != null && from != to) throw new Error("Points cannot cover content");
        if (pre) pre(value, from);
        this.addPoint(value, from);
      });
    }
    addPoint(value, pos) {
      let chunk;
      if (this.chunks.length) {
        chunk = this.chunks[this.chunks.length - 1];
        if (chunk.value.length >= 512 /* Max */) chunk = void 0;
      }
      if (!chunk) {
        this.chunks.push(chunk = new Chunk2(pos, [], []));
      }
      chunk.pos.push(pos - chunk.start);
      chunk.value.push(value);
      if ((pos - this.lastPos || value.side || this.lastSide) >= 0) {
        this.lastPos = pos;
        this.lastSide = value.side;
      } else {
        for (let i = chunk.value.length - 1, chunkI = this.chunks.length - 1; ; ) {
          let nextI = i - 1, nextChunk = chunk;
          if (nextI < 0) {
            if (!chunkI) break;
            nextChunk = this.chunks[--chunkI];
            nextI = nextChunk.value.length - 1;
          }
          if ((pos - nextChunk.pos[nextI] || value.side - nextChunk.value[nextI].side) >= 0) break;
          chunk.pos[i] = nextChunk.pos[nextI];
          chunk.value[i] = nextChunk.value[nextI];
          nextChunk.pos[nextI] = pos;
          nextChunk.value[nextI] = value;
          i = nextI;
          chunk = nextChunk;
        }
      }
    }
    finish() {
      return this.chunks.length ? PointSet.new(this.chunks) : PointSet.empty;
    }
  };
  var _PointSet = class _PointSet {
    constructor(chunks) {
      __publicField(this, "chunks", chunks);
    }
    /// @internal
    static new(chunks) {
      return new _PointSet(chunks);
    }
    /// Create a point set from an iterable of `[position, value]`
    /// tuples, or a function that calls its argument for every point to
    /// add.
    static create(source) {
      let build = new SetBuilder2();
      build.add(source, (value, from) => {
        if ((from - build.lastPos || value.side - build.lastSide) < 0)
          throw new Error("Points must be added in order");
      });
      return build.finish();
    }
    get length() {
      return this.chunks.length ? this.chunks[this.chunks.length - 1].end : 0;
    }
    get empty() {
      return this == _PointSet.empty;
    }
    /// Create a cursor over this point set, starting at the given
    /// position and side.
    cursor(from = 0, side = -1e9) {
      return new PointCursor(this, from, side);
    }
    /// Create a cursor over a collection of point sets.
    static cursor(sets, from = 0, side = -1e9) {
      let cursors = [];
      for (let set of sets) if (!set.empty) cursors.push(set.cursor(from, side));
      return cursors.length == 0 ? _PointSet.empty.cursor() : cursors.length == 1 ? cursors[0] : new HeapCursor(cmpCursor2, cursors);
    }
    /// Get the value at the given position, if any. If there's multiple
    /// values at that position, the one with the lowest side is
    /// returned. If a predicate is given, only points that satisfy it
    /// are returned.
    at(pos, pred) {
      for (let chunk of this.chunks) {
        if (chunk.start > pos) break;
        if (chunk.end < pos) continue;
        for (let index = findAbove(chunk.pos, 0, pos - chunk.start - 1); index < chunk.pos.length && chunk.pos[index] + chunk.start == pos; index++) {
          if (!pred || pred(chunk.value[index])) return chunk.value[index];
        }
      }
      return void 0;
    }
    /// Adjust the points for a set of document changes. Returns a new
    /// set with the adjusted points. May delete points when the content
    /// around them was deleted. Optionally accepts an ordered sequence
    /// of replacements.
    map(map, replace = []) {
      let { sections } = map;
      if (replace.length) sections = addReplacements(map, replace);
      else if (map.empty) return this;
      return this.mapInner(sections, map, replace);
    }
    mapInner(sections, map, replace) {
      let cursor = new PointCursor(this, 0, -1e9);
      let replI = 0, posA = 0, posB = 0;
      let build = new SetBuilder2();
      for (let i = 0; i < sections.length; ) {
        let len = sections[i++], ins = sections[i++];
        if (ins < 0) {
          while (i < sections.length && sections[i + 1] < 0) {
            len += sections[i];
            i += 2;
          }
          let upto = i == sections.length ? 1e9 : posA + len, off = posB - posA;
          while (cursor.cur) {
            let chunk = cursor.cur;
            if (cursor.i == 0 && chunk.end < upto) {
              build.addChunk(chunk.move(chunk.start + off));
              cursor.next(true);
            } else if (cursor.from < upto) {
              build.addPoint(cursor.value, cursor.from + off);
              cursor.next();
            } else {
              break;
            }
          }
          posB += len;
        } else {
          let replStartI = replI, endB = posB + ins;
          copyMappedUpto2(cursor, posA, map, build, replace, replStartI);
          while (replI < replace.length && replace[replI].from < endB) {
            let repl = replace[replI++];
            if (repl.add) build.add(repl.add);
          }
          if (len) cursor.goto(posA + len, -1e9);
          copyMappedUpto2(cursor, posA + len, map, build, replace, replStartI);
          posB = endB;
        }
        posA += len;
      }
      return build.finish();
    }
    modify(spec) {
      let { replace, add, filter } = spec;
      let result = this;
      if (replace && replace.length) {
        result = result.map(ChangeSet.empty(Math.max(result.length, replace[replace.length - 1].to)), replace);
      }
      return add || filter ? result.modifyInner(add, filter) : result;
    }
    modifyInner(add, filter) {
      let build = new SetBuilder2();
      let cursor = new PointCursor(this, 0, -1e9);
      let advance = (_, pos) => {
        for (; ; ) {
          let { cur } = cursor;
          if (!cur) return;
          if (cursor.i == 0 && cur.end <= pos && !filter) {
            build.addChunk(cur);
            cursor.next(true);
          } else if (cursor.from >= pos) {
            break;
          } else {
            if (!filter || filter(cursor.value, cursor.from, cursor.to))
              build.addPoint(cursor.value, cursor.from);
            cursor.next();
          }
        }
      };
      if (add) build.add(add, advance);
      advance(null, 1e9);
      return build.finish();
    }
    /// Compare a range in this set with a range in another set. Call
    /// `change` for every point that exists in one but not the other.
    compareRange(fromA, b, fromB, len, change) {
      if (this == b) return;
      let curA = new PointCursor(this, fromA, -1e9), curB = new PointCursor(b, fromB, -1e9);
      let off = fromB - fromA, endB = fromB + len;
      for (; ; ) {
        let nextA = curA.value ? curA.from + off : 1e9, nextB = curB.value ? curB.from : 1e9;
        if (Math.min(nextA, nextB) > endB) break;
        let cmp = nextA - nextB || curA.side - curB.side;
        if (cmp == 0 && curA.cur.value == curB.cur.value) {
          curA.next(true);
          curB.next(true);
        } else if (cmp == 0 && curA.value.eq(curB.value)) {
          curA.next();
          curB.next();
        } else if (cmp < 0) {
          change(nextA, curA.value);
          curA.next();
        } else {
          change(nextB, curB.value);
          curB.next();
        }
      }
    }
  };
  /// The empty point set.
  __publicField(_PointSet, "empty", new _PointSet([]));
  var PointSet = _PointSet;
  function copyMappedUpto2(cursor, upto, map, build, replace, replI) {
    while (cursor.value && cursor.from <= upto) {
      let value = cursor.value;
      let pos = map.mapPos(cursor.from, value.side < 0 ? -1 : 1, value.trackMode);
      if (pos != null) {
        let filtered = false;
        for (let i = replI; !filtered && i < replace.length && replace[i].from <= pos; i++) {
          if (replace[i].to >= pos) filtered = true;
        }
        if (!filtered) build.addPoint(value, pos);
      }
      cursor.next();
    }
  }
  var PointCursor = class {
    constructor(set, start, side) {
      __publicField(this, "set", set);
      __publicField(this, "chunkI", 0);
      __publicField(this, "i", 0);
      __publicField(this, "from", -1);
      this.goto(start, side);
    }
    /// @hidden
    get to() {
      return this.from;
    }
    get side() {
      return this.value ? this.value.side : 1e9;
    }
    goto(pos, side) {
      let diff = pos - this.from || side - this.side;
      if (diff < 0) {
        this.chunkI = this.i = 0;
      } else if (diff == 0 && this.cur) {
        for (; ; this.i--) {
          if (!this.i) {
            this.chunkI = 0;
            break;
          }
          if ((pos - this.cur.pos[this.i - 1] || side - this.cur.value[this.i - 1].side) < 0)
            break;
        }
      }
      for (let first = true; ; ) {
        if (this.chunkI == this.set.chunks.length) {
          this.from = 1e9;
          this.cur = this.value = null;
          break;
        }
        let chunk = this.set.chunks[this.chunkI];
        if (chunk.end < pos || this.i == chunk.value.length) {
          this.chunkI++;
          this.i = 0;
        } else if (first) {
          this.i = findAbove(chunk.pos, this.i, pos - chunk.start - 1);
          first = false;
        } else if ((pos - (chunk.start + chunk.pos[this.i]) || side - chunk.value[this.i].side) > 0) {
          this.i++;
        } else {
          this.cur = chunk;
          this.from = chunk.pos[this.i] + chunk.start;
          this.value = chunk.value[this.i];
          break;
        }
      }
    }
    next(chunk) {
      let { cur } = this;
      if (!cur) return;
      if (!chunk && this.i < cur.value.length - 1) {
        this.i++;
      } else {
        this.chunkI++;
        this.i = 0;
        if (this.chunkI == this.set.chunks.length) {
          this.value = this.cur = null;
          return;
        } else {
          cur = this.cur = this.set.chunks[this.chunkI];
        }
      }
      this.from = cur.pos[this.i] + cur.start;
      this.value = cur.value[this.i];
    }
  };
  function cmpCursor2(a, b) {
    return a.from - b.from || a.value.side - b.value.side;
  }

  // vendor/wordgard/src/editor/changes.ts
  function addUpdated(sections, updated) {
    let result = [];
    let j = 0, [uFrom, uTo] = updated.length ? [updated[j++], updated[j++]] : [1e9, 1e9];
    for (let i = 0, pos = 0; i < sections.length; ) {
      let len = sections[i++], ins = sections[i++];
      if (ins == -1) {
        let end = pos + len;
        while (uFrom < end) {
          if (uTo > pos) {
            if (uFrom > pos) addSection2(result, uFrom - pos, -1);
            addSection2(result, Math.min(uTo, end) - Math.max(pos, uFrom), -2);
            pos = uTo;
          }
          if (uTo >= end) break;
          if (j == updated.length) {
            uFrom = uTo = 1e9;
            break;
          }
          uFrom = updated[j++];
          uTo = updated[j++];
        }
        if (pos < end) addSection2(result, end - pos, -1);
        pos = end;
      } else {
        addSection2(result, len, ins);
        pos += len;
      }
    }
    return result;
  }
  function addSection2(sections, len, ins) {
    let last = sections.length - 1;
    if (last >= 0) {
      let lastIns = sections[last];
      if (lastIns >= 0 && ins >= 0) {
        sections[last - 1] += len;
        sections[last] += ins;
        return;
      }
      if (lastIns < 0 && lastIns == ins) {
        sections[last - 1] += len;
        return;
      }
    }
    sections.push(len, ins);
  }
  function separateChange(changes, fromB, toB) {
    let result = [];
    let lenI = 0, dLen = 0;
    for (let posB = 0, done = false, i = 0; i < changes.length; ) {
      let len = changes[i++], ins = changes[i++], endB = posB + (ins < 0 ? len : ins);
      if (fromB >= endB || toB <= posB) {
        result.push(len, ins);
      } else {
        if (ins >= 0) {
          if (posB < fromB || endB > toB) return null;
          dLen = len - ins;
        }
        if (posB < fromB) result.push(fromB - posB, ins);
        if (!done) {
          lenI = result.length;
          result.push(0, toB - fromB);
          done = true;
        }
        if (endB > toB) result.push(endB - toB, ins);
      }
      posB = endB;
    }
    result[lenI] = toB - fromB + dLen;
    return result;
  }
  function isEmpty(changes) {
    return changes.length == 0 || changes.length == 2 && changes[1] == -1;
  }
  function addRange(ranges, from, to) {
    let last;
    if (!ranges.length || (last = ranges[ranges.length - 1]) < from) {
      ranges.push(from, to);
    } else if (last == from) {
      ranges[ranges.length - 1] = to;
    } else {
      let i = findAbove(ranges, 0, from) & ~1, j = i;
      if (j && ranges[j - 1] == from) {
        j -= 2;
        from = ranges[j];
      }
      while (i < ranges.length && ranges[i] <= to) {
        from = Math.min(from, ranges[i++]);
        to = Math.max(to, ranges[i++]);
      }
      ranges.splice(j, i - j, from, to);
    }
  }
  function joinRanges(ranges) {
    if (ranges.length == 1) return ranges[0];
    let result = [], index = ranges.map(() => 0);
    for (; ; ) {
      let minI = -1, minFrom = -1;
      for (let i = 0; i < ranges.length; i++) {
        let idx2 = index[i], set2 = ranges[i];
        if (idx2 < set2.length && (minI < 0 || set2[idx2] < minFrom)) {
          minI = i;
          minFrom = set2[idx2];
        }
      }
      if (minI < 0) return result;
      let idx = index[minI], set = ranges[minI];
      addRange(result, set[idx], set[idx + 1]);
      index[minI] += 2;
    }
  }

  // vendor/wordgard/src/editor/decoration.ts
  var Widget = class _Widget {
    constructor(type, value) {
      __publicField(this, "value", value);
      /// This widget's type. The type mangling is a kludge to make sure
      /// `Widget<Param>` is a subtype of `Widget<unknown>`.
      __publicField(this, "type");
      this.type = type;
    }
    /// @internal
    static new(type, value) {
      return new _Widget(type, value);
    }
    /// Compare this widget to another widget object.
    eq(other) {
      return other instanceof _Widget && other.type == this.type && this.type.eq(this.value, other.value);
    }
    /// Define a widget type.
    static define(spec) {
      return _Widget.Type.new(spec);
    }
    /// Create a singleton widget.
    static create(spec) {
      return _Widget.Type.new(spec).of(null);
    }
    /// @internal
    render(wg) {
      return this.type.render(this.value, wg);
    }
    /// @internal
    get hasContent() {
      return false;
    }
  };
  ((Widget2) => {
    class Type {
      constructor(render, eq, propagateEvent, connect, disconnect, inFlow, editable) {
        __publicField(this, "render", render);
        __publicField(this, "eq", eq);
        __publicField(this, "propagateEvent", propagateEvent);
        __publicField(this, "connect", connect);
        __publicField(this, "disconnect", disconnect);
        __publicField(this, "inFlow", inFlow);
        __publicField(this, "editable", editable);
      }
      /// @internal
      static new(spec) {
        let prop = spec.propagateEvent;
        let propEvent = typeof prop == "function" ? prop : prop == null ? () => true : () => prop;
        return new Type(
          spec.render,
          spec.eq || ((a, b) => a === b),
          propEvent,
          spec.connect ?? null,
          spec.disconnect ?? null,
          spec.inFlow !== false,
          spec.editable === true
        );
      }
      /// Create an instance of this widget type.
      of(value) {
        return Widget2.new(this, value);
      }
    }
    Widget2.Type = Type;
    Widget2.text = Widget2.define({
      render: (s) => document.createTextNode(s)
    });
    Widget2.editableText = Widget2.define({
      render: (s) => document.createTextNode(s)
    });
    Widget2.img = Widget2.create({
      render() {
        let img2 = document.createElement("img");
        img2.className = "wg-buffer";
        return img2;
      },
      editable: true
    });
    Widget2.br = Widget2.create({
      render() {
        return document.createElement("br");
      },
      editable: true
    });
  })(Widget || (Widget = {}));
  var Decoration;
  ((Decoration3) => {
    let Tag;
    ((Tag2) => {
      function shape(type, shape2, config) {
        let tp = Node.Type.get(type);
        let shapeFunc = typeof shape2 == "function" ? memo((tag) => shape2(tag)) : () => shape2;
        let atom = typeof shape2 == "function" ? config?.atom : !shape2.hasContent;
        let ext = tagShape.of({ type: tp, shape: shapeFunc });
        if (tp.isPlot && atom != null) ext = [ext, GardState.isAtom.of([tp, atom])];
        return ext;
      }
      Tag2.shape = shape;
      ((shape2) => {
        function derived(type, shape3, config) {
          let tp = Node.Type.get(type);
          let ext = tagShape.derive((state) => {
            let s = shape3(state);
            return { type: tp, shape: typeof s == "function" ? memo(s) : () => s };
          });
          let atom = config?.atom;
          if (tp.isPlot && atom != null) ext = [ext, GardState.isAtom.of([tp, atom])];
          return ext;
        }
        shape2.derived = derived;
      })(shape = Tag2.shape || (Tag2.shape = {}));
      function wrapper(type, wrapper2, options) {
        if (!wrapper2.hasContent) throw new Error("Wrapper elements should have a content hole");
        return tagWrapper.of({
          type: Node.Type.get(type),
          elt: wrapper2,
          target: options && options.target ? Elt.Selector.parse(options.target) : null
        });
      }
      Tag2.wrapper = wrapper;
      function getPlace(place) {
        return place == "before" ? 0 /* Before */ : place == "after" ? 1 /* After */ : place == "end" ? 3 /* End */ : 2 /* Start */;
      }
      function widget(type, place, widget2) {
        return tagWidget.of({
          type: Node.Type.get(type),
          place: getPlace(place),
          widget: typeof widget2 == "function" ? memo(widget2) : widget2
        });
      }
      Tag2.widget = widget;
      ((widget2) => {
        function derived(type, place, widget3) {
          let tp = Node.Type.get(type);
          let p = getPlace(place);
          return tagWidget.derive((state) => {
            let w = widget3(state);
            return {
              type: tp,
              place: p,
              widget: typeof w == "function" ? memo(w) : w
            };
          });
        }
        widget2.derived = derived;
      })(widget = Tag2.widget || (Tag2.widget = {}));
      function attribute(type, attr, value, options) {
        let tp = Node.Type.get(type);
        return tagAttribute.of({
          type: tp,
          attr,
          value: typeof value == "string" ? () => value : value,
          target: options?.target ? Elt.Selector.parse(options.target) : null
        });
      }
      Tag2.attribute = attribute;
    })(Tag = Decoration3.Tag || (Decoration3.Tag = {}));
    let Mark8;
    ((Mark9) => {
      function shape(type, shape2) {
        if (type instanceof Mark) type = type.type;
        if (type.spanning && !("element" in shape2))
          throw new Error("Spanning marks must have an element shape");
        return markShape.of({ type, modified: Mark.Type.define(type.name, { ...type.spec, shape: shape2 }) });
      }
      Mark9.shape = shape;
    })(Mark8 = Decoration3.Mark || (Decoration3.Mark = {}));
    class Point {
      /// @internal
      constructor() {
      }
      /// Display a widget at this point.
      static widget(widget, options) {
        return new WidgetDecoration(widget, options?.side || 0, options && "trackMode" in options ? options.trackMode : "around");
      }
      /// Add a set of attributes to the node after this decoration's
      /// position.
      ///
      /// You can target a [specific
      /// element](#editor.Decoration.Tag.wrapper.options.target) in the
      /// node's representation with the `target` option.
      static attributes(attrs, options) {
        return new AttributeDecoration(Attributes.read(attrs), options?.target ? Elt.Selector.parse(options.target) : null);
      }
      /// Override the shape of the node after the decoration's point
      /// with the given one.
      static shape(shape) {
        return new ShapeDecoration(shape);
      }
      /// Wrap the node, or inner node selected with `target`, at the
      /// given position with a wrapper.
      static wrapper(wrapper, spec) {
        if (!wrapper.hasContent) throw new Error("Wrapper decoration elements must have a content hole");
        return new WrapperDecoration(wrapper, spec?.target ? Elt.Selector.parse(spec.target) : null);
      }
      /// Create a {@link PointSet} from an array or source function of
      /// point decorations.
      static set(source) {
        return PointSet.create(source);
      }
    }
    /// The facet used to register a point decoration source.
    /// Functions provided in this way will be called on every editor
    /// update, so computing the set on the fly will only perform well
    /// for very simple decoration sets, and you'll usually want to
    /// keep your set in a state field and update it incrementally.
    __publicField(Point, "source", GardState.Facet.define({
      combine: (sources) => sources.concat(nodeSelection)
    }));
    /// The empty set of point decorations.
    __publicField(Point, "none", PointSet.empty);
    Decoration3.Point = Point;
    class Range {
      /// @hidden
      constructor(spec) {
        /// @internal
        __publicField(this, "query");
        /// @internal
        __publicField(this, "scope");
        /// @internal
        __publicField(this, "inc");
        let { query, inclusive } = spec;
        this.query = query || null;
        this.scope = spec.scope == "inlineatom" ? 2 /* InlineAtom */ : spec.scope == "all" ? 4 /* All */ : 1 /* Atom */;
        this.inc = inclusive === "start" ? 1 /* Start */ : inclusive === "end" ? 2 /* End */ : inclusive ? 1 /* Start */ | 2 /* End */ : 0 /* None */;
      }
      get inclusiveStart() {
        return (this.inc & 1 /* Start */) > 0;
      }
      get inclusiveEnd() {
        return (this.inc & 2 /* End */) > 0;
      }
      /// Create a range decoration that wraps nodes in a range with
      /// an element, using the given tag name.
      static wrapper(tagName, spec) {
        return new WrapperRangeDecoration(tagName, spec);
      }
      /// Create a range decoration that adds an attribute to nodes in a
      /// range.
      static attribute(attr, value, options = {}) {
        return new AttributeRangeDecoration(attr, value, options);
      }
      /// Create a {@link RangeSet} from an array or source function of
      /// range decorations.
      static set(source) {
        return RangeSet.create(source);
      }
    }
    /// The facet used to register range decoration sources. The
    /// source function will be called on every update. Generating big
    /// range sets on the fly will not perform well, so you'll often
    /// want to store these in a state field.
    __publicField(Range, "source", GardState.Facet.define());
    /// The empty set of range decorations.
    __publicField(Range, "none", RangeSet.empty);
    Decoration3.Range = Range;
  })(Decoration || (Decoration = {}));
  var tagShape = GardState.Facet.define({
    combine: (shapes) => new Map(shapes.map((s) => [s.type, s.shape]).reverse())
  });
  var tagWrapper = GardState.Facet.define();
  var tagWidget = GardState.Facet.define();
  var tagAttribute = GardState.Facet.define();
  var markShape = GardState.Facet.define({
    combine: (shapes) => new Map(shapes.map((s) => [s.type, s.modified]).reverse())
  });
  function memo(f) {
    let map = /* @__PURE__ */ new WeakMap();
    return (arg) => {
      let found = map.get(arg);
      if (found === void 0) map.set(arg, found = f(arg));
      return found;
    };
  }
  function addMarkAttributes(overrides, shape, tag) {
    let attrs;
    for (let mark of tag.marks) {
      let type = overrides.get(mark.type) || mark.type;
      if (type.attribute && (mark.spanning || !tag.isText)) {
        let { get, target } = type.attribute;
        let markAttrs = get(mark.value);
        if (markAttrs.length) {
          if (target && shape instanceof Elt) shape = shape.addAttrs(markAttrs, target);
          else attrs = attrs ? Attributes.merge(attrs, markAttrs) : markAttrs;
        }
      }
    }
    return attrs ? addAttrs(shape, attrs, tag.type.isInline) : shape;
  }
  function addAttrs(shape, attrs, inline) {
    return shape instanceof Elt ? shape.addAttrs(attrs) : Elt.create(inline ? "span" : "div", attrs, [shape]);
  }
  function applyDeco(shape, deco, tag) {
    if (deco instanceof AttributeDecoration) {
      return deco.selector && shape instanceof Elt ? shape.addAttrs(deco.attrs, deco.selector) : addAttrs(shape, deco.attrs, tag.type.isInline);
    } else if (deco instanceof WrapperDecoration) {
      return deco.selector && shape instanceof Elt ? shape.wrap(deco.elt, deco.selector) : deco.elt.fill([shape]);
    }
    return shape;
  }
  var baseTagShape = memo((tag) => {
    return tag.is(Leaf.Text) ? Widget.editableText.of(tag.param) : tag.type.shape.create(tag.param);
  });
  function renderMarks(state, marks, around) {
    let markShapes = state.facet(markShape);
    let result = addMarkAttributes(markShapes, Elt.create("span", Attributes.none, [around]), Leaf.text(around, marks));
    for (let i = marks.length - 1; i >= 0; i--) {
      let mark = marks[i], shape = markShapes.get(mark.type);
      if (shape) mark = shape.of(mark.value);
      if (mark.type.element) result = renderMarkWrapper(mark).fill([result]);
    }
    return result.toDOM();
  }
  var AttributeRangeDecoration = class _AttributeRangeDecoration extends Decoration.Range {
    constructor(attribute, value, options) {
      super(options);
      __publicField(this, "attribute", attribute);
      __publicField(this, "value", value);
    }
    eq(other) {
      return this == other || other instanceof _AttributeRangeDecoration && other.attribute == this.attribute && other.value == this.value && other.inc == this.inc;
    }
  };
  var WrapperRangeDecoration = class _WrapperRangeDecoration extends Decoration.Range {
    constructor(element, spec) {
      super(spec);
      __publicField(this, "elt");
      __publicField(this, "rank");
      __publicField(this, "spanning");
      let { attributes } = spec;
      this.rank = Math.max(0, Math.min(spec.rank ?? 100));
      this.spanning = spec.spanning !== false;
      this.elt = Elt.create(element, attributes ? Attributes.read(attributes) : Attributes.none, Elt.hole);
    }
    eq(other) {
      return this == other || other instanceof _WrapperRangeDecoration && other.elt.eq(this.elt) && other.rank == this.rank && other.spanning == this.spanning && other.inc == this.inc;
    }
  };
  var ShapeDecoration = class _ShapeDecoration extends Decoration.Point {
    constructor(shape) {
      super();
      __publicField(this, "shape", shape);
    }
    eq(other) {
      return this == other || other instanceof _ShapeDecoration && other.shape.eq(this.shape);
    }
    get trackMode() {
      return "after";
    }
    get side() {
      return 1e9 /* After */;
    }
  };
  var WidgetDecoration = class _WidgetDecoration extends Decoration.Point {
    constructor(widget, side, trackMode) {
      super();
      __publicField(this, "widget", widget);
      __publicField(this, "side", side);
      __publicField(this, "trackMode", trackMode);
      if (side >= 1e9 /* After */) throw new Error("Invalid widget side");
    }
    eq(other) {
      return this == other || other instanceof _WidgetDecoration && other.widget.eq(this.widget) && other.side == this.side && other.trackMode == this.trackMode;
    }
  };
  function selectorEq(a, b) {
    return a ? !!b && a.eq(b) : !b;
  }
  var AttributeDecoration = class _AttributeDecoration extends Decoration.Point {
    constructor(attrs, selector) {
      super();
      __publicField(this, "attrs", attrs);
      __publicField(this, "selector", selector);
    }
    eq(other) {
      return this == other || other instanceof _AttributeDecoration && Attributes.eq(other.attrs, this.attrs) && selectorEq(other.selector, this.selector);
    }
    get trackMode() {
      return "after";
    }
    get side() {
      return 1e9 /* After */;
    }
  };
  var WrapperDecoration = class _WrapperDecoration extends Decoration.Point {
    constructor(elt, selector) {
      super();
      __publicField(this, "elt", elt);
      __publicField(this, "selector", selector);
    }
    eq(other) {
      return this == other || other instanceof _WrapperDecoration && other.elt.eq(this.elt) && selectorEq(other.selector, this.selector);
    }
    get trackMode() {
      return "after";
    }
    get side() {
      return 1e9 /* After */;
    }
  };
  var nodeSelectionDeco = Decoration.Point.attributes({ class: "wg-selected-node" });
  function nodeSelection(state) {
    if (state.selection instanceof GardSelection.Node)
      return PointSet.create([[nodeSelectionDeco, state.selection.from]]);
    return PointSet.empty;
  }
  var none4 = [];
  function getDecoSet(state) {
    let set = { points: /* @__PURE__ */ new Map(), ranges: /* @__PURE__ */ new Map() };
    for (let src of state.facet(Decoration.Point.source)) set.points.set(src, src(state));
    for (let src of state.facet(Decoration.Range.source)) set.ranges.set(src, src(state));
    return set;
  }
  function compareDecoSet(setA, setB, cmp) {
    for (let [srcA, valA] of setA) cmp(valA, setB.get(srcA) || null);
    for (let [srcB, valB] of setB) if (!setA.has(srcB)) cmp(null, valB);
  }
  var globalDecoFacets = [tagShape, tagWidget, tagWrapper, tagAttribute, markShape];
  function findChangedRanges(prevState, prevDeco, state, deco, sections) {
    let result = [];
    let globalChange = globalDecoFacets.some((facet) => prevState.facet(facet) !== state.facet(facet));
    for (let i = 0, posA = 0, posB = 0; i < sections.length; ) {
      let len = sections[i++], ins = sections[i++];
      if (ins == -1 && globalChange) {
        addSection2(result, len, -2);
      } else if (ins == -1) {
        let endB = posB + len;
        let cur = [], curPos = 0, ranges = [cur];
        let add = (from, to) => {
          if (from < curPos) {
            ranges.push(cur = []);
            curPos = 0;
          }
          addRange(cur, from, to);
          curPos = to;
        };
        compareDecoSet(prevDeco.ranges, deco.ranges, (a, b) => {
          (a || RangeSet.empty).compareRange(posA, b || RangeSet.empty, posB, len, add);
        });
        compareDecoSet(prevDeco.points, deco.points, (a, b) => {
          (a || PointSet.empty).compareRange(posA, b || PointSet.empty, posB, len, (pos2, val) => {
            add(pos2, Math.min(pos2 + (val instanceof WidgetDecoration ? 0 : 1), endB));
          });
        });
        let joined = joinRanges(ranges), pos = posB, end = pos + len, j = 0;
        if (joined.length && joined[0] == pos && joined[1] == pos && result.length && result[result.length - 1] != -1)
          j = 2;
        for (; j < joined.length; ) {
          let from = Math.max(pos, joined[j++]), to = Math.min(end, joined[j++]);
          if (from > pos) addSection2(result, from - pos, -1);
          if (from <= to) addSection2(result, to - from, -2);
          pos = to;
        }
        if (pos < end) addSection2(result, end - pos, -1);
        posA += len;
        posB = endB;
      } else {
        posA += len;
        posB += ins < 0 ? len : ins;
        if (ins >= 0 && result.length && result[result.length - 2] == 0 && result[result.length - 1] == -2) {
          result.pop();
          result.pop();
        }
        addSection2(result, len, ins);
      }
    }
    return result;
  }
  var SpanIterator = class {
    constructor(ranges, points, start, end) {
      __publicField(this, "ranges", ranges);
      __publicField(this, "points", points);
      __publicField(this, "end", end);
      __publicField(this, "active", []);
      __publicField(this, "activeEnd", []);
      __publicField(this, "from");
      __publicField(this, "to");
      __publicField(this, "point", null);
      __publicField(this, "pointSource", null);
      __publicField(this, "done", false);
      this.from = this.to = start;
    }
    next() {
      if (this.done) return this;
      if (this.point) this.point = null;
      let { ranges, points, active, activeEnd } = this;
      while (true) {
        let [startPos, startSide] = ranges.value ? [ranges.from, ranges.value.inclusiveStart ? -1 : 1] : [1e9, 0];
        let endPos = 1e9, endSide = 0, nextActive = -1;
        for (let i = 0; i < active.length; i++) {
          let pos = activeEnd[i], side = active[i].inclusiveEnd ? 1 : -1;
          if ((pos - endPos || side - endSide) < 0) {
            endPos = pos;
            endSide = side;
            nextActive = i;
          }
        }
        let [pointPos, pointSide] = points.value ? [points.from, points.value.side] : [1e9, 1];
        let nextPos = Math.min(startPos, endPos, pointPos);
        if (this.to == this.end && nextPos > this.to) {
          this.done = true;
          break;
        } else if (nextPos > this.to) {
          this.from = this.to;
          this.to = Math.min(this.end, nextPos);
          break;
        } else if (pointPos == nextPos && (startPos > pointPos || pointSide < 0) && (endPos > pointPos || pointSide < 0)) {
          this.point = this.points.value;
          this.pointSource = this.points.set;
          this.from = this.to = this.points.from;
          this.points.next();
          break;
        } else if ((startPos - endPos || startSide - endSide) < 0) {
          active.push(this.ranges.value);
          activeEnd.push(this.ranges.to);
          this.ranges.next();
        } else {
          active.splice(nextActive, 1);
          activeEnd.splice(nextActive, 1);
        }
      }
      return this;
    }
  };
  function tagScope(tag, atom) {
    return 4 /* All */ | (atom ? 1 /* Atom */ | (tag.type.isInline ? 2 /* InlineAtom */ : 0) : 0);
  }
  function renderWrapper(src) {
    if (src instanceof WrapperRangeDecoration) return src.elt;
    return renderMarkWrapper(src);
  }
  var renderMarkWrapper = memo((mark) => {
    let shape = mark.type.element;
    return Elt.create(shape.name, shape.attrs(mark.value), Elt.hole);
  });
  var DecoIterator = class {
    constructor(state, decoSet) {
      __publicField(this, "state", state);
      __publicField(this, "decoSet", decoSet);
      __publicField(this, "tagShapes");
      __publicField(this, "globalWidgets");
      __publicField(this, "globalWrappers");
      __publicField(this, "globalAttrs");
      __publicField(this, "markShapes");
      __publicField(this, "schema");
      __publicField(this, "pos");
      __publicField(this, "rangeCursor");
      __publicField(this, "pointSets");
      __publicField(this, "pointCursor");
      __publicField(this, "endWidgets");
      __publicField(this, "atomCache", /* @__PURE__ */ new Map());
      this.tagShapes = state.facet(tagShape);
      this.globalWidgets = state.facet(tagWidget);
      this.endWidgets = this.globalWidgets.some((w) => (w.place == 1 /* After */ || w.place == 3 /* End */) && typeof w.widget == "function");
      this.globalWrappers = state.facet(tagWrapper);
      this.globalAttrs = state.facet(tagAttribute);
      this.markShapes = state.facet(markShape);
      this.pos = state.doc.resolve(0);
      this.schema = state.schema;
      this.rangeCursor = RangeSet.cursor(state.facet(Decoration.Range.source).map((s) => s(state)));
      this.pointSets = state.facet(Decoration.Point.source).map((s) => s(state));
      this.pointCursor = PointSet.cursor(this.pointSets);
    }
    widgets(tag, place, walker) {
      if (place == 2 /* Start */ && tag.type.isInline)
        walker.widget(Widget.img, -1);
      for (let src of this.globalWidgets) {
        if (src.place == place && tag.type == src.type) {
          let widget = typeof src.widget == "function" ? src.widget(tag) : src.widget;
          if (widget) walker.widget(widget, place == 0 /* Before */ || place == 3 /* End */ ? 1 : -1);
        }
      }
      if (place == 3 /* End */ && tag.type.isInline)
        walker.widget(Widget.img, 1);
    }
    hasEndWidget(type) {
      return this.globalWidgets.some((tw) => tw.type == type && (tw.place == 3 /* End */ || tw.place == 1 /* After */) && typeof tw.widget == "function");
    }
    // Enumerate all wrapper elements for a given node. Spanning wrappers
    // are always moved to the front of the result. Within the
    // spanning/non-spanning wrappers, the ordering is determined by rank.
    //
    // Note that the return value contains range iterators, and those will
    // become invalid as soon as they are advanced further.
    nodeWrappers(tag, active, atom) {
      let wrappers;
      for (let mark of tag.marks) {
        let shape = this.markShapes.get(mark.type) || mark.type;
        if (shape.element) (wrappers || (wrappers = [])).push(shape == mark.type ? mark : shape.of(mark.value));
      }
      if (active.length) {
        for (let val of active) {
          if (val instanceof WrapperRangeDecoration && tagScope(tag, atom) & val.scope && (!val.query || this.schema.matchNode(tag.type, val.query)))
            (wrappers || (wrappers = [])).push(val);
        }
      }
      if (!wrappers) return none4;
      if (wrappers.length > 1) wrappers.sort((a, b) => (a.spanning == b.spanning ? 0 : a.spanning ? -1 : 1) || a.rank - b.rank);
      return wrappers;
    }
    walk(from, inclusiveStart, to, walker) {
      this.rangeCursor.goto(from);
      this.pointCursor.goto(from, inclusiveStart ? -1e9 : 1e9 /* After */);
      let iter = new SpanIterator(this.rangeCursor, this.pointCursor, from, to);
      let pos = this.pos.advance(from - this.pos.pos), started = inclusiveStart;
      let atomParent;
      for (let p = pos.parent; p; p = p.parent)
        if (!p.node.isDoc && (this.state.isAtom(p.node.type) || this.hasAtomShape(p.before))) atomParent = p;
      let pendingDeco = [], pendingPos = -1;
      let pendingShape = null, pendingShapeSet = null;
      let wrap = {
        skip: (node, pos2) => {
          if (started) this.widgets(node.tag, 0 /* Before */, walker);
          else started = true;
          let hasPending = pendingPos == pos2 && !node.isText;
          let shape = hasPending && pendingShape ? pendingShape.shape : this.tagShape(node.tag, iter.active);
          if (hasPending) for (let deco of pendingDeco) shape = applyDeco(shape, deco, node.tag);
          if (shape.hasContent) throw new Error("Leaf nodes shapes shouldn't have a content hole");
          walker.node(node, shape, this.nodeWrappers(node.tag, iter.active, true), void 0);
          this.widgets(node.tag, 1 /* After */, walker);
        },
        enterPlot: (node, pos2) => {
          if (started) this.widgets(node.tag, 0 /* Before */, walker);
          else started = true;
          let shape = pendingShape && pendingPos == pos2 ? pendingShape.shape : this.tagShape(node.tag, iter.active);
          if (pendingPos == pos2) for (let deco of pendingDeco) shape = applyDeco(shape, deco, node.tag);
          let wrappers = this.nodeWrappers(node.tag, iter.active, !shape.hasContent);
          let atom = !shape.hasContent;
          if (atom) walker.node(node, shape, wrappers, pos2 + node.length > to ? to - pos2 : void 0);
          else walker.enter(node, shape, wrappers);
          this.widgets(node.tag, 2 /* Start */, walker);
          return !atom;
        },
        leavePlot: (tag) => {
          if (started) this.widgets(tag, 3 /* End */, walker);
          else started = true;
          walker.leave();
          this.widgets(tag, 1 /* After */, walker);
        }
      };
      if (inclusiveStart) {
        let before = pos.nodeBefore;
        if (before) this.widgets(before.tag, 1 /* After */, walker);
        else this.widgets(pos.parent.node.tag, 2 /* Start */, walker);
      }
      for (; !iter.next().done; ) {
        if (atomParent) {
          let end = Math.min(to, atomParent.after), done = atomParent.after <= to;
          walker.nodePart(atomParent.node, end - pos.pos, done);
          pos = pos.advance(end - pos.pos);
          if (done) this.widgets(atomParent.node.tag, 1 /* After */, walker);
          atomParent = void 0;
          while (iter.point && iter.from < end) iter.next();
        } else if (iter.point) {
          let value = iter.point;
          if (value instanceof WidgetDecoration) {
            walker.widget(value.widget, value.side);
          } else {
            if (pendingPos < pos.pos) {
              pendingDeco.length = 0;
              pendingShape = null;
              pendingPos = pos.pos;
            }
            if (value instanceof ShapeDecoration && (!pendingShape || compareSetPrec(pendingShapeSet, iter.pointSource, this.pointSets))) {
              pendingShape = value;
              pendingShapeSet = iter.pointSource;
            } else {
              pendingDeco.push(value);
            }
          }
        } else {
          pos = pos.walk(iter.to - iter.from, wrap);
        }
      }
      if (pos.pos < to) pos = pos.walk(to - pos.pos, wrap);
      if (atomParent) {
        walker.nodePart(atomParent.node, 0, atomParent.after == to);
      } else {
        let after = pos.nodeAfter;
        if (after) this.widgets(after.tag, 0 /* Before */, walker);
        else this.widgets(pos.parent.node.tag, 3 /* End */, walker);
      }
      this.pos = pos;
    }
    tagShape(tag, active) {
      let override = this.tagShapes.get(tag.type);
      let shape = override ? override(tag) : baseTagShape(tag);
      if (tag.marks.length) shape = addMarkAttributes(this.markShapes, shape, tag);
      let add;
      for (let src of this.globalAttrs) if (tag.type == src.type) {
        if (src.target && shape instanceof Elt) shape = shape.addAttrs([src.attr, src.value(tag)], src.target);
        else Attributes.push(add || (add = []), src.attr, src.value(tag));
      }
      let scope = tagScope(tag, !shape.hasContent);
      for (let { type, elt, target } of this.globalWrappers) if (tag.type == type) {
        shape = target && shape instanceof Elt ? shape.wrap(elt, target) : elt.fill([shape]);
      }
      for (let deco of active) {
        if (deco instanceof AttributeRangeDecoration && scope & deco.scope && (!deco.query || this.schema.matchNode(tag.type, deco.query)))
          Attributes.push(add || (add = []), deco.attribute, deco.value);
      }
      if (add) {
        if (shape instanceof Elt) shape = Elt.create(shape.tagName, Attributes.merge(shape.attrs, add), shape.children);
        else shape = Elt.create(tag.type.isBlock ? "div" : "span", add, [shape]);
      }
      return shape;
    }
    hasAtomShape(pos) {
      let has = this.atomCache.get(pos);
      if (has == null) {
        has = this.pointSets.some((s) => s.at(pos, (d) => d instanceof ShapeDecoration && !d.shape.hasContent));
        this.atomCache.set(pos, has);
      }
      return has;
    }
  };
  function compareSetPrec(setA, setB, array) {
    if (setA != setB) for (let set of array) {
      if (set == setA) return -1;
      if (set == setB) return 1;
    }
    return 0;
  }

  // vendor/wordgard/src/editor/util.ts
  function eqArray2(a, b) {
    if (!a || !b) return a == b;
    if (a == b) return true;
    if (a.length != b.length) return false;
    for (let i = 0; i < a.length; i++) if (!a[i].eq(b[i])) return false;
    return true;
  }
  var exceptionSink = GardState.Facet.define();
  function logException(state, exception, context) {
    let handler = state.facet(exceptionSink);
    if (handler.length) handler[0](exception);
    else if (window.onerror) window.onerror(String(exception), context, void 0, void 0, exception);
    else if (context) console.error(context + ":", exception);
    else console.error(exception);
  }

  // vendor/wordgard/src/editor/dom.ts
  function getSelection(root) {
    let target;
    if (root.nodeType == 11) {
      target = root.getSelection ? root : root.ownerDocument;
    } else {
      target = root;
    }
    return target.getSelection();
  }
  function hasSelection(dom, selection) {
    if (!selection.focusNode) return false;
    try {
      return dom.contains(selection.focusNode);
    } catch (_) {
      return false;
    }
  }
  function isEquivalentPosition(node, off, targetNode, targetOff) {
    return targetNode ? scanFor(node, off, targetNode, targetOff, -1) || scanFor(node, off, targetNode, targetOff, 1) : false;
  }
  function domIndex(node) {
    for (var index = 0; ; index++) {
      node = node.previousSibling;
      if (!node) return index;
    }
  }
  function rmDOM(dom) {
    let next = dom.nextSibling;
    dom.remove();
    return next;
  }
  function isBlockElement(node) {
    let tile = node.wgTile;
    if (tile?.tag) return tile.tag.type.isBlock;
    return node.nodeType == 1 && /^(DIV|P|LI|UL|OL|BLOCKQUOTE|DD|DT|H\d|SECTION|PRE)$/.test(node.nodeName);
  }
  function isBlocking(node) {
    let tile = node.wgTile;
    if (tile) return !tile.isText && (tile.isNodeOuter || tile.isPoint && tile.flags & 96 /* PointSide */);
    return node.nodeType == 1 && node.contentEditable == "false";
  }
  function scanFor(node, off, targetNode, targetOff, dir) {
    for (; ; ) {
      if (node == targetNode && off == targetOff) return true;
      if (off == (dir < 0 ? 0 : maxOffset(node))) {
        if (isBlockElement(node)) return false;
        let parent = node.parentNode;
        if (!parent || parent.nodeType != 1) return false;
        off = domIndex(node) + (dir < 0 ? 0 : 1);
        node = parent;
      } else if (node.nodeType == 1) {
        node = node.childNodes[off + (dir < 0 ? -1 : 0)];
        if (isBlocking(node)) return false;
        off = dir < 0 ? maxOffset(node) : 0;
      } else {
        return false;
      }
    }
  }
  function maxOffset(node) {
    return node.nodeType == 3 ? node.nodeValue.length : node.childNodes.length;
  }
  function windowRect(win) {
    let vp = win.visualViewport;
    return new DOMRect(0, 0, vp ? vp.width : win.innerWidth, vp ? vp.height : win.innerHeight);
  }
  function getScale(elt, rect) {
    let scaleX = rect.width / elt.offsetWidth;
    let scaleY = rect.height / elt.offsetHeight;
    if (scaleX > 0.995 && scaleX < 1.005 || !isFinite(scaleX) || Math.abs(rect.width - elt.offsetWidth) < 1) scaleX = 1;
    if (scaleY > 0.995 && scaleY < 1.005 || !isFinite(scaleY) || Math.abs(rect.height - elt.offsetHeight) < 1) scaleY = 1;
    return { scaleX, scaleY };
  }
  function scrollRectIntoView(dom, rect, side, x, y, xMargin, yMargin, ltr) {
    let doc2 = dom.ownerDocument, win = doc2.defaultView || window;
    for (let cur = dom, stop = false; cur && !stop; ) {
      if (cur.nodeType == 1) {
        let bounding, top2 = cur == doc2.body;
        let scaleX = 1, scaleY = 1;
        if (top2) {
          bounding = windowRect(win);
        } else {
          if (/^(fixed|sticky)$/.test(getComputedStyle(cur).position)) stop = true;
          if (cur.scrollHeight <= cur.clientHeight && cur.scrollWidth <= cur.clientWidth) {
            cur = cur.assignedSlot || cur.parentNode;
            continue;
          }
          let rect2 = cur.getBoundingClientRect();
          ({ scaleX, scaleY } = getScale(cur, rect2));
          bounding = new DOMRect(rect2.left, rect2.top, cur.clientWidth * scaleX, cur.clientHeight * scaleY);
        }
        let moveX = 0, moveY = 0;
        if (y == "nearest") {
          if (rect.top < bounding.top) {
            moveY = -(bounding.top - rect.top + yMargin);
            if (side > 0 && rect.bottom > bounding.bottom + moveY)
              moveY = rect.bottom - bounding.bottom + moveY + yMargin;
          } else if (rect.bottom > bounding.bottom) {
            moveY = rect.bottom - bounding.bottom + yMargin;
            if (side < 0 && rect.top - moveY < bounding.top)
              moveY = -(bounding.top + moveY - rect.top + yMargin);
          }
        } else {
          let rectHeight = rect.bottom - rect.top, boundingHeight = bounding.bottom - bounding.top;
          let targetTop = y == "center" && rectHeight <= boundingHeight ? rect.top + rectHeight / 2 - boundingHeight / 2 : y == "start" || y == "center" && side < 0 ? rect.top - yMargin : rect.bottom - boundingHeight + yMargin;
          moveY = targetTop - bounding.top;
        }
        if (x == "nearest") {
          if (rect.left < bounding.left) {
            moveX = -(bounding.left - rect.left + xMargin);
            if (side > 0 && rect.right > bounding.right + moveX)
              moveX = rect.right - bounding.right + moveX + xMargin;
          } else if (rect.right > bounding.right) {
            moveX = rect.right - bounding.right + xMargin;
            if (side < 0 && rect.left < bounding.left + moveX)
              moveX = -(bounding.left + moveX - rect.left + xMargin);
          }
        } else {
          let targetLeft = x == "center" ? rect.left + (rect.right - rect.left) / 2 - (bounding.right - bounding.left) / 2 : x == "start" == ltr ? rect.left - xMargin : rect.right - (bounding.right - bounding.left) + xMargin;
          moveX = targetLeft - bounding.left;
        }
        if (moveX || moveY) {
          if (top2) {
            win.scrollBy(moveX, moveY);
          } else {
            let movedX = 0, movedY = 0;
            if (moveY) {
              let start = cur.scrollTop;
              cur.scrollTop += moveY / scaleY;
              movedY = (cur.scrollTop - start) * scaleY;
            }
            if (moveX) {
              let start = cur.scrollLeft;
              cur.scrollLeft += moveX / scaleX;
              movedX = (cur.scrollLeft - start) * scaleX;
            }
            rect = {
              left: rect.left - movedX,
              top: rect.top - movedY,
              right: rect.right - movedX,
              bottom: rect.bottom - movedY
            };
            if (movedX && Math.abs(movedX - moveX) < 1) x = "nearest";
            if (movedY && Math.abs(movedY - moveY) < 1) y = "nearest";
          }
        }
        if (top2) break;
        cur = cur.assignedSlot || cur.parentNode;
      } else if (cur.nodeType == 11) {
        cur = cur.host;
      } else {
        break;
      }
    }
  }
  function scrollableParents(dom) {
    let doc2 = dom.ownerDocument, x, y;
    for (let cur = dom.parentNode; cur; ) {
      if (cur == doc2.body || x && y) {
        break;
      } else if (cur.nodeType == 1) {
        if (!y && cur.scrollHeight > cur.clientHeight) y = cur;
        if (!x && cur.scrollWidth > cur.clientWidth) x = cur;
        cur = cur.assignedSlot || cur.parentNode;
      } else if (cur.nodeType == 11) {
        cur = cur.host;
      } else {
        break;
      }
    }
    return { x, y };
  }
  var DOMSelectionState = class {
    constructor() {
      __publicField(this, "anchorNode", null);
      __publicField(this, "anchorOffset", 0);
      __publicField(this, "focusNode", null);
      __publicField(this, "focusOffset", 0);
    }
    eq(domSel) {
      return this.anchorNode == domSel.anchorNode && this.anchorOffset == domSel.anchorOffset && this.focusNode == domSel.focusNode && this.focusOffset == domSel.focusOffset;
    }
    get empty() {
      return this.anchorNode == this.focusNode && this.anchorOffset == this.focusOffset;
    }
    setRange(range) {
      let { anchorNode, focusNode } = range;
      this.set(
        anchorNode,
        Math.min(range.anchorOffset, anchorNode ? maxOffset(anchorNode) : 0),
        focusNode,
        Math.min(range.focusOffset, focusNode ? maxOffset(focusNode) : 0)
      );
    }
    set(anchorNode, anchorOffset, focusNode, focusOffset) {
      this.anchorNode = anchorNode;
      this.anchorOffset = anchorOffset;
      this.focusNode = focusNode;
      this.focusOffset = focusOffset;
    }
  };
  var scratchRange;
  function textRange(node, from, to = from) {
    let range = scratchRange || (scratchRange = document.createRange());
    range.setEnd(node, to);
    range.setStart(node, from);
    return range;
  }
  function clearScratchRange() {
    if (scratchRange) {
      scratchRange.detach();
      scratchRange = null;
    }
  }
  function nonZero(rect) {
    return rect.top < rect.bottom || rect.left < rect.right;
  }
  function singleRect(target, bias, preferWide = false) {
    if (target.nodeType == 3)
      target = textRange(target, 0, target.nodeValue.length);
    let rects = target.getClientRects();
    for (let i = bias < 0 ? 0 : rects.length - 1; bias < 0 ? i < rects.length : i >= 0; i -= bias) {
      let rect = rects[i];
      if (nonZero(rect) && (!preferWide || rect.width)) return rect;
    }
    return Array.prototype.find.call(rects, nonZero) || target.getBoundingClientRect();
  }
  function getRoot(node) {
    while (node) {
      if (node && (node.nodeType == 9 || node.nodeType == 11 && node.host))
        return node;
      node = node.assignedSlot || node.parentNode;
    }
    return null;
  }
  function textNodeBefore(startNode, startOffset) {
    for (let node = startNode, offset = startOffset; ; ) {
      if (node.nodeType == 3 && offset > 0) {
        return node;
      } else if (node.nodeType == 1 && offset > 0) {
        if (node.contentEditable == "false") return null;
        node = node.childNodes[offset - 1];
        offset = maxOffset(node);
      } else if (node.parentNode && !isBlockElement(node)) {
        offset = domIndex(node);
        node = node.parentNode;
      } else {
        return null;
      }
    }
  }
  function textNodeAfter(startNode, startOffset) {
    for (let node = startNode, offset = startOffset; ; ) {
      if (node.nodeType == 3 && offset < node.nodeValue.length) {
        return node;
      } else if (node.nodeType == 1 && offset < node.childNodes.length) {
        if (node.contentEditable == "false") return null;
        node = node.childNodes[offset];
        offset = 0;
      } else if (node.parentNode && !isBlockElement(node)) {
        offset = domIndex(node) + 1;
        node = node.parentNode;
      } else {
        return null;
      }
    }
  }

  // vendor/wordgard/src/editor/tile.ts
  var LOG_update = false;
  var CoordPos = class _CoordPos {
    constructor(pos, target, side, vertOutside) {
      __publicField(this, "pos", pos);
      __publicField(this, "target", target);
      __publicField(this, "side", side);
      __publicField(this, "vertOutside", vertOutside);
    }
    map(mapping) {
      let target = this.target == null ? null : mapping.mapPos(this.target, 1, "after");
      return new _CoordPos(mapping.mapPos(this.pos), target, this.side, this.vertOutside);
    }
    static create(pos, side, target = null, vertOutside = false) {
      return new _CoordPos(pos, target, side, vertOutside);
    }
  };
  var TilePos = class {
    constructor(tile, offset, pos) {
      __publicField(this, "tile", tile);
      __publicField(this, "offset", offset);
      __publicField(this, "pos", pos);
    }
    get dom() {
      return this.tile.dom;
    }
  };
  var Tile2 = class {
    constructor(dom, flags) {
      __publicField(this, "dom", dom);
      __publicField(this, "parent", null);
      __publicField(this, "length", 0);
      __publicField(this, "flags");
      this.flags = flags & ~256 /* Synced */;
      dom.wgTile = this;
    }
    get isAtom() {
      return false;
    }
    get isNodeOuter() {
      return false;
    }
    get isNodeInner() {
      return (this.flags & 1 /* NodeInner */) > 0;
    }
    get isNode() {
      return this.isNodeOuter || (this.flags & 1 /* NodeInner */) > 0;
    }
    get isPlotContent() {
      return (this.flags & 2 /* PlotContent */) > 0;
    }
    get isText() {
      return false;
    }
    get isDoc() {
      return false;
    }
    get isWrapper() {
      return (this.flags & 8 /* Wrapper */) > 0;
    }
    get isSpanning() {
      return false;
    }
    get isComposition() {
      return (this.flags & 128 /* Composition */) > 0;
    }
    get isPoint() {
      return (this.flags & 16 /* Point */) > 0;
    }
    get tag() {
      return null;
    }
    posBeforeChild(child, ownStart = this.posAtStart) {
      for (let i = 0, pos = ownStart; ; i++) {
        let cur = this.children[i];
        if (cur == child) return pos;
        pos += cur.length;
      }
    }
    get posBefore() {
      return this.parent.posBeforeChild(this);
    }
    get posAtStart() {
      return this.parent ? this.parent.posBeforeChild(this) + this.boundary : 0;
    }
    get posAfter() {
      return this.posBefore + this.length;
    }
    get posAtEnd() {
      return this.posAtStart + this.length - 2 * this.boundary;
    }
    get boundary() {
      return 0;
    }
    get firstChild() {
      return this.children.length ? this.children[0] : null;
    }
    get lastChild() {
      let last = this.children.length - 1;
      return last < 0 ? null : this.children[last];
    }
    get nodeParent() {
      let tile = this;
      while (!tile.tag) tile = tile.parent;
      return tile;
    }
    ignoreEvent(event) {
      return false;
    }
    get ignoreMutations() {
      return false;
    }
    toString() {
      return this.dom.nodeName + (this.children.length ? `(${this.children})` : "");
    }
    connect() {
      for (let ch of this.children) ch.connect();
    }
    disconnect(reused) {
      if (!reused || reused.get(this) != 1 /* Full */)
        for (let ch of this.children) ch.disconnect(reused);
    }
    nearestNode() {
      let tile = this;
      while (!tile.tag) tile = tile.parent;
      return tile;
    }
    markDirty() {
      if (!(this.flags & 8192 /* Dirty */)) {
        this.flags |= 8192 /* Dirty */;
        this.parent?.markDirty();
      }
    }
    posAtCoords(state, x, y) {
      let nodeTile = this.nearestNode();
      return nodeTile.posAtCoordsInner(nodeTile.posAtStart, state, x, y, null, 1 /* Col */);
    }
    static get(node) {
      return node.wgTile;
    }
  };
  function checkSync(tile) {
    if (tile.flags & 256 /* Synced */ && !(tile.flags & 8192 /* Dirty */)) return false;
    tile.flags |= 256 /* Synced */;
    tile.flags &= ~8192 /* Dirty */;
    return true;
  }
  var CompositeTile = class extends Tile2 {
    constructor() {
      super(...arguments);
      __publicField(this, "children", []);
    }
    addChild(child) {
      if (this.flags & 256 /* Synced */) throw new Error("Cannot add to a synced tile");
      if (this.flags & 4096 /* ContentNotLast */ && !(child.flags & 2048 /* AfterContent */)) {
        let i = this.children.length;
        while (i > 0 && this.children[i - 1].flags & 2048 /* AfterContent */) i--;
        this.children.splice(i, 0, child);
      } else {
        this.children.push(child);
      }
      child.parent = this;
    }
    sync() {
      if (!checkSync(this)) return;
      let len = this.boundary * 2;
      for (let ch of this.children) {
        ch.sync();
        len += ch.length;
      }
      if (!(this.flags & 512 /* Atom */)) this.length = len;
      this.syncChildren();
    }
    syncChildren() {
      let prev = null, next = this.dom.firstChild;
      for (let child of this.children) {
        if (child.dom.parentNode == this.dom) {
          while (next && next != child.dom) next = rmDOM(next);
        } else {
          this.dom.insertBefore(child.dom, next);
        }
        prev = child.dom;
        next = prev.nextSibling;
      }
      while (next) next = rmDOM(next);
    }
    posAtCoordsInner(start, state, x, y, textblock, orientation) {
      let { tag } = this, outerOrientation = orientation;
      if (tag && tag.isPlot) {
        orientation = tag.type.orientation == "row" ? 0 /* Row */ : 1 /* Col */;
        if (tag.isTextblock) textblock = TextblockMap.get(state, start, start ? state.doc.plotAt(start - 1) : state.doc);
        else if (tag.type.isBlock) textblock = null;
      } else if (tag && tag.isText) {
        orientation = 0 /* Row */;
      }
      let result = this.isAtom || !this.children.length ? null : orientation == 1 /* Col */ ? this.posAtCoordsCol(start, state, x, y, textblock) : this.posAtCoordsRow(start, state, x, y, textblock);
      if (result) return result;
      let rect = this.dom.getBoundingClientRect();
      let after = outerOrientation == 0 /* Row */ ? x > (rect.left + rect.right) / 2 : y > (rect.top + rect.bottom) / 2;
      let target = this.tag && this.tag.type.isSelectable && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom ? start : null;
      return CoordPos.create(start + (after ? this.length - 2 * this.boundary : 0), after ? -1 : 1, target);
    }
    // FIXME adopt the binary search trick from CodeMirror
    posAtCoordsRow(start, state, x, y, textblock) {
      let result = rowScan(x, y, (add) => {
        for (let child of this.children) {
          if (child instanceof WidgetTile && !child.widget.type.inFlow) continue;
          let rects, { dom } = child;
          if (dom.nodeType == 1) rects = dom.getClientRects();
          else if (dom.nodeType == 3) rects = textRange(dom, 0, dom.nodeValue.length).getClientRects();
          else continue;
          for (let i = 0; i < rects.length; i++) if (add(rects[i], child)) return;
        }
      });
      if (!result) return null;
      let { closest, rect } = result;
      let pos = this.posBeforeChild(closest, start);
      if (textblock && textblock.start == start && (x < rect.left || x > rect.right)) {
        let start2 = x < rect.left == textblock.ltr;
        let span = start2 ? textblock.order[0] : textblock.order[textblock.order.length - 1];
        if (span.ltr != textblock.ltr && pos >= span.from + textblock.start && pos <= span.to + textblock.start)
          return start2 ? CoordPos.create(textblock.start, -1) : CoordPos.create(textblock.start + textblock.node.contentLength, 1);
      }
      if (closest.dom.nodeName == "BR") return CoordPos.create(pos, 1);
      if (closest.tag && closest.tag.isPlot && closest.tag.type.isInline) {
        if (x > rect.right) return CoordPos.create(pos + closest.length, -1);
        if (x < rect.left) return CoordPos.create(pos, 1);
      }
      return closest.posAtCoordsInner(
        pos + closest.boundary,
        state,
        x,
        Math.max(rect.top, Math.min(rect.bottom, y)),
        textblock,
        0 /* Row */
      );
    }
    posAtCoordsCol(start, state, x, y, textblock) {
      let lastBot = -1;
      for (let child of this.children) {
        if (child.isPoint || child.dom.nodeType != 1) continue;
        let rect = child.dom.getBoundingClientRect();
        if (rect.top > y) return CoordPos.create(this.posBeforeChild(child, start), y > (lastBot + rect.top) / 2 ? 1 : -1);
        if (rect.bottom >= y) return child.posAtCoordsInner(
          this.posBeforeChild(child, start) + child.boundary,
          state,
          x,
          y,
          textblock,
          1 /* Col */
        );
      }
      return CoordPos.create(start + this.length - 2 * this.boundary, -1);
    }
  };
  function rowScan(x, y, scan, depth2 = 0) {
    if (depth2 > 1) return null;
    let closest = null, closestDx = 1e8, closestRect = null;
    let above = null, below = null;
    scan((rect, value) => {
      if (rect.bottom < y) {
        if (!above || above.bottom < rect.bottom) above = rect;
      } else if (rect.top > y) {
        if (!below || below.top > rect.top) below = rect;
      } else {
        let dx = rect.left > x ? rect.left - x : rect.right < x ? x - rect.right : 0;
        if (dx < closestDx) {
          closest = value;
          closestDx = dx;
          closestRect = rect;
          return !dx;
        }
      }
      return false;
    });
    if (closestRect) {
      if (closestDx) {
        if (above && above.bottom > closestRect.top) return rowScan(x, above.bottom - 1, scan, depth2 + 1);
        if (below && below.top < closestRect.bottom) return rowScan(x, below.top + 1, scan, depth2 + 1);
      }
      return { closest, rect: closestRect };
    }
    let side = above && (!below || y - above.bottom < below.top - y) ? above : below;
    if (!side) return null;
    return rowScan(x, (side.top + side.bottom) / 2, scan, depth2 + 1);
  }
  function ltrAt(state, pos, assoc, textblock) {
    if (textblock === void 0) {
      let { textblockParent: block } = state.doc.resolve(pos);
      textblock = block ? TextblockMap.get(state, block.start, block.node) : null;
    }
    if (!textblock) return state.textLTR;
    let found = BidiSpan.find(textblock.order, textblock.toIndex(pos), assoc);
    return textblock.order[found].ltr;
  }
  var DocTile = class _DocTile extends CompositeTile {
    constructor(state, dom, cursorWrapper, decoSet) {
      super(dom, 2 /* PlotContent */);
      __publicField(this, "state", state);
      __publicField(this, "cursorWrapper", cursorWrapper);
      __publicField(this, "decoSet", decoSet);
    }
    static create(state, dom, wg) {
      return new _DocTile(state, dom, null, { points: /* @__PURE__ */ new Map(), ranges: /* @__PURE__ */ new Map() }).updateRanges(state, getDecoSet(state), [0, state.doc.length], wg);
    }
    get isDoc() {
      return true;
    }
    get tag() {
      return this.state.doc.tag;
    }
    update(state, changes, wg, composition) {
      let decoSet = getDecoSet(state);
      let changed = findChangedRanges(this.state, this.decoSet, state, decoSet, changes);
      return this.updateRanges(state, decoSet, changed, wg, composition);
    }
    updateRanges(state, decoSet, changes, wg, composition) {
      let wrapper = composition?.wrapCursor || null;
      if (isEmpty(changes) && eqArray2(wrapper, this.cursorWrapper))
        return this;
      LOG_update && console.log(`updateRanges(${state.doc},`, changes, ",", composition, ")");
      if (composition) {
        let separated = separateChange(changes, composition.fromB, composition.toB);
        LOG_update && !separated && console.log("separateComposition failed");
        if (!separated) composition = null;
        else changes = separated;
      }
      let builder = new ContentUpdate(state, this, wg, new DecoIterator(state, decoSet), wrapper);
      if (composition?.target && Tile2.get(composition.target))
        builder.reused.set(Tile2.get(composition.target), 2 /* DOM */);
      for (let i = 0, posB = 0, startCovered = false; i < changes.length; ) {
        let len = changes[i++], ins = changes[i++];
        LOG_update && console.log("section", len, ins, "new=" + builder.new, "old=" + builder.old.tile, "@", builder.old.index);
        if (composition && posB == composition.fromB && ins >= 0) {
          LOG_update && console.log("(composition)");
          if (!startCovered) builder.update(0, true);
          builder.composition(composition, len);
          if (ins && (startCovered = i == changes.length || changes[i + 1] == -1)) builder.update(0, true);
        } else if (ins == -1) {
          startCovered = builder.keep(len, !startCovered, i == changes.length);
        } else if (ins == -2) {
          builder.update(len, !startCovered);
          startCovered = true;
        } else {
          builder.replace(len, ins, !startCovered);
          startCovered = true;
        }
        posB += ins >= 0 ? ins : len;
      }
      let result = builder.finish();
      result.sync();
      if (wg.connected) {
        for (let ch of this.children) ch.disconnect(builder.reused);
        for (let tile of builder.toConnect) tile.widget.type.connect(tile.widget.value, tile.dom);
      }
      LOG_update && console.log("/updateRanges " + result + " : " + result.dom.innerHTML);
      return result;
    }
    nearest(dom, requireNode = false) {
      for (let cur = dom; cur; cur = cur.parentNode) {
        let elt = cur.wgTile;
        if (elt && (!requireNode || elt.tag) && this.owns(elt)) return elt;
      }
      return null;
    }
    owns(elt) {
      for (; ; ) {
        if (elt == this) return true;
        let { parent } = elt;
        if (!parent) return false;
        elt = parent;
      }
    }
    nodeTile(pos) {
      let off = 0, parent = this;
      search: for (; ; ) {
        for (let ch of parent.children) {
          let end = off + ch.length;
          if (pos < end) {
            if (off == pos && ch.tag || ch instanceof TextTile) return ch;
            parent = ch;
            off += ch.boundary;
            continue search;
          }
          off = end;
        }
        return null;
      }
    }
    resolve(pos, side = -1) {
      let parent = this, i = 0;
      search: for (let scan = this, off = 0; ; ) {
        for (let j = 0; j < scan.children.length && off <= pos; j++) {
          let ch = scan.children[j], end = off + ch.length;
          if (scan == parent) {
            if (off == pos) i = j;
            else if (pos == end) i = j + 1;
          }
          if (!ch.isPoint && ((ch.isPlotContent || ch.isNodeInner) && !ch.boundary ? pos >= off && pos <= end : pos > off && pos < end)) {
            if (ch instanceof TextTile) return new TilePos(ch, pos - off, pos);
            else if (ch.isAtom) {
              i = j;
              break search;
            }
            scan = ch;
            off += ch.boundary;
            if (ch.isPlotContent || ch.isWrapper) parent = ch;
            continue search;
          }
          off = end;
        }
        break;
      }
      adjust: for (; ; ) {
        if (i) {
          let before = parent.children[i - 1], parentBefore = parent, beforeI = i - 1;
          while (before.isWrapper) {
            parentBefore = before;
            before = before.children[beforeI = before.children.length - 1];
          }
          if (before.isNodeInner && before.flags & 2048 /* AfterContent */ || before.flags & 64 /* PointAfter */) {
            parent = parentBefore;
            i = beforeI;
            continue adjust;
          }
        }
        if (i < parent.children.length) {
          let after = parent.children[i], parentAfter = parent, afterI = i;
          while (after.isWrapper) {
            parentAfter = after;
            after = after.children[afterI = 0];
          }
          if (after.isNodeInner && !(after.flags & 2048 /* AfterContent */) || after.flags & 32 /* PointBefore */) {
            parent = parentAfter;
            i = afterI + 1;
            continue adjust;
          }
        }
        break;
      }
      if (side < 0) {
        while (!i && parent.isWrapper) {
          i = parent.parent.children.indexOf(parent);
          parent = parent.parent;
        }
        while (i) {
          let before = parent.children[i - 1];
          if (before.isPoint && !(before.flags & 96 /* PointSide */) && !before.isNodeInner) {
            i--;
          } else if (before.isWrapper) {
            parent = before;
            i = parent.children.length;
          } else {
            if (before instanceof TextTile) {
              parent = before;
              i = parent.length;
            }
            break;
          }
        }
      } else {
        while (parent.isWrapper && i == parent.children.length) {
          i = parent.parent.children.indexOf(parent) + 1;
          parent = parent.parent;
        }
        while (i < parent.children.length) {
          let after = parent.children[i];
          if (after.isPoint && !(after.flags & 96 /* PointSide */) && !after.isNodeInner) {
            i++;
          } else if (after.isWrapper) {
            parent = after;
            i = 0;
          } else {
            if (after instanceof TextTile) {
              parent = after;
              i = 0;
            }
            break;
          }
        }
      }
      return new TilePos(parent, i, pos);
    }
    posFromDOM(dom, offset, bias = -1) {
      let elt = this.nearest(dom);
      if (!elt)
        return this.dom.compareDocumentPosition(dom) & 4 ? this.length : 0;
      if (elt.isText) return elt.posAtStart + Math.min(offset, elt.length);
      if (elt.isAtom) return elt.posAtStart + (bias > 0 ? elt.length : 0);
      let domBefore, eltBefore;
      if (dom == elt.dom) {
        domBefore = dom.childNodes[offset - 1];
      } else {
        while (dom.parentNode != elt.dom) dom = dom.parentNode;
        domBefore = dom.previousSibling;
      }
      if (elt.tag && elt.tag.type.isInline && elt.tag.isPlot && (!domBefore || !domBefore.nextSibling))
        return domBefore ? elt.posAfter : elt.posBefore;
      while (domBefore && !((eltBefore = domBefore.wgTile) && eltBefore.parent == elt))
        domBefore = domBefore.previousSibling;
      return domBefore ? elt.posBeforeChild(eltBefore) + eltBefore.length : elt.posAtStart;
    }
    posBeforeDOM(dom) {
      let tile = this.nearest(dom);
      if (!tile) return null;
      let pos = tile.posAtStart;
      if (tile.dom != dom) for (let ch of tile.children) {
        if (ch.dom.compareDocumentPosition(dom) & 2) break;
        pos += ch.length;
      }
      return pos;
    }
    coordsForElement(pos) {
      let tile = this.nodeTile(pos);
      if (!tile) return null;
      if (tile instanceof TextTile) return textTileRect(tile, pos - tile.posBefore);
      return tile.dom.getBoundingClientRect();
    }
  };
  function textTileRect(tile, offset) {
    return textRange(tile.dom, offset, findClusterBreak(tile.text, offset)).getBoundingClientRect();
  }
  var EltTile = class _EltTile extends CompositeTile {
    constructor(elt, _tag, flags, length, dom) {
      super(dom, flags);
      __publicField(this, "elt", elt);
      __publicField(this, "_tag", _tag);
      this.length = length;
    }
    get isSpanning() {
      return (this.flags & 4 /* Spanning */) > 0;
    }
    get isNodeOuter() {
      return !!this.tag;
    }
    get isAtom() {
      return !!this._tag && (this.flags & 512 /* Atom */) > 0;
    }
    get boundary() {
      return this._tag && !(this.flags & 512 /* Atom */) ? 1 : 0;
    }
    get tag() {
      return this._tag;
    }
    get contentTile() {
      if (!(this.flags & 1024 /* HasContent */)) return null;
      for (let ch of this.children) if (ch.isNodeInner && ch.flags & 1024 /* HasContent */) return ch.contentTile;
      return this;
    }
    static of(elt, tag, flags, length, dom) {
      if (elt.hasContent) {
        flags |= 1024 /* HasContent */;
        if (elt.children.length > 1) {
          let zero = elt.children.indexOf(0);
          if (zero > -1 && zero < elt.children.length - 1) flags |= 4096 /* ContentNotLast */;
        }
      }
      return new _EltTile(elt, tag, flags, length, dom || elt.outerDOM());
    }
  };
  function setUneditable(dom) {
    if (dom.nodeType != 1) {
      let span = document.createElement("span");
      span.appendChild(dom);
      dom = span;
    }
    if (dom.contentEditable == "inherit" && !/^(br|hr|img|input|wbr)$/i.test(dom.nodeName))
      dom.contentEditable = "false";
  }
  var WidgetTile = class extends Tile2 {
    constructor(widget, _tag, flags, dom, length = 0) {
      super(dom, flags);
      __publicField(this, "widget", widget);
      __publicField(this, "_tag", _tag);
      this.length = length;
    }
    get isNodeOuter() {
      return !!this._tag;
    }
    get isAtom() {
      return true;
    }
    get tag() {
      return this._tag;
    }
    get children() {
      return noChildren2;
    }
    ignoreEvent(event) {
      return !this.widget.type.propagateEvent(event);
    }
    get ignoreMutations() {
      return !this.widget.type.editable;
    }
    sync() {
      checkSync(this);
    }
    connect() {
      this.widget.type.connect?.(this.widget.value, this.dom);
    }
    disconnect(reused) {
      if (!reused || reused.get(this) != 1 /* Full */)
        this.widget.type.disconnect?.(this.widget.value, this.dom);
    }
    toString() {
      return this.widget.type == Widget.editableText || this.widget.type == Widget.text ? JSON.stringify(this.widget.value) : super.toString();
    }
    posAtCoordsInner(start, state, x, y, textblock, orientation) {
      if (!this.tag) return CoordPos.create(start, 1);
      let rect = this.dom.nodeType == 1 ? this.dom.getBoundingClientRect() : textRange(this.dom, 0, this.length).getBoundingClientRect();
      let after = orientation == 1 /* Col */ ? y > (rect.top + rect.bottom) / 2 : x < (rect.left + rect.right) / 2 == ltrAt(state, start, 1, textblock);
      return after ? CoordPos.create(start + this.length - 2 * this.boundary, -1, start) : CoordPos.create(start, 1, start);
    }
  };
  var TextTile = class _TextTile extends Tile2 {
    constructor(text, dom, flags = 0 /* None */) {
      super(dom, flags);
      __publicField(this, "text", text);
      this.length = text.length;
    }
    get children() {
      return noChildren2;
    }
    get isText() {
      return true;
    }
    get isNodeOuter() {
      return true;
    }
    get isAtom() {
      return true;
    }
    sync() {
      if (!checkSync(this)) return;
      if (this.dom.nodeValue != this.text) this.dom.nodeValue = this.text;
    }
    toString() {
      return JSON.stringify(this.text);
    }
    posAtCoordsInner(start, state, x, y, textblock, orientation) {
      let { closest, rect } = rowScan(x, y, (add) => {
        for (let i = 0; i < this.length; ) {
          let end = findClusterBreak(this.text, i);
          let rect2 = singleRect(textRange(this.dom, i, end), 1, true);
          if (rect2.top == rect2.bottom) continue;
          if (add(rect2, i)) break;
          i = end;
        }
      });
      let pos = start + closest;
      let after = x > (rect.left + rect.right) / 2 == ltrAt(state, pos, 1, textblock);
      if (after) return CoordPos.create(start + findClusterBreak(this.text, closest), -1);
      else return CoordPos.create(pos, 1);
    }
    static of(text) {
      return new _TextTile(text, document.createTextNode(text));
    }
  };
  var noChildren2 = [];
  var TilePointer = class _TilePointer {
    // In most tiles, index is a child position. In text nodes, it is a
    // character offset, and in atoms (with length > 1), a position
    // offset.
    constructor(tile, index, parent) {
      __publicField(this, "tile", tile);
      __publicField(this, "index", index);
      __publicField(this, "parent", parent);
    }
    walk(dist2, side, walker) {
      let { tile, index, parent } = this, nodeBoundary = 0;
      for (; ; ) {
        if (!dist2 && side < 0 && !nodeBoundary) break;
        if (tile.isAtom) {
          if (!dist2) break;
          nodeBoundary = 0;
          let left = tile.length - index;
          if (dist2 >= left) {
            dist2 -= left;
            if (left && walker) walker.skip(tile, index, tile.length);
            ({ tile, index, parent } = parent);
            index++;
          } else {
            if (walker) walker.skip(tile, index, index + dist2);
            index += dist2;
            dist2 = 0;
          }
        } else if (index == tile.children.length) {
          if (!dist2 && (tile.isDoc || nodeBoundary != 2 && tile.isNode)) break;
          if (walker) walker.leave(tile);
          nodeBoundary = tile.isNodeInner ? 2 : 0;
          dist2 -= tile.boundary;
          ({ tile, index, parent } = parent);
          index++;
        } else {
          let next = tile.children[index];
          if (nodeBoundary == 1 && !next.isNodeInner) {
            nodeBoundary = 0;
            if (side < 0 && !dist2) break;
          }
          if (!dist2 && next.isNodeInner && !nodeBoundary) break;
          if (next.length < dist2 || next.length == dist2 && (next.isPoint || next.boundary)) {
            if (walker) walker.skip(next, 0, next.length);
            dist2 -= next.length;
            index++;
            if (!next.isNodeInner) nodeBoundary = 0;
          } else {
            if (next.isNodeOuter && !dist2) break;
            if (walker && !next.isAtom) walker.enter(next);
            dist2 -= next.boundary;
            parent = tile == this.tile && index == this.index ? this : new _TilePointer(tile, index, parent);
            tile = next;
            index = 0;
            nodeBoundary = next.isNode ? 1 : 0;
          }
        }
      }
      return tile == this.tile && index == this.index ? this : new _TilePointer(tile, index, parent);
    }
    tileAfter() {
      let { tile, index } = this;
      if (tile.isAtom) return tile;
      return index < tile.children.length ? tile.children[index] : null;
    }
    matchingWrapper(elt, spanning, reused) {
      let best, bestScore = 0;
      let start = this.tile.isText ? this.parent : this;
      for (let { tile, parent } = start; !(tile.isNode || tile.isDoc); { tile, parent } = parent) {
        let wrap = tile;
        if (reused.has(wrap) || wrap.elt.tagName != elt.tagName || wrap.isSpanning != spanning) continue;
        let score = Attributes.compare(wrap.elt.attrs, elt.attrs);
        if (!best || bestScore < score) {
          best = wrap;
          bestScore = score;
        }
      }
      if (!best) return null;
      if (bestScore < 0) updateAttributes(best.dom, best.elt.attrs, elt.attrs);
      reused.set(best, 2 /* DOM */);
      return best.dom;
    }
    matchingWidget(widget, sideFlag, reused) {
      let { index, tile, parent } = this;
      if (!tile.isAtom) for (; ; ) {
        if (!index) {
          if (!parent || (tile instanceof EltTile ? tile.tag : !(tile instanceof TextTile))) break;
          ({ index, tile, parent } = parent);
        } else {
          if (tile instanceof TextTile) break;
          let before = tile.children[--index];
          if (!before.isPoint) break;
          if (!reused.has(before) && before instanceof WidgetTile && before.widget.eq(widget) && (before.flags & 96 /* PointSide */) == sideFlag && !(before.flags & 8192 /* Dirty */)) {
            reused.set(before, 1 /* Full */);
            return before;
          }
        }
      }
      return null;
    }
  };
  var ContentUpdate = class {
    constructor(state, old, wg, deco, cursorWrapper) {
      __publicField(this, "state", state);
      __publicField(this, "wg", wg);
      __publicField(this, "deco", deco);
      __publicField(this, "old");
      __publicField(this, "new");
      // Current position in the new document
      __publicField(this, "posB", 0);
      __publicField(this, "reused", /* @__PURE__ */ new Map());
      __publicField(this, "keepWalker");
      __publicField(this, "toConnect", []);
      __publicField(this, "partialNode", null);
      this.old = new TilePointer(old, 0, null);
      this.new = new DocTile(state, old.dom, cursorWrapper, deco.decoSet);
      this.keepWalker = {
        enter: (tile) => {
          let span = tile.isSpanning && this.enterSpanning(tile.elt);
          if (span) {
            this.new = span;
          } else if (!tile.isNodeInner) {
            let copy2 = this.copyEltStructure(tile);
            this.new.addChild(copy2);
            this.new = copy2.contentTile;
          }
        },
        leave: (tile) => {
          if (tile.isWrapper) {
            for (let scan = this.new, i = 0; ; ) {
              if (!scan.isWrapper) break;
              if (scan.elt.eq(tile.elt) && scan.isSpanning == tile.isSpanning) {
                for (let j = 0; j <= i; j++) this.up();
                break;
              }
              if (!scan.parent) break;
              scan = scan.parent;
            }
          } else if (tile.isNodeOuter) {
            this.leaveNode();
            this.leaveWrappers();
          }
        },
        skip: (tile, from, to) => {
          if (tile.isNodeInner) {
          } else if (!(tile instanceof TextTile)) {
            if (!from && to == tile.length) {
              this.reused.set(tile, 1 /* Full */);
              this.new.addChild(tile);
            } else if (from == 0) {
              let wrappers = 0;
              for (let w = this.new; w && w.isWrapper; w = w.parent) wrappers++;
              let shape = tile instanceof EltTile ? tile.elt : tile instanceof WidgetTile ? tile.widget : null;
              if (!shape || !tile.tag) throw new Error("Unexpected atom tile");
              this.partialNode = { tag: tile.tag, length: to - from, reuse: tile, shape, wrappers };
            } else {
              if (!this.partialNode) throw new Error("Missing partial node");
              if (to == tile.length) {
                let { tag, length, shape, reuse } = this.partialNode;
                this.partialNode = null;
                this.new.addChild(this.buildNodeShape(tag, length + (to - from), shape, reuse));
              }
            }
          } else if (this.new.lastChild instanceof TextTile && !this.new.lastChild.isComposition) {
            this.addText(tile.text.slice(from, to));
          } else if (!from && to == tile.text.length && !(tile.flags & 8192 /* Dirty */) && !this.reused.has(tile)) {
            this.reused.set(tile, 1 /* Full */);
            this.new.addChild(tile);
          } else if (!this.reused.has(tile)) {
            this.reused.set(tile, 2 /* DOM */);
            this.new.addChild(new TextTile(tile.text.slice(from, to), tile.dom));
          } else {
            this.new.addChild(TextTile.of(tile.text.slice(from, to)));
          }
        }
      };
    }
    keep(len, includeStart, includeEnd) {
      if (!!this.partialNode != (this.old.tile.isAtom && !this.old.tile.isText)) {
        let dist2 = Math.min(len, this.partialNode ? this.state.doc.nodeAt(this.posB - this.partialNode.length).length - this.partialNode.length : this.old.tile.length - this.old.index);
        this.replace(dist2, dist2, includeStart);
        if (dist2 == len) return true;
        includeStart = false;
        len -= dist2;
      }
      this.keepCheckEnd(len, includeStart, includeEnd);
      return includeEnd;
    }
    keepCheckEnd(len, includeStart, includeEnd) {
      let cut = [], end = this.posB + len;
      if (this.deco.endWidgets) for (let nw = this.new, { tile, index, parent } = this.old, pos = this.posB; pos < end; ) {
        if (tile.isAtom) {
          pos += tile.length - index;
          ({ tile, index, parent } = parent);
          index++;
        } else if (index < tile.children.length) {
          pos += tile.children[index].length;
          index++;
        } else {
          if (tile.tag) {
            while (!nw.tag && nw.parent) nw = nw.parent;
            if (!nw.parent) break;
            if (!nw.tag.eq(tile.tag) && (this.deco.hasEndWidget(tile.tag.type) || this.deco.hasEndWidget(nw.tag.type)))
              cut.push(pos);
            nw = nw.parent;
            if (!nw) break;
            pos++;
          }
          if (!parent) break;
          ({ tile, index, parent } = parent);
          index++;
        }
      }
      for (let i = cut.length; i; ) {
        let from = cut[--i], to = Math.min(from + 1, includeEnd ? end : end - 1);
        while (i && cut[i - 1] == from - 1) {
          from--;
          i--;
        }
        if (from > this.posB) this.keepInner(from - this.posB, includeStart, false);
        this.update(to - from, true);
        includeStart = false;
        len = end - to;
      }
      if (len) this.keepInner(len, includeStart, includeEnd);
    }
    keepInner(len, includeStart, includeEnd) {
      if (!includeStart) {
        this.old = this.old.walk(0, 1);
        this.openOldWrappers();
      }
      this.old = this.old.walk(len, includeEnd ? 1 : -1, this.keepWalker);
      this.posB += len;
    }
    replace(len, ins, includeStart) {
      let start = this.old.walk(0, 1), end = this.old = start.walk(len, 1);
      this.build(ins, false, includeStart, start, end);
    }
    update(len, includeStart) {
      this.old = this.old.walk(0, 1);
      this.build(len, true, includeStart);
    }
    composition(composition, lenA) {
      this.leaveWrappers();
      if (!composition.target) {
        for (let mark of composition.wrapCursor) if (mark.type.element) {
          this.openWrapper(renderMarkWrapper(mark), mark.spanning, false);
        }
        this.new.addChild(new WidgetTile(Widget.img, null, 16 /* Point */ | 32 /* PointBefore */, Widget.img.render(this.wg)));
        return;
      }
      let found = [];
      for (let parent = composition.target.parentNode; parent; parent = parent.parentNode) {
        let tile = parent.wgTile;
        if (!tile) {
          let elt = Elt.create(parent.nodeName.toLowerCase(), takeAttributes(parent), Elt.hole);
          tile = new EltTile(elt, null, 0, 0, parent);
        } else if (tile.isNode || tile.isDoc) {
          break;
        }
        found.push(tile);
      }
      for (let i = found.length - 1; i >= 0; i--) {
        let tile = found[i];
        if (tile.isSpanning && this.enterSpanning(tile.elt)) {
        } else {
          if (tile.isSpanning && this.reused.has(tile)) {
            let owner = tile.dom.wgTile;
            if (owner && owner != tile) owner.dom = owner.elt.outerDOM();
          } else {
            this.reused.set(tile, 2 /* DOM */);
          }
          tile = EltTile.of(tile.elt, null, tile.flags, 0, tile.dom);
          this.new.addChild(tile);
          this.new = tile;
        }
      }
      this.new.addChild(new TextTile(composition.text, composition.target, 128 /* Composition */));
      this.old = this.old.walk(lenA, 1);
      this.posB += composition.text.length;
    }
    build(len, reuse, includeStart, startOld, endOld) {
      this.leaveWrappers();
      let start = this.posB, end = this.posB + len;
      this.deco.walk(start, includeStart, end, {
        enter: (node, elt, wrappers) => {
          this.openWrappers(wrappers, reuse);
          let tile = this.buildNodeShape(node.tag, node.length, elt, reuse ? this.old.tileAfter() : null);
          this.new.addChild(tile);
          this.new = tile.contentTile;
          if (!this.new) throw new Error("Non-atom node rendered without hole");
          if (reuse) this.old = this.old.walk(1, 1);
          this.posB++;
        },
        leave: () => {
          this.leaveNode();
          if (reuse) this.old = this.old.walk(1, 1);
          this.posB++;
        },
        node: (node, shape, wrappers, partial) => {
          this.openWrappers(wrappers, reuse);
          let wrapCount = wrappers.length;
          if (node.is(Leaf.Text)) {
            while (shape instanceof Elt) {
              this.openWrapper(Elt.create(shape.tagName, shape.attrs, Elt.hole), true, reuse);
              wrapCount++;
              shape = shape.children[0];
            }
            let next = (reuse || this.posB == start) && !(this.new.lastChild instanceof TextTile) && this.old.tileAfter();
            if (!(next instanceof TextTile) || this.reused.has(next)) {
              this.addText(node.param);
            } else if (next.text == node.param && !(next.flags & 8192 /* Dirty */)) {
              this.reused.set(next, 1 /* Full */);
              this.new.addChild(next);
            } else {
              this.reused.set(next, 2 /* DOM */);
              this.new.addChild(new TextTile(node.param, next.dom));
            }
          } else if (partial != null) {
            this.partialNode = { tag: node.tag, length: partial, shape, wrappers: wrapCount, reuse: reuse ? this.old.tileAfter() : null };
            if (reuse) this.old = this.old.walk(partial, 1);
            this.posB += partial;
            return;
          } else {
            this.new.addChild(this.buildNodeShape(node.tag, node.length, shape, reuse ? this.old.tileAfter() : null));
          }
          for (let i = 0; i < wrapCount; i++) this.up();
          if (reuse) this.old = this.old.walk(node.length, 1);
          this.posB += node.length;
        },
        nodePart: (node, length, done) => {
          if (!this.partialNode) throw new Error("Continuing unknown partial node");
          this.posB += length;
          this.partialNode.tag = node.tag;
          if (reuse) this.old = this.old.walk(length, 1);
          if (done) {
            let { tag, shape, wrappers, reuse: reuse2 } = this.partialNode;
            this.partialNode = null;
            this.new.addChild(this.buildNodeShape(tag, node.length, shape, reuse2));
            for (let i = 0; i < wrappers; i++) this.up();
          }
        },
        widget: (widget, side) => {
          let sideFlag = side < 0 ? 32 /* PointBefore */ : side > 0 ? 64 /* PointAfter */ : 0;
          let tile = reuse ? this.old.matchingWidget(widget, sideFlag, this.reused) : startOld && this.posB == start ? startOld.matchingWidget(widget, sideFlag, this.reused) : endOld && this.posB == end ? endOld.matchingWidget(widget, sideFlag, this.reused) : null;
          if (!tile) {
            let dom = widget.render(this.wg);
            if (!widget.type.editable) setUneditable(dom);
            tile = new WidgetTile(widget, null, 16 /* Point */ | sideFlag, dom);
            if (widget.type.connect) this.toConnect.push(tile);
          }
          this.new.addChild(tile);
        }
      });
    }
    findReusableTile(shape, reuse, strict) {
      if (reuse instanceof EltTile) {
        if (shape instanceof Elt && reuse.elt.tagName == shape.tagName && !this.reused.has(reuse) && (!strict || Attributes.eq(reuse.elt.attrs, shape.attrs)))
          return reuse;
        for (let ch of reuse.children) if (ch instanceof EltTile && ch.isNodeInner) {
          let found = this.findReusableTile(shape, ch, strict);
          if (found) return found;
        }
        return this.findReusableTile(shape, reuse.children, strict);
      } else if (reuse instanceof WidgetTile && shape instanceof Widget && !this.reused.has(reuse) && shape.eq(reuse.widget)) {
        return reuse;
      } else if (Array.isArray(reuse)) {
        for (let tile of reuse) if (tile.isNodeInner) {
          let found = this.findReusableTile(shape, tile, strict);
          if (found) return found;
        }
      }
      return null;
    }
    // node will be null when building inner structure
    buildNodeShape(tag, length, shape, reuse, inEditable = true, afterContent = 0 /* None */) {
      if (shape instanceof Elt) {
        if (inEditable && !shape.hasContent) {
          if (Attributes.get(shape.attrs, "contenteditable") == null && !/^(br|hr|img|input|wbr)$/i.test(shape.tagName))
            shape = Elt.create(shape.tagName, Attributes.merge(shape.attrs, ["contenteditable", "false"]), shape.children);
          inEditable = false;
        }
        let reusable, dom, strict = true;
        if (reusable = this.findReusableTile(shape, reuse, strict) || this.findReusableTile(shape, reuse, strict = false)) {
          this.reused.set(reusable, 2 /* DOM */);
          dom = reusable.dom;
          if (reusable.flags & 8192 /* Dirty */)
            updateAttributes(dom, takeAttributes(reusable.dom), shape.attrs);
          else if (!strict)
            updateAttributes(dom, reusable.elt.attrs, shape.attrs);
        }
        let flags = (tag ? shape.hasContent ? 0 /* None */ : 512 /* Atom */ : 1 /* NodeInner */ | (shape.hasContent ? 0 /* None */ : 16 /* Point */)) | afterContent;
        let tile = EltTile.of(shape, tag, flags, tag ? length : 0, dom);
        let afterContentInner = 0 /* None */;
        for (let ch of shape.children) {
          if (ch === 0) {
            afterContentInner = 2048 /* AfterContent */;
            tile.flags |= 2 /* PlotContent */;
          } else {
            tile.addChild(this.buildNodeShape(
              null,
              0,
              typeof ch == "string" ? Widget.text.of(ch) : ch,
              reusable ? reusable.children : reuse,
              inEditable,
              afterContentInner
            ));
          }
        }
        return tile;
      } else {
        let reusable, dom;
        if (reusable = this.findReusableTile(shape, reuse, false)) {
          this.reused.set(reusable, 2 /* DOM */);
          dom = reusable.dom;
        } else {
          dom = shape.render(this.wg);
        }
        if (inEditable && !shape.type.editable) setUneditable(dom);
        let flags = (tag ? 512 /* Atom */ : 16 /* Point */ | 1 /* NodeInner */) | afterContent;
        let tile = new WidgetTile(shape, tag, flags, dom, tag ? length : 0);
        if (shape.type.connect) this.toConnect.push(tile);
        return tile;
      }
    }
    copyEltStructure(tile) {
      this.reused.set(tile, 2 /* DOM */);
      let copy2 = EltTile.of(tile.elt, tile.tag, tile.flags, tile.boundary * 2, tile.dom);
      if (tile.isNodeOuter) {
        for (let child of tile.children) if (child.isNodeInner) {
          copy2.addChild(child.flags & 1024 /* HasContent */ ? this.copyEltStructure(child) : child);
        }
      }
      return copy2;
    }
    ensureHackNode() {
      let tile = this.new;
      if (!tile.isPlotContent) return;
      while (tile.isNodeInner) tile = tile.parent;
      let tag = tile.tag;
      if (!tag || !tag.isPlot || !(tag.isTextblock || tag.type.isInline)) return;
      let hasHack = -1, needsHack = true;
      for (let parent = this.new, i = parent.children.length; ; ) {
        if (i > 0) {
          let next = parent.children[--i];
          if (next.isNodeInner || next instanceof WidgetTile && !next.widget.type.inFlow) {
          } else if (next instanceof WidgetTile && next.widget == Widget.br && parent == this.new) {
            hasHack = i;
          } else if (next.dom.nodeName == "BR") {
            break;
          } else if (next instanceof CompositeTile && !next.isAtom) {
            parent = next;
            i = parent.children.length;
          } else {
            needsHack = false;
            break;
          }
        } else if (parent == this.new) {
          break;
        } else {
          i = parent.parent.children.indexOf(parent);
          parent = parent.parent;
        }
      }
      if (hasHack > -1) {
        if (!needsHack) this.new.children.splice(hasHack, 1);
      } else if (needsHack) {
        this.new.addChild(new WidgetTile(Widget.br, null, 16 /* Point */ | 64 /* PointAfter */, Widget.br.render(this.wg)));
      }
    }
    up() {
      this.ensureHackNode();
      this.new = this.new.parent;
    }
    leaveNode() {
      for (let inNode = true; ; ) {
        if (!inNode && (this.new.isNode || this.new.isDoc)) break;
        if (inNode && this.new.isNodeOuter) inNode = false;
        this.up();
      }
    }
    leaveWrappers() {
      while (!(this.new.isNode || this.new.isDoc)) this.up();
    }
    openWrappers(wrappers, reuse) {
      for (let src of wrappers) {
        this.openWrapper(renderWrapper(src), src.spanning, reuse);
      }
    }
    openOldWrappers() {
      let found;
      let start = this.old.tile.isText ? this.old.parent : this.old;
      for (let { tile, parent } = start; !tile.isNode && !tile.isDoc; { tile, parent } = parent) {
        ;
        (found || (found = [])).push(tile);
      }
      if (found) for (let i = found.length - 1; i >= 0; i--) {
        this.openWrapper(found[i].elt, found[i].isSpanning, true);
      }
    }
    openWrapper(elt, spanning, reuse) {
      let span = spanning && this.enterSpanning(elt);
      if (span) {
        this.new = span;
      } else {
        let match = reuse ? this.old.matchingWrapper(elt, spanning, this.reused) : null;
        let tile = EltTile.of(elt, null, 8 /* Wrapper */ | (spanning ? 4 /* Spanning */ : 0), 0, match);
        this.new.addChild(tile);
        this.new = tile;
      }
    }
    enterSpanning(elt) {
      let cur = this.new;
      for (let i = cur.children.length - 1; i >= 0; i--) {
        let prev = cur.children[i];
        if (prev.isPoint) continue;
        if (!prev.isSpanning || !prev.elt.eq(elt)) break;
        if (prev.flags & 256 /* Synced */) {
          let copy2 = cur.children[i] = EltTile.of(elt, null, prev.flags, 0, prev.dom);
          for (let ch of prev.children) copy2.addChild(ch);
          prev = copy2;
          prev.parent = cur;
        }
        for (let j = i + 1; j < cur.children.length; j++) prev.addChild(cur.children[j]);
        return prev;
      }
      return null;
    }
    addText(text) {
      let last = this.new.lastChild;
      if (!(last instanceof TextTile) || last.isComposition) {
        this.new.addChild(TextTile.of(text));
      } else if (last.flags & 256 /* Synced */) {
        this.new.children.pop();
        this.new.addChild(new TextTile(last.text + text, last.dom));
        this.reused.set(last, 2 /* DOM */);
      } else {
        last.text += text;
        last.length += text.length;
      }
    }
    finish() {
      while (!(this.new instanceof DocTile)) this.up();
      this.ensureHackNode();
      return this.new;
    }
  };
  function takeAttributes(elt) {
    let attrs = [];
    for (let i = 0; i < elt.attributes.length; i++) {
      let { name, value } = elt.attributes[i];
      Attributes.push(attrs, name, value);
    }
    return attrs.length ? attrs : Attributes.none;
  }
  function updateAttributes(dom, a, b) {
    let changed = false;
    for (let iA = 0, iB = 0; ; ) {
      let match = false;
      if (iA < a.length && iB < b.length && a[iA] == b[iB]) {
        if (a[iA + 1] != b[iB + 1]) dom.setAttribute(b[iB], b[iB + 1]);
        else match = true;
        iA += 2;
        iB += 2;
      } else if (iA < a.length && (iB == b.length || a[iA] < b[iB])) {
        dom.removeAttribute(a[iA]);
        iA += 2;
      } else if (iB < b.length) {
        dom.setAttribute(b[iB], b[iB + 1]);
        iB += 2;
      } else {
        break;
      }
      if (!match) changed = true;
    }
    return changed;
  }

  // vendor/wordgard/src/editor/coords.ts
  var Coords = class {
    constructor(ref, rect) {
      __publicField(this, "ref", ref);
      __publicField(this, "rect", rect);
    }
  };
  function coordsAtPos(wg, pos, assoc) {
    let textblock = wg.state.doc.resolve(pos).textblockParent;
    let map = textblock ? wg.state.textblockMap(textblock) : null;
    if (textblock && textblock.node.contentLength && (pos == textblock.start && assoc < 0 || pos == textblock.end && assoc > 0)) {
      let span = map.order[pos == textblock.start ? 0 : map.order.length - 1];
      if (span.ltr != map.ltr)
        pos = textblock.start + (pos == textblock.start ? span.to : span.from);
      else
        assoc = -assoc;
    }
    let { offset, tile, pos: tilePos } = wg.docTile.resolve(pos, assoc);
    if (tile instanceof TextTile) {
      let from = offset, to = offset;
      let side = from == 0 ? -1 : from == tile.length ? 1 : -assoc;
      if (side < 0) to++;
      else from--;
      return new Coords(tile, flattenV(
        singleRect(textRange(tile.dom, from, to), side, true),
        side < 0 == ltrAt(wg.state, pos, assoc, map)
      ));
    }
    let tagTile = tile;
    while (!tagTile.tag) tagTile = tagTile.parent;
    let horizontal = tagTile.tag.isPlot && tagTile.tag.type.orientation == "column";
    if (tile instanceof WidgetTile) {
      let after = pos > tilePos + tile.length / 2;
      if (tile.widget.type.inFlow) {
        let rect2 = singleRect(tile.dom, after ? 1 : -1);
        if (rect2.width || rect2.height)
          return new Coords(tile, horizontal ? flattenH(rect2, !after) : flattenV(rect2, ltrAt(wg.state, pos, 1, map) == !after));
      }
      if (!tile.parent) return new Coords(tile, new DOMRect());
      offset = tile.parent.children.indexOf(tile) + (after ? 1 : 0);
      tile = tile.parent;
      assoc = after ? 1 : -1;
    }
    for (let pass = 0; pass < 2; pass++) {
      if (pass == (assoc < 0 ? 0 : 1)) {
        for (let i = offset; i > 0; i--) {
          let before = tile.children[i - 1];
          if (before instanceof WidgetTile && !before.widget.type.inFlow) continue;
          if (before.dom.nodeName == "BR") break;
          let rect2 = singleRect(before.dom, 1);
          if (rect2.width || rect2.height)
            return new Coords(before, horizontal ? flattenH(rect2, false) : flattenV(rect2, !ltrAt(wg.state, pos, 1, map)));
        }
      } else {
        for (let i = offset; i < tile.children.length; i++) {
          let after = tile.children[i];
          if (after instanceof WidgetTile && !after.widget.type.inFlow) continue;
          let rect2 = singleRect(after.dom, -1);
          if (rect2.width || rect2.height)
            return new Coords(after, horizontal ? flattenH(rect2, true) : flattenV(rect2, ltrAt(wg.state, pos, 1, map)));
        }
      }
    }
    let rect = singleRect(tile.dom, -assoc);
    return new Coords(tile, horizontal ? flattenH(rect, assoc < 0) : flattenV(rect, assoc < 0));
  }
  function flattenV(rect, left) {
    return rect.width ? new DOMRect(left ? rect.left : rect.right, rect.top, 0, rect.height) : rect;
  }
  function flattenH(rect, top2) {
    return rect.height ? new DOMRect(rect.left, top2 ? rect.top : rect.bottom, rect.width, 0) : rect;
  }

  // vendor/wordgard/src/editor/browser.ts
  var nav = typeof navigator != "undefined" ? navigator : { userAgent: "", vendor: "", platform: "" };
  var doc = typeof document != "undefined" ? document : { documentElement: { style: {} } };
  var edge = /Edge\/(\d+)/.exec(nav.userAgent);
  var gecko = !edge && /gecko\/(\d+)/i.test(nav.userAgent);
  var chrome = !edge && /Chrome\/(\d+)/.exec(nav.userAgent);
  var webkit = "webkitFontSmoothing" in doc.documentElement.style;
  var safari = !edge && /Apple Computer/.test(nav.vendor);
  var ios = safari && (/Mobile\/\w+/.test(nav.userAgent) || nav.maxTouchPoints > 2);
  var browser_default = {
    mac: ios || /Mac/.test(nav.platform),
    windows: /Win/.test(nav.platform),
    linux: /Linux|X11/.test(nav.platform),
    edge,
    gecko,
    gecko_version: gecko ? +(/Firefox\/(\d+)/.exec(nav.userAgent) || [0, 0])[1] : 0,
    chrome: !!chrome,
    chrome_version: chrome ? +chrome[1] : 0,
    ios,
    android: /Android\b/.test(nav.userAgent),
    webkit,
    webkit_version: webkit ? +(/\bAppleWebKit\/(\d+)/.exec(nav.userAgent) || [0, 0])[1] : 0,
    safari,
    safari_version: safari ? +(/\bVersion\/(\d+(\.\d+)?)/.exec(nav.userAgent) || [0, 0])[1] : 0,
    blink: edge || chrome
  };

  // vendor/wordgard/src/editor/clipboard.ts
  var clipboardOutputFilter = GardState.Facet.define();
  var clipboardOutputHTMLFilter = GardState.Facet.define();
  var clipboardTextSerializer = GardState.Facet.define();
  var clipboardOutputTextFilter = GardState.Facet.define();
  var clipboardInputFilter = GardState.Facet.define();
  var clipboardInputHTMLFilter = GardState.Facet.define();
  var clipboardTextParser = GardState.Facet.define();
  var clipboardInputTextFilter = GardState.Facet.define();
  function writeClipboard(state, slice, data) {
    for (let filter of state.facet(clipboardOutputFilter)) slice = filter(slice, state);
    let includeContext = 0;
    for (let i = 0; i < slice.context.length; i++) {
      let next = slice.context[i];
      if (next.type.defining && (!includeContext || next.type != slice.context[includeContext - 1].type)) includeContext = i + 1;
      else if (next.type.defining || !next.isTextblock) break;
    }
    let doc2 = clipboardDoc(), dom = serialize.slice(slice, {
      includeContext,
      openAttr: "wg-open"
    }).toDOM();
    let needsWrap, wrappers = 0;
    while (dom.firstChild && dom.firstChild.nodeType == 1 && (needsWrap = wrapMap[dom.firstChild.nodeName.toLowerCase()])) {
      for (let i = needsWrap.length - 1; i >= 0; i--) {
        let wrapper = doc2.createElement(needsWrap[i]);
        wrapper.setAttribute("wg-wrap", "true");
        while (dom.firstChild) wrapper.appendChild(dom.firstChild);
        dom.appendChild(wrapper);
        wrappers++;
      }
    }
    if (dom.firstChild && dom.firstChild.nodeType == 1)
      dom.firstChild.setAttribute("wg-content", "true");
    let wrap = doc2.createElement("div");
    wrap.appendChild(dom);
    let html = wrap.innerHTML;
    for (let filter of state.facet(clipboardOutputHTMLFilter)) html = filter(html, state);
    data.setData("text/html", html);
    let text;
    for (let serialize2 of state.facet(clipboardTextSerializer)) {
      if ((text = serialize2(slice, state)) != null) break;
    }
    if (text == null) text = slice.textContent({ blockSeparator: "\n\n" });
    for (let filter of state.facet(clipboardOutputTextFilter)) text = filter(text, state);
    data.setData("text/plain", text);
  }
  function isOpen(elt) {
    return elt.getAttribute("wg-open") || null;
  }
  function readClipboard(state, data, targetContext, plain) {
    let html = data.getData("text/html");
    let text = data.getData("text/plain") || data.getData("Text") || data.getData("text/uri-list").replace(/\r?\n/g, " ");
    let slice;
    if (text && (targetContext.parent.node.type.hasRole(Node.Role.Code) || !html || plain)) {
      for (let filter of state.facet(clipboardInputTextFilter)) text = filter(text, state);
      slice = readClipboardText(state, text, targetContext, plain);
    } else if (!html) {
      return null;
    } else {
      for (let filter of state.facet(clipboardInputHTMLFilter)) html = filter(html, state);
      let dom = readHTML2(html);
      if (browser_default.webkit) restoreReplacedSpaces(dom);
      let fromWordgard = dom.querySelector("[wg-content=true]");
      slice = parse.slice(state.schema, dom, {
        collapseWhiteSpace: !fromWordgard,
        isOpen: fromWordgard ? isOpen : void 0
      });
    }
    for (let filter of state.facet(clipboardInputFilter)) slice = filter(slice, state);
    return slice;
  }
  function readClipboardText(state, text, context, plain) {
    if (!plain) for (let parser of state.facet(clipboardTextParser)) {
      let slice = parser(text, state);
      if (slice) return slice;
    }
    let marks = plain ? [] : context.marks();
    if (context.parent.node.type.hasRole(Node.Role.Code)) return Slice.of([Leaf.text(text.replace(/\r?\n|\r/g, "\n"), marks)]);
    let lines = text.split(/(?:\r\n?|\n)+/);
    let content = lines[0] ? [Leaf.text(lines[0], marks)] : [];
    if (lines.length == 1) return Slice.of(content);
    let parent = (context.parent.node.inlineContent ? context.parent.parent || context.parent : context.parent).node.tag;
    let wrapping = state.schema.findWrapping(parent.type, Leaf.Text);
    if (!wrapping || !wrapping.length) return Slice.of([Leaf.text(text.replace(/\r?\n|\r/g, " "), marks)]);
    let wrapper = wrapping[wrapping.length - 1];
    content.push(Plot.End);
    for (let i = 1; i < lines.length - 1; i++)
      content.push(wrapper.create(lines[i] ? [Leaf.text(lines[i], marks)] : []));
    content.push(wrapper);
    let last = lines[lines.length - 1];
    if (last) content.push(Leaf.text(last, marks));
    return Slice.of(content);
  }
  var wrapMap = {
    thead: ["table"],
    tbody: ["table"],
    tfoot: ["table"],
    caption: ["table"],
    colgroup: ["table"],
    col: ["table", "colgroup"],
    tr: ["table", "tbody"],
    td: ["table", "tbody", "tr"],
    th: ["table", "tbody", "tr"]
  };
  var _clipboardDoc = null;
  function clipboardDoc() {
    return _clipboardDoc || (_clipboardDoc = document.implementation.createHTMLDocument("title"));
  }
  function readHTML2(html) {
    let metas = /^(\s*<meta [^>]*>)*/.exec(html);
    if (metas) html = html.slice(metas[0].length);
    let firstTag = /<([a-z][^>\s]+)/i.exec(html), wrap;
    if (wrap = firstTag && wrapMap[firstTag[1].toLowerCase()])
      html = wrap.map((n) => "<" + n + ">").join("") + html + wrap.map((n) => "</" + n + ">").reverse().join("");
    let elt = parseInertHTML(html);
    if (wrap) for (let i = 0; i < wrap.length; i++) elt = elt.querySelector(wrap[i]) || elt;
    return elt;
  }
  function restoreReplacedSpaces(dom) {
    let nodes = dom.querySelectorAll(browser_default.chrome ? "span:not([class]):not([style])" : "span.Apple-converted-space");
    for (let i = 0; i < nodes.length; i++) {
      let node = nodes[i];
      if (node.childNodes.length == 1 && node.textContent == "\xA0" && node.parentNode)
        node.parentNode.replaceChild(dom.ownerDocument.createTextNode(" "), node);
    }
  }

  // vendor/wordgard/src/editor/theme.ts
  var theme = GardState.Facet.define({ combine: (strs) => strs.join(" ") });
  var colorScheme = GardState.Facet.define({
    combine: (values) => values.length ? values[0] : "light"
  });
  var styleID = StyleModule.newName();
  var baseLightID = StyleModule.newName();
  var baseDarkID = StyleModule.newName();
  var lightDarkIDs = { "&light": "." + baseLightID, "&dark": "." + baseDarkID };
  function buildTheme(main, spec, scopes) {
    return new StyleModule(spec, {
      finish(sel) {
        return /&/.test(sel) ? sel.replace(/&\w*/, (m) => {
          if (m == "&") return main;
          if (!scopes || !scopes[m]) throw new RangeError(`Unsupported selector: ${m}`);
          return scopes[m];
        }) : main + " " + sel;
      }
    });
  }
  var baseStyles = buildTheme("." + styleID, {
    "&": {
      "--wg-highlight-color": "#6af",
      "--wg-dialog-font": "90% sans-serif",
      position: "relative",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      border: "1px solid var(--wg-border-color)"
    },
    "&:has(> wg-scroller > wg-content:focus)": {
      outline: "1px solid var(--wg-highlight-color)",
      "& > wg-scroller > wg-cursor-layer": {
        animation: "steps(1) wg-blink 1.2s infinite"
      },
      "& > wg-scroller > wg-cursor-layer wg-cursor": {
        display: "block"
      }
    },
    "&light": {
      "--wg-panel-color": "white",
      "--wg-border-color": "#cacacb"
    },
    "&dark": {
      "--wg-panel-color": "#030303",
      "--wg-border-color": "#444"
    },
    "wg-scroller": {
      display: "block",
      height: "100%",
      overflowX: "auto",
      position: "relative",
      zIndex: 0
    },
    "wg-content": {
      display: "block",
      margin: 0,
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
      wordBreak: "break-word",
      // For Safari, which doesn't support overflow-wrap: anywhere
      boxSizing: "border-box",
      padding: "4px 12px",
      outline: "none",
      caretColor: "transparent"
    },
    "wg-cursor-layer": {
      display: "block",
      position: "absolute",
      left: 0,
      top: 0,
      contain: "size style",
      "& > *": {
        position: "absolute"
      },
      pointerEvents: "none",
      zIndex: 150
    },
    // Two animations defined so that we can switch between them to
    // restart the animation without forcing another style
    // recomputation.
    "@keyframes wg-blink": { "0%": {}, "50%": { opacity: 0 }, "100%": {} },
    "@keyframes wg-blink2": { "0%": {}, "50%": { opacity: 0 }, "100%": {} },
    "wg-cursor": {
      pointerEvents: "none",
      display: "none"
    },
    ".wg-cursor-v": {
      borderLeft: "1.8px solid currentColor",
      marginLeft: "-0.9px"
    },
    ".wg-cursor-v.wg-cursor-bold": {
      borderLeft: "2.4px solid currentColor",
      marginLeft: "-1.2px"
    },
    ".wg-cursor-v.wg-cursor-italic": {
      transform: "rotate(10deg)"
    },
    ".wg-cursor-h": {
      borderTop: "1.8px solid currentColor",
      marginTop: "-0.9px"
    },
    ".wg-selected-node": {
      outline: "2px solid #68f",
      "&::selection, & *::selection": {
        backgroundColor: "transparent"
      }
    },
    ".wg-buffer": {
      verticalAlign: "bottom",
      height: "1em"
    },
    "wg-placeholder": {
      opacity: "0.6",
      display: "inline-block",
      verticalAlign: "top",
      userSelect: "none"
    },
    "wg-dropcursor": {
      pointerEvents: "none",
      position: "absolute",
      "&.wg-vertical": {
        borderLeft: "1.2px solid black",
        marginLeft: "-0.6px"
      },
      "&.wg-horizontal": {
        borderTop: "1.2px solid black",
        marginTop: "-0.6px"
      }
    },
    "wg-announced": {
      position: "fixed",
      top: "-10000px"
    },
    "@media print": {
      "wg-announced": { display: "none" }
    },
    "wg-panels": {
      display: "block",
      boxSizing: "border-box",
      position: "sticky",
      left: 0,
      right: 0,
      zIndex: 300,
      backgroundColor: "var(--wg-panel-color)",
      font: "var(--wg-dialog-font)"
    },
    ".wg-panels-top": { top: "0" },
    ".wg-panels-bottom": { bottom: "0" },
    dialog: {
      font: "var(--wg-dialog-font)",
      padding: "7px 22px 7px 8px",
      minWidth: "120px",
      border: "1px solid var(--wg-border-color)",
      borderRadius: "5px",
      boxShadow: "0 0 8px 0 rgba(128, 128, 128, 0.2)",
      inset: "unset",
      "&.wg-free-dialog": {
        position: "fixed"
      }
    },
    "h3.wg-dialog-title": {
      fontSize: "90%",
      fontWeight: "bold",
      textAlign: "center",
      margin: "0 0 0.8em"
    },
    "dialog label, dialog .wg-label": {
      fontSize: "90%"
    },
    ".wg-dialog-close": {
      position: "absolute",
      top: "3px",
      right: "4px",
      backgroundColor: "inherit",
      border: "none",
      font: "inherit",
      fontSize: "14px",
      padding: "0"
    },
    ".wg-dialog-button": {
      color: "inherit",
      padding: "3px 9px",
      border: "none",
      borderRadius: "3px"
    },
    "&light .wg-dialog-button": {
      backgroundColor: "#eaeaea",
      "&:active": {
        backgroundColor: "#ddd"
      }
    },
    "&dark .wg-dialog-button": {
      backgroundColor: "#333",
      "&:active": {
        backgroundColor: "#222"
      }
    },
    ".wg-key-help": {
      padding: "15px 4px 4px",
      maxWidth: "350px"
    },
    ".wg-key-list": {
      padding: "11px",
      outline: "none",
      maxHeight: "calc(min(70vh, 300px))",
      overflowY: "auto",
      display: "grid",
      gridTemplateColumns: "max-content auto",
      gap: "8px 15px",
      "& h4": {
        gridColumn: "span 2",
        margin: "0.5em 0",
        fontSize: "110%"
      }
    }
  }, lightDarkIDs);

  // vendor/wordgard/src/editor/selection.ts
  function setDOMSelection(wg) {
    let { anchor, head, anchorSide, headSide } = wg.state.selection.domSelection;
    let anchorDOM = wg.docTile.resolve(anchor, anchorSide);
    let headDOM = head == anchor ? anchorDOM : wg.docTile.resolve(head, headSide);
    let domSel = getSelection(wg.root);
    if (!domSel) return;
    if (domSel.focusNode && isEquivalentPosition(anchorDOM.dom, anchorDOM.offset, domSel.anchorNode, domSel.anchorOffset) && isEquivalentPosition(headDOM.dom, headDOM.offset, domSel.focusNode, domSel.focusOffset))
      return;
    domSel.collapse(anchorDOM.dom, anchorDOM.offset);
    let failed = false;
    if (anchor != head) try {
      domSel.extend(headDOM.dom, headDOM.offset);
    } catch (_) {
      failed = true;
    }
    if (!failed) wg.observer.setSelectionRange(anchorDOM, headDOM);
  }
  function readDOMSelection(wg, range) {
    let anchor = wg.posAtDOM(range.anchorNode, range.anchorOffset);
    let head = range.anchorNode == range.focusNode && range.anchorOffset == range.focusOffset ? anchor : wg.posAtDOM(range.focusNode, range.focusOffset);
    return GardSelection.range(anchor, head);
  }
  function selectionFromTouch(event, wg) {
    let pos = wg.posAtCoords({ x: event.touches[0].clientX, y: event.touches[0].clientY });
    if (pos.target != null) {
      let target = wg.state.doc.nodeAt(pos.target);
      if (target && target.type.isSelectable && wg.state.isAtom(target.type))
        return GardSelection.node(pos.target, target);
    }
    return GardSelection.near(wg.state, pos.pos, pos.side);
  }
  function rangeForClick(wg, pos, type) {
    if (type < 3 && pos.target != null) {
      let target = wg.state.doc.nodeAt(pos.target);
      if (target && target.type.isSelectable && wg.state.isAtom(target.type))
        return GardSelection.node(pos.target, target);
    }
    if (type == 1) {
      return GardSelection.near(wg.state, pos.pos, pos.side || -1);
    } else if (type == 2) {
      return wg.state.wordAt(pos.pos, pos.side || 1);
    } else {
      let cx = wg.state.doc.resolve(pos.pos), block = cx.textblockParent;
      if (block) return GardSelection.undirectionalRange(block.start, block.end);
      else return GardSelection.near(wg.state, pos.pos, pos.side || -1);
    }
  }
  var Y_STEP = 2;
  function moveVertically(wg, start, forward, distance = 0, selectNode = false) {
    let editorRect = wg.contentDOM.getBoundingClientRect();
    let coords = wg.coordsAtPos(start.head, start.headSide);
    let baseLTR = wg.state.textLTR;
    let goalColumn = start.goalColumn ?? (baseLTR ? coords.left - editorRect.left : editorRect.right - coords.left);
    let x = baseLTR ? editorRect.left + goalColumn : editorRect.right - goalColumn;
    let y = forward ? coords.bottom + distance : coords.top - distance;
    for (let scan = start.head; ; ) {
      let pos = wg.state.doc.resolve(scan), block = pos.textblockParent;
      if (block) {
        let blockTile = block.parent ? wg.docTile.nodeTile(block.before) : wg.docTile;
        let rect = blockTile.dom.getBoundingClientRect();
        if (forward ? y < rect.top : y > rect.bottom) y = forward ? rect.top : rect.bottom;
        while (forward ? rect.bottom >= y : rect.top <= y) {
          let found = blockTile.posAtCoords(wg.state, x, y);
          if (!found.vertOutside && found.pos != start.head) return GardSelection.cursor(found.pos, found.side, goalColumn);
          y += forward ? Y_STEP : -Y_STEP;
        }
        if (!block.parent) return null;
        scan = forward ? block.after : block.before;
      }
      let nextCursor = GardSelection.cursor(scan).nextNormalCursor(wg.state, forward);
      if (!nextCursor) return null;
      let nextNode = findTargetVertically(wg, scan, forward, x, selectNode);
      if (!nextNode || (forward ? nextCursor.head <= nextNode.before : nextCursor.head >= nextNode.after) && wg.state.doc.resolve(nextCursor.head).depth < nextNode.depth) {
        let coords2 = wg.coordsAtPos(nextCursor.head, nextCursor.headSide);
        if (forward ? coords2.bottom > y : coords2.top < y)
          return GardSelection.cursor(nextCursor.head, nextCursor.headSide, goalColumn);
        if (!nextNode) return null;
      }
      if (nextNode instanceof Pos.Plot) {
        scan = forward ? nextNode.start : nextNode.end;
      } else {
        let coords2 = wg.coordsForElement(nextNode.before);
        if (forward ? coords2.bottom > y : coords2.top < y)
          return GardSelection.node(nextNode.before, nextNode.node, goalColumn);
        scan = forward ? nextNode.after : nextNode.before;
      }
    }
  }
  function findTargetVertically(wg, from, forward, x, allowNode) {
    let { parent, index, pos } = wg.state.doc.resolve(from), entering = false;
    for (; ; ) {
      if ((forward ? index == parent.node.content.length : !index) || parent.node.type.orientation == "row" && !entering) {
        if (!parent.parent) return null;
        index = parent.index + (forward ? 1 : 0);
        pos = forward ? parent.after : parent.before;
        parent = parent.parent;
        entering = false;
      } else {
        let next = parent.node.content[index - (forward ? 0 : 1)];
        let nextPos = pos - (forward ? 0 : next.length);
        if (next.isLeaf || wg.state.isAtom(next.type)) {
          if (allowNode && next.type.isSelectable && wg.state.isAtom(next.type))
            return Pos.Node.create(parent, next, nextPos, index - (forward ? 0 : 1));
          index += forward ? 1 : -1;
          pos += (forward ? 1 : -1) * next.length;
          continue;
        }
        let node = Pos.Plot.create(parent, next, nextPos, index - (forward ? 0 : 1));
        if (!next.inlineContent && next.type.orientation == "row") {
          let closest = -1, closestPos = -1, closestDist = -1;
          for (let chPos = nextPos + 1, i = 0; i < next.content.length; i++) {
            let ch = next.content[i];
            let tile = wg.docTile.nodeTile(chPos);
            let rect = tile.dom.getBoundingClientRect();
            let dist2 = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
            if (closestDist < 0 || dist2 < closestDist) {
              closestDist = dist2;
              closest = i + (forward ? 0 : 1);
              closestPos = chPos + (forward ? 0 : ch.length);
            }
            chPos += ch.length;
          }
          parent = node;
          index = closest;
          pos = closestPos;
          entering = true;
        } else if (next.isTextblock) {
          return node;
        } else {
          parent = node;
          index = forward ? 0 : next.content.length;
          pos += forward ? 1 : -1;
        }
      }
    }
  }
  function moveToLineBoundary(wg, start, forward) {
    let block = wg.state.doc.resolve(start.head).textblockParent;
    if (!block) return null;
    let startCoords = wg.coordsAtPos(start.head, start.headSide);
    let ltr = wg.state.textblockLTR(block.node);
    let y = (startCoords.top + startCoords.bottom) / 2, left = forward != ltr;
    let { pos, side } = wg.posAtCoords({ x: left ? -1e7 : 1e7, y });
    if (pos < block.start || pos > block.end) {
      let blockRect = wg.docTile.nodeTile(block.before).dom.getBoundingClientRect();
      let result = wg.posAtCoords({ x: left ? blockRect.left + 0.2 : blockRect.right - 0.2, y });
      if (result.pos < block.start) {
        pos = block.start;
        side = -1;
      } else if (result.pos > block.end) {
        pos = block.end;
        side = 1;
      } else {
        ({ pos, side } = result);
      }
    }
    return GardSelection.cursor(pos, side);
  }

  // vendor/wordgard/src/editor/domobserver.ts
  var observeOptions = {
    childList: true,
    characterData: true,
    subtree: true,
    attributes: true,
    characterDataOldValue: true
  };
  var DOMObserver = class {
    constructor(wg) {
      __publicField(this, "wg", wg);
      __publicField(this, "dom");
      __publicField(this, "win", null);
      __publicField(this, "observer");
      __publicField(this, "active", false);
      // The known selection. Kept in our own object, as opposed to just
      // directly accessing the selection because:
      //  - Safari doesn't provide getSelection in shadow DOM
      //  - Reading from the selection forces a DOM layout
      //  - By tracking this, we can ignore selectionchange events if we
      //    have already seen the 'new' selection
      __publicField(this, "selectionRange", new DOMSelectionState());
      __publicField(this, "selectionChanged", false);
      __publicField(this, "resizeTimeout", -1);
      __publicField(this, "queue", []);
      // Ranges (refering to positions in the flushed document) that need
      // to be re-checked because their DOM changed, if any are known.
      __publicField(this, "dirty", null);
      __publicField(this, "scrollTargets", []);
      __publicField(this, "resizeScroll", null);
      __publicField(this, "darkThemeQuery", null);
      this.dom = wg.contentDOM;
      this.observer = new MutationObserver((mutations) => {
        for (let mut of mutations) this.queue.push(mut);
        this.wg.scheduleFlush();
      });
      this.onSelectionChange = this.onSelectionChange.bind(this);
      this.onResize = this.onResize.bind(this);
      this.onScroll = this.onScroll.bind(this);
      this.onColorSchemeChange = this.onColorSchemeChange.bind(this);
      if (typeof ResizeObserver == "function") {
        let lastFlushSeen = 0;
        this.resizeScroll = new ResizeObserver(() => {
          if (this.wg.lastFlush != lastFlushSeen) {
            lastFlushSeen = this.wg.lastFlush;
            this.onResize();
          }
        });
      }
      this.readSelectionRange();
    }
    connect() {
      this.observer.observe(this.dom, observeOptions);
      this.resizeScroll?.observe(this.dom);
      for (let dom = this.dom; dom; ) {
        if (dom.nodeType == 1) {
          this.scrollTargets.push(dom);
          dom.addEventListener("scroll", this.onScroll);
          dom = dom.assignedSlot || dom.parentNode;
        } else if (dom.nodeType == 11) {
          dom = dom.host;
        } else {
          break;
        }
      }
      let win = this.win = this.wg.win;
      win.addEventListener("resize", this.onResize);
      win.addEventListener("scroll", this.onScroll);
      win.document.addEventListener("selectionchange", this.onSelectionChange);
      if (typeof win.matchMedia == "function") {
        this.darkThemeQuery = win.matchMedia("(prefers-color-scheme: dark)");
        this.onColorSchemeChange();
        this.darkThemeQuery.addEventListener("change", this.onColorSchemeChange);
      }
    }
    disconnect() {
      this.observer.disconnect();
      this.resizeScroll?.disconnect();
      for (let dom of this.scrollTargets) dom.removeEventListener("scroll", this.onScroll);
      this.scrollTargets = [];
      clearTimeout(this.resizeTimeout);
      if (this.win) {
        this.win.removeEventListener("scroll", this.onScroll);
        this.win.removeEventListener("resize", this.onResize);
        this.win.document.removeEventListener("selectionchange", this.onSelectionChange);
        this.win = null;
      }
      if (this.darkThemeQuery) {
        this.darkThemeQuery.removeEventListener("change", this.onColorSchemeChange);
        this.darkThemeQuery = null;
      }
    }
    onScroll(e) {
      this.wg.inputState.runHandlers("scroll", e);
    }
    onResize() {
      if (this.resizeTimeout < 0) this.resizeTimeout = setTimeout(() => {
        this.resizeTimeout = -1;
        this.wg.scheduleFlush();
      }, 50);
    }
    onColorSchemeChange() {
      this.wg.configureColorScheme(this.darkThemeQuery.matches ? "dark" : "light");
    }
    onSelectionChange() {
      this.readSelectionRange();
      if (this.selectionChanged) this.wg.scheduleFlush();
    }
    pollSelection() {
      let { wg } = this;
      if (this.selectionChanged && (wg.hasFocus || !wg.focusable) && hasSelection(wg.contentDOM, this.selectionRange)) {
        this.selectionChanged = false;
        let fromTouch = wg.inputState.lastTouchTime > Date.now() - 100;
        let sel = readDOMSelection(wg, this.selectionRange);
        if (!sel.eqPos(wg.state.selection)) {
          let userEvent = "select";
          if (fromTouch) {
            userEvent = "select.pointer";
            let event = wg.inputState.lastTouchEvent;
            if (event.touches.length == 1 && sel.isCursor)
              sel = selectionFromTouch(event, wg);
          }
          wg.dispatch({ selection: sel, userEvent });
        }
      }
    }
    readSelectionRange() {
      let { wg } = this;
      let selection = getSelection(wg.root);
      if (!selection) return false;
      let range = selection;
      if (browser_default.safari && wg.root.nodeType == 11 && wg.root.activeElement == this.dom) {
        let selRange = selection.getComposedRanges(wg.root)[0];
        if (selRange) range = buildSelectionRangeFromRange(wg, selRange);
      }
      if (!range || !range.focusNode || this.selectionRange.eq(range)) return false;
      let context = range.anchorNode && wg.docTile.nearest(range.anchorNode);
      if (context instanceof WidgetTile) return false;
      this.selectionRange.setRange(range);
      return this.selectionChanged = true;
    }
    setSelectionRange(anchor, head) {
      this.selectionRange.set(anchor.dom, anchor.offset, head.dom, head.offset);
      this.selectionChanged = false;
    }
    ignore(f) {
      let result = f();
      this.clear();
      return result;
    }
    // Throw away any pending changes
    clear() {
      this.takeRecords();
      this.readSelectionRange();
    }
    takeRecords() {
      for (let mut of this.observer.takeRecords()) this.queue.push(mut);
      let records = this.queue;
      if (records.length) this.queue = [];
      return records;
    }
    addDirtyRange(from, to) {
      addRange(this.dirty || (this.dirty = []), from, to);
    }
    processRecords(records) {
      for (let record of records) {
        let range = this.findMutation(record);
        if (range) this.addDirtyRange(range[0], range[1]);
      }
    }
    findMutation(record) {
      let tile = this.wg.docTile.nearest(record.target);
      if (!tile || tile.ignoreMutations) return null;
      tile.markDirty();
      if (record.type == "attributes" || record.type == "characterData") {
        if (tile == this.wg.docTile) {
          return null;
        } else if (tile.dom == record.target) {
          if (!tile.isNodeInner) return [tile.posBefore, tile.posAfter];
          while (tile.parent && tile.isNodeInner) tile = tile.parent;
          if (tile.isDoc) return null;
          let nodePos = tile.posBefore;
          return [nodePos, nodePos + 1];
        } else {
          return childRange(tile, record);
        }
      } else if (record.type == "childList") {
        return childRange(tile, record);
      } else {
        return null;
      }
    }
    takeDirty() {
      this.processRecords(this.takeRecords());
      let { dirty } = this;
      this.dirty = null;
      return dirty;
    }
  };
  function childRange(tile, record) {
    let childBefore = findChild(tile, record.previousSibling || record.target.previousSibling, -1);
    let childAfter = findChild(tile, record.nextSibling || record.target.nextSibling, 1);
    return [
      childBefore ? tile.posBeforeChild(childBefore) + childBefore.length : tile.posAtStart,
      childAfter ? tile.posBeforeChild(childAfter) : tile.posAtEnd
    ];
  }
  function findChild(elt, dom, dir) {
    while (dom) {
      let cur = Tile2.get(dom);
      if (cur && cur.parent == elt) return cur;
      let parent = dom.parentNode;
      dom = parent != elt.dom ? parent : dir > 0 ? dom.nextSibling : dom.previousSibling;
    }
    return null;
  }
  function buildSelectionRangeFromRange(wg, range) {
    let anchorNode = range.startContainer, anchorOffset = range.startOffset;
    let focusNode = range.endContainer, focusOffset = range.endOffset;
    let curAnchor = wg.docTile.resolve(wg.state.selection.anchor, -1);
    if (isEquivalentPosition(curAnchor.dom, curAnchor.offset, focusNode, focusOffset))
      [anchorNode, anchorOffset, focusNode, focusOffset] = [focusNode, focusOffset, anchorNode, anchorOffset];
    return { anchorNode, anchorOffset, focusNode, focusOffset };
  }

  // rich-text/wordgard-source/command.ts
  var command_exports = {};
  __export(command_exports, {
    Command: () => Command,
    autoJoinBlocks: () => autoJoinBlocks,
    canAddMarkInRange: () => canAddMarkInRange,
    clearNonFitting: () => clearNonFitting,
    deleteBackward: () => deleteBackward,
    deleteEmptyPlot: () => deleteEmptyPlot,
    deleteForward: () => deleteForward,
    deleteLine: () => deleteLine,
    deleteSelection: () => deleteSelection,
    deleteToLineEnd: () => deleteToLineEnd,
    deleteUnit: () => deleteUnit,
    deleteWord: () => deleteWord,
    doUnwrapBlock: () => doUnwrapBlock,
    enter: () => enter,
    enterInCode: () => enterInCode,
    findUnwrappable: () => findUnwrappable,
    findWrappable: () => findWrappable,
    insertLineBreak: () => insertLineBreak,
    insertText: () => insertText,
    joinBackward: () => joinBackward,
    joinBlocks: () => joinBlocks,
    joinForward: () => joinForward,
    joinListItems: () => joinListItems,
    killToLineEnd: () => killToLineEnd,
    liftEmptyBlock: () => liftEmptyBlock,
    listIsActive: () => listIsActive,
    moveByLine: () => moveByLine,
    moveByPage: () => moveByPage,
    moveByUnit: () => moveByUnit,
    moveByWord: () => moveByWord,
    moveToDocSide: () => moveToDocSide,
    moveToLineSide: () => moveToLineSide,
    moveToTextblockSide: () => moveToTextblockSide,
    redo: () => redo,
    selectAll: () => selectAll,
    selectedTextblocks: () => selectedTextblocks,
    setAlignment: () => setAlignment,
    setDirection: () => setDirection,
    setTextblockType: () => setTextblockType,
    splitTextblock: () => splitTextblock,
    toggleBlock: () => toggleBlock,
    toggleEmphasis: () => toggleEmphasis,
    toggleList: () => toggleList,
    toggleMark: () => toggleMark,
    toggleStrong: () => toggleStrong,
    toggleUnderline: () => toggleUnderline,
    transposeChars: () => transposeChars,
    undo: () => undo,
    unwrapBlock: () => unwrapBlock,
    wrapBlock: () => wrapBlock,
    wrapBlockRange: () => wrapBlockRange,
    yankKilled: () => yankKilled
  });

  // vendor/wordgard/src/command/command.ts
  var commandHandler = GardState.Facet.define({
    combine(handlers) {
      let map = /* @__PURE__ */ new Map();
      for (let [cmd, handler] of handlers) {
        let list = map.get(cmd);
        if (!list) map.set(cmd, list = []);
        list.push(handler);
      }
      return map;
    }
  });
  var Command;
  ((Command2) => {
    function handler(command, handler2) {
      return commandHandler.of([command, handler2]);
    }
    Command2.handler = handler;
    function bind2(command, param) {
      return { command, param };
    }
    Command2.bind = bind2;
    function dispatch(wg, command, p) {
      let { command: cmd, param } = typeof command == "object" ? command : { command, param: p ?? null };
      let handlers = wg.state.facet(commandHandler).get(cmd);
      if (handlers) for (let handler2 of handlers) {
        let result2 = handler2(wg, param);
        if (result2) {
          if (typeof result2 != "boolean") wg.dispatch(result2);
          return true;
        }
      }
      let result = cmd(wg, param);
      if (typeof result != "boolean") wg.dispatch(result);
      return !!result;
    }
    Command2.dispatch = dispatch;
  })(Command || (Command = {}));

  // vendor/wordgard/src/command/helper.ts
  function liftEmptyBlock(state) {
    if (!state.selection.isCursor) return false;
    let sel = state.sel, block = sel.head.textblockParent;
    if (!block || !sel.head.isAtStart(block) || !sel.head.isAtEnd(block)) return false;
    let start = block.before, end = block.after, before = [], after = [];
    for (let level = block.parent, index = block.index, atStart = true, atEnd = true, first = true; level; first = false, index = level.index, level = level.parent) {
      if (!first && state.schema.canContain(level.node.type, block.node.type)) return {
        changes: [
          { from: start, to: block.before, insert: before },
          { from: block.after, to: end, insert: after }
        ],
        scrollIntoView: true,
        userEvent: "unwrap.empty"
      };
      if (level.node.isInline || level.node.type.isolating) break;
      if (index) atStart = false;
      if (atStart) start--;
      else before.push(Plot.End);
      if (index < level.node.content.length - 1) atEnd = false;
      if (atEnd) end++;
      else after.unshift(level.node.tag.split(false));
    }
    return false;
  }
  function enterInCode(state) {
    let { sel } = state, { head } = sel;
    if (!head.parent.node.inlineContent || !head.parent.node.type.preserveWhitespace || head.parent.start != sel.anchor.parent.start || !state.schema.lineBreak) return false;
    if (sel.selection.empty && head.parent.parent && !head.inText && head.index > 1 && head.nodeBefore.type == state.schema.lineBreak.type && (head.pos == head.parent.end || head.nodeAfter.type == state.schema.lineBreak.type) && head.parent.node.content[head.index - 2].type == state.schema.lineBreak.type) {
      let textblock = state.schema.defaultContentPlot(head.parent.parent.node.type);
      if (textblock?.type.inlineContent) return {
        changes: {
          from: head.pos - 2,
          to: head.pos + 1,
          insert: head.pos == head.parent.end ? [Plot.End, textblock, Plot.End] : [Plot.End, textblock, Plot.End, head.parent.node.tag]
        },
        selection: GardSelection.cursor(head.pos, -1),
        scrollIntoView: true,
        userEvent: "split.textblock"
      };
    }
    return {
      changes: { from: sel.from.pos, to: sel.to.pos, insert: [state.schema.lineBreak] },
      selection: GardSelection.cursor(sel.from.pos + 1, -1),
      scrollIntoView: true,
      userEvent: "input"
    };
  }
  function splitTextblock(state, splitListItem = true) {
    let { from, to } = state.sel.replacementRange, { schema } = state.doc;
    let before = from.textblockParent;
    if (!before || !before.parent || before.node.type.isolating) return false;
    let tokens = [];
    for (let p = from.parent; ; p = p.parent) {
      tokens.push(Plot.End);
      if (p == before) break;
    }
    if (splitListItem && !before.parent.node.type.hasRole(Node.Role.List) && before.isFirst && before.parent.parent?.node.type.hasRole(Node.Role.List))
      tokens.push(Plot.End, before.parent.node.tag.split(false));
    let after = to.textblockParent;
    if (after) {
      let atEnd = true, insert = tokens.length;
      for (let p = to.parent, index = to.index; ; index = p.index + 1, p = p.parent) {
        if (index < p.node.content.length) atEnd = false;
        let tag = p.node.tag.split(atEnd), nextTag = atEnd && !p.node.type.spec.preserveOnSplitAtEnd ? null : tag;
        if (!nextTag || !schema.canContain(p.parent.node.type, tag.type)) {
          if (!atEnd) return false;
          let defaultType = schema.defaultContentPlot(p.parent.node.type);
          if (defaultType) tag = schema.withMarksFrom(tag, defaultType);
          else return false;
        }
        tokens.splice(insert, 0, tag);
        if (p == after) break;
      }
    }
    let changes = [{
      from: from.pos,
      to: to.pos,
      insert: tokens
    }];
    if (from.isAtStart(before)) {
      let deflt = schema.defaultContentPlot(before.parent.node.type);
      if (deflt && !deflt.eq(before.node.tag))
        changes.unshift({
          from: before.before,
          to: before.start,
          insert: [schema.withMarksFrom(before.node.tag, deflt)]
        });
    }
    let changeSet = ChangeSet.create(state.doc, { correct: changes, local: true });
    return {
      changes: changeSet,
      selection: GardSelection.cursor(changeSet.mapPos(to.pos, 1)),
      scrollIntoView: true,
      userEvent: "split.textblock"
    };
  }
  function deleteSelection(state) {
    let { ranges } = state.selection;
    if (ranges.every((r) => r.from == r.to)) return false;
    return autoJoinBlocks(state, {
      changes: {
        correct: ranges.filter((r) => r.from < r.to).map((r) => ({ from: r.from, to: r.to, fit: true })),
        local: true
      },
      selection: (cx, changes) => state.selection instanceof GardSelection.Text ? GardSelection.near(cx, changes.mapPos(state.selection.head, -1), 1) : state.selection.map(changes, cx),
      scrollIntoView: true,
      userEvent: "delete.selection"
    });
  }
  function deleteEmptyPlot(state, dir = -1) {
    if (!state.selection.isCursor) return false;
    let plot = state.sel.head.parent;
    if (!plot.parent || plot.start < plot.end) return false;
    return {
      changes: { from: plot.before, to: plot.after, fit: true },
      selection: (cx, changes) => GardSelection.near(cx, changes.mapPos(state.selection.head), dir),
      scrollIntoView: true,
      userEvent: dir < 0 ? "delete.backward" : "delete.forward"
    };
  }
  function joinBackward(state) {
    if (!state.selection.isCursor) return false;
    let { head } = state.sel, block = head.textblockParent;
    if (!block || !head.isAtStart(block) || block.node.type.isolating) return false;
    let scan = block, target = scan.node;
    while (!scan.index) {
      if (!scan.parent) return false;
      scan = scan.parent;
      if (scan.node.type.isolating || !scan.node.isBlock) return false;
    }
    let before = scan.previousSibling, parent = scan.parent.node, pos = scan.start - 1;
    while (before.isLeaf || !before.isTextblock) {
      if (before.isLeaf || state.isAtom(before.type) || before.type.isolating || !before.isBlock) return false;
      let last = before.content.length - 1;
      if (last < 0) return false;
      parent = before;
      before = before.content[last];
      pos--;
    }
    let { schema } = state.doc;
    let changes = [
      joinBlocks(state.doc.resolve(pos - 1).parent, block),
      clearNonFitting(schema, block, before.type)
    ];
    if (!before.content.length && !before.tag.eq(target.tag) && schema.canContain(parent.type, target.type))
      changes.push({
        from: pos - before.length,
        to: pos - before.length + 1,
        insert: [schema.withMarksFrom(before.tag, target.tag)]
      });
    let changeSet = ChangeSet.create(state.doc, changes);
    return {
      changes: changeSet,
      selection: GardSelection.cursor(changeSet.mapPos(head.pos), -1),
      scrollIntoView: true,
      userEvent: "join.backward"
    };
  }
  function joinListItems(state) {
    if (!state.selection.isCursor) return false;
    let { head } = state.sel;
    if (head.index || head.inText) return false;
    for (let scan = head.parent; ; ) {
      let next = scan.parent;
      if (!next) return false;
      if (scan.node.isBlock && next.node.type.hasRole(Node.Role.List)) {
        const prev = scan.previousSibling;
        if (!prev || !prev.isLeaf && scan.node.content.some((ch) => !state.schema.canContain(prev.type, ch.type))) return false;
        return {
          changes: { from: scan.before - 1, to: scan.before + 1 },
          userEvent: "join.backward.list",
          scrollIntoView: true
        };
      }
      if (scan.index) return false;
      scan = next;
    }
  }
  function joinForward(state) {
    if (!state.selection.isCursor) return false;
    let { head } = state.sel, block = head.textblockParent;
    if (!block || !head.isAtEnd(block) || block.node.type.isolating) return false;
    let scan = block, target = scan.node;
    for (; ; ) {
      if (!scan.parent) return false;
      if (scan.index < scan.parent.node.content.length - 1) break;
      scan = scan.parent;
      if (scan.node.type.isolating || !scan.node.isBlock) return false;
    }
    let after = scan.nextSibling, parent = scan.parent.node, pos = scan.after;
    while (after.isLeaf || !after.isTextblock) {
      if (after.isLeaf || after.type.isolating || state.isAtom(after.type) || !after.isBlock || !after.content.length)
        return false;
      parent = after;
      after = after.content[0];
      pos++;
    }
    let blockAfter = state.doc.resolveNode(pos);
    let { schema } = state.doc;
    let changes = [
      joinBlocks(block, blockAfter),
      clearNonFitting(schema, blockAfter, target.type)
    ];
    if (!target.content.length && !target.tag.eq(after.tag) && schema.canContain(parent.type, after.type))
      changes.push({
        from: block.before,
        to: block.start,
        insert: [schema.withMarksFrom(target.tag, after.tag)]
      });
    return {
      changes,
      scrollIntoView: true,
      userEvent: "join.forward"
    };
  }
  function deleteBackward(state, word = false) {
    if (!state.selection.isCursor) return false;
    let sel = state.sel;
    let { parent: scan, index, pos } = sel.head;
    if (!sel.head.inText) while (!index) {
      if (scan.node.type.isolating || !scan.parent || !scan.node.contentLength && scan.node.isInline)
        return false;
      index = scan.index;
      scan = scan.parent;
      pos--;
    }
    let next = sel.head.inText ? sel.head.nodeBefore : scan.node.content[--index];
    for (; ; ) {
      if (next.isPlot && next.type.isolating) return false;
      if (next.isLeaf || state.isAtom(next.type) || !next.content.length) break;
      next = next.content[next.content.length - 1];
      pos--;
    }
    if (next.is(Leaf.Text)) {
      let size = 0;
      if (word) {
        for (let i = next.param.length, type; ; ) {
          let ch = next.param[i - 1];
          if (/\s/.test(ch)) {
            if (type) break;
          } else {
            let next2 = /[\p{Alphabetic}\p{Number}]/u.test(ch) ? "a" : "p";
            if (!type) type = next2;
            else if (type != next2) break;
          }
          i--;
          size++;
          if (i == 0) {
            if (!index) break;
            next = scan.node.content[--index];
            if (!next.is(Leaf.Text)) break;
            i = next.param.length;
          }
        }
      } else {
        size = next.length - findClusterBreak(next.param, next.length, false);
      }
      return {
        changes: { from: pos - size, to: pos },
        scrollIntoView: true,
        userEvent: "delete.backward"
      };
    }
    let from = pos - next.length, to = pos;
    let parent = state.doc.resolve(pos).parent;
    if (next.isBlock) while (parent && parent.node.isBlock && parent.node.content.length == 1) {
      if (!parent.parent) return false;
      parent = parent.parent;
      from--;
      to++;
    }
    return {
      changes: { from, to },
      scrollIntoView: true,
      userEvent: "delete.backward"
    };
  }
  function deleteForward(state, word = false) {
    if (!state.selection.isCursor) return false;
    let sel = state.sel;
    let { parent: scan, index, pos } = sel.head;
    if (!sel.head.inText) while (index == scan.node.content.length) {
      if (scan.node.type.isolating || !scan.parent || !scan.node.contentLength && scan.node.isInline) return false;
      index = scan.index + 1;
      scan = scan.parent;
      pos++;
    }
    let next = sel.head.inText ? sel.head.nodeAfter : scan.node.content[index];
    for (; ; ) {
      if (next.isPlot && next.type.isolating) return false;
      if (next.isLeaf || state.isAtom(next.type) || !next.content.length) break;
      next = next.content[0];
      pos++;
    }
    if (next.is(Leaf.Text)) {
      let size = 0;
      if (word) {
        for (let i = 0, type; ; ) {
          let ch = next.param[i];
          if (/\s/.test(ch)) {
            if (type) break;
          } else {
            let next2 = /[\p{Alphabetic}\p{Number}]/u.test(ch) ? "a" : "p";
            if (!type) type = next2;
            else if (type != next2) break;
          }
          i++;
          size++;
          if (i == next.param.length) {
            if (index == scan.node.content.length - 1) break;
            next = scan.node.content[++index];
            if (!next.is(Leaf.Text)) break;
            i = 0;
          }
        }
      } else {
        size = findClusterBreak(next.param, 0);
      }
      return {
        changes: { from: pos, to: pos + size },
        scrollIntoView: true,
        userEvent: "delete.forward"
      };
    }
    let from = pos, to = pos + next.length;
    let parent = state.doc.resolve(pos).parent;
    if (next.isBlock) while (parent && parent.node.isBlock && parent.node.content.length == 1) {
      if (!parent.parent) return false;
      parent = parent.parent;
      from--;
      to++;
    }
    return {
      changes: { from, to },
      scrollIntoView: true,
      userEvent: "delete.forward"
    };
  }
  function selectedTextblocks(state) {
    let textblocks = [], lastBlock = -1;
    for (let { from, to } of state.selection.ranges) {
      state.doc.iterate(from, to, (node, pos, parent) => {
        if (node.isPlot && node.isTextblock && pos > lastBlock) {
          textblocks.push(state.doc.resolveNode(pos));
          lastBlock = pos;
        }
      });
    }
    return textblocks;
  }
  function clearNonFitting(schema, node, type) {
    let changes = [];
    for (let i = 0, pos = node.start; i < node.node.content.length; i++) {
      let child = node.node.content[i], end = pos + child.length;
      if (!schema.canContain(type, child.type)) changes.push({ from: pos, to: end });
      pos = end;
    }
    return changes;
  }
  function findWrappable(from, to, wrapper) {
    let dFrom = from.depth, dTo = to.depth;
    let pFrom = from.parent, pTo = to.parent;
    while (dFrom > dTo) {
      pFrom = pFrom.parent;
      dFrom--;
    }
    while (dTo > dFrom) {
      pTo = pTo.parent;
      dTo--;
    }
    let { schema } = from.doc;
    for (; ; ) {
      if (!pFrom.parent || pFrom.node.type.isolating) return null;
      if (pFrom.parent.start == pTo.parent.start && schema.canContain(pFrom.parent.node.type, wrapper.type)) break;
      pFrom = pFrom.parent;
      pTo = pTo.parent;
    }
    for (let i = pFrom.index; i < pTo.index + 1; i++) {
      let ch = pFrom.parent.node.content[i];
      if (!schema.findWrapping(wrapper.type, ch.type)) return null;
    }
    return {
      from: Pos.create(pFrom.parent, pFrom.before, pFrom.index, 0),
      to: Pos.create(pFrom.parent, pTo.after, pTo.index + 1, 0)
    };
  }
  function wrapBlockRange(range, wrapper) {
    let changes = [], parent = range.from.parent.node;
    for (let i = range.from.index, openWrappers = 0, pos = range.from.pos; ; i++) {
      let tokens = [];
      for (let j = 0; j < openWrappers; j++) tokens.push(Plot.End);
      if (i == range.from.index) {
        tokens.push(wrapper);
      } else if (i == range.to.index) {
        tokens.push(Plot.End);
        changes.push({ from: pos, insert: tokens });
        break;
      }
      let child = parent.content[i];
      let { schema } = range.from.doc;
      let wrapping = schema.findWrapping(wrapper.type, child.type);
      for (let tag of wrapping) tokens.push(tag);
      openWrappers = wrapping.length;
      changes.push({ from: pos, insert: tokens });
      pos += child.length;
    }
    return changes;
  }
  function textblockChild(schema, type) {
    let wrap = schema.findWrapping(type, Leaf.Text);
    return wrap && wrap.length == 1 ? wrap[0] : null;
  }
  function findUnwrappable(schema, from, to, query) {
    let dFrom = from.depth, dTo = to.depth;
    let fromStart = from.parent.node.inlineContent ? from.parent.start : from.pos;
    let fromTextblock = from.textblockParent?.node.type;
    let toEnd = to.parent.node.inlineContent ? to.parent.end : to.pos;
    let innerCandidates = [];
    let outerCandidates = [];
    let { doc: doc2 } = from;
    doc2.iterate(fromStart, toEnd, (node, p, parent) => {
      if (node.isBlock && node.isPlot && !node.inlineContent && parent && (fromTextblock ? doc2.schema.canContain(parent.type, fromTextblock) : textblockChild(doc2.schema, parent.type)) && (!query || schema.matchNode(node.type, query))) {
        let pos = doc2.resolveNode(p), depth2 = pos.depth;
        if (pos.before >= fromStart - (dFrom - depth2 + 1) && pos.after <= toEnd + (dTo - depth2 + 1))
          innerCandidates.push(pos);
        else
          outerCandidates.push(pos);
      }
    });
    let candidates = innerCandidates.length ? innerCandidates.sort((a, b) => b.after - b.before - (a.after - a.before)) : outerCandidates.sort((a, b) => a.after - a.before - (b.after - b.before));
    if (!candidates.length) return null;
    for (let i = 1; i < candidates.length; i++) {
      let cur = candidates[i];
      for (let j = 0; j < i; j++) {
        let other = candidates[j];
        if (cur.after > other.before && cur.before < other.after) {
          candidates.splice(i--, 1);
          break;
        }
      }
    }
    return candidates;
  }
  function doUnwrapBlock(block, from, to) {
    let changes = [], { schema } = block.doc;
    let outer = block.parent.node, wrapText = textblockChild(schema, outer.type);
    let gapStart = block.before;
    let skippedDepth = 0;
    let replaceGap = (to2, tokens) => {
      for (let i = 0; i < skippedDepth; i++) tokens.unshift(Plot.End);
      skippedDepth = 0;
      if (to2 > gapStart || tokens.length)
        changes.push({ from: gapStart, to: to2, insert: tokens });
    };
    let parent = block, index = 0, pos = block.start;
    for (; ; ) {
      if (index == parent.node.content.length) {
        if (parent == block) {
          let tokens = [];
          if (gapStart == block.before && outer.content.length == 1) {
            let deflt = schema.createDefault(outer.type);
            if (deflt) tokens.push(deflt);
          }
          replaceGap(block.after, tokens);
          break;
        } else {
          if (gapStart == pos && skippedDepth > 0) {
            gapStart++;
            skippedDepth--;
          }
          pos++;
          index = parent.index + 1;
          parent = parent.parent;
        }
      } else {
        let next = parent.node.content[index];
        if (schema.canContain(outer.type, next.type) || wrapText && next.isPlot && next.inlineContent) {
          if (from != null && pos + next.length <= from) {
            pos += next.length;
            gapStart = pos;
            skippedDepth = 1;
            for (let cx = parent; cx != block; cx = cx.parent) skippedDepth++;
            index++;
          } else if (to != null && pos >= to) {
            let tokens = [], upto = pos;
            for (let cx = parent, i = tokens.length, atStart = !index; ; cx = cx.parent) {
              if (cx.index > 0) atStart = false;
              if (atStart) upto--;
              else tokens.splice(i, 0, cx.node.tag.split(false));
              if (cx == block) break;
            }
            replaceGap(upto, tokens);
            break;
          } else {
            if (schema.canContain(outer.type, next.type)) {
              replaceGap(pos, []);
            } else {
              replaceGap(pos + 1, [wrapText]);
              changes.push(clearNonFitting(schema, Pos.Plot.create(parent, next, pos, index), wrapText.type));
            }
            pos += next.length;
            index++;
            gapStart = pos;
          }
        } else if (next.isLeaf || next.type.isolating) {
          pos += next.length;
          index++;
        } else {
          parent = Pos.Plot.create(parent, next, pos, index);
          index = 0;
          pos++;
        }
      }
    }
    return changes;
  }
  function joinBlocks(before, after) {
    let changes = [{ from: before.end, to: after.start }];
    let dBefore = before.depth, dAfter = after.depth;
    let tokensAfter = [], posAfter = after.after, end = posAfter;
    if (dBefore > dAfter) {
      let extraContext = [];
      for (let i = dBefore - dAfter, level = before.parent; i > 0; i--, level = level.parent)
        extraContext.push(level.node.tag);
      let nodeAfter = after.nextSibling;
      for (let i = dBefore - dAfter - 1, joining = true; i >= 0; i--) {
        let context = extraContext[i];
        if (!joining || !nodeAfter || nodeAfter.isLeaf || nodeAfter.type != context.type || !context.type.spec.autoJoin || typeof context.type.spec.autoJoin == "function" && !context.type.spec.autoJoin(context, nodeAfter.tag))
          joining = false;
        if (joining) end++;
        else tokensAfter.push(Plot.End);
      }
    } else if (dAfter > dBefore) {
      for (let i = dAfter - dBefore, level = after, atEnd = true; i > 0; i--, level = level.parent) {
        if (level.nextSibling) atEnd = false;
        if (atEnd) end++;
        else tokensAfter.unshift(level.parent.node.tag);
      }
    }
    if (tokensAfter.length || end > posAfter)
      changes.push({ from: posAfter, to: end, insert: tokensAfter });
    return changes;
  }
  function canAddMarkInRange(doc2, from, to, mark) {
    let found = false, type = mark instanceof Mark.Type ? mark : mark.type;
    doc2.iterate(from, to, (node) => {
      if (found || mark.isInSet(node.tag.marks)) return false;
      if (doc2.schema.markAllowed(type, node.type)) found = true;
      return true;
    });
    return found;
  }
  function autoJoinBlocks(state, tr) {
    if (!tr.changes) return tr;
    let changes = ChangeSet.create(state.doc, tr.changes), doc2 = changes.apply(state.doc);
    if (changes.empty) return tr;
    let append = [];
    let cursor = doc2.resolve(0), check = (pos) => {
      cursor = cursor.advance(pos - cursor.pos);
      let before = cursor.nodeBefore, after = cursor.nodeAfter;
      if (before && after && before.isPlot && before.isBlock && after.isPlot && after.type == before.type) {
        let { autoJoin: autoJoin2 } = after.type.spec;
        if (autoJoin2 && (typeof autoJoin2 != "function" || autoJoin2(before.tag, after.tag))) {
          let from = pos - 1, to = pos + 1;
          for (; ; ) {
            let last = before.lastChild, first = after.firstChild;
            if (!first || !last || first.isLeaf || last.isLeaf || first.type != last.type || first.isInline) break;
            autoJoin2 = last.type.spec.autoJoin;
            if (!autoJoin2 || typeof autoJoin2 == "function" && !autoJoin2(last.tag, first.tag)) break;
            from--, to++;
            before = last;
            after = first;
          }
          append.push({ from, to });
        }
      }
    };
    changes.iterGaps(() => {
    }, (_fromA, _toA, fromB, toB) => {
      check(fromB);
      if (toB > fromB) check(toB);
    });
    if (!append.length) return { ...tr, changes };
    return Transaction.merge(state, tr, { changes: append, sequential: true });
  }

  // vendor/wordgard/src/command/commands.ts
  var insertText = ({ state }, { from, to, insert, userEvent }) => {
    if (state.readOnly) return false;
    let { selection } = state;
    let marks = from == selection.from && to == selection.to && state.sel.activeMarks || state.doc.resolve(from).marks(state.doc.resolve(to));
    return {
      changes: { from, to, insert: [Leaf.Text.of(insert, marks)], fit: true },
      scrollIntoView: true,
      selection: (cx, changes) => GardSelection.near(cx, changes.mapPos(to, 1), -1),
      userEvent
    };
  };
  var insertLineBreak = ({ state }) => {
    if (state.readOnly) return false;
    let { doc: doc2, sel } = state;
    let brk = doc2.schema.lineBreak, parent = sel.from.parent.node.type;
    let { from, to } = state.selection.replacementRange;
    let insertBreak = brk && doc2.schema.canContain(parent, brk.type);
    if (!(insertBreak || parent.preserveWhitespace && sel.to.parent.start == sel.from.parent.start)) return false;
    let insert = insertBreak ? brk.withMarks(state.sel.activeMarks) : Leaf.text("\n", state.sel.activeMarks);
    let changes = ChangeSet.create(state.doc, { from, to, insert: [insert], fit: true });
    let pos = changes.findInserted((t) => insertBreak ? t.type == brk.type : t.isText);
    return {
      changes,
      selection: GardSelection.cursor(pos == null ? from : pos + 1, -1),
      scrollIntoView: true,
      userEvent: insertBreak ? "insert.linebreak" : "input"
    };
  };
  var enter = ({ state }) => {
    if (state.readOnly) return false;
    let { sel, doc: doc2 } = state;
    if (!sel.head.parent.node.inlineContent || !sel.anchor.parent.node.inlineContent) {
      let { from, to } = sel.replacementRange;
      let wrap = doc2.schema.findWrapping(from.parent.node.type, Leaf.Text);
      if (!wrap) return false;
      let content = [];
      for (let i = wrap.length - 1; i >= 0; i--) content = [wrap[i].create(content)];
      let changes = ChangeSet.create(state.doc, { from: from.pos, to: to.pos, insert: content, fit: true });
      let placed = content.length ? changes.findInserted((t) => t == content[0].tag) : null;
      return {
        changes,
        selection: placed != null ? ((cx) => GardSelection.near(cx, placed + wrap.length, -1)) : void 0,
        scrollIntoView: true,
        userEvent: "insert.textblock"
      };
    }
    return enterInCode(state) || liftEmptyBlock(state) || splitTextblock(state);
  };
  var deleteUnit = ({ state }, dir) => {
    if (state.readOnly) return false;
    return deleteSelection(state) || (dir == "forward" ? joinForward(state) || deleteForward(state) || deleteEmptyPlot(state, 1) : joinListItems(state) || joinBackward(state) || deleteBackward(state) || deleteEmptyPlot(state, -1));
  };
  var deleteWord = ({ state }, dir) => {
    if (state.readOnly) return false;
    return deleteSelection(state) || (dir == "forward" ? joinForward(state) || deleteForward(state, true) || deleteEmptyPlot(state, 1) : joinListItems(state) || joinBackward(state) || deleteBackward(state, true) || deleteEmptyPlot(state, -1));
  };
  var deleteToLineEnd = (wg, dir) => {
    if (wg.state.readOnly) return false;
    let tr = deleteSelection(wg.state), { selection } = wg.state;
    if (tr) return tr;
    if (!(selection instanceof GardSelection.Text)) return false;
    let end = wg.moveToLineBoundary(selection, dir == "forward");
    if (!end || end.head == selection.head) return false;
    return {
      changes: { correct: dir == "forward" ? { from: selection.head, to: end.head } : { from: end.head, to: selection.head } },
      scrollIntoView: true,
      userEvent: "delete." + dir
    };
  };
  var addToKillBuffer = Transaction.Effect.define();
  var killBuffer = GardState.Field.define({
    create() {
      return { content: [], active: false };
    },
    update(value, tr) {
      let add = tr.effects.find((e) => e.is(addToKillBuffer));
      if (add) return { content: value.active ? value.content.concat(add.value) : add.value, active: true };
      return !value.active || tr.annotation(Transaction.remote) || !(tr.docChanged || tr.selection) ? value : { content: value.content, active: false };
    }
  });
  function killText(state, from, to) {
    let add = addToKillBuffer.of(state.doc.slice(from, to));
    return state.field(killBuffer, false) ? [add] : [GardState.appendConfig.of(killBuffer), add];
  }
  var killToLineEnd = (wg) => {
    let { state } = wg, { selection } = state;
    if (state.readOnly || !(selection instanceof GardSelection.Text)) return false;
    let end = wg.moveToLineBoundary(selection, true);
    if (!end) return false;
    if (end.head > selection.head) return {
      changes: { correct: { from: selection.head, to: end.head } },
      scrollIntoView: true,
      effects: killText(state, selection.head, end.head),
      userEvent: "delete.forward"
    };
    let join = joinForward(state);
    if (join) {
      let joinEnd;
      state.doc.iterate(state.sel.head.textblockParent.after, state.doc.length, (node, pos) => {
        if (joinEnd != null) return false;
        if (node.isPlot && node.isTextblock) joinEnd = pos + 1;
      });
      return Transaction.merge(state, join, {
        effects: joinEnd == null ? void 0 : killText(state, selection.head, joinEnd)
      });
    }
    let next = state.sel.head.nodeAfter;
    if (next) return {
      changes: { correct: { from: selection.head, to: selection.head + next.length } },
      scrollIntoView: true,
      effects: killText(state, selection.head, selection.head + next.length),
      userEvent: "delete.forward"
    };
    return false;
  };
  var yankKilled = (wg) => {
    let { state } = wg, buffer = wg.state.field(killBuffer, false);
    if (!buffer || !buffer.content.length || !(state.selection instanceof GardSelection.Text)) return false;
    let { selection } = state;
    return {
      changes: { correct: { from: selection.from, to: selection.to, insert: buffer.content } },
      scrollIntoView: true,
      selection: (cx, changes) => GardSelection.near(cx, changes.mapPos(selection.from, 1)),
      userEvent: "input.yank"
    };
  };
  var deleteLine = (wg) => {
    if (wg.state.readOnly) return false;
    let tr = deleteSelection(wg.state), { selection } = wg.state;
    if (tr) return tr;
    if (!(selection instanceof GardSelection.Text)) return false;
    let start = wg.moveToLineBoundary(selection, false), end = wg.moveToLineBoundary(selection, true);
    if (!start || !end || start.head >= end.head) return false;
    return {
      changes: { correct: { from: start.head, to: end.head } },
      scrollIntoView: true,
      userEvent: "delete.line"
    };
  };
  var transposeChars = ({ state }) => {
    if (state.readOnly || !state.selection.isCursor) return false;
    let { sel } = state, head = state.selection.head;
    let before = sel.head.nodeBefore, after = sel.head.nodeAfter;
    if (!before || !before.is(Leaf.Text) || !after || !after.is(Leaf.Text)) return false;
    let lenBefore = before.param.length - findClusterBreak(before.param, before.param.length, false);
    let lenAfter = findClusterBreak(after.param, 0);
    return {
      changes: [
        { from: head - lenBefore, to: head },
        { from: head + lenAfter, insert: [Leaf.text(before.param.slice(before.param.length - lenBefore))] }
      ],
      selection: GardSelection.cursor(head + lenAfter, -1),
      scrollIntoView: true,
      userEvent: "transpose"
    };
  };
  var setTextblockType = ({ state }, tag) => {
    if (state.readOnly) return false;
    let changes = [], { schema } = state.doc;
    for (let block of selectedTextblocks(state)) {
      if (!block.node.tag.eq(tag) && block.parent && schema.canContain(block.parent.node.type, tag.type)) {
        changes.push({ from: block.before, to: block.before + 1, insert: [schema.withMarksFrom(block.node.tag, tag)] });
        changes.push(clearNonFitting(schema, block, tag.type));
      }
    }
    if (!changes.length) return false;
    return autoJoinBlocks(state, { changes, scrollIntoView: true, userEvent: "settype" });
  };
  var unwrapBlock = ({ state }, query) => {
    if (state.readOnly) return false;
    let targets = [], changes = [];
    for (let { from, to } of state.selection.ranges) {
      if (!targets.some((t) => t.after > from && t.before < to)) {
        let result = findUnwrappable(state.schema, state.doc.resolve(from), state.doc.resolve(to), query ?? void 0);
        if (result) for (let node of result) {
          targets.push(node);
          changes.push(doUnwrapBlock(node, from, to));
        }
      }
    }
    if (!targets.length) return false;
    return autoJoinBlocks(state, {
      changes,
      scrollIntoView: true,
      userEvent: "unwrap"
    });
  };
  var wrapBlock = ({ state }, wrapper) => {
    if (state.readOnly) return false;
    let changes = [], lastTo = -1;
    for (let { from, to } of state.selection.ranges) {
      let range = findWrappable(state.doc.resolve(from), state.doc.resolve(to), wrapper);
      if (!range || range.from.pos < lastTo) continue;
      changes.push(wrapBlockRange(range, wrapper));
      lastTo = range.to.pos;
    }
    if (!changes.length) return false;
    return autoJoinBlocks(state, { changes, scrollIntoView: true, userEvent: "wrap" });
  };
  var toggleBlock = (target, tag) => {
    return unwrapBlock(target, tag) || wrapBlock(target, tag);
  };
  var toggleMark = ({ state }, mark) => {
    if (state.readOnly) return false;
    let { selection, doc: doc2 } = state;
    if (selection instanceof GardSelection.Text && selection.empty) {
      let selMarks = selection.marks || state.sel.head.marks(), add = !mark.isInSet(selMarks);
      let newMarks = add ? mark.addToSet(selMarks) : mark.removeFromSet(selMarks);
      return {
        selection: GardSelection.Text.create({
          anchor: selection.anchor,
          headSide: selection.headSide,
          goalColumn: selection.goalColumn,
          marks: newMarks
        }),
        userEvent: add ? "mark.add" : "mark.remove"
      };
    } else if (selection.ranges.some((r) => canAddMarkInRange(doc2, r.from, r.to, mark))) {
      return {
        changes: selection.ranges.map((r) => ({ from: r.from, to: r.to, add: mark })),
        userEvent: "mark.add"
      };
    } else {
      return {
        changes: selection.ranges.map((r) => ({ from: r.from, to: r.to, remove: mark })),
        userEvent: "mark.remove"
      };
    }
  };
  var toggleEmphasis = (target) => toggleMark(target, Emphasis);
  var toggleStrong = (target) => toggleMark(target, Strong);
  var toggleUnderline = (target) => toggleMark(target, Underline);
  var setAlignment = ({ state }, align) => {
    let { schema } = state.doc;
    if (state.readOnly || !schema.has(Alignment)) return false;
    if (align == "start") align = null;
    if (align == "left" || align == "right") align = ltrAtCursor(state) == (align == "left") ? null : "end";
    let changes = [];
    for (let block of selectedTextblocks(state)) {
      let cur = block.node.tag.mark(Alignment);
      if (cur != align && schema.markAllowed(Alignment, block.node.type))
        changes.push(align ? { from: block.before, add: Alignment.of(align) } : { from: block.before, remove: Alignment.of(cur) });
    }
    if (!changes.length) return false;
    return {
      changes,
      userEvent: "mark.set.alignment"
    };
  };
  var setDirection = ({ state }, dir) => {
    let { schema } = state.doc;
    if (state.readOnly || !schema.has(Direction)) return false;
    let changes = [];
    for (let block of selectedTextblocks(state)) {
      let cur = block.node.tag.mark(Direction);
      if (cur != dir && schema.markAllowed(Direction, block.node.type))
        changes.push(dir ? { from: block.before, add: Direction.of(dir) } : { from: block.before, remove: Direction.of(cur) });
    }
    if (!changes.length) return false;
    return {
      changes,
      userEvent: "mark.set.direction"
    };
  };
  var toggleList = ({ state }, listTag) => {
    if (state.readOnly) return false;
    let blocks = selectedTextblocks(state);
    if (!blocks.length) return false;
    return addList(state, blocks, listTag) || removeList(state, blocks, listTag);
  };
  var listIsActive = (listTag) => (state) => {
    return selectedTextblocks(state).every((b) => {
      let item = isListItem(b);
      return item && item.parent.node.type == listTag.type;
    });
  };
  function isListItem(node) {
    for (let first = true; ; ) {
      let { parent } = node;
      if (!parent) return null;
      if (parent.node.tag.type.hasRole(Node.Role.List)) return first ? node : null;
      first = node.isFirst;
      node = parent;
    }
  }
  function autoJoin(a, b) {
    let { autoJoin: autoJoin2 } = a.type.spec;
    return typeof autoJoin2 == "function" ? autoJoin2(a, b) : typeof autoJoin2 == "boolean" ? autoJoin2 : a.eq(b);
  }
  function addList(state, blocks, listTag) {
    let plan = [];
    let chBefore = /* @__PURE__ */ new Set(), chAfter = /* @__PURE__ */ new Set();
    let lastItem = -1, { schema } = state.doc;
    for (let block of blocks) {
      let item = isListItem(block), wrap;
      if (!item && block.parent && schema.canContain(block.parent.node.type, listTag.type) && ((wrap = schema.findWrapping(listTag.type, block.node.type)) && wrap.length == 1 || (wrap = schema.findWrapping(listTag.type, Leaf.Text)) && wrap.length == 1)) {
        chAfter.add(block.before);
        chBefore.add(block.after);
        plan.push({ wrap: block, item: wrap[0] });
        lastItem = block.before;
      } else if (item?.parent && item.parent.node.tag.type != listTag.type && schema.canContain(listTag.type, item.node.type) && item.parent.parent && schema.canContain(item.parent.parent.node.type, listTag.type) && item.before != lastItem) {
        chAfter.add(item.before);
        chBefore.add(item.after);
        if (item.isFirst) chAfter.add(item.parent.before);
        if (item.isLast) chBefore.add(item.parent.after);
        plan.push({ change: block, item });
        lastItem = item.before;
      }
    }
    if (!plan.length) return false;
    let changes = [];
    for (let step of plan) {
      if ("wrap" in step) {
        let { wrap, item } = step, prev, next;
        let openTo = item.isTextblock ? wrap.start : wrap.before, openFrom = wrap.before, open = [item];
        if (chBefore.has(wrap.before)) {
        } else if ((prev = wrap.previousSibling) && prev.tag.eq(listTag)) openFrom--;
        else open.unshift(listTag);
        changes.push({ from: openFrom, to: openTo, insert: open });
        let closeFrom = item.isTextblock ? wrap.end : wrap.after, closeTo = wrap.after, close = [Plot.End];
        if (chAfter.has(wrap.after)) {
        } else if ((next = wrap.nextSibling) && next.isPlot && next.type == listTag.type && autoJoin(next.tag, listTag))
          closeTo++;
        else close.push(Plot.End);
        changes.push({ from: closeFrom, to: closeTo, insert: close });
      } else {
        let { item } = step, prev, next;
        if (item.isFirst) {
          if (chBefore.has(item.before - 1))
            changes.push({ from: item.before - 1, to: item.before });
          else if ((prev = item.parent.previousSibling) && prev.tag.type == listTag.type)
            changes.push({ from: item.before - 2, to: item.before });
          else
            changes.push({ from: item.before - 1, to: item.before, insert: [listTag] });
        } else if (!chBefore.has(item.before)) {
          changes.push({ from: item.before, insert: [Plot.End, listTag] });
        }
        if (item.isLast) {
          if (chAfter.has(item.after + 1)) {
            changes.push({ from: item.after, to: item.after + 1 });
          } else if ((next = item.parent.nextSibling) && next.isPlot && autoJoin(next.tag, listTag)) {
            changes.push({ from: item.after, to: item.after + 2 });
          }
        }
      }
    }
    return { changes, userEvent: "wrap.list" };
  }
  function removeList(state, blocks, listTag) {
    let plan = [], lastItem = -1;
    let chBefore = /* @__PURE__ */ new Set(), chAfter = /* @__PURE__ */ new Set();
    let { schema } = state.doc;
    for (let block of blocks) {
      let item = isListItem(block);
      if (!item) continue;
      let list = item.parent, parent = list.parent, rewrap = null;
      if (parent && list.node.isPlot && list.node.type == listTag.type && item.before != lastItem && (item.node.isTextblock ? (rewrap = schema.defaultContentPlot(parent.node.type)) && rewrap.isTextblock : schema.canContain(parent.node.type, block.node.type))) {
        lastItem = item.before;
        plan.push({ item, rewrap });
        chAfter.add(item.before);
        chBefore.add(item.after);
      }
    }
    if (!plan.length) return false;
    let changes = [];
    for (let { item, rewrap } of plan) {
      let openFrom = item.before, openTo = item.start, open = rewrap ? [rewrap] : [];
      if (item.isFirst) openFrom--;
      else if (!chBefore.has(item.before)) open.unshift(Plot.End);
      changes.push({ from: openFrom, to: openTo, insert: open });
      let closeFrom = rewrap ? item.after : item.end, closeTo = item.after, close = [];
      if (item.isLast) closeTo++;
      else if (!chAfter.has(item.after)) close.push(listTag);
      changes.push({ from: closeFrom, to: closeTo, insert: close });
    }
    return { changes, userEvent: "unwrap.list" };
  }
  function setSelection(selection) {
    return {
      selection,
      scrollIntoView: true,
      userEvent: "select"
    };
  }
  function ltrAtCursor(state) {
    let block = state.sel.head.textblockParent;
    return block ? state.textblockLTR(block.node) : state.textLTR;
  }
  function isForward(dir, state) {
    return dir == "forward" ? true : dir == "backward" ? false : dir == "right" == ltrAtCursor(state);
  }
  function asTextSel(sel, forward) {
    if (sel instanceof GardSelection.Text)
      return sel.directional ? sel : forward ? GardSelection.range(sel.from, sel.to) : GardSelection.range(sel.to, sel.from);
    let { from, to } = sel.replacementRange;
    return forward ? GardSelection.range(from, to) : GardSelection.range(to, from);
  }
  function extendSel(base, head) {
    return GardSelection.range(base.anchor, head.head, head.headSide, head.goalColumn);
  }
  var moveByUnit = ({ state }, { dir, extend }) => {
    let forward = isForward(dir, state), selection = asTextSel(state.selection, forward);
    if (!selection.empty && !extend) {
      return setSelection(GardSelection.near(state, forward ? selection.to : selection.from, forward ? -1 : 1));
    } else {
      let next = selection.nextNormalCursor(state, forward);
      if (!next) return false;
      if (!extend) state.doc.iterate(Math.min(selection.head, next.head), Math.max(selection.head, next.head), (node, pos) => {
        if (node.type.isSelectable && state.isAtom(node.type))
          next = GardSelection.node(pos, node);
        if (node.isPlot) return !node.type.isolating;
      });
      return setSelection(extend ? extendSel(selection, next) : next);
    }
  };
  var moveByWord = ({ state }, { dir, extend }) => {
    let forward = dir == "right" == ltrAtCursor(state);
    let selection = asTextSel(state.selection, forward);
    let moved = selection.skipWord(state, forward);
    return moved ? setSelection(extend ? extendSel(selection, moved) : moved) : false;
  };
  function nextVertical(wg, sel, forward, distance, allowNode) {
    let next = wg.moveVertically(sel, forward, distance, allowNode);
    if (next) return next;
    let end = (forward ? GardSelection.atEnd : GardSelection.atStart)(wg.state);
    return end.head == wg.state.selection.head ? null : end;
  }
  var moveByLine = (wg, { dir, extend }) => {
    let { state } = wg, { selection } = state, forward = dir == "down";
    if (selection instanceof GardSelection.Node) {
      let next = !extend && GardSelection.near(state, forward ? selection.to : selection.from, forward ? -1 : 1);
      if (next && !state.doc.resolve(next.head).parent.node.inlineContent)
        return setSelection(GardSelection.cursor(next.head, next.headSide, selection.goalColumn));
      selection = GardSelection.cursor(forward ? selection.to : selection.from, void 0, selection.goalColumn);
    } else {
      selection = asTextSel(state.selection, forward);
    }
    let moved = nextVertical(wg, selection, forward, void 0, !extend);
    return moved ? setSelection(extend ? extendSel(selection, moved) : moved) : false;
  };
  function pageHeight(wg) {
    let marginTop = 0, marginBottom = 0;
    for (let source of wg.state.facet(wg.constructor.coveredMargins)) {
      let margins = source(wg);
      if (margins?.top) marginTop = Math.max(margins?.top, marginTop);
      if (margins?.bottom) marginBottom = Math.max(margins?.bottom, marginBottom);
    }
    return Math.max(10, Math.min(
      wg.scrollDOM.clientHeight - marginTop - marginBottom,
      (wg.dom.ownerDocument.defaultView || window).innerHeight
    ) - 10);
  }
  var moveByPage = (wg, { dir, extend }) => {
    let { state } = wg, forward = dir == "down", selection = asTextSel(state.selection, forward);
    let moved = selection.empty || extend ? nextVertical(wg, selection, forward, pageHeight(wg), !extend) : forward ? GardSelection.cursor(selection.to, -1) : GardSelection.cursor(selection.from, 1);
    return moved ? setSelection(extend ? extendSel(selection, moved) : moved) : false;
  };
  var moveToLineSide = (wg, { dir, extend }) => {
    let forward = isForward(dir, wg.state), selection = asTextSel(wg.state.selection, forward);
    let pos = wg.moveToLineBoundary(selection, forward);
    return pos ? setSelection(extend ? extendSel(selection, pos) : pos) : extend || selection.empty ? false : setSelection(GardSelection.near(wg.state, forward ? selection.to : selection.from));
  };
  var moveToTextblockSide = (wg, { dir, extend }) => {
    let { state } = wg, block = state.sel.head.textblockParent;
    if (!block) return false;
    let forward = isForward(dir, wg.state);
    let pos = forward ? GardSelection.atEnd(state, block) : GardSelection.atStart(state, block);
    return setSelection(extend ? extendSel(asTextSel(wg.state.selection, forward), pos) : pos);
  };
  var moveToDocSide = (target, { side, extend }) => {
    let { state } = target;
    let pos = side == "start" ? GardSelection.atStart(state) : GardSelection.atEnd(state);
    if (state.selection.empty && pos.head == state.selection.head) return false;
    return setSelection(extend ? extendSel(asTextSel(state.selection, side == "end"), pos) : pos);
  };
  var selectAll = ({ state }) => {
    return {
      selection: GardSelection.range(0, state.doc.length),
      userEvent: "select.all"
    };
  };
  var undo = () => false;
  var redo = () => false;

  // rich-text/wordgard-source/phrases.ts
  var phrases_exports = {};
  __export(phrases_exports, {
    PhraseSet: () => PhraseSet,
    phrases: () => phrases
  });

  // vendor/wordgard/src/phrases/phraseset.ts
  var phraseOverride = GardState.Facet.define({
    combine(records) {
      let map = /* @__PURE__ */ new Map();
      for (let i = records.length - 1; i >= 0; i--) {
        let { set, phrases: phrases2 } = records[i];
        let known = map.get(set);
        map.set(set, known ? { ...known, ...phrases2 } : phrases2);
      }
      return map;
    }
  });
  var PhraseSet = class _PhraseSet {
    constructor(phrases2) {
      __publicField(this, "phrases", phrases2);
      __publicField(this, "refs", /* @__PURE__ */ new Map());
    }
    /// Look up a translation for phrase with the given tag.
    ///
    /// If additional arguments are passed, they will be inserted in
    /// place of markers like `$1` (for the first value) and `$2`, etc.
    /// A single `$` is equivalent to `$1`, and `$$` will produce a
    /// literal dollar sign.
    get(state, tag, ...insert) {
      let override = state.facet(phraseOverride).get(this);
      let phrase = (override && override[tag]) ?? this.phrases[tag];
      if (insert.length) phrase = phrase.replace(/\$(\$|\d*)/g, (m, i) => {
        if (i == "$") return "$";
        let n = +(i || 1);
        return !n || n > insert.length ? m : insert[n - 1];
      });
      return phrase;
    }
    /// Create a reference to a phrase. Returns a function that can be
    /// called with an editor state to get the phrase text.
    ref(tag) {
      let found = this.refs.get(tag);
      if (!found) this.refs.set(tag, found = (state, ...insert) => this.get(state, tag, ...insert));
      return found;
    }
    /// Create a translation of this set. Adding the resulting extension
    /// to an editor configuration will cause access to the phrases in
    /// the set to return the translated text.
    translate(phrases2) {
      return phraseOverride.of({ set: this, phrases: phrases2 });
    }
    /// Create a partial translation of this set. The only difference
    /// with {@link PhraseSet.translate} is that this method won't cause
    /// a type error when you omit some tags.
    translatePartial(phrases2) {
      return phraseOverride.of({ set: this, phrases: phrases2 });
    }
    /// Define a new phrase set. Takes an object as argument that
    /// defines the default (usually English) text for all the tags in
    /// the set.
    static define(phrases2) {
      return new _PhraseSet(phrases2);
    }
    /// Check whether the phrase set configuration changed between the
    /// two given states. Can be useful to check whether some part of
    /// the interface needs to be redrawn.
    static didChange(a, b) {
      return a.facet(phraseOverride) != b.facet(phraseOverride);
    }
  };

  // vendor/wordgard/src/phrases/phrases.ts
  var phrases = PhraseSet.define({
    dialog_close: "close",
    // Key groups
    group_block: "Block-level editing",
    group_inline: "Inline editing",
    group_history: "Undo history",
    key_bindings: "Keyboard Shortcuts",
    show_keys: "Show keyboard shortcuts",
    // Menu/key labels
    overflow_more: "More",
    block_style: "Block style",
    toggle_strong: "Toggle strong emphasis",
    toggle_em: "Toggle emphasis",
    toggle_code: "Toggle code font",
    toggle_underline: "Toggle underline",
    toggle_strikethrough: "Toggle strikethrough",
    toggle_super: "Toggle superscript",
    toggle_sub: "Toggle subscript",
    link_target: "Link target",
    create_link: "Create link",
    insert_break: "Insert line break",
    text_color: "Text color",
    background_color: "Background color",
    undo: "Undo",
    redo: "Redo",
    paragraph: "Paragraph",
    code_block: "Code block",
    code_block_language: "Select code block language",
    heading_1: "Heading 1",
    heading_2: "Heading 2",
    heading_3: "Heading 3",
    heading_4: "Heading 4",
    heading_5: "Heading 5",
    heading_6: "Heading 6",
    toggle_bullet_list: "Toggle bullet list",
    toggle_ordered_list: "Toggle ordered list",
    toggle_quote: "Toggle blockquote",
    alignment: "Alignment",
    align_start: "Align text to block start",
    align_end: "Align text to block end",
    align_left: "Align text to the left",
    align_right: "Align text to the right",
    align_center: "Center text",
    text_dir: "Text direction",
    text_dir_ltr: "Left-to-right text",
    text_dir_rtl: "Right-to-left text",
    text_dir_auto: "Automatic text direction"
  });
  var imagePhrases = PhraseSet.define({
    group_image: "Image manipulation",
    insert_image: "Insert image",
    update_image: "Update image",
    update: "Update",
    insert: "Insert",
    cancel: "Cancel",
    inline: "Inline",
    figure: "Figure",
    figure_center: "Centered figure",
    figure_end: "Figure aligned to end",
    captioned: "Captioned",
    image_style: "Image style",
    uploading: "Uploading...",
    upload_failed: "Image upload failed",
    width: "Width in pixels",
    resize_up: "Make image larger",
    resize_down: "Make image smaller",
    upload_image: "Upload an image",
    image_source: "Image source",
    alt_text: "Alternative text",
    describe_image: "Describe the image",
    auto: "automatic"
  });
  var colorNames = PhraseSet.define({
    none: "none",
    black: "black",
    white: "white",
    grey: "grey",
    red_berry: "red berry",
    red: "red",
    orange: "orange",
    yellow: "yellow",
    green: "green",
    cyan: "cyan",
    cornflower: "cornflower",
    blue: "blue",
    purple: "purple",
    magenta: "magenta",
    dark: "dark",
    darker: "darker",
    darkest: "very dark",
    light: "light",
    lighter: "lighter",
    lightest: "very light"
  });
  var tablePhrases = PhraseSet.define({
    dimensions_title: "Table dimensions $1 by $2. Use arrow keys to change.",
    dimensions_live: "$1 by $2",
    insert_table: "Insert a table",
    modify_table: "Modify table",
    toggle_header: "Toggle header cells",
    add_row_above: "Add row above",
    add_row_below: "Add row below",
    delete_row: "Delete row",
    add_col_before: "Add column before",
    add_col_after: "Add column before",
    delete_col: "Delete column",
    merge_cells: "Merge cells",
    split_cell: "Split cell"
  });

  // vendor/wordgard/src/editor/keymap.ts
  var KeyBinding = class _KeyBinding {
    constructor(spec) {
      __publicField(this, "spec", spec);
      /// Bindings count as extensions and can be included in an editor
      /// configuration.
      __publicField(this, "extension");
      this.extension = _KeyBinding.source.of(this);
    }
    /// Define a binding.
    static of(spec) {
      return new _KeyBinding(spec);
    }
  };
  ((KeyBinding2) => {
    function handle(wg, event) {
      let map = getKeymap(wg.state);
      return runHandlers(map, event, wg);
    }
    KeyBinding2.handle = handle;
    KeyBinding2.keymap = GardState.Field.Derived.define((s) => {
      let bindings = s.facet(KeyBinding2.source);
      return s.facet(KeyBinding2.useDefaultKeymap) ? bindings.concat(KeyBinding2.defaultKeymap) : bindings;
    });
    KeyBinding2.source = GardState.Facet.define({
      enables: KeyBinding2.keymap
    });
    KeyBinding2.useDefaultKeymap = GardState.Facet.define({
      combine: (input) => input.length ? input[0] : true
    });
    const _Group = class _Group {
      constructor(description, rank) {
        __publicField(this, "description", description);
        __publicField(this, "rank", rank);
      }
      /// Define a key binding group.
      static define(spec) {
        return new _Group(spec.description, spec.rank || 1e3);
      }
    };
    __publicField(_Group, "Inline", new _Group(phrases.ref("group_inline"), 20));
    __publicField(_Group, "Block", new _Group(phrases.ref("group_block"), 30));
    __publicField(_Group, "History", new _Group(phrases.ref("group_history"), 70));
    let Group = _Group;
    KeyBinding2.Group = _Group;
    function lookupByDescription(state, desc) {
      return getDescMap(state).get(desc) || null;
    }
    KeyBinding2.lookupByDescription = lookupByDescription;
    KeyBinding2.defaultKeymap = [
      { key: "Enter", run: enter },
      {
        key: "Shift-Enter",
        run: insertLineBreak,
        description: phrases.ref("insert_break"),
        group: Group.Inline
      },
      { key: "Backspace", run: Command.bind(deleteUnit, "backward") },
      { key: "Delete", run: Command.bind(deleteUnit, "forward") },
      { key: "Ctrl-Backspace", mac: "Alt-Backspace", run: Command.bind(deleteWord, "backward") },
      { key: "Ctrl-Delete", mac: "Alt-Delete", run: Command.bind(deleteWord, "forward") },
      { mac: "Cmd-Backspace", run: Command.bind(deleteToLineEnd, "backward") },
      { mac: "Cmd-Delete", run: Command.bind(deleteToLineEnd, "forward") },
      {
        key: "ArrowLeft",
        run: Command.bind(moveByUnit, { dir: "left" }),
        shift: Command.bind(moveByUnit, { dir: "left", extend: true })
      },
      {
        key: "ArrowRight",
        run: Command.bind(moveByUnit, { dir: "right" }),
        shift: Command.bind(moveByUnit, { dir: "right", extend: true })
      },
      {
        key: "ArrowDown",
        run: Command.bind(moveByLine, { dir: "down" }),
        shift: Command.bind(moveByLine, { dir: "down", extend: true })
      },
      {
        key: "ArrowUp",
        run: Command.bind(moveByLine, { dir: "up" }),
        shift: Command.bind(moveByLine, { dir: "up", extend: true })
      },
      {
        key: "Mod-ArrowLeft",
        run: Command.bind(moveByWord, { dir: "left" }),
        shift: Command.bind(moveByWord, { dir: "left", extend: true })
      },
      {
        key: "Mod-ArrowRight",
        run: Command.bind(moveByWord, { dir: "right" }),
        shift: Command.bind(moveByWord, { dir: "right", extend: true })
      },
      {
        mac: "Cmd-ArrowLeft",
        run: Command.bind(moveToLineSide, { dir: "left" }),
        shift: Command.bind(moveToLineSide, { dir: "left", extend: true })
      },
      {
        mac: "Cmd-ArrowRight",
        run: Command.bind(moveToLineSide, { dir: "right" }),
        shift: Command.bind(moveToLineSide, { dir: "right", extend: true })
      },
      {
        mac: "Cmd-ArrowUp",
        run: Command.bind(moveToDocSide, { side: "start" }),
        shift: Command.bind(moveToDocSide, { side: "start", extend: true })
      },
      {
        mac: "Cmd-ArrowDown",
        run: Command.bind(moveToDocSide, { side: "end" }),
        shift: Command.bind(moveToDocSide, { side: "end", extend: true })
      },
      {
        mac: "Ctrl-ArrowUp",
        run: Command.bind(moveByPage, { dir: "up" }),
        shift: Command.bind(moveByPage, { dir: "up", extend: true })
      },
      {
        mac: "Ctrl-ArrowDown",
        run: Command.bind(moveByPage, { dir: "down" }),
        shift: Command.bind(moveByPage, { dir: "down", extend: true })
      },
      {
        key: "PageUp",
        run: Command.bind(moveByPage, { dir: "up" }),
        shift: Command.bind(moveByPage, { dir: "up", extend: true })
      },
      {
        key: "PageDown",
        run: Command.bind(moveByPage, { dir: "down" }),
        shift: Command.bind(moveByPage, { dir: "down", extend: true })
      },
      {
        key: "Home",
        run: Command.bind(moveToLineSide, { dir: "backward" }),
        shift: Command.bind(moveToLineSide, { dir: "backward", extend: true })
      },
      {
        key: "End",
        run: Command.bind(moveToLineSide, { dir: "forward" }),
        shift: Command.bind(moveToLineSide, { dir: "forward", extend: true })
      },
      {
        key: "Mod-Home",
        run: Command.bind(moveToDocSide, { side: "start" }),
        shift: Command.bind(moveToDocSide, { side: "start", extend: true })
      },
      {
        key: "Mod-End",
        run: Command.bind(moveToDocSide, { side: "end" }),
        shift: Command.bind(moveToDocSide, { side: "end", extend: true })
      },
      { key: "Mod-a", run: selectAll },
      { key: "Mod-z", run: undo, description: phrases.ref("undo"), group: Group.History },
      { key: "Mod-y", mac: "Mod-Shift-z", run: redo, description: phrases.ref("redo"), group: Group.History },
      { linux: "Ctrl-Shift-z", run: redo, description: phrases.ref("redo"), group: Group.History },
      // MacOS Emacs-ish bindings
      {
        mac: "Ctrl-b",
        run: Command.bind(moveByUnit, { dir: "backward" }),
        shift: Command.bind(moveByUnit, { dir: "backward", extend: true })
      },
      {
        mac: "Ctrl-f",
        run: Command.bind(moveByUnit, { dir: "forward" }),
        shift: Command.bind(moveByUnit, { dir: "forward", extend: true })
      },
      {
        mac: "Ctrl-p",
        run: Command.bind(moveByLine, { dir: "up" }),
        shift: Command.bind(moveByLine, { dir: "up", extend: true })
      },
      {
        mac: "Ctrl-n",
        run: Command.bind(moveByLine, { dir: "down" }),
        shift: Command.bind(moveByLine, { dir: "down", extend: true })
      },
      {
        mac: "Ctrl-a",
        run: Command.bind(moveToTextblockSide, { dir: "backward" }),
        shift: Command.bind(moveToTextblockSide, { dir: "backward", extend: true })
      },
      {
        mac: "Ctrl-e",
        run: Command.bind(moveToTextblockSide, { dir: "forward" }),
        shift: Command.bind(moveToTextblockSide, { dir: "forward", extend: true })
      },
      { mac: "Ctrl-d", run: Command.bind(deleteUnit, "forward") },
      { mac: "Ctrl-h", run: Command.bind(deleteUnit, "backward") },
      { mac: "Ctrl-k", run: killToLineEnd },
      { mac: "Ctrl-y", run: yankKilled },
      { mac: "Ctrl-Alt-h", run: Command.bind(deleteWord, "backward") },
      { mac: "Ctrl-o", run: insertLineBreak },
      { mac: "Ctrl-t", run: transposeChars },
      { mac: "Ctrl-v", run: Command.bind(moveByPage, { dir: "down" }) }
    ].map(KeyBinding2.of);
  })(KeyBinding || (KeyBinding = {}));
  var currentPlatform = browser_default.mac ? "mac" : browser_default.windows ? "win" : browser_default.linux ? "linux" : "key";
  function normalizeKeyName(name, platform) {
    const parts = name.split(/-(?!$)/);
    let result = parts[parts.length - 1];
    if (result == "Space") result = " ";
    else if (/^[A-Z]$/.test(result)) result = result.toLowerCase();
    let alt, ctrl, shift, meta;
    for (let i = 0; i < parts.length - 1; ++i) {
      const mod = parts[i];
      if (mod == "Cmd" || mod == "Meta") meta = true;
      else if (mod == "Alt") alt = true;
      else if (mod == "Ctrl") ctrl = true;
      else if (mod == "Shift") shift = true;
      else if (mod == "Mod") {
        if (platform == "mac") meta = true;
        else ctrl = true;
      } else throw new Error("Unrecognized modifier name: " + mod);
    }
    if (alt) result = "Alt-" + result;
    if (ctrl) result = "Ctrl-" + result;
    if (meta) result = (platform == "mac" ? "Cmd-" : "Meta-") + result;
    if (shift) result = "Shift-" + result;
    return result;
  }
  function modifiers(name, event, platform) {
    if (event.altKey) name = "Alt-" + name;
    if (event.ctrlKey) name = "Ctrl-" + name;
    if (event.metaKey) name = (platform == "mac" ? "Cmd-" : "Meta-") + name;
    if (event.shiftKey) name = "Shift-" + name;
    return name;
  }
  var NormalizedBinding = class {
    constructor(flags, name, command) {
      __publicField(this, "flags", flags);
      __publicField(this, "name", name);
      __publicField(this, "command", command);
    }
  };
  var keymapCache = /* @__PURE__ */ new WeakMap();
  function getKeymap(state) {
    let bindings = state.field(KeyBinding.keymap);
    let found = keymapCache.get(bindings);
    if (!found)
      keymapCache.set(bindings, found = buildKeymap(bindings, currentPlatform));
    return found;
  }
  var lookupCache = /* @__PURE__ */ new WeakMap();
  function getDescMap(state) {
    let bindings = state.field(KeyBinding.keymap);
    let map = lookupCache.get(bindings);
    if (!map) {
      lookupCache.set(bindings, map = /* @__PURE__ */ new Map());
      for (let binding of bindings) {
        let { description, shiftDescription } = binding.spec;
        if (description || shiftDescription) {
          let name = binding.spec[currentPlatform] || binding.spec.key;
          if (name && description)
            map.set(description, normalizeKeyName(name, currentPlatform));
          if (name && shiftDescription)
            map.set(shiftDescription, "Shift-" + normalizeKeyName(name, currentPlatform));
        }
      }
    }
    return map;
  }
  function bind(run) {
    return (wg) => Command.dispatch(wg, run);
  }
  function buildKeymap(bindings, platform) {
    let map = [];
    for (let { spec: b } of bindings) {
      let baseFlags = b.allowDefault ? 8 /* AllowDefault */ : 0;
      let key = b[platform] || b.key;
      if (b.char) {
        if (key) throw new Error("A key binding may not provide both a char and a key field");
        if (b.shift) throw new Error("Shift-modified bindings are not supported for char bindings");
        map.push(new NormalizedBinding(baseFlags | 1 /* Char */, b.char, bind(b.run)));
      }
      if (key)
        map.push(new NormalizedBinding(baseFlags | 2 /* Key */, normalizeKeyName(key, platform), bind(b.run)));
      if (key && b.shift)
        map.push(new NormalizedBinding(baseFlags | 2 /* Key */, normalizeKeyName("Shift-" + key, platform), bind(b.shift)));
      if (b.any)
        map.push(new NormalizedBinding(4 /* Any */, "", b.any));
    }
    return map;
  }
  function runHandlers(map, event, wg) {
    let key = event.key, charCode = key.codePointAt(0);
    let altGr = event.getModifierState("AltGraph"), fromCode = charKeyCodes[event.keyCode];
    let isChar = codePointSize2(charCode) == key.length;
    let char = isChar ? String.fromCodePoint(charCode) : null;
    let base = modifiers(key, event, currentPlatform);
    let fallback = isChar && !altGr && fromCode && fromCode != base ? modifiers(fromCode, event, currentPlatform) : null;
    let handled = false, didMatch = false, allowDefault = false;
    for (let binding of map) {
      let matched = binding.flags & 1 /* Char */ && (altGr || !event.ctrlKey && !event.metaKey) && binding.name == char || binding.flags & 2 /* Key */ && (binding.name == base || binding.name == fallback) || binding.flags & 4 /* Any */;
      if (matched) {
        didMatch = true;
        if (!handled && binding.command(wg, event)) {
          handled = true;
        } else if (binding.flags & 8 /* AllowDefault */) {
          allowDefault = true;
        }
      }
    }
    if (didMatch && !allowDefault) event.preventDefault();
    return handled;
  }
  function codePointSize2(code) {
    return code < 65536 ? 1 : 2;
  }
  function buildCharKeyCodes() {
    let result = {
      32: " ",
      59: ";",
      61: "=",
      106: "*",
      107: "+",
      108: ",",
      109: "-",
      110: ".",
      111: "/",
      173: "-",
      186: ";",
      187: "=",
      188: ",",
      189: "-",
      190: ".",
      191: "/",
      192: "`",
      219: "[",
      220: "\\",
      221: "]",
      222: "'"
    };
    for (var i = 0; i < 10; i++) result[48 + i] = String(i);
    for (var i = 1; i <= 24; i++) result[i + 111] = "F" + i;
    for (var i = 65; i <= 90; i++) result[i] = String.fromCharCode(i + 32);
    return result;
  }
  var charKeyCodes = buildCharKeyCodes();

  // vendor/wordgard/src/editor/input.ts
  var LOG_input = false;
  var eventHandler = GardState.Facet.define({
    combine: (handlers) => {
      let result = /* @__PURE__ */ Object.create(null);
      for (let { event, handler } of handlers)
        (result[event] || (result[event] = [])).push(handler);
      return result;
    }
  });
  var eventObserver = GardState.Facet.define({
    combine: (observers) => {
      let result = /* @__PURE__ */ Object.create(null);
      for (let { event, observer } of observers)
        (result[event] || (result[event] = [])).push(observer);
      return result;
    }
  });
  var compositionInputTypes = /* @__PURE__ */ new Set([
    "insertCompositionText",
    "deleteCompositionText",
    "insertFromComposition"
  ]);
  var InputState = class {
    constructor(wg) {
      __publicField(this, "wg", wg);
      __publicField(this, "shiftKey", false);
      __publicField(this, "lastKeyCode", 0);
      __publicField(this, "lastKeyTime", 0);
      __publicField(this, "lastTouchTime", 0);
      __publicField(this, "lastTouchEvent", null);
      __publicField(this, "lastScrollTop", 0);
      __publicField(this, "lastScrollLeft", 0);
      __publicField(this, "lastContextMenu", 0);
      __publicField(this, "scrollHandlers", []);
      __publicField(this, "handlers", /* @__PURE__ */ Object.create(null));
      // Track the current composition. Count changes to determine whether
      // a given change is the first one, and track the text node that
      // composition is happening in.
      __publicField(this, "composing", null);
      // End time of the previous composition
      __publicField(this, "compositionEndedAt", 0);
      // Used in a kludge to detect when an Enter keypress should be
      // considered part of the composition on Safari, which fires events
      // in the wrong order
      __publicField(this, "compositionPendingKey", false);
      __publicField(this, "wrappingComposition", null);
      __publicField(this, "mouseSelection", null);
      // When a drag from the editor is active, this points at the range
      // being dragged.
      __publicField(this, "draggedContent", null);
      __publicField(this, "notifiedFocused");
      __publicField(this, "suppressEvents", false);
      // Between beforeinput and input events, this holds information
      // about the event (because input events no longer provide range
      // information).
      __publicField(this, "pendingInputEvent", null);
      // When input events have changed the DOM, this holds the updated
      // document, which we need for the mapping done in `addDOMChange`.
      __publicField(this, "domDoc");
      // Mapping between `domDoc` and `state.doc`. See getter.
      __publicField(this, "_domMapping");
      // Tracks up to which index of `viewState.pending` `_domMapping` has
      // been updated.
      __publicField(this, "domMappingIndex", 0);
      // Mapping between the doc at the last flush and `domDoc`.
      __publicField(this, "domChanges", null);
      this.handleEvent = this.handleEvent.bind(this);
      this.notifiedFocused = wg.hasFocus;
      if (browser_default.safari) wg.contentDOM.addEventListener("input", () => null);
      this.domDoc = wg.state.doc;
      this._domMapping = ChangeSet.empty(this.domDoc.length);
    }
    handleEvent(event) {
      if (this.suppressEvents) return;
      if (!eventBelongsToEditor(this.wg, event) || this.ignoreDuringComposition(event)) return;
      if (event.type == "keydown" && this.keydown(event)) return;
      if (event.type == "keyup" && event.keyCode == 16) this.shiftKey = false;
      this.runHandlers(event.type, event);
    }
    runHandlers(type, event) {
      let handlers = this.handlers[type];
      if (handlers) {
        for (let observer of handlers.observers) observer(this.wg, event);
        for (let handler of handlers.handlers) {
          if (event.defaultPrevented) break;
          if (handler(this.wg, event)) {
            event.preventDefault();
            break;
          }
        }
      }
    }
    ensureHandlers(state) {
      let handlers = computeHandlers(state), prev = this.handlers, dom = this.wg.contentDOM;
      for (let type in handlers) if (type != "scroll") {
        let passive = !handlers[type].handlers.length;
        let exists = prev[type];
        if (exists && passive != !exists.handlers.length) {
          dom.removeEventListener(type, this.handleEvent);
          exists = null;
        }
        if (!exists) dom.addEventListener(type, this.handleEvent, { passive });
      }
      for (let type in prev) if (type != "scroll" && !handlers[type])
        dom.removeEventListener(type, this.handleEvent);
      this.handlers = handlers;
    }
    keydown(event) {
      LOG_input && console.log("keydown", event.key, ["shift", "alt", "ctrl", "meta"].filter((k) => event[k + "Key"]).join());
      this.lastKeyCode = event.keyCode;
      this.lastKeyTime = Date.now();
      this.shiftKey = event.keyCode == 16 || event.shiftKey;
      return false;
    }
    ignoreDuringComposition(event) {
      if (!/^key/.test(event.type)) return false;
      if (this.composing && this.composing.changes) return true;
      if (browser_default.safari && !browser_default.ios && this.compositionPendingKey && Date.now() - this.compositionEndedAt < 100) {
        this.compositionPendingKey = false;
        return true;
      }
      return false;
    }
    startMouseSelection(mouseSelection) {
      if (this.mouseSelection) this.mouseSelection.disconnect();
      this.mouseSelection = mouseSelection;
    }
    update(update) {
      if (this.mouseSelection) this.mouseSelection.update(update);
      if (this.draggedContent && update.docChanged) this.draggedContent = this.draggedContent.map(update.changes, update.state);
      if (update.transactions.length) this.lastKeyCode = 0;
      this.domDoc = update.state.doc;
      this._domMapping = ChangeSet.empty(this.domDoc.length);
      this.domMappingIndex = 0;
      this.domChanges = null;
    }
    // Create a position in `domDoc` from a DOM position. Needed in
    // order to interpret `beforeinput` event ranges and other DOM
    // positions when there are unflushed DOM changes.
    getDOMPos(node, offset) {
      if (!this.domChanges) return this.wg.docTile.posFromDOM(node, offset);
      if (node.nodeType == 1 && offset && node.childNodes[offset - 1].nodeType == 3) {
        node = node.childNodes[offset - 1];
        offset = node.nodeValue.length;
      }
      let inText = node.nodeType == 3 && !this.wg.docTile.nearest(node)?.isPoint;
      let ref = this.wg.docTile.posFromDOM(node, inText ? 0 : offset);
      let dir = -1;
      let textBefore = node.parentNode && textNodeBefore(node.parentNode, domIndex(node));
      let prev = textBefore && Tile2.get(textBefore);
      if (prev instanceof TextTile && prev.length < prev.dom.nodeValue.length) dir = 1;
      if (this.domChanges) ref = this.domChanges.mapPos(ref, dir);
      return ref + (inText ? offset : 0);
    }
    // Get the current mapping from `domDoc` to `state.doc`. Updated
    // lazily so that `addDOMChange` gets a chance to notice when DOM
    // changes and transaction changes match.
    get domMapping() {
      let { pending } = this.wg.viewState;
      while (this.domMappingIndex < pending.length)
        this._domMapping = this._domMapping.compose(pending[this.domMappingIndex++].changes);
      return this._domMapping;
    }
    get unflushedSelection() {
      let { pending } = this.wg.viewState;
      return pending.some((tr) => tr.selection && !tr.isUserEvent("input"));
    }
    // Assign a position (in `state.doc`) to the given DOM position.
    // Takes unflushed DOM changes into account.
    posAtDOM(node, offset, assoc = -1) {
      if (this.domMapping.empty && !this.domChanges)
        return this.wg.docTile.posFromDOM(node, offset);
      return this.domMapping.mapPos(this.getDOMPos(node, offset), assoc);
    }
    // Update the editor state for a beforeinput event.
    beforeInput(event, data) {
      let type = event.inputType, range;
      let { wg } = this, sel = wg.state.selection;
      if (data.domRange) {
        range = {
          from: this.domMapping.mapPos(data.domRange.from),
          to: this.domMapping.mapPos(data.domRange.to)
        };
        if (!this.domMapping.empty && type == "insertText" && !this.composing && range.from == range.to) {
          let fromMax = this.domMapping.mapPos(data.domRange.from, 1);
          if (range.from <= sel.from && fromMax >= sel.to)
            range = sel;
        }
      }
      let command = inputTypeCommands[type];
      if (isDeletionInputEvent(type) && range && (!command || range.from != range.to && // Always run the command for empty ranges
      !this.unflushedSelection && // Or if there is a selection-setting pending transaction
      (sel.empty ? !isSingleChar(this.domDoc, data.domRange.from, data.domRange.to) || sel.head != (type == "deleteContentBackward" ? range.to : range.from) : sel.from != range.from || sel.to != range.to))) {
        wg.dispatch({ changes: { from: range.from, to: range.to, fit: true }, userEvent: "delete" });
      } else if (command) {
        Command.dispatch(wg, command);
      } else if (type == "insertText") {
        let insert = event.data.replace(/\r\n?|\n/g, " ");
        let { from, to } = this.unflushedSelection ? wg.state.selection : range;
        Command.dispatch(wg, insertText, { from, to, insert, userEvent: "input.type" });
      } else if (type == "insertFromPaste") {
        let { from, to } = this.unflushedSelection ? wg.state.selection.replacementRange : range;
        let slice = readClipboard(wg.state, event.dataTransfer, wg.state.doc.resolve(from), wg.inputState.shiftKey);
        let isSel = from == wg.state.selection.replacementRange.from && to == wg.state.selection.replacementRange.to;
        if (isSel && wg.state.facet(pasteHandler).some((h) => h(wg, event, slice || Slice.empty)))
          return;
        if (slice) {
          wg.dispatch({
            changes: { correct: { from, to, insert: slice, fit: true }, local: true },
            selection: isSel ? (cx, changes) => GardSelection.near(cx, changes.mapPos(to, 1), -1) : void 0,
            userEvent: "input.paste",
            scrollIntoView: isSel
          });
        }
      } else if (type == "insertReplacementText" || type == "insertFromYank") {
        let read = readClipboard(wg.state, event.dataTransfer, wg.state.sel.head, true);
        let { from, to } = this.unflushedSelection ? wg.state.selection : range;
        let sel2 = wg.state.selection, touchesSel = from <= sel2.to && to >= sel2.from;
        if (read) wg.dispatch({
          changes: { from, to, insert: read, fit: true },
          selection: touchesSel ? (cx, changes) => {
            return GardSelection.near(cx, changes.mapPos(to, 1), -1);
          } : void 0,
          scrollIntoView: touchesSel,
          userEvent: "insert.replacementText"
        });
      } else if (compositionInputTypes.has(type)) {
        let compositionStart = true;
        if (wg.inputState.composing) {
          compositionStart = !wg.inputState.composing.changes;
          wg.inputState.composing.changes++;
        }
        let sel2 = wg.observer.selectionRange;
        if (!sel2.focusNode) return false;
        let userEvent = "input.type.compose" + (compositionStart ? ".start" : "");
        Command.dispatch(wg, insertText, { from: range.from, to: range.to, insert: event.data || "", userEvent });
      } else if (type == "formatSetBlockTextDirection") {
        if (event.data == "ltr" || event.data == "rtl")
          Command.dispatch(wg, setDirection, event.data);
      }
    }
    // Add a given DOM change (as made by an input event) to the tracked
    // DOM state. If there's a pending transaction that matches the
    // change, map `this._domMapping` and drop both. Otherwise, put the
    // inverse of this change at the start of `_domMapping`.
    addDOMChange(change) {
      let { pending } = this.wg.viewState, { domDoc } = this;
      try {
        this.domDoc = change.apply(domDoc);
      } catch (e) {
        if (!(e instanceof ValidationError)) throw e;
        this.wg.flush();
        return;
      }
      this.domChanges = this.domChanges ? this.domChanges.compose(change) : change;
      while (this.domMappingIndex < pending.length) {
        let next = pending[this.domMappingIndex];
        if (!next.docChanged) {
          this.domMappingIndex++;
        } else {
          let { a: mapping, b: expected } = ChangeSet.transform(domDoc, this._domMapping, change);
          if (next.changes.sections.length != expected.sections.length || next.changes.sections.some((v, i) => v != expected.sections[i]))
            break;
          this.domMappingIndex++;
          this._domMapping = mapping;
          return;
        }
      }
      this._domMapping = change.invert(domDoc).compose(this._domMapping);
    }
    findComposition(prev) {
      let { focusNode, focusOffset } = this.wg.observer.selectionRange;
      if (!focusNode) return null;
      let before = textNodeBefore(focusNode, focusOffset), after = textNodeAfter(focusNode, focusOffset);
      if (!before || !after || before == after) {
        return before || after;
      } else {
        let tileBefore = Tile2.get(before), tileAfter = Tile2.get(after);
        if (tileBefore instanceof TextTile && tileBefore.text != before.nodeValue) return before;
        if (tileAfter instanceof TextTile && tileAfter.text != after.nodeValue) return after;
        return !tileBefore ? before : !tileAfter ? after : prev == after ? after : before;
      }
    }
    getCompositionInfo(wg) {
      let wrap = this.wrappingComposition;
      if (wrap) {
        let sel = wg.state.selection.head;
        return {
          fromB: sel,
          toB: sel,
          text: "",
          target: null,
          wrapCursor: wrap
        };
      }
      let comp = this.composing;
      if (!comp || !(comp.target = this.findComposition(comp.target))) return null;
      let value = comp.target.nodeValue;
      let fromB = this.posAtDOM(comp.target, 0, 1), toB = fromB + value.length;
      let disrupted = false;
      this.domMapping.iterChanges((fA, tA, fB, tB) => {
        if (fB < toB && tB > fromB) disrupted = true;
      });
      return disrupted ? null : { fromB, toB, text: value, target: comp.target };
    }
    clearComposition() {
      let comp = this.composing;
      this.composing = null;
      this.compositionPendingKey = true;
      this.compositionEndedAt = Date.now();
      if (!comp.target) return false;
      let pos = this.posAtDOM(comp.target, 0, 1);
      this.wg.observer.addDirtyRange(pos, pos + comp.target.nodeValue.length);
      return true;
    }
    abortComposition() {
      if (!this.composing || !this.wg.hasFocus) return;
      this.clearComposition();
      this.wg.win.setTimeout(() => {
        this.suppressEvents = true;
        try {
          getSelection(this.wg.root)?.collapse(document.body, 0);
          let dummy = this.wg.win.document.body.appendChild(document.createElement("input"));
          dummy.focus();
          dummy.remove();
          this.wg.focus();
        } finally {
          this.suppressEvents = false;
        }
      }, 0);
    }
    recordTouch(e) {
      this.lastTouchTime = Date.now();
      this.lastTouchEvent = e;
    }
    connect() {
      this.ensureHandlers(this.wg.state);
    }
    disconnect() {
      if (this.mouseSelection) this.mouseSelection.disconnect();
    }
  };
  function isSingleChar(doc2, from, to) {
    if (to > from + 10) return false;
    let after = doc2.resolve(from).nodeAfter;
    return !!after && after.is(Leaf.Text) && from + findClusterBreak(after.param, 0) == to;
  }
  function inlineContext(doc2, range) {
    let from = doc2.resolve(range.from), to = doc2.resolve(range.to);
    return from.parent.node.inlineContent && to.parent.start == from.parent.start;
  }
  function bindHandler(handler) {
    return (wg, event) => {
      try {
        return handler(event, wg);
      } catch (e) {
        logException(wg.state, e);
      }
    };
  }
  function computeHandlers(state) {
    let result = /* @__PURE__ */ Object.create(null);
    function record(type) {
      return result[type] || (result[type] = { observers: [], handlers: [] });
    }
    let h = state.facet(eventHandler), o = state.facet(eventObserver);
    for (let type in h) for (let handler of h[type]) record(type).handlers.push(bindHandler(handler));
    for (let type in o) for (let observer of o[type]) record(type).observers.push(bindHandler(observer));
    for (let type in baseHandlers) record(type).handlers.push(baseHandlers[type]);
    for (let type in baseObservers) record(type).observers.push(baseObservers[type]);
    return result;
  }
  var dragScrollMargin = 6;
  var mouseSelectionStyle = GardState.Facet.define();
  function dragScrollSpeed(dist2) {
    return Math.max(0, dist2) * 0.7 + 8;
  }
  function dist(a, b) {
    return Math.max(Math.abs(a.clientX - b.clientX), Math.abs(a.clientY - b.clientY));
  }
  var MouseSelection = class {
    constructor(wg, startEvent, style, mustSelect) {
      __publicField(this, "wg", wg);
      __publicField(this, "startEvent", startEvent);
      __publicField(this, "style", style);
      __publicField(this, "mustSelect", mustSelect);
      __publicField(this, "dragging");
      __publicField(this, "extend");
      __publicField(this, "lastEvent");
      __publicField(this, "scrollParents");
      __publicField(this, "scrollSpeed", { x: 0, y: 0 });
      __publicField(this, "scrolling", -1);
      this.lastEvent = startEvent;
      this.scrollParents = scrollableParents(wg.contentDOM);
      let doc2 = wg.contentDOM.ownerDocument;
      doc2.addEventListener("mousemove", this.move = this.move.bind(this));
      doc2.addEventListener("mouseup", this.up = this.up.bind(this));
      this.extend = startEvent.shiftKey;
      this.dragging = isInPrimarySelection(wg, startEvent) && startEvent.detail == 1 ? null : false;
    }
    start(event) {
      if (this.dragging === false) this.select(event);
    }
    move(event) {
      if (event.buttons == 0) return this.disconnect();
      if (this.dragging || this.dragging == null && dist(this.startEvent, event) < 10) return;
      this.select(this.lastEvent = event);
      let sx = 0, sy = 0;
      let left = 0, top2 = 0, right = this.wg.win.innerWidth, bottom = this.wg.win.innerHeight;
      if (this.scrollParents.x) ({ left, right } = this.scrollParents.x.getBoundingClientRect());
      if (this.scrollParents.y) ({ top: top2, bottom } = this.scrollParents.y.getBoundingClientRect());
      let margins = this.wg.getScrollMargins();
      if (event.clientX - margins.left <= left + dragScrollMargin)
        sx = -dragScrollSpeed(left - event.clientX);
      else if (event.clientX + margins.right >= right - dragScrollMargin)
        sx = dragScrollSpeed(event.clientX - right);
      if (event.clientY - margins.top <= top2 + dragScrollMargin)
        sy = -dragScrollSpeed(top2 - event.clientY);
      else if (event.clientY + margins.bottom >= bottom - dragScrollMargin)
        sy = dragScrollSpeed(event.clientY - bottom);
      this.setScrollSpeed(sx, sy);
    }
    up(event) {
      if (this.dragging == null) this.select(this.lastEvent);
      if (!this.dragging) event.preventDefault();
      this.disconnect();
    }
    disconnect() {
      this.setScrollSpeed(0, 0);
      let doc2 = this.wg.dom.ownerDocument;
      doc2.removeEventListener("mousemove", this.move);
      doc2.removeEventListener("mouseup", this.up);
      this.wg.inputState.mouseSelection = this.wg.inputState.draggedContent = null;
    }
    setScrollSpeed(sx, sy) {
      this.scrollSpeed = { x: sx, y: sy };
      if (sx || sy) {
        if (this.scrolling < 0) this.scrolling = setInterval(() => this.scroll(), 50);
      } else if (this.scrolling > -1) {
        clearInterval(this.scrolling);
        this.scrolling = -1;
      }
    }
    scroll() {
      let { x, y } = this.scrollSpeed;
      if (x && this.scrollParents.x) {
        this.scrollParents.x.scrollLeft += x;
        x = 0;
      }
      if (y && this.scrollParents.y) {
        this.scrollParents.y.scrollTop += y;
        y = 0;
      }
      if (x || y) this.wg.win.scrollBy(x, y);
      if (this.dragging === false) this.select(this.lastEvent);
    }
    select(event) {
      let { wg } = this, selection = this.style.get(event, this.extend);
      if (this.mustSelect || !selection.eqPos(wg.state.selection))
        this.wg.dispatch({
          selection,
          userEvent: "select.pointer"
        });
      this.mustSelect = false;
    }
    update(update) {
      if (update.transactions.some((tr) => tr.isUserEvent("input.type")))
        this.disconnect();
      else if (this.style.update(update))
        setTimeout(() => this.select(this.lastEvent), 20);
    }
  };
  var dragBehavior = GardState.Facet.define();
  function dragMovesSelection(wg, event) {
    let facet = wg.state.facet(dragBehavior);
    return facet.length ? facet[0](event) : browser_default.mac ? !event.altKey : !event.ctrlKey;
  }
  function isInPrimarySelection(wg, event) {
    let { selection } = wg.state;
    if (selection.empty) return false;
    let sel = getSelection(wg.root);
    if (!sel || sel.rangeCount == 0) return true;
    let rects = sel.getRangeAt(0).getClientRects();
    for (let i = 0; i < rects.length; i++) {
      let rect = rects[i];
      if (rect.left <= event.clientX && rect.right >= event.clientX && rect.top <= event.clientY && rect.bottom >= event.clientY) return true;
    }
    return false;
  }
  var focusEvents = /* @__PURE__ */ new Set(["input", "beforeinput", "keydown", "keyup", "keypress", "copy", "cut", "paste"]);
  function eventBelongsToEditor(wg, event) {
    if (event.defaultPrevented) return false;
    if (!event.bubbles) return true;
    let active = wg.root.activeElement;
    for (let node = event.target, tile; node != wg.contentDOM; node = node.parentNode)
      if (!node || node.nodeType == 11 || (tile = Tile2.get(node)) && tile.ignoreEvent(event) || node == active && focusEvents.has(event.type))
        return false;
    return true;
  }
  function queryPos(wg, event) {
    return wg.posAtCoords({ x: event.clientX, y: event.clientY });
  }
  function basicMouseSelection(wg, event) {
    let start = queryPos(wg, event), type = event.detail;
    let startSel = wg.state.selection;
    return {
      update(update) {
        if (update.docChanged) {
          start = start.map(update.changes);
          startSel = startSel.map(update.changes, update.state);
        }
      },
      get(event2, extend) {
        let cur = queryPos(wg, event2), range = rangeForClick(wg, cur, type), { from, to } = range;
        if (extend) {
          let startAnchor = !(startSel instanceof GardSelection.Text) || startSel.directional ? startSel.anchor : from < startSel.from ? startSel.to : startSel.from;
          if (from < startSel.anchor)
            return GardSelection.range(startAnchor, from, from < to ? 1 : cur.side);
          else
            return GardSelection.range(startAnchor, to, from < to ? -1 : cur.side);
        }
        let { anchor, head } = range;
        if (start.pos != cur.pos) {
          let startRange = rangeForClick(wg, start, type);
          let from2 = Math.min(range.from, startRange.from), to2 = Math.max(range.to, startRange.to);
          if (startRange.from < range.from) {
            anchor = from2;
            head = to2;
          } else {
            anchor = to2;
            head = from2;
          }
        }
        return anchor == range.anchor && head == range.head ? range : GardSelection.range(anchor, head, head == cur.pos ? cur.side : void 0);
      }
    };
  }
  var dropHandler = GardState.Facet.define();
  var pasteHandler = GardState.Facet.define();
  function copy(wg, event) {
    let { state } = wg;
    if (!state.selection.empty && event.clipboardData) {
      let slice = state.selection.toSlice(state.doc);
      writeClipboard(state, slice, event.clipboardData);
      if (event.type == "cut" && !state.readOnly)
        wg.dispatch({
          changes: state.selection.ranges.map((r) => ({ from: r.from, to: r.to, fit: true })),
          selection: (cx, changes) => GardSelection.near(cx, changes.mapPos(state.selection.from, -1), 1),
          scrollIntoView: true,
          userEvent: "delete.cut"
        });
    }
    return true;
  }
  var isFocusChange = Transaction.Annotation.define();
  function updateForFocusChange(wg) {
    setTimeout(() => {
      let focus = wg.hasFocus;
      if (focus != wg.inputState.notifiedFocused) {
        wg.inputState.notifiedFocused = focus;
        wg.dispatch({ annotations: isFocusChange.of(focus) });
      }
    }, 10);
  }
  function compositionEnd(wg) {
    if (wg.inputState.composing && wg.inputState.clearComposition()) wg.flush();
  }
  function compositionUpdate(wg, event) {
    LOG_input && console.log(event.type, !!wg.inputState.composing);
    if (!wg.inputState.composing) {
      wg.inputState.composing = { changes: 0, target: null };
      let wrap = null;
      if (!event.data) {
        let sel = wg.state.selection, rSel = wg.state.sel;
        if (sel.empty && (sel instanceof GardSelection.Text && sel.marks || !rSel.head.inText && rSel.head.index) && !eqArray2(rSel.head.nodeBefore?.tag.marks, rSel.activeMarks) || sel.empty && inlineBoundNear(wg.state.sel.head) || !inEditableDOM(wg, wg.observer.selectionRange.focusNode))
          wrap = rSel.activeMarks;
      }
      if (wrap) try {
        wg.inputState.wrappingComposition = wrap;
        wg.flush();
      } finally {
        wg.inputState.wrappingComposition = null;
      }
    }
  }
  function inlineBoundNear(pos) {
    let { parent, index, inText } = pos;
    if (inText || !parent.node.inlineContent) return false;
    return (index ? parent.node.content[index - 1].isPlot : parent.node.isInline) || (index < parent.node.content.length ? parent.node.content[index].isPlot : parent.node.isInline);
  }
  function inEditableDOM(wg, node) {
    if (!node) return false;
    let tile = wg.docTile.nearest(node);
    return tile ? !(tile.isPoint || tile instanceof WidgetTile) : false;
  }
  function isDeletionInputEvent(type) {
    return /^delete(Content|Word|ByComposition)/.test(type);
  }
  var inputTypeCommands = {
    historyUndo: undo,
    historyRedo: redo,
    insertLineBreak,
    insertParagraph: enter,
    deleteContentBackward: Command.bind(deleteUnit, "backward"),
    deleteContentForward: Command.bind(deleteUnit, "forward"),
    deleteWordBackward: Command.bind(deleteWord, "backward"),
    deleteWordForward: Command.bind(deleteWord, "forward"),
    deleteSoftLineBackward: Command.bind(deleteToLineEnd, "backward"),
    deleteSoftLineForward: Command.bind(deleteToLineEnd, "forward"),
    deleteHardLineBackward: Command.bind(deleteToLineEnd, "backward"),
    deleteHardLineForward: Command.bind(deleteToLineEnd, "forward"),
    deleteContent: (wg) => {
      let tr = deleteSelection(wg.state);
      if (tr) wg.dispatch(tr);
      return !!tr;
    },
    insertTranspose: transposeChars,
    deleteEntireSoftLine: deleteLine,
    formatBold: toggleStrong,
    formatItalic: toggleEmphasis,
    formatUnderline: toggleUnderline,
    formatJustifyCenter: Command.bind(setAlignment, "center"),
    formatJustifyLeft: Command.bind(setAlignment, "left"),
    formatJustifyRight: Command.bind(setAlignment, "right")
  };
  var baseHandlers = {
    keydown(wg, event) {
      if ((browser_default.ios || browser_default.android) && (event.key == "Backspace" || event.key == "Enter")) return false;
      return KeyBinding.handle(wg, event);
    },
    mousedown(wg, event) {
      wg.inputState.shiftKey = event.shiftKey;
      if (wg.inputState.lastTouchTime > Date.now() - 500 || // Ignore touch interaction
      !wg.focusable) return false;
      let style = null;
      for (let makeStyle of wg.state.facet(mouseSelectionStyle)) {
        style = makeStyle(wg, event);
        if (style) break;
      }
      if (!style && event.button == 0) style = basicMouseSelection(wg, event);
      if (style) {
        let mustFocus = !wg.hasFocus;
        wg.inputState.startMouseSelection(new MouseSelection(wg, event, style, mustFocus));
        if (mustFocus) wg.observer.ignore(() => {
          wg.contentDOM.focus({ preventScroll: true });
          let active = wg.root.activeElement;
          if (active && !active.contains(wg.contentDOM)) active.blur();
        });
        let mouseSel = wg.inputState.mouseSelection;
        if (mouseSel) {
          mouseSel.start(event);
          return mouseSel.dragging === false;
        }
      }
      return false;
    },
    dragstart(wg, event) {
      let { selection } = wg.state;
      let { inputState } = wg;
      if (inputState.mouseSelection) inputState.mouseSelection.dragging = true;
      inputState.draggedContent = selection;
      if (event.dataTransfer) {
        let slice = wg.state.selection.toSlice(wg.state.doc);
        writeClipboard(wg.state, slice, event.dataTransfer);
        event.dataTransfer.effectAllowed = "copyMove";
      }
      return false;
    },
    dragend(wg) {
      wg.inputState.draggedContent = null;
      return false;
    },
    copy,
    cut: copy,
    drop(wg, event) {
      if (!event.dataTransfer || wg.state.readOnly) return true;
      let slice = readClipboard(wg.state, event.dataTransfer, wg.state.sel.head, false);
      if (!slice) return false;
      let dropPos = wg.posAtCoords({ x: event.clientX, y: event.clientY }).pos;
      let { draggedContent } = wg.inputState;
      let del = draggedContent && dragMovesSelection(wg, event) ? { correct: { from: draggedContent.from, to: draggedContent.to }, local: true } : null;
      if (wg.state.facet(dropHandler).some((f) => f(wg, event, dropPos, del ? del.correct : null, slice)))
        return true;
      let ins = { correct: { from: dropPos, insert: slice, fit: true }, local: true };
      let changes = ChangeSet.create(wg.state.doc, del ? [del, ins] : ins);
      wg.focus();
      wg.dispatch({
        changes,
        selection: GardSelection.undirectionalRange(changes.mapPos(dropPos, -1), changes.mapPos(dropPos, 1)),
        userEvent: del ? "move.drop" : "input.drop"
      });
      wg.inputState.draggedContent = null;
      return true;
    },
    beforeinput(wg, event) {
      let type = event.inputType;
      if (browser_default.safari && type == "insertText" && wg.inputState.composing) compositionEnd(wg);
      if (compositionInputTypes.has(type) && !wg.inputState.composing)
        wg.inputState.composing = { changes: 0, target: null };
      let data = {
        inputType: type,
        data: event.data,
        domRange: null
      };
      let ranges = event.getTargetRanges(), editable = true;
      if (ranges.length) {
        let r = ranges[0], empty = r.collapsed;
        let from = wg.inputState.getDOMPos(r.startContainer, r.startOffset);
        data.domRange = { from, to: empty ? from : wg.inputState.getDOMPos(r.endContainer, r.endOffset) };
        editable = inEditableDOM(wg, r.startContainer) && (empty || inEditableDOM(wg, r.endContainer));
      }
      wg.inputState.beforeInput(event, wg.inputState.pendingInputEvent = data);
      wg.scheduleFlush();
      let allow = compositionInputTypes.has(type) || editable && (type == "insertText" || isDeletionInputEvent(type) && data.domRange && inlineContext(wg.inputState.domDoc, data.domRange));
      LOG_input && console.log(`beforeinput ${data.inputType} ${data.domRange ? data.domRange.from + "-" + data.domRange.to : ""} ${data.data ? JSON.stringify(data.data) : ""}, allow=${allow}`);
      return !allow;
    },
    input(wg, event) {
      let pending = wg.inputState.pendingInputEvent;
      LOG_input && console.log(`input ${event.inputType}${pending && pending.inputType == event.inputType ? "" : " (missing)"}`);
      if (!pending || pending.inputType != event.inputType || !pending.domRange) return false;
      wg.inputState.pendingInputEvent = null;
      let change;
      if (compositionInputTypes.has(event.inputType) || event.inputType == "insertText") {
        change = { from: pending.domRange.from, to: pending.domRange.to, insert: [Leaf.text(pending.data || "")] };
      } else if (isDeletionInputEvent(event.inputType)) {
        change = { from: pending.domRange.from, to: pending.domRange.to };
      } else {
        return false;
      }
      wg.inputState.addDOMChange(ChangeSet.create(wg.inputState.domDoc, change));
      return false;
    }
  };
  var baseObservers = {
    scroll(wg) {
      wg.inputState.lastScrollTop = wg.scrollDOM.scrollTop;
      wg.inputState.lastScrollLeft = wg.scrollDOM.scrollLeft;
    },
    touchstart(wg, e) {
      wg.inputState.recordTouch(e);
    },
    touchmove(wg, e) {
      wg.inputState.recordTouch(e);
    },
    focus(wg) {
      if (!wg.scrollDOM.scrollTop && (wg.inputState.lastScrollTop || wg.inputState.lastScrollLeft)) {
        wg.scrollDOM.scrollTop = wg.inputState.lastScrollTop;
        wg.scrollDOM.scrollLeft = wg.inputState.lastScrollLeft;
      }
      updateForFocusChange(wg);
    },
    blur(wg) {
      updateForFocusChange(wg);
    },
    compositionstart: compositionUpdate,
    compositionupdate: compositionUpdate,
    compositionend(wg) {
      LOG_input && console.log("compositionend", !!wg.inputState.composing);
      compositionEnd(wg);
    },
    contextmenu(wg) {
      wg.inputState.lastContextMenu = Date.now();
    }
  };

  // vendor/wordgard/src/editor/viewstate.ts
  var scrollIntoView = Transaction.Effect.define({ map: (t, ch) => t.map(ch) });
  var selectionScrollSpec = {
    x: "nearest",
    y: "nearest",
    xMargin: 5,
    yMargin: 5
  };
  var ScrollTarget = class _ScrollTarget {
    constructor(from, to, assoc, spec) {
      __publicField(this, "from", from);
      __publicField(this, "to", to);
      __publicField(this, "assoc", assoc);
      __publicField(this, "spec", spec);
    }
    map(changes) {
      if (changes.empty) return this;
      let from, to;
      if (this.from == this.to) {
        from = to = changes.mapPos(this.from, this.assoc);
      } else {
        from = changes.mapPos(this.from, 1);
        to = Math.max(from, changes.mapPos(this.to, -1));
      }
      return new _ScrollTarget(from, to, this.assoc, this.spec);
    }
    clip(state) {
      let len = state.doc.length;
      return this.to <= len ? this : new _ScrollTarget(Math.min(len, this.from), Math.min(len, this.to), this.assoc, this.spec);
    }
  };
  var ViewState = class {
    constructor(state) {
      __publicField(this, "state", state);
      __publicField(this, "initialized", false);
      __publicField(this, "contentDOMWidth", 0);
      // contentDOM.getBoundingClientRect().width
      __publicField(this, "contentDOMHeight", 0);
      // contentDOM.getBoundingClientRect().height
      __publicField(this, "editorHeight", 0);
      // scrollDOM.clientHeight
      __publicField(this, "editorOffset", 0);
      // scrollDOM.offsetTop
      __publicField(this, "editorWidth", 0);
      // scrollDOM.clientWidth
      // A scroll target that hasn't been scrolled to yet
      __publicField(this, "scrollTarget", null);
      __publicField(this, "styleLTR", true);
      __publicField(this, "flushedState");
      __publicField(this, "pending", []);
      this.flushedState = state;
    }
    update(tr) {
      if (this.scrollTarget) this.scrollTarget = this.scrollTarget.map(tr.changes);
      if (tr.scrollIntoView) {
        let { selection: sel } = tr.state;
        this.scrollTarget = new ScrollTarget(sel.head, sel.head, sel.headSide, selectionScrollSpec);
      }
      for (let e of tr.effects)
        if (e.is(scrollIntoView)) this.scrollTarget = e.value.clip(this.state);
      if (tr.startState != this.state) throw new Error("Mismatched transaction");
      this.pending = this.pending.concat(tr);
      this.state = tr.state;
    }
    flush() {
      this.flushedState = this.state;
      this.pending = [];
    }
    measure(wg) {
      let dom = wg.contentDOM, style = window.getComputedStyle(dom);
      this.styleLTR = style.direction == "ltr";
      let result = 0;
      let domRect = dom.getBoundingClientRect();
      if (Math.abs(this.contentDOMHeight - domRect.height) > 0.5) {
        result |= 2 /* Geometry */;
        this.contentDOMHeight = domRect.height;
      }
      if (this.editorWidth != wg.scrollDOM.clientWidth) {
        this.editorWidth = wg.scrollDOM.clientWidth;
        result |= 2 /* Geometry */;
      }
      let contentWidth = domRect.width;
      if (Math.abs(this.contentDOMWidth - contentWidth) > 0.5 || this.editorHeight != wg.scrollDOM.clientHeight || this.editorOffset != wg.scrollDOM.offsetTop) {
        this.contentDOMWidth = domRect.width;
        this.editorHeight = wg.scrollDOM.clientHeight;
        this.editorOffset = wg.scrollDOM.offsetTop;
        result |= 2 /* Geometry */;
      }
      return result;
    }
    initialMeasure(wg) {
      this.initialized = true;
      let domRect = wg.contentDOM.getBoundingClientRect();
      this.contentDOMWidth = domRect.width;
      this.contentDOMHeight = domRect.height;
      this.editorHeight = wg.scrollDOM.clientHeight;
      this.editorWidth = wg.scrollDOM.clientWidth;
    }
  };

  // vendor/wordgard/src/editor/drawcursor.ts
  var cursorBlinkRate = GardState.Facet.define({
    combine: (inputs) => inputs.length ? Math.min(...inputs) : 1200
  });
  var CursorStyle = class _CursorStyle {
    constructor(height, align, color, bold, italic) {
      __publicField(this, "height", height);
      __publicField(this, "align", align);
      __publicField(this, "color", color);
      __publicField(this, "bold", bold);
      __publicField(this, "italic", italic);
    }
    static read(node, height) {
      let win = node.ownerDocument.defaultView || window;
      let elt = node.nodeType == 1 ? node : node.parentNode;
      let style = win.getComputedStyle(elt);
      return new _CursorStyle(height, style.verticalAlign, style.color, +style.fontWeight > 400, style.fontStyle == "italic");
    }
    eq(other) {
      return other && this.height == other.height && this.align == other.align && this.color == other.color && this.bold == other.bold && this.italic == other.italic;
    }
  };
  var CursorLayer = class {
    constructor(wg) {
      __publicField(this, "layer");
      __publicField(this, "info", null);
      __publicField(this, "cached", null);
      this.layer = wg.scrollDOM.appendChild(document.createElement("wg-cursor-layer"));
      this.positionCursor = this.positionCursor.bind(this);
      wg.scheduleDOMRead(this.positionCursor);
      setBlinkRate(wg.state, this.layer);
    }
    update(update) {
      if (update.transactions.some((tr) => tr.selection))
        this.layer.style.animationName = this.layer.style.animationName == "wg-blink" ? "wg-blink2" : "wg-blink";
      if (update.state.facet(cursorBlinkRate) != update.startState.facet(cursorBlinkRate))
        setBlinkRate(update.state, this.layer);
      if ((update.docChanged || update.selectionSet || update.geometryChanged) && (update.startState.selection.isCursor || update.state.selection.isCursor))
        update.editor.scheduleDOMRead(this.positionCursor);
    }
    docUpdate(wg) {
      wg.scheduleDOMRead(this.positionCursor);
    }
    remove() {
      this.layer.remove();
    }
    positionCursor(wg) {
      getCursorInfo(wg, this, (info) => {
        let cur = this.info;
        if (!info ? cur : !cur || cur.left != info.left || cur.top != info.top || cur.size != info.size || (cur.style ? !cur.style.eq(info.style) : info.style)) {
          this.info = info;
          wg.scheduleDOMWrite(() => {
            let cursor = this.layer.firstChild;
            if (!info) {
              if (cursor) cursor.remove();
            } else {
              if (!cursor)
                cursor = this.layer.appendChild(document.createElement("wg-cursor"));
              cursor.className = "wg-cursor-" + (info.horiz ? "h" : "v");
              cursor.style.top = info.top + "px";
              cursor.style.left = info.left + "px";
              cursor.style.width = info.horiz ? info.size + "px" : "";
              cursor.style.height = info.horiz ? "" : info.size + "px";
              cursor.style.borderLeftColor = info.style ? info.style.color : "";
              cursor.classList.toggle("wg-cursor-bold", info.style?.bold ?? false);
              cursor.classList.toggle("wg-cursor-italic", info.style?.italic ?? false);
            }
          });
        }
      });
    }
  };
  function alignOffset(align, height) {
    if (align == "super") return height * 0.36;
    if (align == "sub") return height * -0.17;
    if (align.endsWith("px")) return +align.slice(0, align.length - 2);
    if (align.endsWith("%")) return height * +align.slice(0, align.length - 1) * 100;
    return 0;
  }
  function vertOverlap(a, b) {
    let margin = a.height / 3;
    return a.top < b.bottom - margin && a.bottom > b.top + margin;
  }
  var VertWidth = 30;
  var VertGap = 5;
  function getCursorInfo(wg, plugin, cont) {
    let { state } = wg;
    if (!state.selection.isCursor) return cont(null);
    let { head, headSide } = state.selection, { sel } = wg.state;
    let { ref, rect } = coordsAtPos(wg, head, headSide);
    let doc2 = wg.contentDOM.getBoundingClientRect();
    if (!sel.head.parent.node.inlineContent) {
      let width = Math.min(VertWidth, rect.width), top2 = rect.top;
      let other = wg.coordsAtPos(head, headSide > 0 ? -1 : 1);
      if (other.top == other.bottom && other.top != top2) {
        let move = Math.min(VertGap, Math.abs(other.top - top2) / 2);
        top2 = top2 + move * (other.top < top2 ? -1 : 1);
      }
      return cont({
        left: (wg.state.textLTR ? rect.left : rect.right - width) - doc2.left,
        top: top2 - doc2.top,
        size: width,
        horiz: true,
        style: null
      });
    }
    let finish = (style, vertRect) => {
      if (style && (!plugin.cached || plugin.cached.style != style))
        plugin.cached = { style, marks, parent: sel.head.parent.node.tag };
      let height = style ? style.height : rect.height;
      let bot = rect.bottom;
      if (vertRect && vertOverlap(vertRect, rect)) {
        bot = vertRect.bottom;
      } else {
        let win = ref.dom.ownerDocument.defaultView || window;
        let refAlign = win.getComputedStyle(ref.dom.nodeType == 1 ? ref.dom : ref.dom.parentNode).verticalAlign;
        if (style && refAlign != style.align) {
          bot += alignOffset(refAlign, rect.height) - alignOffset(style.align, style.height);
        }
      }
      cont({
        left: rect.left - doc2.left,
        top: bot - height - doc2.top,
        size: height,
        horiz: false,
        style
      });
    };
    let marks = sel.activeMarks;
    if (ref instanceof TextTile) {
      let node = ref.posBefore < head ? state.sel.head.nodeBefore : state.sel.head.nodeAfter;
      if (node && node.isText && Mark.sameSet(node.marks, marks))
        return finish(CursorStyle.read(ref.dom, rect.height), rect);
    }
    let pos = sel.head.parent.start, foundRect, foundNode;
    scan: for (let sibling of sel.head.parent.node.content) {
      if (sibling.isText && Mark.sameSet(sibling.marks, marks)) {
        let { tile } = wg.docTile.resolve(pos, 1);
        if (tile instanceof TextTile) {
          let rects = textRange(tile.dom, 0, tile.length).getClientRects();
          foundNode = tile.dom;
          for (let i = 0; i < rects.length; i++) {
            foundRect = rects[i];
            if (vertOverlap(foundRect, rect)) break scan;
          }
        }
      }
      pos += sibling.length;
    }
    if (foundNode) return finish(CursorStyle.read(foundNode, foundRect.height), foundRect);
    if (plugin.cached && Mark.sameSet(plugin.cached.marks, marks) && plugin.cached.parent.eq(sel.head.parent.node.tag))
      return finish(plugin.cached.style);
    if (!marks.length) return finish(null);
    let target = sel.head.parent.node.isDoc ? wg.contentDOM : wg.nodeDOM(sel.head.parent.before);
    wg.scheduleDOMWrite(() => {
      let temp = renderMarks(wg.state, marks, "M");
      temp.style.position = "absolute";
      wg.observer.ignore(() => target.insertBefore(temp, target.firstChild));
      wg.scheduleDOMRead(() => {
        wg.scheduleDOMWrite(() => wg.observer.ignore(() => temp.remove()));
        let inner = temp;
        while (inner.firstChild) inner = inner.firstChild;
        let r = textRange(inner, 0, 1).getClientRects()[0];
        finish(CursorStyle.read(inner, r.height), r);
      });
    });
  }
  function setBlinkRate(state, dom) {
    dom.style.animationDuration = state.facet(cursorBlinkRate) + "ms";
  }

  // vendor/wordgard/src/editor/editor.ts
  var dirCompartment = GardState.Compartment.define();
  var _Wordgard = class _Wordgard {
    constructor(spec) {
      /// The document or shadow root that the editor lives in.
      __publicField(this, "root", document);
      /// The outer DOM element that represents the editor.
      __publicField(this, "dom");
      /// The DOM element that can be styled to scroll. (Note that it may
      /// not have been, so you can't assume this is scrollable.)
      __publicField(this, "scrollDOM");
      /// The editable DOM element holding the editor content. You should
      /// not, usually, interact with this content directly though the
      /// DOM, since the editor will immediately undo most of the changes
      /// you make. Instead, {@link Wordgard.dispatch dispatch} {@link
      /// Transaction transactions} to modify content, and {@link
      /// Decoration decorations} to style it.
      __publicField(this, "contentDOM");
      __publicField(this, "announceDOM");
      __publicField(this, "id", "wordgard-" + Math.floor(Math.random() * 16777215).toString(16));
      /// @internal
      __publicField(this, "inputState");
      /// @internal
      __publicField(this, "viewState");
      /// @internal
      __publicField(this, "docTile");
      /// @internal
      __publicField(this, "plugins", []);
      __publicField(this, "pluginMap", /* @__PURE__ */ new Map());
      __publicField(this, "editorAttrs", Attributes.none);
      __publicField(this, "contentAttrs", Attributes.none);
      __publicField(this, "styleModules");
      /// True when the editor is connected to a DOM document.
      __publicField(this, "connected", false);
      __publicField(this, "flushing", 0 /* No */);
      __publicField(this, "willFlush", false);
      __publicField(this, "flushFunc");
      /// @internal
      __publicField(this, "lastFlush", Date.now());
      __publicField(this, "autoColorScheme", "light");
      /// @internal
      __publicField(this, "observer");
      __publicField(this, "domReaders", []);
      __publicField(this, "domWriters", []);
      __publicField(this, "pendingTransactionListeners", /* @__PURE__ */ new Map());
      this.flushFunc = () => {
        if (this.willFlush) this.flush();
      };
      this.dispatch = this.dispatch.bind(this);
      this.dom = createWrapElement(this);
      this.contentDOM = document.createElement("wg-content");
      this.scrollDOM = document.createElement("wg-scroller");
      this.scrollDOM.tabIndex = -1;
      this.scrollDOM.appendChild(this.contentDOM);
      this.announceDOM = document.createElement("wg-announced");
      this.announceDOM.setAttribute("aria-live", "polite");
      this.dom.appendChild(this.announceDOM);
      this.dom.appendChild(this.scrollDOM);
      this.viewState = new ViewState(spec.state || GardState.create(spec));
      if (spec.scrollTo && spec.scrollTo.is(scrollIntoView))
        this.viewState.scrollTarget = spec.scrollTo.value.clip(this.viewState.state);
      this.plugins = [cursorPlugin, ...this.state.facet(editorPlugin)].map((spec2) => new PluginInstance(spec2));
      for (let plugin of this.plugins) plugin.update(this);
      this.inputState = new InputState(this);
      this.docTile = DocTile.create(this.state, this.contentDOM, this);
      this.updateAttrs();
      this.observer = new DOMObserver(this);
      if (spec.parent) spec.parent.appendChild(this.dom);
    }
    /// Construct a new editor. You'll want to either provide a `parent`
    /// option, or put the editor's {@link Wordgard.dom DOM element}
    /// into your document after creating an editor, so that the user
    /// can see it.
    static create(spec) {
      return new _Wordgard(spec);
    }
    /// The current editor state.
    get state() {
      return this.viewState.state;
    }
    /// @internal
    get flushedState() {
      return this.viewState.flushedState;
    }
    /// Indicates whether the user is currently composing text via
    /// [IME](https://en.wikipedia.org/wiki/Input_method), and at least
    /// one change has been made in the current composition.
    get composing() {
      return !!this.inputState.composing;
    }
    /// Indicates whether the user is currently in composing state. Note
    /// that on some platforms, like Android, this will be the case a
    /// lot, since just putting the cursor on a word starts a
    /// composition there.
    get compositionStarted() {
      return this.inputState.composing && this.inputState.composing.changes > 0;
    }
    /// Queries whether the editor's DOM is {@link Wordgard#editable
    /// editable}.
    get editable() {
      return this.state.facet(_Wordgard.editable);
    }
    /// Returns true if the editor can be focused (is {@link
    /// Wordgard.editable editable} or has a tabindex).
    get focusable() {
      return this.editable || this.contentDOM.tabIndex > -1;
    }
    /// @internal
    get win() {
      return this.dom.ownerDocument.defaultView || window;
    }
    /// @internal
    setConnected(value) {
      if (value == this.connected) return;
      this.connected = value;
      if (value) {
        this.root = getRoot(this.dom.parentNode) || document;
        this.mountStyles();
        this.inputState.connect();
        if (!this.viewState.initialized) this.viewState.initialMeasure(this);
        for (let plugin of this.plugins) plugin.connect(this);
        this.observer.connect();
        if (this.viewState.pending.length || this.domReaders.length || this.domWriters.length)
          this.scheduleFlush();
        this.docTile.connect();
      } else {
        this.root = document;
        this.observer.disconnect();
        for (let plugin of this.plugins) plugin.disconnect(this);
        this.inputState.disconnect();
        this.docTile.disconnect();
        clearScratchRange();
      }
    }
    /// All editor state updates go through this. It takes a transaction
    /// or transaction spec and updates the editor to show the new state
    /// produced by that transaction. This function is bound to the editor
    /// instance, so it does not have to be called as a method.
    ///
    /// Will apply {@link Transaction.appender transaction appenders}
    /// and include any extra transactions they produce in the editor's
    /// state.
    ///
    /// Updates will be immediately be reflected in the object's `state`
    /// property, but updating the DOM will be deferred to the next
    /// display update.
    dispatch(tr) {
      if (this.flushing != 0 /* No */) throw new Error("Cannot dispatch new updates during the editor flush phase");
      if (!(tr instanceof Transaction)) tr = this.state.update(tr);
      else if (tr.startState != this.state) throw new Error("Dispatching a transaction starting from the wrong state");
      let trs = Transaction.append(tr);
      for (let t of trs) this.viewState.update(t);
      this.runTransactionListeners(trs);
      this.scheduleFlush();
    }
    /// @internal
    scheduleFlush() {
      if (!this.willFlush && this.flushing == 0 /* No */ && this.connected) {
        this.win.requestAnimationFrame(this.flushFunc);
        this.willFlush = true;
      }
    }
    /// Force a flush on the editor content, updating its DOM
    /// representation for any pending changes.
    flush() {
      this.observer.readSelectionRange();
      if (!this.connected) return;
      if (!this.viewState.pending.some((tr) => tr.selection) || this.inputState.composing) this.observer.pollSelection();
      let { flushedState, state } = this.viewState;
      let update = _Wordgard.Update.create(this, flushedState, state, this.viewState.pending);
      this.willFlush = false;
      this.flushing = 1 /* Yes */;
      this.lastFlush = Date.now();
      try {
        let domChanges = this.observer.takeDirty();
        this.observer.ignore(() => this.runUpdate(update, domChanges));
        this.viewState.flush();
        domChanges = null;
        for (let i = 0; ; i++) {
          if (i > 5) {
            console.warn("Editor flush loop restarted more than 5 times");
            break;
          }
          let write = this.domWriters;
          this.domWriters = [];
          for (let f of write) f(this);
          let flags = this.viewState.measure(this);
          let read = this.domReaders;
          this.domReaders = [];
          this.flushing = 2 /* Read */;
          for (let f of read) f(this);
          this.flushing = 1 /* Yes */;
          if (!flags && !this.domWriters.length) break;
          update.flags |= flags;
          if (flags) this.runUpdate(_Wordgard.Update.create(this, state, state, [], flags), null);
        }
      } finally {
        this.flushing = 0 /* No */;
      }
      if (this.viewState.scrollTarget) {
        this.scrollTo(this.viewState.scrollTarget);
        this.viewState.scrollTarget = null;
      }
      if (!update.empty) for (let listener of this.state.facet(_Wordgard.updateListener)) {
        try {
          listener(update);
        } catch (e) {
          logException(this.state, e, "update listener");
        }
      }
      this.checkDir();
    }
    scrollTo(target) {
      for (let handler of this.state.facet(_Wordgard.scrollHandler)) {
        try {
          if (handler(this, target)) return true;
        } catch (e) {
          logException(this.state, e, "scroll handler");
        }
      }
      let { from, to, assoc } = target;
      let rect = this.coordsAtPos(from, from == to ? assoc : 1);
      if (from != to) {
        let other = this.coordsAtPos(to, -1);
        let left = Math.min(rect.left, other.left), top2 = Math.min(rect.top, other.top);
        rect = new DOMRect(left, top2, Math.max(rect.right, other.right) - left, Math.max(rect.bottom, other.bottom) - top2);
      }
      let margins = this.getScrollMargins();
      let targetRect = new DOMRect(
        rect.left + margins.left,
        rect.top + margins.top,
        rect.width - margins.left - margins.right,
        rect.height - margins.top - margins.bottom
      );
      let { offsetWidth, offsetHeight } = this.scrollDOM;
      scrollRectIntoView(
        this.scrollDOM,
        targetRect,
        assoc,
        target.spec.x,
        target.spec.y,
        Math.max(Math.min(target.spec.xMargin, offsetWidth), -offsetWidth),
        Math.max(Math.min(target.spec.yMargin, offsetHeight), -offsetHeight),
        this.state.textLTR
      );
    }
    runUpdate(update, domChanges) {
      let composition = this.composing ? this.inputState.getCompositionInfo(this) : null;
      if (this.composing && !composition) this.inputState.abortComposition();
      let changes = domChanges ? addUpdated(update.changes.sections, domChanges) : update.changes.sections;
      let prevDocTile = this.docTile;
      if (!update.empty) {
        this.updatePlugins(update);
        this.inputState.update(update);
        this.showAnnouncements(update.transactions);
        if (this.state.facet(_Wordgard.styleModule) != this.styleModules) this.mountStyles();
        this.updateAttrs();
      }
      this.docTile = prevDocTile.update(update.state, changes, this, composition);
      if ((composition?.wrapCursor || !composition && (prevDocTile != this.docTile || update.selectionSet)) && this.hasFocus)
        setDOMSelection(this);
      this.observer.clear();
      if (this.docTile != prevDocTile) for (let plugin of this.plugins) plugin.docUpdate(this);
    }
    updatePlugins(update) {
      let specs = update.state.facet(editorPlugin);
      let configChange = specs != update.startState.facet(editorPlugin);
      if (configChange) {
        let newPlugins = [];
        for (let spec of [cursorPlugin, ...specs]) {
          let found = this.plugins.findIndex((p) => p.spec == spec);
          if (found < 0) {
            let plugin = new PluginInstance(spec);
            newPlugins.push(plugin);
            if (this.connected) plugin.connect(this);
          } else {
            let plugin = this.plugins[found];
            plugin.mustUpdate = update;
            newPlugins.push(plugin);
          }
        }
        for (let plugin of this.plugins) if (!newPlugins.includes(plugin)) plugin.remove(this);
        this.plugins = newPlugins;
        this.pluginMap.clear();
      } else {
        for (let p of this.plugins) p.mustUpdate = update;
      }
      for (let i = 0; i < this.plugins.length; i++) this.plugins[i].update(this);
      if (configChange) this.inputState.ensureHandlers(update.state);
    }
    updateAttrs() {
      let editorAttrs = attrsFromFacet(this, _Wordgard.editorAttributes, [
        "class",
        this.themeClasses
      ]);
      let contentAttrs = attrsFromFacet(this, _Wordgard.contentAttributes, [
        "aria-multiline",
        "true",
        ...this.state.readOnly ? ["aria-readonly", "true"] : [],
        "contenteditable",
        String(this.state.facet(_Wordgard.editable)),
        "role",
        "textbox",
        "translate",
        "no",
        "id",
        this.id
      ]);
      let changedContent = updateAttributes(this.contentDOM, this.contentAttrs, contentAttrs);
      this.contentAttrs = contentAttrs;
      let changedEditor = updateAttributes(this.dom, this.editorAttrs, editorAttrs);
      this.editorAttrs = editorAttrs;
      return changedContent || changedEditor;
    }
    checkDir() {
      if (this.viewState.styleLTR != this.state.textLTR) {
        let value = GardState.textLTR.of(this.viewState.styleLTR);
        this.dispatch({
          effects: dirCompartment.get(this.state) == null ? GardState.appendConfig.of(GardState.prec.highest(dirCompartment.of(value))) : dirCompartment.reconfigure(value)
        });
      }
    }
    showAnnouncements(trs) {
      let first = true;
      for (let tr of trs) for (let effect of tr.effects) if (effect.is(_Wordgard.announce)) {
        if (first) this.announceDOM.textContent = "";
        first = false;
        let div = this.announceDOM.appendChild(document.createElement("div"));
        div.textContent = effect.value;
      }
    }
    mountStyles() {
      this.styleModules = this.state.facet(_Wordgard.styleModule);
      let nonce = this.state.facet(_Wordgard.cspNonce);
      StyleModule.mount(this.root, this.styleModules.concat(baseStyles).reverse(), nonce ? { nonce } : void 0);
    }
    /// Schedule a function that needs to read from the (flushed) DOM.
    /// During an editor update, when doing anything that needs to
    /// access the DOM layout, it is important to schedule it with this
    /// method, to avoid forcing unnecessary DOM layouts.
    scheduleDOMRead(read) {
      this.scheduleFlush();
      if (this.domReaders.indexOf(read) < 0) this.domReaders.push(read);
    }
    /// Schedule a function that needs to modify the DOM. When doing any
    /// kind of DOM mutation that depends on a {@link
    /// Wordgard.scheduleDOMRead | DOM read}, use this method, so that
    /// read and write phases remain separate.
    scheduleDOMWrite(write) {
      this.scheduleFlush();
      if (this.domWriters.indexOf(write) < 0) this.domWriters.push(write);
    }
    /// Get the value of a specific plugin, if present. Note that
    /// plugins that crash can be dropped from an editor, so even when
    /// you know you registered a given plugin, it is recommended to
    /// check the return value of this method.
    plugin(plugin) {
      let known = this.pluginMap.get(plugin);
      if (known === void 0 || known && known.spec != plugin)
        this.pluginMap.set(plugin, known = this.plugins.find((p) => p.spec == plugin && !p.deactivated) || null);
      return known && known.update(this).value;
    }
    ensureFlushed() {
      if (!this.connected)
        throw new Error("Editor is not connected to the DOM");
      if (this.willFlush && (this.viewState.pending.some((tr) => tr.docChanged) || this.observer.dirty)) {
        if (this.flushing == 1 /* Yes */)
          throw new Error("Trying to read from unflushed editor during flush");
        if (this.flushing == 0 /* No */)
          this.flush();
      }
    }
    /// Find the position at the end or start of the (wrapped) line. If
    /// the given position isn't in a textblock, this will return null.
    moveToLineBoundary(start, forward) {
      this.ensureFlushed();
      return moveToLineBoundary(this, start, forward);
    }
    /// Move a cursor position vertically. When `distance` isn't given,
    /// it defaults to moving to the vertical element below or above the
    /// start position. Otherwise, `distance` should provide a positive
    /// distance in pixels.
    ///
    /// When `start` has a
    /// {@link GardSelection.goalColumn `goalColumn`}, the vertical
    /// motion will use that as a target horizontal position. Otherwise,
    /// the cursor's own horizontal position is used. The returned
    /// cursor will have its goal column set to whichever column was
    /// used. If `allowNode` is true, this may return a node selection
    /// on a block node.
    moveVertically(start, forward, distance, allowNode) {
      this.ensureFlushed();
      return moveVertically(this, start, forward, distance, allowNode);
    }
    /// Find the DOM parent node and offset (child offset if `node` is
    /// an element, character offset when it is a text node) at the
    /// given document position.
    domAtPos(pos, assoc = -1) {
      this.ensureFlushed();
      let tilePos = this.docTile.resolve(pos, assoc);
      return { node: tilePos.tile.dom, offset: tilePos.offset };
    }
    /// Get the DOM element for the node at the given position, if any.
    nodeDOM(pos) {
      this.ensureFlushed();
      let tile = this.docTile.nodeTile(pos);
      if (!tile || tile.dom.nodeType != 1) return null;
      return tile.dom;
    }
    /// Find the document position at the given DOM node. Can be useful
    /// for associating positions with DOM events. Will raise an error
    /// when `node` isn't part of the editor content.
    posAtDOM(node, offset = 0) {
      return this.inputState.posAtDOM(node, offset, 1);
    }
    /// Find the Wordgard node represented by the given DOM node, or one
    /// of its parent nodes, if any. Will not return the outer document node.
    nodeFromDOM(node) {
      let tile = this.docTile.nearest(node, true);
      if (!tile || tile == this.docTile) return null;
      let pos = tile.posBefore, n = this.state.doc.nodeAt(pos);
      return n && { pos, node: n };
    }
    /// Get the document position at the given screen coordinates.
    posAtCoords(coords) {
      let elt = (this.root.elementFromPoint ? this.root : this.dom.ownerDocument).elementFromPoint(coords.x, coords.y);
      let tile = elt && this.docTile.nearest(elt) || this.docTile;
      let result = tile.posAtCoords(this.state, coords.x, coords.y);
      for (let tr of this.viewState.pending) result = result.map(tr.changes);
      return result;
    }
    /// Get the screen coordinates at the given document position.
    /// `side` determines whether the coordinates are based on the
    /// element before (-1) or after (1) the position (if no element is
    /// available on the given side, the method will transparently use
    /// another strategy to get reasonable coordinates).
    coordsAtPos(pos, assoc = -1) {
      this.ensureFlushed();
      return coordsAtPos(this, pos, assoc).rect;
    }
    /// Return the rectangle around a given node or character. If there
    /// is no element directly after `pos`, this will return null. For
    /// space characters that are a line wrap point, this will return
    /// the position before the line break.
    coordsForElement(pos) {
      this.ensureFlushed();
      return this.docTile.coordsForElement(pos);
    }
    /// Check whether the editor has focus.
    get hasFocus() {
      return (this.dom.ownerDocument.hasFocus() || browser_default.safari && this.inputState?.lastContextMenu > Date.now() - 3e4) && this.root.activeElement == this.contentDOM;
    }
    /// Put focus on the editor.
    focus() {
      if (this.connected) this.observer.ignore(() => {
        this.contentDOM.focus({ preventScroll: true });
        if (this.willFlush && this.flushing == 0 /* No */ && this.viewState.pending.some((tr) => tr.docChanged))
          this.flush();
        setDOMSelection(this);
      });
    }
    /// Get the CSS classes for the currently active editor themes.
    get themeClasses() {
      let scheme = this.state.facet(colorScheme);
      if (scheme == "auto") scheme = this.autoColorScheme;
      return styleID + " " + (scheme == "dark" ? baseDarkID : baseLightID) + " " + this.state.facet(theme);
    }
    /// Returns an effect that can be {@link Transaction.Spec.effects
    /// added} to a transaction to cause it to scroll the given position
    /// or range into view.
    static scrollIntoView(pos, options = {}) {
      let [from, to, assoc] = typeof pos == "number" ? [pos, pos, -1] : [pos.from, pos.to, pos.empty ? pos.headSide : pos.head < pos.anchor ? -1 : 1];
      return scrollIntoView.of(new ScrollTarget(from, to, assoc, {
        y: options.y || "nearest",
        x: options.x || "nearest",
        yMargin: options.yMargin ?? 5,
        xMargin: options.xMargin ?? 5
      }));
    }
    /// Add an
    /// [`aria-label`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-label)
    /// attribute to the editable element holding the given string or
    /// phrase.
    static label(label) {
      return _Wordgard.editorAttributes.of(typeof label == "string" ? { "aria-label": label } : ((wg) => ({ "aria-label": label(wg.state) })));
    }
    /// Returns an extension that can be used to add a DOM event handler
    /// to the editor. For any given event, such functions are ordered
    /// by extension precedence, and the first handler to return true
    /// will be assumed to have handled that event, and no other
    /// handlers or built-in behavior will be activated for it. These
    /// are registered on the {@link Wordgard.contentDOM content
    /// element}, except for `scroll` handlers, which will be called any
    /// time the editor's {@link Wordgard.scrollDOM scroll element} or
    /// one of its parent nodes is scrolled.
    static domEventHandler(event, handler) {
      return eventHandler.of({ event, handler });
    }
    /// Create an extension that registers a DOM event observers. Contrary
    /// to event {@link Wordgard.domEventHandler handlers},
    /// observers can't be prevented from running by a higher-precedence
    /// handler returning true. They also don't prevent other handlers
    /// and observers from running when they return true, and should not
    /// call `preventDefault`.
    static domEventObserver(event, observer) {
      return eventObserver.of({ event, observer });
    }
    runTransactionListeners(trs) {
      for (let l of this.state.facet(_Wordgard.transactionListener)) {
        let has = this.pendingTransactionListeners.get(l);
        this.pendingTransactionListeners.set(l, has ? has.concat(trs) : trs);
      }
      for (; ; ) {
        let next = this.pendingTransactionListeners.keys().next();
        if (next.done) break;
        let trs2 = this.pendingTransactionListeners.get(next.value);
        this.pendingTransactionListeners.delete(next.value);
        next.value(trs2, this);
      }
    }
    /// @internal
    getScrollMargins() {
      let left = 0, right = 0, top2 = 0, bottom = 0;
      for (let source of this.state.facet(_Wordgard.coveredMargins)) {
        let m = source(this);
        if (m) {
          if (m.left != null) left = Math.max(left, m.left);
          if (m.right != null) right = Math.max(right, m.right);
          if (m.top != null) top2 = Math.max(top2, m.top);
          if (m.bottom != null) bottom = Math.max(bottom, m.bottom);
        }
      }
      return { left, right, top: top2, bottom };
    }
    /// Create a theme extension. The first argument can be a
    /// [`style-mod`](https://github.com/marijnh/style-mod#documentation)
    /// style spec providing the styles for the theme. These will be
    /// prefixed with a generated scope class.
    ///
    /// Because the selectors are prefixed, rules that directly match
    /// the editor's {@link Wordgard.dom wrapper element} (to which the
    /// scope class will be added) need to be explicitly differentiated
    /// by adding an `&` to the selector for that element—for example
    /// `&:has(wg-content:focus)`.
    static theme(spec) {
      let prefix = StyleModule.newName();
      return [theme.of(prefix), _Wordgard.styleModule.of(buildTheme(`.${prefix}`, spec, {
        "&dark": `.${prefix}.${baseDarkID}`,
        "&light": `.${prefix}.${baseLightID}`
      }))];
    }
    /// @internal
    configureColorScheme(scheme) {
      if (this.autoColorScheme == scheme) return;
      this.autoColorScheme = scheme;
      if (!this.state.facet(colorScheme))
        this.observer.ignore(() => this.updateAttrs());
    }
    /// Create an extension that loads a set of style rules. Like
    /// with {@link Wordgard.theme `theme`}, use `&` to indicate the
    /// place of the editor wrapper element when directly targeting
    /// that. You can also use `&dark` or `&light` instead to only
    /// target editors with a dark or light {@link Wordgard.colorScheme
    /// color scheme}.
    static styles(spec) {
      return GardState.prec.lowest(_Wordgard.styleModule.of(buildTheme("." + styleID, spec, lightDarkIDs)));
    }
    /// Creates a simple theme that sets a height (given in pixels or,
    /// if a string, a CSS number + unit) and automatic overflow
    /// scrolling on the editor. (The default styling makes the editor
    /// height fit its content.)
    static scrolling(height) {
      return _Wordgard.theme({
        "&": {
          height: typeof height == "number" ? `${height}px` : height
        },
        "wg-scroller": {
          overflowY: "auto"
        }
      });
    }
  };
  /// Filter functions provided through this facet will be run on a
  /// slice before it is serialized to the clipboard.
  __publicField(_Wordgard, "clipboardOutputFilter", clipboardOutputFilter);
  /// Filter functions provided through this facet will be run on an
  /// HTML string before it put onto the clipboard.
  __publicField(_Wordgard, "clipboardOutputHTMLFilter", clipboardOutputHTMLFilter);
  /// This can be used to provide a function that converts a document
  /// slice to a string that is put onto the plain-text clipboard.
  /// Serializers are tried in order of precedence until one returns
  /// a string.
  __publicField(_Wordgard, "clipboardTextSerializer", clipboardTextSerializer);
  /// Filter to run on the plain text representation of content put
  /// onto the clipboard.
  __publicField(_Wordgard, "clipboardOutputTextFilter", clipboardOutputTextFilter);
  /// Filter functions provided through this facet will be run on a
  /// slice after it is read from the clipboard.
  __publicField(_Wordgard, "clipboardInputFilter", clipboardInputFilter);
  /// Filter functions to run on HTML text that is read from the
  /// clipboard.
  __publicField(_Wordgard, "clipboardInputHTMLFilter", clipboardInputHTMLFilter);
  /// When the editor reads plain text from the clipboard, this facet
  /// can be used to provide a custom parser. Each provided function
  /// is tried in order of precedence, until one returns a slice.
  __publicField(_Wordgard, "clipboardTextParser", clipboardTextParser);
  /// Filter to run on plain text read from the clipboard.
  __publicField(_Wordgard, "clipboardInputTextFilter", clipboardInputTextFilter);
  /// Facet that allows you to register handlers to override paste
  /// behavior.
  __publicField(_Wordgard, "pasteHandler", pasteHandler);
  /// Facet for custom drop handlers. When the drop is done inside the
  /// editor and should move an existing range, the `move` parameter
  /// will hold the origin range.
  __publicField(_Wordgard, "dropHandler", dropHandler);
  /// This annotation is added to transactions created because the
  /// editor's focused status changed. It holds `true` when the editor
  /// gained focus, `false` when it lost focus.
  __publicField(_Wordgard, "isFocusChange", isFocusChange);
  /// Facet to add a [style
  /// module](https://github.com/marijnh/style-mod#documentation) to
  /// an editor. The editor will ensure that the module is mounted in
  /// its {@link Wordgard.root document root}.
  __publicField(_Wordgard, "styleModule", GardState.Facet.define());
  /// Scroll handlers can override how editor content is scrolled into
  /// view. If they return `true`, no further handling happens for the
  /// scrolling. If they return false, the default scroll behavior is
  /// applied. Scroll handlers should never initiate editor updates.
  __publicField(_Wordgard, "scrollHandler", GardState.Facet.define());
  /// Allows you to provide a function that should be called when the
  /// library catches an exception from an extension (mostly from
  /// plugins, but may be used by other extensions to route exceptions
  /// from user-code-provided callbacks). This is mostly useful for
  /// debugging and logging. See {@link Wordgard.logException}.
  __publicField(_Wordgard, "exceptionSink", exceptionSink);
  /// Registers a listener function to be called whenever a set of
  /// transactions is applied to the editor. This function may
  /// dispatch additional transactions, if needed.
  __publicField(_Wordgard, "transactionListener", GardState.Facet.define());
  /// A facet that can be used to register a function to be called
  /// after the editor flushes updates to the DOM. Dispatching
  /// transactions from such a function is allowed, but will cause a
  /// new, separate update to happen.
  __publicField(_Wordgard, "updateListener", GardState.Facet.define());
  /// Facet that controls whether the editor content DOM is editable.
  /// When its highest-precedence value is `false`, the element will
  /// not have its `contenteditable` attribute set. (Note that this
  /// doesn't affect API calls that change the editor content, even
  /// when those are bound to keys or buttons. See the {@link
  /// GardState.readOnly `readOnly` facet} for that.)
  ///
  /// A non-editable editor will, by default, not be focusable. You
  /// can set a {@link Wordgard.contentAttributes content attribute}
  /// of `tabindex: 0` to make an uneditable Wordgard focusable.
  __publicField(_Wordgard, "editable", GardState.Facet.define({ combine: (values) => values.length ? values[0] : true }));
  /// Controls the length of a full cursor blink cycle, in milliseconds.
  /// Defaults to 1200. Can be set to 0 to disable blinking.
  __publicField(_Wordgard, "cursorBlinkRate", cursorBlinkRate);
  /// Allows you to influence the way mouse selection happens. The
  /// functions in this facet will be called for a `mousedown` event
  /// on the editor, and can return an object that overrides the way a
  /// selection is computed from that mouse click or drag.
  __publicField(_Wordgard, "mouseSelectionStyle", mouseSelectionStyle);
  /// Facet used to configure whether a given selection drag event
  /// should move or copy the selection. The given predicate will be
  /// called with the `mousedown` event, and can return `true` when
  /// the drag should move the content. The default behavior is to
  /// copy when holding Alt on Mac and Control on other platforms, and
  /// move otherwise.
  __publicField(_Wordgard, "dragMovesSelection", dragBehavior);
  /// This facet controls whether a dark or light color scheme is
  /// active, which determines whether style rules with a `&dark` or
  /// `&light` selector are applied. Defaults to `"light"`. If set to
  /// `"auto"`, the editor uses a CSS `prefers-color-scheme: dark`
  /// query to determine whether to enable light or dark mode.
  ///
  /// Note that setting this to dark will not automatically make the
  /// editor look dark. The default styling does not override the
  /// inherited background and color of the editor. In case of a
  /// page-wide `prefers-color-scheme` selection, those might already
  /// be dark. But when setting an editor on a light background to
  /// explicitly to use a dark theme, you'll need to make sure you
  /// also load styles for that.
  __publicField(_Wordgard, "colorScheme", colorScheme);
  /// Provides a Content Security Policy nonce to use when creating
  /// the style sheets for the editor. Holds the empty string when no
  /// nonce has been provided.
  __publicField(_Wordgard, "cspNonce", GardState.Facet.define({ combine: (values) => values.length ? values[0] : "" }));
  /// Facet that provides additional DOM attributes for the editor's
  /// editable DOM element, either directly, or as a function from the
  /// editor state.
  __publicField(_Wordgard, "contentAttributes", GardState.Facet.define());
  /// Facet that provides DOM attributes for the editor's outer
  /// element.
  __publicField(_Wordgard, "editorAttributes", GardState.Facet.define());
  /// State effect used to include screen reader announcements in a
  /// transaction. These will be added to the DOM in a visually hidden
  /// element with `aria-live="polite"` set, and should be used to
  /// describe effects that are visually obvious but may not be
  /// noticed by screen reader users (such as moving to the next
  /// search match).
  __publicField(_Wordgard, "announce", Transaction.Effect.define());
  /// @internal for testing
  __publicField(_Wordgard, "DocTile", DocTile);
  /// Facet that allows extensions to indicate that some amount of
  /// space around the sides of the scrolling element should be
  /// considered blocked from view when scrolling something into view.
  /// This is only used by plugins that introduce elements that cover
  /// part of the editor (for example a gutter).
  __publicField(_Wordgard, "coveredMargins", GardState.Facet.define());
  var Wordgard = _Wordgard;
  var _wrapElement = null;
  function wrapElementConstructor() {
    let ctor = class extends HTMLElement {
      constructor(wg) {
        super();
        __publicField(this, "wg", wg);
      }
      connectedCallback() {
        this.wg && this.wg.setConnected(true);
      }
      disconnectedCallback() {
        this.wg && this.wg.setConnected(false);
      }
    };
    for (let i = 0; ; i++) {
      let name = "wordgard-editor" + (i ? "-" + i : "");
      if (!customElements.get(name)) {
        customElements.define(name, ctor);
        break;
      }
    }
    return ctor;
  }
  function createWrapElement(wg) {
    if (!_wrapElement) _wrapElement = wrapElementConstructor();
    return new _wrapElement(wg);
  }
  function attrsFromFacet(wg, facet, base) {
    for (let sources = wg.state.facet(facet), i = sources.length - 1; i >= 0; i--) {
      let source = sources[i], value = typeof source == "function" ? source(wg) : source;
      for (let attr in value) {
        let attrVal = value[attr];
        if (attrVal != null) Attributes.push(base, attr, attrVal);
      }
    }
    return base;
  }
  ((Wordgard2) => {
    function logException2(state, exception, context) {
      logException2(state, exception, context);
    }
    Wordgard2.logException = logException2;
    class Plugin {
      constructor(create, buildExtensions) {
        __publicField(this, "create", create);
        /// Instances of this class act as extensions.
        __publicField(this, "extension");
        this.extension = buildExtensions(this);
      }
      /// Define a plugin from a constructor function that creates the
      /// plugin's value, given an editor.
      static define(create, provide) {
        return new Wordgard2.Plugin(create, (plugin) => {
          let ext = [editorPlugin.of(plugin)];
          if (provide) ext.push(provide(plugin));
          return ext;
        });
      }
      /// Create a plugin for a class whose constructor takes an editor
      /// as only argument.
      static fromClass(cls, provide) {
        return Wordgard2.Plugin.define((wg) => new cls(wg), provide);
      }
      /// Create an {@link Wordgard.domEventHandler event handler} for this
      /// plugin. Usually called from the plugin's `provide` function.
      eventHandler(event, handler) {
        return eventHandler.of({ event, handler: (event2, wg) => {
          let value = wg.plugin(this);
          return value ? handler(event2, wg, value) : false;
        } });
      }
      /// Create an {@link Wordgard.domEventObserver event observer} for this
      /// plugin.
      eventObserver(event, observer) {
        return eventObserver.of({ event, observer: (event2, wg) => {
          let value = wg.plugin(this);
          if (value) observer(event2, wg, value);
        } });
      }
    }
    Wordgard2.Plugin = Plugin;
    class Update {
      constructor(editor, startState, state, transactions, flags) {
        __publicField(this, "editor", editor);
        __publicField(this, "startState", startState);
        __publicField(this, "state", state);
        __publicField(this, "transactions", transactions);
        __publicField(this, "flags", flags);
        /// The changes made to the document by this update.
        __publicField(this, "changes");
        if (transactions.length) {
          this.changes = transactions[0].changes;
          for (let i = 1; i < transactions.length; i++) this.changes = this.changes.compose(transactions[i].changes);
        } else {
          this.changes = ChangeSet.empty(startState.doc.length);
        }
      }
      /// @internal
      static create(wg, startState, state, transactions, flags = 0) {
        return new Wordgard2.Update(wg, startState, state, transactions, flags);
      }
      /// Returns true when the document was modified or when the size
      /// of the editor, or elements within the editor, changed.
      get geometryChanged() {
        return this.docChanged || (this.flags & 2 /* Geometry */) > 0;
      }
      /// True when this update indicates a focus change.
      get focusChanged() {
        return (this.flags & 1 /* Focus */) > 0;
      }
      /// Whether the document changed in this update.
      get docChanged() {
        return !this.changes.empty;
      }
      /// Whether the selection was explicitly set in this update.
      get selectionSet() {
        return this.transactions.some((tr) => tr.selection);
      }
      /// @internal
      get empty() {
        return this.flags == 0 && this.transactions.length == 0;
      }
    }
    Wordgard2.Update = Update;
  })(Wordgard || (Wordgard = {}));
  var editorPlugin = GardState.Facet.define();
  var cursorPlugin = Wordgard.Plugin.fromClass(CursorLayer);
  var PluginInstance = class {
    constructor(spec) {
      __publicField(this, "spec", spec);
      // When starting an update, all plugins have this field set to the
      // update object, indicating they need to be updated. When finished
      // updating, it is set to `null`. Retrieving a plugin that needs to
      // be updated with `editor.plugin` forces an eager update.
      __publicField(this, "mustUpdate", null);
      // This is null when the plugin is initially created, but
      // initialized on the first update.
      __publicField(this, "value", null);
      // Set when the plugin has crashed, and will no longer run.
      __publicField(this, "deactivated", false);
    }
    update(wg) {
      if (!this.value) {
        if (!this.deactivated) {
          try {
            this.value = this.spec.create(wg);
          } catch (e) {
            logException(wg.state, e, "Wordgard plugin crashed");
            this.deactivate(null);
          }
        }
      } else if (this.mustUpdate) {
        let update = this.mustUpdate;
        this.mustUpdate = null;
        if (this.value.update) {
          try {
            this.value.update(update);
          } catch (e) {
            logException(update.state, e, "Wordgard plugin crashed");
            if (wg.connected && this.value.disconnect) try {
              this.value.disconnect(wg);
            } catch {
            }
            this.deactivate(wg);
          }
        }
      }
      return this;
    }
    docUpdate(wg) {
      if (this.value?.docUpdate) {
        try {
          this.value.docUpdate(wg);
        } catch (e) {
          logException(wg.state, e, "doc update listener");
        }
      }
    }
    connect(wg) {
      if (this.value?.connect) {
        try {
          this.value.connect(wg);
        } catch (e) {
          logException(wg.state, e, "Wordgard plugin crashed");
          this.deactivate(wg);
        }
      }
    }
    disconnect(wg) {
      if (!this.value?.disconnect) return;
      try {
        this.value.disconnect(wg);
      } catch (e) {
        logException(wg.state, e, "Wordgard plugin crashed");
        this.deactivate(wg);
      }
    }
    remove(wg) {
      if (wg.connected) this.disconnect(wg);
      if (this.value?.remove) try {
        this.value.remove(wg);
      } catch (e) {
        logException(wg.state, e, "Wordgard plugin crashed");
      }
    }
    deactivate(remove2) {
      if (remove2 && this.value?.remove) try {
        this.value.remove(remove2);
      } catch {
      }
      this.deactivated = true;
      this.value = null;
    }
  };

  // rich-text/wordgard-source/history.ts
  var history_exports = {};
  __export(history_exports, {
    history: () => history,
    redo: () => redo2,
    redoDepth: () => redoDepth,
    undo: () => undo2,
    undoDepth: () => undoDepth
  });

  // vendor/wordgard/src/history/history.ts
  var fromHistory = Transaction.Effect.define({
    map(value, change) {
      return {
        side: value.side,
        startDoc: change.apply(value.startDoc),
        rest: !value.rest ? null : value.rest.addMapping(change, value.startDoc)
      };
    }
  });
  var historyConfig = GardState.Facet.define({
    combine(configs) {
      return GardState.Facet.combineConfig(configs, {
        minDepth: 100,
        newGroupDelay: 500,
        joinToEvent: (_t, isAdjacent2) => isAdjacent2
      }, {
        minDepth: Math.max,
        newGroupDelay: Math.min,
        joinToEvent: (a, b) => (tr, adj) => a(tr, adj) || b(tr, adj)
      });
    }
  });
  var historyField_ = GardState.Field.define({
    create() {
      return new HistoryState(null, null);
    },
    update(state, tr) {
      let config = tr.state.facet(historyConfig);
      let fromHist = tr.effects.find((e) => e.is(fromHistory));
      if (fromHist) {
        let { side, rest } = fromHist.value, event2 = eventFromTransaction(tr);
        let other = side == 0 /* Done */ ? state.undone : state.done;
        if (event2) other = new Branch(event2.changes, event2.effects, null, tr.startState.selection, other);
        return new HistoryState(
          side == 0 /* Done */ ? rest : other,
          side == 0 /* Done */ ? other : rest
        );
      }
      let isolate = tr.annotation(history.isolate);
      if (isolate == true || isolate == "before") state = state.isolate();
      if (tr.annotation(Transaction.addToHistory) === false)
        return tr.changes.empty ? state : new HistoryState(
          state.done && state.done.addMapping(tr.changes, tr.startState.doc),
          state.undone && state.undone.addMapping(tr.changes, tr.startState.doc),
          state.prevTime,
          state.prevUserEvent
        );
      let event = eventFromTransaction(tr);
      let time = tr.annotation(Transaction.time), userEvent = tr.annotation(Transaction.userEvent);
      if (event) state = state.addChanges(event, time, userEvent, config, tr);
      if (isolate == true || isolate == "after") state = state.isolate();
      return state.clip(config.minDepth);
    },
    toJSON(value, state) {
      let mkJSON = (value2) => {
        let events = [];
        for (let cur = value2; cur; cur = cur.next)
          events.push({ changes: cur.changes.toJSON(), selection: cur.startSelection.toJSON(state) });
        return events;
      };
      return {
        done: mkJSON(value.done = value.done && value.done.resolveFully(state.config)),
        undone: mkJSON(value.undone = value.undone && value.undone.resolveFully(state.config))
      };
    },
    fromJSON(json, state) {
      if (!json || !Array.isArray(json.done) || !Array.isArray(json.undone)) throw new RangeError("Invalid history JSON");
      let buildBranch = (json2) => {
        let result = null;
        for (let i = json2.length - 1; i >= 0; i--)
          result = new Branch(
            ChangeSet.fromJSON(state.schema, json2[i].changes),
            none5,
            null,
            GardSelection.fromJSON(state, json2[i].selection),
            result
          );
        return result;
      };
      return new HistoryState(buildBranch(json.done), buildBranch(json.undone));
    }
  });
  function history(config = {}) {
    return [
      historyField_,
      historyConfig.of(config),
      Command.handler(undo, undo2),
      Command.handler(redo, redo2)
    ];
  }
  ((history2) => {
    history2.field = historyField_;
    history2.isolate = Transaction.Annotation.define();
    history2.invertedEffects = GardState.Facet.define();
  })(history || (history = {}));
  var undo2 = ({ state }) => {
    let historyState = state.field(historyField_, false);
    if (state.readOnly || !historyState) return false;
    return historyState.pop(0 /* Done */, state);
  };
  var redo2 = ({ state }) => {
    let historyState = state.field(historyField_, false);
    if (state.readOnly || !historyState) return false;
    return historyState.pop(1 /* Undone */, state);
  };
  function depth(branch) {
    return branch ? branch.depth : 0;
  }
  var undoDepth = (state) => depth(state.field(historyField_, false)?.done);
  var redoDepth = (state) => depth(state.field(historyField_, false)?.undone);
  var Branch = class _Branch {
    constructor(changes, effects, mapped, startSelection, next) {
      __publicField(this, "changes", changes);
      __publicField(this, "effects", effects);
      __publicField(this, "mapped", mapped);
      __publicField(this, "startSelection", startSelection);
      __publicField(this, "next", next);
      __publicField(this, "depth");
      this.depth = depth(next) + 1;
    }
    // Assumes `this` is already resolved
    addChanges(changes, effects) {
      return new _Branch(
        changes.compose(this.changes),
        conc(Transaction.Effect.mapEffects(effects, this.changes), this.effects),
        null,
        this.startSelection,
        this.next
      );
    }
    // Resolve this event's mapping, if any.
    resolve(config) {
      if (!this.mapped) return this;
      let { mapped: { change, doc: doc2 }, next } = this;
      let { a: mappedMapping, b: mappedChanges } = ChangeSet.transform(doc2, change, this.changes);
      if (next) next = next.addMapping(mappedMapping, next.mapped ? null : this.changes.apply(doc2));
      if (mappedChanges.empty && !this.effects.length) return next && next.resolve(config);
      let selDoc, selCx2 = {
        get doc() {
          return selDoc || (selDoc = mappedChanges.apply(change.apply(doc2)));
        },
        config
      };
      return new _Branch(
        mappedChanges,
        Transaction.Effect.mapEffects(this.effects, change),
        null,
        this.startSelection.map(mappedMapping, selCx2),
        next
      );
    }
    // When serializing to JSON, we first fully resolve the whole history.
    resolveFully(config) {
      let stack = [];
      for (let head = this; head; head = head.next) {
        head = head.resolve(config);
        if (!head) break;
        stack.push(head);
      }
      let result = null;
      for (let i = stack.length - 1; i >= 0; i--) {
        let next = stack[i];
        if (next.next == result) result = next;
        else result = new _Branch(next.changes, next.effects, null, next.startSelection, result);
      }
      return result;
    }
    // Add a mapping to this change
    addMapping(change, startDoc) {
      return new _Branch(this.changes, this.effects, this.mapped ? { change: this.mapped.change.compose(change), doc: this.mapped.doc } : { change, doc: startDoc }, this.startSelection, this.next);
    }
    // Drop any events below the given depth
    clip(depth2) {
      let stack = [];
      for (let i = 0, cur = this; i < depth2 && cur; i++, cur = cur.next) stack.push(cur);
      let result = null;
      for (let i = stack.length - 1; i >= 0; i--) {
        let event = stack[i];
        result = new _Branch(event.changes, event.effects, event.mapped, event.startSelection, result);
      }
      return result;
    }
  };
  function eventFromTransaction(tr) {
    let effects = none5;
    for (let invert of tr.startState.facet(history.invertedEffects)) {
      let result = invert(tr);
      if (result.length) effects = effects.concat(result);
    }
    if (!effects.length && tr.changes.empty) return null;
    return { changes: tr.changes.invert(tr.startState.doc), effects };
  }
  function isAdjacent(a, b) {
    let ranges = [], isAdjacent2 = false;
    a.iterChangedRanges((f, t) => ranges.push(f, t));
    b.iterChangedRanges((_f, _t, f, t) => {
      for (let i = 0; i < ranges.length; ) {
        let from = ranges[i++], to = ranges[i++];
        if (t >= from && f <= to) isAdjacent2 = true;
      }
    });
    return isAdjacent2;
  }
  function conc(a, b) {
    return !a.length ? b : !b.length ? a : a.concat(b);
  }
  var none5 = [];
  var joinableUserEvent = /^(input\.type|delete)($|\.)/;
  var HistoryState = class _HistoryState {
    constructor(done, undone, prevTime = 0, prevUserEvent = void 0) {
      __publicField(this, "done", done);
      __publicField(this, "undone", undone);
      __publicField(this, "prevTime", prevTime);
      __publicField(this, "prevUserEvent", prevUserEvent);
    }
    isolate() {
      return this.prevTime ? new _HistoryState(this.done, this.undone) : this;
    }
    addChanges(event, time, userEvent, config, tr) {
      let done = this.done && this.done.resolve(tr.startState.config);
      if (done && !done.changes.empty && (!userEvent || joinableUserEvent.test(userEvent) || tr.annotation(Transaction.appended)) && (time - this.prevTime < config.newGroupDelay && config.joinToEvent(tr, isAdjacent(done.changes, event.changes)) || // For compose (but not compose.start) events, always join with previous event
      userEvent == "input.type.compose")) {
        done = done.addChanges(event.changes, event.effects);
      } else {
        done = new Branch(event.changes, event.effects, null, tr.startState.selection, done);
      }
      return new _HistoryState(done, null, time, userEvent);
    }
    pop(side, state) {
      let branch = side == 0 /* Done */ ? this.done : this.undone;
      if (!branch || !(branch = branch.resolve(state.config))) return false;
      return {
        changes: branch.changes,
        selection: branch.startSelection,
        effects: branch.effects.concat(fromHistory.of({ side, startDoc: branch.changes.apply(state.doc), rest: branch.next })),
        userEvent: side == 0 /* Done */ ? "undo" : "redo",
        scrollIntoView: true
      };
    }
    clip(minDepth) {
      let max = minDepth * 1.3;
      let done = depth(this.done) > max ? this.done.clip(minDepth) : this.done;
      let undone = depth(this.undone) > max ? this.undone.clip(minDepth) : this.undone;
      if (done != this.done || undone != this.undone) return new _HistoryState(done, undone, this.prevTime, this.prevUserEvent);
      return this;
    }
  };

  // vendor/wordgard/src/editor/inputrule.ts
  var inputRule = GardState.Facet.define();
  var appender = Transaction.appender.of(applyInputRules);
  var InputRule = class _InputRule {
    constructor(expr, apply, spec) {
      __publicField(this, "expr", expr);
      __publicField(this, "apply", apply);
      /// Rules can be added to a configuration as extension values.
      __publicField(this, "extension");
      /// @internal
      __publicField(this, "lookahead");
      /// @internal
      __publicField(this, "inCode");
      this.lookahead = spec.lookahead;
      this.inCode = !!spec.inCode;
      this.extension = [inputRule.of(this), appender];
    }
    /// Define an input rule.
    static define(spec) {
      return new _InputRule(
        ensureAnchor(spec.expr),
        typeof spec.apply == "string" ? applyString(spec.apply) : spec.apply,
        spec
      );
    }
    /// Build an input rule for automatically wrapping a textblock when
    /// a given string is typed. You'll probably want the regexp to
    /// start with `^`, so that the pattern can only occur at the start
    /// of a textblock. `tag` gives the type of plot to wrap in.
    ///
    /// When `empty` is given as `true`, the rule only applies when the
    /// expression matches the textblock's entire content.
    static wrapping(expr, tag, empty = false) {
      return _InputRule.define({
        expr,
        apply: (state, match) => {
          let wrapper = typeof tag == "function" ? tag(match) : tag;
          let { from, to } = match[0];
          let changes = [{ from: from.pos, to: to.pos }];
          let range = findWrappable(from, from, wrapper);
          if (!range) return null;
          changes.push(wrapBlockRange(range, wrapper));
          return autoJoinBlocks(state, {
            changes,
            annotations: history.isolate.of(true)
          });
        },
        lookahead: empty ? /^$/ : void 0
      });
    }
    /// Build an input rule that changes the type of a textblock when the
    /// matched text is typed into it. You'll usually want to start your
    /// regexp with `^` so that it is only matched at the start of a
    /// textblock. The optional `getAttrs` parameter can be used to compute
    /// the new node's attributes, and works the same as in the
    /// `InputRule.wrapping` function.
    static textblockType(expr, tag, empty = false) {
      return _InputRule.define({
        expr,
        apply: (state, match) => {
          let { from, to } = match[0];
          let block = typeof tag == "function" ? tag(match) : tag;
          let outer = from.parent.parent;
          if (!outer || !state.schema.canContain(outer.node.type, block.type)) return null;
          return {
            changes: [{ from: from.pos - 1, to: to.pos, insert: [block] }],
            annotations: history.isolate.of(true)
          };
        },
        lookahead: empty ? /^$/ : void 0
      });
    }
  };
  ((InputRule2) => {
    InputRule2.emDash = InputRule2.define({ expr: /--$/, apply: "\u2014" });
    InputRule2.ellipsis = InputRule2.define({ expr: /\.\.\.$/, apply: "\u2026" });
    InputRule2.openDoubleQuote = InputRule2.define({ expr: /(?:^|[\s\{\[\(\<'"\u2018\u201C])(")$/, apply: "\u201C" });
    InputRule2.closeDoubleQuote = InputRule2.define({ expr: /"$/, apply: "\u201D" });
    InputRule2.openSingleQuote = InputRule2.define({ expr: /(?:^|[\s\{\[\(\<'"\u2018\u201C])(')$/, apply: "\u2018" });
    InputRule2.closeSingleQuote = InputRule2.define({ expr: /'$/, apply: "\u2019" });
    InputRule2.smartQuotes = [InputRule2.openDoubleQuote, InputRule2.closeDoubleQuote, InputRule2.openSingleQuote, InputRule2.closeSingleQuote];
  })(InputRule || (InputRule = {}));
  function ensureAnchor(regexp) {
    let needsIndex = regexp.hasIndices === false, needsAnchor = !/\$$/.test(regexp.source);
    if (!needsIndex && !needsAnchor) return regexp;
    return new RegExp(needsAnchor ? "(?:" + regexp.source + ")$" : regexp.source, regexp.flags + (needsIndex ? "d" : ""));
  }
  function applyString(text) {
    return (state, match) => ({
      changes: { from: match[0].from.pos, to: match[0].to.pos, insert: [Leaf.text(text)] },
      annotations: history.isolate.of(true)
    });
  }
  function getGroupIndices(match) {
    if (match.indices) return match.indices;
    let result = [[0, match[0].length]];
    for (let i = 1, pos = 0; i < match.length; i++) {
      let found = match[i] ? match[0].indexOf(match[i], pos) : -1;
      result.push(found < 0 ? void 0 : [found, pos = found + match[i].length]);
    }
    return result;
  }
  function applyInputRules(trs, state) {
    let typed = -1;
    for (let i = trs.length - 1; i >= 0; i--) {
      if (trs[i].isUserEvent("input.type")) {
        for (let j = i + 1; j < trs.length; j++) if (trs[j].selection) return null;
        typed = i;
        break;
      }
    }
    if (typed < 0) return null;
    let cursor = state.sel.head, block = cursor.textblockParent;
    if (!block) return null;
    let map = state.textblockMap(block);
    let curIndex = map.toIndex(cursor.pos), textBefore = map.text.slice(0, curIndex), textAfter;
    rules: for (let rule of state.facet(inputRule)) {
      if (!rule.inCode && block.node.type.hasRole(Node.Role.Code)) continue;
      let match = rule.expr.exec(textBefore);
      if (!match || rule.lookahead && !rule.lookahead.test(textAfter ?? (textAfter = map.text.slice(curIndex))))
        continue;
      let indices = getGroupIndices(match);
      let docMatch = [], parent = -1;
      for (let i = 0; i < match.length; i++) {
        let text = match[i];
        if (text == null) {
          docMatch.push(null);
        } else {
          let is = indices[i];
          let from = state.doc.resolve(map.fromIndex(is[0]));
          let to = state.doc.resolve(map.fromIndex(is[1]));
          if (parent < 0) parent = from.parent.before;
          if (parent != from.parent.before || parent != to.parent.before) continue rules;
          if (!rule.inCode && from.parent.node.type.hasRole(Node.Role.Code)) continue rules;
          docMatch.push({ from, to, text });
        }
      }
      let spec = rule.apply(state, docMatch);
      if (spec) return spec;
    }
    return null;
  }

  // vendor/wordgard/src/editor/placeholder.ts
  var placeholderWidget = Widget.define({
    render(value) {
      let elt = document.createElement("wg-placeholder");
      elt.appendChild(value());
      return elt;
    }
  });
  var placeholderShape = GardState.Facet.define();
  function showPlaceholder(state) {
    let pos = -1;
    if (state.doc.length == 0) pos = 0;
    else if (state.doc.length == 2 && state.doc.firstChild.isPlot) pos = 1;
    else return Decoration.Point.none;
    let shape = state.facet(placeholderShape);
    if (!shape.length) return Decoration.Point.none;
    return Decoration.Point.set([[Decoration.Point.widget(placeholderWidget.of(shape[0]), { side: 1 }), pos]]);
  }
  var placeholderField = GardState.Field.define({
    create(state) {
      return showPlaceholder(state);
    },
    update(deco, tr) {
      return !tr.docChanged ? deco : showPlaceholder(tr.state);
    },
    provide: (f) => Decoration.Point.source.of((s) => s.field(f))
  });
  function placeholder(content) {
    return [
      placeholderShape.of(typeof content == "string" ? () => document.createTextNode(content) : content),
      placeholderField
    ];
  }

  // rich-text/wordgard-source/table.ts
  var table_exports = {};
  __export(table_exports, {
    CellSelection: () => CellSelection,
    tableCore: () => tableCore
  });

  // vendor/wordgard/src/table/tablemap.ts
  var Rect = class {
    constructor(startCol, startRow, endCol, endRow) {
      __publicField(this, "startCol", startCol);
      __publicField(this, "startRow", startRow);
      __publicField(this, "endCol", endCol);
      __publicField(this, "endRow", endRow);
    }
  };
  var MapData = class {
    constructor(table, width, height, map, problems, cellEnds) {
      __publicField(this, "table", table);
      __publicField(this, "width", width);
      __publicField(this, "height", height);
      __publicField(this, "map", map);
      __publicField(this, "problems", problems);
      __publicField(this, "cellEnds", cellEnds);
    }
  };
  var cache2 = /* @__PURE__ */ new WeakMap();
  var TableMap = class _TableMap {
    constructor(start, data) {
      __publicField(this, "start", start);
      __publicField(this, "data", data);
    }
    get width() {
      return this.data.width;
    }
    get height() {
      return this.data.height;
    }
    get table() {
      return this.data.table;
    }
    get tablePos() {
      return this.start - 1;
    }
    /// Find the dimensions of the cell at the given position.
    cellRect(pos) {
      let localPos = pos - this.start, { map, width, height } = this.data;
      for (let i = 0; i < map.length; i++) if (map[i] == localPos) {
        let startCol = i % width, startRow = i / width | 0;
        let endCol = startCol + 1, endRow = startRow + 1;
        for (let j = 1; endCol < width && map[i + j] == localPos; j++) endCol++;
        for (let j = 1; endRow < height && map[i + width * j] == localPos; j++) endRow++;
        return new Rect(startCol, startRow, endCol, endRow);
      }
      throw new RangeError(`No cell with offset ${pos} found`);
    }
    nearestCell(pos, bias) {
      let localPos = pos - this.start, after = -1, before = -1;
      let { map, cellEnds } = this.data;
      for (let i = 0; i < map.length; i++) {
        let cellPos = map[i];
        if (cellPos > 0) {
          if (cellPos >= localPos && (after < 0 || after > cellPos)) after = cellPos;
          if (cellPos < localPos && before < cellPos) before = cellPos;
        }
      }
      if (before > -1) {
        let beforeEnd = cellEnds.get(before);
        if (beforeEnd > localPos || after < 0 || bias < 0)
          return { from: before + this.start, to: beforeEnd + this.start };
      }
      return { from: after + this.start, to: cellEnds.get(after) + this.start };
    }
    cellEnd(pos) {
      let end = this.data.cellEnds.get(pos - this.start);
      if (end == null) throw new Error(`No cell with offset ${pos} found`);
      return end + this.start;
    }
    /// Get the rectangle spanning the two given cells.
    rectBetween(a, b) {
      let { startCol: startColA, endCol: endColA, startRow: startRowA, endRow: endRowA } = this.cellRect(a);
      let { startCol: startColB, endCol: endColB, startRow: startRowB, endRow: endRowB } = this.cellRect(b);
      return new Rect(
        Math.min(startColA, startColB),
        Math.min(startRowA, startRowB),
        Math.max(endColA, endColB),
        Math.max(endRowA, endRowB)
      );
    }
    /// Return the position of all cells that have their top start
    /// corner in the given rectangle.
    cellsInRect(rect) {
      let result = [], { map, width } = this.data;
      for (let row = rect.startRow; row < rect.endRow; row++) {
        for (let col = rect.startCol; col < rect.endCol; col++) {
          let index = row * width + col, pos = map[index];
          if (pos > 0 && result.indexOf(pos + this.start) < 0 && (col != rect.startCol || !col || map[index - 1] != pos) && (row != rect.startRow || !row || map[index - width] != pos))
            result.push(pos + this.start);
        }
      }
      return result;
    }
    /// Return the position of the cell that occupies the position at the
    /// given row and column (which must be in bounds for the table).
    cellAt(col, row) {
      let { width, map } = this.data;
      return map[col + row * width] + this.start || null;
    }
    /// Get the position at the start of the given row (which may be
    /// `width` to query the position after the last row).
    rowPos(row) {
      let { start } = this, { table } = this.data;
      for (let r = 0; r < row; r++) start += table.content[r].length;
      return start;
    }
    /// Get the position where a cell would have to be inserted to
    /// appear at the given column and row.
    cellInsertionPos(col, row) {
      let { width, map } = this.data;
      for (let scan = col; ; scan++) {
        if (scan == width) return this.rowPos(row + 1) - 1;
        let index = scan + row * width, pos = map[index];
        if (pos && (!row || pos != map[index - width] && (!col || pos != map[index - 1]))) return pos + this.start;
      }
    }
    /// Get the node for the cell at the given position.
    getCell(pos) {
      let found = this.data.table.plotAt(pos - this.start);
      if (!found) throw new Error("Invalid cell position");
      return found;
    }
    cellsOverlapRectangle(rect) {
      let { width, height, map } = this.data;
      let indexTop = rect.startRow * width + rect.startCol, indexBefore = indexTop;
      let indexBottom = (rect.endRow - 1) * width + rect.endCol, indexAfter = indexTop + (rect.endCol - rect.startCol - 1);
      for (let i = rect.startRow; i < rect.endRow; i++) {
        if (rect.startCol > 0 && sameCell(map[indexBefore], map[indexBefore - 1]) || rect.endCol < width && sameCell(map[indexAfter], map[indexAfter + 1])) return true;
        indexBefore += width;
        indexAfter += width;
      }
      for (let i = rect.startCol; i < rect.endCol; i++) {
        if (rect.startRow > 0 && sameCell(map[indexTop], map[indexTop - width]) || rect.endRow < height && sameCell(map[indexBottom], map[indexBottom + width])) return true;
        indexTop++;
        indexBottom++;
      }
      return false;
    }
    /// Find the table map for the given table node.
    static get(table, start) {
      let data = cache2.get(table);
      if (!data) cache2.set(table, data = computeMap(table));
      return new _TableMap(start, data);
    }
  };
  function sameCell(a, b) {
    return a != 0 && a == b;
  }
  function computeMap(table) {
    if (table.type != Table.type) throw new RangeError(`Not a table node: ${table.type.name}`);
    let width = table.content[0].content.reduce((w, c) => w + (c.mark(ColSpan) ?? 1), 0);
    let height = table.content.length;
    let map = [], problems = null;
    for (let i = 0, e = width * height; i < e; i++) map[i] = 0;
    let cellEnd = /* @__PURE__ */ new Map();
    for (let row = 0, pos = 0; row < height; row++) {
      let rowNode = table.content[row], mapPos = row * width;
      pos++;
      for (let i = 0, col = 0; ; i++) {
        while (mapPos < map.length && map[mapPos] != 0) mapPos++;
        if (i == rowNode.content.length) break;
        let cellNode = rowNode.content[i];
        cellEnd.set(pos, pos + cellNode.length);
        let colSpan = cellNode.mark(ColSpan) ?? 1, rowSpan = cellNode.mark(RowSpan) ?? 1;
        let exceed = col + colSpan - width;
        if (exceed > 0) {
          map = growMap(map, width, height, exceed);
          width += exceed;
          mapPos += row * exceed;
        }
        for (let h = 0; h < rowSpan; h++) {
          if (h + row >= height) {
            (problems || (problems = [])).push({ type: "overlong_rowspan", pos, n: rowSpan - h });
            break;
          }
          let start = mapPos + h * width, collided = 0;
          for (let w = 0; w < colSpan; w++) {
            if (map[start + w] == 0) map[start + w] = pos;
            else collided++;
          }
          if (collided) (problems || (problems = [])).push({ type: "collision", pos });
        }
        mapPos += colSpan;
        col += colSpan;
        pos += cellNode.length;
      }
      pos++;
    }
    for (let row = 0, i = 0; row < height; row++) {
      let missing = 0;
      for (let col = 0; col < width; col++) if (map[i++] == 0) missing++;
      if (missing) (problems || (problems = [])).push({ type: "missing", row, n: missing });
    }
    return new MapData(table, width, height, map, problems, cellEnd);
  }
  function growMap(map, width, height, count) {
    let newMap = [];
    for (let row = 0, i = 0; row < height; row++) {
      for (let col = 0; col < width; col++) newMap.push(map[i++]);
      for (let j = 0; j < count; j++) newMap.push(0);
    }
    return newMap;
  }

  // vendor/wordgard/src/table/cellselection.ts
  var cellSelectionDeco = GardState.Field.define({
    create: getCellDeco,
    update: (deco, tr) => {
      return tr.docChanged || tr.selection ? getCellDeco(tr.state) : deco;
    },
    provide: (f) => Decoration.Point.source.of((s) => s.field(f))
  });
  var selectedCell = Decoration.Point.attributes({ class: "wg-selected-cell" });
  function getCellDeco(state) {
    if (!(state.selection instanceof CellSelection)) return Decoration.Point.none;
    return Decoration.Point.set(state.selection.ranges.map(({ from }) => [selectedCell, from - 1]));
  }
  var tableSelectionFilter = GardState.prec.low(Transaction.extender.of((tr) => {
    let normalized = CellSelection.normalize(tr.newSelection, tr.newDoc);
    return normalized ? { selection: normalized } : null;
  }));
  function resolveDir(dir, state) {
    let block = state.sel.head.textblockParent;
    return dir == "right" == (block ? state.textblockLTR(block.node) : state.textLTR) ? "forward" : "backward";
  }
  function cursorCommand(wg, { dir, extend }) {
    let { state } = wg, { selection } = state;
    if (!(selection instanceof CellSelection)) return false;
    let newSel;
    if (!extend) {
      newSel = GardSelection.near(state, selection.replacementRange.from, 1);
    } else {
      if (dir == "left" || dir == "right") dir = resolveDir(dir, state);
      newSel = selection.moveHead(state.doc, dir);
      if (!newSel) {
        let forward = dir == "forward" || dir == "down";
        let table = state.sel.from.parent.parent;
        let next = GardSelection.near(state, forward ? table.after : table.before, forward ? 1 : -1);
        newSel = GardSelection.range(forward ? table.before : table.after, next.head, next.headSide);
      }
    }
    wg.dispatch({
      selection: newSel,
      scrollIntoView: true,
      userEvent: "select"
    });
    return true;
  }
  function moveToRowSide(wg, { dir, extend }) {
    let { state } = wg, { selection } = state;
    if (!(selection instanceof CellSelection)) return false;
    if (dir == "left" || dir == "right") dir = resolveDir(dir, state);
    for (; ; ) {
      let next = selection.moveHead(state.doc, dir);
      if (!next) break;
      selection = next;
    }
    if (selection != state.selection) wg.dispatch({
      selection,
      scrollIntoView: true,
      userEvent: "select"
    });
    return true;
  }
  var cellSelectionTripleClick = Wordgard.mouseSelectionStyle.of((wg, event) => {
    if (event.detail == 3) {
      let pos = wg.state.doc.resolve(wg.posAtCoords({ x: event.clientX, y: event.clientY }).pos);
      let cell = pos.matchingParent((n) => wg.state.schema.matchNode(n.type, Node.Group.TableCell));
      if (cell) {
        let from = cell.before, to = cell.after;
        return {
          get(event2) {
            return CellSelection.between(wg.state.doc, from, to) || GardSelection.near(wg.state, from, 1);
          },
          update(update) {
            from = update.changes.mapPos(from, 1);
            to = Math.max(from, update.changes.mapPos(to, -1));
          }
        };
      }
    }
    return null;
  });
  var _CellSelection = class _CellSelection extends GardSelection {
    constructor(anchor, head, anchorCell, headCell, _ranges, anchorRange) {
      super(anchor, head);
      __publicField(this, "anchorCell", anchorCell);
      __publicField(this, "headCell", headCell);
      __publicField(this, "_ranges", _ranges);
      __publicField(this, "anchorRange", anchorRange);
    }
    get ranges() {
      return this._ranges;
    }
    get replacementRange() {
      return this._ranges[this.anchorRange];
    }
    get domSelection() {
      let { from, to } = this.replacementRange;
      return { anchor: from, anchorSide: 1, head: to, headSide: -1 };
    }
    toSlice(doc2) {
      let base = doc2.resolve(this.anchorCell), table = base.parent.parent;
      let map = TableMap.get(table.node, table.start);
      let rect = map.rectBetween(this.anchorCell, this.headCell);
      let rows = [], added = /* @__PURE__ */ new Set();
      for (let row = rect.startRow; row < rect.endRow; row++) {
        let rowContent = [];
        for (let col = rect.startCol; col < rect.endCol; col++) {
          let cell = map.cellAt(col, row);
          if (added.has(cell)) continue;
          added.add(cell);
          rowContent.push(map.getCell(cell));
        }
        rows.push(table.node.content[row].tag.create(rowContent));
      }
      return Slice.of(rows, [table.node.tag]);
    }
    eq(other) {
      return other instanceof _CellSelection && other.anchor == this.anchor && other.head == this.head;
    }
    map(changes, cx, assoc = -1) {
      let fromPos = changes.mapPos(this.from, 1), toPos = changes.mapPos(this.to, -1);
      let from = cx.doc.resolve(fromPos), to = cx.doc.resolve(toPos);
      let after = from.nodeAfter, before = to.nodeBefore;
      if (after && after.type == Table.type) fromPos += 2;
      else if (after && after.type == TableRow.type) fromPos++;
      if (before && before.type == Table.type) toPos -= 2;
      else if (before && before.type == TableRow.type) toPos--;
      return (this.from == this.anchor ? _CellSelection.between(cx.doc, fromPos, toPos) : _CellSelection.between(cx.doc, toPos, fromPos)) || GardSelection.near(cx, changes.mapPos(this.head), assoc);
    }
    /// Move the head cell in the given direction, returning a new cell
    /// selection if the selection can be extended that way.
    moveHead(doc2, dir) {
      let head = doc2.resolve(this.head), inv = this.head < this.anchor;
      let headPos = this.head - (inv ? 0 : head.nodeBefore.length);
      let table = head.parent.parent, map = TableMap.get(table.node, table.start), rect = map.cellRect(headPos);
      let anchorPos = inv ? map.nearestCell(this.anchor, -1).from : this.anchor;
      let col = dir == "backward" ? rect.startCol - 1 : dir == "forward" ? rect.endCol : rect.startCol;
      let row = dir == "up" ? rect.startRow - 1 : dir == "down" ? rect.endRow : rect.startRow;
      if (col < 0 || col >= map.width || row < 0 || row >= map.height) return null;
      let newHead = map.cellAt(col, row);
      if (newHead == null) return null;
      return newHead >= anchorPos ? _CellSelection.between(doc2, anchorPos, map.cellEnd(newHead)) : _CellSelection.between(doc2, newHead, map.cellEnd(anchorPos));
    }
    /// Create a table selection between the given points. They should
    /// point before and after the first and last cell of the selection
    /// (`anchor` may be before or after `head`, as long as the lower
    /// sits before a cell and the higher after a cell). Returns `null`
    /// if the given range does not wrap a range of cells in a single
    /// table.
    static between(doc2, anchor, head) {
      let from = doc2.resolve(Math.min(anchor, head)), to = doc2.resolve(Math.max(anchor, head));
      let fromCell = from.nodeAfter, toCell = to.nodeBefore, table = from.parent?.parent;
      if (anchor == head || !fromCell || !doc2.schema.matchNode(fromCell.type, Node.Group.TableCell) || !toCell || !doc2.schema.matchNode(toCell.type, Node.Group.TableCell) || !table || table.start > to.pos || table.end < to.pos)
        return null;
      let toPos = to.pos - toCell.length;
      let map = TableMap.get(table.node, table.start);
      let cells = map.cellsInRect(map.rectBetween(from.pos, toPos));
      let anchorCell = anchor, headCell = head;
      if (anchor > head) anchorCell -= toCell.length;
      else headCell -= toCell.length;
      return new _CellSelection(
        anchor,
        head,
        anchorCell,
        headCell,
        cells.map((pos) => ({ from: pos + 1, to: map.cellEnd(pos) - 1 })),
        cells.indexOf(head - (head < anchor ? 0 : toCell.length))
      );
    }
    /// Given a selection, this returns null if that selection is valid
    /// (is a cell selection, or a selection that starts and ends outside
    /// of tables, or in the same table cell). Otherwise, it will expand a
    /// selection within a single table to a cell selection, or expand a
    /// selection that crosses table boundaries to cover the entire table(s).
    static normalize(sel, doc2) {
      if (sel instanceof _CellSelection) return null;
      let { from, to } = sel, modified = false;
      for (let parent = doc2.resolve(sel.from).parent, cell = null; parent; parent = parent.parent) {
        if (doc2.schema.matchNode(parent.node.type, Node.Group.TableCell)) cell = parent;
        if (parent.node.type == Table.type) {
          if (to > parent.end) {
            from = parent.before;
            modified = true;
          } else if (!cell || to > cell.end) {
            let map = TableMap.get(parent.node, parent.start);
            let start = map.nearestCell(from, 1), end = map.nearestCell(to, -1);
            if (start.from > end.from) end = start;
            return sel.anchor < sel.head ? _CellSelection.between(doc2, start.from, end.to) : _CellSelection.between(doc2, end.to, start.from);
          }
        }
      }
      for (let parent = doc2.resolve(sel.to).parent; parent; parent = parent.parent) {
        if (parent.node.type == Table.type && from < parent.start) {
          to = parent.after;
          modified = true;
        }
      }
      return !modified ? null : sel.anchor < sel.head ? GardSelection.range(from, to) : GardSelection.range(to, from);
    }
  };
  /// This object can be used as an extension to enable cell selection.
  __publicField(_CellSelection, "extension", [
    GardSelection.define(
      "cell",
      _CellSelection,
      (sel) => ({ anchor: sel.anchor, head: sel.head }),
      (doc2, json) => {
        if (!json || typeof json.anchor != "number" || typeof json.head != "number")
          throw new ValidationError("Invalid JSON data for CellSelection");
        let sel = _CellSelection.between(doc2, json.anchor, json.head);
        if (!sel) throw new ValidationError("Cell selection from JSON doesn't span actual cells");
        return sel;
      }
    ),
    cellSelectionDeco,
    tableSelectionFilter,
    Command.handler(moveByUnit, cursorCommand),
    Command.handler(moveByWord, cursorCommand),
    Command.handler(moveByLine, cursorCommand),
    Command.handler(moveToLineSide, moveToRowSide),
    cellSelectionTripleClick
  ]);
  var CellSelection = _CellSelection;

  // vendor/wordgard/src/table/correct.ts
  var tableCorrection = Correction.onContent(Table, (pos) => {
    let map = TableMap.get(pos.node, pos.start);
    if (!map.data.problems) return null;
    let { schema } = pos.doc;
    let mustAdd = [], changes = [];
    for (let i = 0; i < map.height; i++) mustAdd.push(0);
    for (let i = 0; i < map.data.problems.length; i++) {
      let prob = map.data.problems[i];
      if (prob.type == "collision") {
        let pos2 = prob.pos + map.start, rect = map.cellRect(pos2), cell = map.getCell(pos2);
        let colSpan = ColSpan.isInSet(cell.marks), rowSpan = RowSpan.isInSet(cell.marks);
        if (colSpan) changes.push({ from: pos2, remove: colSpan });
        if (rowSpan) changes.push({ from: pos2, remove: rowSpan });
        for (let row = rect.startRow, endRow = row + (rowSpan ? rowSpan.value : 1), first2 = true; row < endRow; row++) {
          for (let col = rect.startCol, endCol = col + (colSpan ? colSpan.value : 1); col < endCol; col++) {
            if (first2) {
              first2 = false;
            } else if (map.cellAt(col, row) == pos2) {
              let from = pos2;
              for (let scan = 0; from == pos2; scan++) from = map.cellInsertionPos(col + scan, row);
              changes.push({ from, insert: [schema.createAndFill(cell.type.default)] });
            }
          }
        }
      } else if (prob.type == "missing") {
        mustAdd[prob.row] += prob.n;
      } else if (prob.type == "overlong_rowspan") {
        let cell = map.getCell(prob.pos + map.start), cur = RowSpan.isInSet(cell.marks), newVal = cur.value - prob.n;
        let from = pos.start + prob.pos;
        changes.push(newVal == 1 ? { from, remove: cur } : { from, add: RowSpan.of(newVal) });
      }
    }
    let first, last;
    for (let i = 0; i < mustAdd.length; i++) if (mustAdd[i]) {
      if (first == null) first = i;
      last = i;
    }
    for (let i = 0, curPos = pos.start; i < map.height; i++) {
      let row = pos.node.content[i], end = curPos + row.length;
      let add = mustAdd[i];
      if (add > 0) {
        let cell = schema.defaultContentPlot(row.tag.type);
        let nodes = [];
        for (let j = 0; j < add; j++)
          nodes.push(schema.createAndFill(cell));
        let side = (i == 0 || first == i - 1) && last == i ? curPos + 1 : end - 1;
        changes.push({ from: side, insert: nodes });
      }
      curPos = end;
    }
    return changes;
  });

  // vendor/wordgard/src/table/tablecommands.ts
  function tableContext(state, pos) {
    let table, cells;
    if (pos != null || !(state.selection instanceof CellSelection)) {
      let ref = pos != null ? state.doc.resolve(pos) : state.sel.head;
      let cellPos = ref.matchingParent((node) => state.schema.matchNode(node.type, Node.Group.TableCell));
      if (cellPos && cellPos.parent?.parent) {
        table = cellPos.parent.parent;
        cells = [cellPos.before];
      }
    } else {
      table = state.sel.anchor.parent.parent;
      cells = state.selection.ranges.map((r) => r.from - 1);
    }
    return cells ? { cells, map: TableMap.get(table.node, table.start) } : null;
  }
  function cellTag(schema) {
    if (schema.has(Cell)) return Cell;
    if (schema.has(BlockCell)) return BlockCell;
    throw new Error(`No cell type in schema`);
  }

  // vendor/wordgard/src/table/tablepaste.ts
  function fitSlice(schema, parent, slice) {
    let wrap = schema.findWrapping(schema.docTag.type, parent.type);
    if (!wrap) return null;
    let content = [schema.createAndFill(parent)];
    for (let i = wrap.length - 1; i >= 0; i--) content = [wrap[i].create(content)];
    let doc2 = schema.doc(content);
    let changes = ChangeSet.create(doc2, { from: wrap.length + 1, to: doc2.length - wrap.length - 1, insert: slice, fit: true });
    doc2 = changes.apply(doc2);
    let node = doc2.length > wrap.length && doc2.plotAt(wrap.length);
    return node && node.type == parent.type ? node : null;
  }
  function isTableContent(schema, type) {
    return type == TableRow.type || schema.matchNode(type, Node.Group.TableCell);
  }
  function pastedCells(schema, slice) {
    let table = null, tok;
    if (slice.content.length == 1 && (tok = slice.content[0]).tokenType == Token.Type.Node && tok.type == Table.type) {
      table = tok;
    } else if (slice.context.some((tag) => isTableContent(schema, tag.type)) || slice.content.some((tok2) => tok2.tokenType != Token.Type.Close && isTableContent(schema, tok2.type))) {
      table = fitSlice(schema, Table, slice);
    }
    return table && ensureRectangular(schema, table.content.map((row) => row.content));
  }
  function ensureRectangular(schema, rows) {
    let widths = [];
    for (let i = 0; i < rows.length; i++) {
      for (let cell of rows[i]) {
        let rowSpan = cell.mark(RowSpan) ?? 1, colSpan = cell.mark(ColSpan) ?? 1;
        for (let r = i; r < i + rowSpan; r++) widths[r] = (widths[r] || 0) + colSpan;
      }
    }
    let width = widths.reduce((a, b) => Math.max(a, b));
    for (let r = 0; r < widths.length; r++) {
      if (r >= rows.length) rows[r] = [];
      for (let i = widths[r]; i < width; i++) rows[r] = rows[r].concat(schema.createAndFill(cellTag(schema)));
    }
    return { height: rows.length, width, rows };
  }
  function clipCells({ width, height, rows }, newWidth, newHeight) {
    if (width != newWidth) {
      let added = /* @__PURE__ */ new Map();
      rows = rows.map((row, i) => {
        let cells = [], size = added.get(i) ?? 0, j = 0;
        while (size < newWidth) {
          let nextCell = row[j++ % row.length];
          let rowSpan = nextCell.mark(RowSpan) ?? 1, colSpan = nextCell.mark(ColSpan) ?? 1;
          if (size + colSpan > newWidth) {
            colSpan = newWidth - size;
            nextCell = nextCell.withMarks(colSpan == 1 ? ColSpan.removeFromSet(nextCell.marks) : ColSpan.of(colSpan).addToSet(nextCell.marks));
          }
          for (let k = 1; k < rowSpan; k++) added.set(i + k, (added.get(i + k) ?? 0) + colSpan);
          size += colSpan;
          cells.push(nextCell);
        }
        return cells;
      });
    }
    if (height != newHeight) {
      let newRows = [];
      for (let i = 0; i < newHeight; i++) {
        let nextRow = rows[i % rows.length], space = newHeight - i;
        newRows.push(nextRow.map((cell) => {
          let rowSpan = cell.mark(RowSpan) ?? 1;
          return rowSpan <= space ? cell : cell.withMarks(space == 1 ? RowSpan.removeFromSet(cell.marks) : RowSpan.of(space).addToSet(cell.marks));
        }));
      }
      rows = newRows;
    }
    return { height: newHeight, width: newWidth, rows };
  }
  function growTableHorizontally(schema, map, width) {
    let changes = [];
    if (width > map.width) {
      for (let row = 0; row < map.height; row++) {
        let lastCell = map.table.content[row].lastChild;
        let fillCell = schema.createAndFill((lastCell || cellTag(schema)).type.default), cells = [];
        for (let i = map.width; i < width; i++) cells.push(fillCell);
        changes.push({ from: map.cellInsertionPos(map.width, row), insert: cells });
      }
    }
    return changes;
  }
  function growTableVertically(schema, map, height) {
    let changes = [];
    if (height > map.height) {
      let cells = [];
      for (let i = 0; i < map.width; i++) cells.push(schema.createAndFill(cellTag(schema)));
      let row = TableRow.create(cells), rows = [];
      for (let i = map.height; i < height; i++) rows.push(row);
      changes.push({ from: map.rowPos(map.height), insert: rows });
    }
    return changes;
  }
  function isolateVertically(schema, map, startCol, endCol, row) {
    let changes = [];
    if (row == 0 || row == map.height) return changes;
    for (let col = startCol; col < endCol; ) {
      let pos = map.cellAt(col, row);
      if (pos != null && map.cellAt(col, row - 1) == pos) {
        let node = map.getCell(pos), rect = map.cellRect(pos);
        let topRows = row - rect.startRow, botRows = rect.endRow - row;
        changes.push(topRows == 1 ? { from: pos, remove: RowSpan.isInSet(node.marks) } : { from: pos, add: RowSpan.of(topRows) });
        let split = node.tag.withMarks(botRows == 1 ? RowSpan.removeFromSet(node.marks) : RowSpan.of(botRows).addToSet(node.marks));
        changes.push({ from: map.cellInsertionPos(rect.startCol, row), insert: [schema.createAndFill(split)] });
        col = rect.endCol;
      } else {
        col++;
      }
    }
    return changes;
  }
  function isolateHorizontally(schema, map, startRow, endRow, col) {
    let changes = [];
    if (col == 0 || col == map.width) return changes;
    for (let row = startRow; row < endRow; ) {
      let pos = map.cellAt(col, row);
      if (pos != null && map.cellAt(col - 1, row) == pos) {
        let node = map.getCell(pos), rect = map.cellRect(pos);
        let topCols = col - rect.startCol, botCols = rect.endCol - col;
        changes.push(topCols == 1 ? { from: pos, remove: ColSpan.isInSet(node.marks) } : { from: pos, add: ColSpan.of(topCols) });
        let split = node.tag.withMarks(botCols == 1 ? ColSpan.removeFromSet(node.marks) : ColSpan.of(botCols).addToSet(node.marks));
        changes.push({ from: map.cellInsertionPos(col, row), insert: [schema.createAndFill(split)] });
        row = rect.endRow;
      } else {
        row++;
      }
    }
    return changes;
  }
  function insertCells(state, map, startCol, startRow, cells, event) {
    let { schema } = state.doc;
    let endCol = startCol + cells.width, endRow = startRow + cells.height;
    let doc2 = state.doc, changeSet = null, changes = [];
    function flush() {
      if (changes.length) {
        let newSet = ChangeSet.create(doc2, changes);
        doc2 = newSet.apply(doc2);
        changeSet = changeSet ? changeSet.compose(newSet) : newSet;
        let table = doc2.resolvePlot(map.tablePos);
        map = TableMap.get(table.node, table.start);
        changes = [];
      }
    }
    if (map.width < endCol) changes = growTableHorizontally(schema, map, endCol);
    else if (endCol < map.width) changes = isolateHorizontally(schema, map, startRow, endRow, endCol);
    flush();
    if (startCol) changes = isolateHorizontally(schema, map, startRow, endRow, startCol);
    flush();
    if (map.height < endRow) changes = growTableVertically(schema, map, endRow);
    else if (endRow < map.height) changes = isolateVertically(schema, map, startCol, endCol, endRow);
    flush();
    if (startRow) changes = isolateVertically(schema, map, startCol, endCol, startRow);
    flush();
    for (let i = 0; i < cells.height; i++) {
      let content = cells.rows[i], row = startRow + i;
      changes.push({ from: map.cellInsertionPos(startCol, row), to: map.cellInsertionPos(endCol, row), insert: content });
    }
    flush();
    let startCell = map.cellAt(startCol, startRow);
    let endCell = map.cellAt(endCol - 1, endRow - 1);
    let selection = startCell == null || endCell == null ? void 0 : CellSelection.between(doc2, startCell, endCell + map.getCell(endCell).length);
    return {
      changes: changeSet,
      selection,
      userEvent: `${event}.paste`
    };
  }
  function handleTablePaste(state, slice, drop) {
    if (state.readOnly) return false;
    let { schema } = state.doc;
    if (drop == null && state.selection instanceof CellSelection) {
      let cells = pastedCells(schema, slice);
      if (!cells) {
        let single = fitSlice(schema, cellTag(schema), slice);
        if (!single) return false;
        cells = { width: 1, height: 1, rows: [[single]] };
      }
      let table = state.sel.from.parent.parent, map = TableMap.get(table.node, table.start);
      let rect = map.rectBetween(state.selection.anchorCell, state.selection.headCell);
      return insertCells(
        state,
        map,
        rect.startCol,
        rect.startRow,
        clipCells(cells, rect.endCol - rect.startCol, rect.endRow - rect.startRow),
        "paste"
      );
    } else {
      let cx = tableContext(state, drop), cells;
      if (!cx || !(cells = pastedCells(schema, slice))) return false;
      let rect = cx.map.cellRect(cx.cells[0]);
      return insertCells(state, cx.map, rect.startCol, rect.startRow, cells, drop == null ? "drop" : "paste");
    }
  }
  var tablePasteHandler = Wordgard.pasteHandler.of((wg, _event, slice) => {
    let tr = handleTablePaste(wg.state, slice);
    return tr && (wg.dispatch(tr), true);
  });
  var tableDropHandler = Wordgard.dropHandler.of((wg, _event, pos, move, slice) => {
    if (wg.state.readOnly) return false;
    let tr = handleTablePaste(wg.state, slice, pos);
    if (!tr) return false;
    if (move) {
      let clear = [];
      wg.state.doc.iterate(move.from, move.to, (node, pos2) => {
        if (wg.state.schema.matchNode(node.type, Node.Group.TableCell))
          clear.push({ from: pos2 + 1, to: pos2 + node.length - 1, fit: true });
      });
      let tr2 = wg.state.update(Transaction.merge(wg.state, tr, { changes: clear }));
      wg.dispatch(tr2);
    } else {
      wg.dispatch(tr);
    }
    return true;
  });

  // rich-text/wordgard-source/table.ts
  var tableCore = [CellSelection, tableCorrection, tablePasteHandler, tableDropHandler];
  return __toCommonJS(wordgard_module_exports);
})();
