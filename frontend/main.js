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

// ---------- RANKING (solo lectura) ----------
function rowHtml({ idx, p }) {
  const rowClass =
    (idx === 1) ? "row-gold" :
    (idx >= 2 && idx <= 8) ? "row-silver" :
    (idx >= 9 && idx <= 16) ? "row-bronze" :
    (idx >= 17 && idx <= 24) ? "row-green" :
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
    tbody.insertAdjacentHTML("beforeend", rowHtml({ idx: i + 1, p }));
  });

  tbody.querySelectorAll("tr").forEach((tr) => {
    tr.addEventListener("click", () => {
      const id = tr.getAttribute("data-id");
      window.location.href = `/player.html?id=${id}`;
    });
  });
}

async function initRankingPage() {
  const meRes = await api("/api/me");
  if (!meRes) return;
  const me = await meRes.json();

  const role = me.user?.role || "";
  const username = me.user?.username || "";
  const isAdmin = role === "Admin";

  const who = document.querySelector("#who");
  if (who) who.textContent = `${username} (${role})`;

  document.querySelector("#logoutBtn")?.addEventListener("click", logout);

  // Panel admin
  const adminPanel = document.querySelector("#adminPanel");
  if (isAdmin) adminPanel?.classList.remove("hidden");

  // Botón update semanal
  const goUpdateBtn = document.querySelector("#goUpdateBtn");
  if (isAdmin && goUpdateBtn) {
    goUpdateBtn.addEventListener("click", () => {
      window.location.href = "/update.html";
    });
  }

  // Crear jugador (solo nombre)
  const addForm = document.querySelector("#addPlayerForm");
  if (addForm) {
    addForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!isAdmin) return;

      const name = document.querySelector("#newName").value.trim();
      const msg = document.querySelector("#adminMsg");
      msg.textContent = "";

      const res = await api("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const out = await res.json();
      if (!res.ok) {
        msg.textContent = out.error || "Error al crear";
        return;
      }

      document.querySelector("#newName").value = "";
      msg.textContent = "Jugador añadido ✅";
      await loadRanking();
    });
  }

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

  // Sesión + rol
  let isAdmin = false;
  const meRes = await api("/api/me");
  if (!meRes) return;
  const me = await meRes.json();
  isAdmin = me.user?.role === "Admin";

  const id = Number(getQueryParam("id"));
  if (!id) {
    alert("Jugador no válido");
    window.location.href = "/ranking.html";
    return;
  }

  // Cargar jugador
  const res = await api(`/api/players/${id}`);
  if (!res) return;
  const out = await res.json();

  if (!res.ok) {
    alert(out.error || "No se pudo cargar el jugador");
    window.location.href = "/ranking.html";
    return;
  }

  const p = out.player;

  // Pintar datos
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

  // Admin: panel editar
  const adminEditPanel = document.querySelector("#adminEditPanel");
  const editName = document.querySelector("#editName");
  const editPG = document.querySelector("#editPG");
  const editPP = document.querySelector("#editPP");
  const editPlenos = document.querySelector("#editPlenos");
  const saveBtn = document.querySelector("#savePlayerBtn");
  const saveMsg = document.querySelector("#savePlayerMsg");

  const adminOnlyHr = document.querySelector("#adminOnlyHr");

  if (isAdmin) {
    adminEditPanel?.classList.remove("hidden");
    adminEditPanel?.classList.remove("hidden");
    adminPlayerActions?.classList.remove("hidden");
    adminOnlyHr?.classList.remove("hidden");

    editName.value = String(p.name ?? "");
    editPG.value = String(p.pg ?? 0);
    editPP.value = String(p.pp ?? 0);
    editPlenos.value = String(p.plenos ?? 0);

    saveBtn?.addEventListener("click", async () => {
      saveMsg.textContent = "";

      const payload = {
        name: editName.value.trim(),
        pg: Math.max(0, Number(editPG.value) || 0),
        pp: Math.max(0, Number(editPP.value) || 0),
        plenos: Math.max(0, Number(editPlenos.value) || 0),
        // PJ NO se manda: lo recalcula el backend como pg+pp
      };

      const r = await api(`/api/players/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r) return;

      const o = await r.json();
      if (!r.ok) {
        alert(o.error || "No se pudo guardar");
        return;
      }

      saveMsg.textContent = "Guardado ✅";
      window.location.reload();
    });
  } else {
    adminEditPanel?.classList.add("hidden");
    adminEditPanel?.classList.add("hidden");
    adminPlayerActions?.classList.add("hidden");
    adminOnlyHr?.classList.add("hidden");
  }

  // Admin: borrar jugador (si lo tienes)
  const adminActions = document.querySelector("#adminPlayerActions");
  const deleteBtn = document.querySelector("#deleteBtn");
  const deleteMsg = document.querySelector("#deleteMsg");

  if (isAdmin && deleteBtn) {
    adminActions?.classList.remove("hidden");

    deleteBtn.addEventListener("click", async () => {
      const ok = confirm(`¿Seguro que quieres borrar a "${p.name}"?`);
      if (!ok) return;

      if (deleteMsg) deleteMsg.textContent = "";

      const delRes = await api(`/api/players/${id}`, { method: "DELETE" });
      if (!delRes) return;
      const delOut = await delRes.json();

      if (!delRes.ok) {
        alert(delOut.error || "No se pudo borrar el jugador");
        return;
      }

      window.location.href = "/ranking.html";
    });
  } else {
    adminActions?.classList.add("hidden");
  }
}

// ---------- UPDATE (semanal) ----------
function updateRowHtml({ idx, p }) {
  return `<tr data-id="${p.id}">
    <td>${idx}</td>
    <td>${p.name}</td>
    <td><input class="smallInput" type="number" min="0" value="0" data-week="pg" data-id="${p.id}" /></td>
    <td><input class="smallInput" type="number" min="0" value="0" data-week="pp" data-id="${p.id}" /></td>
  </tr>`;
}

async function initUpdatePage() {
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

  if (!tbody || !applyBtn || !msg) return;

  msg.textContent = "";
  tbody.innerHTML = "";

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

    const anyChange = payload.some((x) => (x.pgDelta + x.ppDelta) > 0);
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
    window.location.href = "/ranking.html";
  });
}

// ---------- AUTO INIT ----------
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page === "ranking") initRankingPage();
  if (page === "player") initPlayerPage();
  if (page === "update") initUpdatePage();
});
