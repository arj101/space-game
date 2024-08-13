const Engine = Matter.Engine,
  Render = Matter.Render,
  Runner = Matter.Runner,
  Bodies = Matter.Bodies,
  Body = Matter.Body,
  Composite = Matter.Composite,
  Vector = Matter.Vector;

const engine = Engine.create();

const pixelRatio = window.devicePixelRatio;

let width = window.innerWidth * pixelRatio,
  height = window.innerHeight * pixelRatio;

const canvas = document.createElement("canvas");
canvas.width = width;
canvas.height = height;
canvas.style.width = window.innerWidth + "px";
canvas.style.height = window.innerHeight + "px";
document.body.appendChild(canvas);

const ctx = canvas.getContext("2d");

window.onresize = () => {
  width = window.innerWidth * pixelRatio;
  height = window.innerHeight * pixelRatio;
};

const terrainVertices = [
  { x: 316, y: 1455 },
  { x: 840, y: 1455 },
  { x: 890, y: 1288 },
  { x: 981, y: 1156 },
  { x: 1212, y: 1129 },
  { x: 1281, y: 1143 },
  { x: 1643, y: 1288 },
  { x: 1680, y: 1441 },
  { x: 2031, y: 1441 },
  { x: 2096, y: 1328 },
  { x: 2070, y: 1143 },
  { x: 2070, y: 989 },
  { x: 2265, y: 755 },
  { x: 2179, y: 598 },
  { x: 1860, y: 482 },
  { x: 1630, y: 552 },
  { x: 1547, y: 554 },
  { x: 1096, y: 341 },
  { x: 768, y: 391 },
  { x: 612, y: 587 },
  { x: 400, y: 778 },
  { x: 437, y: 928 },
  { x: 352, y: 1175 },
  { x: 316, y: 1455 },
];

const bg = new Image();
bg.src = "./Level.png";
bg.width = 2581;
bg.height = 1799;

function buildTerrain(vertices) {
  let bodies = [];

  for (let i = 0; i < vertices.length - 1; i++) {
    const v1 = vertices[i];
    const v2 = vertices[i + 1];

    const outsideNormal = Vector.normalise(Vector.perp(Vector.sub(v2, v1)));

    const v3 = Vector.add(v2, Vector.mult(outsideNormal, 10));
    const v4 = Vector.add(v1, Vector.mult(outsideNormal, 10));

    const verticesG = [[v1, v2, v3, v4]];
    const cx = (v1.x + v2.x + v3.x + v4.x) / 4;
    const cy = (v1.y + v2.y + v3.y + v4.y) / 4;
    bodies.push(Bodies.fromVertices(cx, cy, verticesG, { isStatic: true }));
  }

  return bodies;
}

engine.gravity.scale = 0.0001;

const boxA = Bodies.rectangle(600, 1000, 80, 80);
const boxB = Bodies.rectangle(300, 50, 80, 80);

const complexBody = Bodies.fromVertices(400, 10, [
  [
    { x: 0, y: 100 },
    { x: 95, y: 30 },
    { x: 60, y: -80 },
    { x: -60, y: -80 },
    { x: -95, y: 30 },
  ],
]);

const shipPos = { x: 600, y: 1322 };
const shipBody = Bodies.rectangle(shipPos.x, shipPos.y, 250, 87, {});
const shipLThrust = Bodies.rectangle(
  shipPos.x - 125 - 15,
  shipPos.y + 17,
  30,
  60,
  {},
);
const shipRThrust = Bodies.rectangle(
  shipPos.x + 125 + 15,
  shipPos.y + 17,
  30,
  60,
  {},
);

shipBody.render.sprite = "./shiptexture.png";
const ship = Body.create({
  parts: [shipBody, shipLThrust, shipRThrust],
});

let shipHealth = 100;

const ground = Bodies.rectangle(
  window.innerWidth / 2,
  window.innerHeight - 30,
  window.innerWidth,
  60,
  { isStatic: true },
);

const leftWall = Bodies.rectangle(0, height / 2, 20, height, {
  isStatic: true,
});
const rightWall = Bodies.rectangle(width - 10, height / 2, 20, height, {
  isStatic: true,
});

const upperWall = Bodies.rectangle(width / 2, 0, width, 20, { isStatic: true });

const midGround = Bodies.rectangle(width * 0.75, height / 2, width / 2, 30, {
  isStatic: true,
});

