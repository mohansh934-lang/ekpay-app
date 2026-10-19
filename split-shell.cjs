#!/usr/bin/env node
/**
 * split-shell.cjs: src/components/EkAppView.tsx ko todta hai.
 *
 *   views/   SplashOverlay, AuthScreen, LockScreen, MainApp
 *   modals/  NumModal, PinSheet, BalSheet, BalPinModal
 *   layout/  NotifBanner, AppHeader, BottomNav
 *   screens/ TxnScreen, StkScreen   (jo pehle IIFE ki wajah se inline reh gayi thi)
 *
 * Chalane ka tarika (project root me):
 *   git checkout -b split-shell
 *   node split-shell.cjs
 *
 * Safety:
 *  - Git working tree clean hona chahiye. Backup = git (koi .bak nahi).
 *  - Pehle tsc (baseline), phir changes, phir tsc dobara. Error aaya to sab rollback.
 *  - Khud verify karti hai ki naya code purane JSX se bilkul identical hai (whitespace chhodke).
 *    Identical nahi nikla to bhi rollback.
 *
 * Flag: --no-check (tsc skip)
 */
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT = process.cwd();
const VIEW = "src/components/EkAppView.tsx";
const NO_CHECK = process.argv.includes("--no-check");
const die = (m) => { console.error("\n❌ " + m + "\n"); process.exit(1); };
const abs = (p) => path.join(ROOT, p);

let ts;
try { ts = require(abs("node_modules/typescript")); } catch { die("node_modules/typescript nahi mila. `npm install` chalao aur project root me ye script chalao."); }

// ---------- 0. Pre-checks ----------
if (!fs.existsSync(abs(VIEW))) die(`${VIEW} nahi mili. Pehle split-page.cjs wala split hona chahiye.`);
const dirty = cp.spawnSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: ROOT, encoding: "utf8" });
if (dirty.status !== 0) die("git repo nahi mila.");
if (dirty.stdout.trim()) die("Git me uncommitted changes hain. Pehle commit ya stash karo:\n" + dirty.stdout);
for (const d of ["views", "modals", "layout"]) if (fs.existsSync(abs("src/components/" + d))) die(`src/components/${d} pehle se hai. Hata ke dobara chalao.`);
for (const n of ["TxnScreen", "StkScreen"]) if (fs.existsSync(abs(`src/components/screens/${n}.tsx`))) die(`${n}.tsx pehle se hai.`);

function runTsc() {
  return cp.spawnSync(process.execPath, [abs("node_modules/typescript/bin/tsc"), "--noEmit", "-p", "."], { cwd: ROOT, encoding: "utf8" });
}
if (!NO_CHECK) {
  process.stdout.write("==> Baseline tsc chal raha hai... ");
  const b = runTsc();
  if (b.status !== 0) die("Split se PEHLE hi tsc errors hain. Pehle unhe theek karo:\n" + (b.stdout || b.stderr).slice(0, 2000));
  console.log("ok");
}

