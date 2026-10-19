import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, Loader2, MapPin, Search, X } from "lucide-react";
import { API_BASE } from "../config";

const CITY_CENTERS = {
  Bangalore: { lat: 12.9716, lng: 77.5946 },
  Mumbai: { lat: 19.076, lng: 72.8777 },
};

const pinIcon = L.divIcon({
  className: "location-pin-icon",
  iconSize: [36, 48],
  iconAnchor: [18, 46],
  html: `<svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M18 47C18 47 33 29.5 33 18.2C33 9.7 26.3 3 18 3C9.7 3 3 9.7 3 18.2C3 29.5 18 47 18 47Z" fill="#16a34a" stroke="white" stroke-width="2"/>
    <circle cx="18" cy="18" r="6" fill="white"/>
  </svg>`,
});

function composeAddress(place, houseDetails) {
  return [houseDetails.trim(), place?.placeLabel, place?.pincode].filter(Boolean).join(", ");
}

export function LocationField({
  label = "Location",
  required = false,
  value,
  biasCity = "",
  error = "",
  onChange,
  emptyText = "Add your area on the map",
}) {
  const [open, setOpen] = useState(false);
  const hasPin = value?.latitude != null && value?.longitude != null && value?.placeLabel;

  return (
    <div>
      <label className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full items-start gap-3 rounded-3xl border bg-white px-4 py-3 text-left transition hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 ${
          error ? "border-red-400" : "border-slate-200 dark:border-slate-700"
        }`}
      >
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <span className="min-w-0 flex-1">
          {hasPin ? (
            <>
              <span className="block text-sm font-bold text-slate-900 dark:text-white">{value.placeLabel}</span>
              {value.houseDetails && (
                <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">{value.houseDetails}</span>
              )}
              {value.pincode && (
                <span className="mt-1 block text-xs font-semibold text-slate-400">PIN {value.pincode}</span>
              )}
            </>
          ) : (
            <>
              <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{emptyText}</span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                Search, drop a pin, or use your current location
              </span>
            </>
          )}
        </span>
        <span className="shrink-0 text-xs font-black text-emerald-700 dark:text-emerald-300">
          {hasPin ? "Edit" : "Add"}
        </span>
      </button>
      {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
      {open && (
        <LocationPickerSheet
          biasCity={biasCity || value?.city || ""}
          initial={value}
          onClose={() => setOpen(false)}
          onSave={(location) => {
            onChange(location);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

export function LocationPickerSheet({ biasCity = "", initial, onClose, onSave }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const searchRef = useRef(null);
  const reverseRef = useRef(null);
  const requestId = useRef(0);

  const start = CITY_CENTERS[biasCity] || CITY_CENTERS.Bangalore;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [place, setPlace] = useState(() =>
    initial?.latitude != null && initial?.longitude != null
      ? {
          latitude: Number(initial.latitude),
          longitude: Number(initial.longitude),
          area: initial.area || "",
          city: initial.city || "",
          pincode: initial.pincode || "",
          placeLabel: initial.placeLabel || "",
          displayName: initial.placeLabel || "",
        }
      : null
  );
  const [houseDetails, setHouseDetails] = useState(initial?.houseDetails || "");
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [houseError, setHouseError] = useState("");

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const center = place
      ? [place.latitude, place.longitude]
      : [start.lat, start.lng];
    const map = L.map(mapEl.current, { zoomControl: true }).setView(center, place ? 16 : 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker(center, { draggable: true, autoPan: true, icon: pinIcon }).addTo(map);
    marker.bindTooltip("Move pin to your exact location", {
      permanent: true,
      direction: "top",
      offset: [0, -20],
      className: "location-pin-hint",
    });
    marker.on("dragend", () => {
      const next = marker.getLatLng();
      reverseRef.current?.(next.lat, next.lng);
    });
    map.on("click", (event) => {
      marker.setLatLng(event.latlng);
      reverseRef.current?.(event.latlng.lat, event.latlng.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;
    const timer = setTimeout(() => map.invalidateSize(), 200);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // The map is created once per open. Later pin moves go through movePin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setSearching(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const params = new URLSearchParams({ q: trimmed });
        if (biasCity) params.set("city", biasCity);
        const response = await fetch(`${API_BASE}/geo/search?${params.toString()}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Search failed");
        setResults(data.results || []);
      } catch (error) {
        if (error.name === "AbortError") return;
        setSearchError(error.message || "Search failed");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, biasCity]);

  const movePin = (latitude, longitude) => {
    const latLng = [latitude, longitude];
    markerRef.current?.setLatLng(latLng);
    mapRef.current?.flyTo(latLng, Math.max(mapRef.current.getZoom(), 16));
  };

  const reverseGeocode = async (latitude, longitude, { recenter = false } = {}) => {
    const id = ++requestId.current;
    setResolving(true);
    setSearchError("");
    setResults([]);
    if (recenter) movePin(latitude, longitude);
    try {
      const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude) });
      const response = await fetch(`${API_BASE}/geo/reverse?${params.toString()}`);
      const data = await response.json();
      if (id !== requestId.current) return;
      if (!response.ok) throw new Error(data.message || "Could not read that location");
      setPlace(data);
      if (recenter) movePin(data.latitude, data.longitude);
    } catch (error) {
      if (id !== requestId.current) return;
      setSearchError(error.message || "Could not read that location");
    } finally {
      if (id === requestId.current) setResolving(false);
    }
  };
  reverseRef.current = reverseGeocode;

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setPermissionBlocked(true);
      return;
    }
    setLocating(true);
    setPermissionBlocked(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        reverseGeocode(position.coords.latitude, position.coords.longitude, { recenter: true });
      },
      () => {
        setLocating(false);
        setPermissionBlocked(true);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  const chooseResult = (result) => {
    setQuery("");
    setResults([]);
    setPlace(result);
    movePin(result.latitude, result.longitude);
  };

  const save = () => {
    if (!place?.latitude || !place?.longitude) {
      setSearchError("Drop the pin or search for your area first");
      return;
    }
    if (houseDetails.trim().length < 3) {
      setHouseError("Enter house, flat, or building details");
      return;
    }
    onSave({
      ...place,
      houseDetails: houseDetails.trim(),
      fullAddress: composeAddress(place, houseDetails),
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/70 sm:items-center">
      <div className="relative flex h-[100dvh] w-full flex-col bg-[#0b1220] text-white sm:h-[min(880px,94dvh)] sm:max-w-2xl sm:overflow-hidden sm:rounded-3xl sm:shadow-2xl">
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-300 hover:bg-white/10"
            aria-label="Close location picker"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-black">Select your location</h2>
        </div>

        <div className="relative z-[650] px-4 pb-3">
          <Search className="pointer-events-none absolute left-8 top-3.5 h-4 w-4 text-slate-400" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search area, locality, or landmark"
            className="h-12 w-full rounded-2xl border border-white/10 bg-slate-900 pl-11 pr-4 text-sm font-semibold text-white outline-none placeholder:text-slate-500 focus:border-emerald-500"
          />
          {(searching || results.length > 0 || searchError) && query.trim().length >= 3 && (
            <div className="absolute left-4 right-4 top-14 max-h-64 overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
              {searching && <p className="px-4 py-3 text-sm text-slate-400">Searching…</p>}
              {searchError && <p className="px-4 py-3 text-sm font-semibold text-red-300">{searchError}</p>}
              {results.map((result) => (
                <button
                  key={`${result.latitude}-${result.longitude}-${result.displayName}`}
                  type="button"
                  onClick={() => chooseResult(result)}
                  className="block w-full border-t border-white/5 px-4 py-3 text-left first:border-t-0 hover:bg-white/5"
                >
                  <span className="block text-sm font-bold text-white">{result.placeLabel || result.displayName}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">{result.displayName}</span>
                </button>
              ))}
              {!searching && !searchError && results.length === 0 && (
                <p className="px-4 py-3 text-sm text-slate-400">No places found. Try a nearby landmark.</p>
              )}
            </div>
          )}
        </div>

        <div className="relative z-0 min-h-[240px] flex-1">
          <div ref={mapEl} className="location-map-canvas absolute inset-0" />
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="absolute bottom-4 left-1/2 z-[500] inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-lg hover:bg-emerald-500 disabled:opacity-70"
          >
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
            Use current location
          </button>
        </div>

        <div className="space-y-3 border-t border-white/10 bg-[#10182a] px-4 py-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Selected place</p>
            <p className="mt-1 text-sm font-bold text-white">
              {resolving ? "Finding address…" : place?.placeLabel || "Search or move the pin to choose an area"}
            </p>
            {place?.pincode && <p className="mt-1 text-xs font-semibold text-slate-400">PIN {place.pincode}</p>}
          </div>

          {searchError && query.trim().length < 3 && (
            <p className="text-sm font-semibold text-red-300">{searchError}</p>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-slate-200">
              Address details <span className="text-red-400">*</span>
            </span>
            <input
              value={houseDetails}
              onChange={(event) => {
                setHouseDetails(event.target.value);
                setHouseError("");
              }}
              placeholder="Flat, house no., building, street"
              className="h-12 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-semibold text-white outline-none placeholder:text-slate-500 focus:border-emerald-500"
            />
            {houseError && <span className="mt-1 block text-xs font-bold text-red-300">{houseError}</span>}
          </label>

          <button
            type="button"
            onClick={save}
            className="h-12 w-full rounded-2xl bg-emerald-600 text-sm font-black text-white hover:bg-emerald-500"
          >
            Save location
          </button>
        </div>

        {permissionBlocked && (
          <div className="absolute inset-0 z-[900] flex items-center justify-center bg-black/60 p-6">
            <div className="w-full max-w-sm rounded-3xl bg-[#1c2433] p-6 text-center shadow-2xl">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                <LocateFixed className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-lg font-black">Location permission not enabled</h3>
              <p className="mt-2 text-sm text-slate-300">
                Enable location to drop the pin at your current place, or search for the area yourself.
              </p>
              <button
                type="button"
                onClick={useCurrentLocation}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-800 text-sm font-black text-emerald-400 hover:bg-slate-700"
              >
                <LocateFixed className="h-4 w-4" />
                Enable device location
              </button>
              <button
                type="button"
                onClick={() => {
                  setPermissionBlocked(false);
                  searchRef.current?.focus();
                }}
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-800 text-sm font-black text-white hover:bg-slate-700"
              >
                <Search className="h-4 w-4" />
                Enter location manually
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
