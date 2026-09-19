import fs from "fs";
import http from "http";
import { google } from "googleapis";

const credentials = JSON.parse(
    fs.readFileSync("./credentials/drive-oauth-client.json", "utf8")
);

const { client_id, client_secret, redirect_uris } =
    credentials.installed;

const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    "http://localhost:3000"
);

const scopes = [
    "https://www.googleapis.com/auth/drive"
];

const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
});

console.log("Buka URL berikut di browser:");
console.log(authUrl);

const server = http.createServer(async (req, res) => {

    if (
    !req.url.startsWith("/?") &&
    !req.url.startsWith("/oauth2callback")
    ) {
        return;
    }

    const url = new URL(
        req.url,
        "http://localhost:3000"
    );

    const code = url.searchParams.get("code");

    if (!code) {
        res.end("Authorization gagal.");
        return;
    }

    try {

        const { tokens } =
            await oauth2Client.getToken(code);

        console.log("\nREFRESH TOKEN:");
        console.log(tokens.refresh_token);

        res.end(
            "Authorization berhasil. Kamu bisa menutup browser."
        );

        server.close();

    } catch (error) {

        console.error("ERROR:", error);

        res.end("Authorization gagal.");

        server.close();
    }
});

server.listen(3000, () => {
    console.log("\nMenunggu authorization...");
});