// ---------- helpers ----------
const originalFiles = new Map(); // modify hone wali files ka original content (rollback ke liye)
const createdFiles = [];
function remember(rel) { if (!originalFiles.has(rel) && fs.existsSync(abs(rel))) originalFiles.set(rel, fs.readFileSync(abs(rel), "utf8")); }
function write(rel, content, isNew) {
  if (isNew) createdFiles.push(rel); else remember(rel);
  fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
  fs.writeFileSync(abs(rel), content.endsWith("\n") ? content : content + "\n", "utf8");
}
function rollback() {
  for (const [rel, c] of originalFiles) fs.writeFileSync(abs(rel), c, "utf8");
  for (const rel of createdFiles) fs.rmSync(abs(rel), { force: true });
  for (const d of ["views", "modals", "layout"]) {
    try { const p = abs("src/components/" + d); if (fs.existsSync(p) && !fs.readdirSync(p).length) fs.rmdirSync(p); } catch {}
  }
}
const pascal = (s) => s.split(/[^A-Za-z0-9]+/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join("");
const unparen = (e) => { while (e && ts.isParenthesizedExpression(e)) e = e.expression; return e; };
const strip = (s) => s.replace(/\s+/g, "");

function loadProgram(rel) {
  const cfgPath = ts.findConfigFile(ROOT, ts.sys.fileExists, "tsconfig.json");
  if (!cfgPath) die("tsconfig.json nahi mila.");
  const cfg = ts.getParsedCommandLineOfConfigFile(cfgPath, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => die(ts.flattenDiagnosticMessageText(d.messageText, "\n")) });
  const program = ts.createProgram(cfg.fileNames, cfg.options);
  const sf = program.getSourceFile(abs(rel));
  if (!sf) die(`${rel} tsconfig ke include me nahi hai.`);
  return { checker: program.getTypeChecker(), sf };
}
function isNullable(checker, node) {
  const t = checker.getTypeAtLocation(node);
  const F = ts.TypeFlags.Null | ts.TypeFlags.Undefined;
  return !!(t.flags & F) || (t.isUnion() && t.types.some((x) => x.flags & F));
}
function flattenAnd(e) {
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return [...flattenAnd(e.left), e.right];
  return [e];
}
function eqLiteral(op, ident) {
  if (ts.isBinaryExpression(op) && op.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
      ts.isIdentifier(op.left) && op.left.text === ident && ts.isStringLiteral(op.right)) return op.right.text;
  return null;
}
function guardsFor(checker, conds) {
  const g = [];
  for (const c of conds) {
    if (ts.isIdentifier(c) && isNullable(checker, c)) g.push({ name: c.text, code: `if (!${c.text}) return null;` });
    else if (ts.isBinaryExpression(c) && c.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken &&
             ts.isIdentifier(c.left) && c.right.getText() === "undefined" && isNullable(checker, c.left)) {
      g.push({ name: c.left.text, code: `if (${c.left.text} === undefined) return null;` });
    }
  }
  return g;
}
const isJsx = (n) => n && (ts.isJsxElement(n) || ts.isJsxFragment(n) || ts.isJsxSelfClosingElement(n));
const tagIs = (n, tag) => ts.isJsxElement(n) && n.openingElement.tagName.getText() === tag;
const hasId = (n, id) => ts.isJsxElement(n) && n.openingElement.attributes.properties.some((p) => ts.isJsxAttribute(p) && p.name.text === "id" && p.initializer && ts.isStringLiteral(p.initializer) && p.initializer.text === id);

// ---------- target finders ----------
/** Level 1: EkAppView ka root JSX */
function findViewTargets(root, checker) {
  const out = [];
  const modalMap = { showSplash: ["SplashOverlay", "views"], numModal: ["NumModal", "modals"], pinSheet: ["PinSheet", "modals"], balSheetOpen: ["BalSheet", "modals"], balCheckModal: ["BalPinModal", "modals"] };
  const found = new Set();
  (function walk(n) {
    if (ts.isJsxExpression(n) && n.expression) {
      const e = n.expression;
      // {x && ( <JSX/> )}
      if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && ts.isIdentifier(e.left) && modalMap[e.left.text] && ts.isParenthesizedExpression(e.right) && isJsx(e.right.expression)) {
        const [name, dir] = modalMap[e.left.text];
        out.push({ name, dir, kind: "jsx", replace: e.right, inner: e.right.expression, parens: true, guards: guardsFor(checker, [e.left]) });
        found.add(e.left.text);
        return;
      }
      // {authState === "loading" ? null : authState === "out" ? (A) : !unlocked ? (B) : (C)}
      if (ts.isConditionalExpression(e) && e.whenTrue.getText() === "null") {
        const c2 = e.whenFalse;
        if (ts.isConditionalExpression(c2) && ts.isConditionalExpression(c2.whenFalse)) {
          const c3 = c2.whenFalse;
          const A = c2.whenTrue, B = c3.whenTrue, C = c3.whenFalse;
          if (ts.isParenthesizedExpression(A) && ts.isParenthesizedExpression(B) && ts.isParenthesizedExpression(C)) {
            for (const [node, name] of [[A, "AuthScreen"], [B, "LockScreen"], [C, "MainApp"]]) {
              out.push({ name, dir: "views", kind: "jsx", replace: node, inner: node.expression, parens: true, guards: [] });
            }
            found.add("auth-ternary");
            return;
          }
        }
      }
    }
    ts.forEachChild(n, walk);
  })(root);
  for (const k of [...Object.keys(modalMap), "auth-ternary"]) if (!found.has(k)) die(`EkAppView me "${k}" wala block nahi mila. File ka structure alag hai.`);
  return out;
}

