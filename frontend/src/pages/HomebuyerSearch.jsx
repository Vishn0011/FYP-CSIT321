import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

export default function HomebuyerSearch() {
    const [q, setQ] = useState("");
    const [location, setLocation] = useState("");
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");
    const [bedrooms, setBedrooms] = useState("");
    const [items, setItems] = useState([]);
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(false);

    async function search() {
        setMsg("");
        setLoading(true);
        try {
            const params = {
                ...(q && { q }),
                ...(location && { location }),
                ...(minPrice && { min_price: minPrice }),
                ...(maxPrice && { max_price: maxPrice }),
                ...(bedrooms && { bedrooms }),
            };
            const { data } = await api.get("/homeowner/properties", { params });
            if (data?.success) {
                setItems(data.items || []);
            } else {
                setMsg(data?.error || "Search failed");
            }
        } catch (e) {
            setMsg("Network error");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        search(); // initial load
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="properties-page">
            <h2 className="page-title">Homebuyer: Dashboard</h2>

            {/* Search form */}
            <div className="card mb-12">
                <div className="card-body">
                    <div className="form-grid">
                        <div>
                            <label className="label">Search (title/location)</label>
                            <input
                                className="input"
                                placeholder="e.g. Orchard condo"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Location</label>
                            <input
                                className="input"
                                placeholder="Exact location"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Min price</label>
                            <input
                                type="number"
                                className="input"
                                value={minPrice}
                                onChange={(e) => setMinPrice(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Max price</label>
                            <input
                                type="number"
                                className="input"
                                value={maxPrice}
                                onChange={(e) => setMaxPrice(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Bedrooms</label>
                            <input
                                type="number"
                                className="input"
                                value={bedrooms}
                                onChange={(e) => setBedrooms(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="mt-16 flex justify-end">
                        <button
                            onClick={search}
                            disabled={loading}
                            className="btn btn-primary"
                        >
                            {loading ? "Searching…" : "Search"}
                        </button>
                    </div>

                    {msg && (
                        <div className="mt-16">
                            <p className="muted-text">{msg}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Results table */}
            <div className="table-wrap">
                <table className="table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Title</th>
                            <th>Price</th>
                            <th>Bedrooms</th>
                            <th>Location</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(items || []).length > 0 ? (
                            items.map((p) => (
                                <tr key={p.id}>
                                    <td>{p.id}</td>
                                    <td>
                                        <Link to={`/properties/${p.id}`}>{p.title}</Link>
                                    </td>
                                    <td>${p.price}</td>
                                    <td>{p.bedrooms}</td>
                                    <td>{p.location}</td>
                                    <td className="flex gap-8">
                                        <Link to={`/properties/${p.id}`} className="btn btn-outline">
                                            View
                                        </Link>
                                        <button
                                            onClick={() => alert("Save not implemented")}
                                            className="btn btn-primary"
                                        >
                                            Save ♥
                                        </button>
                                    </td>
                                </tr>
                            ))
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
