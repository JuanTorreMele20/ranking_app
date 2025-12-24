// frontend/main.js

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    ...options,
  });

  if (res.status === 401) {
    window.location.href = "/login.html";
    return null;
  }
  return res;
}

async function logout() {
  await api("/api/logout", { method: "POST" });
  window.location.href = "/login.html";
}

let RANKING_EDIT_MODE = false;

// ---------- RANKING ----------
function rowHtml({ idx, p }) {
  const rowClass =
    (idx === 1) ? "row-top1" :
    (idx >= 2 && idx <= 8) ? "row-top8" :
    "";

  return `<tr data-id="${p.id}" class="${rowClass}">
    <td>${idx}</td>
    <td>${p.name}</td>
    <td>${p.pj}</td>
    <td>${p.pg}</td>
    <td>${p.pp}</td>
    <td>${p.plenos}</td>
    <td>${p.points}</td>
  </tr>`;
}


async function loadRanking() {
  const res = await api("/api/ranking");
  if (!res) return;

  const data = await res.json();
  const ranking = data.ranking || [];

  const tbody = document.querySelector("#rankingBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  ranking.forEach((p, i) => {
    // idx empieza en 1 para el ranking
    tbody.insertAdjacentHTML("beforeend", rowHtml({ idx: i + 1, p }));
  });

  // Click en fila -> ir a player.html
  tbody.querySelectorAll("tr").forEach((tr) => {
    tr.addEventListener("click", () => {
      const id = tr.getAttribute("data-id");
      window.location.href = `/player.html?id=${id}`;
    });
  });
}



async function initRankingPage() {
  // Comprobamos sesión
  const meRes = await api("/api/me");
  if (!meRes) return;

  const me = await meRes.json();
  const role = me.user?.role || "";
  const username = me.user?.username || "";
  const isAdmin = role === "Admin";

  // Mostrar usuario
  const who = document.querySelector("#who");
  if (who) {
    who.textContent = `${username} (${role})`;
  }

  // Logout
  document.querySelector("#logoutBtn")?.addEventListener("click", logout);

  // Panel admin (crear jugador + update semanal)
  const adminPanel = document.querySelector("#adminPanel");
  if (isAdmin) {
    adminPanel?.classList.remove("hidden");
  } else {
    adminPanel?.classList.add("hidden");
  }

  // Botón ir a update semanal
  const goUpdateBtn = document.querySelector("#goUpdateBtn");
  if (isAdmin && goUpdateBtn) {
    goUpdateBtn.addEventListener("click", () => {
      window.location.href = "/update.html";
    });
  }

  // Form añadir jugador (solo admin)
  const addForm = document.querySelector("#addPlayerForm");
  if (addForm && isAdmin) {
    addForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const nameInput = document.querySelector("#newName");
      const msg = document.querySelector("#adminMsg");
      msg.textContent = "";

      const name = nameInput.value.trim();
      if (!name) {
        msg.textContent = "El nombre es obligatorio";
        return;
      }

      const res = await api("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const out = await res.json();
      if (!res.ok) {
        msg.textContent = out.error || "Error al crear jugador";
        return;
      }

      nameInput.value = "";
      msg.textContent = "Jugador añadido ✅";

      await loadRanking();
    });
  }

  // Cargar ranking
  await loadRanking();
}


// ---------- PLAYER ----------
function getQueryParam(key) {
  const url = new URL(window.location.href);
  return url.searchParams.get(key);
}

function safeText(el, txt) {
  if (el) el.textContent = txt;
}

