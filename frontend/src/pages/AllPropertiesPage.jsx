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

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">All Properties</h1>
                <p className="text-gray-600">
                    Browse all active listings from our verified agents
                </p>
            </div>

            {properties.length === 0 ? (
                <p className="text-center text-gray-500">No properties available right now.</p>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {properties.map((p) => (
                        <div
                            key={p.id}
                            className="bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden"
                        >
                            {/* Photo */}
                            {p.photos && p.photos.length > 0 && (
                                <img
                                    src={JSON.parse(p.photos)[0]} // first image from photos array
                                    alt={p.title}
                                    className="w-full h-48 object-cover"
                                />
                            )}

                            {/* Content */}
                            <div className="p-4 space-y-2">
                                <h2 className="text-lg font-semibold">{p.title}</h2>
                                <p className="text-gray-500">{p.location}</p>
                                <p className="text-emerald-700 font-bold">SGD {p.price}</p>

                                <div className="text-sm text-gray-600 flex gap-4 mt-2">
                                    <span>{p.bedrooms} Bedrooms</span>
                                    <span>{p.bathrooms} Bathrooms</span>
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
                    ))}
                </div>
            )}
        </div>
    );
}
