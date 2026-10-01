# SheharSetu Arduino Bridge

Reads the JSON lines your Arduino prints and sends them to the backend, so the
drain pages update in real time — **no browser tab needed**.

## One-time setup (on the PC the Arduino is plugged into)
1. Install Node.js 18 or newer (nodejs.org).
2. Open a terminal in this `arduino-bridge` folder and run: `npm install`
3. Copy `.env.example` to `.env` and edit it:
   - `API_BASE_URL` — `http://localhost:5000/api` (local) or `https://YOUR-BACKEND.onrender.com/api`
   - `SERIAL_PORT` — the Arduino's port (Arduino IDE → Tools → Port), e.g. `COM8`
   - `DEVICE_KEY` — only if you set `DEVICE_INGEST_KEY` on the backend

## Every time
1. **Close the Arduino IDE Serial Monitor** (only one program can use the port).
2. Make sure the backend is running (`npm run dev` in `backend`).
3. In this folder run: `npm start`
4. Open the drain's page in the app. It should say **LIVE**.

The drain with the same Device ID as the Arduino's `device_id` (e.g. `DR-001`)
must exist in the app: Drains → Add Drain.

Expected output:
```
[3:44:02 pm] ✔ Listening on COM8 @ 9600 baud → sending to http://localhost:5000/api
[3:44:04 pm] ✔ DR-001 saved · depth 149.1 cm · fill 99% · CH4 0.61 · H2S 0.29 · rain DETECTED
```

## Troubleshooting
| Message | Fix |
|---|---|
| `Could not open COM8 … Access denied` | Close the Arduino IDE Serial Monitor / other programs using the port |
| `No drain with Device ID "DR-001"` | Add the drain in the app with that exact Device ID |
| `HTTP 401 Invalid or missing device key` | Put the same value in `DEVICE_KEY` as `DEVICE_INGEST_KEY` on the backend |
| `Could not send reading: fetch failed` | Backend isn't running, or `API_BASE_URL` is wrong |
| Nothing printed after "Listening" | Wrong port or baud rate (must be 9600); press the Arduino's reset button |

Run `npm test` to check the parsing logic without any hardware.
