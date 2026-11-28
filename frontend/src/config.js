// The backend's address. On Vercel it can be set with the VITE_API_BASE
// environment variable (e.g. https://my-backend.onrender.com/api), so a server
// move needs no code change; without it, the address below is used.
// Moved 28 Nov 2026 from saraswati-tutorial1-2 (suspended) to the new Render
// service saraswati-backend.
const FROM_VERCEL = String(import.meta.env.VITE_API_BASE || "").trim().replace(/\/+$/, "");

export const API_BASE =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:5001/api"
    : FROM_VERCEL || "https://saraswati-backend-1i4z.onrender.com/api";
