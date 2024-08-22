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

const GAME_SESSION_TIMEOUT = 15 * 1000;
const MAX_TIMESTAMP_ERROR = 30 * 1000;
const MAX_START_DELAY = 15 * 1000;
const MIN_GAME_COMPLETION_TIME = 6 * 1000;
class GameSession {
  constructor(userID, userSessionID, gameSessionID, levelNum) {
    this.running = true;
    this.userID = userID;
    this.userSessionID = userSessionID;
    this.gameSessionID = gameSessionID;
    this.levelNum = levelNum;
    this.clientStarted = false;
    this.starttimestamp = Date.now();
    this.clientstarttimestamp = null;
    this.pingtimestamp = Date.now();

    this.eventlog = [];
  }

  ping() {
    this.pingtimestamp = Date.now();
  }

  isActive() {
    return Date.now() - this.pingtimestamp < GAME_SESSION_TIMEOUT;
  }

  validateEvent(rawEvent) {
    if (!rawEvent.type) return { validEvent: false, criticalError: false };

    let validEvent = true;
    let criticalError = false;

    const timestamp = rawEvent.timestamp;
    if (!timestamp) return { validEvent: false, criticalError: false };

    if (timestamp < this.starttimestamp) {
      console.log("Invalidated game event because of timestamp inconsistency");
      validEvent = false;
      criticalError = true;
    }

    if (Date.now() - this.pingtimestamp > GAME_SESSION_TIMEOUT) {
      console.log(
        "Invalidated game event because of session timeout (didnt ping with a valid event)",
      );
      validEvent = false;
      criticalError = true;
    }

    const timestampError = Math.abs(timestamp - Date.now());
    if (timestampError > MAX_TIMESTAMP_ERROR) {
      console.log("Invalidated game event because of timestamp inconsistency");
      validEvent = false;
      criticalError = true;
    }

    let parsedEvent = { timestamp, type: rawEvent.type };

    switch (rawEvent.type) {
      case "start": {
        if (this.eventlog.length > 0 || this.clientStarted) {
          console.log(
            "Invalidated game session because of starting twice (or start isnt the first event to be sent)",
          );
          validEvent = false;
          criticalError = true;
        }
        if (Math.abs(this.starttimestamp - timestamp) > MAX_START_DELAY) {
          console.log("Invalidated game session because of starting too late");
          validEvent = false;
          criticalError = true;
        }

        if (!validEvent && !criticalError) {
          this.clientstarttimestamp = timestamp;
          this.clientStarted = true;
        }
        break;
      }

      //before sending finish, send an alive event with the final state
      case "finish": {
        if (this.eventlog.length === 0 || !this.clientStarted) {
          console.log(
            "Invalidated game session because of finishing without starting",
          );
          validEvent = false;
          criticalError = true;
        } else {
          const server_game_duration = Date.now() - this.starttimestamp;
          const client_game_duration = Math.abs(
            timestamp - this.clientstarttimestamp,
          );
          const min_duration = Math.min(
            server_game_duration,
            client_game_duration,
          );

          if (
            Math.abs(server_game_duration - client_game_duration) >
            MAX_TIMESTAMP_ERROR
          ) {
            //huge error in game duration
            console.log(
              "Invalidated game session because of mismatch in game duration",
            );
            validEvent = false;
            criticalError = true;
          }

          if (Math.abs(min_duration) < MIN_GAME_COMPLETION_TIME) {
            console.log(
              "Invalidated game session because of finishing too early",
            );
            validEvent = false;
            criticalError = true;
          }

          if (!criticalError && validEvent) {
            this.running = false;
          }
        }
        break;
      }

      case "alive": {
        if (!this.clientStarted) {
          console.log(
            "Invalidated game event because of sending alive event before starting",
          );
          validEvent = false;
          criticalError = true;
        } else {
          const xpos = rawEvent.xpos;
          const ypos = rawEvent.ypos;
          const angle = rawEvent.angle;
          const health = rawEvent.health;

          if (!xpos || !ypos || !angle || !health) {
            console.log(
              "Invalidated (just) game event because of sending invalid alive event",
            );
            validEvent = false;
          } else {
            parsedEvent.xpos = xpos;
            parsedEvent.ypos = ypos;
            parsedEvent.angle = angle;
            parsedEvent.health = health;
          }
        }

        break;
      }

      //before sending dead, send an alive event with the final state
      case "dead": {
        if (!this.clientStarted || !this.clientstarttimestamp) {
          console.log(
            "Invalidated game event because of sending dead event before starting",
          );
          validEvent = false;
          criticalError = true;
        } else {
          this.running = false;
          //no other checks needed, no one's gonna hack the die event lol
        }
        break;
      }

      default:
        validEvent = false;
        criticalError = true;
        console.log(
          "Invalidated game session (not just this particular event) because of sending invalid event type (client likely doesn't know what he's doing)",
        );
    }

    if (!validEvent && !criticalError) {
      this.ping();
      this.eventlog.push(parsedEvent);
    }

    return { validEvent, criticalError };
  }