/** Level 2: MainApp ka root JSX */
function findMainTargets(root, checker) {
  const out = [];
  const found = new Set();
  (function walk(n) {
    if (ts.isJsxExpression(n) && n.expression && ts.isBinaryExpression(n.expression)) {
      const ops = flattenAnd(n.expression);
      const last = ops[ops.length - 1];
      const conds = ops.slice(0, -1);
      // {banner && ( <JSX/> )}
      if (conds.length === 1 && ts.isIdentifier(conds[0]) && conds[0].text === "banner" && ts.isParenthesizedExpression(last) && isJsx(last.expression)) {
        out.push({ name: "NotifBanner", dir: "layout", kind: "jsx", replace: last, inner: last.expression, parens: true, guards: guardsFor(checker, conds) });
        found.add("banner");
        return;
      }
      // {baseView === "x" && cond && (() => { ... })()}
      const base = conds.map((c) => eqLiteral(c, "baseView")).find((x) => x !== null);
      if (base && ts.isCallExpression(last) && last.arguments.length === 0) {
        const fn = unparen(last.expression);
        if (fn && ts.isArrowFunction(fn) && ts.isBlock(fn.body) && fn.parameters.length === 0) {
          out.push({ name: pascal(base) + "Screen", dir: "screens", kind: "block", replace: last, inner: fn.body, parens: false, guards: guardsFor(checker, conds) });
          found.add("iife:" + base);
          return;
        }
      }
    }
    if (ts.isJsxElement(n) && hasId(n, "hd")) { out.push({ name: "AppHeader", dir: "layout", kind: "jsx", replace: n, inner: n, parens: false, guards: [] }); found.add("hd"); return; }
    if (tagIs(n, "nav")) { out.push({ name: "BottomNav", dir: "layout", kind: "jsx", replace: n, inner: n, parens: false, guards: [] }); found.add("nav"); return; }
    ts.forEachChild(n, walk);
  })(root);
  for (const k of ["banner", "hd", "nav"]) if (!found.has(k)) die(`MainApp me "${k}" wala block nahi mila.`);
  if (!found.has("iife:txn") || !found.has("iife:stk")) die("MainApp me txn/stk IIFE screens nahi mile.");
  return out;
}

// ---------- generic file processor ----------
const registry = new Map(); // name -> { rel, kind, parens, skip }

