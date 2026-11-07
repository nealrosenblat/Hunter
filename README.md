# Hammer & Delgado

**Season 1 — Episode 1: "The Polyester Connection" · Episode 2: "Death Wears Leg Warmers"**

A browser game in the style of a late-90s Nintendo 64 title. It's an affectionate parody of 1980s TV cop shows: a tough L.A. detective with a mullet and a .44 Magnum named Gerald, his much more competent partner, a captain who keeps yelling about fruit carts, and a brown sedan that's falling apart.

All of the characters, places and music are original. The music and sound effects are synthesized live in the browser, and every model and texture is generated in code. The game ships no image or audio files.

## Episode 1: "The Polyester Connection"

1. **Cold open and credits:** a TV-style opening sequence with a synth-and-sax theme.
2. **The Captain's office:** you're briefed on a counterfeit-jeans ring run by *the Disco Duke*.
3. **The L.A. River chase:** drive the Brougham down a concrete river channel (shot "day-for-night"). Ram the Duke's car and fire Gerald one-handed out the driver's window while Delgado covers you. Hubcaps, doors and bumpers fall off as the car takes damage. Fruit carts and plate glass appear for no reason.
4. **The Duke's warehouse:** a third-person shootout through three rooms. Kick doors in (Hammer) or open them politely (Delgado), dive in slow motion, eat donuts to heal, then fight the Disco Duke on his light-up dance floor.
5. **The verdict:** the Captain grades your case file, including collateral damage, the Brougham's repair bill, and how many times your partner has been taken hostage this season.
6. **Freeze frame.** Roll credits.

## Episode 2: "Death Wears Leg Warmers"

1. **The Captain's office:** Rick Vigor's accountant has been found strangled with a pink leg warmer in the sauna of the Vigor Body Temple. Accounting has returned exactly one chair.
2. **Undercover aerobics:** a rhythm game. Hit the moves on the beat in the 9 PM Power Hour without blowing your cover, while Hammer suffers in the back row with Gerald hidden in his sweatpants. In co-op, each player gets a lane.
3. **The boardwalk chase:** Vigor flees down Ocean Front Walk at night. Surfboards, beach umbrellas, hot dog stands, roller skaters and, somehow, fruit carts.
4. **The Vigor Body Temple:** a shootout through the lobby and juice bar, the weight room, and Vigor's mirrored private studio, ending in a boss fight with a man who throws dumbbells.
5. **The verdict** and the freeze frame.

Finishing Episode 1 leaves your CONTINUE pointing at Episode 2.

## Players

- **1 player:** you control one partner and the AI controls the other. Press **Tab** (or **Y** on a gamepad) to swap at any time.
- **2 players, couch co-op:** split-screen in the warehouse. In the chase, P1 drives and P2 aims Delgado's shots. Two players can share one keyboard, use one keyboard and one gamepad, or use two gamepads.

## Controls

| | Player 1 / solo | Player 2 (shared keyboard) | Gamepad |
|---|---|---|---|
| Move / drive | W A S D | ↑ ↓ | Left stick (RT gas, LT brake) |
| Turn | Mouse (click to lock), Q E or ← → | ← → | Right stick |
| Fire | Click / Space | Enter | RT / A (driving: RB) |
| Dramatic dive | Shift | Right Shift | B |
| Kick door / interact / horn | F | / | X |
| Skip cutscene | Backspace (or the SKIP button) | | Back / Select |
| Reload | R | . | LB |
| Swap partner (1P) | Tab | | Y |
| Pause | Esc / P | | Start |

Aim assist is generous. Press **M** to mute. Every dialogue scene has **SKIP ▸▸** and **☰ MENU** buttons, and the title menus all have a **BACK** option.

## Running it

It's a static site with no build step.

```bash
npm start            # serves the folder at http://localhost:8080 (needs python3)
```

You can use any static file server. Opening `index.html` straight from disk won't work, because browsers block ES modules on `file://` URLs.

### Install it on an iPhone (home-screen app)

Once the game is hosted at an `https://` address, open it in **Safari**, tap **Share → Add to Home Screen**. It launches full-screen with its own icon, works offline after the first visit, and the title screen offers **Continue** from the last scene you reached. Hold the phone sideways. On-screen touch controls appear automatically.

Hosting options: GitHub Pages (free for public repos; private repos need a paid GitHub plan), or drag the folder onto Netlify Drop or Cloudflare Pages. Everything is relative-pathed, so it works from any sub-folder.

### Single-file build

```bash
npm install
npm run build        # -> dist/hammer-and-delgado.html (one self-contained file, ~700 KB)
```

That file can be double-clicked, emailed or hosted anywhere.

### GitHub Pages

Point Pages at the repository root on the default branch. `index.html`, `vendor/` and `src/` are everything the game needs.

### Debug URL parameters

- `?scene=title|credits|briefing|chase|warehouse|verdict|ending` jumps to an Episode 1 scene; `credits2|briefing2|aerobics|chase2|gym|verdict2|ending2` jumps to an Episode 2 scene.
- `&players=2` starts in co-op.
- `&auto` auto-advances dialogue.
- `&god` makes the cops invulnerable.
- `&fast` runs the game at 3× speed.
- `&res=480` changes the internal render height (default 240, like the real thing).

## How it's built

- **Three.js** (vendored in `vendor/`, MIT) renders the 3D at 240 lines, upscaled with blur for the N64 look, with distance fog, Lambert shading and blob shadows.
- `src/models.js`: low-poly character rigs with posable arms and textured faces, the cars and the props.
- `src/textures.js`: every texture is drawn at runtime on small canvases.
- `src/audio.js`: a Web Audio sequencer and synths (drum machine, bass, "sax" lead, brass stabs, FM e-piano) playing the score, plus synthesized sound effects.
- `src/scenes/`: one file per scene. `chase.js` runs the car in track-relative coordinates along a spline. `warehouse.js` has the combat, enemy AI, the AI partner, revives and the boss fight.

## Disclaimer

This is a parody inspired by the general style of 1980s American TV police dramas. All characters, names, places and dialogue are fictional. No real persons, police departments or roller rinks are depicted. No fruit carts were harmed. (Several were.)
