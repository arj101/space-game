const express = require("express");
const fs = require("fs");

const app = express();

const SESSION_TIMEOUT = 10000; //timeout session after 10 seconds of no pings

class Session {
  constructor(playername) {
    this.id = Math.random();
    this.player = playername;
    this.lastActive = Date.now();
    this.valid = true;
  }

  sessionId() {
    return this.id;
  }

  validateSession() {
    if (Date.now() - this.lastActive > SESSION_TIMEOUT) {
      this.valid = false;
    }
    return this.valid;
  }

  sessionValid() {
    return this.valid;
  }

  ping() {
    this.lastActive = Date.now();
  }
}

function withSession(sessionID, fn) {
  if (!sessions[sessionID]) {
    return false;
  }
  return true;
}

class Player {
  constructor(id, password) {
    this.id = id;
    this.password = password;
    //level based score, and other stats
    this.levels = [];
    this.currentLevel = 1;
  }
}

//Map<SessionID, Session>
const sessions = new Map();

//Map<PlayerID, Player>
const players = new Map();

players["foo"] = new Player("foo", "bar");

// app.get("/login/", (req, res, next) => {
//   const id = req.query.username;
//   const passwd = req.headers.pwd;

//   if (!players[id]) {
//     res.status(401).send("Invalid user");
//     return;
//   }

//   const player = players[id];

//   if (player.password !== passwd) {
//     res.status(401).send("Authorization failed");
//     return;
//   }

//   const session = new Session(id);
//   sessions[session.sessionId()] = session;

//   res.send({ status: "success", id: session.sessionId() });
// });

// app.get("/ping/", (req, res, next) => {
//   const id = req.headers.id;
//   const session = sessions[id];
//   if (session) {
//     session.ping(req.ip);
//     res.send({ status: "success" });
//   }
// });

// app.get("/assets/:asset", (req, res, next) => {
//   console.log(req.params["asset"]);
//   const sid = req.headers.id;

//   const session = sessions[sid];
//   if (!session) {
//     res.status(401).send("Invalid session");
//     return;
//   }

//   // if (!session.validateSession()) {
//   //   res.status(401).send("Session expired");
//   //   return;
//   // }

//   return next();
// });

app.use(express.static("public"));
const userData = {};

app.listen(5173, "127.0.0.1");
