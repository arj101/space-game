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
  const scale = canvas.width / (bounds.width * pixelRatio);

  const offX = px - bounds.left * pixelRatio;
  const offY = py - bounds.top * pixelRatio;

  const soffX = offX * scale;
  const soffY = offY * scale;

  return soffX >= x && soffX <= x + w && soffY >= y && soffY <= y + h;
}

function outsideRect(canvas, x, y, w, h, px, py) {
  return !insideRect(canvas, x, y, w, h, px, py);
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
  networkClient,
  { onGameStart } = {
    onGameStart: (levelIdx) => {},
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

    login: {
      x: 1700,
      y: 50,
      width: 150,
      height: 80,
      open: false,
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

  const form = document.getElementById("loginform");

  window.onpointerdown = (e) => {
    mouse.y = e.pageY * pixelRatio;
    mouse.x = e.pageX * pixelRatio;
    mouse.down = true;

    if (mouseInsideElement(elements.login)) {
      form.style.display = "flex";
      elements.login.open = true;
    } else if (elements.login.open) {
      const bounds = form.getBoundingClientRect();
      if (
        mouse.x > bounds.left * pixelRatio &&
        mouse.x < bounds.right * pixelRatio &&
        mouse.y > bounds.top * pixelRatio &&
        mouse.y < bounds.bottom * pixelRatio
      )
        return;
      form.style.display = "none";
      elements.login.open = false;
    }
  };

  window.onpointerup = (e) => {
    mouse.down = false;
  };

  window.onwheel = (e) => {
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
  };

  window.onpointermove = (e) => {
    mouse.x = e.pageX * pixelRatio;
    mouse.y = e.pageY * pixelRatio;

    //scroll leaderboard just like before
    if (mouse.down && mouseInsideElement(elements.leaderboard)) {
      leaderboardOffset += Math.floor(-e.movementY / 5);

      leaderboardOffset = Math.max(
        0,
        Math.min(leaderboard.length - 10, leaderboardOffset),
      );
    }
  };

  //create a leaderboard of random names and scores
  let leaderboard = Array.from({ length: 200 }, (_, i) => ({
    username: Math.random().toString(36).substring(7),
    score: Math.floor(Math.random() * 1000),
  }));
  let leaderboardOffset = 0;

  let nextLevel = 1;
  let levelCount = 8;
  let levels = [
    { finished: true, position: 6 },
    { finished: false },
    { finished: false },
    { finished: false },
    { finished: false },
    { finished: false },
  ];

  let selectedLevel = null;

  let playbuttonHold = null;

  let quitted = false;

  let levelReqSent = false;

  let selectedLeaderboard = "global";
  let loadedLeaderboard = "global";

  let eKeyDown = false;

  window.onkeydown = (e) => {
    if (e.key == "e" || e.key == "E") {
      eKeyDown = true;
    }
  };

  window.onkeyup = (e) => {
    if (e.key == "e" || e.key == "E") {
      eKeyDown = false;
      changedLeaderboard = true;
      changedLeaderboard = true;
    }

    let changedLeaderboard = false;
    if (e.key == "a" || e.key == "A" || e.key == "ArrowLeft") {
      selectedLevel -= 1;
      if (selectedLevel < 0) selectedLevel = levelCount - 1;
      changedLeaderboard = true;
    }
    if (e.key == "d" || e.key == "D" || e.key == "ArrowRight") {
      selectedLevel = (selectedLevel + 1) % levelCount;
      changedLeaderboard = true;
    }
    if (changedLeaderboard) {
      updateLeaderboard();
      selectedLeaderboard = selectedLevel == null ? "global" : selectedLevel;
    }

    if (e.key == "w" || e.key == "W") {
      selectedLevel = null;
      selectedLeaderboard = "global";
      updateLeaderboard();
    }
  };

  const updateLeaderboard = async () => {
    let serverLeaderboard;
    try {
      if (selectedLeaderboard == "global") {
        serverLeaderboard = await networkClient.fetchGlobalLeaderboard();
        loadedLeaderboard = selectedLeaderboard;
      } else {
        serverLeaderboard = await networkClient.fetchLevelLeaderboard(
          selectedLeaderboard + 1,
        );
        loadedLeaderboard = selectedLeaderboard + 1;
      }
      if (serverLeaderboard) leaderboard = serverLeaderboard;

      leaderboardOffset = Math.max(
        0,
        Math.min(leaderboardOffset, leaderboard.length - 10),
      );
    } catch (e) {
      console.log("Error fetching leaderboard", e);
    }
  };

  updateLeaderboard();
  const leaderboardUpdatePoll = setInterval(updateLeaderboard, 5000);

  run();
  function run(t) {
    if (quitted) {
      clearInterval(leaderboardUpdatePoll);
      return;
    }
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
    const leaderboardText = "High scores";
    const { width: lw } = ctx.measureText(leaderboardText);

    ctx.fillStyle = "white";
    ctx.fillText(
      leaderboardText,
      elements.leaderboard.x + elements.leaderboard.width / 2 - lw / 2,
      elements.leaderboard.y + 60,
    );

    //scroll bar
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(
      elements.leaderboard.x + elements.leaderboard.width - 20,
      elements.leaderboard.y +
        130 +
        (480 / leaderboard.length) * leaderboardOffset,
      5,
      Math.min(480, 480 * (10 / leaderboard.length)),
    );

    ctx.fillStyle = "rgba(255, 255, 255, 1)";
    let finishedLevels = Object.keys(networkClient.scores);
    for (let i = 0; i < finishedLevels.length; i++) {
      const offset = i - leaderboardOffset;
      let username = `Level ${finishedLevels[i]}`;
      let score = networkClient.scores[finishedLevels[i]];

      if (!username) continue;

      ctx.font = "600 32px Orbitron";
      ctx.fillText(
        `${username}`,
        elements.leaderboard.x + 150,
        elements.leaderboard.y + 150 + offset * 50,
      );

      ctx.font = "400 32px Orbitron";
      const timeSeconds = score / 1000;
      const subSecondPart = Math.floor(score / 10) % 100;
      const secondsPart = Math.floor(timeSeconds % 60);
      const minutesPart = Math.floor(timeSeconds / 60);
      //render all parts
      let scoreText = `${minutesPart > 0 ? minutesPart.toString() + ":" : ""}${secondsPart < 10 ? "0" : ""}${secondsPart}:${subSecondPart < 10 ? "0" : ""}${subSecondPart}`;

      ctx.fillText(
        `${scoreText}`,
        elements.leaderboard.x +
          elements.leaderboard.width -
          50 -
          ctx.measureText(scoreText).width,
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

    //very genius way to check if mouse is outside some elements lol (/s)
    let mouseOutsideLevelBoxes = levelCount;

    for (let i = 0; i < levelCount; i++) {
      const levelnum = i + 1;

      ctx.fillStyle = "white";
      ctx.font = "400 32px Orbitron";

      const boxSize = { width: 140, height: 140, padding: 20 };

      ctx.fillText(
        `${i + 1}`,
        levelRectX + boxSize.width / 2 - ctx.measureText(`${i + 1}`).width / 2,
        levelRectY + boxSize.height / 2 + 16,
      );

      ctx.strokeStyle =
        levelnum < networkClient.currLevel
          ? "rgb(28, 255, 89)"
          : "rgb(255, 23, 100)";

      ctx.save();
      if (levelnum == networkClient.currLevel && levelnum <= levelCount) {
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

        if (mouse.down && networkClient.loggedIn) {
          selectedLevel = i;
          if (selectedLeaderboard != i) {
            selectedLeaderboard = i;
            updateLeaderboard();
          }
        }
      } else {
        mouseOutsideLevelBoxes -= 1;
      }

      if (selectedLevel == i) {
        //green background
        ctx.strokeStyle = "rgba(255, 255, 255, 1)";
        ctx.lineWidth = 4;
        ctx.strokeRect(
          levelRectX - 3,
          levelRectY - 3,
          boxSize.width + 6,
          boxSize.height + 6,
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

    const playbuttonElement = {
      x: elements.play.x,
      y: elements.play.y + elements.play.height - 100,
      width: elements.play.width,
      height: 100,
    };

    if (
      mouse.down &&
      mouseOutsideLevelBoxes <= 0 &&
      !mouseInsideElement(playbuttonElement) &&
      mouseInsideElement(elements.play)
    ) {
      selectedLeaderboard = "global";
      selectedLevel = null;
      updateLeaderboard();
    }

    ctx.fillStyle = "white";
    ctx.font = "600 30px Orbitron";

    const loginText = "Credits";
    ctx.fillText(
      loginText,
      elements.login.x +
        elements.login.width / 2 -
        ctx.measureText(loginText).width / 2,
      elements.login.y + elements.login.height / 2 + 10,
    );

    //render login button
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      elements.login.x,
      elements.login.y,
      elements.login.width,
      elements.login.height,
    );
    ctx.stroke();
    if (mouseInsideElement(elements.login)) {
      ctx.strokeStyle = "white";
      ctx.strokeRect(
        elements.login.x - 5,
        elements.login.y - 5,
        elements.login.width + 10,
        elements.login.height + 10,
      );
    }

    if (selectedLevel != null) {
      //display  play button
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        elements.play.x,
        elements.play.y + elements.play.height - 100,
        elements.play.width,
        100,
      );
      ctx.font = "600 30px Orbitron";
      const levelText = `Play level ${selectedLevel + 1}`;
      ctx.fillText(
        levelText,
        elements.play.x +
          elements.play.width / 2 -
          ctx.measureText(levelText).width / 2,
        elements.play.y + elements.play.height - 40,
      );

      if (
        ((mouseInsideElement(playbuttonElement) &&
          (mouse.down || levelReqSent)) ||
          eKeyDown) &&
        selectedLevel + 1 <= networkClient.currLevel
      ) {
        if (playbuttonHold == null) {
          playbuttonHold = Date.now();
        } else {
          const holdProgress = Date.now() - playbuttonHold;
          const holdProgressF = Math.min(1, holdProgress / 600);
          ctx.fillStyle = "rgba(255, 255, 255, 1)";
          ctx.fillRect(
            elements.play.x,
            elements.play.y + elements.play.height - 100,
            elements.play.width * holdProgressF,
            100,
          );
          ctx.fillStyle = "black";
          ctx.fillText(
            levelText,
            elements.play.x +
              elements.play.width / 2 -
              ctx.measureText(levelText).width / 2,
            elements.play.y + elements.play.height - 40,
          );

          if (holdProgressF >= 1 && !levelReqSent) {
            levelReqSent = true;
            console.log("Requesting game...");

            networkClient
              .requestGame(selectedLevel + 1)
              .then((result) => {
                if (!result) {
                  levelReqSent = false;
                  playbuttonHold = null;
                  alert("Failed to start level");
                  return;
                }
                console.log(networkClient.gameSessionID);
                console.log("Request succeeded, starting level :)");
                quitted = true;
                window.onkeyup = null;
                window.onkeydown = null;
                window.onwheel = null;
                window.onpointermove = null;
                window.onpointerup = null;
                window.onpointerdown = null;
                onGameStart(selectedLevel);
              })
              .catch((e) => {
                console.error(e);
                levelReqSent = false;
                playbuttonHold = null;
              });
          }
        }
      } else if (!levelReqSent) {
        playbuttonHold = null;
      }
    }

    if (!networkClient.loggedIn) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(
        elements.play.x,
        elements.play.y,
        elements.play.width,
        elements.play.height,
      );
      ctx.stroke();

      const loginToPlayText = "Login to play";

      ctx.fillStyle = "rgb(255, 255, 255)";
      ctx.font = "600 32px Orbitron";
      ctx.fillText(
        loginToPlayText,
        elements.play.x +
          elements.play.width / 2 -
          ctx.measureText(loginToPlayText).width / 2,
        elements.play.y + elements.play.height / 2 + 20,
      );
    }

    if (levelReqSent) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(
        elements.play.x,
        elements.play.y,
        elements.play.width,
        elements.play.height,
      );
      ctx.stroke();

      const waitingText = "Loading...";

      ctx.fillStyle = "rgb(255, 255, 255)";
      ctx.font = "600 32px Orbitron";
      ctx.fillText(
        waitingText,
        elements.play.x +
          elements.play.width / 2 -
          ctx.measureText(waitingText).width / 2,
        elements.play.y + elements.play.height / 2 + 20,
      );
    }
  }
}
