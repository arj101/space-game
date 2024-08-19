const GLOBAL_OBJ_SCALE = 0.4;

function loadGlobalResources() {
  return new Promise(async (resolve, reject) => {
    const shipFile = "/shipwhole.png";
    const flameFile = "/flame.png";

    const menuSlideAudioFile = "/audio/menu_slide2.wav";
    const menuClickAudioFile = "/audio/menu_click.mp3";

    const shipImageP = loadImage(shipFile);
    const flameImageP = loadImage(flameFile);
    const menuSlideAudioP = loadAudio(menuSlideAudioFile);
    const menuClickAudioP = loadAudio(menuClickAudioFile);

    const [shipImage, flameImage, menuSlideAudio, menuClickAudio] =
      await Promise.all([
        shipImageP,
        flameImageP,
        menuSlideAudioP,
        menuClickAudioP,
      ]);

    const audioContext = new AudioContext({ latencyHint: "interactive" });
    const menuSlideTrack =
      audioContext.createMediaElementSource(menuSlideAudio);

    const menuClickTrack =
      audioContext.createMediaElementSource(menuClickAudio);

    menuSlideTrack.connect(audioContext.destination);
    menuClickTrack.connect(audioContext.destination);

    resolve({
      shipImage,
      flameImage,
      audioCtx: audioContext,
      menuSlideTrack,
      menuSlideAudio,
      menuClickAudio,
      menuClickTrack,
    });
  });
}

function loadLevelResources(filePrefix, width, height) {
  return new Promise(async (resolve, reject) => {
    const collissionFile = filePrefix + "collission.obj";
    const terrainFile = filePrefix + "terrain.obj";
    const terrainImageFile = filePrefix + "terrain.png";

    const startPlatformImageFile = filePrefix + "start.png";
    const finishPlatformImageFile = filePrefix + "finish.png";

    const collissionP = loadText(collissionFile);
    const terrainP = loadText(terrainFile);
    const finishObjFile = filePrefix + "finish.obj";

    const terrainImageP = loadImage(terrainImageFile);
    const startPlatformImageP = loadImage(startPlatformImageFile);
    const finishPlatformP = loadImage(finishPlatformImageFile);
    const finishObjP = loadText(finishObjFile);

    let [
      collissionText,
      terrainText,
      terrainImage,
      startPlatformImage,
      finishPlatformImage,
      finishObjText,
    ] = await Promise.all([
      collissionP,
      terrainP,
      terrainImageP,
      startPlatformImageP,
      finishPlatformP,
      finishObjP,
    ]);

    let collissionObjs = parseOBJCollissionData(collissionText);
    collissionObjs = collissionObjs.map((collissionObj) =>
      scaleOBJ(
        (GLOBAL_OBJ_SCALE * height) / width,
        GLOBAL_OBJ_SCALE,
        collissionObj,
      ),
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

    const Vector = Matter.Vector,
      Bodies = Matter.Bodies;

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

    let terrainObj = parseOBJ(terrainText);
    terrainObj = scaleOBJ(GLOBAL_OBJ_SCALE, GLOBAL_OBJ_SCALE, terrainObj);
    terrainObj = scaleOBJ(height / width, 1, terrainObj);

    let finishObj = parseOBJ(finishObjText);
    finishObj = scaleOBJ(GLOBAL_OBJ_SCALE, GLOBAL_OBJ_SCALE, finishObj);
    finishObj = scaleOBJ(height / width, 1, finishObj);

    resolve({
      collissionBodies,
      terrainObj,
      terrainImage,
      startPlatformImage,
      finishPlatformImage,
      finishPlatformBody: finishPlatform, //this is the body used for collission detection while...
      finishPlatformObj: finishObj, //this is the object used for rendering
    });
  });
}
