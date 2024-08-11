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

const boxA = Bodies.rectangle(400, 200, 80, 80);
const boxB = Bodies.rectangle(450, 50, 80, 80);

const complexBody = Bodies.fromVertices(400, 10, [
  [
    { x: 0, y: 100 },
    { x: 95, y: 30 },
    { x: 60, y: -80 },
    { x: -60, y: -80 },
    { x: -95, y: 30 },
  ],
]);

const ship = Bodies.rectangle(200, 50, 250, 87, {});
ship.render.sprite.texture = "./shiptexture.png";

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

Composite.add(engine.world, [
  boxA,
  boxB,
  ground,
  complexBody,
  ship,
  leftWall,
  rightWall,
  upperWall,
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

  Engine.update(engine, dt);
}
window.requestAnimationFrame(run);