const startPlatform = Bodies.rectangle(400 + 382 / 2, 1376 + 44 / 2, 382, 44, {
  isStatic: true,
});

const finishPlatform = Bodies.rectangle(
  1670 + 383 / 2,
  1362 + 44 / 2,
  383,
  44,
  { isStatic: true },
);

finishPlatform.render.fillStyle = "rgba(252, 215, 3, 1)";

const terrain = buildTerrain(terrainVertices);
const otherBodies = [
  boxA,
  // boxB,
  // ground,
  // // complexBody,
  // leftWall,
  // rightWall,
  // upperWall,
  // midGround,
  // finishPlatform,
  startPlatform,
  finishPlatform,
];

let bodies = [boxA, ship, startPlatform, finishPlatform];
bodies.push(...terrain);

Composite.add(engine.world, bodies);

const PI = Math.PI;
const PI_2 = Math.PI / 2;

let leftThruster, rightThruster;

window.addEventListener("keydown", (e) => {
  leftThruster = e.key == "a" || e.key == "ArrowLeft" || leftThruster;
  rightThruster = e.key == "d" || e.key == "ArrowRight" || rightThruster;
});

window.addEventListener("keyup", (e) => {
  if (e.key == "a" || e.key == "ArrowLeft") leftThruster = false;
  if (e.key == "d" || e.key == "ArrowRight") rightThruster = false;
});

const runner = Runner.create();

let prevT = 0;

const collissionMap = {};

const leftThrusterButtonPos = Vector.create(
  100 * pixelRatio,
  height - 100 * pixelRatio,
);
const rightThrusterButtonPos = Vector.create(
  width - 100 * pixelRatio,
  height - 100 * pixelRatio,
);
window.addEventListener("pointerdown", (e) => {
  const x = e.pageX * window.devicePixelRatio;
  const y = e.pageY * window.devicePixelRatio;
  const mouse = Vector.create(x, y);

  if (
    Vector.magnitude(Vector.sub(leftThrusterButtonPos, mouse)) <=
    80 * pixelRatio
  ) {
    leftThruster = true;
  }

  if (
    Vector.magnitude(Vector.sub(rightThrusterButtonPos, mouse)) <=
    80 * pixelRatio
  ) {
    rightThruster = true;
  }
});

window.addEventListener("pointerup", (e) => {
  const x = e.pageX * window.devicePixelRatio;
  const y = e.pageY * window.devicePixelRatio;
  const mouse = Vector.create(x, y);

  if (
    Vector.magnitude(Vector.sub(leftThrusterButtonPos, mouse)) <=
    80 * pixelRatio
  ) {
    leftThruster = false;
  }

  if (
    Vector.magnitude(Vector.sub(rightThrusterButtonPos, mouse)) <=
    80 * pixelRatio
  ) {
    rightThruster = false;
  }
});

let landed = false;
let landTime = 0;

let camPos = Vector.create(ship.position.x, ship.position.y);
let camVel = Vector.create(0, 0);

const bodyTex = new Image();
bodyTex.src = "./shipbody.png";

const lThrusterTex = new Image();
lThrusterTex.src = "./lThruster.png";

const rThrusterTex = new Image();
rThrusterTex.src = "./rThruster.png";

const flame = new Image();
flame.src = "./flame.png";

