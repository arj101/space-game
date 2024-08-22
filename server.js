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

        if (validEvent && !criticalError) {
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

          if (
            //TODO: better safe guard here
            xpos == undefined ||
            ypos == undefined ||
            angle == undefined ||
            health == undefined
          ) {
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

    if (validEvent && !criticalError) {
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

    console.log(
      `Processed event message. Valid: ${validEvent}, Error: ${criticalError}`,
    );

    return !criticalError;
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

    if (!rawEventJSON) return false;
    if (!rawEventJSON.type) return false;
    if (!gameSession) return false;

    return gameSession.onReceiveKeepAlive(rawEventJSON);
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

function md5(inputString) {
  //  Original copyright (c) Paul Johnston & Greg Holt.
  var hc = "0123456789abcdef";
  function rh(n) {
    var j,
      s = "";
    for (j = 0; j <= 3; j++)
      s +=
        hc.charAt((n >> (j * 8 + 4)) & 0x0f) + hc.charAt((n >> (j * 8)) & 0x0f);
    return s;
  }
  function ad(x, y) {
    var l = (x & 0xffff) + (y & 0xffff);
    var m = (x >> 16) + (y >> 16) + (l >> 16);
    return (m << 16) | (l & 0xffff);
  }
  function rl(n, c) {
    return (n << c) | (n >>> (32 - c));
  }
  function cm(q, a, b, x, s, t) {
    return ad(rl(ad(ad(a, q), ad(x, t)), s), b);
  }
  function ff(a, b, c, d, x, s, t) {
    return cm((b & c) | (~b & d), a, b, x, s, t);
  }
  function gg(a, b, c, d, x, s, t) {
    return cm((b & d) | (c & ~d), a, b, x, s, t);
  }
  function hh(a, b, c, d, x, s, t) {
    return cm(b ^ c ^ d, a, b, x, s, t);
  }
  function ii(a, b, c, d, x, s, t) {
    return cm(c ^ (b | ~d), a, b, x, s, t);
  }
  function sb(x) {
    var i;
    var nblk = ((x.length + 8) >> 6) + 1;
    var blks = new Array(nblk * 16);
    for (i = 0; i < nblk * 16; i++) blks[i] = 0;
    for (i = 0; i < x.length; i++)
      blks[i >> 2] |= x.charCodeAt(i) << ((i % 4) * 8);
    blks[i >> 2] |= 0x80 << ((i % 4) * 8);
    blks[nblk * 16 - 2] = x.length * 8;
    return blks;
  }
  var i,
    x = sb("" + inputString),
    a = 1732584193,
    b = -271733879,
    c = -1732584194,
    d = 271733878,
    olda,
    oldb,
    oldc,
    oldd;
  for (i = 0; i < x.length; i += 16) {
    olda = a;
    oldb = b;
    oldc = c;
    oldd = d;
    a = ff(a, b, c, d, x[i + 0], 7, -680876936);
    d = ff(d, a, b, c, x[i + 1], 12, -389564586);
    c = ff(c, d, a, b, x[i + 2], 17, 606105819);
    b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
    a = ff(a, b, c, d, x[i + 4], 7, -176418897);
    d = ff(d, a, b, c, x[i + 5], 12, 1200080426);
    c = ff(c, d, a, b, x[i + 6], 17, -1473231341);
    b = ff(b, c, d, a, x[i + 7], 22, -45705983);
    a = ff(a, b, c, d, x[i + 8], 7, 1770035416);
    d = ff(d, a, b, c, x[i + 9], 12, -1958414417);
    c = ff(c, d, a, b, x[i + 10], 17, -42063);
    b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
    a = ff(a, b, c, d, x[i + 12], 7, 1804603682);
    d = ff(d, a, b, c, x[i + 13], 12, -40341101);
    c = ff(c, d, a, b, x[i + 14], 17, -1502002290);
    b = ff(b, c, d, a, x[i + 15], 22, 1236535329);
    a = gg(a, b, c, d, x[i + 1], 5, -165796510);
    d = gg(d, a, b, c, x[i + 6], 9, -1069501632);
    c = gg(c, d, a, b, x[i + 11], 14, 643717713);
    b = gg(b, c, d, a, x[i + 0], 20, -373897302);
    a = gg(a, b, c, d, x[i + 5], 5, -701558691);
    d = gg(d, a, b, c, x[i + 10], 9, 38016083);
    c = gg(c, d, a, b, x[i + 15], 14, -660478335);
    b = gg(b, c, d, a, x[i + 4], 20, -405537848);
    a = gg(a, b, c, d, x[i + 9], 5, 568446438);
    d = gg(d, a, b, c, x[i + 14], 9, -1019803690);
    c = gg(c, d, a, b, x[i + 3], 14, -187363961);
    b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
    a = gg(a, b, c, d, x[i + 13], 5, -1444681467);
    d = gg(d, a, b, c, x[i + 2], 9, -51403784);
    c = gg(c, d, a, b, x[i + 7], 14, 1735328473);
    b = gg(b, c, d, a, x[i + 12], 20, -1926607734);
    a = hh(a, b, c, d, x[i + 5], 4, -378558);
    d = hh(d, a, b, c, x[i + 8], 11, -2022574463);
    c = hh(c, d, a, b, x[i + 11], 16, 1839030562);
    b = hh(b, c, d, a, x[i + 14], 23, -35309556);
    a = hh(a, b, c, d, x[i + 1], 4, -1530992060);
    d = hh(d, a, b, c, x[i + 4], 11, 1272893353);
    c = hh(c, d, a, b, x[i + 7], 16, -155497632);
    b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
    a = hh(a, b, c, d, x[i + 13], 4, 681279174);
    d = hh(d, a, b, c, x[i + 0], 11, -358537222);
    c = hh(c, d, a, b, x[i + 3], 16, -722521979);
    b = hh(b, c, d, a, x[i + 6], 23, 76029189);
    a = hh(a, b, c, d, x[i + 9], 4, -640364487);
    d = hh(d, a, b, c, x[i + 12], 11, -421815835);
    c = hh(c, d, a, b, x[i + 15], 16, 530742520);
    b = hh(b, c, d, a, x[i + 2], 23, -995338651);
    a = ii(a, b, c, d, x[i + 0], 6, -198630844);
    d = ii(d, a, b, c, x[i + 7], 10, 1126891415);
    c = ii(c, d, a, b, x[i + 14], 15, -1416354905);
    b = ii(b, c, d, a, x[i + 5], 21, -57434055);
    a = ii(a, b, c, d, x[i + 12], 6, 1700485571);
    d = ii(d, a, b, c, x[i + 3], 10, -1894986606);
    c = ii(c, d, a, b, x[i + 10], 15, -1051523);
    b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
    a = ii(a, b, c, d, x[i + 8], 6, 1873313359);
    d = ii(d, a, b, c, x[i + 15], 10, -30611744);
    c = ii(c, d, a, b, x[i + 6], 15, -1560198380);
    b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
    a = ii(a, b, c, d, x[i + 4], 6, -145523070);
    d = ii(d, a, b, c, x[i + 11], 10, -1120210379);
    c = ii(c, d, a, b, x[i + 2], 15, 718787259);
    b = ii(b, c, d, a, x[i + 9], 21, -343485551);
    a = ad(a, olda);
    b = ad(b, oldb);
    c = ad(c, oldc);
    d = ad(d, oldd);
  }
  return rh(a) + rh(b) + rh(c) + rh(d);
}

app.post("/:sessionid/:gamesessionid/a/:hash", async (req, res) => {
  if (!sessions[req.params.sessionid]) {
    res.status(401).send("Unauthorized");
    return;
  }

  const sessionid = req.params.sessionid;

  if (
    !gameSessionsManager.getGameSessionID(sessionid) ||
    gameSessionsManager.getGameSessionID(sessionid) != req.headers.gsid
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

  if (!data || !data.timestamp || !data.instance) {
    res.status(401).send("Invalid request");
    return;
  }

  const hash = md5(
    req.params.gamesessionid +
      data.instance +
      data.timestamp.toString() +
      req.params.sessionid +
      "kwfnp",
  );

  if (hash != req.params.hash) {
    res.status(401).send("Invalid request");
    return;
  }

  console.log(data);

  const result = gameSessionsManager.onReceiveKeepAliveAlive(
    gameSessionID,
    data,
  );

  if (result) res.send({ status: "success" });
  else res.status(401).send({ status: "failed" });
});

app.use(express.static("public"));
app.listen(process.env.PORT || 5173, process.env.ADDR || "127.0.0.1");
