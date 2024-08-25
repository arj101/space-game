require("dotenv").config();

const express = require("express");
const fs = require("fs");
const uuid = require("uuid");
const admin = require("firebase-admin");
const https = require("https");
const { getFirestore } = require("firebase-admin/firestore");

const credentials = {};

if (process.env.PROD) {
  const key = fs.readFileSync(
    "/etc/letsencrypt/live/upright-parallelport.online-0001/privkey.pem",
    "utf8",
  );
  const certificate = fs.readFileSync(
    "/etc/letsencrypt/live/upright-parallelport.online-0001/cert.pem",
    "utf8",
  );
  const ca = fs.readFileSync(
    "/etc/letsencrypt/live/upright-parallelport.online-0001/chain.pem",
    "utf8",
  );
  credentials.key = key;
  credentials.cert = certificate;
  credentials.ca = ca;
}

//load the firebase service account file from env
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = getFirestore();

const leaderboards = {};
const users = new Map();
const database = {
  //variables used for batching leaderboard updates due to this server having little to no cpu power on render.com
  needsLeaderboardUpdate: false,
  needsGlobalLeaderboardUpdate: false,

  //used to avoid re-fetching all users when building level leaderboards
  leaderboardDiffs: new Map(),
  //same thing but for global leaderboard
  globalLeadrboardDiffs: new Map(),

  //a Map of lengths of rank lists for each level, updated when the level leaderboards are updated.
  //Used for assigning rank to players who havent played a specific level. Such players are given the last position in those rank lists
  //(although they are not really present in that rank list)
  //This is necessary because global leaderboard is built by summing up ranks of players in each level
  levelRanklistLengthCache: new Map(),
  //number of levels in the game, probably shouldnt hard code this but should work fine
  levelCount: 2,

  //locks the leaderboard when either the global or level leaderboard updates are running. avoids potential corrupt leaderboards
  //each function checks if the lock is set, if it is, waits some time to recheck the lock, and only executes the function when the lock has been released (false = released)
  leaderboardLock: false,

  //a map of user ids and usernames, used to build up leaderboard, this is updated when a user logs in with username (not registers)
  //useful to avoid requesting user id from the database, rather look up from this, and only fetch from database when this fails
  idUsernameCache: new Map(),
  //reverse of the above
  usernameIdCache: new Map(),

  //the leaderboard sent to users, made by replacing the user ids with usernames
  leaderboardViews: {
    //global leaderboard view: list of user names
    global: [],
    //per level leaderboard views:
    //list of user names and time to finish
    //WHY THIS STRUCTURE? because it is easier for my brain to understand as it matches the structure on the database
    1: [],
    2: [],
  },
};

database.getUsernameFromUserID = async function (userid) {
  if (database.idUsernameCache.has(userid))
    return database.idUsernameCache.get(userid);

  const snapshot = await db.collection("users").doc(userid).get();
  const username = snapshot.data()?.username;

  if (username) {
    database.idUsernameCache.set(userid, username);
    database.usernameIdCache.set(username, userid);
  }

  return username;
};

database.getUserIDfromName = async function (username) {
  if (database.usernameIdCache.has(username)) {
    return database.usernameIdCache.get(username);
  }

  const queryResult = await db
    .collection("users")
    .where("username", "==", username)
    .get();

  if (queryResult.size < 1) return null;

  const id = queryResult.docs[0].data().userId;

  if (id) {
    database.idUsernameCache.set(id, username);
    database.usernameIdCache.set(username, id);
  }

  return queryResult.docs[0].data().userId;
};

database.getUser = async function (userid) {
  if (!userid) return null;

  const queryResult = await db.collection("users").doc(userid).get();

  if (!queryResult) return null;

  return queryResult.data();
};

database.updateUserProgress = async function (userid, levelnum, score_time) {
  let user = await db.collection("users").doc(userid).get();
  user = user.data();
  if (!user) return null;

  user.progress = user.progress || {};

  const updateDb = () => {
    database.needsLeaderboardUpdate = true;
    if (!database.leaderboardDiffs.has(levelnum)) {
      database.leaderboardDiffs.set(levelnum, new Map());
    }
    database.leaderboardDiffs.get(levelnum).set(userid, score_time);
  };

  if (user.progress[levelnum]) {
    if (user.progress[levelnum] > score_time) {
      user.progress[levelnum] = score_time;
      updateDb();
    }
  } else {
    user.progress[levelnum] = score_time;
    updateDb();
  }

  if (!user.currLevel) {
    user.currLevel = 1; //initial curr level
  }

  if (user.currLevel == levelnum) {
    user.currLevel += 1;
  }

  console.log(`Updating user ${JSON.stringify(user)}`);

  await db.collection("users").doc(userid).set(user);
};

