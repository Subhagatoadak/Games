# Living Stone Chess (three.js)

A chess set of living stone statues on a torchlit marble board. Each army is carved from a single
stone (white marble or black obsidian) and every piece stands on a stepped octagonal plinth: foot
soldiers (pawns), tower guards (rooks), mounted cavaliers (knights), battle clerics with crook staffs
(bishops), a veiled warrior queen and a crowned king, in great helms, plate, chainmail and long capes.

**Your own models:** drop sculpted `.glb`/`.gltf` pieces into [`models/`](models/README.md) and list
them in `models/manifest.json` to replace any built-in statue (Docker mounts the folder, so just refresh).

Captures are sword fights: the attacker closes in, the two trade blows that are parried or blocked
(sparks, glowing blade trails, clangs), then a slow-motion killing blow. The loser falls to their
knees, turns to stone and crumbles into rubble. The winner raises their sword and takes the square.

Full chess rules (castling, en passant, promotion, check/checkmate, stalemate, 50-move,
threefold repetition, insufficient material), two-player or vs a built-in AI (3 levels).

## Run

```sh
docker compose up -d --build     # http://localhost:8765
CHESS_PORT=9000 docker compose up -d   # custom port
docker compose down
```

Or just open `index.html` in a browser (three.js loads from a CDN).

## Controls
- Click a piece (it raises its sword), then a highlighted square (dots = moves, rings = captures)
- Drag to orbit, scroll to zoom, **Flip** to switch sides, Ctrl/Cmd+Z to undo
- **Battles**: *Epic duel* (an exchange of blows) or *Quick strike* (one decisive blow)
- **Giant view** (or `g`) drops the camera to ground level among the pieces
- **Cinematic** toggles the side-on duel camera; **Sound** toggles the synthesised effects

## Testing hooks
URL hash options for scripted screenshots, e.g.
`#moves=e2e4,d7d5,e4d5&sim=6000` plays the moves, advances the game 6 s in fixed steps and freezes.
Also `view=px,py,pz,tx,ty,tz`, `pose=e2:overhead.wind`, `battle=quick`, `nocine`.

## Files
- `engine.js` — rules engine + negamax AI (no dependencies; perft-verified)
- `index.html` — three.js scene, statue rigs, model loader, battle choreography, effects, input and UI
- `models/` — optional custom piece models + `manifest.json`

## Roadmap
- Phase 2: voice commands ("knight to f3")
