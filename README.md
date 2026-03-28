

# Atomic Code - Nuclear Activation Terminal

**Fallout-inspired retro terminal puzzle game**. Decode ciphers from field officers to activate nuclear codes in authentic RobCo Industries style.


## 🎮 How to Play (Detailed)

1. **Cipher Key**: Click the pulsing keyword to open Decryptor. Builds substitution alphabet (KEY unique letters + ABC remainder).
2. **Officer Reports**: Each officer gives encrypted letter + digit code (e.g., 'X': '7').
3. **Decode**: Map cipher letters back to A-Z using table.
4. **Form Word**: Letters form target word (length = WORD_LENGTH const, default 5).
5. **Enter Code**: Digits in **target word letter order** (not officer order).
6. **Hints**: 3 attempts. Wrong guess reveals positions (configurable).
7. **Win**: Correct code → Success. Lose: Word/password shown.

**Controls**:
- Enter: Submit code.
- ESC/X: Close modal.
- Mouse/Drag: Workbench reorder letters.
- Global focus: Inputs always active.

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Retro Terminal** | Scanlines, flicker, CRT glow, green monochrome, monospace fonts. |
| **Boot Sequence** | 9s blackout + fade-in for immersion. |
| **Advanced Audio** | Startup.mp3, looping humm.mp3 (crossfade), click sounds. Fade-in volume. |
| **Decryptor Modal** | Interactive alphabet table, officer recap, drag workbench, input mirror. |
| **Hints System** | Position reveals on guess (UNCOVER_GUESS_LETTERS=true), "Terminal Memory" display. |
| **Animations** | Framer Motion: Entrances, modals, success screens. |
| **Configurable** | Edit src/App.tsx: `WORD_LENGTH = 4-8` for officer/word length. Consistent digits per letter. |
| **Word DB** | words.txt + fallback list (200+ words). Expand for more. |
| **Responsive** | Mobile-friendly with focus management. |
| **Accessibility** | Keyboard nav, high contrast. |

## 🛠️ Development

### Prerequisites
- Node.js 20+

### Quick Start
```bash
npm install
npm run dev
```
- Local: http://localhost:3000
- Network: http://[IP]:3000

### Scripts
- `npm run dev` - Development server (port 3000, host all).
- `npm run build` - Production build (`dist/`).
- `npm run preview` - Preview build.
- `npm run lint` - TypeScript check (`tsc --noEmit`).
- `npm run clean` - Remove `dist/`.

### Configuration
Edit these constants at the top of `src/App.tsx` to customize gameplay:

| Config | Description | Default | Effect |
|--------|-------------|---------|--------|
| `WORD_LENGTH` | Number of field officers, puzzle items, target word letters, and input digits | `5` | Set 4-8. Larger values create harder puzzles with more decoding. Dynamically scales UI (input length, officer grid columns, etc.). |
| `CONSISTENT_CODE_FOR_SAME_LETTER` | Whether the same plaintext letter always maps to the same digit across all officers | `true` | `true`: Consistent (e.g., all 'A's = '3'). `false`: Random digit per occurrence. `false` is harder with repeating letters having different codes. |
| `UNCOVER_GUESS_LETTERS` | Hint reveal style on failed guesses (3 attempts total) | `true` | `true`: Reveals **all** positions where your guessed digit matched the correct code. `false`: Reveals only one random unrevealed position per guess. |

**Example:**
```ts
const WORD_LENGTH = 6; // 6 officers/word
const CONSISTENT_CODE_FOR_SAME_LETTER = false; // Random digits for same letter
const UNCOVER_GUESS_LETTERS = true;
```

**Note:** Changes require restarting the dev server (`npm run dev`).

### Adding Words
Append to `src/words.txt` (lowercase, one per line, 4-8 letters).

### Screenshots
Add to `public/screenshots/`:
1. Terminal home.
2. Decryptor open.
3. Success screen.

## 🚀 Build & Deploy

```bash
npm run build
```
- Static files in `dist/`.
- Deploy to Netlify/Vercel/GitHub Pages (Vite optimized).

Tailwind via `@tailwindcss/vite` - production purged.

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript 5.8, Vite 6.2
- **Styling**: Tailwind CSS 4.1 (JIT)
- **Icons**: Lucide React 0.546
- **Animation**: Motion (Framer Motion 12.23)
- **Audio**: Native Web Audio API (3 sounds)
- **Utils**: Custom scrollbars, global focus trap.

## 🤝 Contributing

1. Fork & PR.
2. Add words to `words.txt`.
3. Update configs in App.tsx.
4. `npm run lint` before push.

## 📄 License

Apache-2.0 (see LICENSE or SPDX in source).

**Play now at http://localhost:3000!**
