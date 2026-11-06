# .memory — attrezzi di lavoro del progetto (persistono fra le sessioni)

- `cdp.py` — pilota Chrome headless via DevTools protocol contro il dev server (http://127.0.0.1:5187/).
  Scenari: `race` (Karbonis, autopilota, 40 s, screenshot ogni 4 s), `pit` (Altima, nave messa nella corsia box,
  log energia), `pitdbg` (diagnostica). Uso: `python3 -I .memory/cdp.py .memory/shots race`
  Richiede il modulo python `websockets` e `google-chrome`.
- `extract_pixelart.py` — da un disegno pixel-art (griglia di celle, sfondo bianco, anche a filo dei bordi) ricava lo sprite PNG:
  trova il passo della griglia, quantizza i colori, stampa gli ugelli. Uso: `python3 -I .memory/extract_pixelart.py ref/nave.jpeg public/ships/nave.png [cols rows]`
- `recolour.py` — sostituisce un colore (o il piu' frequente) in uno sprite PNG; usato per schiarire l'Auricom.
- `shots/` — screenshot prodotti dagli script (non committati).
