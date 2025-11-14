import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

export default function AllPropertiesPage() {
    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/properties/all")
            .then((res) => setProperties(res.data || []))
            .catch((err) => console.error("Failed to load properties", err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="p-6 text-center">Loading properties...</div>;
    }

    const getFirstPhoto = (photos) => {
        try {
            // Case 1: photos is JSON string (e.g. '["url1", "url2"]')
            if (typeof photos === "string" && photos.startsWith("[")) {
                const parsed = JSON.parse(photos);
                return parsed?.[0];
            }
            // Case 2: photos is already an array
            if (Array.isArray(photos)) {
                return photos[0];
            }
            // Case 3: direct data URL or single string
            if (typeof photos === "string" && photos.startsWith("data:image")) {
                return photos;
            }
            return null;
        } catch {
            return null;
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">All Properties</h1>
                <p className="text-gray-600">
                    Browse all active listings from our verified agents
                </p>
            </div>

            {properties.length === 0 ? (
                <p className="text-center text-gray-500">
                    No properties available right now.
                </p>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {properties.map((p) => {
                        const photo = getFirstPhoto(p.photos);

                        return (
                            <div
                                key={p.id}
                                className="bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden"
                            >
                                {/* --- Property Image --- */}
                                {photo ? (
                                    <img
                                        src={photo.startsWith("http") || photo.startsWith("data:image")
                                            ? photo
                                            : `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}${photo}`
                                        }
                                        alt={p.title}
                                        className="w-full h-48 object-cover"
                                        onError={(e) => {
                                            e.target.src = "/placeholder.jpg";
                                            e.target.style.opacity = 0.7;
                                        }}
                                    />
                                ) : (
                                    <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-500 text-sm">
                                        No photo
                                    </div>
                                )}

                                {/* --- Property Content --- */}
                                <div className="p-4 space-y-2">
                                    <h2 className="text-lg font-semibold line-clamp-1">{p.title}</h2>
                                    <p className="text-gray-500 line-clamp-1">{p.location}</p>
                                    <p className="text-emerald-700 font-bold">
                                        SGD {p.price?.toLocaleString()}
                                    </p>

                                    <div className="text-sm text-gray-600 flex gap-4 mt-2">
                                        <span>{p.bedrooms} Bed</span>
                                        <span>{p.bathrooms} Bath</span>
                                        <span>{p.size} sqft</span>
                                    </div>

                                    <div className="mt-4">
                                        <Link
                                            to={`/explore/properties/${p.id}`}
                                            className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                                        >
                                            View Details
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
