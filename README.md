# Standup Spinner 🎡

A "whose turn is it to host standup" randomiser for teams.

## Features

- **Team members** — Add and remove names from your team list.
- **Fair rotation** — Tracks who has already hosted in the current cycle. Once everyone has had a turn, the cycle resets automatically, so no one hosts twice before everyone has gone.
- **Animated spinner** — Hit **Spin!** for a ~4-second slot-machine animation where names morph through the list before landing on the lucky host.
- **Persistent state** — Your team list and cycle progress are saved in `localStorage` so they survive page refreshes.

## Getting started

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

## Usage

1. Add your team members using the input field on the right.
2. Click **Spin!** to pick today's standup host.
3. Members who have already hosted this cycle are shown with a **✓** badge and appear dimmed.
4. Available members are highlighted with a purple dot.
5. Once everyone has hosted once, the cycle resets automatically.
6. Use **Reset Cycle** to manually restart the rotation at any time.
