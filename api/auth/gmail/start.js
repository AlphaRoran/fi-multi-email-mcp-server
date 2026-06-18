import { google } from "googleapis";
import { parseBrokerSessionState } from "../../../src/brokerProtocol.js";
const gmailScopes = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/userinfo.email"
];
export default function handler(req, res) {
    try {
        const state = queryString(req.query.state, "state");
        parseBrokerSessionState(state, process.env.EMAIL_MCP_BROKER_SHARED_SECRET);
        const client = new google.auth.OAuth2(requiredEnv("GOOGLE_CLIENT_ID"), requiredEnv("GOOGLE_CLIENT_SECRET"), `${publicBaseUrl()}/auth/gmail/callback`);
        res.redirect(client.generateAuthUrl({
            access_type: "offline",
            prompt: "consent",
            scope: gmailScopes,
            state
        }));
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
