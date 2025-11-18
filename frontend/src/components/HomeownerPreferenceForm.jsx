import { useMemo, useState } from "react";

const buildDefaultPreferences = () => ({
    intent: "",
    budget: { label: "", min: null, max: null },
    bedrooms: "",
    locations: [],
    amenities: [],
    notes: "",
});

export const PREFERENCE_DEFAULTS = buildDefaultPreferences();

const INTENT_OPTIONS = [
    "Actively searching",
    "Exploring options",
    "Just browsing",
];

const BEDROOM_OPTIONS = ["Any", "1", "2", "3", "4", "5+"];

export const BUDGET_PRESETS = [
    { label: "Under $500k", min: 0, max: 500000 },
    { label: "$500k - $1M", min: 500000, max: 1000000 },
    { label: "$1M - $1.5M", min: 1000000, max: 1500000 },
    { label: "$1.5M - $2M", min: 1500000, max: 2000000 },
    { label: "$2M+", min: 2000000, max: 5000000 },
];

const POPULAR_LOCATIONS = [
    "Central / CBD",
    "Near MRT",
    "East Coast",
    "North-East",
    "Jurong",
    "Woodlands",
];

const AMENITY_CHOICES = [
    "Near schools",
    "Near parks",
    "Family friendly",
    "High floor",
    "Move-in ready",
];

export function ensurePreferenceShape(raw) {
    if (!raw) {
        return buildDefaultPreferences();
    }

    const locations = Array.isArray(raw.locations)
        ? raw.locations.filter(Boolean).map((item) => `${item}`.trim()).filter(Boolean).slice(0, 5)
        : [];
    const amenities = Array.isArray(raw.amenities)
        ? raw.amenities.filter(Boolean).map((item) => `${item}`.trim()).filter(Boolean).slice(0, 6)
        : [];

    return {
        intent: (raw.intent || "").trim(),
        budget: {
            label: (raw.budget?.label || "").trim(),
            min: typeof raw.budget?.min === "number" ? raw.budget.min : raw.budget?.min ?? null,
            max: typeof raw.budget?.max === "number" ? raw.budget.max : raw.budget?.max ?? null,
        },
        bedrooms: (raw.bedrooms || "").trim(),
        locations,
        amenities,
        notes: (raw.notes || "").trim(),
    };
}

export function buildFiltersFromPreferences(preferences) {
    const normalized = ensurePreferenceShape(preferences);
    const filters = {};
    const firstLocation = normalized.locations[0];
    if (firstLocation) filters.location = firstLocation;
    if (normalized.bedrooms && normalized.bedrooms !== "Any") filters.bedrooms = normalized.bedrooms.replace("+", "");
    if (normalized.budget?.min !== null && normalized.budget?.min !== undefined)
        filters.minPrice = Number(normalized.budget.min);
    if (normalized.budget?.max !== null && normalized.budget?.max !== undefined)
        filters.maxPrice = Number(normalized.budget.max);
    return filters;
}

function toggleValue(list, value, maxItems = 5) {
    const next = Array.isArray(list) ? [...list] : [];
    const index = next.findIndex((item) => item === value);
    if (index > -1) {
        next.splice(index, 1);
    } else {
        if (next.length >= maxItems) {
            next.shift();
        }
        next.push(value);
    }
    return next;
}

