# Build prompt — Beach City Babes (clean rebuild)

Paste everything below into a fresh Claude Code session opened on this empty
repo. It is a complete, self-contained brief: build the game from scratch,
cleanly, in the milestone order given. A previous version exists in git history
(branch `archive/build-1-reference`) — you may **read it for reference**, but do
**not** copy it wholesale. Its logic worked; its structure did not (two
2,000-line god-files). This rebuild's job is to deliver the same game with an
architecture that stays clean as features land.

---

## 0. What you are building

**Beach City Babes** — a procedural, text-forward **18+ dating sim** set over one
summer in a small beach town. Static web app (no build step, no framework),
plays offline as a PWA, ships an Android APK from CI. The heart of it is
**genuinely generative, in-character conversation** with procedurally generated
people, wrapped in a light seduction-RPG loop (two arousal meters, trainable
stats, an economy, a phone, and relationship drama).

Tone: **suggestive and steamy — innuendo, teasing, tension — but fade to black
at the bedroom door. Never sexually explicit.** Everyone is an adult and
enthusiastically consenting. This ceiling is a hard rule in every text and image
prompt, enforced in code, not left to chance.

### Design pillars (the soul — do not lose these)

1. **Procedural people, not puppets.** Every NPC rolls identity (gender, trans
   or not, pronouns, presentation, body), orientation (everyone is pansexual —
   attraction is about the person), an archetype voice, a **distinct texting
   voice** (see §4), hidden likes/dislikes, a quirk, and a rotating *current
   desire* they hint at over text.
2. **A real conversation.** The babes talk through a live language model **by
   default, with no API key and no setup** (free tier). Replies remember the
   conversation, react to what you actually said, and are gated by a
   suggestive-only tone ceiling. Offline scripted dialogue is the automatic
   fallback so the game is never silent.
3. **Arousal ebbs and flows.** Two meters — **Affection ♥** (slow, sticky) and
   **Desire 🔥** (surges on chained romantic beats via a *spark combo*, ebbs
   with time, cools fast when hot, settles to a tier-based baseline overnight).
   Timing the peak is the skill.
4. **Seduction is a build.** Train Charm/Style/Physique, earn Mojo from bold
   moves, buy and deploy boosts, take stat-gated gigs for coin.
5. **The phone is a weapon.** NPCs text first (desire hints, booty calls,
   jealousy, "you've been ignoring me"). You reply sweet/flirty/spicy or
   "come find me" to summon them in person.
6. **Hearts have wiring.** Each NPC is monogamous or polyamorous. The town is a
   **relationship web** — couples, exes, besties, rivals — wired before you
   arrive. Cheating feeds a gossip mill that names real people; jealousy,
   rivals, ultimatums, breakups, and reconciliations all follow.
7. **Heat escalates.** Relationship tiers (Strangers → Flirting → Dating →
   Lovers) unlock steamier dialogue, spicier gift reactions, daring outfits and
   night backdrops in the art, and a fully-animated bonfire **finale**.
8. **Sticker-Pop art.** Hand-drawn animated SVG portraits (die-cut sticker look:
   white outer stroke, warm outlines, flat cel shading, two-tone accent hair
   driving iris/nails/sparkles), with parametric bodies so no two repeat. A real
   image model can draw them too (free, no key, by default), with the SVG as
   instant placeholder and offline fallback.

---

## 1. Hard constraints

- **Stack:** vanilla JavaScript **ES modules**, plain HTML/CSS. **No framework,
  no bundler, no build step.** Runs from `python3 -m http.server`.
- **Determinism:** all procedural generation flows through one **seeded RNG**
  (`js/rng.js`). Same seed → same world. Never call `Math.random()` in game
  logic.
- **Persistence:** **3 save slots** in `localStorage`, each a plain JSON state
  object with a `v` version field and a **migration function** that upgrades old
  saves in place. Design this from day one — it is what let the old build evolve
  without wiping players.
- **AI by default, offline always works:** chat and art each have a provider
  abstraction with a **free no-key default**, optional key-based tiers, and a
  **scripted/SVG fallback that also triggers automatically on any network
  failure.** The game must be fully playable start to finish with the network
  unplugged.
- **Tone ceiling in code:** a single shared guardrail string/instruction injected
  into every generative prompt (chat and art). Suggestive, never explicit.
- **Tested:** Playwright e2e suites (see §7) covering the full loop and each
  major system. A milestone is not done until its test is green.
- **PWA + auto-update:** service worker offline cache, `version.json` beacon, a
  one-command `tools/bump_version.py`, and a CI workflow that builds a debug APK
  on `v*` tags.

---

## 2. Architecture — keep it modular (this is the whole point of the rebuild)

The old build collapsed into `game.js` (2,510 lines) and `dialogue.js` (1,331).
**Do not let any module exceed ~400 lines.** When one grows past that, split it.
Target layout:

