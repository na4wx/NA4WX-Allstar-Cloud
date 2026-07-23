import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// piperTts generates speech from typed text using Piper -- a free,
// fully offline neural text-to-speech engine -- run on this process
// rather than on the node itself. Mirrors HamVoipConfigGui's own
// internal/tts package almost exactly (same binary, same invocation
// shape, same voice-directory convention); it exists as a separate
// implementation here only because the node's own hardware (a
// Raspberry Pi, sometimes a Pi Zero/1) can struggle to run Piper at
// all, while this process has real CPU/RAM to spare. Generated audio
// is relayed to a device via the existing sounds.upload action, not
// anything new -- see routes/tts.routes.ts and routes/sounds.routes.ts.

export interface Voice {
  // name is how the voice is identified in the UI and submitted back
  // in a request: the bare model name, no directory or extension
  // (e.g. "en_US-lessac-medium").
  name: string;
  // modelPath is the full path to the voice's .onnx file, passed to
  // --model. Never taken directly from client input -- always
  // resolved by looking a submitted name up via findVoice, so a
  // request can't point Piper at an arbitrary path.
  modelPath: string;
}

const synthesizeTimeoutMs = 30_000;

// listVoices returns every Piper voice model found in dir, sorted by
// name. A missing or unset directory (no voices downloaded yet, or
// PIPER_VOICES_DIR left unconfigured) is not an error -- it just means
// there's nothing to offer yet, matching the Go side's own ListVoices.
export async function listVoices(dir: string): Promise<Voice[]> {
  if (!dir) {
    return [];
  }
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }
  const voices = entries
    .filter((e) => e.isFile() && e.name.endsWith(".onnx"))
    .map((e) => ({ name: e.name.slice(0, -".onnx".length), modelPath: path.join(dir, e.name) }));
  voices.sort((a, b) => a.name.localeCompare(b.name));
  return voices;
}

// findVoice looks up name (as returned by listVoices) in dir, returning
// undefined if there's no such voice -- the only safe way a submitted
// voice name should ever be turned into a model path.
export async function findVoice(dir: string, name: string): Promise<Voice | undefined> {
  const voices = await listVoices(dir);
  return voices.find((v) => v.name === name);
}

// synthesize renders text using the voice model at modelPath, via
// `<bin> --model <modelPath> --output_file <tmpfile>` with text piped
// to stdin (Piper's own documented CLI form, identical to the Go
// side's Synthesize) -- array-form spawn, never a shell, so text can
// never be interpreted as a shell command regardless of its contents.
// Piper's own exit code and combined output are the source of truth
// for whether synthesis actually worked. An explicit timeout kills a
// hung process (Node's spawn has no built-in one, unlike Go's
// exec.CommandContext).
export async function synthesize(bin: string, modelPath: string, text: string, timeoutMs = synthesizeTimeoutMs): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "piper-"));
  const outPath = path.join(dir, "out.wav");
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(bin, ["--model", modelPath, "--output_file", outPath], {
        signal: AbortSignal.timeout(timeoutMs),
      });
      let output = "";
      let settled = false;
      child.stdout.on("data", (d: Buffer) => (output += d.toString()));
      child.stderr.on("data", (d: Buffer) => (output += d.toString()));
      child.on("error", (err) => {
        if (settled) return;
        settled = true;
        reject(new Error(`${bin}: ${err.message}: ${output}`));
      });
      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`${bin}: exited ${code}: ${output}`));
        }
      });
      child.stdin.end(text);
    });
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
