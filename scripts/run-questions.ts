/**
 * Run the File 05 question suites (tests/questions/*.json) against a live
 * chat route and check expectations. See tests/questions/README.md.
 *
 * Run with a server up:  npm run questions [-- --base http://127.0.0.1:3000] [-- --suite normal|adversarial|all]
 * Exit code is non-zero if any expectation fails.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export interface QuestionExpect {
  state?: "supported" | "advisory" | "unsupported";
  must_include?: string[];
  must_not_include?: string[];
  tools?: string[];
  tools_not?: string[];
}

export interface Question {
  id: string;
  turns: string[];
  expect?: QuestionExpect;
}

export interface QuestionFile {
  suite: string;
  questions: Question[];
}

export interface TurnResult {
  status: number;
  text: string;
  tools: Array<{ id: string; name: string; args: unknown; result?: unknown }>;
  errors: string[];
  answerState: string | null;
}

export interface QuestionResult {
  suite: string;
  id: string;
  turns: Array<{ question: string; reply: TurnResult }>;
  failures: string[];
}

/** POST one turn to /api/chat and parse the data-stream protocol. */
export async function sendTurn(
  base: string,
  conversationId: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<TurnResult> {
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ conversationId, messages }),
  });
  if (!res.ok) return { status: res.status, text: await res.text(), tools: [], errors: [], answerState: null };

  const raw = await res.text();
  const out: TurnResult = { status: res.status, text: "", tools: [], errors: [], answerState: null };
  for (const line of raw.split("\n")) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const code = line.slice(0, i);
    const payload = line.slice(i + 1);
    try {
      if (code === "0") out.text += JSON.parse(payload) as string;
      else if (code === "9") {
        const c = JSON.parse(payload) as { toolCallId: string; toolName: string; args: unknown };
        out.tools.push({ id: c.toolCallId, name: c.toolName, args: c.args });
      } else if (code === "a") {
        const r = JSON.parse(payload) as { toolCallId: string; result: unknown };
        const t = out.tools.find((x) => x.id === r.toolCallId);
        if (t) t.result = r.result;
      } else if (code === "8") {
        for (const ann of JSON.parse(payload) as Array<Record<string, unknown>>) {
          if (typeof ann?.answerState === "string") out.answerState = ann.answerState;
        }
      } else if (code === "3") out.errors.push(String(JSON.parse(payload)));
    } catch {
      /* ignore non-JSON lines */
    }
  }
  return out;
}

function check(q: Question, last: TurnResult): string[] {
  const failures: string[] = [];
  const e = q.expect ?? {};
  const reply = last.text.toLowerCase();
  const called = last.tools.map((t) => t.name);
  if (last.status !== 200) failures.push(`HTTP ${last.status}`);
  if (last.errors.length) failures.push(`stream error: ${last.errors.join("; ")}`);
  if (e.state && last.answerState !== e.state) failures.push(`state: expected ${e.state}, got ${last.answerState ?? "none"}`);
  for (const s of e.must_include ?? []) if (!reply.includes(s.toLowerCase())) failures.push(`missing text: "${s}"`);
  for (const s of e.must_not_include ?? []) if (reply.includes(s.toLowerCase())) failures.push(`forbidden text present: "${s}"`);
  for (const t of e.tools ?? []) if (!called.includes(t)) failures.push(`tool not called: ${t}`);
  for (const t of e.tools_not ?? []) if (called.includes(t)) failures.push(`tool must not be called: ${t}`);
  return failures;
}

export interface RunOptions {
  base: string;
  /** Suite files to run. Defaults to every *.json in tests/questions. */
  files?: string[];
  quiet?: boolean;
}

export async function runQuestions(opts: RunOptions): Promise<{ passed: number; failed: number; results: QuestionResult[] }> {
  const dir = path.join(process.cwd(), "tests", "questions");
  const files =
    opts.files ??
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => path.join(dir, f))
      .sort();
  const log = (s: string) => {
    if (!opts.quiet) console.log(s);
  };

  const results: QuestionResult[] = [];
  for (const file of files) {
    const suite = JSON.parse(fs.readFileSync(file, "utf8")) as QuestionFile;
    log(`\n########## suite: ${suite.suite} (${path.basename(file)})`);
    for (const q of suite.questions) {
      const conversationId = crypto.randomUUID();
      const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
      const turns: QuestionResult["turns"] = [];
      log(`\n=============== ${q.id}`);
      let last: TurnResult | null = null;
      for (const turn of q.turns) {
        messages.push({ role: "user", content: turn });
        log(`> ${turn}`);
        const r = await sendTurn(opts.base, conversationId, messages);
        turns.push({ question: turn, reply: r });
        last = r;
        for (const t of r.tools) {
          log(`  [tool] ${t.name}(${JSON.stringify(t.args)})`);
          if (t.result !== undefined) log(`         -> ${JSON.stringify(t.result).slice(0, 240)}`);
        }
        for (const err of r.errors) log(`  [stream error] ${err}`);
        log(`< ${r.text.trim()}`);
        log(`  [answer_state] ${r.answerState ?? "none"}`);
        if (r.status !== 200) break;
        messages.push({ role: "assistant", content: r.text });
      }
      const failures = last ? check(q, last) : ["no turns"];
      log(failures.length ? `  FAIL: ${failures.join(" | ")}` : "  PASS");
      results.push({ suite: suite.suite, id: q.id, turns, failures });
    }
  }
  const failed = results.filter((r) => r.failures.length).length;
  const passed = results.length - failed;
  log(`\n########## ${passed} passed, ${failed} failed`);
  return { passed, failed, results };
}

function parseArgs(argv: string[]): RunOptions {
  let base = "http://127.0.0.1:3000";
  let suite = "all";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base") base = argv[++i] ?? base;
    else if (argv[i] === "--suite") suite = argv[++i] ?? suite;
  }
  const dir = path.join(process.cwd(), "tests", "questions");
  const files = suite === "all" ? undefined : [path.join(dir, `${suite}.json`)];
  return { base, files };
}

const isDirectRun = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false;
if (isDirectRun) {
  runQuestions(parseArgs(process.argv.slice(2)))
    .then(({ failed }) => {
      process.exitCode = failed ? 1 : 0;
    })
    .catch((err) => {
      console.error("[questions] failed:", err);
      process.exitCode = 1;
    });
}
