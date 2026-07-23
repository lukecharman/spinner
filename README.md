# The Load Balancer 🎡

A shared “whose turn is it to host?” randomizer for teams.

## Features

- **Shared team rooms** — Join with a room code or a `?room=<code>` link. Each room has isolated Firebase-backed members, cycle progress, spins, and settings.
- **Fair rotation** — A member cannot be selected twice in one cycle. A completed cycle remains visible until the next spin starts a new cycle.
- **Persistent state** — Members and turn history survive refreshes and stay synchronized across connected browsers.
- **Animated selectors** — Choose from the wheel, instant reveal, capsule machine, combination vault, or tarot cards.
- **Safe resets and re-spins** — Reset clears only the current room’s cycle, while a re-spin atomically replaces the latest selection.

## Getting started

```bash
npm ci
npm run dev
```

Vite serves the app under its configured `/spinner/` base path.

## Usage

1. Create or enter a room code and share it with the team.
2. Add or remove team members in the side panel.
3. Trigger the selected visualization to choose the next host.
4. Use **Reset Cycle** to make everyone eligible again.
5. Use **Switch Room** to leave without changing that room’s saved data.