database.updateDeathCount = async function (userid, levelnum, score) {
  let user = await db.collection("users").doc(userid).get();
  user = user.data();
  if (!user) return null;

  user.deathcount = user.deathcount || 0;
  user.deathcount += 1;

  console.log(`Updating user ${JSON.stringify(user)}`);

  await db.collection("users").doc(userid).set(user);
};

//used to fetch all the leaderboards at startup, otherwise leaderboards must be updated along with diffs
database.buildLevelLeaderboardView = async function (level) {
  const leaderboardRef = await db
    .collection("leaderboard")
    .doc(level.toString())
    .get();

  const leaderboardData = leaderboardRef.data();

  leaderboardData.order = leaderboardData.order || [];
  leaderboardData.users = leaderboardData.users || {};

  let leaderboardView = [];

  for (const userid of leaderboardData.order) {
    const user = leaderboardData.users[userid];
    leaderboardView.push({
      username: await database.getUsernameFromUserID(userid),
      score: user.score || "[no score]", //i dont want to accidentally send undefined lol
    });
  }

  database.leaderboardViews[level.toString()] = leaderboardView;

  console.log(`Built leaderboard view for level ${level}:`, leaderboardView);
};

//used to fetch all the leaderboards at startup, otherwise leaderboards must be updated along with diffs
database.buildGlobalLeaderboardView = async function () {
  const leaderboardRef = await db.collection("leaderboard").doc("global").get();

  const leaderboardData = leaderboardRef.data();

  leaderboardData.order = leaderboardData.order || [];
  leaderboardData.users = leaderboardData.users || {};

  let leaderboardView = [];

  for (const userid of leaderboardData.order) {
    leaderboardView.push(await database.getUsernameFromUserID(userid));
  }

  database.leaderboardViews.global = leaderboardView;

  console.log(`Built global leaderboard view:`, leaderboardView);
};

//build all leaderboard views initially at startup
setTimeout(async function () {
  for (let i = 0; i < database.levelCount; i++) {
    await database.buildLevelLeaderboardView((i + 1).toString());
  }
  await database.buildGlobalLeaderboardView();
});

//only update leaderboard every 5 seconds to avoid spamming the database
async function updateLeaderboard() {
  if (!database.needsLeaderboardUpdate) {
    setTimeout(updateLeaderboard, 4000);
    return;
  }

  console.log("Leaderboard needs update");

  //global leaderboard must be updated atleast once after updating local leaderboard
  //(needsGlobslLeaderboardUpdate is set only after running updateLeaderboard)
  //because otherwise two or more diffs might be present for one person (on one level)
  if (database.needsGlobalLeaderboardUpdate) {
    setTimeout(updateLeaderboard, 1000);
    return;
  }

  if (database.leaderboardLock) {
    setTimeout(updateLeaderboard, 1000); //wait one second to recheck the lock
    return;
  }

  database.leaderboardLock = true;

  console.log("Updating level leaderboards...");

  try {
    database.needsLeaderboardUpdate = false;

    for (const [levelnum, diffs] of database.leaderboardDiffs) {
      const leaderboardRef = db
        .collection("leaderboard")
        .doc(levelnum.toString());
      const leaderboardObj = await leaderboardRef.get();
      const leaderboardData = leaderboardObj.data() || { order: [], users: {} };

      let newOrder = [];
      const leaderboardUsers = leaderboardData.users || {};

      for (const [id, score] of diffs) {
        leaderboardUsers[id] = { score, rank: null };
      }

      newOrder = Object.keys(leaderboardUsers);
      newOrder.sort(
        (id1, id2) => leaderboardUsers[id1].score - leaderboardUsers[id2].score,
      );

      for (let i = 0; i < newOrder.length; i++) {
        const id = newOrder[i];
        leaderboardUsers[id].rank = i + 1;
      }

      for (const id in leaderboardUsers) {
        const newUserRank = leaderboardUsers[id].rank;
        database.globalLeadrboardDiffs.set([levelnum, id], newUserRank);
      }

      await leaderboardRef.set({
        order: newOrder,
        users: leaderboardUsers,
      });

      console.log(`Leaderboard updated for level ${levelnum}: ${newOrder}`);
      database.levelRanklistLengthCache.set(levelnum, newOrder.length);

      let leaderboardView = [];

      for (const userid of newOrder) {
        const user = leaderboardUsers[userid];
        leaderboardView.push({
          username: await database.getUsernameFromUserID(userid),
          score: user.score || "[no score]", //i dont want to accidentally send undefined lol
        });
      }

      database.leaderboardViews[levelnum.toString()] = leaderboardView;

      console.log(
        `Built leaderboard view for level ${levelnum}:`,
        leaderboardView,
      );
    }

    database.needsGlobalLeaderboardUpdate = true;
    database.leaderboardDiffs.clear();
    setTimeout(updateLeaderboard, 4000);
  } catch (e) {
    console.log(e);
    console.log(`LEADERBOARD UPDATE FAILED:`);
    console.log(`STOPPING ALL (level) LEADERBOARD UPDATES`);
  } finally {
    //no matter what happens, dont forget to release the lock
    database.leaderboardLock = false;
  }
}
setTimeout(updateLeaderboard, 2000);

