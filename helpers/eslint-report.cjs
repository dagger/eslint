// eslint-report reads one ESLint JSON report, shared by every selected file
// check of a project, and writes a bounded failure message (or an empty,
// passing result) for each selected file, plus a summary of them all.
//
// Usage: node eslint-report.cjs --report FILE --stderr FILE --selection FILE
//          --exit-code N --project PATH --root DIR --output DIR
//
// The selection is a JSON array of {key, path}: the file's workspace path, as
// its check knows it, and the absolute path ESLint reports for it. Result i is
// written to DIR/i, in selection order, so file names never enter paths.
"use strict";

const fs = require("fs");
const path = require("path");

const diagnosticLimit = 32 << 10;
const resultLimit = 3 * diagnosticLimit;

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith("--") || i + 1 >= argv.length) {
      throw new Error("usage: unexpected argument " + argv[i]);
    }
    out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

function read(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return "";
    throw err;
  }
}

// The end of a diagnostic stream, marked when cut.
function tail(text, limit) {
  if (text.length <= limit) return text;
  return "[earlier output omitted; showing diagnostic tail]\n" + text.slice(text.length - limit);
}

function bound(text) {
  if (text.length <= resultLimit) return text;
  return text.slice(0, resultLimit) + "\n[remaining diagnostics omitted]\n";
}

function plural(n, word) {
  return n + " " + word + (n === 1 ? "" : "s");
}

// One line per message, as ESLint's stylish formatter prints them.
function describe(name, result) {
  const errors = result.errorCount || 0;
  const warnings = result.warningCount || 0;
  const counts = [plural(errors, "error")];
  if (warnings > 0) counts.push(plural(warnings, "warning"));
  const lines = (result.messages || []).map((m) => {
    const where = (m.line || 0) + ":" + (m.column || 0);
    const severity = m.severity === 2 ? "error" : "warning";
    const rule = m.ruleId ? "  " + m.ruleId : "";
    return "  " + where + "  " + severity + "  " + String(m.message || "").trim() + rule;
  });
  return name + ": ESLint found " + counts.join(", ") + "\n" + tail(lines.join("\n"), diagnosticLimit);
}

// ESLint reports a file it was given but chose not to lint (an ignore pattern,
// or no config object matching it) as a lone warning, not as a lint result.
function ignoredReason(result) {
  const messages = result.messages || [];
  if ((result.errorCount || 0) > 0 || messages.length !== 1) return "";
  const m = messages[0];
  if (m.severity !== 1 || m.ruleId || !/^File ignored\b/.test(String(m.message || ""))) return "";
  return String(m.message);
}

function summarize(opts) {
  const selection = JSON.parse(read(opts.selection));
  const exitCode = Number(opts["exit-code"]);
  const project = opts.project;
  const root = opts.root.replace(/\/+$/, "");
  const stderr = read(opts.stderr);
  const reportText = read(opts.report);
  const display = (file) => (file.startsWith(root + "/") ? file.slice(root.length + 1) : file);

  const index = new Map();
  selection.forEach((s, i) => {
    if (!s.key || !s.path) throw new Error("invalid selected file " + JSON.stringify(s));
    if (index.has(s.path)) throw new Error("duplicate selected file " + s.path);
    index.set(s.path, i);
  });

  let report = null;
  try {
    report = JSON.parse(reportText);
  } catch (err) {
    report = null;
  }
  if (!Array.isArray(report)) report = null;

  let global = "";
  if (exitCode === 127 && report === null && stderr.trim() !== "") {
    // The runner explains itself when the project does not install ESLint.
    global = project + ": " + tail(stderr.trim(), diagnosticLimit);
  } else if ((exitCode !== 0 && exitCode !== 1) || report === null) {
    const output = (stderr + "\n" + (report === null ? reportText : "")).trim();
    const lines = output.split("\n").slice(-30).join("\n");
    global = project + ": eslint failed (exit " + exitCode + ")" + (lines === "" ? "" : ":\n" + tail(lines, diagnosticLimit));
  }

  const own = selection.map(() => ({ seen: false, failure: "", ignored: "" }));
  const outside = [];
  let anyError = false;
  for (const result of report || []) {
    const errors = result.errorCount || 0;
    anyError = anyError || errors > 0;
    const i = index.get(result.filePath);
    if (i === undefined) {
      if (errors > 0) outside.push(result);
      continue;
    }
    const entry = own[i];
    entry.seen = true;
    entry.ignored = ignoredReason(result);
    if (errors > 0) entry.failure = describe(selection[i].key, result);
  }

  if (global === "" && outside.length > 0) {
    // A whole-project run lints files discovery did not offer as checks. Their
    // errors fail every check sharing the command, so none passes over them.
    outside.sort((a, b) => (a.filePath < b.filePath ? -1 : a.filePath > b.filePath ? 1 : 0));
    const names = outside.map((r) => display(r.filePath));
    global =
      project + ": ESLint found errors in files without a check: " + names.join(", ") + "\n" +
      tail(outside.map((r) => describe(display(r.filePath), r)).join("\n"), diagnosticLimit);
  } else if (global === "" && exitCode === 1 && !anyError) {
    global = project + ": eslint failed (exit 1) without reporting an error in a file" +
      (stderr.trim() === "" ? "" : ":\n" + tail(stderr.trim(), diagnosticLimit));
  }

  const results = selection.map((s, i) => {
    const entry = own[i];
    let failure = entry.failure;
    if (failure === "" && global === "") {
      if (entry.ignored !== "") {
        failure = s.key + ": ESLint did not lint this file: " + entry.ignored;
      } else if (!entry.seen) {
        // Discovery offered the file, but ESLint linted the project without it:
        // its config or ignores leave it out. A check with nothing behind it
        // must not pass.
        failure = s.key + ": ESLint did not lint this file: it linted " + project + " without it";
      }
    }
    if (global !== "") failure = failure === "" ? global : failure + "\n" + global;
    return bound(failure);
  });

  let summary = global;
  if (summary === "") {
    summary = results.filter((r) => r !== "").join("\n");
  } else {
    const ownFailures = own.filter((e) => e.failure !== "").map((e) => e.failure);
    if (ownFailures.length > 0) summary = ownFailures.join("\n") + "\n" + global;
  }
  return { results, summary: bound(summary) };
}

function main() {
  const opts = args(process.argv.slice(2));
  for (const name of ["report", "stderr", "selection", "exit-code", "project", "root", "output"]) {
    if (opts[name] === undefined) throw new Error("missing --" + name);
  }
  const { results, summary } = summarize(opts);
  fs.mkdirSync(opts.output, { recursive: true });
  results.forEach((result, i) => fs.writeFileSync(path.join(opts.output, String(i)), result));
  fs.writeFileSync(path.join(opts.output, "summary"), summary);
}

try {
  main();
} catch (err) {
  process.stderr.write(String(err && err.stack ? err.stack : err) + "\n");
  process.exit(1);
}