export default function HomeownerPreferenceForm({
    value,
    onChange,
    onSubmit,
    submitting = false,
    submitLabel = "Save preferences",
    onCancel,
    showHeader = true,
}) {
    const pref = useMemo(() => ensurePreferenceShape(value), [value]);
    const [customLocation, setCustomLocation] = useState("");

    const emitChange = (patch, replace = false) => {
        if (typeof onChange === "function") {
            onChange(replace ? ensurePreferenceShape(patch) : { ...pref, ...patch });
        }
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        if (typeof onSubmit === "function") {
            onSubmit(pref);
        }
    };

    const handleCustomLocationAdd = () => {
        const next = customLocation.trim();
        if (!next) return;
        emitChange({ locations: toggleValue(pref.locations, next, 5) });
        setCustomLocation("");
    };

    const handleLocationRemove = (location) => {
        emitChange({ locations: pref.locations.filter((item) => item !== location) });
    };

    const handleLocationsClear = () => {
        emitChange({ locations: [] });
    };

    const handleReset = () => {
        setCustomLocation("");
        emitChange(buildDefaultPreferences(), true);
    };

    return (
        <form className="pref-form" onSubmit={handleSubmit}>
            {showHeader && (
                <header className="pref-header">
                    <h3>Tell us about your ideal home</h3>
                    <p>We use these answers to highlight the most relevant listings for you.</p>
                </header>
            )}

            <div className="pref-section">
                <p className="pref-label">Where are you in your buying journey?</p>
                <div className="pref-chip-group">
                    {INTENT_OPTIONS.map((option) => (
                        <button
                            key={option}
                            type="button"
                            className={`pref-chip${pref.intent === option ? " is-active" : ""}`}
                            onClick={() => emitChange({ intent: pref.intent === option ? "" : option })}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            </div>

            <div className="pref-section">
                <p className="pref-label">Budget comfort zone</p>
                <div className="pref-chip-group">
                    {BUDGET_PRESETS.map((preset) => (
                        <button
                            key={preset.label}
                            type="button"
                            className={`pref-chip${pref.budget?.label === preset.label ? " is-active" : ""}`}
                            onClick={() =>
                                emitChange({ budget: { label: preset.label, min: preset.min, max: preset.max } })
                            }
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="pref-section">
                <p className="pref-label">Preferred bedrooms</p>
                <div className="pref-chip-group">
                    {BEDROOM_OPTIONS.map((option) => (
                        <button
                            key={option}
                            type="button"
                            className={`pref-chip${pref.bedrooms === option ? " is-active" : ""}`}
                            onClick={() => emitChange({ bedrooms: pref.bedrooms === option ? "" : option })}
                        >
                            {option === "Any" ? "Any" : `${option} BR`}
                        </button>
                    ))}
                </div>
            </div>

            <div className="pref-section">
                <p className="pref-label">Locations that excite you</p>
                <div className="pref-chip-group">
                    {POPULAR_LOCATIONS.map((location) => (
                        <button
                            key={location}
                            type="button"
                            className={`pref-chip${pref.locations.includes(location) ? " is-active" : ""}`}
                            onClick={() => emitChange({ locations: toggleValue(pref.locations, location, 5) })}
                        >
                            {location}
                        </button>
                    ))}
                </div>
                {pref.locations.length > 0 && (
                    <div className="pref-chip-group pref-chip-group--selected">
                        {pref.locations.map((location) => (
                            <button
                                key={location}
                                type="button"
                                className="pref-chip is-active pref-chip--removable"
                                onClick={() => handleLocationRemove(location)}
                            >
                                <span>{location}</span>
                                <span className="pref-chip__remove" aria-hidden="true">
                                    &times;
                                </span>
                                <span className="sr-only">Remove {location}</span>
                            </button>
                        ))}
                        {pref.locations.length > 1 && (
                            <button type="button" className="pref-chip pref-chip--muted" onClick={handleLocationsClear}>
                                Clear all
                            </button>
                        )}
                    </div>
                )}
                <div className="pref-inline-form">
                    <input
                        type="text"
                        className="input"
                        placeholder="Add a custom neighbourhood"
                        value={customLocation}
                        onChange={(e) => setCustomLocation(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                handleCustomLocationAdd();
                            }
                        }}
                    />
                    <button type="button" className="btn btn-outline" onClick={handleCustomLocationAdd}>
                        Add
                    </button>
                </div>
            </div>

            <div className="pref-section">
                <p className="pref-label">Helpful must-haves</p>
                <div className="pref-chip-group">
                    {AMENITY_CHOICES.map((amenity) => (
                        <button
                            key={amenity}
                            type="button"
                            className={`pref-chip${pref.amenities.includes(amenity) ? " is-active" : ""}`}
                            onClick={() => emitChange({ amenities: toggleValue(pref.amenities, amenity, 6) })}
                        >
                            {amenity}
                        </button>
                    ))}
                </div>
            </div>

            <div className="pref-section">
                <label className="pref-label" htmlFor="pref-notes">
                    Anything else we should know? <span className="optional">(optional)</span>
                </label>
                <textarea
                    id="pref-notes"
                    className="textarea"
                    rows={3}
                    placeholder="e.g. Prefer move-in ready units with minimal renovation"
                    value={pref.notes}
                    onChange={(e) => emitChange({ notes: e.target.value })}
                />
            </div>

            <div className="pref-actions">
                <button type="button" className="btn btn-outline" onClick={handleReset} disabled={submitting}>
                    Reset to defaults
                </button>
                {onCancel && (
                    <button type="button" className="btn btn-outline" onClick={onCancel}>
                        Maybe later
                    </button>
                )}
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? "Saving..." : submitLabel}
                </button>
            </div>
        </form>
    );
}