```
index.html            # shell: screens as <section>s toggled by a tiny router
css/style.css         # neon-sunset theme, all styling
js/
  rng.js              # seeded RNG (int, float, pick, weighted, shuffle, chance)
  state.js            # state shape, new-game init, save/load slots, MIGRATIONS
  data.js             # pure content banks (names, roles, archetypes, gifts, activities, quirks, desires, boosts, gigs) — DATA ONLY, no logic
  characters.js       # NPC generation, voice model, relationship web, stat sim (ebb/baseline/daily tick)
  economy.js          # coins, gigs, boosts, stat training (Charm/Style/Physique/Mojo)
  chat/
    provider.js       # provider selection: free (no key) | keyed | scripted fallback; auto-fallback on error
    persona.js        # builds the system prompt from a character + world (voice, bonds, mood, tone ceiling)
    scripted.js       # offline grammar-template dialogue engine (also the fallback)
    engine.js         # applies a player line to affection/desire math regardless of provider
  phone.js            # inbox, NPC-initiated texts, texting UI, tier-gated replies, come-find-me
  drama.js            # tiers, DTR, agreements, gossip mill, jealousy, rivals, ultimatums, breakups, reconciliation
  art/
    portrait.js       # Sticker-Pop animated SVG (parametric body, heat-reactive outfit/backdrop)
    describe.js       # builds image-model prompt from a character's genes + heat
    provider.js       # free (no key) | OpenAI | local SD | off; SVG placeholder + fallback
    finale.js         # animated bonfire finale scene
  world.js            # time (day/phase/hour), locations, NPC schedules, the map
  ui.js               # rendering helpers, screen router, portrait mounting
  main.js             # wiring/bootstrap + auto-update client
  version.js          # build number (generated by bump script)
sw.js, version.json, manifest.webmanifest, icons/
tools/                # bump_version.py, make_icons.py, e2e/
```

Rules: `data.js` holds no logic. Generative-vs-scripted is a **provider seam**,
not `if` branches sprinkled through gameplay. The affection/desire math lives in
**one** place (`chat/engine.js`) and both providers feed it. Drama state
transitions live in `drama.js`, not in the chat loop.

---

## 3. Milestones — build in this order, test each before moving on

Ship a playable, tested slice at every step. Do not scaffold all systems at once.

**M0 — Skeleton & core loop.** RNG, state + 3 save slots + migration harness,
screen router, neon-sunset shell. Character creation (name, gender, trans
optional, pronouns, **role** — Surfer/Musician/Heir/Trainer/Chef/Artist with
distinct economy + move bonuses). New game generates 6 NPCs. Overworld map with
locations, a day/phase/hour clock, NPC schedules (you bump into people). *Test:
create → world renders → save/reload restores exactly.*

**M1 — Scripted conversation + arousal math.** Free-text chat box. Offline
grammar-template engine produces in-character replies keyed to archetype/mood.
Two meters with the spark-combo, ebb, overnight baseline. NPCs aren't pushovers:
wrong/creepy/boring/too-fast moves cost you; standards and turn-offs matter.
Discoverable facts (job, hometown, likes, quirk, rel-style) revealed through
talk. *Test: full chat loop moves the meters correctly and refuses bad moves.*

**M2 — Generative chat by default.** Provider seam: free no-key LLM as default,
Anthropic-key tier (model picker, key in localStorage, browser-direct), scripted
as the third option **and** the automatic fallback on any error. Persona prompt
carries personality/job/quirk/mood/relationship/current-desire/where+when/running
history + the tone ceiling. Player line still drives the meter math either way.
*Test (mock the network): system prompt carries the persona; a mocked reply
renders; killing the network falls back to scripted seamlessly; races are safe.*

**M3 — Economy & seduction build.** Gym/salon/open-mic training
(Charm/Style/Physique), Mojo from bold moves, boosts (Liquid Courage, Date-Night
Scent, Killer Outfit), stat-gated gigs for coin. Gifts (category preferences,
tier-gated spicy items) and dates/activities (cost/hours/publicity/min-affection,
heat-tiered flavor). *Test: earn → train → gift → date changes stats as
specified.*

**M4 — The phone.** Inbox UI clearly distinct from in-person chat. NPCs text
first: desire hints, wanna-see-you after neglect, booty calls. Tier-gated replies
(spicy locked until Dating). "Come find me" summons them to your location.
Unlimited texting with diminishing returns. Picture texting (send/receive a
selfie; request-driven, with a boundary refusal). *Test: NPC-initiated text
arrives, reply lands, come-find-me relocates them, diminishing returns apply.*

**M5 — Distinct voices + relationship web.** (§4, §5.) *Test: two NPCs read as
different people over text; the web generates, is reciprocal, and drives named
gossip.*

**M6 — Drama.** Tiers (Strangers→Flirting→Dating→Lovers). Trans NPCs open up
warmly at Dating. DTR / agreements (exclusive/open/dodge). Gossip mill from
public two-timing → confrontations (apologize/come clean/lie) → ultimatums,
second chances, scorched breakups. Neglected exclusive partners stray & confess.
Jealousy stat → insecure texts → "where do I stand?" scene. Named rivals →
them-or-me ultimatum. Estranged exes → reconciliation if you're kind. Poly
metamours with rolled+remembered chemistry → group hangouts. *Test: the drama
suite from the archive, ported.*

