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
function rowHtml({ idx, p, isAdmin }) {
  const actions = isAdmin
    ? `<td>
        <div class="actionRow" onclick="event.stopPropagation()">
          <button class="btn secondary" data-action="save" data-id="${p.id}">Guardar</button>
        </div>
      </td>`
    : "";

  const nameCell = isAdmin
    ? `<td onclick="event.stopPropagation()">
         <input class="smallInput" data-field="name" data-id="${p.id}" value="${p.name}">
       </td>`
    : `<td>${p.name}</td>`;

  const cellNum = (field, val) =>
    isAdmin
      ? `<td onclick="event.stopPropagation()">
           <input class="smallInput" type="number" min="0" data-field="${field}" data-id="${p.id}" value="${val}">
         </td>`
      : `<td>${val}</td>`;

  const rowClass =
    (idx === 1) ? "row-top1" :
    (idx >= 2 && idx <= 8) ? "row-top8" :
    "";

  return `<tr data-id="${p.id}" class="${rowClass}">
    <td>${idx}</td>
    ${nameCell}
    ${cellNum("pj", p.pj)}
    ${cellNum("pg", p.pg)}
    ${cellNum("pp", p.pp)}
    ${cellNum("plenos", p.plenos)}
    <td>${p.points}</td>
    ${actions}
  </tr>`;
}


async function loadRanking(isAdmin) {
  const res = await api("/api/ranking");
  if (!res) return;

  const data = await res.json();
  const ranking = data.ranking || [];

  const tbody = document.querySelector("#rankingBody");
  tbody.innerHTML = "";

  ranking.forEach((p, i) => {
    tbody.insertAdjacentHTML("beforeend", rowHtml({ idx: i + 1, p, isAdmin }));
  });

  // click fila -> player
  tbody.querySelectorAll("tr").forEach((tr) => {
    tr.addEventListener("click", () => {
      const id = tr.getAttribute("data-id");
      window.location.href = `/player.html?id=${id}`;
    });
  });

  // acciones admin
  if (isAdmin) {
    tbody.querySelectorAll('[data-action="save"]').forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const id = Number(btn.dataset.id);

        const read = (field) =>
          tbody.querySelector(`input[data-field="${field}"][data-id="${id}"]`).value;

        const payload = {
          name: read("name"),
          pj: Number(read("pj")),
          pg: Number(read("pg")),
          pp: Number(read("pp")),
          plenos: Number(read("plenos")),
        };

        const res = await api(`/api/players/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const out = await res.json();
        if (!res.ok) {
          alert(out.error || "No se pudo guardar");
          return;
        }

        await loadRanking(true);
      });
    });
  }
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

    const goUpdateBtn = document.querySelector("#goUpdateBtn");
      if (isAdmin && goUpdateBtn) {
        goUpdateBtn.addEventListener("click", () => {
          window.location.href = "/update.html";
        });
      }

  // panel admin visible?
  const adminPanel = document.querySelector("#adminPanel");
  const thActions = document.querySelector("#thActions");
  if (isAdmin) {
    adminPanel?.classList.remove("hidden");
    thActions?.classList.remove("hidden");
  }

  // form añadir
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

      await loadRanking(true);
    });
  }

  await loadRanking(isAdmin);
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

  if (isAdmin) {
    adminActions?.classList.remove("hidden");

    deleteBtn?.addEventListener("click", async () => {
      const ok = confirm(
        `¿Seguro que quieres borrar a "${p.name}"? Esta acción no se puede deshacer.`
      );
      if (!ok) return;

      if (deleteMsg) deleteMsg.textContent = "";

      const delRes = await api(`/api/players/${id}`, { method: "DELETE" });
      if (!delRes) return;
      const delOut = await delRes.json();

      if (!delRes.ok) {
        alert(delOut.error || "No se pudo borrar el jugador");
        return;
      }

      // Vuelve al ranking tras borrar
      window.location.href = "/ranking.html";
    });
  } else {
    adminActions?.classList.add("hidden");
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
