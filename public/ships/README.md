# Sprite delle navi

Un PNG per nave, `<id>.png`, caricato all'avvio. I metadati (nome, motori, colore scia, statistiche) stanno in `src/gfx/ships.ts`.
Anteprime ingrandite 8x in `docs/ships/`.

## Specifiche per il grafico

- PNG con trasparenza, **muso verso l'alto**, vista dall'alto. 1 px dello sprite = 1,6 unita' di gioco; le navi attuali sono 30-40 px di larghezza per 55-65 px di lunghezza.
- Pixel netti e colori piatti, massimo ~16 colori per nave (stile 8-bit). Niente antialiasing, niente sfumature, niente ombre esterne.
- Dettagli leggibili anche piccoli: cockpit, prese d'aria, 2 motori in coda. In gioco la nave viene ruotata e leggermente schiacciata quando sterza.
- Per ogni nave servono anche: le coordinate dei 2 ugelli (x, y in pixel dall'angolo in alto a sinistra, da li' parte la scia) e un colore per la scia.

## Aggiungere una nave

1. Copia `nuova.png` qui dentro.
2. In `src/gfx/ships.ts` aggiungi una riga a `SHIPS` con `id: 'nuova'`, nome, `engines`, `trailColor`, `stats`.
3. In `src/main.ts` alza `FIELD` al numero di navi desiderato (fino a 8).

| id | nome | dimensione | motori (x, y) |
|---|---|---|---|
| agsys | AG-SYSTEMS | 38x61 | (13.5, 60.5) (25.0, 60.5) |
| feisar | FEISAR | 30x58 | (10.2, 57.5) (19.8, 57.5) |
