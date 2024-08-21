/**
Function for hit testing rectangles inside a scaled canvas.
@param {HTMLElement} element
    @param {number} x x position of rectangle inside canvas (scaled)
    @param {number} y y position of rectangle inside canvas (scaled)
    @param {number} w width of rectangle (scaled)
    @param {number} h height of rectangle (scaled)
    @param {number} px x position with respect to screen (not scaled)
    @param {number} py y position with respect to screen (not scaled)
*/
function insideRect(canvas, x, y, w, h, px, py) {
  const pixelRatio = window.devicePixelRatio || 1;
  const bounds = canvas.getBoundingClientRect();
  const scale = (canvas.width * pixelRatio) / bounds.width;

  const offX = px - bounds.left * pixelRatio;
  const offY = py - bounds.top * pixelRatio;

  const soffX = offX * scale;
  const soffY = offY * scale;

  return soffX >= x && soffX <= x + w && soffY >= y && soffY <= y + h;
}

/**
 * @param {string} levelPrefix
 * @param {object} options
 * @param {number} options.width
 * @param {number} options.height
 * @param {CanvasRenderingContext2D} options.ctx
 * @param {WebGLRenderingContext} options.gl
 * @param {object} globalResources
 * @param {object} levelResources
 * @param {object} callbacks
 */

