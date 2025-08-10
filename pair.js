const { makeid } = require('./gen-id');
const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');

const { upload } = require('./mega');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number; // optional now

    async function MALVIN_XD_PAIR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);

        try {
            let sock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(
                        state.keys,
                        pino({ level: "fatal" }).child({ level: "fatal" })
                    ),
                },
                printQRInTerminal: false,
                generateHighQualityLinkPreview: true,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                syncFullHistory: false,
                browser: Browsers.macOS("Safari")
            });

            // pairing code request
            if (!sock.authState.creds.registered) {
                await delay(1500);
                if (num) num = num.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(num || "");
                if (!res.headersSent) {
                    return res.send({ code });
                }
            }

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection == "open") {
                    await delay(5000);

                    const rf = __dirname + `/temp/${id}/creds.json`;
                    console.log("RF path:", rf, "Exists:", fs.existsSync(rf));

                    function generateRandomText() {
                        const prefix = "3EB";
                        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                        let randomText = prefix;
                        for (let i = prefix.length; i < 22; i++) {
                            const randomIndex = Math.floor(Math.random() * characters.length);
                            randomText += characters.charAt(randomIndex);
                        }
                        return randomText;
                    }

                    try {
                        const mega_url = await upload(fs.createReadStream(rf), `${sock.user.id}.json`);
                        console.log("Mega URL:", mega_url);

                        const string_session = mega_url.replace('https://mega.nz/file/', '');
                        const sid = "malvin~" + string_session;

                        // Always send to the account that paired
                        const chatId = sock.user.id;
                        console.log("Sending Session ID to:", chatId);

                        const msg = `
🟦╔════════════════════════════╗🟦
🟦║  🟥████████╗🟩███████╗🟨██████╗  ║🟦
🟦║  🟥╚══██╔══╝🟩██╔════╝🟨██╔══██╗ ║🟦
🟦║     🟥██║   🟩█████╗  🟨██████╔╝ ║🟦
🟦║     🟥██║   🟩██╔══╝  🟨██╔═══╝  ║🟦
🟦║     🟥██║   🟩███████╗🟨██║      ║🟦
🟦║     🟥╚═╝   🟩╚══════╝🟨╚═╝      ║🟦
🟦║       TERAN  •  XMD        ║🟦
🟦╚════════════════════════════╝🟦

✅ *Session ID Generated!*
────────────────────────────
${sid}
────────────────────────────
Use this Session ID to deploy your bot.
Version: 5.0.0
`;

                        await sock.sendMessage(chatId, { text: msg });

                    } catch (e) {
                        console.error("Upload error:", e);
                        await sock.sendMessage(sock.user.id, { text: "❌ Error generating session: " + e });
                    }

                    await delay(10);
                    await sock.ws.close();
                    removeFile('./temp/' + id);
                    console.log(`👤 ${sock.user.id} Connected ✅ Restarting process...`);
                    process.exit();
                } 
                else if (
                    connection === "close" &&
                    lastDisconnect &&
                    lastDisconnect.error &&
                    lastDisconnect.error.output.statusCode != 401
                ) {
                    await delay(10);
                    MALVIN_XD_PAIR_CODE();
                }
            });

        } catch (err) {
            console.error("Service restarted due to error:", err);
            removeFile('./temp/' + id);
            if (!res.headersSent) {
                res.send({ code: "❗ Service Unavailable" });
            }
        }
    }

    return await MALVIN_XD_PAIR_CODE();
});

module.exports = router;
