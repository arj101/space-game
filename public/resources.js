const GLOBAL_OBJ_SCALE = 0.4;

function loadGlobalResources(width, height) {
  return new Promise(async (resolve, reject) => {
    const shipFile = "/ship.png";
    const flameFile = "/flame.png";
    const ship2File = "/ship.png";
    const shipVertexFile = "/ship.obj";
    const shipTextObjFile = "/shiptex.obj";

    const menuSlideAudioFile = "/audio/menu_slide2.wav";
    const menuClickAudioFile = "/audio/menu_click.mp3";

    const shipImageP = loadImage(shipFile);
    const flameImageP = loadImage(flameFile);
    const shipVertexFileP = loadText(shipVertexFile);
    const shipTexObjFileP = loadText(shipTextObjFile);
    const menuSlideAudioP = loadAudio(menuSlideAudioFile);
    const menuClickAudioP = loadAudio(menuClickAudioFile);

    const [
      shipImage,
      flameImage,
      menuSlideAudio,
      menuClickAudio,
      shipVertices,
      shipTexObjText,
    ] = await Promise.all([
      shipImageP,
      flameImageP,
      menuSlideAudioP,
      menuClickAudioP,
      shipVertexFileP,
      shipTexObjFileP,
    ]);

    const audioContext = new AudioContext({ latencyHint: "interactive" });
    const menuSlideTrack =
      audioContext.createMediaElementSource(menuSlideAudio);

    const menuClickTrack =
      audioContext.createMediaElementSource(menuClickAudio);

    menuSlideTrack.connect(audioContext.destination);
    menuClickTrack.connect(audioContext.destination);

    let shipVertexObj = parseOBJCollissionData(shipVertices);
    console.log("Ship vertex obj", shipVertexObj);

    shipVertexObj = shipVertexObj.map((collissionObj) =>
      scaleOBJ(
        (GLOBAL_OBJ_SCALE * height) / width,
        GLOBAL_OBJ_SCALE,
        collissionObj,
      ),
    );
    // const { collissionTries: shipCollissionBodies, finishPlatform } =
    //   buildCollissionRects(shipVertexObj, width, height, { isStatic: false });

    let shipTexObj = parseOBJ(shipTexObjText);
    shipTexObj = scaleOBJ(
      (GLOBAL_OBJ_SCALE * height) / width,
      GLOBAL_OBJ_SCALE,
      shipTexObj,
    );

    resolve({
      shipImage,
      flameImage,
      audioCtx: audioContext,
      menuSlideTrack,
      menuSlideAudio,
      menuClickAudio,
      menuClickTrack,
      shipCollissionObjs: shipVertexObj,
      shipTexObj,
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

    const objectsInfoFile = filePrefix + "objects.json"; //contains info about other non-terrain object in the world

    const objectsInfo = await loadJSON(objectsInfoFile);

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
    const { collissionTries, finishPlatform } = buildCollissionRects(
      collissionObjs,
      width,
      height,
    );

    let terrainObj = parseOBJ(terrainText);
    terrainObj = scaleOBJ(GLOBAL_OBJ_SCALE, GLOBAL_OBJ_SCALE, terrainObj);
    terrainObj = scaleOBJ(height / width, 1, terrainObj);

    let finishObj = parseOBJ(finishObjText);
    finishObj = scaleOBJ(GLOBAL_OBJ_SCALE, GLOBAL_OBJ_SCALE, finishObj);
    finishObj = scaleOBJ(height / width, 1, finishObj);

    const otherObjects = {};

    //todo async loading
    for (const obj in objectsInfo) {
      console.log(objectsInfo[obj].vertices, objectsInfo[obj].texture);
      otherObjects[obj] = {
        vertices: scaleOBJ(
          (height / width) * GLOBAL_OBJ_SCALE,
          GLOBAL_OBJ_SCALE,
          parseOBJ(await loadText(filePrefix + objectsInfo[obj]["vertices"])),
        ),
        texture: await loadImage(filePrefix + objectsInfo[obj]["texture"]),
      };
    }

    // console.log("others", otherObjects);

    resolve({
      collissionTries,
      terrainObj,
      terrainImage,
      startPlatformImage,
      finishPlatformImage,
      finishPlatformBody: finishPlatform, //this is the body used for collission detection while...
      finishPlatformObj: finishObj, //this is the object used for rendering
      otherObjects,
    });
  });
}
