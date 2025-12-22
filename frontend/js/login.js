document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const errorDiv = document.getElementById("error");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorDiv.textContent = "";

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        errorDiv.textContent = data.message || "Error al iniciar sesión";
        return;
      }

      // Admin y Player ven lo mismo por ahora
      window.location.href = "/ranking.html";
    } catch (err) {
      errorDiv.textContent = "No se pudo conectar con el servidor";
    }
  });
});
