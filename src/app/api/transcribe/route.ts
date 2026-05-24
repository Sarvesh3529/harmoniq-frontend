import fs from "node:fs";
import { spawn } from "node:child_process";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Next.js App Router Config: Stops Next.js from limiting large live-recording payloads
export const maxDuration = 300; 

const PROJECT_ROOT = process.cwd(); 
const ROOT_DIR = join(PROJECT_ROOT, ".."); 
const BACKEND_ROOT = join(PROJECT_ROOT, "..", "backend"); 

const PYTHON_PATH = resolveExistingPath(ROOT_DIR, "audio-env", "Scripts", "python.exe");
const SCRIPT_PATH = resolveExistingPath(BACKEND_ROOT, "scripts", "transcribe_to_musicxml.py");
const GENERATED_DIR = join(PROJECT_ROOT, "public", "generated");

// Added .webm to the allowed set since browser MediaRecorder records in webm formats natively
const ALLOWED_EXTENSIONS = new Set([".wav", ".mp3", ".ogg", ".flac", ".m4a", ".aac", ".mp4", ".webm"]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const upload = formData.get("file");

    if (!(upload instanceof File)) {
      return NextResponse.json(
        { error: "No file was uploaded. Use the form field named 'file'.", message: "No file was uploaded." },
        { status: 400 },
      );
    }

    const extension = getLowercaseExtension(upload.name);
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        {
          error: `Unsupported file type. Allowed extensions: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}`,
          message: "Unsupported file type.",
        },
        { status: 400 },
      );
    }

    await mkdir(GENERATED_DIR, { recursive: true });

    const uniquePrefix = `${Date.now()}-${randomId()}`;
    const tempInputPath = join(tmpdir(), `${uniquePrefix}${extension}`);
    const midiOutputPath = join(GENERATED_DIR, `${uniquePrefix}.mid`);
    const musicXmlOutputPath = join(GENERATED_DIR, `${uniquePrefix}.musicxml`);

    const arrayBuffer = await upload.arrayBuffer();
    await writeFile(tempInputPath, Buffer.from(arrayBuffer));

    try {
      // 1. Run the script 
      const pythonResult = await runPythonTranscription(tempInputPath, midiOutputPath, musicXmlOutputPath);

      // 2. Read the actual generated MusicXML file from the disk
      let musicXmlContent = "";
      if (fs.existsSync(musicXmlOutputPath)) {
        musicXmlContent = fs.readFileSync(musicXmlOutputPath, "utf8");
        console.log("Backend Success: MusicXML successfully read from disk!");
      } else {
        const fallbackMusicXml =
          typeof pythonResult.musicXml === "string" ? pythonResult.musicXml : "";
        if (fallbackMusicXml.trim()) {
          musicXmlContent = fallbackMusicXml;
          console.warn("Backend Warning: MusicXML file was missing, using Python payload content instead.");
        } else {
          throw new Error(`Python finished without creating MusicXML at ${musicXmlOutputPath}`);
        }
      }

      // 3. Package everything up cleanly for the frontend
      const payload = {
        midiUrl: `/generated/${uniquePrefix}.mid`,
        musicXml: musicXmlContent, 
        success: true
      };

      return NextResponse.json(payload);
    } finally {
      // Clean up temp file block from OS temp folder
      await unlink(tempInputPath).catch(() => undefined);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error during transcription.";
    console.error("Transcription route failed:", error);
      return NextResponse.json({ error: message, message }, { status: 500 });
  }
}

function runPythonTranscription(
  inputPath: string,
  midiPath: string,
  musicXmlPath: string,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    console.log("Starting Python transcription with script:", SCRIPT_PATH);
    const child = spawn(PYTHON_PATH, [SCRIPT_PATH, inputPath, midiPath, musicXmlPath], {
      cwd: PROJECT_ROOT,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Transcription timed out while running the backend pipeline."));
    }, 5 * 60 * 1000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      console.error("Failed to start Python transcription process:", error);
      reject(
        new Error(
          `Could not start Python transcription process. Check that audio-env is present. ${error.message}`,
        ),
      );
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      const finalOutput = stdout.trim();
      const parsed = tryParseJson(finalOutput);

      if (code === 0 && parsed) {
        if (stderr.trim()) {
          console.warn("Python transcription stderr:", stderr.trim());
        }
        resolve(parsed);
        return;
      }

      // If the Python script returned an error or crashed, bubble up the exact Python terminal error logs
      if (parsed?.error && typeof parsed.error === "string") {
        reject(new Error(parsed.error));
        return;
      }

      const detail = [stderr.trim(), finalOutput].filter(Boolean).join("\n");
      console.error("Python script terminal logs on crash:", detail);
      reject(new Error(detail || `Python transcription failed with exit code ${code}.`));
    });
  });
}

function getLowercaseExtension(filename: string): string {
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index).toLowerCase() : "";
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function tryParseJson(value: string): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  const candidates = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse();

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as Record<string, unknown>;
    } catch {
      continue;
    }
  }

  return null;
}

function resolveExistingPath(rootPath: string, ...relativeSegments: string[]): string {
  const candidate = join(rootPath, ...relativeSegments);
  if (!fs.existsSync(candidate)) {
    throw new Error(`Required backend path not found: ${candidate}`);
  }
  return fs.realpathSync.native(candidate);
}
