// backend/src/index.js  (ESM porque package.json tiene "type":"module")
import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import { readDB, writeDB } from "./db.js";

const app = express();
const PORT = process.env.PORT || 3000;

// --- __dirname en ESM ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- FRONTEND: ../../frontend desde backend/src ---
const frontendPath = path.resolve(__dirname, "..", "..", "frontend");

// ====== MIDDLEWARE ======
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      // secure: true, // en producción con HTTPS
      maxAge: 1000 * 60 * 60 * 6, // 6 horas
    },
  })
);

// ====== "DB" EN MEMORIA (PERSISTIDA EN db.json EN DATA_DIR) ======
const USERS = [
  { username: "admin", password: "javi", role: "Admin" },
  { username: "player", password: "paquete", role: "Player" },
];

// -- Carga/Inicializa DB --
const DEFAULT_PLAYERS = [
  {
    id: 1,
    name: "Juan",
    createdAt: "2025-12-01",
    pj: 10,
    pg: 7,
    pp: 3,
    plenos: 2,
    points: 21,
  },
  {
    id: 2,
    name: "Pedro",
    createdAt: "2025-12-01",
    pj: 8,
    pg: 4,
    pp: 4,
    plenos: 1,
    points: 12,
  },
  {
    id: 3,
    name: "Luis",
    createdAt: "2025-12-01",
    pj: 11,
    pg: 8,
    pp: 3,
    plenos: 3,
    points: 24,
  },
];

function nextIdFromPlayers(players) {
  const maxId = players.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0);
  return maxId + 1;
}

function ensureDBSeed() {
  // ✅ db.js ya crea el archivo si no existe
  // Aquí SOLO metemos DEFAULT_PLAYERS la primera vez (si está vacío)
  const db = readDB();
  const players = Array.isArray(db.players) ? db.players : [];

  if (players.length === 0) {
    writeDB({
      players: DEFAULT_PLAYERS,
      nextId: nextIdFromPlayers(DEFAULT_PLAYERS),
    });
  } else {
    // Si existe pero le falta nextId (por versiones anteriores), lo reparamos:
    if (!db.nextId || typeof db.nextId !== "number") {
      db.nextId = nextIdFromPlayers(players);
      writeDB(db);
    }
  }
}

ensureDBSeed();

function loadPlayers() {
  const db = readDB();
  return Array.isArray(db.players) ? db.players : [];
}

// ✅ FIX: NO machacamos la estructura del JSON (nextId etc.)
function savePlayers(players) {
  const db = readDB();
  db.players = players;
  if (!db.nextId || typeof db.nextId !== "number") {
    db.nextId = nextIdFromPlayers(players);
  }
  writeDB(db);
}

function todayISO() {
  // YYYY-MM-DD
  return new Date().toISOString().slice(0, 10);
}

// ====== HELPERS AUTH ======
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ ok: false, error: "No autenticado" });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ ok: false, error: "No autenticado" });
  }
  if (req.session.user.role !== "Admin") {
    return res.status(403).json({ ok: false, error: "Solo Admin" });
  }
  next();
}

// ====== SERVIR FRONTEND ======
app.use(express.static(frontendPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "login.html"));
});

// (Opcional) proteger páginas si entras directo:
app.get("/ranking.html", (req, res) => {
  if (!req.session.user) return res.redirect("/login.html");
  res.sendFile(path.join(frontendPath, "ranking.html"));
});
app.get("/player.html", (req, res) => {
  if (!req.session.user) return res.redirect("/login.html");
  res.sendFile(path.join(frontendPath, "player.html"));
});
app.get("/update.html", (req, res) => {
  if (!req.session.user) return res.redirect("/login.html");
  if (req.session.user.role !== "Admin") return res.redirect("/ranking.html");
  res.sendFile(path.join(frontendPath, "update.html"));
});

// ====== API ======

// Login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  const user = USERS.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res
      .status(401)
      .json({ ok: false, error: "Credenciales incorrectas" });
  }

  req.session.user = { username: user.username, role: user.role };
  return res.json({ ok: true, role: user.role, username: user.username });
});

// Me
app.get("/api/me", (req, res) => {
  return res.json({ ok: true, user: req.session.user || null });
});

// Logout
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Ranking (protegido)
app.get("/api/ranking", requireAuth, (req, res) => {
  const PLAYERS = loadPlayers();
  const ranking = PLAYERS
    .map(({ id, name, pj, pg, pp, plenos, points }) => ({
      id,
      name,
      pj,
      pg,
      pp,
      plenos,
      points,
    }))
    .sort((a, b) => b.points - a.points);

  res.json({ ok: true, ranking });
});

