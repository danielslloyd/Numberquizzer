# Math Visualizer — Claude Code Spec

## Overview
A single-page web app for children (ages 7–9) that visualizes arithmetic expressions as animated 3D block simulations. The user types an equation, hits Enter, and watches an animation that builds the result visually before dropping the blocks in a physics simulation.

---

## Tech Stack
- **Framework:** Vanilla HTML/CSS/JS or a lightweight bundler (Vite) — no React needed
- **3D & Physics:** Three.js for rendering + Rapier (WASM) or Cannon-es for physics; Claude Code should choose whichever is easier to bundle and produces stable block-stacking behavior
- **No backend required** — fully static, deployable via file:// or Netlify

---

## Input Bar

- Fixed at the top of the screen, full width
- Large font (≥24px), centered
- Accepts numeric values and the operators `+`, `×` (or `*`), and `×` typed as `x` should also be accepted
- Input is validated on Enter: only digits, whitespace, and `+`, `*`, `x`, `×` are allowed
- Max value for any single number: **20**
- Max total result: if the computed answer exceeds **8000** (20×20×20), show a friendly error: *"That's too many blocks! Try smaller numbers."*
- On valid Enter: clear/lock the input and begin the animation sequence
- A **Reset** button (or pressing Enter on a cleared input) resets the scene

---

## Expression Parsing

Parse the expression left to right, respecting standard order of operations (multiplication before addition). Represent the parsed result as a tree of operations for the animator to consume.

**Supported expression types and their visual behaviors:**

| Expression shape | Example | Visual |
|---|---|---|
| Single multiplication | `4 × 3` | 2D grid → fill → extrude to 3D → drop |
| Double multiplication | `4 × 3 × 5` | 2D grid → fill → extrude to 3D prism → drop |
| Pure addition | `3 + 5` | Two block groups → slide together → drop |
| Mixed (mult + add) | `2 × 3 + 4` | Multiply group(s) animated first, then addition group slides in → drop |

---

## Animation Sequence

All animations play automatically on Enter, in sequence. No user interaction needed between steps.

### For Multiplication (`A × B`)

1. **Draw grid** — A 2D grid of A columns × B rows fades in on the floor plane, with faint grid lines and axis labels (*"4 columns"*, *"3 rows"*)
2. **Fill grid** — Cells fill in one row at a time with colored flat squares (moderate pace, ~0.8s total)
3. **Extrude to cubes** — Each cell rises into a unit cube; the flat grid becomes a rectangular prism 1 unit tall
4. **Label appears** — Show `4 × 3 = 12` in large text, centered, above the scene

### For Triple Multiplication (`A × B × C`)

1–3. Same as above (A × B rectangle)
4. **Extrude into third dimension** — The A × B rectangle lies flat in the XY plane (facing the camera). The third factor C extrudes the layer **away from the camera along the Z axis** (i.e., depth), building a full 3D prism. The original front face remains in the same XY plane; new layers stack behind it.
5. **Label appears** — Show `4 × 3 × 5 = 60`
6. **Camera note:** the camera should be positioned so the full XY face is clearly visible before the drop; after extrusion it may orbit slightly to reveal depth

### For Addition

- Each addend is rendered as a separate pile/group of cubes (or a flat filled rectangle if the addend is itself a product)
- Groups sit apart from each other on the floor with a visible gap and a `+` label floating between them
- After a short pause, the groups slide toward each other and merge
- Label shows the full expression and result

### Physics Drop (final step, all expression types)

- Once the final shape is assembled, it **shatters** — the individual cubes become rigid bodies
- They fall under gravity and pile/scatter realistically on a flat floor plane
- The floor and side walls are invisible but present as physics colliders (to keep cubes on screen)
- Camera orbits slowly around the pile after settling
- The answer label (`= 12`) persists in the corner of the screen throughout

---

## Visual Style

- **Background:** white
- **Cubes:** bright, saturated colors — use a distinct color per multiplicand group (e.g., one color per row, or one color per layer in 3D); addition groups get different hues
- **Grid lines:** faint blue at low opacity
- **Labels:** large, bold, white sans-serif; use a friendly rounded font (e.g., Google Fonts: *Nunito* or *Fredoka One*)
- **Answer display:** shown in large text bottom-center after animation completes, styled like `4 × 3 = 12`
- Camera starts facing the XY plane head-on (or very slight angle) so the initial 2D grid reads clearly; after the physics drop it slowly orbits for a "wow" effect

---

## UI / UX Notes

- App should work on desktop browser (Chrome/Firefox); mobile is a nice-to-have, not required
- Aim for a clean, minimal UI — the animation is the whole experience
- The input bar should re-activate after the Reset button is pressed
- No sound required
- No score-keeping or levels — pure visualizer

---

## File Structure (suggested)

```
/
├── index.html
├── style.css
├── main.js
├── parser.js        # expression parsing + operation tree
├── animator.js      # Three.js scene, animation sequence
├── physics.js       # Rapier/Cannon setup, drop simulation
└── README.md
```

---

## Out of Scope (for now)
- Subtraction or division
- Saving history
- Mobile touch input
- Sound/music
- Fractions or decimals
