#!/usr/bin/env node
/**
 * split-page.cjs: src/app/page.tsx ko todta hai (state -> hook, screens -> components).
 *
 * Kaise chalana hai (project root me, jahan package.json hai):
 *   git checkout -b split-screens
 *   node split-page.cjs
 *
 * Safety:
 *  - Sirf usi page.tsx pe chalti hai jis pe test hui (sha256 check). Alag ho to ruk jaati hai.
 *  - Git working tree clean hona chahiye.
 *  - Pehle tsc chalati hai (baseline), phir changes, phir tsc dobara.
 *    Naya error aaya to apne aap sab wapas (rollback) kar deti hai.
 *  - Koi .bak file nahi banati. Backup = git.
 *
 * Flags: --force (hash check skip), --no-check (tsc skip)
 */
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const crypto = require("crypto");

const ROOT = process.cwd();
const PAGE = "src/app/page.tsx";
const EXPECTED_SHA = "4abf97eb682588f13d9929c57f04b9f77753a8911900618824c744c884b99d4b";
const FORCE = process.argv.includes("--force");
const NO_CHECK = process.argv.includes("--no-check");

const die = (m) => { console.error("\n❌ " + m + "\n"); process.exit(1); };
const abs = (p) => path.join(ROOT, p);

let ts;
try { ts = require(abs("node_modules/typescript")); } catch { die("node_modules/typescript nahi mila. Pehle `npm install` chalao, aur project root me ye script chalao."); }

// ---------- 0. Pre-checks ----------
if (!fs.existsSync(abs(PAGE))) die(`${PAGE} nahi mili. Project root me ho?`);
const original = fs.readFileSync(abs(PAGE), "utf8");
const sha = crypto.createHash("sha256").update(original).digest("hex");
if (sha !== EXPECTED_SHA && !FORCE) {
  die("Tumhari page.tsx us file se alag hai jis pe ye script test hui thi.\n" +
      "   Matlab beech me tumne kuch badla hai. Nayi page.tsx upload karke script dobara banwao.\n" +
      "   (Risk samajhte ho to: node split-page.cjs --force)");
}
const dirty = cp.spawnSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: ROOT, encoding: "utf8" });
if (dirty.status !== 0) die("git repo nahi mila. Ye script git ko backup maanke chalti hai.");
if (dirty.stdout.trim()) die("Git me uncommitted changes hain. Pehle commit ya stash karo:\n" + dirty.stdout);

const NEW_FILES = ["src/hooks/useEkApp.tsx", "src/context/EkContext.tsx", "src/components/EkAppView.tsx"];
for (const f of NEW_FILES) if (fs.existsSync(abs(f))) die(`${f} pehle se hai. Overwrite nahi karungi. Hata ke dobara chalao.`);
if (fs.existsSync(abs("src/components/screens"))) die("src/components/screens pehle se hai. Hata ke dobara chalao.");

function runTsc() {
  return cp.spawnSync(process.execPath, [abs("node_modules/typescript/bin/tsc"), "--noEmit", "-p", "."], { cwd: ROOT, encoding: "utf8" });
}
if (!NO_CHECK) {
  process.stdout.write("==> Baseline tsc chal raha hai... ");
  const b = runTsc();
  if (b.status !== 0) die("Split se PEHLE hi tsc errors hain. Pehle unhe theek karo:\n" + (b.stdout || b.stderr).slice(0, 2000));
  console.log("ok");
}

// ---------- 1. Parse with real type-checker ----------
const cfgPath = ts.findConfigFile(ROOT, ts.sys.fileExists, "tsconfig.json");
if (!cfgPath) die("tsconfig.json nahi mila.");
const cfg = ts.getParsedCommandLineOfConfigFile(cfgPath, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => die(ts.flattenDiagnosticMessageText(d.messageText, "\n")) });
const program = ts.createProgram(cfg.fileNames, cfg.options);
const checker = program.getTypeChecker();
const sf = program.getSourceFile(abs(PAGE));
if (!sf) die("page.tsx tsconfig ke include me nahi hai.");
const text = sf.text;

