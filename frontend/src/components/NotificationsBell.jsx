import { useEffect, useState } from "react";
import api from "../api";

function formatTime(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
}

export default function NotificationsBell() {
    const [items, setItems] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const res = await api.get("/my/announcements");      // 👈 same endpoint
                if (cancelled) return;
                const list = Array.isArray(res.data) ? res.data : [];
                setItems(list);
            } catch (err) {
                if (err.response?.status === 401) return;
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const unreadCount = items.filter(
        (n) => !n.read_at && !n.dismissed_at
    ).length;

    const hasUnread = unreadCount > 0;

    const toggleOpen = async () => {
        const next = !open;
        setOpen(next);

        // When opening, mark all unread as read
        if (!open && items.length > 0) {
            const unread = items.filter((n) => !n.read_at && !n.dismissed_at);
            if (unread.length === 0) return;

            try {
                await Promise.all(
                    unread.map((n) =>
                        api.post(`/my/announcements/${n.id}/read`)
                    )
                );
                const nowIso = new Date().toISOString();
                setItems((prev) =>
                    prev.map((n) =>
                        !n.read_at && !n.dismissed_at ? { ...n, read_at: nowIso } : n
                    )
                );

            } catch (err) {
                console.error("Failed to mark announcements read", err);
            }
        }
    };

    const markDone = async (id) => {
        try {
            await api.post(`/my/announcements/${id}/dismiss`);
        } catch (err) {
            console.error("Failed to dismiss announcement", err);
        } finally {
            // drop from list so it won't return next time
            setItems((prev) => prev.filter((n) => n.id !== id));
        }
    };

    return (
        <div className="relative">
            {/* Bell button */}
            <button
                type="button"
                onClick={toggleOpen}
                className="
          relative inline-flex h-10 w-10 items-center justify-center
          rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm
          transition-all hover:border-emerald-400 hover:text-emerald-600 active:scale-95
        "
                aria-label="Notifications"
            >
                <span className="text-lg">🔔</span>
                {hasUnread && (
                    <span
                        className="
              absolute -right-1.5 -top-1.5 min-w-[18px]
              rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-4 text-white
            "
                    >
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div
                    className="
            absolute right-0 mt-2 w-80 rounded-xl border border-gray-200
            bg-white shadow-xl z-40
          "
                >
                    <div className="flex items-center justify-between border-b px-4 py-2">
                        <span className="text-sm font-semibold text-gray-800">
                            Notifications
                        </span>
                        {!loading && items.length > 0 && (
                            <span className="text-xs text-gray-500">
                                {items.length} total
                            </span>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {loading ? (
                            <div className="px-4 py-3 text-xs text-gray-500">Loading…</div>
                        ) : items.length === 0 ? (
                            <div className="px-4 py-3 text-xs text-gray-500">
                                No notifications.
                            </div>
                        ) : (
                            items.map((n) => (
                                <div
                                    key={n.id}
                                    className="
                    flex gap-2 border-b px-4 py-3 last:border-b-0
                    hover:bg-gray-50
                  "
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] uppercase tracking-wide text-emerald-600">
                                                Announcement
                                            </span>
                                            {!n.read_at && (
                                                <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                            )}
                                        </div>
                                        <div className="text-sm font-semibold text-gray-900">
                                            {n.title}
                                        </div>
                                        {n.body_md && (
                                            <div className="mt-0.5 line-clamp-2 text-xs text-gray-600">
                                                {n.body_md}
                                            </div>
                                        )}
                                        <div className="mt-1 text-[10px] text-gray-400">
                                            {formatTime(n.created_at)}
                                        </div>
                                    </div>

                                    {/* 'Read already / done' button */}
                                    <button
                                        type="button"
                                        onClick={() => markDone(n.id)}
                                        className="
                      mt-1 h-6 px-2 text-[10px]
                      rounded-full bg-gray-100 text-gray-600
                      hover:bg-gray-200 hover:text-gray-800
                    "
                                    >
                                        Done
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
