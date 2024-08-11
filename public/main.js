const canvas = document.getElementById("canvas1");

const ctx = canvas.getContext("2d");
ctx.canvas.width = window.innerWidth;
ctx.canvas.height = window.innerHeight;

let y = 100;

let vy = 0.0;
let ay = 0.008;

let tPrev = -1;
function draw(tNow) {
  if (tPrev < 0) tPrev = tNow;
  const dt = (tNow - tPrev) * 0.001;

  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const text = "Epic space game";
  ctx.font = "30px serif";
  ctx.fillStyle = "rgba(255, 255, 255, 1)";
  ctx.fillText(text, canvas.width / 2 - ctx.measureText(text).width, y);

  vy += ay * dt;
  y += vy * dt;
  if (y >= canvas.height) vy = -vy * 0.8;
  if (y > canvas.height) y = canvas.height;

  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
