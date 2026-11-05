# Long Shot

A daily trivia game with a casino twist. Each prompt asks you to name something, and you bet on how rare your answer will be. The fewer players who name it, the longer its odds and the bigger the payout.

## How to play

- **Daily card.** Everyone gets the same 7 prompts each day, dealt as playing cards. You have 30 seconds per round.
- **Pick a chip, then answer.** Your chip sets the odds your answer has to reach:

  | Chip | Pays when the odds are | Multiplier |
  |---|---|---|
  | Favorite | any accepted answer | ×1 |
  | Dark Horse | 10/1 or longer | ×2 |
  | Long Shot | 33/1 or longer | ×3 |
  | Moonshot | 100/1 or longer | ×5 |

- **Payout.** Base chips are `10 × log2(1 + odds)`, capped at 100. Evens is worth 10, 100/1 is 67 and 1000/1 is 100. The base is multiplied by your chip's multiplier.
- **Bust.** You bust if your answer comes in at shorter odds than your chip needs, or the answer isn't accepted. Three busts end the card.
- **First call.** Be the first player anywhere to land an answer at 33/1 or longer and your name stays on it in the Trophy case and on High rollers.
- **Unlimited.** Endless rounds drawn from the whole deck, leaving out today's daily prompts. A run ends at three busts, or you can cash out after any round. Your best run is ranked on High rollers. Unlimited play doesn't affect the daily odds.

## How the odds work

Each prompt in `data/prompts.json` lists its known answers with a rough popularity weight, roughly the percent of ordinary players who would give that answer. The game blends those house weights with the picks other players have actually made:

```
p = (times other players named it + 50 × house probability) / (other players' picks + 50)
odds = (1 - p) / p, rounded down to a bookmaker's ladder (Evens, 6/4, … 33/1, 100/1, 1000/1)
```

The listed answers cover 95% of expected picks. An answer that isn't listed opens at about 500/1, which the ladder shows as 250/1.

## Running it

The game itself has no dependencies. The build scripts need Node 18 or newer, and you only need `npm install` to work on the server.

```bash
npm run check
```

That validates `data/prompts.json` and builds `index.html`. Open `index.html` in a browser to play.

To host it, turn on GitHub Pages for the repository and serve the `main` branch from the root.

### Three ways it runs

- **Public site, on its own.** Odds come from the house list alone and chips are saved in the browser. An answer that isn't listed counts as the listed answer it ends with ("giant squid" counts as Squid); otherwise it's voided, with no chips and no bust.
- **Public site with the table server** (below, free). The site becomes multiplayer. The server scores every answer, so scores can't be faked, and odds come from everyone's daily picks. First calls are global, and High rollers shows today's chip count and the best unlimited runs. Players pick a name, with no account or email.
- **Claude artifact.** The same multiplayer features run on Claude's own storage, with Claude as the pit boss for unlisted answers.

### Multiplayer on the public site (free)

The table server is a Cloudflare Worker (`worker/index.ts`) with a built-in SQLite database (a Durable Object). Both run on Cloudflare's free plan, and the database is created automatically when the Worker deploys.

1. **Deploy the Worker.** Sign up free at [dash.cloudflare.com](https://dash.cloudflare.com), open Workers & Pages, create an application and import this GitHub repository. Cloudflare reads `wrangler.toml` and deploys it. From a terminal you can run `npx wrangler login` and then `npm run worker:deploy` instead.
2. **Check it.** Opening the Worker's URL (something like `https://long-shot.<your-subdomain>.workers.dev`) should show `"table": true`.
3. **Point the site at it.** Set `serverUrl` in `config.json` to that URL. GitHub's web editor is fine. GitHub Pages redeploys and the site is multiplayer.

How the server keeps scores honest:
- The page tells the server which listed answer it matched, and the server checks that one entry against what was typed before scoring it.
- It only accepts each daily round once and in order, and only for that day's prompts.
- It won't repeat a prompt within an unlimited run.
- It only accepts calls from the sites listed in `ALLOWED_ORIGINS` in `wrangler.toml`, and rate-limits each IP.

If the server can't be reached, the page carries on and scores that round on the device.

**Optional pit boss.** To have Claude rule on answers that aren't on the house list, add a secret named `ANTHROPIC_API_KEY` to the Worker (Settings → Variables and Secrets, or `npx wrangler secret put ANTHROPIC_API_KEY`). It uses `claude-opus-5-5` at low effort: a few hundred tokens per ruling, and each ruling is cached for everyone. Set `MODEL = "claude-haiku-5-5"` in `wrangler.toml` to spend much less. Without a key nothing is billed, and unlisted answers are voided.

If you host the site somewhere other than `https://busyworkcitizen.github.io`, add that origin to `ALLOWED_ORIGINS`.

### Publishing as a Claude artifact

Use `dist/long-shot.artifact.html`, which `npm run build` creates, and declare these capabilities:

```json
{
  "db": {"rules": [
    {"path": "plays", "read": "view", "write": "owner"},
    {"path": "plays/{self}", "read": "view", "write": "interact"}
  ]},
  "user": {"scopes": ["profile"]},
  "sample": {}
}
```

Each player's results live in one document at `plays/<their id>`. Everyone can read every document, and players can only write their own.

## Project layout

```
src/game.html          The game page: markup, styles and script.
src/engine.mjs         Rules, daily card, answer matching and odds, shared by the page and the server.
data/prompts.json      Every prompt and its answers (58 prompts, about 56,000 answers).
scripts/build.cjs      Builds index.html and dist/long-shot.artifact.html (inlines the engine and prompts).
scripts/validate.cjs   Checks the prompt data for mistakes and answer collisions.
worker/index.ts        The table server: multiplayer scoring, odds, first calls, leaderboards, optional pit boss.
wrangler.toml          Server settings: allowed sites, database, pit boss model.
config.json            Tells the public site where the table server lives.
```

## Editing prompts

Each prompt in `data/prompts.json` looks like this:

```json
{"id":"fruit","cat":"Kitchen","q":"Name a fruit","answers":[
  ["Apple",30],
  ["Dragon fruit",0.8,["dragonfruit","pitaya"]],
  ...
]}
```

- **Answers.** Each one is `[label, weight]` or `[label, weight, [aliases]]`. Aliases are real alternative names. The matcher already handles case, accents, punctuation, plurals, spacing, a leading "the", and typos of one letter, or two in longer words.
- **`strip`** (optional) lists words the matcher ignores for that prompt, so "Mount Everest", "Mt Everest" and "Everest" all match. Plural forms are handled too.
- **Categories.** `cat` is one of Animal, Kitchen, Atlas, Culture, Wordplay, Science, Sporting or Everyday. Each maps to a card suit.
- **Validate.** Run `npm run validate` after editing. It fails on malformed entries and on two names that would match the same typed answer.

The daily schedule comes from the order and number of prompts. Adding, removing or reordering prompts reshuffles future daily cards, though cards already played keep their results.