// Perfil jugador (protegido)
app.get("/api/players/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const PLAYERS = loadPlayers();
  const player = PLAYERS.find((p) => p.id === id);
  if (!player) {
    return res.status(404).json({ ok: false, error: "Jugador no encontrado" });
  }

  res.json({
    ok: true,
    player: {
      id: player.id,
      name: player.name,
      createdAt: player.createdAt || "-",
      pj: player.pj,
      pg: player.pg,
      pp: player.pp,
      plenos: player.plenos,
      points: player.points,
    },
  });
});

// Crear jugador (SOLO ADMIN)
app.post("/api/players", requireAdmin, (req, res) => {
  // Solo pedimos el nombre. El resto se inicializa a 0.
  const { name } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ ok: false, error: "Nombre obligatorio" });
  }

  const PLAYERS = loadPlayers();
  const newPlayer = {
    id: nextIdFromPlayers(PLAYERS),
    name: String(name).trim(),
    createdAt: todayISO(),
    pj: 0,
    pg: 0,
    pp: 0,
    plenos: 0,
    points: 0,
  };

  PLAYERS.push(newPlayer);
  savePlayers(PLAYERS);
  return res.status(201).json({ ok: true, player: newPlayer });
});

app.post("/api/players/bulk-results", requireAdmin, (req, res) => {
  const { results } = req.body;

  if (!Array.isArray(results)) {
    return res.status(400).json({
      ok: false,
      error: "Formato inválido. Se espera { results: [...] }",
    });
  }

  const PLAYERS = loadPlayers();

  for (const item of results) {
    const id = Number(item.id);
    const pgDelta = Math.max(0, Number(item.pgDelta) || 0);
    const ppDelta = Math.max(0, Number(item.ppDelta) || 0);
    const weekPlayed = pgDelta + ppDelta;

    const player = PLAYERS.find((p) => p.id === id);
    if (!player) continue;

    // Normaliza números
    player.pg = Number(player.pg) || 0;
    player.pp = Number(player.pp) || 0;
    player.pj = Number(player.pj) || 0;
    player.plenos = Number(player.plenos) || 0;
    player.points = Number(player.points) || 0;

    // Suma semana a totales
    player.pg += pgDelta;
    player.pp += ppDelta;
    player.pj += weekPlayed;

    // ✅ Pleno: jugó esta semana y no perdió
    if (weekPlayed > 0 && ppDelta === 0) {
      player.plenos += 1;
    }

    // ✅ Puntos: +2 por PG, -0.25 por PP (según tu fórmula actual)
    const deltaPoints = pgDelta * 2 - ppDelta * 0.25;
    const newPoints = player.points + deltaPoints;

    // redondeo a 2 decimales para evitar floats raros
    player.points = Math.round(newPoints * 100) / 100;
  }

  savePlayers(PLAYERS);
  return res.json({ ok: true });
});

// Editar jugador (SOLO ADMIN)
app.patch("/api/players/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const PLAYERS = loadPlayers();
  const player = PLAYERS.find((p) => p.id === id);

  if (!player) {
    return res.status(404).json({ ok: false, error: "Jugador no encontrado" });
  }

  // Permitidos: NO pj, NO points
  const allowed = ["name", "pg", "pp", "plenos"];

  for (const key of allowed) {
    if (key in req.body) {
      if (key === "name") player.name = String(req.body.name).trim();
      else player[key] = Math.max(0, Number(req.body[key]) || 0);
    }
  }

  // Normaliza
  player.pg = Number(player.pg) || 0;
  player.pp = Number(player.pp) || 0;
  player.plenos = Number(player.plenos) || 0;

  // ✅ Recalcular PJ siempre
  player.pj = player.pg + player.pp;

  // ✅ Recalcular puntos siempre con la regla correcta
  //   Ganado = +2
  //   Perdido = -0.25
  const recalculated = (player.pg * 2) - (player.pp * 0.25);
  player.points = Math.round(recalculated * 100) / 100;

  savePlayers(PLAYERS);
  return res.json({ ok: true, player });
});



// Borrar jugador (SOLO ADMIN)
app.delete("/api/players/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const PLAYERS = loadPlayers();

  const idx = PLAYERS.findIndex((p) => p.id === id);
  if (idx === -1) {
    return res.status(404).json({ ok: false, error: "Jugador no encontrado" });
  }

  const [deleted] = PLAYERS.splice(idx, 1);
  savePlayers(PLAYERS);

  return res.json({ ok: true, deletedId: deleted.id });
});

// ====== START ======
app.listen(PORT, () => {
  console.log(`✅ Backend corriendo en http://localhost:${PORT}`);
  console.log(`📁 Frontend servido desde: ${frontendPath}`);
  console.log(`💾 DB en carpeta persistente DATA_DIR: ${process.env.DATA_DIR || "(default ./data)"}`);
});
