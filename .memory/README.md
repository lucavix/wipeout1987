# .memory — attrezzi di lavoro del progetto (persistono fra le sessioni)

- `cdp.py` — pilota Chrome headless via DevTools protocol contro il dev server (http://127.0.0.1:5187/).
  Scenari: `race` (Karbonis, autopilota, 40 s, screenshot ogni 4 s), `pit` (Altima, nave messa nella corsia box,
  log energia), `pitdbg` (diagnostica). Uso: `python3 -I .memory/cdp.py .memory/shots race`
  Richiede il modulo python `websockets` e `google-chrome`.
- `shots/` — screenshot prodotti dagli script (non committati).
