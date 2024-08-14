(async () => {
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

  const gl = canvas.getContext("webgl");

  if (gl == null) {
    alert("Unable to initialize WebGL");
    return;
  }

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

  const boxA = Bodies.rectangle(600, 1000, 80, 80);
  const boxB = Bodies.rectangle(300, 50, 80, 80);

  const complexBody = Bodies.fromVertices(400, 10, [
    [
      { x: 0, c: 100 },
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

  const upperWall = Bodies.rectangle(width / 2, 0, width, 20, {
    isStatic: true,
  });

  const midGround = Bodies.rectangle(width * 0.75, height / 2, width / 2, 30, {
    isStatic: true,
  });

  const startPlatform = Bodies.rectangle(
    400 + 382 / 2,
    1376 + 44 / 2,
    382,
    44,
    {
      isStatic: true,
    },
  );

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

  let bodies = [ship, startPlatform, finishPlatform];
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
      //   Vector.magnitude(Vector.sub(leftThrusterButtonPos, mouse)) <=

      //   80 * pixelRatio
      x <
      width / 2 - width * 0.125
    ) {
      leftThruster = true;
    }

    if (
      // Vector.magnitude(Vector.sub(rightThrusterButtonPos, mouse)) <=
      // 80 * pixelRatio
      x >
      width / 2 + width * 0.125
    ) {
      rightThruster = true;
    }
  });

  window.addEventListener("pointerup", (e) => {
    const x = e.pageX * window.devicePixelRatio;
    const y = e.pageY * window.devicePixelRatio;
    const mouse = Vector.create(x, y);

    if (
      // Vector.magnitude(Vector.sub(leftThrusterButtonPos, mouse)) <=
      // 80 * pixelRatio
      x <
      width / 2 - width * 0.125
    ) {
      leftThruster = false;
    }

    if (
      // Vector.magnitude(Vector.sub(rightThrusterButtonPos, mouse)) <=
      // 80 * pixelRatio
      x >
      width / 2 + width * 0.125
    ) {
      rightThruster = false;
    }
  });

  let camPos = Vector.create(ship.position.x, ship.position.y);
  let camVel = Vector.create(0, 0);

  engine.gravity.scale = 0.0001;

  let landed = false;
  let landTime = 0;
  let prevT = 0;

  function screenToClipX(x) {
    return (x / width - 0.5) * 2;
  }

  function screenToClipY(y) {
    return (0.5 - y / height) * 2;
  }

  const shipvshader = createShader(
    gl,
    gl.VERTEX_SHADER,
    `
    attribute vec4 v_position;
    uniform vec2 center;
    varying vec4 position;
    uniform float angle;
    uniform vec2 shipCenter;

    void main() {
       vec2 ppos = v_position.xy;
       // ppos.y *= ${height.toFixed(1)}/${width.toFixed(1)};
      vec2 pos = mat2(cos(angle), -sin(angle), sin(angle) , cos(angle)) * ppos.xy;
      gl_Position = vec4(pos.xy + shipCenter - center, 0., 1.);

      position = v_position;
    }

    `,
  );

  const vshader = createShader(
    gl,
    gl.VERTEX_SHADER,
    `

    attribute vec4 v_position;
    uniform vec2 center;
    varying vec4 position;

    void main() {

      gl_Position = vec4(v_position.xy, v_position.zw);
      position = v_position;
    }

    `,
  );

  const shippshader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    `
    precision highp float;
    varying vec4 position;
    uniform vec2 shipCenter;
    uniform vec2 center;

    void main() {

    vec4 color = vec4(1.0 - smoothstep( 0.08, 0.09, distance(position.xy, vec2(0.) )), 1., 1., 1.);
    gl_FragColor = vec4(color.xyz, 1.);
    }
    `,
  );

  const pshader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    `
    precision highp float;
    varying vec4 position;

    uniform vec2 img_size;
    uniform vec2 center;

    uniform sampler2D img;

    void main() {
      vec2 texPos = position.xy  + center;
      texPos = vec2(texPos.x + 1., 1. - texPos.y);

      texPos.x *= ${width.toFixed(1)}/img_size.x;
      texPos.y *= ${height.toFixed(1)}/img_size.y;
      texPos.y = 1. - texPos.y;

      vec4 texColor = texture2D(img, texPos);


      gl_FragColor = vec4(texColor.xyz, 1.);
    }
    `,
  );

  const pg = createProgram(gl, vshader, pshader);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);

  let pos = [-1, 1, 1, 1, 1, -1, -1, -1, -1, 1];

  const bg = new Image();
  bg.src = "Level.png";

  await new Promise((resolve, _) => {
    bg.onload = resolve;
  });

  console.log(bg);
  gl.useProgram(pg);

  const bgTex = gl.createTexture();

  gl.activeTexture(gl.TEXTURE0);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.bindTexture(gl.TEXTURE_2D, bgTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bg);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const texU = gl.getUniformLocation(pg, "img");
  gl.uniform1i(texU, 0);

  const imgSizeU = gl.getUniformLocation(pg, "img_size");
  gl.uniform2f(imgSizeU, bg.width, bg.height);

  const center = gl.getUniformLocation(pg, "center");
  gl.uniform2f(center, screenToClipX(camPos.x), screenToClipY(camPos.y));

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);

  const vattrib = gl.getAttribLocation(pg, "v_position");
  gl.vertexAttribPointer(vattrib, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vattrib);

  const varray = gl.create;

  const shipvbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, shipvbuf);
  let shipvs = [];

  for (const v of ship.vertices) {
    shipvs.push(
      screenToClipY(v.y) - screenToClipY(ship.position.y),
      screenToClipX(v.x) - screenToClipX(ship.position.x),
    );
  }

  shipvs.reverse();
  shipvs.push(shipvs[0], shipvs[1]);
  console.log(shipvs);

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shipvs), gl.STATIC_DRAW);
  const shipg = createProgram(gl, shipvshader, shippshader);
  gl.useProgram(shipg);
  const shipva = gl.getAttribLocation(shipg, "v_position");
  gl.vertexAttribPointer(shipva, 2, gl.FLOAT, false, 0, 0);
  const center2 = gl.getUniformLocation(shipg, "center");
  gl.uniform2f(center2, screenToClipX(camPos.x), screenToClipY(camPos.y));
  gl.enableVertexAttribArray(shipva);

  const angle = gl.getUniformLocation(shipg, "angle");
  gl.uniform1f(angle, ship.angle);

  const shipCenter = gl.getUniformLocation(shipg, "shipCenter");
  gl.uniform2f(
    shipCenter,
    screenToClipX(ship.position.x - camPos.x + width / 2),
    screenToClipY(ship.position.y - camPos.y + height / 2),
  );

  run(0);
  function run(t) {
    window.requestAnimationFrame(run);
    if (prevT == 0) prevT = t;
    const dt = Math.min(t - prevT, 1000 / 60); //deltaTime should never be too high, it will result in low accuracy
    prevT = t;
    Engine.update(engine, dt);

    //rendering

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(pg);

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.vertexAttribPointer(vattrib, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(center, screenToClipX(camPos.x), screenToClipY(camPos.y));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 5);

    gl.useProgram(shipg);
    gl.bindBuffer(gl.ARRAY_BUFFER, shipvbuf);
    // shipvs = [];
    // for (const v of ship.vertices) {
    //   shipvs.push(screenToClipX(v.x));
    //   shipvs.push(screenToClipX(v.y));
    // }

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shipvs), gl.STATIC_DRAW);
    const shipva = gl.getAttribLocation(shipg, "v_position");
    gl.vertexAttribPointer(shipva, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(angle, ship.angle);
    gl.uniform2f(center2, screenToClipX(camPos.x), screenToClipY(camPos.y));
    gl.uniform2f(
      shipCenter,
      screenToClipX(ship.position.x),
      screenToClipY(ship.position.y),
    );

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, shipvs.length / 2);

    //other logics

    Engine.update(engine, 1000 / 60);

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
      Vector.magnitude(Vector.sub(ship.position, finishPlatform.position)) <=
        100
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

    const dp = Vector.sub(ship.position, camPos);
    let accel = (collided ? 0.1 : 0.02) * Vector.magnitude(dp);
    const norm_dp = Vector.normalise(dp);
    camVel = Vector.add(camVel, Vector.mult(norm_dp, accel));
    camVel = Vector.sub(camVel, Vector.mult(camVel, collided ? 0.05 : 0.4));
    camPos = Vector.add(camPos, Vector.mult(camVel, dt));
  }
})();
