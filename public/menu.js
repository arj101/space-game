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

  window.addEventListener("pointerdown", (e) => {
    mouse.y = e.pageY * pixelRatio;
    mouse.x = e.pageX * pixelRatio;
    mouse.down = true;

    if (mouseInsideElement(elements.login) && !networkClient.loggedIn) {
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

  document.getElementById("login").addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const password = document.getElementById("password").value;
    const username = document.getElementById("username").value;

    if (!password || !username) {
      alert("Fill both password and username");
      return;
    }

    const result = await networkClient.login(username, password);

    if (result) {
      form.style.display = "none";
      elements.login.open = false;
    } else {
      alert("Login failed");
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

  let selectedLevel = null;

  let playbuttonHold = null;

  let quitted = false;

  let levelReqSent = false;

  run();
  function run(t) {
    if (quitted) return;
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

        if (mouse.down && networkClient.loggedIn) {
          selectedLevel = i;
        }
      }

      if (selectedLevel == i) {
        //green background
        ctx.fillStyle = "rgba(28, 255, 89, 0.1)";
        ctx.fillRect(levelRectX, levelRectY, boxSize.width, boxSize.height);
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

    ctx.fillStyle = "white";
    ctx.font = "600 30px Orbitron";

    const loginText = networkClient.loggedIn
      ? `Hi, ${networkClient.username}!`
      : "Login";
    ctx.fillText(
      loginText,
      networkClient.loggedIn
        ? elements.login.x +
            elements.login.width +
            50 -
            ctx.measureText(loginText).width
        : elements.login.x +
            elements.login.width / 2 -
            ctx.measureText(loginText).width / 2,
      elements.login.y + elements.login.height / 2 + 10,
    );

    if (!networkClient.loggedIn) {
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

      const playbuttonElement = {
        x: elements.play.x,
        y: elements.play.y + elements.play.height - 100,
        width: elements.play.width,
        height: 100,
      };

      if (
        mouseInsideElement(playbuttonElement) &&
        mouse.down &&
        (levels[selectedLevel].finished || selectedLevel == nextLevel)
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

          if (holdProgressF >= 0.7 && !levelReqSent) {
            levelReqSent = true;
            networkClient.requestGame(selectedLevel + 1).then((result) => {
              if (result) return;
              console.log("Level request failed");
            });
            console.log("Requesting game...");
          }

          if (holdProgressF <= 0 && levelReqSent) {
            levelReqSent = false;
          }

          if (holdProgressF >= 1 && networkClient.gameSessionID != null) {
            console.log(networkClient.gameSessionID);
            console.log("Request succeeded, starting level :)");
            quitted = true;
            onGameStart(selectedLevel);
          }
        }
      } else if (playbuttonHold != null) {
        levelReqSent = false;
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
      ctx.font = "600 33px Orbitron";
      ctx.fillText(
        loginToPlayText,
        elements.play.x +
          elements.play.width / 2 -
          ctx.measureText(loginToPlayText).width / 2,
        elements.play.y + elements.play.height / 2 + 20,
      );
    }
  }
}