function processFile(rel, compName, findTargets) {
  const { checker, sf } = loadProgram(rel);
  const text = sf.text;
  const comp = sf.statements.find((s) => ts.isFunctionDeclaration(s) && s.name && s.name.text === compName);
  if (!comp || !comp.body) die(`${rel}: ${compName} function nahi mila.`);
  const stmts = comp.body.statements;

  // pehla statement: const {...} = app / useEk();  ya sirf useEk();
  let destr = null, initText = null;
  const first = stmts[0];
  if (ts.isVariableStatement(first) && first.declarationList.declarations[0].name && ts.isObjectBindingPattern(first.declarationList.declarations[0].name)) {
    destr = first; initText = first.declarationList.declarations[0].initializer.getText();
  } else die(`${rel}: component ke shuru me \`const {...} = ...\` nahi mila.`);

  const syms = new Map(); const order = [];
  for (const el of first.declarationList.declarations[0].name.elements) {
    const sym = checker.getSymbolAtLocation(el.name);
    if (sym) { syms.set(sym, el.name.text); order.push(el.name.text); }
  }
  const used = (node, skip) => {
    const u = new Set();
    (function visit(n) {
      if (skip && skip.has(n)) return;
      if (ts.isIdentifier(n)) {
        const sym = ts.isShorthandPropertyAssignment(n.parent) && n.parent.name === n ? checker.getShorthandAssignmentValueSymbol(n.parent) : checker.getSymbolAtLocation(n);
        if (sym && syms.has(sym)) u.add(syms.get(sym));
      }
      ts.forEachChild(n, visit);
    })(node);
    return order.filter((x) => u.has(x));
  };

  const ret = stmts[stmts.length - 1];
  if (!ts.isReturnStatement(ret) || !ret.expression) die(`${rel}: aakhri statement return nahi hai.`);
  const root = unparen(ret.expression);

  // original imports = pool
  const pool = [];
  for (const s of sf.statements) {
    if (!ts.isImportDeclaration(s) || !s.importClause) continue;
    const ic = s.importClause;
    pool.push({
      mod: s.moduleSpecifier.text, def: ic.name ? ic.name.text : null,
      named: ic.namedBindings && ts.isNamedImports(ic.namedBindings) ? ic.namedBindings.elements.map((e) => ({ name: e.name.text, type: e.isTypeOnly || ic.isTypeOnly, orig: e.propertyName ? e.propertyName.text : null })) : [],
    });
  }
  const importsFor = (body, extra) => {
    const all = [...pool, ...(extra || [])];
    const uses = (n) => new RegExp("(^|[^A-Za-z0-9_$.])" + n.replace(/\$/g, "\\$") + "([^A-Za-z0-9_$]|$)").test(body);
    const seen = new Set(); const lines = [];
    for (const im of all) {
      const def = im.def && uses(im.def) && !seen.has(im.mod + "|d|" + im.def) ? im.def : null;
      const named = im.named.filter((n) => uses(n.name) && !seen.has(im.mod + "|" + n.name));
      if (!def && !named.length) continue;
      if (def) seen.add(im.mod + "|d|" + def);
      named.forEach((n) => seen.add(im.mod + "|" + n.name));
      const parts = [];
      if (def) parts.push(def);
      if (named.length) parts.push("{ " + named.map((n) => (n.type ? "type " : "") + (n.orig ? n.orig + " as " : "") + n.name).join(", ") + " }");
      lines.push(`import ${parts.join(", ")} from "${im.mod}";`);
    }
    return lines.join("\n");
  };

  // template-literal ranges (reindent me inhe nahi chhedna)
  const templateRanges = [];
  (function collect(n) {
    if ((ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) && /\n/.test(text.slice(n.getStart(), n.end))) templateRanges.push([n.getStart(), n.end]);
    ts.forEachChild(n, collect);
  })(sf);
  const inTemplate = (pos) => templateRanges.some(([a, b]) => pos > a && pos < b);
  /** text[a,b) ki lines ko `delta` columns shift karo (firstToo = pehli line bhi). */
  function shifted(a, b, delta, firstToo) {
    const chunk = text.slice(a, b); let pos = a;
    return chunk.split("\n").map((l, i) => {
      const p = pos; pos += l.length + 1;
      if ((i === 0 && !firstToo) || !l.trim() || inTemplate(p) && i > 0 || delta === 0) return l;
      if (delta > 0) return " ".repeat(delta) + l;
      return l.slice(Math.min(l.match(/^ */)[0].length, -delta));
    }).join("\n");
  }
  const colOf = (pos) => sf.getLineAndCharacterOfPosition(pos).character;

  const targets = findTargets(root, checker);
  const seenNames = new Set();
  for (const t of targets) { if (seenNames.has(t.name) || registry.has(t.name)) die("Naam clash: " + t.name); seenNames.add(t.name); }

  // --- child files ---
  for (const t of targets) {
    let usedNames, bodyText;
    if (t.kind === "jsx") {
      usedNames = used(t.inner);
      bodyText = shifted(t.inner.getStart(), t.inner.end, 4 - colOf(t.inner.getStart()), false);
    } else {
      usedNames = used(t.inner);
      const open = t.inner.getStart() + 1;
      const nl = text.indexOf("\n", open);
      const a = nl + 1, b = t.inner.end - 1;
      const lines = text.slice(a, b).split("\n").filter((l) => l.trim());
      const minIndent = Math.min(...lines.map((l) => l.match(/^ */)[0].length));
      bodyText = shifted(a, b, 2 - minIndent, true).replace(/\s+$/, "");
    }
    for (const g of t.guards) if (!usedNames.includes(g.name)) usedNames.push(g.name);
    usedNames = order.filter((x) => usedNames.includes(x));
    const needUseEk = usedNames.length > 0;
    const hookLine = needUseEk ? `  const {\n    ${usedNames.join(",\n    ")},\n  } = useEk();\n` : "";
    const guardLines = t.guards.length ? t.guards.map((g) => "  " + g.code).join("\n") + "\n" : "";
    const useEkImport = needUseEk ? [{ mod: "@/context/EkContext", def: null, named: [{ name: "useEk", type: false, orig: null }] }] : [];
    const imp = [importsFor(bodyText, []), needUseEk ? 'import { useEk } from "@/context/EkContext";' : ""].filter(Boolean).join("\n");
    const header = `"use client";\n\n${imp ? imp + "\n" : ""}`;
    let src;
    if (t.kind === "jsx") {
      src = `${header}\nexport function ${t.name}() {\n${hookLine}${guardLines ? guardLines : ""}${hookLine || guardLines ? "\n" : ""}  return (\n    ${bodyText}\n  );\n}\n`;
    } else {
      src = `${header}\nexport function ${t.name}() {\n${hookLine}${guardLines}${hookLine || guardLines ? "\n" : ""}${bodyText}\n}\n`;
    }
    const relChild = `src/components/${t.dir}/${t.name}.tsx`;
    write(relChild, src, true);
    registry.set(t.name, { rel: relChild, kind: t.kind, parens: t.parens, skip: (needUseEk ? 1 : 0) + t.guards.length });
    t.rel = relChild;
  }

  // --- rewrite parent ---
  const skipNodes = new Set(targets.map((t) => t.replace));
  const usedNow = used(root, skipNodes);
  const edits = targets.map((t) => ({ a: t.replace.getStart(), b: t.replace.end, text: `<${t.name} />` }));
  const firstImport = sf.statements.find(ts.isImportDeclaration);
  const lastImport = [...sf.statements].reverse().find(ts.isImportDeclaration);
  edits.push({ a: first.getStart(), b: first.end, text: usedNow.length ? `const {\n    ${usedNow.join(",\n    ")},\n  } = ${initText};` : "" });
  const childImports = targets.map((t) => ({ mod: `@/components/${t.dir}/${t.name}`, def: null, named: [{ name: t.name, type: false, orig: null }] }));
  // body text (imports ke bina) pe usage check karne ke liye pehle edits lagao
  let out = text;
  for (const e of [...edits].sort((x, y) => y.a - x.a)) out = out.slice(0, e.a) + e.text + out.slice(e.b);
  const importsEnd = lastImport.end + (text.length - out.length) * 0; // positions upar wale edits se pehle hain
  const importRegionStart = firstImport.getStart();
  // imports region ko edits ke baad dobara nikalo: edits sab imports ke baad hain, to region wahi rehta hai
  const bodyAfter = out.slice(lastImport.end);
  const newImports = importsFor(bodyAfter, childImports);
  out = out.slice(0, importRegionStart) + newImports + out.slice(lastImport.end);
  out = out.replace(/\n{3,}/g, "\n\n");
  write(rel, out, false);
  return targets;
}