async function updateGlobalLeaderboard() {
  if (!database.needsGlobalLeaderboardUpdate) {
    setTimeout(updateGlobalLeaderboard, 5500);
    return;
  }

  if (database.leaderboardLock) {
    setTimeout(updateGlobalLeaderboard, 1000); //wait one second to recheck the lock
    return;
  }
  database.leaderboardLock = true;

  console.log("Updating global leaderboard...");
  try {
    database.needsGlobalLeaderboardUpdate = false;

    //make sure we have all the rank list lengths before building leaderboard
    //if not we fetch them here
    for (let i = 0; i < database.levelCount; i++) {
      const levelnum = i + 1;
      if (!database.levelRanklistLengthCache.has(levelnum)) {
        console.log(
          `Fetching rank list length for level ${levelnum} from database (no cache present)`,
        );
        const levelLeaderboardObj = await db
          .collection("leaderboard")
          .doc(levelnum.toString())
          .get();
        const levelLeaderboardData = levelLeaderboardObj.data();
        if (!levelLeaderboardData) continue;
        const rankListLength = levelLeaderboardData.order?.length;
        if (!rankListLength) {
          console.log(`Rank list length for level ${levelnum} not found :/`);
          continue;
        }
        database.levelRanklistLengthCache.set(levelnum, rankListLength);
      }
    }

    const globalLeaderboardRef = db.collection("leaderboard").doc("global");
    const globalLeaderboard = (await globalLeaderboardRef.get()).data() || {
      order: {},
      users: {},
    };

    let newOrder = [];
    const leaderboardUsers = globalLeaderboard.users || {};

    for (const [[level, userid], score] of database.globalLeadrboardDiffs) {
      const globalUserObject = leaderboardUsers[userid] || {
        levels: {},
      };
      if (!globalUserObject.levels) {
        globalUserObject.levels = {};
      }
      globalUserObject.levels[level] = score;
      leaderboardUsers[userid] = globalUserObject;
    }

    const userRankSums = {};

    for (const userid in leaderboardUsers) {
      const user = leaderboardUsers[userid];
      let rankSum = 0;
      //sum up all the level ranks or default to rank list length
      for (let i = 0; i < database.levelCount; i++) {
        const levelnum = i + 1;
        if (user.levels) {
          rankSum +=
            user.levels[levelnum] ||
            database.levelRanklistLengthCache.get(levelnum) + 1;
        } else {
          rankSum += database.levelRanklistLengthCache.get(levelnum) + 1;
        }
      }
      userRankSums[userid] = rankSum;
    }

    newOrder = Object.keys(userRankSums);
    console.log(userRankSums);
    newOrder.sort((id1, id2) => userRankSums[id1] - userRankSums[id2]);

    for (let i = 0; i < newOrder.length; i++) {
      const userid = newOrder[i];
      const user = leaderboardUsers[userid] || {};
      user.rank = i + 1;
    }

    database.globalLeadrboardDiffs.clear();

    globalLeaderboardRef.set({
      order: newOrder,
      users: leaderboardUsers,
    });

    console.log(`Updated global leaderboard: ${newOrder}`);

    let leaderboardView = [];

    for (const userid of newOrder) {
      leaderboardView.push(await database.getUsernameFromUserID(userid));
    }

    database.leaderboardViews.global = leaderboardView;

    console.log(`Built global leaderboard view:`, leaderboardView);

    setTimeout(updateGlobalLeaderboard, 5500);
  } catch (e) {
    console.log(e);
    console.log(`GLOBAL LEADERBOARD UPDATE FAILED`);
    console.log(`STOPPING ALL (global) LEADERBOARD UPDATES`);
  } finally {
    database.leaderboardLock = false;
  }
}

