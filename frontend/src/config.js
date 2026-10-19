export const API_BASE =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:5001/api"
    : "https://saraswati-tutorial1-2.onrender.com/api";
