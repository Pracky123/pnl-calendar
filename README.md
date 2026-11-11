# PNL Calendar — Web-App (PWA)

Kostenlose, installierbare Web-App fürs iPhone (Safari → Teilen → **Zum Home-Bildschirm**).

Dieselbe Optik und dasselbe Verhalten wie die Cursor-Page: Axiom-Look, kompakte Tageszahlen auf dem Handy, tippen öffnet das Tages-Sheet, Monatsschalter, USD/SOL, Plus-Serien, deutsche Labels, Zeiten in Europe/Berlin.

## Daten und Auto-Update

`python3 /workspace/pnl-calendar/update.py` schreibt bei jedem Lauf zusätzlich `app/data.json` (FIFO-PnL der Wallet). Die bestehende Cursor-Page und die 15-Minuten-Routine bleiben unverändert.

In der App: Button **↻** oder Pull-to-Refresh lädt `data.json` neu. Unten steht **Stand: … (Europe/Berlin)**.

Live-Neuberechnung jedes Trades direkt im Browser über einen öffentlichen Solana-RPC ist nicht zuverlässig genug (offizielle RPC-POSTs werden oft mit 403 blockiert; volles FIFO braucht die ganze Historie). Deshalb aktualisiert die Pipeline die Datei, die App lädt sie.

## Kostenlos hosten (GitHub Pages)

Auf dieser Box ist **kein** GitHub-/Cloudflare-/Netlify-Login hinterlegt (`gh auth status` = nicht angemeldet). Es wurde nichts deployed.

Empfehlung — ein kostenloses GitHub-Konto, einmal verbinden:

1. Auf der Box (oder lokal) `gh auth login` mit deinem GitHub-Konto.
2. Im Ordner der App:

```bash
cd /workspace/pnl-calendar/app
git init
git add -A
git commit -m "PNL Calendar PWA"
gh repo create pnl-calendar --public --source=. --remote=origin --push
```

3. Im GitHub-Repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main / (root) → Save**.

4. Öffentliche HTTPS-URL (nach 1–2 Minuten):

`https://<dein-username>.github.io/pnl-calendar/`

5. Ab dann pusht `update.py` nach jedem Lauf automatisch `data.json` (über `app/deploy.sh`), sobald `origin` erreichbar ist.

Auf dem iPhone diese HTTPS-URL in Safari öffnen, Teilen (□↑) → **Zum Home-Bildschirm**.

Cloudflare Pages oder Netlify gehen ebenfalls kostenlos, brauchen aber ebenfalls ein einmaliges Konto und sind hier nicht vorkonfiguriert.

## Lokal testen

```bash
cd /workspace/pnl-calendar/app
python3 -m http.server 8765 --bind 127.0.0.1
```

Dann http://127.0.0.1:8765/ öffnen (Service Worker funktioniert auf localhost).
