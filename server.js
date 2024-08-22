const express = require("express");
const fs = require("fs");
const uuid = require("uuid");

const database = {};

database.getUser = function (userid) {
  return {
    username: "e",
    password: "1234",
    currlevel: 1,
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
app.post("/:userid/:username/login", (req, res) => {
  const userid = req.params.userid;
  const username = req.params.username;

  const psd = req.headers.psd;

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

  res.send({ status: "success", sid });
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

  if (user.currlevel < levelnum) {
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

  gameSessions[gameSessionID] = gameSession;

  res.send({ statis: "success", id: gameSessionID });
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

app.get("/levels/:level/*", (req, res, next) => {
  const level = req.params.level;
  const levelNum = parseInt(level);
  if (isNaN(levelNum)) {
    res.status(401).send("Invalid request");
  }

  console.log("Trying to read from level ", levelNum);

  const sessionid = req.headers.sesionid;

  if (!sessions[sessionid]) {
    res.status(401).send("Unauthorized");
    return;
  }

  if (
    !gameSessions[sessionid] ||
    !gameSessions[sessionid] !== req.headers.gsessionid
  ) {
    res.status(401).send("Unauthorized");
    return;
  }

  const gameSessionID = gameSessions[sessionid];
  const gameSession = games[gameSessionID];

  if (!gameSession) {
    res.status(401).send("Unauthorized");
    return;
  }

  if (levelNum != gameSession.level) {
    res.status(401).send("Unauthorized");
    return;
  }

  res.next();
});

app.use(express.static("public"));
app.listen(5173, "127.0.0.1");