setTimeout(updateGlobalLeaderboard, 3000);

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
    this.lastEventType = null;
    this.duration = null;

    this.eventlog = [];
  }

  ping() {
    this.pingtimestamp = Date.now();
  }

  isActive() {
    return Date.now() - this.pingtimestamp < GAME_SESSION_TIMEOUT;
  }

  validateFinalEventLog() {
    if (this.eventlog.length < 4) return false;
    if (this.eventlog[0].type !== "start") return false;
    if (this.eventlog[1].type !== "alive") return false;
    if (this.eventlog[this.eventlog.length - 2].type !== "alive") return false;
    if (this.eventlog[this.eventlog.length - 1].type !== "finish") return false;
    if (
      this.eventlog[this.eventlog.length - 2].timestamp -
        this.eventlog[1].timestamp <=
      MIN_GAME_COMPLETION_TIME
    )
      return false;
    if (
      Math.abs(this.eventlog[1].posx) >= 0.1 ||
      Math.abs(this.eventlog[1].posy) >= 0.1
    )
      //game always starts at (0, 0)
      return false;

    for (const event of this.eventlog) {
      if (event.type == "alive") {
        if (event.health <= 0) return false;
      }
    }

    //Thats it for now >:)

    return true;
  }

  finalData() {
    if (this.running) return null;
  }

  onFinish() {
    const isValidFinish = this.validateFinalEventLog();
    if (!isValidFinish) return null;
  }

  onDeath() {
    //death counter++
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
            this.duration = min_duration;
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
      this.lastEventType = rawEvent.type;
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

//user data is stored in database and operations on the user data are performed only by function calls (not directly editing)
//session manager handles active sessions but does not hold user specific data

class GameSessionsManager {
  async createBrowserSession(username, password) {
    const id = await database.getUserIDfromName(username);
    if (!id) return null;

    if (this.userIDBrowserSessionMap[id]) {
      //delete old session if present
      console.log(
        `Found previous session for user '${username}' deleting for new session`,
      );
      this.browserSessions.delete(this.userIDBrowserSessionMap[id]);
      this.browserSessions.delete(id);
    }

    const user = await database.getUser(id);
    if (!user) return null;

    if (password == user.password) {
      const sessionId = uuid.v4();
      this.browserSessions.set(sessionId, id);
      this.userIDBrowserSessionMap.set(id, sessionId);

      console.log(`Created session for user '${username}'`);

      return {
        sessionId,
        userId: id,
        user,
      };
    }

    console.log(
      `Password for user '${username}', (ID: ${id}) did not match. Failing request...`,
    );

    return null;
  }

  checkUserSession(userid, sessionid) {
    if (!this.browserSessions.get(sessionid)) return false;
    if (this.userIDBrowserSessionMap.get(userid) != sessionid) return false;
    return true;
  }

  checkSessionPresence(sessionid) {
    if (this.browserSessions.get(sessionid)) return true;
    return false;
  }

  constructor() {
    //Map<sessionID, userID>
    this.browserSessions = new Map(); //this browser session does not really have a purpose except to add complexity to auth process
    //Map<userID, sessionID>
    this.userIDBrowserSessionMap = new Map();

    this.sessionGameSessionMap = new Map();
    this.gameSessions = new Map();

    this.finishedSessionPool = new Map();

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

        //rest should be a separate
      }

      for (const [sessionID, gsid] of this.finishedSessionPool) {
        const gameSession = this.gameSessions.get(gsid);
        console.log(`Deleting session because it has finished running`);
        const validSession = gameSession.validateFinalEventLog();
        if (!validSession) {
          console.log(`Invalidated game session because of invalid event log`);
        }

        console.log(`Last event: ${gameSession.lastEventType}`);

        if (gameSession.lastEventType == "finish" && validSession) {
          try {
            console.log(`Game duration ${gameSession.duration}`);
            const userid = gameSession.userID;
            database.updateUserProgress(
              userid,
              gameSession.levelNum,
              gameSession.duration,
            );
          } catch (_) {}
        }

        if (gameSession.lastEventType == "dead") {
          try {
            const userid = gameSession.userID;
            database.updateDeathCount(userid, gameSession.levelNum);
          } catch (e) {}
        }

        gameSession.onClose();
        this.gameSessions.delete(gsid);
      }
      this.finishedSessionPool.clear();
    }, 30000);
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

    const ret = gameSession.onReceiveKeepAlive(rawEventJSON);

    if (!gameSession.running) {
      this.finishedSessionPool.set(gameSession.userSessionID, gameSessionID);
      this.sessionGameSessionMap.delete(gameSession.userSessionID);
    }

    return ret;
  }
}

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//automatically starts polling every 5 seconds
const gameSessionsManager = new GameSessionsManager();

