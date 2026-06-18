import { parseBrokerSessionState } from "../../../src/brokerProtocol.js";
const outlookScopes = ["offline_access", "User.Read", "Mail.ReadWrite", "Mail.Send"];
export default function handler(req, res) {
    try {
        const state = queryString(req.query.state, "state");
        parseBrokerSessionState(state, process.env.EMAIL_MCP_BROKER_SHARED_SECRET);
        const tenant = process.env.MICROSOFT_TENANT_ID || "common";
        const params = new URLSearchParams({
            client_id: requiredEnv("MICROSOFT_CLIENT_ID"),
            response_type: "code",
            redirect_uri: `${publicBaseUrl()}/auth/outlook/callback`,
            response_mode: "query",
            scope: outlookScopes.join(" "),
            state
        });
        res.redirect(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`);
    }
    catch (error) {
        res.status(500).send(`OAuth broker failed: ${error.message}`);
    }
}
function publicBaseUrl() {
    return requiredEnv("BROKER_PUBLIC_BASE_URL").replace(/\/$/, "");
}
function requiredEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required`);
    }
    return value;
}
function queryString(value, name) {
    if (Array.isArray(value)) {
        return value[0] || "";
    }
    if (!value) {
        throw new Error(`${name} is required`);
    }
    return value;
}
