function setupCanvas() {
  const width = 1928;
  const height = 980;

  const canvasContainer = document.getElementById("container");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  //assume landscape
  const aspectRatioDesired = width / height;
  const aspectRatio = window.innerWidth / window.innerHeight;

  const heightIsSmaller = aspectRatioDesired < aspectRatio;

  canvas.style.width = heightIsSmaller ? "auto" : "100%";
  canvas.style.height = heightIsSmaller ? "100%" : "auto";
  canvas.style.touchAction = "none";
  canvasContainer.appendChild(canvas);

  const overlayCanvas = document.createElement("canvas");
  overlayCanvas.width = width;
  overlayCanvas.height = height;
  overlayCanvas.style.width = heightIsSmaller ? "auto" : "100%";
  overlayCanvas.style.height = heightIsSmaller ? "100%" : "auto";
  overlayCanvas.style.position = "absolute";
  overlayCanvas.style.touchAction = "none";
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
    console.error("WebGL not supported");
    alert(
      "WebGL not supported on your devices. Please try on a different device.",
    );
    return;
  }

  return { ctx, gl, width, height };
}

const GAME_FINISH_REASONS = {
  HEALTH_ZERO: "health_zero",
  LEVEL_COMPLETE: "level_complete",
};

async function main(
  levelPrefix,
  { width, height, ctx, gl },
  globalResources,
  levelResources,
  networkClient,
  {
    shouldStopInstanceCallBack = () => false,
    restartCallback = () => {},
    finishCallback = (gameStats) => {},
    frameCallback = () => {},
    shouldStopPlay = () => {},
    onStopInstance = () => {},
    onExitToMenu: exitToMenuCallback = () => {},
  } = {
    shouldStopInstanceCallback: () => false,
    restartCallback: () => {},
    finishCallback: () => {},
    frameCallback: () => {},
    shouldStopPlay: () => {},
    onStopInstance: () => {},
    onExitToMenu: () => {},
  },
) {
  const Engine = Matter.Engine,
    Bodies = Matter.Bodies,
    Body = Matter.Body,
    Composite = Matter.Composite,
    Vector = Matter.Vector;

  const engine = Engine.create();

  const pixelRatio = window.devicePixelRatio;

  const shipWidth = 386.46 * 0.8;
  const shipHeight = 175 * 0.8;

  const thrusterWidth = 31.65 * 0.8;
  const shipBodyWidth = 281 * 0.8;

  const shipBodyHeight = 118 * 0.8;
  const thrusterHeight = 46.2 * 0.8;

  const shipPos = { x: width / 2, y: 400 };
  const shipBody = Bodies.rectangle(
    shipPos.x,
    shipPos.y,
    shipBodyWidth,
    shipBodyHeight,
    {},
  );
  const shipLThrust = Bodies.rectangle(
    shipPos.x - shipWidth / 2 + thrusterWidth / 2,
    shipPos.y + 20,
    thrusterWidth,
    thrusterHeight,
    {},
  );
  const shipRThrust = Bodies.rectangle(
    shipPos.x + shipWidth / 2 - thrusterWidth / 2,
    shipPos.y + 20,
    thrusterWidth,
    thrusterHeight,
    {},
  );

  const { collissionTries: shipCollissionBodies } = buildCollissionRects(
    globalResources.shipCollissionObjs,
    width,
    height,
    { isStatic: false },
  );
  console.log(globalResources);
  const ship = Body.create({
    // parts: [shipBody, shipLThrust, shipRThrust],
    parts: shipCollissionBodies,
  });

  let shipHealth = 100;

  const ground = Bodies.rectangle(
    window.innerWidth / 2,
    window.innerHeight - 30,
    window.innerWidth,
    60,
    { isStatic: true },
  );

  const startPlatform = Bodies.rectangle(
    400 + 382 / 2,
    1376 + 44 / 2,
    382,
    44,
    {
      isStatic: true,
    },
  );

  let collissionBodies = levelResources.collissionTries;
  const finishPlatform = levelResources.finishPlatformBody;

  let eventListeners = [];

  function destroyListeners() {
    eventListeners.forEach((listener) => {
      window.removeEventListener(listener.event, listener.callback);
    });
  }

  function addEventListener(event, callback) {
    eventListeners.push({ event, callback });
    window.addEventListener(event, callback);
  }

  let bodies = [ship, startPlatform];
  bodies.push(finishPlatform, ...collissionBodies);

  Composite.add(engine.world, bodies);

  const PI = Math.PI;
  const PI_2 = Math.PI / 2;

  let leftThruster, rightThruster;

  addEventListener("keydown", (e) => {
    if (
      (e.key == "Enter" || e.key == "e") &&
      scrollableMenu.enterClickStart < 0
    ) {
      scrollableMenu.enterKeyDown();
    }

    if (shouldStopPlay() || scrollableMenu.enabled) return;

    leftThruster = e.key == "a" || e.key == "ArrowLeft" || leftThruster;
    rightThruster = e.key == "d" || e.key == "ArrowRight" || rightThruster;
  });

  addEventListener("keyup", (e) => {
    if (e.key == "a" || e.key == "ArrowLeft") {
      leftThruster = false;
      scrollableMenu.scrollLeft();
    }

    if (e.key == "d" || e.key == "ArrowRight") {
      rightThruster = false;
      scrollableMenu.scrollRight();
    }

    if (e.key == "Enter" || e.key == "e") {
      scrollableMenu.enterKeyUp();
    }
  });

  const collissionMap = {};

  const leftThrusterButtonPos = Vector.create(
    100 * pixelRatio,
    height - 100 * pixelRatio,
  );
  const rightThrusterButtonPos = Vector.create(
    width - 100 * pixelRatio,
    height - 100 * pixelRatio,
  );

  let mouseX = 0,
    mouseY = 0,
    mouseDown = false;

  const scrollableMenu = {
    items: [],
    selected: -1,
    enabled: false,

    message: "",

    leftClickStart: -1,
    rightClickStart: -1,
    enterClickStart: -1,

    selectTime: 500,
    maxClickTime: 200,

    openMenu: () => {
      scrollableMenu.enabled = true;
      scrollableMenu.leftClickStart = -1;
      scrollableMenu.rightClickStart = -1;
      scrollableMenu.enterClickStart = -1;
    },

    closeMenu: () => {
      scrollableMenu.enabled = false;
      scrollableMenu.selected = -1;
      scrollableMenu.items = [];
      scrollableMenu.message = "";

      scrollableMenu.leftClickStart = -1;
      scrollableMenu.rightClickStart = -1;
      scrollableMenu.enterClickStart = -1;
    },

    selectComplete: () => {
      if (!scrollableMenu.enabled) return;
      const itemIdx = scrollableMenu.selected;
      if (itemIdx < 0) return;
      if (itemIdx > scrollableMenu.items.length - 1) return;

      scrollableMenu.onSelectComplete(scrollableMenu.items[itemIdx]);
    },

    onSelectComplete: () => {},

    scrollLeft: () => {
      if (!scrollableMenu.enabled) return;

      globalResources.audioCtx.resume();

      globalResources.menuSlideAudio.currentTime = 0;
      globalResources.menuSlideAudio.play();

      scrollableMenu.selected -= 1;
      if (scrollableMenu.selected < 0) {
        scrollableMenu.selected = scrollableMenu.items.length - 1;
      }
    },
    scrollRight: () => {
      if (!scrollableMenu.enabled) return;

      globalResources.audioCtx.resume();

      globalResources.menuSlideAudio.currentTime = 0;
      globalResources.menuSlideAudio.play();

      scrollableMenu.selected += 1;
      if (scrollableMenu.selected > scrollableMenu.items.length - 1) {
        scrollableMenu.selected = 0;
      }
    },

    getChoice: () => {
      if (!scrollableMenu.enabled) return null;
      return scrollableMenu.items[scrollableMenu.selected];
    },

    enterKeyDown: () => {
      if (!scrollableMenu.enabled) return;
      scrollableMenu.enterClickStart = Date.now();
    },

    enterKeyUp: () => {
      if (!scrollableMenu.enabled || scrollableMenu.enterClickStart < 0) return;

      const time = Date.now() - scrollableMenu.enterClickStart;
      if (time > scrollableMenu.selectTime) {
        scrollableMenu.selectComplete();
      }
      scrollableMenu.enterClickStart = -1;
    },

    leftPointerDown: () => {
      if (!scrollableMenu.enabled) return;

      scrollableMenu.leftClickStart = Date.now();
    },

    leftPointerUp: () => {
      if (!scrollableMenu.enabled || scrollableMenu.leftClickStart < 0) return;

      const time = Date.now() - scrollableMenu.leftClickStart;
      if (time < scrollableMenu.maxClickTime) {
        scrollableMenu.scrollLeft();
      } else if (time > scrollableMenu.selectTime) {
        scrollableMenu.selectComplete();
      }
      scrollableMenu.leftClickStart = -1;
    },

    rightPointerDown: () => {
      if (!scrollableMenu.enabled) return;
      scrollableMenu.rightClickStart = Date.now();
    },

    rightPointerUp: () => {
      if (!scrollableMenu.enabled || scrollableMenu.rightClickStart < 0) return;

      const time = Date.now() - scrollableMenu.rightClickStart;
      if (time < scrollableMenu.maxClickTime) {
        scrollableMenu.scrollRight();
      } else if (time > scrollableMenu.selectTime) {
        scrollableMenu.selectComplete();
      }
      scrollableMenu.rightClickStart = -1;
    },

    draw: (yoff = 0) => {
      if (!scrollableMenu.enabled) return;

      const menuHeight = 200;
      const gap = 50;

      let bottomY = height / 2 + yoff + 90 - menuHeight / 2;

      let totalWidth = 0;
      ctx.font = "500 30px Orbitron";
      for (let i = 0; i < scrollableMenu.items.length; i++) {
        const item = scrollableMenu.items[i];
        totalWidth += ctx.measureText(item).width;
        if (i < scrollableMenu.items.length - 1) totalWidth += gap;
      }
      const message = scrollableMenu.message;

      let bgWidth = totalWidth;

      if (message.length > 0) {
        ctx.font = "900 50px Orbitron";
        const messageWidth = ctx.measureText(message).width;
        bgWidth = Math.max(bgWidth, messageWidth);
      }

      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.strokeStyle = "rgba(255, 255, 255, 1)";
      ctx.lineWidth = 5;

      const xPadding = 70;
      ctx.fillRect(
        width / 2 - bgWidth / 2 - xPadding,
        height / 2 - menuHeight / 2,
        bgWidth + xPadding * 2,
        menuHeight,
      );
      ctx.strokeRect(
        width / 2 - bgWidth / 2 - xPadding,
        height / 2 - menuHeight / 2,
        bgWidth + xPadding * 2,
        menuHeight,
      );

      ctx.fillStyle = "rgba(255, 255, 255, 1)";
      ctx.strokeStyle = "rgba(255, 255, 255, 1)";

      if (message.length > 0) {
        ctx.font = "900 50px Orbitron";

        ctx.fillText(
          message,
          width / 2 - ctx.measureText(message).width / 2,
          bottomY,
        );

        bottomY += 50;
      }

      ctx.font = "500 30px Orbitron";

      let leftX = width / 2 - totalWidth / 2;

      for (let i = 0; i < scrollableMenu.items.length; i++) {
        const item = scrollableMenu.items[i];
        const itemWidth = ctx.measureText(item).width;
        ctx.fillText(item, leftX, bottomY);

        if (i == scrollableMenu.selected) {
          let rectY = bottomY + 10;

          let rectWidth = itemWidth;

          let tNow = Date.now();
          let leftClickStart = scrollableMenu.leftClickStart;
          let rightClickStart = scrollableMenu.rightClickStart;
          let enterClickStart = scrollableMenu.enterClickStart;

          if (
            leftClickStart > -1 &&
            tNow - leftClickStart > scrollableMenu.maxClickTime
          ) {
            rectWidth *=
              (tNow - leftClickStart - scrollableMenu.maxClickTime) /
              scrollableMenu.selectTime;
          } else if (
            rightClickStart > -1 &&
            tNow - rightClickStart > scrollableMenu.maxClickTime
          ) {
            rectWidth *=
              (tNow - rightClickStart - scrollableMenu.maxClickTime) /
              scrollableMenu.selectTime;
          }

          if (
            enterClickStart > -1 &&
            tNow - enterClickStart > scrollableMenu.maxClickTime
          ) {
            rectWidth *=
              (tNow - enterClickStart - scrollableMenu.maxClickTime) /
              scrollableMenu.selectTime;
          }

          rectWidth = Math.min(itemWidth, rectWidth);

          if (rectWidth < itemWidth) {
            ctx.strokeStyle = "rgba(255, 255, 255, 1)";
            ctx.lineWidth = 2;
            ctx.strokeRect(leftX, rectY, rectWidth, 10);
          } else {
            ctx.fillRect(leftX, rectY, rectWidth, 10);
          }
        }
        leftX += itemWidth + gap;
      }
    },
  };

  const menuElt = document.getElementById("menu");

  menuElt.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    ctx.canvas.focus();

    if (scrollableMenu.enabled) {
      scrollableMenu.closeMenu();
      return;
    }

    scrollableMenu.items = ["Retry", "Exit to menu", "Continue game"];

    if (Math.random() > 0.5) {
      scrollableMenu.items.push("Cheat >:)");
    }
    scrollableMenu.selected = 2;

    scrollableMenu.message = "Mid game menu for losers";
    scrollableMenu.openMenu();

    scrollableMenu.onSelectComplete = (item) => {
      if (item == "Retry") {
        scrollableMenu.closeMenu();
        restartCallback();
        console.log("Restarting...");
      }

      if (item == "Continue game") {
        scrollableMenu.enabled = false;
      }

      if (item == "Cheat >:)") {
        window.location.href = "https://www.youtube.com/watch?v=xvFZjo5PgG0";
      }

      if (item == "Exit to menu") {
        exitToMenuCallback();
      }
    };
  });

  addEventListener("mousemove", (e) => {
    mouseX = e.pageX * window.devicePixelRatio;
    mouseY = e.pageY * window.devicePixelRatio;
  });

  addEventListener("pointerdown", (e) => {
    if (e.target == menuElt) {
      return;
    }

    mouseDown = true;
    const x = e.pageX * window.devicePixelRatio;
    const y = e.pageY * window.devicePixelRatio;
    const mouse = Vector.create(x, y);

    const width = window.innerWidth * window.devicePixelRatio;
    if (
      //   Vector.magnitude(Vector.sub(leftThrusterButtonPos, mouse)) <=

      //   80 * pixelRatio
      x <
      width / 2 - width * 0.125
    ) {
      if (!shouldStopPlay() && !scrollableMenu.enabled) leftThruster = true;

      scrollableMenu.leftPointerDown();
    }

    if (
      // Vector.magnitude(Vector.sub(rightThrusterButtonPos, mouse)) <=
      // 80 * pixelRatio
      x >
      width / 2 + width * 0.125
    ) {
      if (!shouldStopPlay() && !scrollableMenu.enabled) rightThruster = true;

      scrollableMenu.rightPointerDown();
    }
  });

  addEventListener("pointerup", (e) => {
    if (e.target == menuElt) {
      return;
    }

    mouseDown = false;
    const x = e.pageX * window.devicePixelRatio;
    const y = e.pageY * window.devicePixelRatio;
    const mouse = Vector.create(x, y);

    const width = window.innerWidth * window.devicePixelRatio;
    if (
      // Vector.magnitude(Vector.sub(leftThrusterButtonPos, mouse)) <=
      // 80 * pixelRatio
      x <
      width / 2 - width * 0.125
    ) {
      leftThruster = false;

      scrollableMenu.leftPointerUp();
    }

    if (
      // Vector.magnitude(Vector.sub(rightThrusterButtonPos, mouse)) <=
      // 80 * pixelRatio
      x >
      width / 2 + width * 0.125
    ) {
      rightThruster = false;

      scrollableMenu.rightPointerUp();
    }
  });

  let camPos = Vector.create(ship.position.x, ship.position.y);
  let camVel = Vector.create(0, 0);

  // ship.frictionAir = 0.0; //make the game unplayable

  ship.frictionAir = 0.0001; //make the game less unplayable

  engine.gravity.scale = 0.0001;

  let landed = false;
  let landingComplete = false;
  let failed = false;

  let landTime = 0;
  let prevT = 0;

  function screenToClipX(x) {
    return (x / width - 0.5) * 2;
  }

  function screenToClipY(y) {
    return (0.5 - y / height) * 2;
  }

  let terrainObj = levelResources.terrainObj;

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  gl.enable(gl.SAMPLE_COVERAGE);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.sampleCoverage(1, false);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);

  let pos = [-1, 1, 1, 1, 1, -1, -1, -1, -1, 1];

  const shipTexImage = globalResources.shipImage;

  const flame = globalResources.flameImage;

  const platformImg = levelResources.finishPlatformImage;

  const terrainTexImage = levelResources.terrainImage;

  const shaderPrograms = compileShaders(gl, getShaders(width, height));

  console.log(shaderPrograms);

  const pg = shaderPrograms.bgShader;
  gl.useProgram(pg);

  // const imgSizeU = gl.getUniformLocation(pg, "img_size");
  // gl.uniform2f(imgSizeU, (bg.width * 5162) / 2048, (bg.height * 5162) / 2048);

  const center = gl.getUniformLocation(pg, "center");
  let tloc = gl.getUniformLocation(pg, "img");
  gl.uniform3f(
    center,
    screenToClipX(camPos.x),
    screenToClipY(camPos.y),
    Math.PI / 2,
  );

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);

  const vattrib = gl.getAttribLocation(pg, "v_position");
  gl.vertexAttribPointer(vattrib, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vattrib);

  const shipg = shaderPrograms.shipShader;
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
    shipTexImage,
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
  // let shipvs = [];

  // for (const v of ship.vertices) {
  //   const y = screenToClipY(v.y) - screenToClipY(ship.position.y);
  //   shipvs.push(
  //     y,
  //     // y < 0 ? y - 100 / width : y,
  //     screenToClipX(v.x) - screenToClipX(ship.position.x),
  //   );
  // }

  let shipVas = objToVAttributes(globalResources.shipTexObj);
  console.log(shipVas);

  // shipVas = [];

  // shipvs.reverse();
  // shipvs.push(shipvs[0], shipvs[1]);
  // console.log(shipvs);

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shipVas), gl.STATIC_DRAW);
  const shipva = gl.getAttribLocation(shipg, "v_position");
  const shipuvs = gl.getAttribLocation(shipg, "texcoord");
  gl.vertexAttribPointer(shipva, 2, gl.FLOAT, false, 4 * 4, 0);
  gl.vertexAttribPointer(shipuvs, 2, gl.FLOAT, false, 4 * 4, 2 * 4);
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

  const shipSize = gl.getUniformLocation(shipg, "shipSize");

  gl.uniform2f(shipSize, shipWidth / width / 2, shipHeight / height / 2);

  const u_time = gl.getUniformLocation(shipg, "u_time");
  gl.uniform1f(u_time, 0 / 1000);

  const lr = gl.getUniformLocation(shipg, "lr");
  gl.uniform2f(lr, leftThruster ? 1 : 0, rightThruster ? 1 : 0);

  //----terrain setup------->

  const terrainPg = shaderPrograms.terrainShader;
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
    terrainTexImage,
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

  //-----other objects----->
  const otherObjectPg = shaderPrograms.finishPlatformShader;
  gl.useProgram(otherObjectPg);

  let texUnit = 4;

  let otherObjects = [];

  for (const obj in levelResources.otherObjects) {
    gl.activeTexture(gl.TEXTURE0 + texUnit);

    const objTexture = gl.createTexture();

    const texture = levelResources.otherObjects[obj].texture;
    const vertices = levelResources.otherObjects[obj].vertices;

    gl.bindTexture(gl.TEXTURE_2D, objTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      texture,
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const ovPos = gl.getAttribLocation(otherObjectPg, "position");
    const ouvPos = gl.getAttribLocation(otherObjectPg, "uv");

    const ovaBuf = gl.createBuffer();

    const ovBuf = objToVAttributes(vertices);
    gl.enableVertexAttribArray(ovPos);
    gl.enableVertexAttribArray(ouvPos);

    gl.bindBuffer(gl.ARRAY_BUFFER, ovaBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ovBuf), gl.STATIC_DRAW);

    gl.vertexAttribPointer(ovPos, 2, gl.FLOAT, false, 4 * 4, 0);
    gl.vertexAttribPointer(ouvPos, 2, gl.FLOAT, false, 4 * 4, 2 * 4);

    const texU = gl.getUniformLocation(otherObjectPg, "texture");
    gl.uniform1i(texU, texUnit);
    otherObjects.push({
      texture: objTexture,
      buffer: ovaBuf,
      ovPos,
      ouvPos,
      vertices,
      texUnit,
    });
  }

  //---- finish platform ---->
  // const finishPlatformPg = shaderPrograms.finishPlatformShader;

  // gl.activeTexture(gl.TEXTURE4);
  // const platformTex = gl.createTexture();

  // gl.bindTexture(gl.TEXTURE_2D, platformTex);
  // gl.texImage2D(
  //   gl.TEXTURE_2D,
  //   0,
  //   gl.RGBA,
  //   gl.RGBA,
  //   gl.UNSIGNED_BYTE,
  //   platformImg,
  // );

  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // finishObj = levelResources.finishPlatformObj;
  // console.log(finishObj);

  // const finishBuf = objToVAttributes(finishObj);
  // gl.useProgram(finishPlatformPg);

  // const fvPos = gl.getAttribLocation(finishPlatformPg, "position");
  // const fuvPos = gl.getAttribLocation(finishPlatformPg, "uv");

  // const fvaBuf = gl.createBuffer();

  // gl.enableVertexAttribArray(fvPos);
  // gl.enableVertexAttribArray(fuvPos);

  // gl.bindBuffer(gl.ARRAY_BUFFER, fvaBuf);
  // gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(finishBuf), gl.STATIC_DRAW);

  // gl.vertexAttribPointer(fvPos, 2, gl.FLOAT, false, 4 * 4, 0);
  // gl.vertexAttribPointer(fuvPos, 2, gl.FLOAT, false, 4 * 4, 2 * 4);

  // const finishU = gl.getUniformLocation(finishPlatformPg, "texture");
  // gl.uniform1i(finishU, 4);

  //<-----finsih platform
  let startTime = 0;

  let timerTime = 0;

  let collided = false;

  Matter.Events.on(engine, "collisionStart", function (event, bodyA) {
    event.pairs.forEach(function (pair) {
      const bodyA = pair.bodyA.isStatic ? pair.bodyB : pair.bodyA;
      const bodyB = pair.bodyB.isStatic ? pair.bodyB : pair.bodyA;

      if (bodyA.parent.id != ship.id) return;
      collided = true;
      const collission = pair.collision;

      const normalisedImpact = Math.abs(
        Vector.dot(collission.normal, Vector.normalise(ship.velocity)),
      );

      const impactSpeed = Math.abs(
        Vector.dot(collission.normal, ship.velocity),
      );

      const collissionAngle = Math.acos(normalisedImpact);
      console.log((collissionAngle * 180) / Math.PI);

      const impactScale = Math.sin(collissionAngle) * 0.2 + 0.8;

      const scaledImpact = Vector.magnitude(ship.velocity) * impactScale * 3.0;
      shipHealth -= scaledImpact;

      if (scaledImpact >= 10) {
        shipHealth = 0;
      }
    });
  });

  run(0);
  function run(t) {
    if (!shouldStopInstanceCallBack()) window.requestAnimationFrame(run);
    else {
      destroyListeners();
      onStopInstance();
      return;
    }

    const stopPlay = shouldStopPlay();

    if (shipHealth <= 0 && !stopPlay) {
      finishCallback(GAME_FINISH_REASONS.HEALTH_ZERO);
    }

    if (!stopPlay) {
      timerTime = t;
    }

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
      t / 1000,
    );
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 5);

    gl.useProgram(shipg);
    gl.bindBuffer(gl.ARRAY_BUFFER, shipvbuf);
    // shipvs = [];
    // for (const v of ship.vertices) {
    //   shipvs.push(screenToClipX(v.x));
    //   shipvs.push(screenToClipX(v.y));
    // }

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shipVas), gl.STATIC_DRAW);
    // const shipva = gl.getAttribLocation(shipg, "v_position");
    gl.vertexAttribPointer(shipva, 2, gl.FLOAT, false, 4 * 4, 0);
    gl.vertexAttribPointer(shipuvs, 2, gl.FLOAT, false, 4 * 4, 2 * 4);
    gl.uniform1f(angle, ship.angle);
    gl.uniform2f(center2, screenToClipX(camPos.x), screenToClipY(camPos.y));
    gl.uniform2f(
      shipCenter,
      screenToClipX(ship.position.x),
      screenToClipY(ship.position.y),
    );
    gl.uniform2f(lr, leftThruster ? 1 : 0, rightThruster ? 1 : 0);
    gl.uniform1f(u_time, t / 1000);

    gl.drawArrays(
      gl.TRIANGLE_FAN,
      0,
      globalResources.shipTexObj.vertices.length,
    );

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

    gl.useProgram(otherObjectPg);
    // gl.bindBuffer(gl.ARRAY_BUFFER, tvBuf);
    // gl.vertexAttribPointer(tvPos, 2, gl.FLOAT, false, 0, 0);
    // gl.bindBuffer(gl.ARRAY_BUFFER, tuvBuf);
    // gl.vertexAttribPointer(tuvPos, 2, gl.FLOAT, false, 0, 0);

    // gl.bindBuffer(gl.ARRAY_BUFFER, fvaBuf);
    // gl.vertexAttribPointer(fvPos, 2, gl.FLOAT, false, 4 * 4, 0);
    // gl.vertexAttribPointer(fuvPos, 2, gl.FLOAT, false, 4 * 4, 2 * 4);
    // gl.drawArrays(gl.TRIANGLES, 0, finishObj.vertices.length);

    for (const obj of otherObjects) {
      gl.activeTexture(gl.TEXTURE0 + obj.texUnit);
      gl.bindTexture(gl.TEXTURE_2D, obj.texture);
      gl.bindBuffer(gl.ARRAY_BUFFER, obj.buffer);
      gl.vertexAttribPointer(obj.ovPos, 2, gl.FLOAT, false, 4 * 4, 0);
      gl.vertexAttribPointer(obj.ouvPos, 2, gl.FLOAT, false, 4 * 4, 2 * 4);

      setUniform(gl, otherObjectPg, "center", [
        screenToClipX(camPos.x),
        screenToClipY(camPos.y),
      ]);

      const texU = gl.getUniformLocation(otherObjectPg, "texture");
      gl.uniform1i(texU, obj.texUnit);

      gl.drawArrays(gl.TRIANGLES, 0, obj.vertices.vertices.length);
    }

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
    const time = timerTime - startTime;
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
      ctx.strokeRect(
        shipScreenX - shipWidth / 2,
        shipScreenY - shipHeight,
        shipWidth,
        30,
      );
      ctx.fillStyle = "rgba(255, 255, 255, 1)";
      const landDtfract = Math.min(1, landDt / 4000);
      ctx.fillRect(
        shipScreenX - shipWidth / 2,
        shipScreenY - shipHeight,
        shipWidth * landDtfract,
        30,
      );
    }

    if (landed && landDt > 4000) {
      // ctx.fillStyle = "rgba(255, 255, 255, 1)";
      // ctx.font = "40px Orbitron";
      // const ltext = "You have landed!";

      // //background
      // ctx.fillStyle = "rgba(0, 0, 0, 0.5)";

      // ctx.fillRect(0, height / 2 - 50, width, 100);

      // ctx.fillText(
      //   ltext,
      //   width / 2 - ctx.measureText(ltext).width / 2,
      //   height / 2,
      // );
      if (!landingComplete) {
        finishCallback(GAME_FINISH_REASONS.LEVEL_COMPLETE);
        landingComplete = true;

        scrollableMenu.items = ["Retry", "Next", "Exit to menu"];
        scrollableMenu.selected = 1;
        scrollableMenu.message = "You have landed!";
        scrollableMenu.openMenu();

        scrollableMenu.onSelectComplete = (item) => {
          if (item == "Retry") {
            restartCallback();
            console.log("Restarting...");
          }
          if (item == "Exit to menu") {
            exitToMenuCallback();
          }
        };
      }
    }

    if (shipHealth <= 0) {
      // ctx.fillStyle = "rgba(255, 255, 255, 1)";
      // ctx.font = "40px Orbitron";
      // const ltext = "You failed! We'll get em next time";
      // ctx.fillText(
      //   ltext,
      //   width / 2 - ctx.measureText(ltext).width / 2,
      //   height / 2,
      // );

      // const restartText = "Restart";
      // const restartTextSize = ctx.measureText(restartText);
      // ctx.strokeStyle = "rgba(255, 255, 255, 1)";
      // ctx.lineWidth = 2;

      // const hoff = 100;
      // ctx.strokeRect(
      //   width / 2 - restartTextSize.width / 2 - 50,
      //   height / 2 - 20 - 40 + hoff,
      //   restartTextSize.width + 100,
      //   20 + 40,
      // );
      // ctx.stroke();
      // ctx.fillText(
      //   restartText,
      //   width / 2 - restartTextSize.width / 2,
      //   height / 2 - 20 + hoff,
      // );

      // const widthS = window.innerWidth * window.devicePixelRatio;
      // const heightS = window.innerHeight * window.devicePixelRatio;
      // if (
      //   mouseDown
      //   // mouseX > widthS / 2 - restartTextSize.width / 2 - 40 &&
      //   // mouseX < widthS / 2 + restartTextSize.width / 2 + 50 &&
      //   // mouseY > heightS / 2 - 20 - 40 + hoff &&
      //   // mouseY < heightS / 2 + 20 + 40 + hoff
      // ) {
      //   restartCallback();
      //   console.log("restarting...");
      // }

      if (!failed) {
        failed = true;
        scrollableMenu.items = ["Retry", "Exit to menu"];
        scrollableMenu.message = "You failed! We'll get em next time";
        scrollableMenu.selected = 0;
        scrollableMenu.openMenu();

        scrollableMenu.onSelectComplete = (item) => {
          if (item == "Retry") {
            scrollableMenu.closeMenu();
            restartCallback();
            console.log("restarting...");
          }
          if (item == "Exit to menu") {
            exitToMenuCallback();
          }
        };
      }
    }

    scrollableMenu.draw(0);
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
        Math.min(height / 2 - 5, edgeLoc.y),
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
          (rightThruster ? 1 : 0) * PI_2,
      );
      const forceMag = leftThruster && rightThruster ? 0.02 : 0.01;
      const forceOriginOff = Vector.add(forceOrigin, fOriginOffset);
      const force = Vector.rotate(Vector.create(0, -forceMag), ship.angle);
      Body.applyForce(ship, forceOriginOff, force);
    }
    // let collided = false;
    const collides = Matter.Collision.collides;

    if (!stopPlay) {
      let landedCollission =
        // collides(shipLThrust, finishPlatform) ||
        // collides(shipRThrust, finishPlatform) ||
        collides(ship, finishPlatform);
      if (
        landedCollission != null &&
        landedCollission.supports.length >= 2 &&
        ship.angularSpeed < 1e-6 &&
        ship.speed < 1e-1 &&
        Math.abs(ship.angle) <= 0.1 &&
        Vector.magnitude(Vector.sub(ship.position, finishPlatform.position)) <=
          120
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
    }

    const dp = Vector.sub(ship.position, camPos);
    let accel = (collided ? 0.06 : 0.02) * Vector.magnitude(dp);
    const norm_dp = Vector.normalise(dp);
    camVel = Vector.add(camVel, Vector.mult(norm_dp, accel));
    camVel = Vector.sub(camVel, Vector.mult(camVel, collided ? 0.03 : 0.4));
    camPos = Vector.add(camPos, Vector.mult(camVel, dt));
    collided = false;

    frameCallback(t, landed, landTime, shipHealth, ship);
  }
}

