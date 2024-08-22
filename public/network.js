class NetworkClient {
  constructor() {
    this.initClientState();
  }

  initClientState() {
    this.sessionID = null;
    this.gameSessionID = null;
    this.userID = null;
    this.username = null;
    this.userLevels = [];
    this.currLevel = null;
    this.loggedIn = false;
  }

  async login(username, password) {
    let sum = 0;
    for (let i = 0; i < username.length; i++) {
      const c = username.charCodeAt(i);
      sum |= 0b1 << (c + i) % 26;
      sum = (sum * 3) % 24882501;
    }

    const url = `/${sum}/${username}/login`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        psd: password,
      },
    });

    if (!response.ok) {
      return false;
    }

    const resbody = await response.json();

    if (!resbody.sid || !resbody.currlevel || !resbody.userid) {
      return false;
    }

    this.userID = resbody.userid;
    this.sessionID = resbody.sid;
    this.username = username;
    this.loggedIn = true;
    this.currLevel = resbody.currlevel;

    return true;
  }

  async requestGame(level) {
    if (!this.loggedIn || level > this.currLevel) {
      return false;
    }

    const res = await fetch(
      `/${this.userID}/${this.sessionID}/gamereq/${level}`,
      {
        method: "POST",
      },
    );

    if (!res.ok) return false;

    const body = await res.json();

    if (!body.id) return false;

    this.gameSessionID = body.id;

    return true;
  }

  async sendAlive(body) {
    if (!this.gameSessionID) return false;

    const res = await fetch(`/${this.sessionID}/${this.gameSessionID}/alive`, {
      method: "POST",
      headers: {
        gsid: this.gameSessionID,
      },
      body: JSON.stringify(body),
    });

    return res.ok;
  }

  async sendStart() {
    if (!this.gameSessionID) return false;

    const res = await this.sendAlive({ type: "start", timestamp: Date.now() });

    return res.ok;
  }

  async sendFinish() {
    if (!this.gameSessionID) return false;

    const res = await this.sendAlive({ type: "finish", timestamp: Date.now() });

    return res.ok;
  }

  async sendDeath() {
    if (!this.gameSessionID) return false;

    const res = await this.sendAlive({ type: "dead", timestamp: Date.now() });

    return res.ok;
  }

  async sendStats(xpos, ypos, angle, health) {
    if (!this.gameSessionID) return false;

    const res = await this.sendAlive({
      type: "alive",
      timestamp: Date.now(),
      xpos,
      ypos,
      angle,
      health,
    });

    return res.ok;
  }

  exitGame() {
    this.gameSessionID = null;
  }

  loadImage(url) {
    return new Promise(async (resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(image.src);
        resolve(image);
      };

      const res = await fetch(url, {
        headers: {
          sid: this.sessionID,
          gsid: this.gameSessionID,
        },
      });

      const blob = await res.blob();
      image.src = URL.createObjectURL(blob);
    });
  }

  loadText(url) {
    return new Promise(async (resolve, reject) => {
      const res = await fetch(url, {
        headers: {
          sid: this.sessionID,
          gsid: this.gameSessionID,
        },
      });

      const text = await res.text();

      resolve(text);
    });
  }

  loadJSON(url) {
    return new Promise(async (resolve, reject) => {
      const res = await fetch(url, {
        headers: {
          sid: this.sessionID,
          gsid: this.gameSessionID,
        },
      });

      const json = await res.json();

      resolve(json);
    });
  }

  loadAudio(url) {
    return new Promise(async (resolve, reject) => {
      const audio = new Audio();
      audio.pause();
      audio.onload = () => {
        URL.revokeObjectURL(audio.src);
        resolve(audio);
      };

      const res = await fetch(url, {
        headers: {
          sid: this.sessionID,
          gsid: this.gameSessionID,
        },
      });

      const blob = await res.blob();
      audio.src = URL.createObjectURL(blob);
    });
  }
}
