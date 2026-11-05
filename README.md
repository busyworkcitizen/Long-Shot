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
- **First call.** Be the first player to land an answer at 33/1 or longer and your name stays on it in the Trophy case and on High rollers.
- **Unlimited.** Endless rounds drawn from the whole deck, leaving out today's daily prompts. A run ends at three busts, or you can cash out after any round. Your best run is ranked on High rollers. Unlimited play doesn't affect the daily odds.

## How the odds work

Each prompt in `data/prompts.json` lists its known answers with a rough popularity weight, roughly the percent of ordinary players who would give that answer. The game blends those house weights with the picks other players have actually made:

```
p = (times other players named it + 50 × house probability) / (other players' picks + 50)
odds = (1 - p) / p, rounded down to a bookmaker's ladder (Evens, 6/4, … 33/1, 100/1, 1000/1)
```

The listed answers cover 95% of expected picks. An answer that isn't listed opens at about 500/1, which the ladder shows as 250/1.

## Running it

There are no dependencies, only Node 18 or newer for the build scripts.

```bash
npm run check
```

That validates `data/prompts.json` and builds `index.html`. Open `index.html` in a browser to play.

To host it, turn on GitHub Pages for the repository and serve the `main` branch from the root.

### Standalone vs. Claude artifact

Some features need the Claude artifact runtime:
- a shared table, so odds come from everyone's picks, with the High rollers leaderboard and first calls
- player names and avatars
- the **pit boss**, where Claude rules on answers that aren't in the house list

The standalone `index.html` runs without them. Odds come from the house list alone, your chips are saved in the browser, and unlisted answers are voided (no chips, no bust).

To publish it as an artifact, use `dist/long-shot.artifact.html`, which `npm run build` creates. Declare these capabilities:

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
src/game.html          The game: markup, styles and script. The prompt bank is injected at /*@@BANK@@*/.
data/prompts.json      Every prompt and its answers (58 prompts, about 15,000 answers).
scripts/build.cjs      Builds index.html and dist/long-shot.artifact.html.
scripts/validate.cjs   Checks the prompt data for mistakes and answer collisions.
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
