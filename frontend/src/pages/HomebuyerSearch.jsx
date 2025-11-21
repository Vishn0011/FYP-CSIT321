
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bed, ImageOff, MapPin, Search as SearchIcon, Heart, MessageSquare } from "lucide-react";
import api from "../api";
import { useAuth } from "../AuthContext";
import ChatModal from "../components/ChatModel";
import HomeownerPreferenceForm, {
  ensurePreferenceShape,
  buildFiltersFromPreferences,
} from "../components/HomeownerPreferenceForm";

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
const SEARCH_DEFAULT_LIMIT = 20;
const SUGGESTION_LIMIT = 8;
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

const getPrefPromptStorageKey = (userId) =>
  userId ? `homeowner-pref-prompt-dismissed:${userId}` : null;

const prioritizeWithPreferences = (list = [], prefs = {}) => {
  const preferredLocations = prefs?.locations || [];
  if (!preferredLocations.length) return list;
  return [...list].sort((a, b) => {
    const aPref = preferredLocations.some((loc) =>
      String(a || "").toLowerCase().includes(loc.toLowerCase())
    );
    const bPref = preferredLocations.some((loc) =>
      String(b || "").toLowerCase().includes(loc.toLowerCase())
    );
    if (aPref === bPref) return 0;
    return aPref ? -1 : 1;
  });
};

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

const formatPriceDisplay = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  return `$${numeric.toLocaleString("en-SG")}`;
};

const getStatusVariant = (status) => {
  if (!status) return "status-pill status-pill--muted";
  const normalized = String(status).toLowerCase();
  if (normalized === "contacted") return "status-pill status-pill--success";
  if (normalized === "pending") return "status-pill status-pill--pending";
  return "status-pill status-pill--info";
};

