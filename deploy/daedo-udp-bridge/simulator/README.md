# TKStrike Simulator

This standalone Windows executable imitates a TkStrike client against the local Daedo bridge. It does not modify or launch the original TkStrike application.

## What it tests

- Bridge health and local OVR collection responses.
- Match, competitor, participant, and license resources returned by OVR.
- OVR `MATCH_LOADED` action forwarding to the configured Vercel endpoint.
- A real-time countdown from `02:00` to `00:00`, with one UDP `ROUNDCOUNTDOWN_CHANGE` packet per second, plus `RESUME`, `OT_RED_HEAD_HIT`, `GAMJEOM`, `TIMEOUT`, and `MATCH_FINISHED` events.
- The resulting live state read from the public scoreboard API.

## Run

1. Start the existing bridge with `INICIAR-TKSTRIKE.ps1` in real mode.
2. Run `TkStrike-Simulator.exe`.

The simulator uses `http://127.0.0.1:5001`, UDP port `5000`, and the live endpoint `https://tkdcore.vercel.app/api/v1/integrations/daedo/live` by default. Optional arguments are `--bridge`, `--udp-host`, `--udp-port`, `--mat`, and `--live-url`.

The program creates a clearly named synthetic match, sends OVR actions and UDP events through the running bridge, then removes only its synthetic match from the local bridge queue. The default run takes about two minutes. Use `--clock-seconds 3 --tick-ms 10` for a fast test. The synthetic final state remains as the latest live scoreboard row in Supabase, so load a real match afterward to replace it. Run this only when it is acceptable for the web live scoreboard to show test scores temporarily.

## Build

From `deploy/daedo-udp-bridge`:

```powershell
npm install
npm run simulator:build
```

The executable is written to `simulator/TkStrike-Simulator.exe`.

## Match-control GUI

The separate graphical client is built as `simulator/TkStrike-Match-Control.exe`. It opens a local browser window with blue/CHONG and red/HONG score controls, Gam-jeom, round controls, a 2:00 countdown, and the latest state read from Vercel. Use **Actualizar OVR** to receive the available match queue from the bridge, select a match, and choose **Recibir combate** to send its original ID and competitor names through `MATCH_LOADED`. Each timer second is sent as a UDP packet through the running bridge.

Build it from the bridge directory with `npm run simulator:ui:build`. To run the UI without packaging, use `npm run simulator:ui`; add `-- --no-open --port 5180` to choose a port and keep the browser closed. It binds only to `127.0.0.1`.

The GUI does not load or send an event until you select **Recibir combate** or expand **Crear combate manual de prueba**. Receiving an OVR match updates the Vercel live scoreboard with that match; score, clock, and penalty buttons then send UDP events for it. Manual creation remains available for cases where the OVR queue is empty.

## Safe integration test

Run `npm run simulator:test` from the bridge directory. It starts a temporary copy of the current bridge, routes its API calls to a local mock with a fake key, and runs the executable against that copy. This validates the executable and bridge without contacting Vercel, Supabase, or the real TkStrike.
