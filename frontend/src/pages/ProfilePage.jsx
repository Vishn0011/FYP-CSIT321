import { useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import HomeownerPreferenceForm, {
    ensurePreferenceShape,
} from "../components/HomeownerPreferenceForm";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const initialPasswords = {
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
};

export default function ProfilePage() {
    const { user, updateUser } = useAuth();
    const [profile, setProfile] = useState({
        name: user?.name || "",
        email: user?.email || "",
        phone: user?.phone || "",
        role: user?.role || "",
        status: user?.status || "",
    });
    const [loading, setLoading] = useState(true);
    const [profileError, setProfileError] = useState(null);
    const [profileSuccess, setProfileSuccess] = useState(null);
    const [passwordError, setPasswordError] = useState(null);
    const [passwordSuccess, setPasswordSuccess] = useState(null);
    const [passwords, setPasswords] = useState(initialPasswords);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [prefDraft, setPrefDraft] = useState(() => ensurePreferenceShape());
    const [prefLoading, setPrefLoading] = useState(user?.role === "homeowner");
    const [prefSaving, setPrefSaving] = useState(false);
    const [prefError, setPrefError] = useState(null);
    const [prefSuccess, setPrefSuccess] = useState(null);

    useEffect(() => {
        setProfile((prev) => ({
            ...prev,
            name: user?.name || "",
            email: user?.email || "",
            phone: user?.phone || "",
            role: user?.role || "",
            status: user?.status || "",
        }));
    }, [user]);

    useEffect(() => {
        async function loadProfile() {
            const currentToken = localStorage.getItem("token");
            if (!currentToken) {
                setLoading(false);
                setProfileError("You must be logged in to view this page.");
                return;
            }
            try {
                setLoading(true);
                setProfileError(null);
                const res = await fetch(`${API_BASE}/api/profile`, {
                    headers: {
                        Authorization: `Bearer ${currentToken}`,
                    },
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(data?.error || "Unable to fetch profile");
                }
                setProfile({
                    name: data.name || "",
                    email: data.email || "",
                    phone: data.phone || "",
                    role: data.role || "",
                    status: data.status || "",
                });
                if (typeof updateUser === "function") {
                    updateUser(data);
                }
            } catch (err) {
                setProfileError(err.message || "Unable to fetch profile");
            } finally {
                setLoading(false);
            }
        }

        loadProfile();
    }, [updateUser]);

    useEffect(() => {
        let ignore = false;

        async function loadPreferences() {
            if (user?.role !== "homeowner") {
                setPrefLoading(false);
                return;
            }

            const currentToken = localStorage.getItem("token");
            if (!currentToken) {
                setPrefLoading(false);
                return;
            }

            try {
                setPrefLoading(true);
                setPrefError(null);
                const res = await fetch(`${API_BASE}/api/homeowner/preferences`, {
                    headers: { Authorization: `Bearer ${currentToken}` },
                });
                const data = await res.json().catch(() => ({}));
                if (ignore) return;
                if (res.ok && data?.preferences) {
                    setPrefDraft(ensurePreferenceShape(data.preferences));
                } else if (res.ok) {
                    setPrefDraft(ensurePreferenceShape());
                } else {
                    throw new Error(data?.error || "Unable to load preferences");
                }
            } catch (err) {
                if (!ignore) {
                    setPrefError(err.message || "Unable to load preferences");
                }
            } finally {
                if (!ignore) {
                    setPrefLoading(false);
                }
            }
        }

        loadPreferences();
        return () => {
            ignore = true;
        };
    }, [user?.role]);

    const handleProfileChange = (field, value) => {
        setProfile((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleProfileSubmit = async (event) => {
        event.preventDefault();
        setProfileError(null);
        setProfileSuccess(null);

        const name = profile.name.trim();
        const phone = (profile.phone || "").trim();

        if (!name) {
            setProfileError("Name is required.");
            return;
        }

        const currentToken = localStorage.getItem("token");
        if (!currentToken) {
            setProfileError("Session expired. Please log in again.");
            return;
        }

        setSavingProfile(true);
        try {
            const res = await fetch(`${API_BASE}/api/profile`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${currentToken}`,
                },
                body: JSON.stringify({
                    name,
                    phone: phone || null,
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || "Failed to update profile");
            }

            setProfile((prev) => ({
                ...prev,
                name: data.name || name,
                phone: data.phone || phone,
                role: data.role || prev.role,
                status: data.status || prev.status,
            }));

            if (typeof updateUser === "function") {
                updateUser(data);
            }

            setProfileSuccess("Profile updated successfully.");
        } catch (err) {
            setProfileError(err.message || "Failed to update profile");
        } finally {
            setSavingProfile(false);
        }
    };

    const handlePreferenceSubmit = async (nextPrefs) => {
        if (user?.role !== "homeowner") return;

        const currentToken = localStorage.getItem("token");
        if (!currentToken) {
            setPrefError("Session expired. Please log in again.");
            return;
        }

        setPrefError(null);
        setPrefSuccess(null);
        setPrefSaving(true);

        try {
            const res = await fetch(`${API_BASE}/api/homeowner/preferences`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${currentToken}`,
                },
                body: JSON.stringify({ preferences: nextPrefs }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || "Unable to save preferences");
            }
            const normalized = ensurePreferenceShape(data?.preferences || nextPrefs);
            setPrefDraft(normalized);
            setPrefSuccess("Preferences updated");
            window.dispatchEvent(new Event("homeowner-preferences:updated"));
        } catch (err) {
            setPrefError(err.message || "Unable to save preferences");
        } finally {
            setPrefSaving(false);
        }
    };

    const handlePasswordChange = (field, value) => {
        setPasswords((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handlePasswordSubmit = async (event) => {
        event.preventDefault();
        setPasswordError(null);
        setPasswordSuccess(null);

        const currentPassword = passwords.currentPassword.trim();
        const newPassword = passwords.newPassword.trim();
        const confirmPassword = passwords.confirmPassword.trim();

        if (!currentPassword || !newPassword) {
            setPasswordError("Please provide your current password and a new password.");
            return;
        }

        if (newPassword.length < 8) {
            setPasswordError("New password must be at least 8 characters long.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError("New password and confirmation must match.");
            return;
        }

        const currentToken = localStorage.getItem("token");
        if (!currentToken) {
            setPasswordError("Session expired. Please log in again.");
            return;
        }

        setSavingPassword(true);
        try {
            const res = await fetch(`${API_BASE}/api/profile/password`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${currentToken}`,
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                    confirmPassword,
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || "Failed to update password");
            }

            setPasswordSuccess("Password updated successfully.");
            setPasswords(initialPasswords);
        } catch (err) {
            setPasswordError(err.message || "Failed to update password");
        } finally {
            setSavingPassword(false);
        }
    };

    if (loading) {
        return (
            <div className="px-6 py-10">
                <div className="max-w-3xl mx-auto bg-white dark:bg-zinc-800 shadow rounded-xl p-8">
                    <p className="text-center text-zinc-600 dark:text-zinc-300">Loading profile…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="px-6 py-10">
            <div className="max-w-3xl mx-auto space-y-8">
                <header>
                    <h1 className="text-3xl font-semibold text-emerald-800 dark:text-emerald-300">
                        Profile Settings
                    </h1>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        Update your personal information and manage your password in one place.
                    </p>
                </header>

                <section className="bg-white dark:bg-zinc-800 shadow rounded-xl p-6 space-y-6">
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                            Personal Details
                        </h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            These details are visible on your dashboard and communications.
                        </p>
                    </div>

                    {profileError && (
                        <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                            {profileError}
                        </div>
                    )}

                    {profileSuccess && (
                        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                            {profileSuccess}
                        </div>
                    )}

                    <form className="space-y-5" onSubmit={handleProfileSubmit}>
                        <div>
                            <label htmlFor="profile-name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                                Full Name
                            </label>
                            <input
                                id="profile-name"
                                type="text"
                                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                value={profile.name}
                                onChange={(event) => handleProfileChange("name", event.target.value)}
                                autoComplete="name"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="profile-email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                                Email Address
                            </label>
                            <input
                                id="profile-email"
                                type="email"
                                className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                                value={profile.email}
                                disabled
                            />
                        </div>

                        <div>
                            <label htmlFor="profile-phone" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                                Contact Number
                            </label>
                            <input
                                id="profile-phone"
                                type="tel"
                                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                value={profile.phone}
                                onChange={(event) => handleProfileChange("phone", event.target.value)}
                                autoComplete="tel"
                                placeholder="e.g. +65 9123 4567"
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <span className="block text-xs uppercase text-zinc-500 dark:text-zinc-400">
                                    Account Role
                                </span>
                                <span className="mt-1 inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                                    {profile.role || "—"}
                                </span>
                            </div>
                            <div>
                                <span className="block text-xs uppercase text-zinc-500 dark:text-zinc-400">
                                    Approval Status
                                </span>
                                <span className="mt-1 inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200">
                                    {profile.status || "—"}
                                </span>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white shadow hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={savingProfile}
                            >
                                {savingProfile ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </form>
                </section>

                {user?.role === "homeowner" && (
                    <section className="bg-white dark:bg-zinc-800 shadow rounded-xl p-6 space-y-6">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                                Property Preferences
                            </h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                Keep your dashboard recommendations tailored to what matters most.
                            </p>
                        </div>

                        {prefError && (
                            <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                                {prefError}
                            </div>
                        )}

                        {prefSuccess && (
                            <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                                {prefSuccess}
                            </div>
                        )}

                        {prefLoading ? (
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading preferences...</p>
                        ) : (
                            <HomeownerPreferenceForm
                                value={prefDraft}
                                onChange={setPrefDraft}
                                onSubmit={handlePreferenceSubmit}
                                submitting={prefSaving}
                                showHeader={false}
                                submitLabel="Save preferences"
                            />
                        )}
                    </section>
                )}

                <section className="bg-white dark:bg-zinc-800 shadow rounded-xl p-6 space-y-6">
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                            Change Password
                        </h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Use a strong password that's at least 8 characters long.
                        </p>
                    </div>

                    {passwordError && (
                        <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                            {passwordError}
                        </div>
                    )}

                    {passwordSuccess && (
                        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                            {passwordSuccess}
                        </div>
                    )}

                    <form className="space-y-5" onSubmit={handlePasswordSubmit}>
                        <div>
                            <label htmlFor="current-password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                                Current Password
                            </label>
                            <input
                                id="current-password"
                                type="password"
                                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                value={passwords.currentPassword}
                                onChange={(event) => handlePasswordChange("currentPassword", event.target.value)}
                                autoComplete="current-password"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="new-password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                                New Password
                            </label>
                            <input
                                id="new-password"
                                type="password"
                                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                value={passwords.newPassword}
                                onChange={(event) => handlePasswordChange("newPassword", event.target.value)}
                                autoComplete="new-password"
                                required
                                minLength={8}
                            />
                        </div>

                        <div>
                            <label htmlFor="confirm-password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                                Confirm New Password
                            </label>
                            <input
                                id="confirm-password"
                                type="password"
                                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                value={passwords.confirmPassword}
                                onChange={(event) => handlePasswordChange("confirmPassword", event.target.value)}
                                autoComplete="new-password"
                                required
                                minLength={8}
                            />
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white shadow hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={savingPassword}
                            >
                                {savingPassword ? "Updating..." : "Update Password"}
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </div>
    );
}
