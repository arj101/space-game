const main = async () => {
  const Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Composite = Matter.Composite,
    Vector = Matter.Vector;

  const engine = Engine.create();

  const pixelRatio = window.devicePixelRatio;

  let width = 1928,
    height = 1080;

  const canvasContainer = document.getElementById("container");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  //assume landscape
  const aspectRatioDesired = 16 / 9;
  const aspectRatio = window.innerWidth / window.innerHeight;

  const heightIsSmaller = aspectRatioDesired < aspectRatio;

  canvas.style.width = heightIsSmaller ? "auto" : "100%";
  canvas.style.height = heightIsSmaller ? "100%" : "auto";
  canvasContainer.appendChild(canvas);

  const overlayCanvas = document.createElement("canvas");
  overlayCanvas.width = width;
  overlayCanvas.height = height;
  overlayCanvas.style.width = heightIsSmaller ? "auto" : "100%";
  overlayCanvas.style.height = heightIsSmaller ? "100%" : "auto";
  overlayCanvas.style.position = "absolute";
  // overlayCanvas.style.top = "auto";
  // overlayCanvas.style.left = "auto";
  canvasContainer.appendChild(overlayCanvas);

  window.onresize = () => {
    const aspectRatio = window.innerWidth / window.innerHeight;
    const heightIsSmaller = aspectRatioDesired < aspectRatio;
    canvas.style.width = heightIsSmaller ? "auto" : "100%";
    canvas.style.height = heightIsSmaller ? "100%" : "auto";
    overlayCanvas.style.width = heightIsSmaller ? "auto" : "100%";
    overlayCanvas.style.height = heightIsSmaller ? "100%" : "auto";
  };

  const ctx = overlayCanvas.getContext("2d");
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

  const shipPos = { x: width / 2, y: 400 };
  const shipBody = Bodies.rectangle(shipPos.x, shipPos.y, 250, 87, {});
  const shipLThrust = Bodies.rectangle(
    shipPos.x - 125 - 15,
    shipPos.y + 17,
    30,
    60,
    {}
  );
  const shipRThrust = Bodies.rectangle(
    shipPos.x + 125 + 15,
    shipPos.y + 17,
    30,
    60,
    {}
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
    { isStatic: true }
  );

  const startPlatform = Bodies.rectangle(
    400 + 382 / 2,
    1376 + 44 / 2,
    382,
    44,
    {
      isStatic: true,
    }
  );

  const GLOBAL_OBJ_SCALE = 0.4;

  const terrain = buildTerrain(terrainVertices);

  const collissionText = await loadText("./level1-collission.obj");
  let collissionObjs = parseOBJCollissionData(collissionText);

  collissionObjs = collissionObjs.map((collissionObj) =>
    scaleOBJ(
      (GLOBAL_OBJ_SCALE * height) / width,
      GLOBAL_OBJ_SCALE,
      collissionObj
    )
  );

  const cvs = collissionObjs.map((collissionObj) => {
    let s = collissionObj.center;
    let sx = (s.x + 1.0) * 0.5 * width;
    let sy = (1.0 - s.y) * 0.5 * height;

    // sx = 0;
    // sy = 0;

    return {
      center: { x: sx, y: sy },
      name: collissionObj.name,
      vertices: collissionObj.vertices.map(([x, y]) => {
        return {
          x: (x + 1.0) * 0.5 * width,
          y: (1.0 - y) * 0.5 * height,
        };
      }),
    };
  });

  console.log(cvs);
  let ci = 0;

  let finishPlatform;
  const collissionBodies = cvs.map((cv) => {
    let v1 = cv.vertices[0];
    let v2 = cv.vertices[1];
    let v3 = cv.vertices[2];
    let v4 = cv.vertices[3];

    let width = Vector.magnitude(Vector.sub(v1, v2));
    let height = Vector.magnitude(Vector.sub(v2, v3));

    let angle = Math.atan2(-(v2.y - v1.y), v2.x - v1.x);

    let centerx = (v1.x + v2.x + v3.x + v4.x) / 4;
    let centery = (v1.y + v2.y + v3.y + v4.y) / 4;

    // return Bodies.fromVertices(centerx, centery, [cv.vertices], {
    //   isStatic: true,
    // });

    let b = Bodies.rectangle(centerx, centery, width, height, {
      isStatic: true,
      angle: -angle,
    });

    if (cv.name == "finish") {
      finishPlatform = b;
      console.log("Found finish platform in collission data");
    }

    return b;
  });

  console.log(collissionBodies);

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
    ...collissionBodies,
  ];

  let bodies = [ship, startPlatform, finishPlatform];
  bodies.push(...collissionBodies);

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
    height - 100 * pixelRatio
  );
  const rightThrusterButtonPos = Vector.create(
    width - 100 * pixelRatio,
    height - 100 * pixelRatio
  );

  window.addEventListener("pointerdown", (e) => {
    const x = e.pageX * window.devicePixelRatio;
    const y = e.pageY * window.devicePixelRatio;
    const mouse = Vector.create(x, y);

    const width = window.innerWidth;
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

    const width = window.innerWidth;
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

  // ship.frictionAir = 0.0; //make the game unplayable

  ship.frictionAir = 0.0001; //make the game less unplayable

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
       ppos.y *= ${height.toFixed(1)}/${width.toFixed(1)};
      vec2 pos = mat2(cos(angle), -sin(angle), sin(angle) , cos(angle)) * ppos.xy;
      pos.y /= ${height.toFixed(1)}/${width.toFixed(1)};
      gl_Position = vec4(pos.xy + shipCenter - center, 0., 1.);

      position = v_position;
    }

    `
  );

  const vshader = createShader(
    gl,
    gl.VERTEX_SHADER,
    `

    attribute vec4 v_position;
    uniform vec3 center;
    varying vec4 position;
    uniform float u_time;

    void main() {

      gl_Position = vec4(v_position.xy, v_position.zw);
      position = v_position;
    }

    `
  );

  const shippshader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    `
    precision highp float;
    varying vec4 position;
    uniform vec2 shipCenter;
    uniform vec2 center;
    uniform vec2 shipSize;

    uniform float u_time;
    uniform sampler2D img;
    uniform sampler2D flame;

    uniform vec2 lr;


    mat2 rot(float angle) {
      return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    }

    void main() {

    vec2 pos = position.xy;
    vec2 texPos = (pos.xy/shipSize.xy/2. + 1.0) * 0.5;



    vec4 color = texture2D(img, texPos);

 //   vec4 color = vec4(1.0 - smoothstep( 0.08, 0.09, distance(position.xy, vec2(0.) )), 1., 1., 1.);
    gl_FragColor = color;

    // gl_FragColor.xw += step(distance(texPos, vec2(0.05, 0.1)), 0.1);
    // gl_FragColor.xw += step(distance(texPos, vec2(1.-0.05, 0.1)), 0.1);

    vec2 t1 = vec2(0.00, 0.1);
    vec2 t2 = vec2(1.-0.09, 0.1);


    vec2 ft1 = texPos - t1;
    vec2 ft2 = texPos - t2;

    ft1 *= rot(sin(u_time * 70.) * 0.02);
    ft2 *= rot(sin(u_time * 70.) * 0.02);

    ft1.y /= abs(sin(u_time * 70. * (20. * lr.x))* (0.03 + lr.x * 0.05) + 1.);
    ft2.y /= abs(sin(u_time * 70. * (20. * lr.y))* (0.03 + lr.y * 0.05) + 1.);


    ft1 /= 0.1 ;
    ft2 /= 0.1;

    ft1.y *= 0.3 / (lr.x * 0.5 + 0.5);
    ft2.y *= 0.3 / (lr.y *0.5 + 0.5);

    ft1.y = 0.8 + ft1.y;
    ft2.y = 0.85 + ft2.y;

    vec4 ft1c = texture2D(flame, ft1);
    vec4 ft2c = texture2D(flame, ft2);

    float thrustFrac = 1.0 - smoothstep(0.0, 0.1, gl_FragColor.w);
    

    gl_FragColor += ft1c * pow(ft1.y , 2.) * 2. * thrustFrac;
    gl_FragColor += ft2c * pow(ft2.y , 2.) * 2. * thrustFrac;

    }
    `
  );

  const bgfragShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    `
    precision highp float;
    varying vec4 position;
    uniform vec3 center;
    uniform sampler2D img;

 


mat3 rotz(float a) {
  return mat3(
      cos(a), -sin(a), 0.,
      sin(a), cos(a), 0., 
      0., 0., 1.0
  );
}

mat2 rot(float a) {
  return mat2(
      cos(a), -sin(a),
      sin(a), cos(a)
  );
}

    float noise(vec2 p) {
      return fract(0.35353 * abs(dot(p, vec2(235658.35, 544646.464))));
  }
  
  float noise2(vec2 p) {
       return fract(abs(dot(p, vec2(4648.35, 2926.464))));
  }
  
  float noise3(vec2 p) {
       return fract(0.136477 * abs(dot(p, vec2(4648.35, 2926.464))));
  }
  
    vec3 star(vec2 id, vec2 f) {
      vec2 sp = vec2(0.5, 0.5) - rot(noise(id) * 3.14)*vec2(0.6, 0.);
      vec2 c = sp - f;
      
      float size = noise3(id);
      
      float intensity = (0.1 * size)/distance(sp, f);
      
  
      float invlength = 0.3/length(c);
      intensity += min(0.8, 0.002/(abs(c.y * c.x))) *  invlength;
      
      vec2 cr = c * rot(0.785);
      
      intensity += min(0.4, 0.002/(abs(cr.y * cr.x))) *invlength;
      intensity = max(0., intensity - 0.01);
      
      float red = smoothstep(0.4, 0.9, size) * size;
      float green = smoothstep(0.2, 0.3, size) * size;
      float blue = smoothstep(0., 0.01, size) * size;
  
      
      vec3 sc = vec3(red,  green, blue) * intensity;
    
      float u_time = center.z;

      float blink = fract(u_time *0.05  + 353663.0* noise3(id));
      sc *= 1.0 - step(0.98, blink);
      
      return sc;
  }

    void main() {
       vec2 st = position.xy + center.xy  *0.01 ;
      st.y *= ${height.toFixed(1)}/${width.toFixed(1)};

      float u_time = center.z;

      st -= u_time*0.0001;

      vec3 color = vec3(0.);


      const int cutoff = 1;
      const float scale = 6.;
      const float star_prob = 0.9;
      for (int x = -cutoff; x <= cutoff; x++) {
          for (int y = -cutoff; y <= cutoff; y++) {
             
              vec2 offset = vec2(x, y);
              vec2 id = floor(st*scale ) + offset;
              
               if (noise2(id) > star_prob) continue;
            
              vec2 f = fract(st*scale) - offset  ;
              color += star(id , f);;
          }
      }

      color *= 0.01;
      color = clamp(color, 0., 1.);
   


      gl_FragColor.xyz = color;
      // gl_FragColor.x = sin(u_time);
      gl_FragColor.w = 1.;
    }
    `
  );

  const objText = await loadText("./level1.obj");

  let terrainObj = parseOBJ(objText);

  terrainObj = scaleOBJ(GLOBAL_OBJ_SCALE, GLOBAL_OBJ_SCALE, terrainObj);
  terrainObj = scaleOBJ(height / width, 1, terrainObj);
  // console.log(terrainObj);

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  gl.enable(gl.SAMPLE_COVERAGE);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.sampleCoverage(1, false);

  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);

  let pos = [-1, 1, 1, 1, 1, -1, -1, -1, -1, 1];

  const bg = new Image();

  const shipTexImage = new Image();

  const flame = new Image();
  const platformImg = new Image();

  const terrainTexImage = new Image();

  const loaders = [
    new Promise((resolve, _) => {
      bg.src = "Level.png";
      bg.onload = resolve;
    }),
    new Promise((resolve, _) => {
      shipTexImage.src = "shipwhole.png";
      shipTexImage.onload = resolve;
    }),

    new Promise((resolve, _) => {
      flame.src = "flame.png";
      flame.onload = resolve;
    }),

    new Promise((res) => {
      platformImg.src = "./landtex.png";
      platformImg.onload = res;
    }),
    new Promise((res) => {
      terrainTexImage.src = "./level1tex.png";
      terrainTexImage.onload = res;
    }),
  ];

  await Promise.all(loaders);

  const pg = createProgram(gl, vshader, bgfragShader);
  gl.useProgram(pg);

  console.log("loc", gl.getUniformLocation(pg, "center"));

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
  gl.uniform2f(imgSizeU, (bg.width * 5162) / 2048, (bg.height * 5162) / 2048);

  const center = gl.getUniformLocation(pg, "center");
  let tloc = gl.getUniformLocation(pg, "img");
  gl.uniform3f(
    center,
    screenToClipX(camPos.x),
    screenToClipY(camPos.y),
    Math.PI / 2
  );

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);

  const vattrib = gl.getAttribLocation(pg, "v_position");
  gl.vertexAttribPointer(vattrib, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vattrib);

  const shipg = createProgram(gl, shipvshader, shippshader);
  gl.useProgram(shipg);

  gl.activeTexture(gl.TEXTURE1);
  const shipTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, shipTex);

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    shipTexImage
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.activeTexture(gl.TEXTURE2);
  const flameTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, flameTex);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, flame);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const shipTexU = gl.getUniformLocation(shipg, "img");
  gl.uniform1i(shipTexU, 1);

  const flameU = gl.getUniformLocation(shipg, "flame");
  gl.uniform1i(flameU, 2);

  const shipvbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, shipvbuf);
  let shipvs = [];

  for (const v of ship.vertices) {
    const y = screenToClipY(v.y) - screenToClipY(ship.position.y);
    shipvs.push(
      y < 0 ? y - 100 / width : y,
      screenToClipX(v.x) - screenToClipX(ship.position.x)
    );
  }

  shipvs.reverse();
  shipvs.push(shipvs[0], shipvs[1]);
  // console.log(shipvs);

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shipvs), gl.STATIC_DRAW);
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
    screenToClipY(ship.position.y - camPos.y + height / 2)
  );

  const shipWidth = 250 + 30 + 30;
  const shipHeight = 94.5;

  const shipSize = gl.getUniformLocation(shipg, "shipSize");

  gl.uniform2f(shipSize, shipWidth / width / 2, shipHeight / height / 2);

  const u_time = gl.getUniformLocation(shipg, "u_time");
  gl.uniform1f(u_time, 0 / 1000);

  const lr = gl.getUniformLocation(shipg, "lr");
  gl.uniform2f(lr, leftThruster ? 1 : 0, rightThruster ? 1 : 0);

  //----terrain setup------->

  const terrainPg = createProgram(
    gl,
    createShader(gl, gl.VERTEX_SHADER, terrainShader.vertex),
    createShader(gl, gl.FRAGMENT_SHADER, terrainShader.fragmentProc)
  );
  gl.useProgram(terrainPg);

  gl.activeTexture(gl.TEXTURE3);
  const terrainTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, terrainTex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    terrainTexImage
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const terraintexu = gl.getUniformLocation(terrainPg, "texture");
  gl.uniform1i(terraintexu, 3);

  const tvs = terrainObj.vertices.flat();
  const tuvs = terrainObj.texcoords.flat();

  const allbuf = objToVAttributes(terrainObj);

  gl.useProgram(terrainPg);
  const tvPos = gl.getAttribLocation(terrainPg, "position");
  const tuvPos = gl.getAttribLocation(terrainPg, "uv");

  const tvaBuf = gl.createBuffer();

  gl.enableVertexAttribArray(tvPos);
  gl.enableVertexAttribArray(tuvPos);

  gl.bindBuffer(gl.ARRAY_BUFFER, tvaBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(allbuf), gl.STATIC_DRAW);

  gl.vertexAttribPointer(tvPos, 2, gl.FLOAT, false, 4 * 4, 0);
  gl.vertexAttribPointer(tuvPos, 2, gl.FLOAT, false, 4 * 4, 2 * 4);

  //<----terrain setup-------

  //---- finish platform ---->
  const finishPlatformPg = createProgram(
    gl,
    createShader(gl, gl.VERTEX_SHADER, terrainShader.vertex),
    createShader(gl, gl.FRAGMENT_SHADER, terrainShader.fragment)
  );

  gl.activeTexture(gl.TEXTURE4);
  const platformTex = gl.createTexture();

  gl.bindTexture(gl.TEXTURE_2D, platformTex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    platformImg
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  let finishObj = parseOBJ(await loadText("./level1finish.obj"));
  finishObj = scaleOBJ(GLOBAL_OBJ_SCALE, GLOBAL_OBJ_SCALE, finishObj);
  finishObj = scaleOBJ(height / width, 1, finishObj);
  console.log(finishObj);

  const finishBuf = objToVAttributes(finishObj);
  gl.useProgram(finishPlatformPg);

  const fvPos = gl.getAttribLocation(finishPlatformPg, "position");
  const fuvPos = gl.getAttribLocation(finishPlatformPg, "uv");

  const fvaBuf = gl.createBuffer();

  gl.enableVertexAttribArray(fvPos);
  gl.enableVertexAttribArray(fuvPos);

  gl.bindBuffer(gl.ARRAY_BUFFER, fvaBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(finishBuf), gl.STATIC_DRAW);

  gl.vertexAttribPointer(fvPos, 2, gl.FLOAT, false, 4 * 4, 0);
  gl.vertexAttribPointer(fuvPos, 2, gl.FLOAT, false, 4 * 4, 2 * 4);

  const finishU = gl.getUniformLocation(finishPlatformPg, "texture");
  gl.uniform1i(finishU, 4);

  //<-----finsih platform
  let startTime = 0;

  run(0);
  function run(t) {
    window.requestAnimationFrame(run);

    if (prevT == 0) {
      prevT = t;
      startTime = t;
    }
    const dt = Math.min(t - prevT, 1000 / 60); //deltaTime should never be too high, it will result in low accuracy

    prevT = t;
    Engine.update(engine, dt);

    //rendering

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(pg);

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.vertexAttribPointer(vattrib, 2, gl.FLOAT, false, 0, 0);

    gl.uniform3f(
      center,
      screenToClipX(camPos.x),
      screenToClipY(camPos.y),
      t / 1000
    );
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
      screenToClipY(ship.position.y)
    );
    gl.uniform2f(lr, leftThruster ? 1 : 0, rightThruster ? 1 : 0);
    gl.uniform1f(u_time, t / 1000);

    gl.drawArrays(gl.TRIANGLE_FAN, 0, shipvs.length / 2);

    gl.useProgram(terrainPg);
    // gl.bindBuffer(gl.ARRAY_BUFFER, tvBuf);
    // gl.vertexAttribPointer(tvPos, 2, gl.FLOAT, false, 0, 0);
    // gl.bindBuffer(gl.ARRAY_BUFFER, tuvBuf);
    // gl.vertexAttribPointer(tuvPos, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, tvaBuf);
    gl.vertexAttribPointer(tvPos, 2, gl.FLOAT, false, 4 * 4, 0);
    gl.vertexAttribPointer(tuvPos, 2, gl.FLOAT, false, 4 * 4, 2 * 4);
    setUniform(gl, terrainPg, "center", [
      screenToClipX(camPos.x),
      screenToClipY(camPos.y),
    ]);
    gl.drawArrays(gl.TRIANGLES, 0, tvs.length / 2);

    gl.useProgram(finishPlatformPg);
    // gl.bindBuffer(gl.ARRAY_BUFFER, tvBuf);
    // gl.vertexAttribPointer(tvPos, 2, gl.FLOAT, false, 0, 0);
    // gl.bindBuffer(gl.ARRAY_BUFFER, tuvBuf);
    // gl.vertexAttribPointer(tuvPos, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, fvaBuf);
    gl.vertexAttribPointer(fvPos, 2, gl.FLOAT, false, 4 * 4, 0);
    gl.vertexAttribPointer(fuvPos, 2, gl.FLOAT, false, 4 * 4, 2 * 4);
    setUniform(gl, finishPlatformPg, "center", [
      screenToClipX(camPos.x),
      screenToClipY(camPos.y),
    ]);
    gl.drawArrays(gl.TRIANGLES, 0, finishObj.vertices.length);

    const shakeOffsetX =
      Math.max(-50 / 0.3, Math.min(200, -(camPos.x - ship.position.x))) * 0.3;
    const shakeOffsetY =
      Math.max(-50 / 0.3, Math.min(200, -(camPos.y - ship.position.y))) * 0.3;
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(shakeOffsetX, shakeOffsetY);

    //display health
    ctx.fillStyle =
      shipHealth > 50 ? "rgba(255, 255, 255, 1)" : `rgb(255, 255, 0)`;

    if (shipHealth < 25) {
      ctx.fillStyle = `rgba(${
        100 + (1 + Math.sin(t / 300)) * 0.5 * 155
      }, 0, 0, 1)`;
    }

    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 2;
    ctx.strokeRect(50, 50, 300, 20);

    ctx.fillRect(50, 50, Math.max(0, shipHealth * 3), 20);
    ctx.fillStyle = "rgba(255, 255, 255, 1)";
    ctx.font = "20px Orbitron";
    ctx.fillText("Health", 50, 90);

    //display timer
    const time = t - startTime;
    const minutes = Math.floor(time / 60000).toString();
    const seconds = Math.floor((time % 60000) / 1000).toString();
    const millis = Math.floor((time / 10) % 100).toString();

    ctx.strokeStyle = "rgba(255, 255, 255, 1)";
    ctx.fillStyle = "rgba(255, 255, 255, 1)";
    ctx.lineWidth = 2;

    ctx.strokeStyle = "rgba(0, 0, 0, 1)";

    ctx.font = "600 50px Orbitron";
    const millisText = millis.length == 1 ? "0" + millis : millis;
    const secondsText = seconds.length == 1 ? "0" + seconds : seconds;

    const segmentWidth = ctx.measureText("00").width + 4;
    const colonWidth = ctx.measureText(":").width + 4;

    //render one by one
    let currRight = width - 50 - segmentWidth;

    ctx.fillText(millisText, currRight, 80);
    currRight -= colonWidth;
    ctx.fillText(":", currRight, 80);
    currRight -= ctx.measureText(secondsText).width;
    ctx.fillText(secondsText, currRight, 80);
    currRight -= colonWidth;
    if (minutes > 0) {
      ctx.fillText(":", currRight, 80);
      currRight -= ctx.measureText(minutes).width;
      ctx.fillText(minutes, currRight, 80);
    }

    //display landed progress bar and text
    const landDt = t - landTime;
    if (landed) {
      ctx.strokeStyle = "rgba(255, 255, 255, 1)";
      ctx.lineWidth = 2;
      const shipScreenX = width / 2 + (ship.position.x - camPos.x);
      const shipScreenY = height / 2 + (ship.position.y - camPos.y);
      console.log(shipScreenX, shipScreenY);
      ctx.strokeRect(
        shipScreenX - shipWidth / 2,
        shipScreenY - shipHeight,
        shipWidth,
        30
      );
      ctx.fillStyle = "rgba(255, 255, 255, 1)";
      ctx.fillRect(
        shipScreenX - shipWidth / 2,
        shipScreenY - shipHeight,
        (shipWidth * landDt) / 4000,
        30
      );
    }

    if (landed && landDt > 4000) {
      ctx.fillStyle = "rgba(255, 255, 255, 1)";
      ctx.font = "40px Orbitron";
      const ltext = "You have landed!";
      ctx.fillText(
        ltext,
        width / 2 - ctx.measureText(ltext).width / 2,
        height / 2
      );
    }

    //display target location pointer
    const screenTarget = Vector.sub(finishPlatform.position, camPos);

    if (
      screenTarget.x < -width / 2 ||
      screenTarget.y < -height / 2 ||
      screenTarget.x > width / 2 ||
      screenTarget.y > height / 2
    ) {
      ctx.strokeStyle = "rgba(255, 255, 255, 1)";

      const dir = Vector.angle(camPos, finishPlatform.position);

      const edgeDist = Math.max(width / 2, height / 2);
      const edgeLoc = Vector.mult(Vector.normalise(screenTarget), edgeDist);
      edgeLoc.y = Math.max(
        -height / 2 + 5,
        Math.min(height / 2 - 5, edgeLoc.y)
      );
      edgeLoc.x = Math.max(-width / 2 + 5, Math.min(width / 2 - 5, edgeLoc.x));

      ctx.save();
      ctx.translate(width / 2 + edgeLoc.x, height / 2 + edgeLoc.y);
      ctx.rotate(dir);

      ctx.strokeStyle = "rgba(255, 255, 255, 1)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.lineTo(-40, -40);
      ctx.lineTo(0, 0);
      ctx.lineTo(-40, 40);

      ctx.closePath();
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();

    //other logics

    if (leftThruster || rightThruster) {
      let forceOrigin = Vector.create(ship.position.x, ship.position.y);
      const fOriginOffset = Vector.rotate(
        Vector.create(0, -100),
        ship.angle -
          (leftThruster ? 1 : 0) * PI_2 +
          (rightThruster ? 1 : 0) * PI_2
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
        const movingBody = collission.bodyA.isStatic
          ? collission.bodyB
          : collission.bodyA;
        const collidingVelocity =
          Vector.magnitude(movingBody.velocity) * 0.3 +
          Math.abs(Vector.dot(movingBody.velocity, collission.normal)) * 0.7;
        shipHealth -= collidingVelocity * 3;
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
    let accel = (collided ? 0.06 : 0.02) * Vector.magnitude(dp);
    const norm_dp = Vector.normalise(dp);
    camVel = Vector.add(camVel, Vector.mult(norm_dp, accel));
    camVel = Vector.sub(camVel, Vector.mult(camVel, collided ? 0.03 : 0.4));
    camPos = Vector.add(camPos, Vector.mult(camVel, dt));
  }
};

window.onload = main;