//security by obscurity
app.post("/:id/:username/login", async (req, res) => {
  const username = req.params.username;

  let sum = 0;
  for (let i = 0; i < username.length; i++) {
    const c = username.charCodeAt(i);
    sum |= 0b1 << (c + i) % 26;
    sum = (sum * 3) % 24882501;
  }

  const id = sum.toString();
  // if (id !== req.params.id) {
  //   res.status(401).send("Unauthorised");
  //   return;
  // }

  const psd = req.headers.psd;

  const result = await gameSessionsManager.createBrowserSession(username, psd);

  if (!result) {
    res.status(401).send("Unauthorised");
    return;
  }

  res.send(result);
});

app.post("/:userid/:sessionid/gamereq/:level", async (req, res) => {
  const userid = req.params.userid;
  const sessionid = req.params.sessionid;
  const level = req.params.level;

  if (isNaN(parseInt(level))) {
    res.status(401).send("Unauthorised");
    return;
  }

  const levelnum = parseInt(level);

  if (!gameSessionsManager.checkUserSession(userid, sessionid)) {
    console.log(`User ID ${userid} and ${sessionid} not found`);
    res.status(401).send("Unauthorised");
    return;
  }

  const user = await database.getUser(userid);

  if (!user) {
    res.status(401).send("Unauthorised");
    return;
  }

  console.log("Requesting level ", levelnum, user.currLevel);
  if (levelnum > user.currlevel) {
    res.status(401).send("You havent reached there yet :(");
    return;
  }

  if (levelnum > database.levelCount) {
    res.status(401).send("Invalid level");
    return;
  }

  const gameSessionID = uuid.v4();

  const createdSession = gameSessionsManager.createGameSession(
    userid,
    sessionid,
    gameSessionID,
    levelnum,
  );

  if (!createdSession) {
    res.send({ status: "failed" });
    return;
  }

  res.send({ status: "success", id: gameSessionID });
});

app.get("/levels/:level/*", (req, res, next) => {
  const level = req.params.level;
  const levelNum = parseInt(level);
  if (isNaN(levelNum)) {
    res.status(401).send("Invalid request");
  }

  console.log("Trying to read from level ", levelNum);

  const sessionid = req.headers.sid;

  if (!gameSessionsManager.checkSessionPresence(sessionid)) {
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
  if (!gameSessionsManager.checkSessionPresence(req.params.sessionid)) {
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

app.get("/leaderboard/level/:level", (req, res) => {
  const level = req.params.level;
  const levelNum = parseInt(level);

  if (isNaN(levelNum)) {
    res.status(404).send(
      `<h1>Imagine not sending a number lol... fyi its /leaderboard/level/<levelnumber>,
        do better next time lmao</h1>`,
    );
    return;
  }

  if (levelNum <= 0 || levelNum > database.levelCount) {
    res
      .status(404)
      .send(
        `<h1>How stupid are you to not realise that levels are from 1 to <lastLevelNum>???!!</h1>`,
      );
    return;
  }

  res.send({ leaderboard: database.leaderboardViews[levelNum.toString()] });
});

app.get("/leaderboard/global/", (req, res) => {
  res.send({ leaderboard: database.leaderboardViews.global });
});

app.use(express.static("public"));

if (process.env.PROD) {
  const httpServer = https.createServer(credentials, app);
  httpServer.listen(443, () => {
    console.log("HTTP server listening on port 443");
  });
} else {
  app.listen(process.env.PORT || 5173, process.env.ADDR || "127.0.0.1");
}