const comp = sf.statements.find((s) => ts.isFunctionDeclaration(s) && s.name && s.name.text === "EkAppFullStack");
if (!comp || !comp.body) die("EkAppFullStack function nahi mila.");
const stmts = comp.body.statements;
const ret = stmts[stmts.length - 1];
if (!ts.isReturnStatement(ret) || !ret.expression) die("Component ka aakhri statement `return (...)` nahi hai.");
if (stmts.slice(0, -1).some((s) => ts.isReturnStatement(s))) die("Beech me early return hai, ye script usse handle nahi karti.");
const rootJsx = ts.isParenthesizedExpression(ret.expression) ? ret.expression.expression : ret.expression;
if (!(ts.isJsxElement(rootJsx) || ts.isJsxFragment(rootJsx))) die("Return me JSX root nahi mila.");

// ---------- 2. Hook-level bindings (symbols) ----------
const hookStmts = stmts.slice(0, -1);
const bindingSyms = new Map(); // symbol -> name
const bindingOrder = [];
function addBindingName(nameNode) {
  if (ts.isIdentifier(nameNode)) {
    const sym = checker.getSymbolAtLocation(nameNode);
    if (sym && !bindingSyms.has(sym)) { bindingSyms.set(sym, nameNode.text); bindingOrder.push(nameNode.text); }
  } else if (ts.isArrayBindingPattern(nameNode) || ts.isObjectBindingPattern(nameNode)) {
    for (const el of nameNode.elements) if (ts.isBindingElement(el)) addBindingName(el.name);
  }
}
for (const s of hookStmts) {
  if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) addBindingName(d.name);
  else if (ts.isFunctionDeclaration(s) && s.name) addBindingName(s.name);
  else if (ts.isExpressionStatement(s) || ts.isIfStatement(s) || ts.isForStatement(s) || ts.isForOfStatement(s)) { /* no bindings */ }
  else die(`Component body me ye statement type handle nahi hota: ${ts.SyntaxKind[s.kind]} (line ${sf.getLineAndCharacterOfPosition(s.getStart()).line + 1})`);
}
if (new Set(bindingOrder).size !== bindingOrder.length) die("Duplicate binding naam mile.");

function usedNames(node, skip) {
  const used = new Set();
  (function visit(n) {
    if (skip && skip.has(n)) return;
    if (ts.isIdentifier(n)) {
      const sym = ts.isShorthandPropertyAssignment(n.parent) && n.parent.name === n
        ? checker.getShorthandAssignmentValueSymbol(n.parent)
        : checker.getSymbolAtLocation(n);
      if (sym && bindingSyms.has(sym)) used.add(bindingSyms.get(sym));
    }
    ts.forEachChild(n, visit);
  })(node);
  return bindingOrder.filter((x) => used.has(x));
}

// ---------- 3. Imports of original file ----------
const imports = [];
for (const s of sf.statements) {
  if (!ts.isImportDeclaration(s)) continue;
  const mod = s.moduleSpecifier.text;
  const ic = s.importClause;
  if (!ic) continue;
  imports.push({
    mod,
    def: ic.name ? ic.name.text : null,
    named: ic.namedBindings && ts.isNamedImports(ic.namedBindings)
      ? ic.namedBindings.elements.map((e) => ({ name: e.name.text, type: e.isTypeOnly || ic.isTypeOnly, orig: e.propertyName ? e.propertyName.text : null }))
      : [],
  });
}
function importsFor(bodyText) {
  const uses = (n) => new RegExp("(^|[^A-Za-z0-9_$.])" + n.replace(/\$/g, "\\$") + "([^A-Za-z0-9_$]|$)").test(bodyText);
  const lines = [];
  for (const im of imports) {
    const def = im.def && uses(im.def) ? im.def : null;
    const named = im.named.filter((n) => uses(n.name));
    if (!def && !named.length) continue;
    const parts = [];
    if (def) parts.push(def);
    if (named.length) parts.push("{ " + named.map((n) => (n.type ? "type " : "") + (n.orig ? n.orig + " as " : "") + n.name).join(", ") + " }");
    lines.push(`import ${parts.join(", ")} from "${im.mod}";`);
  }
  return lines.join("\n");
}