export default function HomebuyerSearch() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState({ titles: [], locations: [] });
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [locationFocused, setLocationFocused] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);

  const [preferences, setPreferences] = useState(null);
  const [prefDraft, setPrefDraft] = useState(() => ensurePreferenceShape());
  const [prefModalOpen, setPrefModalOpen] = useState(false);
  const [prefPromptDismissed, setPrefPromptDismissed] = useState(false);
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefError, setPrefError] = useState("");
  const prefInitRef = useRef(false);
  const [enquiries, setEnquiries] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [quickLocation, setQuickLocation] = useState("");
    const [quickArea, setQuickArea] = useState("");
    const [quickType, setQuickType] = useState("HDB");
    const [quickTenure, setQuickTenure] = useState("99-year Leasehold");

    const [quickLoading, setQuickLoading] = useState(false);
    const [quickError, setQuickError] = useState("");
    const [quickResult, setQuickResult] = useState(null);
    const quickInputRef = useRef(null);
    const [quickLat, setQuickLat] = useState(null);
    const [quickLng, setQuickLng] = useState(null);
    const [quickLease, setQuickLease] = useState("");
    const [quickFloor, setQuickFloor] = useState("");




  const isHomeowner = user?.role === "homeowner";
  const summaryBudget = preferences?.budget?.label || "Flexible budget";
  const summaryBedroom =
    !preferences?.bedrooms || preferences.bedrooms === "Any"
      ? "Any bedrooms"
      : `${preferences.bedrooms} BR`;
  const summaryLocation = preferences?.locations?.[0] || "All neighborhoods";

  const persistPrefPromptState = useCallback(
    (dismissed) => {
      if (typeof window === "undefined") return;
      const key = getPrefPromptStorageKey(user?.id);
      if (!key) return;
      if (dismissed) {
        window.sessionStorage.setItem(key, "true");
      } else {
        window.sessionStorage.removeItem(key);
      }
    },
    [user?.id]
  );

  // --- Suggestions: combined search box (title/location) ---
  useEffect(() => {
    if (!user) {
      setSearchSuggestions({ titles: [], locations: [] });
      return;
    }

    const term = q.trim();
    if (!searchFocused || term.length < 2) {
      setSearchSuggestions({ titles: [], locations: [] });
      return;
    }

    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      try {
        const { data } = await api.get("/homeowner/properties/suggest", {
          params: { q: term, limit: SUGGESTION_LIMIT },
          signal: controller.signal,
        });
        const titles = prioritizeWithPreferences(data?.titles || [], preferences);
        const locations = prioritizeWithPreferences(data?.locations || [], preferences);
        setSearchSuggestions({
          titles,
          locations,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Failed to fetch search suggestions", error);
        setSearchSuggestions({ titles: [], locations: [] });
      }
    }, 120);

    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [q, searchFocused, user, preferences]);

  // --- Suggestions: location box ---
  useEffect(() => {
    if (!user) {
      setLocationSuggestions([]);
      return;
    }

    const term = location.trim();
    if (!locationFocused || term.length < 2) {
      setLocationSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      try {
        const { data } = await api.get("/homeowner/properties/suggest", {
          params: { location: term, limit: SUGGESTION_LIMIT },
          signal: controller.signal,
        });
        const sortedLocations = prioritizeWithPreferences(data?.locations || [], preferences);
        setLocationSuggestions(sortedLocations);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Failed to fetch location suggestions", error);
        setLocationSuggestions([]);
      }
    }, 120);

    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [location, locationFocused, user, preferences]);

  const refreshSaved = useCallback(async () => {
    try {
      const { data } = await api.get("/homeowner/saved");
      setSaved(data?.items || []);
    } catch (_) {
      // keep search usable even if saved list fails
    }
  }, []);

  const fetchEnquiries = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await api.get(`/enquiries/buyer/${user.id}`);
      if (data?.ok) {
        const active = (data.enquiries || []).filter(
          (entry) => entry.status && entry.status.toLowerCase() === "contacted"
        );
        setEnquiries(active);
      }
    } catch (error) {
      console.error("Failed to fetch enquiries", error);
    }
  }, [user?.id]);

  const search = useCallback(
    async (options = {}) => {
      const { append = false, ...override } = options;
      setMsg("");

      const setBusy = append ? setLoadingMore : setLoading;
      setBusy(true);

      try {
        const nextPage = append ? pageRef.current + 1 : 1;
        const baseFilters = {
          q,
          location,
          minPrice,
          maxPrice,
          bedrooms,
          limit: SEARCH_DEFAULT_LIMIT,
          page: nextPage,
          ...override,
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
          const incoming = data.items || [];
          setHasMore(incoming.length === baseFilters.limit);
          pageRef.current = nextPage;
          setItems((prev) => {
            if (!append) {
              return incoming;
            }
            const seen = new Set(prev.map((item) => item.id));
            const merged = incoming.filter((item) => !seen.has(item.id));
            return [...prev, ...merged];
          });
        } else {
          if (!append) {
            setItems([]);
            setHasMore(false);
          }
          setMsg(data?.error || "Search failed");
        }
      } catch (_) {
        if (!append) {
          setItems([]);
          setHasMore(false);
        }
        setMsg("Network error");
      } finally {
        setBusy(false);
      }
    },
    [q, location, minPrice, maxPrice, bedrooms]
  );

  const applyPreferenceFilters = useCallback(
    (prefs, { runSearch = false, force = false } = {}) => {
      if (!prefs) return;
      const normalized = ensurePreferenceShape(prefs);
      const prefFilters = buildFiltersFromPreferences(normalized);
      const overrides = {};

      if (prefFilters.location && (force || !location)) {
        setLocation(prefFilters.location);
        overrides.location = prefFilters.location;
      } else if (force && !prefFilters.location && location) {
        setLocation("");
        overrides.location = "";
      }

      if (prefFilters.minPrice !== undefined && (force || minPrice === "")) {
        setMinPrice(prefFilters.minPrice);
        overrides.minPrice = prefFilters.minPrice;
      } else if (force && prefFilters.minPrice === undefined && minPrice !== "") {
        setMinPrice("");
        overrides.minPrice = "";
      }

      if (prefFilters.maxPrice !== undefined && (force || maxPrice === "")) {
        setMaxPrice(prefFilters.maxPrice);
        overrides.maxPrice = prefFilters.maxPrice;
      } else if (force && prefFilters.maxPrice === undefined && maxPrice !== "") {
        setMaxPrice("");
        overrides.maxPrice = "";
      }

      if (prefFilters.bedrooms && (force || bedrooms === "")) {
        setBedrooms(prefFilters.bedrooms);
        overrides.bedrooms = prefFilters.bedrooms;
      } else if (force && !prefFilters.bedrooms && bedrooms !== "") {
        setBedrooms("");
        overrides.bedrooms = "";
      }

      if (runSearch) {
        pageRef.current = 0;
        search({ ...overrides, page: 1 });
      }
    },
    [location, minPrice, maxPrice, bedrooms, search]
  );

  const loadPreferences = useCallback(
    async ({ apply = false, prompt = false } = {}) => {
      if (!isHomeowner) return;
      try {
        const { data } = await api.get("/homeowner/preferences");
        const prefData = data?.preferences ? ensurePreferenceShape(data.preferences) : null;
        if (prefData) {
          setPreferences(prefData);
          setPrefDraft(prefData);
          if (prefPromptDismissed) {
            setPrefPromptDismissed(false);
            persistPrefPromptState(false);
          }
          if (apply) {
            applyPreferenceFilters(prefData, { runSearch: true, force: true });
          }
        } else {
          setPreferences(null);
          setPrefDraft(ensurePreferenceShape());
          if (prompt && !prefPromptDismissed) {
            setPrefPromptDismissed(true);
            persistPrefPromptState(true);
            setPrefModalOpen(true);
          }
        }
      } catch (error) {
        console.error("Failed to load homeowner preferences", error);
      }
    },
    [isHomeowner, prefPromptDismissed, applyPreferenceFilters, persistPrefPromptState]
  );

  const handleOpenPreferenceModal = () => {
    setPrefDraft(ensurePreferenceShape(preferences || prefDraft));
    setPrefError("");
    setPrefModalOpen(true);
  };

  const handlePreferenceSave = useCallback(
    async (draft) => {
      setPrefError("");
      setPrefSaving(true);
      try {
        const { data } = await api.put("/homeowner/preferences", { preferences: draft });
        const normalized = ensurePreferenceShape(data?.preferences || draft);
        setPreferences(normalized);
        setPrefDraft(normalized);
        setPrefModalOpen(false);
        setPrefPromptDismissed(false);
        persistPrefPromptState(false);
        applyPreferenceFilters(normalized, { runSearch: true, force: true });
        window.dispatchEvent(new Event("homeowner-preferences:updated"));
      } catch (error) {
        const message = error?.response?.data?.error || "Unable to save preferences";
        setPrefError(message);
      } finally {
        setPrefSaving(false);
      }
    },
    [applyPreferenceFilters, persistPrefPromptState]
  );

  const handlePreferenceSkip = useCallback(() => {
    setPrefModalOpen(false);
    setPrefPromptDismissed(true);
    persistPrefPromptState(true);
  }, [persistPrefPromptState]);

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

  const getEnquiryForProperty = useCallback(
    (propertyId) => {
      if (!propertyId) return null;
      return (
        enquiries.find(
          (entry) => `${entry.property_id}` === `${propertyId}`
        ) || null
      );
    },
    [enquiries]
  );

  const handleOpenChat = useCallback(
    (propertyId) => {
      const enquiry = getEnquiryForProperty(propertyId);
      if (
        enquiry &&
        enquiry.status &&
        enquiry.status.toLowerCase() === "contacted"
      ) {
        setActiveChat(enquiry);
      }
    },
    [getEnquiryForProperty]
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
  const handleSearchSuggestionSelect = useCallback((value) => {
    setQ(value);
    setSearchFocused(false);
  }, []);
  const handleSearchLocationSelect = useCallback((value) => {
    setLocation(value);
    setSearchFocused(false);
  }, []);
  const handleLocationSuggestionSelect = useCallback((value) => {
    setLocation(value);
    setLocationFocused(false);
  }, []);

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

  const hasSearchSuggestions =
    (searchSuggestions?.titles?.length || 0) +
      (searchSuggestions?.locations?.length || 0) >
    0;
  const hasLocationSuggestions = locationSuggestions.length > 0;

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
    setHasMore(false);
    pageRef.current = 0;
    search({ page: 1 });
  }, [search]);

  useEffect(() => {
    search();
  }, [search]);

  useEffect(() => {
    if (!isHomeowner) return;
    refreshSaved();
  }, [refreshSaved, isHomeowner, user?.id, user?.email]);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);

  useEffect(() => {
    const handler = () => refreshSaved();
    window.addEventListener("saved-properties:refresh", handler);
    return () => window.removeEventListener("saved-properties:refresh", handler);
  }, [refreshSaved]);

  useEffect(() => {
    prefInitRef.current = false;
    if (typeof window === "undefined") {
      setPrefPromptDismissed(false);
      return;
    }
    const key = getPrefPromptStorageKey(user?.id);
    if (!key) {
      setPrefPromptDismissed(false);
      return;
    }
    const storedValue = window.sessionStorage.getItem(key) === "true";
    setPrefPromptDismissed(storedValue);
  }, [user?.id]);

  useEffect(() => {
    if (!isHomeowner || prefInitRef.current) return;
    prefInitRef.current = true;
    loadPreferences({ apply: true, prompt: true });
  }, [isHomeowner, loadPreferences]);

  useEffect(() => {
    if (!isHomeowner) return;
    const handler = () => loadPreferences({ apply: true });
    window.addEventListener("homeowner-preferences:updated", handler);
    return () => window.removeEventListener("homeowner-preferences:updated", handler);
  }, [isHomeowner, loadPreferences]);

    /*google auto complete for quick location input*/
    useEffect(() => {
        if (!window.google) return;

        const input = quickInputRef.current;
        if (!input) return;

        // Prevent double initialization
        if (input._autocompleteAttached) return;
        input._autocompleteAttached = true;

        const autocomplete = new window.google.maps.places.Autocomplete(input, {
            componentRestrictions: { country: "sg" },
            fields: ["formatted_address", "geometry"],
        });

        autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (!place.geometry) {
                setQuickError("Invalid address. Please select from dropdown.");
                return;
            }
            setQuickLocation(place.formatted_address);
            setQuickLat(place.geometry.location.lat());
            setQuickLng(place.geometry.location.lng());
            setQuickError("");
        });

    }, []);

    /*Quick Validation Price for location input*/

    const handleQuickValuation = async () => {
        setQuickError("");
        setQuickResult(null);

        if (!quickLocation || !quickArea) {
            setQuickError("Please enter location and floor area.");
            return;
        }
        if (!quickLat || !quickLng) {
            setQuickError("Please choose a valid address from Google autocomplete.");
            return;
        }

        setQuickLoading(true);

        try {
            // 1️⃣ GEO ANALYSIS
            const geoRes = await api.post("/geo/analyze", {
                latitude: quickLat,
                longitude: quickLng,
            });
            const geo = geoRes.data;

            // 2️⃣ CLEAN PAYLOAD (MUST MATCH Add Property EXACTLY)
            const payload = {
                // --- Fields from Form ---
                size: Number(quickArea), // <-- EDITED: Match 'size' (sqft) field from AddProperties
                property_type: quickType,
                tenure: quickTenure,
                remaining_lease: Number(quickLease) || null, // <-- EDITED: Ensured it's a number

                // --- Fields from Geo ---
                region: geo.region,
                latitude: quickLat,
                longitude: quickLng,
                nearest_mrt_km: geo.nearest_mrt_km,
                nearest_mall_km: geo.nearest_mall_km,
                nearest_school_km: geo.nearest_school_km,
                nearest_hospital_km: geo.nearest_hospital_km,
                nearest_park_km: geo.nearest_park_km,
                nearest_business_km: geo.nearest_business_km, // <-- ADDED: This was missing

                // --- Scores from Geo ---
                amenity_score: geo.amenity_score,
                health_score: geo.health_score, // <-- ADDED: This was missing
                green_score: geo.green_score, // <-- ADDED: This was missing
                business_access_score: geo.business_access_score, // <-- ADDED: This was missing

                // --- IDs ---
                property_id: null,
                user_id: user?.id || null,
            };


            // 4️⃣ QUICK PREDICT
            const res = await api.post("/predict/current/quick", payload);
            setQuickResult(res.data);

        } catch (err) {
            console.error("Quick valuation error:", err);
            setQuickError("Failed to calculate valuation.");
        } finally {
            setQuickLoading(false);
        }
    };

  return (
    <div className="properties-page">
      <div className="page-header">
        <h2 className="page-title">Homebuyer: Dashboard</h2>
        {isHomeowner && (
          <button type="button" className="link-button" onClick={handleOpenPreferenceModal}>
            {preferences ? "Update preferences" : "Set preferences"}
          </button>
        )}
      </div>

      {preferences && (
        <div className="pref-summary card">
          <div className="card-body">
            <p className="pref-summary__title">Personalized for you</p>
            <p className="pref-summary__details">
              {summaryBudget} · {summaryBedroom} · {summaryLocation}
            </p>
          </div>
        </div>
      )}

      <div className="filters-row">
        <div className="card filters-card">
          <div className="card-body">
            <div className="form-grid">
              <div className="filter-field filter-field--wide">
                <label className="label">Search (title/location)</label>
                <div className="filter-field__control autocomplete">
                  <SearchIcon className="filter-field__icon" aria-hidden="true" />
                  <input
                    className="input filter-field__input"
                    placeholder="e.g. Orchard condo"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
                    autoComplete="off"
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
                  {searchFocused && hasSearchSuggestions && (
                    <div className="autocomplete__menu">
                      {searchSuggestions?.titles?.length > 0 && (
                        <div className="autocomplete__section">
                          <p className="autocomplete__label">Projects &amp; titles</p>
                          {searchSuggestions.titles.map((item) => (
                            <button
                              key={`title-${item}`}
                              type="button"
                              className="autocomplete__item"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleSearchSuggestionSelect(item)}
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      )}
					          {searchSuggestions?.locations?.length > 0 && (
                        <div className="autocomplete__section">
                          <p className="autocomplete__label">Locations</p>
                          {searchSuggestions.locations.map((item) => (
                            <button
                              key={`loc-${item}`}
                              type="button"
                              className="autocomplete__item"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleSearchLocationSelect(item)}
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="filter-field__hint">
                  Search by project name, neighbourhood, or postal code.
                </p>
              </div>
              <div className="filter-field filter-field--wide">
                <label className="label">Location</label>
                <div className="filter-field__control autocomplete">
                  <MapPin className="filter-field__icon" aria-hidden="true" />
                  <input
                    className="input filter-field__input"
                    placeholder="Exact location or district"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    onFocus={() => setLocationFocused(true)}
                    onBlur={() => window.setTimeout(() => setLocationFocused(false), 120)}
                    autoComplete="off"
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
                  {locationFocused && hasLocationSuggestions && (
                    <div className="autocomplete__menu">
                      {locationSuggestions.map((item) => (
                        <button
                          key={`loc-only-${item}`}
                          type="button"
                          className="autocomplete__item"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleLocationSuggestionSelect(item)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
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
              </aside> {/* <-- Saved Properties card ends here */}

              {/* ⭐ QUICK AI HOME VALUATION (using /predict/current/quick) */}
              {/* This is now a separate card with margin-top (mt-8) for spacing */}
              <div className="card mt-8">
                  <div className="card-header">Quick AI Home Valuation</div>
                  <div className="card-body p-6">
                      <div className="grid grid-cols-1 gap-6">
                          {/* Location */}
                          <div>
                              <label className="label">Location</label>
                              <input
                                  ref={quickInputRef}
                                  className="input"
                                  placeholder="e.g. 10A Segar Road"
                                  value={quickLocation}
                                  onChange={(e) => setQuickLocation(e.target.value)}
                              />
                          </div>

                          {/* Floor Area (sqft) */}
                          <div>
                              <label className="label">Floor Area (sqFT)</label>
                              <input
                                  className="input"
                                  type="number"
                                  placeholder="e.g. 1020"
                                  value={quickArea}
                                  onChange={(e) => setQuickArea(e.target.value)}
                              />
                          </div>

                          {/* Property Type */}
                          <div>
                              <label className="label">Property Type</label>
                              <select
                                  className="input"
                                  value={quickType}
                                  onChange={(e) => setQuickType(e.target.value)}
                              >
                                  <option value="HDB">HDB</option>
                                  <option value="Condominium">Condominium</option>
                                  M       <option value="Landed">Landed</option>
                              </select>
                          </div>

                          {/* Tenure */}
                          <div>
                              <label className="label">Tenure</label>
                              <select
                                  className="input"
                                  value={quickTenure}
                                  onChange={(e) => setQuickTenure(e.target.value)}
                              >
                                  <option value="99-year Leasehold">99-year Leasehold</option>
                                  <option value="999-year Leasehold">999-year Leasehold</option>
                                  <option value="Freehold">Freehold</option>
                              </select>
                          </div>

                          {/* Remaining Lease */}
                          <div>
                              <label className="label">Remaining Lease (years)</label>
                              <input
                                  className="input"
                                  type="number"
                                  placeholder="e.g. 74"
                                  value={quickLease}
                                  onChange={(e) => setQuickLease(e.target.value)}
                              />
                          </div>
                      </div>

                      {/* BUTTON */}
                      <button
                          className="btn btn-primary mt-8 w-full"
                          disabled={quickLoading}
                          onClick={handleQuickValuation}
                      >
                          {quickLoading ? "Estimating..." : "Get Instant Valuation"}
                      </button>

                      {/* ERRORS */}
                      {quickError && (
                          <p className="mt-4 text-red-500">{quickError}</p>
                      )}

                      {/* RESULTS */}
                      {quickResult && (
                          <div className="mt-8 p-6 bg-green-50 border border-green-300 rounded-xl">
                              <h4 className="text-xl font-bold text-green-700 mb-2">
                                  Estimated Value: ${quickResult.predicted_total_price.toLocaleString()}
                              </h4>

                              <p className="text-gray-700">
                                  Confidence: {quickResult.confidence_low.toLocaleString()} –{" "}
                                  {quickResult.confidence_high.toLocaleString()}
                              </p>

                              <p className="text-sm mt-2 text-green-600">
                                  AI Confidence Score: {quickResult.confidence_score}%
                              </p>
                          </div>
                      )}
                  </div>
              </div>
          </div>

      <div className="property-grid mt-24">
        {(items || []).length > 0 ? (
          <div className="property-grid__list">
            {items.map((property) => {
              const isSaved = saved.some((entry) => entry.id === property.id);
              const busy = savingId === property.id;
              const previewPhoto = getPrimaryPhoto(property.photos);
              const enquiry = getEnquiryForProperty(property.id);
              const status = enquiry?.status;
              const statusClass = getStatusVariant(status);
              const isContacted =
                status && status.toLowerCase() === "contacted";

              return (
                <article className="property-card" key={property.id}>
                  <Link
                    to={`/properties/${property.id}`}
                    className={`property-card__media${
                      previewPhoto ? "" : " property-card__media--empty"
                    }`}
                  >
                    {previewPhoto ? (
                      <img
                        src={previewPhoto}
                        alt={property.title}
                        loading="lazy"
                      />
                    ) : (
                      <ImageOff className="property-card__media-icon" aria-hidden="true" />
                    )}
                  </Link>
                  <div className="property-card__body">
                    <div className="property-card__header">
                      <div>
                        <p className="property-card__title">{property.title}</p>
                        <p className="property-card__location">
                          <MapPin size={14} aria-hidden="true" />
                          <span>{property.location || "—"}</span>
                        </p>
                      </div>
                      <p className="property-card__price">
                        {formatPriceDisplay(property.price)}
                      </p>
                    </div>
                    <div className="property-card__meta">
                      <span>{property.bedrooms || "—"} BR</span>
                      <span>ID #{property.id}</span>
                    </div>
                    <div className="property-card__status">
                      <span className={statusClass}>
                        {status || "No enquiry yet"}
                      </span>
                      {enquiry?.agent_name && (
                        <span className="property-card__agent">
                          Agent {enquiry.agent_name}
                        </span>
                      )}
                    </div>
                    <div className="property-card__actions">
                      <Link to={`/properties/${property.id}`} className="btn btn-outline">
                        View Details
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggleSave(property)}
                        disabled={busy}
                        className={`btn btn-primary${isSaved ? " is-saved" : ""}`}
                      >
                        {busy ? (
                          "Saving..."
                        ) : (
                          <>
                            <Heart size={14} aria-hidden="true" />
                            <span>{isSaved ? "Saved" : "Save"}</span>
                          </>
                        )}
                      </button>
                      {isContacted && (
                        <button
                          type="button"
                          className="btn btn-outline chat-btn"
                          onClick={() => handleOpenChat(property.id)}
                        >
                          <MessageSquare size={14} aria-hidden="true" />
                          <span>Chat</span>
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="card empty-card">
            <p className="empty">No properties found</p>
          </div>
        )}
      </div>

      {hasMore && (items || []).length > 0 && (
        <div className="load-more">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => search({ append: true })}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading..." : "Load more results"}
          </button>
        </div>
      )}

      {activeChat && (
        <ChatModal
          enquiry={activeChat}
          user={user}
          onClose={() => setActiveChat(null)}
        />
      )}

      {prefModalOpen && (
        <div className="pref-modal">
          <div className="pref-modal__panel">
            <div className="pref-modal__header">
              <h3>Help us tailor your dashboard</h3>
              <button type="button" className="link-button" onClick={handlePreferenceSkip}>
                Close
              </button>
            </div>
            {prefError && <div className="alert alert-error">{prefError}</div>}
            <HomeownerPreferenceForm
              value={prefDraft}
              onChange={setPrefDraft}
              onSubmit={handlePreferenceSave}
              submitting={prefSaving}
              onCancel={handlePreferenceSkip}
              showHeader={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
