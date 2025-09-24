export default function Unauthorized() {
    return (
        <div style={{ textAlign: "center", marginTop: "100px" }}>
            <h1>Unauthorized Access</h1>
            <p>You don’t have permission to view this page.</p>
            <a href="/" style={{ color: "blue", textDecoration: "underline" }}>
                Go back to Home
            </a>
        </div>
    );
}
