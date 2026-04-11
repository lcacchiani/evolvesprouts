import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

export function hashFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    return "missing";
  }
  const data = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function hashValue(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hashDirectory(dirPath: string): string {
  if (!fs.existsSync(dirPath)) {
    return "missing";
  }
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(hashDirectory(fullPath));
    } else {
      files.push(hashFile(fullPath));
    }
  }

  return crypto.createHash("sha256").update(files.sort().join("")).digest("hex");
}
