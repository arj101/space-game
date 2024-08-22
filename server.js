const express = require("express");
const fs = require("fs");
const uuid = require("uuid");

const database = {};

database.getUserIDfromName = function (username) {
  return "sngagjgsnj";
};
database.getUser = function (userid) {
  return {
    username: "nevergonnagiveyouup",
    password: "1234",
    currlevel: 2,
  };
};

//Map<userID, username>
const users = new Map();

//Map<sessionID, userID>
const sessions = new Map();

//Map<sessionID, gameID>
const gameSessions = new Map();

//Map<gameID, GameSession>
const games = new Map();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
//security by obscurity
app.post("/:id/:username/login", (req, res) => {
  const username = req.params.username;

  let sum = 0;
  for (let i = 0; i < username.length; i++) {
    const c = username.charCodeAt(i);
    sum |= 0b1 << (c + i) % 26;
    sum = (sum * 3) % 24882501;
  }

  const id = sum.toString();

  if (id !== req.params.id) {
    res.status(401).send("Unauthorized");

    return;
  }

  const psd = req.headers.psd;

  const userid = database.getUserIDfromName(username);

  if (!userid) {
    res.status(401).send("Unauthorized");
    return;
  }

  const dbuser = database.getUser(userid);

  if (!dbuser) {
    res.status(401).send("Unauthorized");
    return;
  }

  if (dbuser.username !== username) {
    res.status(401).send("Unauthorized");
    return;
  }

  if (dbuser.password !== psd) {
    res.status(401).send("Unauthorized");
    return;
  }

  const sid = uuid.v4();

  sessions[sid] = userid;

  res.send({ status: "success", sid, userid, currlevel: dbuser.currlevel });
});

app.post("/:userid/:sessionid/gamereq/:level", (req, res) => {
  const userid = req.params.userid;
  const sessionid = req.params.sessionid;
  const level = req.params.level;

  if (isNaN(parseInt(level))) {
    res.status(401).send("Unauthorized 0");
    return;
  }

  const levelnum = parseInt(level);

  if (sessions[sessionid] !== userid) {
    res.status(401).send("Unauthorized 1");
    return;
  }

  const user = database.getUser(userid);

  if (!user) {
    res.status(401).send("Unauthorized 2");
    return;
  }

  console.log("Requesting level ", levelnum, user.currlevel);
  if (levelnum > user.currlevel) {
    res.status(401).send("You havent reached there yet :(");
    return;
  }

  const gameSessionID = uuid.v4();
  const gameSession = {
    id: gameSessionID,
    level: levelnum,
    userid,
    timestamp: Date.now(),
  };

  gameSessions[sessionid] = gameSessionID;
  games[gameSessionID] = gameSession;

  res.send({ statis: "success", id: gameSessionID });
});

app.get("/levels/:level/*", (req, res, next) => {
  const level = req.params.level;
  const levelNum = parseInt(level);
  if (isNaN(levelNum)) {
    res.status(401).send("Invalid request");
  }

  console.log("Trying to read from level ", levelNum);

  const sessionid = req.headers.sid;

  if (!sessions[sessionid]) {
    res.status(401).send("Unauthorized ");
    console.log("invalid session");
    return;
  }

  if (
    !gameSessions[sessionid] ||
    gameSessions[sessionid] !== req.headers.gsid
  ) {
    res.status(401).send("Unauthorized");
    console.log("invalid gamesession");
    return;
  }

  const gameSessionID = gameSessions[sessionid];
  const gameSession = games[gameSessionID];

  if (!gameSession) {
    res.status(401).send("Unauthorized");
    console.log("game session not found");
    return;
  }

  if (levelNum != gameSession.level) {
    res.status(401).send("Unauthorized");
    console.log("wrong level");
    return;
  }

  next();
});

app.post("/:sessionid/:gamesessionid/alive/", async (req, res) => {
  if (!sessions[req.params.sessionid]) {
    res.status(401).send("Unauthorized");
    return;
  }

  if (
    !gameSessions[req.params.sessionid] ||
    !gameSessions[req.params.sessionid] !== req.params.gamesessionid
  ) {
    res.status(401).send("Unauthorized");
    return;
  }

  const gameSessionID = gameSessions[req.params.sessionid];
  const gameSession = games[gameSessionID];

  if (!gameSession) {
    res.status(401).send("Unauthorized");
    return;
  }

  const data = req.body;

  if (!data) {
    res.status(401).send("Invalid request");
    return;
  }

  const result = await gameSession.update(data);

  if (result) res.send({ status: "success" });
  else res.status(401).send({ status: "failed" });
});

app.use(express.static("public"));
app.listen(process.env.PORT || 5173, process.env.ADDR || "127.0.0.1");