// ---------- run ----------
const origViewText = fs.readFileSync(abs(VIEW), "utf8");
function rootJsxText(source) {
  const s = ts.createSourceFile("x.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const c = s.statements.find((x) => ts.isFunctionDeclaration(x) && x.name && x.name.text === "EkAppView");
  const r = c.body.statements[c.body.statements.length - 1];
  const j = unparen(r.expression);
  return source.slice(j.getStart(), j.end);
}
const origRoot = rootJsxText(origViewText);

const l1 = processFile(VIEW, "EkAppView", findViewTargets);
const l2 = processFile("src/components/views/MainApp.tsx", "MainApp", findMainTargets);

// screens/index.ts barrel
const barrelRel = "src/components/screens/index.ts";
if (fs.existsSync(abs(barrelRel))) {
  const b = fs.readFileSync(abs(barrelRel), "utf8").replace(/\s+$/, "");
  const add = l2.filter((t) => t.dir === "screens").map((t) => `export { ${t.name} } from "./${t.name}";`).filter((l) => !b.includes(l));
  if (add.length) write(barrelRel, b + "\n" + add.join("\n") + "\n", false);
}

// ---------- verify identical ----------
function expand(txt, depth) {
  if (depth > 6) die("expand: zyada deep nesting");
  return txt.replace(/<([A-Z][A-Za-z0-9]*) \/>/g, (m, name) => {
    const r = registry.get(name);
    if (!r) return m;
    const src = fs.readFileSync(abs(r.rel), "utf8");
    const s = ts.createSourceFile(r.rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const fn = s.statements.find((x) => ts.isFunctionDeclaration(x) && x.name && x.name.text === name);
    let body;
    if (r.kind === "jsx") {
      const rs = fn.body.statements[fn.body.statements.length - 1];
      const e = unparen(rs.expression);
      body = src.slice(e.getStart(), e.end);
      if (r.parens) body = "(" + body + ")";
    } else {
      const st = fn.body.statements[r.skip];
      body = "(() => {" + src.slice(st.getFullStart(), fn.body.end - 1) + "})()";
    }
    return expand(body, depth + 1);
  });
}
const newRoot = expand(rootJsxText(fs.readFileSync(abs(VIEW), "utf8")), 0);
const identical = strip(newRoot) === strip(origRoot);
process.stdout.write("==> Identical-code check (naya JSX == purana JSX)... ");
if (!identical) {
  const A = strip(newRoot), B = strip(origRoot); let i = 0; while (A[i] === B[i]) i++;
  rollback();
  console.log("FAIL");
  die("Moved code purane code se alag nikla, isliye rollback kar diya.\n   naya : " + A.slice(Math.max(0, i - 50), i + 70) + "\n   purana: " + B.slice(Math.max(0, i - 50), i + 70));
}
console.log("ok");

// ---------- tsc ----------
if (!NO_CHECK) {
  process.stdout.write("==> Split ke baad tsc chal raha hai... ");
  const r = runTsc();
  if (r.status !== 0) {
    rollback();
    console.log("FAIL");
    console.error("\n" + (r.stdout || r.stderr).split("\n").slice(0, 40).join("\n"));
    die("Type errors aaye, isliye sab kuch wapas (rollback) kar diya. Tumhari files jaisi thi waisi hain.\n   Upar ka error paste karo, main script theek kar dunga.");
  }
  console.log("ok");
}

const lines = (rel) => fs.readFileSync(abs(rel), "utf8").split("\n").length - 1;
console.log(`\n✅ Done. EkAppView.tsx: ${lines(VIEW)} lines, views/MainApp.tsx: ${lines("src/components/views/MainApp.tsx")} lines`);
for (const t of [...l1, ...l2]) console.log(`   ${t.rel.replace("src/components/", "").padEnd(34)} ${String(lines(t.rel)).padStart(4)} lines`);
console.log("\nAb: npm run build, app chalake dekho, phir:\n   git add src && git commit -m \"Refactor: split EkAppView into views, modals, layout\"");
