router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number; // Get number from URL query: /?number=1234567890

    async function MALVIN_XD_PAIR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        try {
            let sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                browser: Browsers.macOS("Desktop"),
            });

            sock.ev.on('creds.update', saveCreds);
            sock.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect, qr } = s;

                if (qr) await res.end(await QRCode.toBuffer(qr));

                if (connection == "open") {
                    await delay(5000);

                    let rf = __dirname + `/temp/${id}/creds.json`;

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
                        const string_session = mega_url.replace('https://mega.nz/file/', '');
                        let sid = "malvin~" + string_session;

                        let chatId = num + "@s.whatsapp.net"; // Send to your number

                        let desc = `
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

                        await sock.sendMessage(chatId, { text: desc });

                    } catch (e) {
                        await sock.sendMessage(num + "@s.whatsapp.net", { text: "❌ Error: " + e });
                    }

                    await delay(10);
                    await sock.ws.close();
                    await removeFile('./temp/' + id);
                    process.exit();
                } 
                else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(10);
                    MALVIN_XD_PAIR_CODE();
                }
            });
        } catch (err) {
            console.log("service restarted");
            await removeFile('./temp/' + id);
            if (!res.headersSent) res.send({ code: "❗ Service Unavailable" });
        }
    }

    await MALVIN_XD_PAIR_CODE();
});
