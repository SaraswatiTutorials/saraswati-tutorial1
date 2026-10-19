import express from "express";

const router = express.Router();

const NOMINATIM = "https://nominatim.openstreetmap.org";
const USER_AGENT = "SaraswatiTutorial/1.0 (location picker; contact: support@saraswatitutorial.com)";

const VIEWBOX = {
  Bangalore: "77.35,13.25,77.90,12.75",
  Mumbai: "72.70,19.40,73.20,18.85",
};

let lastCallAt = 0;
let chain = Promise.resolve();

function nominatimGet(pathAndQuery) {
  const task = chain.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastCallAt));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCallAt = Date.now();
    const response = await fetch(`${NOMINATIM}${pathAndQuery}`, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const error = new Error(`Geocoder responded with ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  });
  chain = task.then(
    () => {},
    () => {}
  );
  return task;
}

export function canonicalCity(name) {
  const value = String(name || "").trim();
  const normalized = value.toLowerCase();
  if (normalized.includes("bengaluru") || normalized.includes("bangalore")) return "Bangalore";
  if (normalized.includes("mumbai") || normalized.includes("bombay")) return "Mumbai";
  return value;
}

export function placeFromNominatim(item) {
  const address = item?.address || {};
  const area =
    address.suburb ||
    address.neighbourhood ||
    address.city_district ||
    address.quarter ||
    address.residential ||
    address.hamlet ||
    address.village ||
    address.town ||
    "";
  const rawCity = address.city || address.town || address.state_district || address.county || "";
  const city = canonicalCity(rawCity);
  const state = address.state || "";
  const pincode = address.postcode || "";
  const placeParts = [];
  if (area) placeParts.push(area);
  if (city && city.toLowerCase() !== String(area).toLowerCase()) placeParts.push(city);
  if (state && !placeParts.some((part) => part.toLowerCase() === state.toLowerCase())) {
    placeParts.push(state);
  }

  const latitude = Number(item.lat);
  const longitude = Number(item.lon);

  return {
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    area,
    city,
    state,
    pincode,
    placeLabel: placeParts.join(", ") || item.display_name || "",
    displayName: item.display_name || placeParts.join(", "),
  };
}

function sendGeocodeError(res, error) {
  console.error("[Geo]", error.message);
  res.status(502).json({ message: "Could not look up that location. Try again." });
}

router.get("/search", async (req, res) => {
  const query = String(req.query.q || "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (query.length < 3) return res.json({ results: [] });

  const biasCity = canonicalCity(req.query.city);
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: "6",
    countrycodes: "in",
  });
  if (VIEWBOX[biasCity]) {
    params.set("viewbox", VIEWBOX[biasCity]);
    params.set("bounded", "0");
  }

  try {
    const items = await nominatimGet(`/search?${params.toString()}`);
    const results = (Array.isArray(items) ? items : []).map(placeFromNominatim).filter((place) => place.latitude != null);
    res.json({ results });
  } catch (error) {
    sendGeocodeError(res, error);
  }
});

router.get("/reverse", async (req, res) => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ message: "Latitude and longitude are required" });
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ message: "Coordinates are out of range" });
  }

  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: "jsonv2",
    addressdetails: "1",
  });

  try {
    const item = await nominatimGet(`/reverse?${params.toString()}`);
    if (!item || item.error) {
      return res.status(404).json({ message: "No address found for that pin" });
    }
    res.json(placeFromNominatim(item));
  } catch (error) {
    sendGeocodeError(res, error);
  }
});

export default router;