async function menu(
  { width, height, ctx, gl },
  globalResources,
  levelResources,
  { onLevelStart } = {
    onGameStart: () => {},
  },
) {
  const elements = {
    leaderboard: {
      x: 80,
      y: 200,
      width: 900,
      height: 700,
    },

    play: {
      x: 1000,
      y: 200,
      width: 900,
      height: 700,
    },
  };

  const mouse = { x: -1, y: -1, down: false };
  const pixelRatio = window.devicePixelRatio || 1;

  const mouseInsideElement = (element) => {
    return insideRect(
      ctx.canvas,
      element.x,
      element.y,
      element.width,
      element.height,
      mouse.x,
      mouse.y,
    );
  };

  window.addEventListener("pointerdown", (e) => {
    mouse.y = e.pageY * pixelRatio;
    mouse.x = e.pageX * pixelRatio;
    mouse.down = true;
  });

  window.addEventListener("pointerup", (e) => {
    mouse.down = false;
  });

  window.addEventListener("wheel", (e) => {
    mouse.y = e.pageY * pixelRatio;
    mouse.x = e.pageX * pixelRatio;

    //mouse inside leaderboard
    if (mouseInsideElement(elements.leaderboard)) {
      leaderboardOffset += Math.floor(e.deltaY / 20);
      console.log(e);

      leaderboardOffset = Math.max(
        0,
        Math.min(leaderboard.length - 10, leaderboardOffset),
      );
    }
  });

  window.addEventListener("pointermove", (e) => {
    mouse.x = e.pageX * pixelRatio;
    mouse.y = e.pageY * pixelRatio;
    console.log(e.movementY);

    //scroll leaderboard just like before
    if (mouse.down && mouseInsideElement(elements.leaderboard)) {
      console.log(e);
      leaderboardOffset += Math.floor(-e.movementY / 5);

      leaderboardOffset = Math.max(
        0,
        Math.min(leaderboard.length - 10, leaderboardOffset),
      );
      console.log(leaderboardOffset);
    }
  });

  //create a leaderboard of random names and scores
  let leaderboard = Array.from({ length: 200 }, (_, i) => ({
    name: Math.random().toString(36).substring(7),
    score: Math.floor(Math.random() * 1000),
  }));
  let leaderboardOffset = 0;

  let nextLevel = 1;
  let levels = [
    { finished: true, position: 6 },
    { finished: false },
    { finished: false },
    { finished: false },
    { finished: false },
    { finished: false },
  ];

  run();
  function run(t) {
    requestAnimationFrame(run);

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);

    ctx.font = "800 80px Orbitron";
    const { width: tw } = ctx.measureText("Real space game");
    ctx.fillStyle = "white";
    if (
      insideRect(
        ctx.canvas,
        width / 2 - tw / 2,
        100 - 80,
        tw,
        80,
        mouse.x,
        mouse.y,
      )
    ) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.abs(Math.sin(t * 0.01))})`;
    }
    ctx.fillText("Real space game", width / 2 - tw / 2, 100);

    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;

    ctx.strokeRect(
      elements.leaderboard.x,
      elements.leaderboard.y,
      elements.leaderboard.width,
      elements.leaderboard.height,
    );
    ctx.stroke();

    ctx.font = "600 40px Orbitron";
    const { width: lw } = ctx.measureText("Leaderboard");

    ctx.fillStyle = "white";
    ctx.fillText(
      "Leaderboard",
      elements.leaderboard.x + elements.leaderboard.width / 2 - lw / 2,
      elements.leaderboard.y + 60,
    );

    for (
      let i = leaderboardOffset;
      i < leaderboard.length && i < leaderboardOffset + 10 && i >= 0;
      i++
    ) {
      const offset = i - leaderboardOffset;

      const { name, score } = leaderboard[i];
      const posText = `${i + 1}`;
      1;
      ctx.font = "400 32px Orbitron";
      ctx.fillText(
        posText,
        elements.leaderboard.x + 100 - ctx.measureText(posText).width,
        elements.leaderboard.y + 150 + offset * 50,
      );

      ctx.font = "600 32px Orbitron";
      ctx.fillText(
        `${name}`,
        elements.leaderboard.x + 150,
        elements.leaderboard.y + 150 + offset * 50,
      );

      ctx.font = "400 32px Orbitron";
      ctx.fillText(
        `${score}`,
        elements.leaderboard.x + elements.leaderboard.width - 180,
        elements.leaderboard.y + 150 + offset * 50,
      );
    }

    //render levels
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      elements.play.x,
      elements.play.y,
      elements.play.width,
      elements.play.height,
    );
    ctx.stroke();

    ctx.font = "600 40px Orbitron";
    ctx.fillText(
      "Play",
      elements.play.x +
        elements.play.width / 2 -
        ctx.measureText("Play").width / 2,
      elements.play.y + 60,
    );

    let levelRectX = elements.play.x + 100;
    let levelRectY = elements.play.y + 150;

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];

      ctx.fillStyle = "white";
      ctx.font = "400 32px Orbitron";

      const boxSize = { width: 140, height: 140, padding: 20 };

      ctx.fillText(
        `${i + 1}`,
        levelRectX + boxSize.width / 2 - ctx.measureText(`${i + 1}`).width / 2,
        levelRectY + boxSize.height / 2 + 16,
      );

      ctx.strokeStyle = level.finished
        ? "rgb(28, 255, 89)"
        : "rgb(255, 23, 100)";

      ctx.save();
      if (i == nextLevel) {
        ctx.strokeStyle = "rgb(28, 123, 255)";
        ctx.lineWidth = 10;
        // ctx.strokeRect(levelRectX, levelRectY, boxSize.width, boxSize.height);
      }

      ctx.strokeRect(levelRectX, levelRectY, boxSize.width, boxSize.height);

      if (
        mouseInsideElement({
          x: levelRectX,
          y: levelRectY,
          width: boxSize.width,
          height: boxSize.height,
        })
      ) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";

        ctx.strokeRect(
          levelRectX - 5,
          levelRectY - 5,
          boxSize.width + 10,
          boxSize.height + 10,
        );
      }
      ctx.restore();

      levelRectX += boxSize.width + boxSize.padding;
      if (
        levelRectX >=
        elements.play.x +
          elements.play.width -
          100 -
          boxSize.padding -
          boxSize.width
      ) {
        levelRectX = elements.play.x + 100;
        levelRectY += boxSize.height + boxSize.padding;
      }

      // if (level.finished) {
      //   ctx.fillStyle = "green";
      //   ctx.fillRect(levelRectX + 200, levelRectY + i * 50 - 20, 20, 20);
      // }
    }
  }
}
