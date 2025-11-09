
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bed, ImageOff, MapPin, Search as SearchIcon } from "lucide-react";
import api from "../api";
import { useAuth } from "../AuthContext";

function buildParams(filters = {}) {
  const params = {};
  const {
    q = "",
    location = "",
    minPrice = "",
    maxPrice = "",
    bedrooms = "",
    limit = "",
    page = "",
  } = filters;

  if (q) params.q = q;
  if (location) params.location = location;
  if (minPrice !== "") params.min_price = Number(minPrice);
  if (maxPrice !== "") params.max_price = Number(maxPrice);
  if (bedrooms !== "") params.bedrooms = Number(bedrooms);
  if (limit !== "") params.limit = Number(limit);
  if (page !== "") params.page = Number(page);
  return params;
}

const PRICE_MIN = 0;
const PRICE_MAX = 5_000_000;
const PRICE_STEP = 50_000;
const PRICE_RANGE = PRICE_MAX - PRICE_MIN;
const SEARCH_DEFAULT_LIMIT = 50;
const PRICE_PRESETS = [
  { label: "Under $500k", min: PRICE_MIN, max: 500_000 },
  { label: "$500k - $1M", min: 500_000, max: 1_000_000 },
  { label: "$1M - $2M", min: 1_000_000, max: 2_000_000 },
  { label: "$2M - $3M", min: 2_000_000, max: 3_000_000 },
  { label: "$3M+", min: 3_000_000, max: PRICE_MAX },
];

const BEDROOM_MIN = 0;
const BEDROOM_MAX = 10;
const BEDROOM_PRESETS = [
  { label: "Any", value: "" },
  { label: "1 BR", value: "1" },
  { label: "2 BR", value: "2" },
  { label: "3 BR", value: "3" },
  { label: "4 BR", value: "4" },
  { label: "5+ BR", value: "5" },
];

const snapToStep = (value) =>
  Math.round(value / PRICE_STEP) * PRICE_STEP;

const COMPACT_CURRENCY_FORMATTER = new Intl.NumberFormat("en-SG", {
  style: "currency",
  currency: "SGD",
  maximumFractionDigits: 1,
  notation: "compact",
});

const clampPrice = (value) => {
  if (Number.isNaN(value) || !Number.isFinite(value)) return PRICE_MIN;
  return Math.min(PRICE_MAX, Math.max(PRICE_MIN, value));
};

const normalizeMinValue = (value) => (value <= PRICE_MIN ? "" : value);
const normalizeMaxValue = (value) => (value >= PRICE_MAX ? "" : value);

const formatCompactCurrency = (value, fallback) => {
  if (value === "" || value === null || Number.isNaN(Number(value))) {
    return fallback;
  }
  return COMPACT_CURRENCY_FORMATTER.format(Number(value));
};

const clampBedroomsValue = (value) => {
  if (Number.isNaN(value) || !Number.isFinite(value)) return BEDROOM_MIN;
  return Math.max(BEDROOM_MIN, Math.min(BEDROOM_MAX, value));
};

const normalizeBedroomValue = (value) =>
  value <= BEDROOM_MIN ? "" : String(value);

const getPrimaryPhoto = (photos) => {
  if (!photos) return null;
  if (Array.isArray(photos)) return photos[0] || null;
  try {
    const parsed = JSON.parse(photos);
    if (Array.isArray(parsed)) {
      return parsed.find((src) => typeof src === "string" && src.trim().length > 0) || null;
    }
    return null;
  } catch (_) {
    return null;
  }
};

