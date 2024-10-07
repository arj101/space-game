class AudioEngine {
  constructor() {
    this.ctx = new AudioContext();
    this.hasInit = false;
    this.compressor = new DynamicsCompressorNode(this.ctx, {
      ratio: 20,
      attack: 1,
      release: 1,
    });

    this.globalGain = this.ctx.createGain();

    this.globalGain.gain.exponentialRampToValueAtTime(
      1,
      this.ctx.currentTime + 0.1
    );
    this.bgmEnabled = false;
    this.compressor.connect(this.globalGain).connect(this.ctx.destination);
  }

  resume() {
    this.ctx.resume();
  }

  createAudioElement(src) {
    const audioElement = document.createElement("audio");
    audioElement.src = src;
    return audioElement;
  }

  disableBgm() {
    this.bgmEnabled = false;
  }

  async playLoop(audioSrc, vol = 1.0) {
    this.resume();

    const getDuration = (audioElement) => {
      return new Promise((resolve) => {
        if (audioElement.duration) {
          resolve(audioElement.duration);
          return;
        }
        audioElement.addEventListener("loadedmetadata", () => {
          resolve(audioElement.duration);
        });
      });
    };

    const audioElement = this.createAudioElement(audioSrc);

    const duration = await getDuration(audioElement);

    const scheduleNext = () =>
      setTimeout(() => {
        const audioElement = this.createAudioElement(audioSrc);
        const track = this.ctx.createMediaElementSource(audioElement);
        const gain = this.ctx.createGain();
        track.connect(gain).connect(this.compressor);
        audioElement.currentTime = 0;

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(vol, this.ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime + duration - 0.3);
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          this.ctx.currentTime + duration
        );

        audioElement.play();

        setTimeout(scheduleNext, duration * 1000 - 700);
      }, duration * 1000 - 200);

    scheduleNext();
  }

  initBgm() {
    this.bgmEnabled = true;

    const bgmElts = [this.createAudioElement("./assets/audio/ambient1.wav")];

    const bgmGain = this.ctx.createGain();
    bgmGain.gain.setValueAtTime(0, this.ctx.currentTime);
    bgmGain.gain.linearRampToValueAtTime(1.0, this.ctx.currentTime + 10);
    bgmGain.connect(this.compressor);

    const getDuration = (audioElement) => {
      return new Promise((resolve) => {
        if (audioElement.duration) {
          resolve(audioElement.duration);
          return;
        }
        audioElement.addEventListener("loadedmetadata", () => {
          resolve(audioElement.duration);
        });
      });
    };

    let prevIndex = -1;

    const playBgm = async () => {
      for (const bgmElement of bgmElts) {
        bgmElement.currentTime = 0;
        bgmElement.volume = 0.0;
      }

      let bgmIndex = Math.floor(Math.random() * bgmElts.length);
      if (bgmIndex == prevIndex) {
        bgmIndex = (bgmIndex + 1) % bgmElts.length;
      }
      prevIndex = bgmIndex;

      bgmGain.gain.setValueAtTime(0, this.ctx.currentTime);
      bgmGain.gain.linearRampToValueAtTime(1.0, this.ctx.currentTime + 8);
      const duration = await getDuration(bgmElts[bgmIndex]);
      bgmGain.gain.setValueAtTime(
        1.0,
        Math.max(this.ctx.currentTime + duration - 8, this.ctx.currentTime)
      );
      bgmGain.gain.linearRampToValueAtTime(
        0.0,
        this.ctx.currentTime + duration
      );
      bgmElts[bgmIndex].volume = 1.0;
      bgmElts[bgmIndex].play();

      bgmElts[bgmIndex].addEventListener("ended", () => {
        if (this.bgmEnabled) playBgm();
      });
    };

    for (const bgmElement of bgmElts) {
      const bgmTrack = this.ctx.createMediaElementSource(bgmElement);
      bgmTrack.connect(bgmGain);
    }

    playBgm();
  }

  async init() {
    this.ctx.resume();

    if (this.hasInit) return;
    this.hasInit = true;

    // const bounceAudio = await fetch("./bounce.mp3");
    // const bounceAudioBuffer = await bounceAudio.arrayBuffer();
    // this.bounceAudioBuffer = await this.ctx.decodeAudioData(bounceAudioBuffer);

    //background music---------
  }

  // playAudio(vol = 1.0, pos = { x: null, y: null }) {
  //   if (vol <= 0.0) return; //no need to play then lol

  //   const source = this.ctx.createBufferSource();
  //   source.buffer = this.bounceAudioBuffer;
  //   const gain = this.ctx.createGain();

  //   const panner = new PannerNode(this.ctx, {
  //     panningModel: "HRTF",
  //     distanceModel: "linear",
  //     positionX: pos.x ?? window.innerWidth / 2,
  //     positionY: pos.y ?? window.innerHeight / 2,
  //     positionZ: 0,
  //     orientationX: 0,
  //     orientationY: 0,
  //     orientationZ: -1,
  //     refDistance: 1,
  //     maxDistance: 10000,
  //     rolloffFactor: 10,
  //     coneInnerAngle: 60,
  //     coneOuterAngle: 90,
  //     coneOuterGain: 0.4,
  //   });

  //   // vol *= 10.0;
  //   // console.log(vol);
  //   gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
  //   gain.gain.exponentialRampToValueAtTime(vol, this.ctx.currentTime + 0.05);
  //   source.connect(panner).connect(gain).connect(this.compressor);
  //   source.start();
  // }
}
