_Built for the "Real Space Game" gaming competition conducted by ISTE SC GECB_

# Real Space Game

A retro-style 2D spaceship lander game built using **pure JavaScript** and **WebGL** — without any rendering frameworks or game engines.

> Pilot a lander through a stylized rocky terrain and attempt to land safely. Built from scratch with raw WebGL, Matter.js and procedural shaders.

**🌐 Live demo**: [space-game-vert.vercel.app](https://real-space-game.vercel.app) (no global leaderboard)

## Features

- **Low-level WebGL rendering** (no game engine or rendering library)
- Procedurally shaded terrain - highly detailed textures using procedural noise (perlin + voronoi)
- Physics-based simulation (gravity, thrust, rotation, momentum) - using matter.js
- Retro-style UI
- Visual effects using GLSL shaders
- Global leaderboard (if using server enabled version)

## 🕹 Controls

| Key       | Action               |
| --------- | -------------------- |
| `A` / `←` | Apply left thruster  |
| `D` / `→` | Apply right thruster |

## 🛠 Tech Stack

- **Language**: JavaScript (ES6+)
- **Graphics**: WebGL (raw API) - ship, terrain and effects; HTML5 Canvas (2D rendering context) - UI and text rendering
- **Physics**: Matter.js