export default function HomebuyerSearch() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState([]);
  const [savingId, setSavingId] = useState(null);

  const refreshSaved = useCallback(async () => {
    try {
      const { data } = await api.get("/homeowner/saved");
      setSaved(data?.items || []);
    } catch (_) {
      // keep search usable even if saved list fails
    }
  }, []);

  const search = useCallback(async (override) => {
    setMsg("");
    setLoading(true);
    try {
      const baseFilters = {
        q,
        location,
        minPrice,
        maxPrice,
        bedrooms,
        limit: SEARCH_DEFAULT_LIMIT,
        ...(override || {}),
      };
      if (
        baseFilters.limit === undefined ||
        baseFilters.limit === null ||
        baseFilters.limit === ""
      ) {
        baseFilters.limit = SEARCH_DEFAULT_LIMIT;
      }
      const params = buildParams(baseFilters);
      const { data } = await api.get("/homeowner/properties", { params });
      if (data?.success) {
        setItems(data.items || []);
      } else {
        setMsg(data?.error || "Search failed");
      }
    } catch (_) {
      setMsg("Network error");
    } finally {
      setLoading(false);
    }
  }, [q, location, minPrice, maxPrice, bedrooms]);

  const toggleSave = useCallback(async (property) => {
    const exists = saved.some((entry) => entry.id === property.id);
    setSavingId(property.id);
    try {
      if (exists) {
        await api.delete(`/homeowner/saved/${property.id}`);
        setSaved((prev) => prev.filter((entry) => entry.id !== property.id));
      } else {
        await api.post(`/homeowner/saved/${property.id}`);
        setSaved((prev) => {
          if (prev.some((entry) => entry.id === property.id)) return prev;
          return [
            {
              id: property.id,
              title: property.title,
              price: property.price,
              bedrooms: property.bedrooms,
              location: property.location,
            },
            ...prev,
          ];
        });
      }
      window.dispatchEvent(new Event("saved-properties:refresh"));
    } catch (error) {
      const message =
        error?.response?.data?.error || "Failed to update saved list";
      alert(message);
    } finally {
      setSavingId(null);
    }
  }, [saved]);

  const handleRemoveSaved = useCallback(
    (property) => toggleSave(property),
    [toggleSave]
  );

  const handleSearchKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        search();
      }
    },
    [search]
  );

  const handleSearchClear = useCallback(() => setQ(""), []);
  const handleLocationClear = useCallback(() => setLocation(""), []);

  const handleBedroomPreset = useCallback((value) => {
    setBedrooms((prev) => (prev === value ? "" : value));
  }, []);

  const handleBedroomStep = useCallback((direction) => {
    setBedrooms((prev) => {
      const current = prev === "" ? BEDROOM_MIN : clampBedroomsValue(Number(prev));
      const delta = direction === "dec" ? -1 : 1;
      const next = clampBedroomsValue(current + delta);
      return normalizeBedroomValue(next);
    });
  }, []);

  const bedroomsNumber = bedrooms === "" ? null : Number(bedrooms);
  const bedroomDecreaseDisabled = bedroomsNumber === null;
  const bedroomIncreaseDisabled =
    bedroomsNumber !== null && bedroomsNumber >= BEDROOM_MAX;
  const bedroomStepperText = bedrooms === "" ? "Any" : `${bedrooms} BR`;
  const bedroomStepperClass =
    bedrooms === ""
      ? "bedroom-stepper__count is-any"
      : "bedroom-stepper__count";

  const normalizedMinPrice = minPrice === "" ? PRICE_MIN : Number(minPrice);
  const normalizedMaxPrice = maxPrice === "" ? PRICE_MAX : Number(maxPrice);

  const displayMinBudget = formatCompactCurrency(
    minPrice === "" ? "" : normalizedMinPrice,
    "No min"
  );
  const displayMaxBudget = formatCompactCurrency(
    maxPrice === "" ? "" : normalizedMaxPrice,
    "No max"
  );

  const handleSliderMinChange = useCallback(
    (event) => {
      const raw = clampPrice(Number(event.target.value));
      const currentMax = maxPrice === "" ? PRICE_MAX : Number(maxPrice);
      const nextMin = Math.min(raw, currentMax);
      setMinPrice(normalizeMinValue(nextMin));
    },
    [maxPrice]
  );

  const handleSliderMaxChange = useCallback(
    (event) => {
      const raw = clampPrice(Number(event.target.value));
      const currentMin = minPrice === "" ? PRICE_MIN : Number(minPrice);
      const nextMax = Math.max(raw, currentMin);
      setMaxPrice(normalizeMaxValue(nextMax));
    },
    [minPrice]
  );

  const handleMinPriceInputChange = useCallback(
    (event) => {
      const rawValue = event.target.value;
      if (rawValue === "") {
        setMinPrice("");
        return;
      }
      const numeric = clampPrice(snapToStep(Number(rawValue)));
      const currentMax = maxPrice === "" ? PRICE_MAX : Number(maxPrice);
      const nextMin = Math.min(numeric, currentMax);
      setMinPrice(normalizeMinValue(nextMin));
      if (numeric > currentMax) {
        setMaxPrice(normalizeMaxValue(nextMin));
      }
    },
    [maxPrice]
  );

  const handleMaxPriceInputChange = useCallback(
    (event) => {
      const rawValue = event.target.value;
      if (rawValue === "") {
        setMaxPrice("");
        return;
      }
      const numeric = clampPrice(snapToStep(Number(rawValue)));
      const currentMin = minPrice === "" ? PRICE_MIN : Number(minPrice);
      const nextMax = Math.max(numeric, currentMin);
      setMaxPrice(normalizeMaxValue(nextMax));
      if (numeric < currentMin) {
        setMinPrice(normalizeMinValue(nextMax));
      }
    },
    [minPrice]
  );

  const handlePresetClick = useCallback(
    (preset) => {
      const currentMin = minPrice === "" ? PRICE_MIN : Number(minPrice);
      const currentMax = maxPrice === "" ? PRICE_MAX : Number(maxPrice);
      const isActive =
        currentMin === preset.min && currentMax === preset.max;

      if (isActive) {
        setMinPrice("");
        setMaxPrice("");
        return;
      }

      setMinPrice(normalizeMinValue(preset.min));
      setMaxPrice(normalizeMaxValue(preset.max));
    },
    [minPrice, maxPrice]
  );

  const handleClearPrice = useCallback(() => {
    setMinPrice("");
    setMaxPrice("");
  }, []);

  const handleReset = useCallback(() => {
    setQ("");
    setLocation("");
    setMinPrice("");
    setMaxPrice("");
    setBedrooms("");
    search({});
  }, [search]);

  useEffect(() => {
    search();
  }, [search]);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved, user?.id, user?.email]);

  useEffect(() => {
    const handler = () => refreshSaved();
    window.addEventListener("saved-properties:refresh", handler);
    return () => window.removeEventListener("saved-properties:refresh", handler);
  }, [refreshSaved]);

  return (
    <div className="properties-page">
      <h2 className="page-title">Homebuyer: Dashboard</h2>

      <div className="filters-row">
        <div className="card filters-card">
          <div className="card-body">
            <div className="form-grid">
              <div className="filter-field filter-field--wide">
                <label className="label">Search (title/location)</label>
                <div className="filter-field__control">
                  <SearchIcon className="filter-field__icon" aria-hidden="true" />
                  <input
                    className="input filter-field__input"
                    placeholder="e.g. Orchard condo"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                  />
                  {q && (
                    <button
                      type="button"
                      className="filter-field__clear"
                      onClick={handleSearchClear}
                      aria-label="Clear search"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="filter-field__hint">
                  Search by project name, neighbourhood, or postal code.
                </p>
              </div>
              <div className="filter-field filter-field--wide">
                <label className="label">Location</label>
                <div className="filter-field__control">
                  <MapPin className="filter-field__icon" aria-hidden="true" />
                  <input
                    className="input filter-field__input"
                    placeholder="Exact location or district"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                  />
                  {location && (
                    <button
                      type="button"
                      className="filter-field__clear"
                      onClick={handleLocationClear}
                      aria-label="Clear location"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="filter-field__hint">
                  Try HDB towns, MRT stations, or popular estates.
                </p>
              </div>
              <div className="full filter-field">
                <div className="price-filter">
                  <div className="price-filter__header">
                    <div>
                      <label className="label">Budget range</label>
                      <div className="price-filter__current">
                        <span>{displayMinBudget}</span>
                        <span className="price-filter__dash">to</span>
                        <span>{displayMaxBudget}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="price-filter__clear"
                      onClick={handleClearPrice}
                      disabled={minPrice === "" && maxPrice === ""}
                    >
                      Clear
                    </button>
                  </div>

                  <div
                    className="price-filter__slider"
                    style={{
                      "--min-percent": `${((normalizedMinPrice - PRICE_MIN) / PRICE_RANGE) * 100}%`,
                      "--max-percent": `${((normalizedMaxPrice - PRICE_MIN) / PRICE_RANGE) * 100}%`,
                    }}
                  >
                    <div className="price-filter__track" />
                    <input
                      type="range"
                      className="price-filter__range price-filter__range--min"
                      min={PRICE_MIN}
                      max={PRICE_MAX}
                      step={PRICE_STEP}
                      value={normalizedMinPrice}
                      onChange={handleSliderMinChange}
                    />
                    <input
                      type="range"
                      className="price-filter__range price-filter__range--max"
                      min={PRICE_MIN}
                      max={PRICE_MAX}
                      step={PRICE_STEP}
                      value={normalizedMaxPrice}
                      onChange={handleSliderMaxChange}
                    />
                  </div>

                  <div className="price-filter__inputs">
                    <div className="price-input">
                      <span className="price-input__label">Min</span>
                      <div className="price-input__field">
                        <span className="price-input__prefix">SGD</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={PRICE_MIN}
                          max={PRICE_MAX}
                          step={PRICE_STEP}
                          placeholder="Any"
                          className="input"
                          value={minPrice}
                          onChange={handleMinPriceInputChange}
                          onKeyDown={handleSearchKeyDown}
                        />
                      </div>
                    </div>
                    <div className="price-input">
                      <span className="price-input__label">Max</span>
                      <div className="price-input__field">
                        <span className="price-input__prefix">SGD</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={PRICE_MIN}
                          max={PRICE_MAX}
                          step={PRICE_STEP}
                          placeholder="Any"
                          className="input"
                          value={maxPrice}
                          onChange={handleMaxPriceInputChange}
                          onKeyDown={handleSearchKeyDown}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="price-filter__presets">
                    {PRICE_PRESETS.map((preset) => {
                      const isActive =
                        normalizedMinPrice === preset.min &&
                        normalizedMaxPrice === preset.max;
                      return (
                        <button
                          type="button"
                          key={preset.label}
                          className={`price-preset${isActive ? " is-active" : ""}`}
                          onClick={() => handlePresetClick(preset)}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="filter-field">
                <label className="label">Bedrooms</label>
                <div className="bedroom-filter">
                  <div className="bedroom-filter__chips">
                    {BEDROOM_PRESETS.map((preset) => {
                      const isActive = bedrooms === preset.value;
                      return (
                        <button
                          type="button"
                          key={preset.label}
                          className={`filter-chip${isActive ? " is-active" : ""}`}
                          onClick={() => handleBedroomPreset(preset.value)}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="bedroom-stepper">
                    <button
                      type="button"
                      className="bedroom-stepper__button"
                      onClick={() => handleBedroomStep("dec")}
                      disabled={bedroomDecreaseDisabled}
                      aria-label="Decrease bedrooms"
                    >
                      -
                    </button>
                    <div className="bedroom-stepper__value">
                      <Bed className="bedroom-stepper__icon" aria-hidden="true" />
                      <span className={bedroomStepperClass} aria-live="polite">
                        {bedroomStepperText}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="bedroom-stepper__button"
                      onClick={() => handleBedroomStep("inc")}
                      disabled={bedroomIncreaseDisabled}
                      aria-label="Increase bedrooms"
                    >
                      +
                    </button>
                  </div>
                </div>
                <p className="filter-field__hint">
                  Pick a quick option or fine-tune using the stepper.
                </p>
              </div>
            </div>

            <div className="mt-16 flex justify-end gap-8">
              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                className="btn btn-outline"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => search()}
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </div>

            {msg && (
              <div className="mt-16">
                <p className="muted-text">{msg}</p>
              </div>
            )}
          </div>
        </div>

        <aside className="card saved-card">
          <div className="card-header">Saved Properties</div>
          <div className="card-body">
            {saved.length === 0 ? (
              <p className="muted-text">Nothing saved yet.</p>
            ) : (
              <ul className="saved-list">
                {saved.map((entry) => (
                  <li key={entry.id}>
                    <div className="saved-info">
                      <Link to={`/properties/${entry.id}`}>{entry.title}</Link>
                      <div className="muted-text">
                        ${entry.price} - {entry.bedrooms} BR - {entry.location}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSaved(entry)}
                      disabled={savingId === entry.id}
                      className="saved-remove"
                    >
                      {savingId === entry.id ? "Removing..." : "Remove"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <div className="table-wrap mt-24">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Listing</th>
              <th>Price</th>
              <th>Bedrooms</th>
              <th>Location</th>
              <th className="actions-head">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(items || []).length > 0 ? (
              items.map((property) => {
                const isSaved = saved.some((entry) => entry.id === property.id);
                const busy = savingId === property.id;
                const previewPhoto = getPrimaryPhoto(property.photos);
                return (
                  <tr key={property.id}>
                    <td>{property.id}</td>
                    <td>
                      <Link
                        to={`/properties/${property.id}`}
                        className="listing-cell"
                      >
                        <div
                          className={`listing-thumb${
                            previewPhoto ? "" : " listing-thumb--empty"
                          }`}
                        >
                          {previewPhoto ? (
                            <img
                              src={previewPhoto}
                              alt={property.title}
                              loading="lazy"
                            />
                          ) : (
                            <ImageOff
                              className="listing-thumb__icon"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div className="listing-text">
                          <span className="listing-title">{property.title}</span>
                          <span className="listing-subtitle">
                            {property.location}
                          </span>
                        </div>
                      </Link>
                    </td>
                    <td>${property.price}</td>
                    <td>{property.bedrooms}</td>
                    <td>{property.location}</td>
                    <td className="actions-cell">
                      <div className="actions">
                        <Link
                          to={`/properties/${property.id}`}
                          className="btn btn-outline"
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          onClick={() => toggleSave(property)}
                          disabled={busy}
                          className="btn btn-primary"
                        >
                          {busy ? "Saving..." : isSaved ? "Saved" : "Save"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" className="empty">
                  No properties found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