  onReceiveKeepAlive(rawEvent) {
    if (!rawEvent) return false;
    if (!rawEvent.type) return false;
    if (!this.running) return false;

    const { validEvent, criticalError } = this.validateEvent(rawEvent);
    if (criticalError) this.running = false;

    return criticalError;
  }

  isValid() {
    if (Date.now() - this.pingtimestamp > GAME_SESSION_TIMEOUT) {
      console.log(
        "[isValid] Invalidated game session because of session timeout",
      );
      return false;
    }

    return true;
  }

  onClose() {
    console.log(
      "[GameSession] Closing game session (failed, finished or invalidated)",
    );
    console.log(`${this.eventlog.length} events were sent by the client`);
    console.log(`Events: ${this.eventlog}`);
    console.log("[GameSession] Bye bye... ");
  }
}

class GameSessionsManager {
  constructor() {
    this.sessionGameSessionMap = new Map();
    this.gameSessions = new Map();
    this.sessionPoll = setInterval(() => {
      for (const [sessionID, gsid] of this.sessionGameSessionMap) {
        const gameSession = this.gameSessions.get(gsid);
        if (!gameSession.isValid()) {
          console.log(
            `Game session ${gsid} is invalid. Deleting game session.`,
          );
          gameSession.onClose();
          this.deleteGameSession(sessionID, gsid);
        }

        if (!gameSession.running) {
          console.log(`Deleting session because it has finished running`);
          gameSession.onClose();
          this.deleteGameSession(sessionID, gsid);
        }
      }
    }, 5000);
  }

  createGameSession(userID, userSessionID, gameSessionID, levelnum) {
    if (this.sessionGameSessionMap.has(userSessionID)) {
      console.log(
        "User already in another session (or did not exit properly). Not allowing to create another session",
      );
      return false;
    }

    const gameSession = new GameSession(
      userID,
      userSessionID,
      gameSessionID,
      levelnum,
    );
    this.sessionGameSessionMap.set(userSessionID, gameSessionID);
    this.gameSessions.set(gameSessionID, gameSession);
    return true;
  }

  getGameSessionID(sessionID) {
    return this.sessionGameSessionMap.get(sessionID);
  }

  getGameSession(gameSessionID) {
    return this.gameSessions.get(gameSessionID);
  }

  deleteGameSession(sessionID, gameSessionID) {
    this.sessionGameSessionMap.delete(sessionID);
    this.gameSessions.delete(gameSessionID);
  }

  onReceiveKeepAliveAlive(gameSessionID, rawEventJSON) {
    const gameSession = this.getGameSession(gameSessionID);

    if (!rawEvent) return false;
    if (!rawEvent.type) return false;

    return gameSession.onReceiveKeepAlive(rawEvent);
  }
}

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

//automatically starts polling every 5 seconds
const gameSessionsManager = new GameSessionsManager();

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
    res.status(401).send("Unauthorised");
    return;
  }

  const levelnum = parseInt(level);

  if (sessions[sessionid] !== userid) {
    res.status(401).send("Unauthorised");
    return;
  }

  const user = database.getUser(userid);

  if (!user) {
    res.status(401).send("Unauthorised");
    return;
  }

  console.log("Requesting level ", levelnum, user.currlevel);
  if (levelnum > user.currlevel) {
    res.status(401).send("You havent reached there yet :(");
    return;
  }

  const gameSessionID = uuid.v4();

  const createdSession = gameSessionsManager.createGameSession(
    userid,
    sessionid,
    gameSessionID,
    levelnum,
  );

  if (createdSession) {
    res.send({ status: "success", id: gameSessionID });
    return;
  }
  res.send({ status: "failed" });
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
    !gameSessionsManager.getGameSessionID(sessionid) ||
    gameSessionsManager.getGameSessionID(sessionid) !== req.headers.gsid
  ) {
    res.status(401).send("Unauthorized");
    console.log("invalid gamesession");
    return;
  }

  const gameSession = gameSessionsManager.getGameSession(
    gameSessionsManager.getGameSessionID(sessionid),
  );

  if (!gameSession) {
    res.status(401).send("Unauthorized");
    console.log("game session not found");
    return;
  }

  if (levelNum !== gameSession.levelNum) {
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

  const sessionid = req.params.sessionid;

  if (
    !gameSessionsManager.getGameSessionID(sessionid) ||
    gameSessionsManager.getGameSessionID(sessionid) !== req.headers.gsid
  ) {
    res.status(401).send("Unauthorised");
    console.log("[alive] invalid game session");
    return;
  }

  const gameSessionID = gameSessionsManager.getGameSessionID(sessionid);
  const gameSession = gameSessionsManager.getGameSession(gameSessionID);

  if (!gameSession) {
    res.status(401).send("Unauthorised");
    return;
  }

  const data = req.body;

  if (!data) {
    res.status(401).send("Invalid request");
    return;
  }

  const result = gameSessionsManager.onReceiveKeepAliveAlive(
    gameSessionID,
    data,
  );

  if (result) res.send({ status: "success" });
  else res.status(401).send({ status: "failed" });
});

app.use(express.static("public"));
app.listen(process.env.PORT || 5173, process.env.ADDR || "127.0.0.1");
