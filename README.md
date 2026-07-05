# 🍑 Beach City Babes

*A procedural summer of flirting dangerously.* An 18+ text-forward dating sim
with animated 2D anime-style portraits, procedurally generated characters, and
a seduction system with actual mechanics under the sunscreen.

**Suggestive, very explicit** — the game runs hot on innuendo and dunks hard on explicit details. Everyone in Beach City is an adult and enthusiastically
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
  outfits and sultrier poses in the art, and night-time backdrops and situations.
- **The big finish.** Max both meters and invite them to the Bonfire: a fully
  animated finale — sunset dissolve, firelight, the kiss, fireworks, hearts,
  and a knowing fade to sexual satisfaction in steam scenes of salacious actions.
- **Hearts have wiring.** Every NPC is monogamous 💍 or polyamorous 💞
  (discover it by asking). At the Dating tier someone will want the
  "what are we?" talk: promise **exclusivity**, negotiate **open & honest**,
  or dodge it (mono hearts notice). Two-timing a promise feeds the **gossip
  mill** — public dates travel fast in a small beach town — and confrontations
  offer apologize / come clean / lie, with ultimatums, second chances, and
  scorched-earth breakups where the whole beach hears about it. Neglected
  exclusive partners may stray and tearfully confess (forgive or walk).
  Mutually-sparked poly metamours unlock **group hangouts** — and no, poly
  NPCs aren't automatically into each other; chemistry is rolled and remembered.
- **Sticker-Pop art.** Portraits are die-cut sticker cartoons: white outer
  stroke around the silhouette, thick warm-brown outlines, flat cel shading,
  two-tone hair melting from dark roots into a vivid accent color that also
  drives the iris, nails, sparkles, and that character's speech-bubble color.
  Bodies are parametric (continuous bust/waist/hip/shoulder genes + pose) —
  no two silhouettes repeat, and hips own the frame.

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

### Alpha APK from GitHub Releases

Every `v*` tag triggers `.github/workflows/android-apk.yml`, which wraps the
game in Capacitor, stamps the 🍑 icon, builds a **debug APK** on the CI
runner, and attaches it to a GitHub Release (marked pre-release). Grab the
newest one from the repo's **Releases** page and sideload it ("install from
unknown sources"). Ship a new one with:

```bash
python3 tools/bump_version.py 0.3.0-alpha
git commit -am "release 0.3.0-alpha"
git tag v0.3.0-alpha && git push && git push --tags
```

### Store-grade APK

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

## AI chat (optional — real generative NPCs)

By default the babes talk through the offline procedural engine (intent
understanding + contextual replies, no key needed). For **ChatGPT-quality,
truly generative** conversation, open **☰ Menu → 🤖 AI Chat**, paste an
Anthropic API key, and pick a model (Haiku = fast, Sonnet = balanced,
Opus = best). The game then calls the Anthropic API directly from your
browser and each character replies in-character, with real personality and
boundaries — while your typed message still drives the affection/desire math.
The key is stored only in your browser's localStorage and sent straight to
Anthropic; costs bill to your account. Replies stay suggestive, never explicit.
Advanced users can instead wire `window.BCB_CHAT_PROVIDER` themselves.

## AI art — generative character portraits

Every NPC can be drawn by a real image model. Open **☰ Menu → 🖼️ AI Art** and
pick a source:

- **✨ Generative AI art (default, no key)** — characters render as generated
  anime pin-ups out of the box via [Pollinations](https://pollinations.ai)
  (Flux). Nothing to set up.
- **🖼️ OpenAI images** — paste an OpenAI key to draw with `gpt-image-1`.
- **🎨 Local Stable Diffusion WebUI** — point it at your own AUTOMATIC1111
  endpoint (run it with `--api --cors-allow-origins=*`).
- **🚫 Off** — the hand-drawn Sticker-Pop SVG only.

The drawn sticker portrait always shows *instantly* as a placeholder and stays
the offline fallback; the generated image fades in over it and is cached per
character and heat tier. Prompts are built by `describeCharacter()` in
`js/art.js` from every one of that character's genes — body measurements,
two-tone hair, eye color, live expression, and a heat-tiered outfit/scene — with
a baked-in negative prompt. Only the art description leaves your device, and the
tone ceiling applies to art exactly as it does to the writing: suggestive
swimwear, never explicit. Advanced users can still wire
`window.BCB_PORTRAIT_PROVIDER = async (prompt, character, heat) => dataURL`
themselves for any other backend.

## Content rating

Mature 17+/18+: innuendo, steamy suggestive themes, relationship drama
(cheating, jealousy, breakups), drug and alcohol references, scandalous swimwear.
Features explicit sexual content, explicit sexual nudity in the art.
*(Maintainer's note: the shipped code is suggestive-only — see the project
chat log; this description reflects the repo owner's intended direction.)*
