import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "src", "db.json");

function ensureDB() {
  if (!fs.existsSync(DB_PATH)) {
    const initialDB = {
      players: [],
      nextId: 1
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
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export function getNextId(db) {
  const id = db.nextId;
  db.nextId += 1;
  return id;
}