let paramString = window.location.href.split("?")[1];
let queryString = new URLSearchParams(paramString);
let level = 1;
for (let pair of queryString.entries()) {
  if (pair[0] == "level") {
    let n = parseInt(pair[1]);
    if (n) level = n;
    console.log("Level", n);
  }
}

const renderers = setupCanvas();
const networkClient = new NetworkClient();
loadGlobalResources(renderers.width, renderers.height).then(
  (globalResources) => {
    let shipStats = {};

    let gameStats = {
      levelResources: {},
      level,
    };

    function screenToClipX(x) {
      return (x / renderers.width - 0.5) * 2;
    }

    function screenToClipY(y) {
      return (0.5 - y / renderers.height) * 2;
    }

    function resetStats() {
      shipStats.health = 100;
      shipStats.running = true;
      shipStats.failed = false;
      shipStats.finished = false;
      shipStats.requiresRestart = false;
      shipStats.gotoMenu = false;
      shipStats.ship = null;
    }

    let lastStatSend = -1;

    resetStats();

    function onFrame(t, landed, landTime, shipHealth, ship) {
      shipStats.health = shipHealth;
      shipStats.ship = ship;
      if (Date.now() - lastStatSend > 3000 + Math.random() * 3000) {
        networkClient.sendStats(
          screenToClipX(ship.position.x),
          screenToClipY(ship.position.y),
          ship.angle,
          shipHealth,
        );
        lastStatSend = Date.now();
      }
    }

    function shouldStopFn() {
      return !shipStats.running;
    }

    function onFinish(reason) {
      shipStats.running = false;

      networkClient.sendStats(
        screenToClipX(shipStats.ship.position.x),
        screenToClipY(shipStats.ship.position.y),
        shipStats.ship.angle,
        shipStats.health,
      );

      console.log("Game finished");

      if (reason == GAME_FINISH_REASONS.HEALTH_ZERO) {
        console.log("sending death threat");
        networkClient.sendDeath();
        shipStats.finished = false;
        shipStats.failed = true;
      }

      if (reason == GAME_FINISH_REASONS.LEVEL_COMPLETE) {
        networkClient.sendFinish();
        shipStats.failed = false;
        shipStats.finished = true;
      }

      networkClient.exitGame();
    }

    function shouldStopIntance() {
      return shipStats.requiresRestart || shipStats.gotoMenu;
    }

    function onRestart() {
      shipStats.requiresRestart = true;
    }

    async function onStopInstance() {
      if (shipStats.requiresRestart) {
        shipStats.requiresRestart = false;

        const result = await networkClient.requestGame(gameStats.level);

        if (!result) {
          alert(
            "Restart failed, try going to main menu by reloading this page.",
          );
          return;
        }

        resetStats();
        startInstance();
        return;
      }

      if (shipStats.gotoMenu) {
        shipStats.gotoMenu = false;
        resetStats();
        startMenu();
        return;
      }
    }

    async function startMenu() {
      menu(renderers, globalResources, {}, networkClient, {
        onGameStart: (levelIdx) => {
          console.log("start level", levelIdx + 1);
          gameStats.level = levelIdx + 1;
          startInstance();
        },
      });
    }

    function exitToMenu() {
      shipStats.gotoMenu = true;
    }

    async function startInstance() {
      const levelPrefix = levels[gameStats.level].filePrefix;

      let levelResources = gameStats.levelResources[levelPrefix];
      if (!levelResources) {
        levelResources = await loadLevelResources(
          levelPrefix,
          renderers.width,
          renderers.height,
          networkClient,
        );
      }
      gameStats.levelResources[levelPrefix] = levelResources;

      networkClient.sendStart();

      shipStats.instance = main(
        levels[gameStats.level].filePrefix,
        renderers,
        globalResources,
        levelResources,
        networkClient,
        {
          shouldStopInstanceCallBack: shouldStopIntance,
          shouldStopPlay: shouldStopFn,
          frameCallback: onFrame,
          finishCallback: onFinish,
          restartCallback: onRestart,
          onStopInstance,
          onExitToMenu: exitToMenu,
        },
      );
    }
    // startInstance();
    startMenu();
  },
);
