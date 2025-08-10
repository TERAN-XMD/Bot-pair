const express = require('express');
const fs = require('fs');
const zlib = require('zlib');
const pino = require('pino');
const { makeid } = require('./gen-id');
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
    try { fs.rmSync(FilePath, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }
}

function compressAndEncode(buffer) {
  const compressed = zlib.deflateSync(buffer);
  return compressed.toString('base64');
}

router.get('/', async (req, res) => {
  const id = makeid();
  let num = req.query.number; // optional
  const waitForSession = req.query.wait === '1' || req.query.wait === 'true';

  // helper to build temp paths
  const tempDir = `./temp/${id}`;
  const credsPath = `${tempDir}/creds.json`;
  const sessionFile = `${tempDir}/session_id.txt`;

  // ensure temp dir exists
  try { fs.mkdirSync(tempDir, { recursive: true }); } catch (e) { /* ignore */ }

  async function startPairing() {
    const { state, saveCreds } = await useMultiFileAuthState(tempDir);

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }))
      },
      printQRInTerminal: false,
      logger: pino({ level: 'fatal' }),
      syncFullHistory: false,
      browser: Browsers.macOS('Safari')
    });

    sock.ev.on('creds.update', saveCreds);

    // request a pairing code if not registered
    if (!sock.authState.creds.registered) {
      await delay(1500);
      if (num) num = num.replace(/[^0-9]/g, '');
      try {
        const code = await sock.requestPairingCode(num || '');
        // If caller doesn't want to wait, return the code immediately
        if (!waitForSession && !res.headersSent) {
          return res.json({ code });
        }
        // otherwise, fallthrough and wait for session
      } catch (e) {
        console.error('requestPairingCode error:', e);
        if (!res.headersSent) return res.status(500).json({ error: 'Failed to request pairing code', details: String(e) });
      }
    }

    // Wait for connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'open') {
        console.log('Connection open for', sock.user?.id);

        // small delay to ensure creds are flushed
        await delay(2000);

        if (!fs.existsSync(credsPath)) {
          console.error('creds.json not found at', credsPath);
        } else {
          try {
            const raw = fs.readFileSync(credsPath);
            const encoded = compressAndEncode(raw); // compressed base64
            const sid = 'malvin~' + encoded;

            // save session id to a file for later retrieval
            try { fs.writeFileSync(sessionFile, sid); } catch (e) { /* ignore */ }

            // send the full session id to the provided number or to the connected account
            const target = (num ? (num + '@s.whatsapp.net') : sock.user.id);

            // WhatsApp message: a short notice plus the sid
            const shortNotice = `✅ Session ID generated.\nYou can also fetch it from the API response.\n`;
            try {
              await sock.sendMessage(target, { text: shortNotice + "\n" + sid });
            } catch (e) {
              console.error('Failed to send session id to WhatsApp target', target, e);
            }

            // If the HTTP caller is waiting, return the session_id in JSON
            if (waitForSession && !res.headersSent) {
              return res.json({ session_id: sid });
            }

            // If caller wasn't waiting, and we haven't responded yet for some reason, respond with a small acknowledgement
            if (!res.headersSent) {
              return res.json({ status: 'paired', session_saved_to: sessionFile });
            }

          } catch (e) {
            console.error('Error preparing session id:', e);
            if (!res.headersSent) res.status(500).json({ error: 'Failed to generate session_id', details: String(e) });
          }
        }

        // cleanup: close socket and remove temp dir after giving time for send
        await delay(1500);
        try { await sock.ws.close(); } catch (e) { /* ignore */ }
        removeFile(tempDir);
        console.log('Pairing complete and cleaned up for', id);
      }

      // Handle reconnects if they are not authentication failures
      if (connection === 'close' && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output?.statusCode !== 401) {
        console.log('Connection closed unexpectedly, retrying pairing...');
        try { await delay(1500); startPairing(); } catch (e) { console.error(e); }
      }
    });

    // global error handling
    sock.ev.on('connection.error', (err) => console.error('socket error', err));
  }

  // start
  startPairing().catch(err => {
    console.error('startPairing error', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal error', details: String(err) });
  });

  // If user asked to wait, we didn't send the code immediately; otherwise response already sent with {code}
});

module.exports = router;