function run(t) {
  window.requestAnimationFrame(run);

  if (prevT == 0) prevT = t;
  const dt = Math.min(t - prevT, 1000 / 60); //deltaTime should never be too high, it will result in low accuracy
  prevT = t;

  if (leftThruster || rightThruster) {
    let forceOrigin = Vector.create(ship.position.x, ship.position.y);
    const fOriginOffset = Vector.rotate(
      Vector.create(0, -100),
      ship.angle -
        (leftThruster ? 1 : 0) * PI_2 +
        (rightThruster ? 1 : 0) * PI_2,
    );

    const forceMag = leftThruster && rightThruster ? 0.02 : 0.01;

    const forceOriginOff = Vector.add(forceOrigin, fOriginOffset);
    const force = Vector.rotate(Vector.create(0, -forceMag), ship.angle);

    Body.applyForce(ship, forceOriginOff, force);
  }

  let collided = false;
  for (const other of otherBodies) {
    const collission = Matter.Collision.collides(ship, other);

    if (collission != null && collissionMap[other.id] != true) {
      shipHealth -= collission.depth * 10;
      collissionMap[other.id] = true;
      collided = true;
    } else if (collissionMap[other.id] == true && collission == null) {
      collissionMap[other.id] = false;
    }
  }

  const collides = Matter.Collision.collides;
  let landedCollission =
    collides(shipLThrust, finishPlatform) ||
    collides(shipRThrust, finishPlatform) ||
    collides(shipBody, finishPlatform);

  if (
    landedCollission != null &&
    landedCollission.supports.length >= 2 &&
    ship.angularSpeed < 1e-6 &&
    ship.speed < 1e-1 &&
    Math.abs(ship.angle) <= 0.1 &&
    Vector.magnitude(Vector.sub(ship.position, finishPlatform.position)) <= 100
  ) {
    console.log();
    if (!landed) {
      landed = true;
      landTime = t;
    }

    if (t - landTime > 4000) {
      landTime = t - 4000;
    }
  } else {
    landed = false;
    landTime = -1;
  }

  Engine.update(engine, dt);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgb(12, 13, 14)";
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width / 2 - camPos.x, height / 2 - camPos.y);

  ctx.drawImage(bg, 0, 0, 2581, 1779);
  ctx.restore();

  ctx.fillStyle = "white";
  ctx.font = "30px serif";
  ctx.fillText(`Health: ${shipHealth.toFixed(0)}`, 100, 100);

  ctx.strokeStyle = `rgba(255, 255, 255, ${leftThruster ? 0.7 : 0.2})`;
  ctx.lineWidth = leftThruster ? 20 : 4;
  ctx.beginPath();
  ctx.arc(
    100 * pixelRatio,
    window.innerHeight - 100 * pixelRatio,
    80 * pixelRatio,
    0,
    2 * PI + 0.1,
  );
  ctx.stroke();
  ctx.closePath();

  ctx.strokeStyle = `rgba(255, 255, 255, ${rightThruster ? 0.7 : 0.2})`;
  ctx.lineWidth = rightThruster ? 20 : 4;
  ctx.beginPath();
  ctx.arc(
    width - 100 * pixelRatio,
    height - 100 * pixelRatio,
    80 * pixelRatio,
    0,
    2 * PI + 0.1,
  );
  ctx.stroke();
  ctx.closePath();

  if (landed) {
    ctx.fillStyle = `rgba(255, 255, 255, ${
      0.4 + ((t - landTime) / 4000) * 0.6
    })`;
    ctx.fillRect(
      width / 2 - 125,
      height / 2 - 100,
      ((t - landTime) / 4000) * 250,
      30,
    );
  }
  ctx.save();
  ctx.translate(width / 2 - camPos.x, height / 2 - camPos.y);

  const dp = Vector.sub(ship.position, camPos);
  let accel = (collided ? 0.1 : 0.02) * Vector.magnitude(dp);

  const norm_dp = Vector.normalise(dp);

  camVel = Vector.add(camVel, Vector.mult(norm_dp, accel));
  camVel = Vector.sub(camVel, Vector.mult(camVel, collided ? 0.05 : 0.4));
  camPos = Vector.add(camPos, Vector.mult(camVel, dt));

  // ctx.strokeStyle = "white";
  // ctx.lineWidth = 2;
  // for (const body of engine.world.bodies) {
  //   if (body.id == ship.id) continue;
  //   ctx.beginPath();
  //   for (const v of body.vertices) ctx.lineTo(v.x, v.y);
  //   ctx.closePath();
  //   ctx.stroke();
  // }

  ctx.fillStyle = "rgb(34, 168, 230)";
  ctx.beginPath();
  for (const v of boxA.vertices) {
    ctx.lineTo(v.x, v.y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.translate(shipBody.position.x, shipBody.position.y);

  ctx.rotate(ship.angle);
  ctx.drawImage(bodyTex, -125, -87 / 2, 250, 87);
  if (leftThruster) {
    ctx.drawImage(flame, -125 - 30, 87 / 2 - 10, 30, 30);
  }

  if (rightThruster) {
    ctx.drawImage(flame, 125 + 4, 87 / 2 - 10, 30, 30);
  }
  ctx.drawImage(lThrusterTex, -125 - 30, -87 / 2 + 30, 30, 60);
  ctx.drawImage(rThrusterTex, 125, -87 / 2 + 30, 30, 60);
  ctx.restore();

  ctx.restore();
}
window.requestAnimationFrame(run);
