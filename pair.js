const express = require('express');
const fs = require('fs');
const pino = require('pino');
const { makeid } = require('./gen-id');
const { upload } = require('./mega');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');

let router = express.Router();

function removeFile(FilePath) {
    if (fs.existsSync(FilePath)) {
        fs.rmSync(FilePath, { recursive: true, force: true });
    }
}

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;

    if (!num) {
        return res.status(400).send({ error: 'Number is required as ?number=XXXXXXXXXX' });
    }

    async function startPairing() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);

        let sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
            },
            printQRInTerminal: false,
            generateHighQualityLinkPreview: true,
            logger: pino({ level: "silent" }),
            syncFullHistory: false,
            browser: Browsers.macOS('Safari')
        });

        sock.ev.on('creds.update', saveCreds);

        // Step 1: Get pairing code
        if (!sock.authState.creds.registered) {
            await delay(1500);
            num = num.replace(/[^0-9]/g, '');
            const code = await sock.requestPairingCode(num);
            if (!res.headersSent) {
                res.send({ code });
            }
        }

        // Step 2: Wait for "open" event
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                console.log(`✅ Connected as ${sock.user.id}`);

                await delay(3000); // Wait for file to be fully written

                let credsFile = `./temp/${id}/creds.json`;

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
                    const mega_url = await upload(fs.createReadStream(credsFile), `${sock.user.id}.json`);
                    const string_session = mega_url.replace('https://mega.nz/file/', '');
                    const sid = "malvin~" + string_session;

                    await sock.sendMessage(num + "@s.whatsapp.net", {
                        text: `
✅ *Session ID Generated!*
────────────────────────────
${sid}
────────────────────────────
Use this Session ID to deploy your bot.
Version: 5.0.0
`
                    });

                } catch (e) {
                    await sock.sendMessage(num + "@s.whatsapp.net", { text: "❌ Error generating session: " + e });
                }

                await delay(2000);
                await sock.ws.close();
                removeFile('./temp/' + id);
                console.log("🔄 Pairing process complete.");
            }

            if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== 401) {
                console.log("⚠️ Connection closed, retrying...");
                startPairing();
            }
        });
    }

    startPairing();
});

module.exports = router;
