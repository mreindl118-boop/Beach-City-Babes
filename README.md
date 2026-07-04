# 🍑 Beach City Babes

*A procedural summer of flirting dangerously.* An 18+ text-forward dating sim
with animated 2D anime-style portraits, procedurally generated characters, and
a seduction system with actual mechanics under the sunscreen.

**Suggestive, never explicit** — the game runs hot on innuendo and fades to
black at the peak. Everyone in Beach City is an adult and enthusiastically
consenting.

## Design pillars

- **Procedural people, not puppets.** Every NPC rolls gender identity
  (women, men, non-binary folks — some trans, all fabulous), pronouns,
  presentation, body type, orientation, an archetype voice
  (Shy Bookworm → Glam Royalty), hidden likes/dislikes, quirks, and a rotating
  *current desire* they'll proactively hint at over text. Attraction is to
  gender identity; if you're not their type they say so warmly and stay
  friends.
- **You are somebody.** Character creation picks your name, gender (trans
  optional and celebrated), pronouns, and a **role** — Drifter Surfer,
  Boardwalk Musician, Trust-Fund Heir, Personal Trainer, Line Cook, Struggling
  Artist. Roles set your economy, your conversational superpowers, and which
  NPCs swoon or shrug at you. **3 save slots** = 3 different summers.
- **Arousal ebbs and flows.** Two meters: **Affection ♥** builds slow and
  sticks; **Desire 🔥** surges with chained romantic beats (the **spark
  combo** multiplies gains), ebbs as hours pass, cools *fast* when running
  hot, and settles overnight to a baseline simmer that rises with your
  relationship tier. Time the peak.
- **Seduction is a build.** Train **Charm 💬 / Style ✨ / Physique 💪** at the
  gym, salon, and open mic; earn **Mojo 🔥** by landing bold moves; buy and
  deploy **boosts** (Liquid Courage, Date-Night Scent, Killer Outfit); take
  stat-gated sexy gigs (swimwear modeling, tiki bartending) for coin.
- **The phone is a weapon.** NPCs text you first — desire hints, booty-call
  invites, jealousy, "you've been ignoring me." You text back: sweet, flirty,
  spicy (tier-gated), or a *come find me* that summons them in person.
- **Heat escalates.** Relationship tiers (Strangers → Flirting → Dating →
  Lovers) unlock steamier dialogue banks, spicier gift reactions, more daring
  outfits and sultrier poses in the art, and night-time backdrops.
- **The big finish.** Max both meters and invite them to the Bonfire: a fully
  animated finale — sunset dissolve, firelight, the kiss, fireworks, hearts,
  and a knowing fade to starlight.

## Play it

It's a static web app — no build step.

```bash
cd Beach-City-Babes
python3 -m http.server 8080
# open http://localhost:8080
```

Any static host works (GitHub Pages included — see the deploy workflow).

## Android / desktop installs + auto-update

The game is a **PWA**: visiting it in Chrome on Android offers *Install app*
(desktop Chrome/Edge too). It plays offline and **auto-updates**: the client
polls `version.json` (on launch, on focus, every 10 min); when the build
number rises it swaps the service-worker cache and shows a "tap to refresh"
toast. Ship an update with:

```bash
python3 tools/bump_version.py 0.2.0
git commit -am "release 0.2.0" && git push
```

### Real APK

Because the PWA is the app, the recommended APK is a **Trusted Web Activity**
wrapper via [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap):

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://YOUR-HOST/manifest.webmanifest
bubblewrap build   # -> app-release-signed.apk
```

TWA APKs render the live site, so **every deploy auto-updates every install**
— no store releases needed. (Capacitor works too if you prefer a bundled
WebView; the auto-update toast still functions since the game polls
`version.json` over the network.)

## Repo map

| Path | What |
| --- | --- |
| `js/rng.js` | Seeded RNG |
| `js/data.js` | Content banks: names, roles, archetypes, gifts, dates, desires, boosts, hustles |
| `js/characters.js` | Procedural NPC generation, arousal ebb/baseline, daily simulation |
| `js/art.js` | Anime-style animated SVG portraits (heat-reactive outfits/backdrops) + finale scene |
| `js/dialogue.js` | Grammar-template dialogue engine: moves, gifts, dates, texts, tier heat |
| `js/game.js` | Screens, save slots, actions, phone, economy, auto-update client |
| `sw.js` / `version.json` / `js/version.js` | Versioned offline cache + update beacon |
| `tools/make_icons.py` | Regenerates the 🍑 icon PNGs (Pillow) |
| `tools/bump_version.py` | One-command release bump |

## Content rating

Mature 17+/18+: innuendo, suggestive themes, alcohol references, scandalous
swimwear. No explicit sexual content, no nudity in the art.
