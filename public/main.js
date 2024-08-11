const Engine = Matter.Engine,
  Render = Matter.Render,
  Runner = Matter.Runner,
  Bodies = Matter.Bodies,
  Body = Matter.Body,
  Composite = Matter.Composite,
  Vector = Matter.Vector;

const engine = Engine.create();

const render = Render.create({
  element: document.body,
  engine: engine,
  options: {
    wireframes: false,
  },
});

Render.setSize(render, window.innerWidth, window.innerHeight);

window.onresize = () => {
  Render.setSize(render, window.innerWidth, window.innerHeight);
};

engine.gravity.scale = 0.0001;

const boxA = Bodies.rectangle(200, 200, 80, 80);
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

const ship = Bodies.rectangle(300, window.innerHeight - 160, 250, 87, {});
ship.render.sprite.texture = "./shiptexture.png";
let shipHealth = 100;

const ground = Bodies.rectangle(
  window.innerWidth / 2,
  window.innerHeight - 30,
  window.innerWidth,
  60,
  { isStatic: true },
);

const leftWall = Bodies.rectangle(
  0,
  window.innerHeight / 2,
  20,
  window.innerHeight,
  {
    isStatic: true,
  },
);
const rightWall = Bodies.rectangle(
  window.innerWidth - 10,
  window.innerHeight / 2,
  20,
  window.innerHeight,
  { isStatic: true },
);

const upperWall = Bodies.rectangle(
  window.innerWidth / 2,
  0,
  window.innerWidth,
  20,
  { isStatic: true },
);

const midGround = Bodies.rectangle(
  window.innerWidth * 0.75,
  window.innerHeight / 2,
  window.innerWidth / 2,
  30,
  { isStatic: true },
);

const finishPlatform = Bodies.rectangle(
  window.innerWidth * 0.75,
  window.innerHeight / 2 - 20,
  300,
  20,
  { isStatic: true },
);

finishPlatform.render.fillStyle = "rgba(252, 215, 3, 1)";

const otherBodies = [
  boxA,
  // boxB,
  ground,
  // complexBody,
  leftWall,
  rightWall,
  upperWall,
  midGround,
  finishPlatform,
];

Composite.add(engine.world, [
  boxA,
  // boxB,
  ground,
  // complexBody,
  ship,
  leftWall,
  rightWall,
  upperWall,
  midGround,
  finishPlatform,
]);

Render.run(render);

const PI = Math.PI;
const PI_2 = Math.PI / 2;

let leftThruster, rightThruster;

window.addEventListener("keydown", (e) => {
  leftThruster = e.key == "a" || leftThruster;
  rightThruster = e.key == "d" || rightThruster;
});

window.addEventListener("keyup", (e) => {
  if (e.key == "a") leftThruster = false;
  if (e.key == "d") rightThruster = false;
});

const runner = Runner.create();

let prevT = 0;

const collissionMap = {};

const leftThrusterButtonPos = Vector.create(100, window.innerHeight - 100);
const rightThrusterButtonPos = Vector.create(
  window.innerWidth - 100,
  window.innerHeight - 100,
);
window.addEventListener("pointerdown", (e) => {
  const x = e.pageX;
  const y = e.pageY;
  const mouse = Vector.create(x, y);
  console.log(x, Bodies);

  if (Vector.magnitude(Vector.sub(leftThrusterButtonPos, mouse)) <= 80) {
    leftThruster = true;
  }

  if (Vector.magnitude(Vector.sub(rightThrusterButtonPos, mouse)) <= 80) {
    rightThruster = true;
  }
});

window.addEventListener("pointerup", (e) => {
  const x = e.pageX;
  const y = e.pageY;
  const mouse = Vector.create(x, y);

  if (Vector.magnitude(Vector.sub(leftThrusterButtonPos, mouse)) <= 80) {
    leftThruster = false;
  }

  if (Vector.magnitude(Vector.sub(rightThrusterButtonPos, mouse)) <= 80) {
    rightThruster = false;
  }
});

let landed = false;
let landTime = 0;

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

  for (const other of otherBodies) {
    const collission = Matter.Collision.collides(ship, other);

    if (collission != null && collissionMap[other.id] != true) {
      shipHealth -= collission.depth * 10;
      collissionMap[other.id] = true;
    } else if (collissionMap[other.id] == true && collission == null) {
      collissionMap[other.id] = false;
    }
  }

  const landedCollission = Matter.Collision.collides(ship, finishPlatform);

  if (
    landedCollission != null &&
    landedCollission.supports.length >= 2 &&
    ship.angularSpeed < 1e-6 &&
    ship.speed < 1e-1
  ) {
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
  render.context.fillStyle = "white";
  render.context.font = "30px serif";
  render.context.fillText(`Health: ${shipHealth.toFixed(0)}`, 100, 100);

  const ctx = render.context;
  ctx.strokeStyle = `rgba(255, 255, 255, ${leftThruster ? 0.7 : 0.2})`;
  ctx.lineWidth = leftThruster ? 20 : 4;
  render.context.beginPath();
  ctx.arc(100, window.innerHeight - 100, 80, 0, 2 * PI);
  ctx.stroke();
  render.context.closePath();

  ctx.strokeStyle = `rgba(255, 255, 255, ${rightThruster ? 0.7 : 0.2})`;
  ctx.lineWidth = rightThruster ? 20 : 4;
  ctx.beginPath();
  ctx.arc(window.innerWidth - 100, window.innerHeight - 100, 80, 0, 2 * PI);
  ctx.stroke();
  ctx.closePath();

  if (landed) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + ((t - landTime) / 4000) * 0.6})`;
    ctx.fillRect(
      ship.position.x - 125,
      ship.position.y - 100,
      ((t - landTime) / 4000) * 250,
      30,
    );
  }
}
window.requestAnimationFrame(run);
