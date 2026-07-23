import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { findVoice, listVoices, synthesize } from "./piperTts.js";

// fakePiper writes a shell script standing in for the real piper
// binary, matching this project's own established fake-tool test
// pattern (see the Go repo's fakeSoxTool/fakePython3). Reads
// --output_file out of its own argv, since that's the one flag
// synthesize's own tests need to control.
async function fakePiper(behavior: "success" | "failure" | "hang"): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "fake-piper-"));
  const scriptPath = path.join(dir, "piper");
  let script = "#!/bin/sh\nout=\"\"\nwhile [ \"$#\" -gt 0 ]; do\n  case \"$1\" in\n    --output_file) out=\"$2\"; shift 2 ;;\n    *) shift ;;\n  esac\ndone\n";
  if (behavior === "success") {
    script += 'printf \'FAKEWAVBYTES\' > "$out"\nexit 0\n';
  } else if (behavior === "failure") {
    script += 'echo "synthesis failed: bad model" >&2\nexit 1\n';
  } else {
    script += "sleep 5\nexit 0\n";
  }
  await writeFile(scriptPath, script);
  await chmod(scriptPath, 0o755);
  return scriptPath;
}

async function voicesDir(names: string[]): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "piper-voices-"));
  for (const name of names) {
    await writeFile(path.join(dir, `${name}.onnx`), "");
    await writeFile(path.join(dir, `${name}.onnx.json`), "{}");
  }
  // A non-.onnx file must never show up as a voice.
  await writeFile(path.join(dir, "readme.txt"), "not a voice");
  return dir;
}

describe("listVoices", () => {
  it("returns every .onnx file, sorted by name, ignoring non-voice files", async () => {
    const dir = await voicesDir(["en_US-lessac-medium", "en_GB-alan-low"]);
    const voices = await listVoices(dir);
    expect(voices.map((v) => v.name)).toEqual(["en_GB-alan-low", "en_US-lessac-medium"]);
    expect(voices[0].modelPath).toBe(path.join(dir, "en_GB-alan-low.onnx"));
  });

  it("returns an empty array for a missing directory, not an error", async () => {
    await expect(listVoices("/no/such/directory")).resolves.toEqual([]);
  });

  it("returns an empty array for an unset (empty string) directory", async () => {
    await expect(listVoices("")).resolves.toEqual([]);
  });
});

describe("findVoice", () => {
  it("resolves a known name to its model path", async () => {
    const dir = await voicesDir(["en_US-lessac-medium"]);
    const voice = await findVoice(dir, "en_US-lessac-medium");
    expect(voice?.modelPath).toBe(path.join(dir, "en_US-lessac-medium.onnx"));
  });

  it("returns undefined for an unknown name -- never builds a path from it", async () => {
    const dir = await voicesDir(["en_US-lessac-medium"]);
    await expect(findVoice(dir, "../../etc/passwd")).resolves.toBeUndefined();
  });
});

describe("synthesize", () => {
  it("returns the tool's output bytes on success", async () => {
    const bin = await fakePiper("success");
    const wav = await synthesize(bin, "/unused/model.onnx", "hello world");
    expect(wav.toString()).toBe("FAKEWAVBYTES");
  });

  it("rejects with the tool's stderr on a non-zero exit", async () => {
    const bin = await fakePiper("failure");
    await expect(synthesize(bin, "/unused/model.onnx", "hello world")).rejects.toThrow(/synthesis failed: bad model/);
  });

  it("kills a hung process once the timeout elapses, rather than waiting for it", async () => {
    const bin = await fakePiper("hang");
    const start = Date.now();
    await expect(synthesize(bin, "/unused/model.onnx", "hello world", 200)).rejects.toThrow();
    expect(Date.now() - start).toBeLessThan(4_000); // well under the fake tool's own 5s sleep
  });
});

describe("path safety", () => {
  it("never resolves a directory-traversal-like voice name to a real file", async () => {
    const outsideDir = await mkdtemp(path.join(tmpdir(), "outside-"));
    await writeFile(path.join(outsideDir, "secret.onnx"), "");
    const dir = await mkdtemp(path.join(tmpdir(), "piper-voices-"));
    await mkdir(dir, { recursive: true });
    // Even if an attacker knows the exact relative path, findVoice only
    // ever matches against listVoices' own directory scan -- there is
    // no code path that builds a filesystem path by concatenating a
    // submitted name, so this must resolve to nothing.
    await expect(findVoice(dir, "../" + path.basename(outsideDir) + "/secret")).resolves.toBeUndefined();
  });
});
