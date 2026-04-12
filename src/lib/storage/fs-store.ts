import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.env.STORAGE_ROOT
  ? path.resolve(process.env.STORAGE_ROOT)
  : path.join(process.cwd(), ".data");

async function ensureDir(dirPath: string) {
  await mkdir(dirPath, { recursive: true });
}

export function getStorageRoot() {
  return root;
}

export async function writeJson<T>(relativePath: string, value: T) {
  const absolutePath = path.join(root, relativePath);
  await ensureDir(path.dirname(absolutePath));
  await writeFile(absolutePath, JSON.stringify(value, null, 2), "utf8");
}

export async function readJson<T>(relativePath: string) {
  const absolutePath = path.join(root, relativePath);
  const raw = await readFile(absolutePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function writeBuffer(relativePath: string, value: Buffer) {
  const absolutePath = path.join(root, relativePath);
  await ensureDir(path.dirname(absolutePath));
  await writeFile(absolutePath, value);
  return absolutePath;
}

export async function listRelativeFiles(relativeDir: string) {
  const absoluteDir = path.join(root, relativeDir);

  try {
    const entries = await readdir(absoluteDir);
    const files = await Promise.all(
      entries.map(async (entry) => {
        const relativePath = path.join(relativeDir, entry);
        const absolutePath = path.join(root, relativePath);
        const fileStats = await stat(absolutePath);
        return fileStats.isFile() ? relativePath : null;
      }),
    );

    return files.filter(Boolean) as string[];
  } catch {
    return [];
  }
}
