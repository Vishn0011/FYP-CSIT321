import React from "react";
import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";

import "./index.css";
import App from "./App.jsx";

const GOOGLE_CLIENT_ID = "98981474983-d5h2shgl18u6oovn378q3ovao61jtbm0.apps.googleusercontent.com";
const RECAPTCHA_SITE_KEY = "6LcJcgwsAAAAACAsXepETMZebE5gYcCLjp-Z_5pC";

/*createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
                <App />
            </GoogleReCaptchaProvider>
        </GoogleOAuthProvider>
    </React.StrictMode>
);*/

createRoot(document.getElementById("root")).render(
    <GoogleOAuthProvider clientId={clientId}>
        <App />
    </GoogleOAuthProvider>
);

