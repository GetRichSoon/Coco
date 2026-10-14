// Coco's memory: one JSON file (memory/brain.json), saved atomically, with a daily backup.
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.env.COCO_BRAIN || join(ROOT, 'memory', 'brain.json');

export function loadBrain() {
  try { return JSON.parse(readFileSync(FILE, 'utf8')); } catch { return {}; }
}

export function saveBrain(brain) {
  mkdirSync(dirname(FILE), { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const backup = join(dirname(FILE), 'Daily Copies', `brain ${day}.json`);
  if (existsSync(FILE) && !existsSync(backup)) { mkdirSync(dirname(backup), { recursive: true }); copyFileSync(FILE, backup); }
  brain.savedAt = new Date().toISOString();
  writeFileSync(FILE + '.tmp', JSON.stringify(brain, null, 2));
  renameSync(FILE + '.tmp', FILE);
  return brain;
}

export function update(fn) {
  const b = loadBrain();
  fn(b);
  return saveBrain(b);
}