// ---------- 4. Find screen blocks: {baseView === "x" && ( <JSX/> )} ----------
function flattenAnd(e) {
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return [...flattenAnd(e.left), e.right];
  return [e];
}
function eqLiteral(op, ident) {
  if (ts.isBinaryExpression(op) && op.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
      ts.isIdentifier(op.left) && op.left.text === ident && ts.isStringLiteral(op.right)) return op.right.text;
  return null;
}
const pascal = (s) => s.split(/[^A-Za-z0-9]+/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join("");
const screens = [];
const skipped = [];
(function find(n) {
  if (ts.isJsxExpression(n) && n.expression && ts.isBinaryExpression(n.expression)) {
    const ops = flattenAnd(n.expression);
    const last = ops[ops.length - 1];
    const conds = ops.slice(0, -1);
    const base = conds.map((c) => eqLiteral(c, "baseView")).find((x) => x !== null);
    if (base !== undefined && base !== null) {
      const sub = conds.map((c) => eqLiteral(c, "subParam")).find((x) => x !== null) ?? null;
      const inner = ts.isParenthesizedExpression(last) ? last.expression : null;
      const key = sub ? `${base}_${sub}` : base;
      if (inner && (ts.isJsxElement(inner) || ts.isJsxFragment(inner) || ts.isJsxSelfClosingElement(inner))) {
        screens.push({ key, name: pascal(key) + "Screen", paren: last, inner, jsxExpr: n });
      } else {
        skipped.push({ key, line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1 });
      }
      return; // nested blocks andar se mat todo
    }
  }
  ts.forEachChild(n, find);
})(rootJsx);
const seenNames = new Set();
for (const s of screens) { if (seenNames.has(s.name)) die("Do screens ka naam same ban raha hai: " + s.name); seenNames.add(s.name); }
if (!screens.length) die("Koi screen block nahi mila.");

// ---------- 5. Text helpers ----------
const templateRanges = [];
(function collect(n) {
  if ((ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) && /\n/.test(text.slice(n.getStart(), n.end))) templateRanges.push([n.getStart(), n.end]);
  ts.forEachChild(n, collect);
})(sf);
const inTemplate = (pos) => templateRanges.some(([a, b]) => pos > a && pos < b);

/** node ka text, `targetCol` indentation pe shift karke (multi-line template strings ko chhue bina). */
function reindented(a, b, startCol, targetCol, edits) {
  let out = text.slice(a, b);
  if (edits && edits.length) {
    const sorted = [...edits].sort((x, y) => y.a - x.a);
    for (const e of sorted) out = out.slice(0, e.a - a) + e.text + out.slice(e.b - a);
  }
  const delta = targetCol - startCol;
  if (delta === 0) return out;
  // line starts ki original positions (edits ki wajah se offset badalte hain, isliye sirf edit-free case me template check)
  let pos = a;
  const origLines = text.slice(a, b).split("\n");
  const lineInTemplate = origLines.map((l, i) => { const p = pos; pos += l.length + 1; return i > 0 && inTemplate(p); });
  if (edits && edits.length) {
    // edits ke baad line mapping alag ho sakti hai; template-wale lines ko pehchanne ke liye safe fallback
    if (templateRanges.some(([x, y]) => x >= a && y <= b)) return out; // reindent skip: content safe rakho
  }
  return out.split("\n").map((l, i) => {
    if (i === 0 || lineInTemplate[i] || !l.trim()) return l;
    if (delta > 0) return " ".repeat(delta) + l;
    const m = l.match(/^ */)[0].length;
    return l.slice(Math.min(m, -delta));
  }).join("\n");
}
const colOf = (pos) => sf.getLineAndCharacterOfPosition(pos).character;
const written = [];
function write(rel, content) {
  fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
  fs.writeFileSync(abs(rel), content.endsWith("\n") ? content : content + "\n", "utf8");
  written.push(rel);
}

// ---------- 6. Generate files ----------
// 6a. Hook
const hookBody = text.slice(hookStmts[0].getFullStart(), ret.getFullStart()).replace(/^\n+/, "").replace(/\s+$/, "");
const hookImports = importsFor(hookBody + "\nreturn { " + bindingOrder.join(",") + " }");
write("src/hooks/useEkApp.tsx",
`"use client";

${hookImports}

/** Saari state + actions (page.tsx se jaisa tha waisa hi yahan move hua hai). */
export function useEkApp() {
${hookBody}

  return {
    ${bindingOrder.join(",\n    ")},
  };
}

export type EkApp = ReturnType<typeof useEkApp>;
`);

// 6b. Context
write("src/context/EkContext.tsx",
`"use client";

import React, { createContext, useContext } from "react";
import type { EkApp } from "@/hooks/useEkApp";

const EkCtx = createContext<EkApp | null>(null);

export function EkProvider({ app, children }: { app: EkApp; children: React.ReactNode }) {
  return <EkCtx.Provider value={app}>{children}</EkCtx.Provider>;
}

export function useEk(): EkApp {
  const v = useContext(EkCtx);
  if (!v) throw new Error("useEk must be used inside EkProvider");
  return v;
}
`);

// 6c. Screens
for (const sc of screens) {
  const body = reindented(sc.inner.getStart(), sc.inner.end, colOf(sc.inner.getStart()), 4);
  const used = usedNames(sc.inner);
  const imp = importsFor(body);
  const destruct = used.length ? `  const {\n    ${used.join(",\n    ")},\n  } = useEk();\n\n` : "  useEk();\n\n";
  write(`src/components/screens/${sc.name}.tsx`,
`"use client";

${imp ? imp + "\n" : ""}import { useEk } from "@/context/EkContext";

export function ${sc.name}() {
${destruct}  return (
    ${body}
  );
}
`);
  sc.used = used;
}
write("src/components/screens/index.ts", screens.map((s) => `export { ${s.name} } from "./${s.name}";`).join("\n") + "\n");

// 6d. View shell (original JSX, screens ki jagah <XScreen />)
const skipNodes = new Set(screens.map((s) => s.paren));
const edits = screens.map((s) => ({ a: s.paren.getStart(), b: s.paren.end, text: `<${s.name} />` }));
const shellBody = reindented(rootJsx.getStart(), rootJsx.end, colOf(rootJsx.getStart()), 6, edits);
const shellUsed = usedNames(rootJsx, skipNodes);
const shellImports = importsFor(shellBody);
write("src/components/EkAppView.tsx",
`"use client";

${shellImports ? shellImports + "\n" : ""}import type { EkApp } from "@/hooks/useEkApp";
import { EkProvider } from "@/context/EkContext";
${screens.map((s) => `import { ${s.name} } from "@/components/screens/${s.name}";`).join("\n")}

export function EkAppView({ app }: { app: EkApp }) {
  const {
    ${shellUsed.join(",\n    ")},
  } = app;

  return (
    <EkProvider app={app}>
      ${shellBody}
    </EkProvider>
  );
}
`);

// 6e. Thin page.tsx
write(PAGE,
`"use client";

import { useEkApp } from "@/hooks/useEkApp";
import { EkAppView } from "@/components/EkAppView";

export default function EkAppFullStack() {
  const app = useEkApp();
  return <EkAppView app={app} />;
}
`);

// ---------- 7. Verify, rollback on failure ----------
function rollback() {
  fs.writeFileSync(abs(PAGE), original, "utf8");
  for (const f of written) if (f !== PAGE) fs.rmSync(abs(f), { force: true });
  for (const d of ["src/components/screens", "src/hooks", "src/context"]) {
    try { if (fs.existsSync(abs(d)) && fs.readdirSync(abs(d)).length === 0) fs.rmdirSync(abs(d)); } catch {}
  }
}
if (!NO_CHECK) {
  process.stdout.write("==> Split ke baad tsc chal raha hai... ");
  const r = runTsc();
  if (r.status !== 0) {
    rollback();
    console.log("FAIL");
    console.error("\n" + (r.stdout || r.stderr).split("\n").slice(0, 40).join("\n"));
    die("Split ke baad type errors aaye, isliye sab kuch wapas (rollback) kar diya. Tumhari files jaisi thi waisi hain.\n   Upar ka error paste karo, main script theek kar dunga.");
  }
  console.log("ok");
}

const lines = (rel) => fs.readFileSync(abs(rel), "utf8").split("\n").length - 1;
console.log("\n✅ Done. page.tsx:", lines(PAGE), "lines");
console.log("   hooks/useEkApp.tsx:", lines("src/hooks/useEkApp.tsx"), "lines |", "components/EkAppView.tsx:", lines("src/components/EkAppView.tsx"), "lines");
console.log(`   ${screens.length} screens -> src/components/screens/`);
for (const s of screens) console.log(`     ${s.name.padEnd(28)} ${String(lines("src/components/screens/" + s.name + ".tsx")).padStart(4)} lines, ${s.used.length} cheezein use karti hai`);
if (skipped.length) console.log("   Inline chhod diye (IIFE wale): " + skipped.map((s) => `${s.key} (line ${s.line})`).join(", "));
console.log("\nAb: npm run build, app chalake dekho, phir:\n   git add src && git commit -m \"Refactor: split page.tsx into hook + screens\"");