async function initPlayerPage() {
  document.querySelector("#logoutBtn")?.addEventListener("click", logout);

  // Saber si es Admin para mostrar botón Delete
  let isAdmin = false;
  const meRes = await api("/api/me");
  if (meRes) {
    const me = await meRes.json();
    isAdmin = me.user?.role === "Admin";
  }

  const id = Number(getQueryParam("id"));
  if (!id) {
    alert("Jugador no válido");
    window.location.href = "/ranking.html";
    return;
  }

  const res = await api(`/api/players/${id}`);
  if (!res) return;
  const out = await res.json();
  if (!res.ok) {
    alert(out.error || "No se pudo cargar el jugador");
    window.location.href = "/ranking.html";
    return;
  }

  const p = out.player;

  safeText(document.querySelector("#playerName"), p.name ?? "Jugador");
  safeText(document.querySelector("#playerCreatedAt"), p.createdAt || "-");
  safeText(document.querySelector("#playerPoints"), String(p.points ?? 0));

  safeText(document.querySelector("#playerPJ"), String(p.pj ?? 0));
  safeText(document.querySelector("#playerPG"), String(p.pg ?? 0));
  safeText(document.querySelector("#playerPP"), String(p.pp ?? 0));
  safeText(document.querySelector("#playerPlenos"), String(p.plenos ?? 0));

  const pj = Number(p.pj) || 0;
  const pg = Number(p.pg) || 0;
  const winRate = pj > 0 ? Math.round((pg / pj) * 100) : 0;
  safeText(document.querySelector("#playerWinRate"), `${winRate}%`);

  // Acciones admin: borrar jugador
  const adminActions = document.querySelector("#adminPlayerActions");
  const deleteBtn = document.querySelector("#deleteBtn");
  const deleteMsg = document.querySelector("#deleteMsg");




  const adminEditPanel = document.querySelector("#adminEditPanel");
  const saveBtn = document.querySelector("#savePlayerBtn");
  const saveMsg = document.querySelector("#savePlayerMsg");

  const editPJ = document.querySelector("#editPJ");
  const editPG = document.querySelector("#editPG");
  const editPP = document.querySelector("#editPP");
  const editPlenos = document.querySelector("#editPlenos");

  // Si es admin, mostramos panel y pre-cargamos valores
  if (isAdmin) {
    adminEditPanel?.classList.remove("hidden");

    editPJ.value = String(p.pj ?? 0);
    editPG.value = String(p.pg ?? 0);
    editPP.value = String(p.pp ?? 0);
    editPlenos.value = String(p.plenos ?? 0);

    saveBtn?.addEventListener("click", async () => {
      saveMsg.textContent = "";

      const payload = {
        pj: Number(editPJ.value) || 0,
        pg: Number(editPG.value) || 0,
        pp: Number(editPP.value) || 0,
        plenos: Number(editPlenos.value) || 0,
      };

      const r = await api(`/api/players/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r) return;

      const out = await r.json();
      if (!r.ok) {
        alert(out.error || "No se pudo guardar");
        return;
      }

      saveMsg.textContent = "Guardado ✅";

      // Recargar la página para mostrar valores actualizados (incluidos puntos recalculados)
      window.location.reload();
    });
  } else {
    adminEditPanel?.classList.add("hidden");
  }

}

// ---------- AUTO INIT ----------
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page === "ranking") initRankingPage();
  if (page === "player") initPlayerPage();
  if (page === "update") initUpdatePage();
});


// ---------- UPDATE (semanal) ----------
function updateRowHtml({ idx, p }) {
  const rowClass = (idx === 1) ? "row-top1" : (idx >= 2 && idx <= 8) ? "row-top8" : "";

  return `<tr data-id="${p.id}" class="${rowClass}">

    <td>${idx}</td>
    <td>${p.name}</td>
    <td>
      <input class="smallInput" type="number" min="0" value="0" data-week="pg" data-id="${p.id}" />
    </td>
    <td>
      <input class="smallInput" type="number" min="0" value="0" data-week="pp" data-id="${p.id}" />
    </td>
  </tr>`;
}

async function initUpdatePage() {
  // Si no hay sesión, api() redirige a login. Además, comprobamos Admin.
  const meRes = await api("/api/me");
  if (!meRes) return;
  const me = await meRes.json();
  const isAdmin = me.user?.role === "Admin";

  if (!isAdmin) {
    alert("Solo Admin puede actualizar resultados.");
    window.location.href = "/ranking.html";
    return;
  }

  const msg = document.querySelector("#updateMsg");
  const tbody = document.querySelector("#updateBody");
  const applyBtn = document.querySelector("#applyWeeklyBtn");

  msg.textContent = "";
  tbody.innerHTML = "";

  // Reutilizamos /api/ranking para traer jugadores con id+name (y stats si quieres)
  const res = await api("/api/ranking");
  if (!res) return;
  const data = await res.json();
  const players = data.ranking || [];

  players.forEach((p, i) => {
    tbody.insertAdjacentHTML("beforeend", updateRowHtml({ idx: i + 1, p }));
  });

  applyBtn.addEventListener("click", async () => {
    msg.textContent = "";

    const payload = players.map((p) => {
      const pgInput = tbody.querySelector(`input[data-week="pg"][data-id="${p.id}"]`);
      const ppInput = tbody.querySelector(`input[data-week="pp"][data-id="${p.id}"]`);

      const pgDelta = Math.max(0, Number(pgInput?.value ?? 0) || 0);
      const ppDelta = Math.max(0, Number(ppInput?.value ?? 0) || 0);

      return { id: p.id, pgDelta, ppDelta };
    });

    // Si todo está a 0, no hacemos nada
    const anyChange = payload.some(x => (x.pgDelta + x.ppDelta) > 0);
    if (!anyChange) {
      msg.textContent = "No hay cambios (todo está a 0).";
      return;
    }

    const postRes = await api("/api/players/bulk-results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results: payload }),
    });

    const out = await postRes.json();
    if (!postRes.ok) {
      alert(out.error || "No se pudieron actualizar resultados");
      return;
    }

    msg.textContent = "Resultados actualizados ✅";
    // Opcional: volver al ranking
    window.location.href = "/ranking.html";
  });
}