**M7 — Art.** Sticker-Pop animated SVG portraits (parametric bodies, heat-reactive
outfit/backdrop, live expression). Generative image provider (free no-key default,
OpenAI/local-SD tiers, off), SVG as instant placeholder + fallback, cached per
character+heat. Animated bonfire finale when both meters max and you invite them.
*Test: portrait renders; describe() is gene-rich; generative fades in over SVG;
off restores SVG.*

**M8 — Ship it.** PWA offline cache + auto-update beacon + toast, `bump_version.py`,
CI workflow building a debug APK on `v*` tags (Capacitor wrapper), animated menu
with a boot update-check.

---

## 4. Distinct texting voices (do this from M5, design the field in M0 state)

Every NPC gets a persistent `voice` profile so no two sound alike over text:
- 2 core-vibe traits (deadpan, chaotic, earnest, sardonic, sultry, goofy…)
- a texting style: casing (all-lowercase / normal / emphatic CAPS), message
  length (clipped / normal / rambly / multi-text bursts), emoji density, a
  punctuation habit (trailing "…", "!!", dry, perfect grammar)
- 1–2 speech tics (calls you "babe", ends texts with "lol", answers questions
  with questions, drops song lyrics…)
- a passion they light up about, a value they hold, a soft insecurity
Render these as **concrete instructions** injected into the persona prompt so the
model types consistently in-character. Backfill deterministically per-NPC-id in
the save migration.

---

## 5. Relationship web (M5)

At world start, wire the cast together: a couple or two, some exes, a few
besties, maybe a rival/sibling — **bidirectional** bonds stored on each NPC.
Surface them in the character panel. Feed them to the persona ("you used to date
Marina — react if she comes up"). And give them teeth in the gossip system:
flirting with someone's **partner** makes that partner react **by name** and opens
a confrontation; dating an **ex's** ex gets petty; **besties** spread word faster.
Backfill once (seeded) in migration for saves that predate the web.

---

## 6. Content banks (reference — regenerate fresh, keep the flavor)

The archive's `js/data.js` has the full, well-tuned banks; reproduce their shape
and spirit (you may lift the pure data):
- **Names** (woman/man/enby), pronoun sets, gender labels, trans share/reply lines
- **Roles** (6): coins, wage range, per-move bonuses, perk, activity affinities
- **Archetypes**: loves/likes/dislikes, activity love/meh, role chemistry,
  per-move receptivity multipliers, desire gain, patience
- **Quirks**, **Jobs**, **Hometowns**, **Pet names**
- **Gifts**: category, cost, emoji, minTier for spicy items
- **Activities**: cost/hours/publicity/affection/desire/min-affection + normal &
  heat scene text
- **Desires** (rotating wants), **Boosts**, **Gigs**, finale thresholds
Keep everything as **pure data** — no functions in `data.js`.

---

## 7. Testing (Playwright, headless Chromium)

Port the archive's suites, one per system, each asserting real state in
`localStorage` and taking screenshots:
- `e2e.cjs` — full loop: create → chat → gift → date → gig → boost → sleep →
  phone → meet → finale → persist/reload.
- `e2e-chat-free.cjs` — generative chat with the network **mocked**: persona +
  voice reach the prompt; continuity; texting mode; picture texting + boundary;
  race-safe provider routing.
- `e2e-ai.cjs` — keyed Anthropic tier called correctly (mocked).
- `e2e-drama.cjs` — DTR, confront, ultimatum, stray/confess, jealousy/priority,
  rivals, reconciliation, group hangout, **relationship web** (bonds reciprocal +
  named reactions), save migration.
- `e2e-art.cjs` — gene-rich prompt, generative fade-in, off restores SVG.
- `e2e-update.cjs` — bumped build detects newer beacon, offers APK.

Never let a suite hit the real network — mock providers. A milestone is done only
when its suite is green.

---

## 8. Release plumbing

- `sw.js` versioned cache; `version.json` beacon; client polls on launch/focus/10min
  and shows a "tap to refresh" toast when the build number rises.
- `tools/bump_version.py <version>` stamps `js/version.js` + `version.json` and
  bumps the build number.
- `.github/workflows/android-apk.yml` — on `v*` tags, wrap in Capacitor, stamp the
  🍑 icon, build a **debug APK**, attach to a pre-release GitHub Release.
- `.github/workflows/deploy.yml` — publish the static site (e.g. GitHub Pages).

---

## 9. Working agreement

- Commit per milestone with a clear message; keep `README.md` current.
- Prefer small modules and pure functions; put shared math in one place.
- If a file crosses ~400 lines, split it before adding more.
- Consult `archive/build-1-reference` for tuning values and edge cases, but write
  the code fresh and simpler.
- Keep the suggestive-only ceiling enforced in code, not vibes.

Build M0 first and show it running before going further.
