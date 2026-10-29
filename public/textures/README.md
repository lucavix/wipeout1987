# Texture della pista

Un PNG per tile, pixel netti, nessuna trasparenza necessaria (tranne dove indicato).
Asse x = lungo la direzione di marcia, asse y = attraverso la striscia (y=0 lato esterno/sinistro).
Le tile si ripetono lungo la pista ogni 32 px (= 80 unita' mondo, 1 px = 2.5 unita').
Rigenera le versioni procedurali con `npm run textures:generate` (non sovrascrive i file esistenti; `-- --force` per farlo).

| file | dimensione | uso |
|---|---|---|
| kerb_left.png | 32x22 | bordo sinistro; y=0 e' il lato esterno. Il destro e' lo stesso specchiato (o kerb_right.png se esiste) |
| lane.png | 32x36 | corsia normale |
| speed_pad.png | 32x36 | corsia con chevron verdi (acceleratore), la punta guarda +x (verso di marcia) |
| weapon_pad.png | 32x36 | corsia con rombo giallo (powerup) |
| finish.png | 32x36 | traguardo: scacchiera nei primi 16 px, poi corsia |
| jump_start.png | 32x36 | prima tile del salto: strisce giallo/nere (8 px) poi voragine |
| void.png | 32x36 | voragine del salto |
| jump_end.png | 32x36 | ultima tile del salto: voragine poi strisce giallo/nere (8 px) |
| pit_lane.png | 32x36 | corsia box |
| pit_kerb_left.png | 32x12 | bordino sinistro dei box; il destro e' specchiato |
| background.png | 128x128 | sfondo fuori pista, si ripete; 1 px = 4 unita' mondo |
| tunnel.png | 32x36 | corsia in galleria: asfalto scuro, luci cyan sui bordi, una lampada ogni 16 px |
| tunnel_kerb_left.png | 32x22 | bordo sinistro in galleria (cemento, neon cyan); il destro e' specchiato |
| ground_altima.png | 128x128 | sfondo Altima VII: colline canadesi di notte, verde scuro screziato con rocce e abeti |
| kerb_right.png | 32x22 | opzionale: se manca, kerb_left specchiato |
| pit_kerb_right.png | 32x12 | opzionale: se manca, pit_kerb_left specchiato |
