import { useEffect, useState } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { TrendingUp, Lightbulb, Building2 } from "lucide-react";
import api from "../api";

export default function ExploreInsights({ agentId }) {
    const [market, setMarket] = useState({});
    const [agent, setAgent] = useState({});
    const [recs, setRecs] = useState([]);

    useEffect(() => {
        async function fetchInsights() {
            try {
                const [m, a, r] = await Promise.all([
                    api.get("/insights/market"),
                    api.get(`/insights/agent/${agentId}`),
                    api.get(`/insights/recommendations/${agentId}`),
                ]);
                setMarket(m.data);
                setAgent(a.data);
                setRecs(r.data.recommendations || []);
            } catch (err) {
                console.error("Failed to load insights", err);
            }
        }
        if (agentId) fetchInsights();
    }, [agentId]);

    // Helper to determine color for progress bars
    const barColors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

    return (
        <div className="space-y-8">
            {/* Market Overview */}
            <section>
                <h4 className="font-semibold flex items-center gap-2 mb-2">
                    <TrendingUp className="text-emerald-600 w-4 h-4" /> Market Overview
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Top 5 Regions */}
                    <div className="border p-3 rounded-lg shadow-sm">
                        <h5 className="text-sm font-medium mb-2 text-gray-700">
                            Top 5 Regions (AI-predicted avg price per sqm)
                        </h5>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={market.top_regions || []}>
                                <XAxis dataKey="region" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="ai_price_per_sqm" fill="#10b981" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Market Mix with Progress Bars */}
                    <div className="border p-3 rounded-lg shadow-sm">
                        <h5 className="text-sm font-medium mb-2 text-gray-700">
                            Market Mix (by Property Type)
                        </h5>

                        {market.mix_by_type &&
                            Object.keys(market.mix_by_type).length > 0 ? (
                            <ul className="text-sm space-y-2">
                                {(() => {
                                    const total = Object.values(market.mix_by_type).reduce(
                                        (a, b) => a + b,
                                        0
                                    );
                                    return Object.entries(market.mix_by_type).map(
                                        ([type, count], i) => {
                                            const percent = ((count / total) * 100).toFixed(1);
                                            return (
                                                <li key={i}>
                                                    <div className="flex justify-between mb-1">
                                                        <span>{type}</span>
                                                        <span>
                                                            {count} listing{count !== 1 ? "s" : ""} (
                                                            {percent}%)
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                                        <div
                                                            className="h-2.5 rounded-full transition-all duration-500"
                                                            style={{
                                                                width: `${percent}%`,
                                                                backgroundColor:
                                                                    barColors[i % barColors.length],
                                                            }}
                                                        ></div>
                                                    </div>
                                                </li>
                                            );
                                        }
                                    );
                                })()}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-500">
                                No property mix data available.
                            </p>
                        )}

                        <p className="text-sm text-gray-700 mt-3 flex items-center gap-1">
                            <Building2 className="text-blue-500 w-4 h-4" />
                            <strong>Hot Region:</strong>{" "}
                            {market.hot_region && market.hot_region !== "N/A"
                                ? market.hot_region
                                : "No dominant region"}
                        </p>
                    </div>
                </div>
            </section>

            {/* Agent Listing Performance */}
            <section className="border p-3 rounded-lg shadow-sm">
                <h4 className="font-semibold mb-2 text-gray-700">
                    Your Listing Performance
                </h4>
                <p className="text-sm">
                    Total Listings: {agent.listings || 0}
                    <br />
                    Avg Confidence: {agent.avg_confidence || 0}%
                    <br />
                    Avg Price: ${agent.avg_price?.toLocaleString()}
                    <br />
                    Top Regions:{" "}
                    {agent.regions ? Object.keys(agent.regions).join(", ") : "-"}
                </p>
            </section>

            {/* AI Recommendations */}
            <section className="border p-3 rounded-lg shadow-sm">
                <h4 className="font-semibold flex items-center gap-2 mb-2 text-gray-700">
                    <Lightbulb className="text-amber-500 w-4 h-4" /> AI Recommendations
                </h4>
                {recs.length === 0 ? (
                    <p className="text-sm text-gray-500">No AI suggestions right now.</p>
                ) : (
                    <ul className="space-y-2">
                        {recs.map((r, i) => (
                            <li
                                key={i}
                                className={`text-sm border-l-4 pl-3 ${r.type === "positive"
                                        ? "border-green-500 text-green-700"
                                        : "border-red-500 text-red-700"
                                    }`}
                            >
                                {r.message}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
