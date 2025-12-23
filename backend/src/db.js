import fs from "fs";
import path from "path";

// ✅ Carpeta persistente (la pones según tu hosting con la variable DATA_DIR)
// Ejemplos:
// - Render: DATA_DIR=/var/data
// - Fly.io: DATA_DIR=/data
// - VPS/Docker: DATA_DIR=/data
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

function ensureDB() {
  // Crea la carpeta si no existe
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Crea el archivo db.json si no existe
  if (!fs.existsSync(DB_PATH)) {
    const initialDB = {
      players: [],
      nextId: 1,
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialDB, null, 2), "utf-8");
  }
}

export function readDB() {
  ensureDB();
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

export function writeDB(data) {
  ensureDB();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export function getNextId(db) {
  const id = db.nextId;
  db.nextId += 1;
  return id;
}
