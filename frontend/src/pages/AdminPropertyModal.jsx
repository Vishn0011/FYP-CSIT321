import { useEffect, useState } from "react";
import api from "../api";
import {
    MapPin, ShieldCheck, History, Train, ShoppingCart, School, Hospital, Trees, Briefcase
} from "lucide-react";

export default function AdminPropertyModal({ property, onClose, onApprove }) {

    const [current, setCurrent] = useState(null);
    const [future, setFuture] = useState(null);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        if (!property) return;

        // --- Fetch CURRENT market prediction ---
        api.post("/predict/current", {
            floor_area_sqm: property.floor_area_sqm,
            region: property.region,
            property_type: property.property_type,
            latitude: property.latitude,
            longitude: property.longitude
        }).then(res => {
            setCurrent(res.data);
        });

        // --- Fetch FUTURE prediction ---
        api.post("/predict/future", {
            floor_area_sqm: property.floor_area_sqm,
            region: property.region,
            property_type: property.property_type,
            latitude: property.latitude,
            longitude: property.longitude
        }).then(res => {
            setFuture(res.data);
        });

        // --- Fetch 1km prediction history ---
        api.post("/predict/history/nearby", {
            latitude: property.latitude,
            longitude: property.longitude
        }).then(res => {
            setHistory(res.data.history || []);
        });

    }, [property]);


    const ProximityItem = ({ icon: Icon, label, name, distance }) => {
        if (!name || !distance) return null;
        return (
            <div className="flex items-start gap-3">
                <Icon className="w-5 h-5 text-emerald-600 mt-1" />
                <div>
                    <span className="font-semibold">{label}</span>
                    <p className="text-gray-600 text-sm">{name} ({distance} km)</p>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-[750px] max-h-[90vh] overflow-y-auto">

                <h2 className="text-xl font-bold mb-4">📊 AI Market Evaluation</h2>

                {/* CURRENT PRICE */}
                {current ? (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-4">
                        <h3 className="text-lg font-semibold text-emerald-800 mb-2">Current Market Price</h3>
                        <p className="text-3xl font-bold text-emerald-900">
                            ${Number(current.predicted_current).toLocaleString()}
                        </p>

                        {current.confidence_low && current.confidence_high && (
                            <p className="mt-1 text-gray-700">
                                95% range: ${Number(current.confidence_low).toLocaleString()} – $
                                {Number(current.confidence_high).toLocaleString()}
                            </p>
                        )}
                    </div>
                ) : (
                    <p className="text-gray-400 italic mb-4">Loading current prediction...</p>
                )}

                {/* FUTURE PRICE */}
                {future ? (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
                        <h3 className="text-lg font-semibold text-blue-800 mb-2">Future Price Forecast</h3>
                        <p className="text-3xl font-bold text-blue-900">
                            ${Number(future.predicted_total_price).toLocaleString()}
                        </p>

                        {future.confidence_low && future.confidence_high && (
                            <p className="mt-1 text-gray-700">
                                95% range: ${Number(future.confidence_low).toLocaleString()} – $
                                {Number(future.confidence_high).toLocaleString()}
                            </p>
                        )}
                    </div>
                ) : (
                    <p className="text-gray-400 italic mb-4">Loading future forecast...</p>
                )}

                {/* LOCATION AMENITIES */}
                <div className="bg-white border rounded-xl p-4 mb-4">
                    <h3 className="text-lg font-semibold text-emerald-700 mb-3 flex items-center gap-2">
                        <MapPin className="w-5 h-5" /> Location & Proximity
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                        <ProximityItem icon={Train} label="Nearest MRT" name={property.nearest_mrt_name} distance={property.nearest_mrt_km} />
                        <ProximityItem icon={ShoppingCart} label="Nearest Mall" name={property.nearest_mall_name} distance={property.nearest_mall_km} />
                        <ProximityItem icon={School} label="Nearest School" name={property.nearest_school_name} distance={property.nearest_school_km} />
                        <ProximityItem icon={Hospital} label="Nearest Polyclinic" name={property.nearest_hospital_name} distance={property.nearest_hospital_km} />
                        <ProximityItem icon={Trees} label="Nearest Park" name={property.nearest_park_name} distance={property.nearest_park_km} />
                        <ProximityItem icon={Briefcase} label="Nearest Business Hub" name={property.nearest_business_name} distance={property.nearest_business_km} />
                    </div>
                </div>

                {/* HISTORY */}
                <details className="bg-white border rounded-xl p-4">
                    <summary className="font-semibold text-emerald-700 flex items-center gap-2 cursor-pointer">
                        <History className="w-5 h-5" /> Prediction History (Nearby 1km)
                    </summary>

                    {history.length > 0 ? (
                        <table className="w-full mt-4 text-sm border">
                            <thead className="bg-emerald-50">
                                <tr>
                                    <th className="p-2 border">Date</th>
                                    <th className="p-2 border">Listed Price</th>
                                    <th className="p-2 border">Predicted</th>
                                    <th className="p-2 border">Distance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((h) => (
                                    <tr key={h.created_at}>
                                        <td className="p-2 border">{h.created_at}</td>
                                        <td className="p-2 border">{h.listed_price}</td>
                                        <td className="p-2 border">{h.predicted_price}</td>
                                        <td className="p-2 border">{h.distance_km} km</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-gray-500 mt-3 italic">No nearby history found.</p>
                    )}
                </details>

                {/* Buttons */}
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onApprove} className="bg-emerald-600 text-white px-4 py-2 rounded">
                        Approve
                    </button>
                    <button onClick={onClose} className="bg-gray-300 px-4 py-2 rounded">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
