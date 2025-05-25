
let model, webcam, maxPredictions;
let latestFaceLandmarks = null;
let isSpeakingEnabled = true;
let lastSpokenText = "";
let lastUpdateTime = 0;
const updateInterval = 4000;
let currentAudio = null;

const emotionLog = { happy: 0, angry: 0, tired: 0, neutral: 0 };

const audioMap = {
  happy: [
    new Audio("happy_1.mp3"),
    new Audio("happy_2.mp3"),
    new Audio("happy_3.mp3")
  ],
  angry: [
    new Audio("angry_1.mp3"),
    new Audio("angry_2.mp3"),
    new Audio("angry_3.mp3")
  ],
  tired: [
    new Audio("tired_1.mp3"),
    new Audio("tired_2.mp3"),
    new Audio("tired_3.mp3")
  ],
  neutral: [
    new Audio("neutral_1.mp3"),
    new Audio("neutral_2.mp3"),
    new Audio("neutral_3.mp3")
  ]
};

const suggestionPool = {
  happy: [
    "她心情不錯！你可以說：『看到你我也整天都快樂！』",
    "氣氛超棒，可以說：『笑得像仙女一樣欸～』",
    "開心的時候最可愛，你可以說：『我是不是該錄起來，每天看一次』"
  ],
  angry: [
    "小心，她可能有點不開心。你可以說：『我剛才是不是太急了？對不起嘛～抱一下？』",
    "她似乎有點氣氣的。試試：『要不要我請你喝奶茶？不氣不氣～』",
    "火氣上來了？來點柔軟的：『你是我最重要的人，我想跟你好好講講』"
  ],
  tired: [
    "她好像很累。你可以說：『辛苦啦～今天不要再想工作了！』",
    "她有點疲倦。輕輕一句：『來，我幫你按摩三分鐘～』",
    "看起來需要放鬆一下：『我們來看部溫馨的劇好不好？』"
  ],
  neutral: [
    "她現在沒特別情緒。你可以說：『這週末你有想去哪裡嗎？』",
    "中性狀態～你可以說：『如果只能選一種飲料，你會喝？』",
    "平靜模式～用趣味破冰：『昨天夢到我們去環島欸！你夢到什麼？』"
  ]
};

async function loadTeachableModel() {
  model = await tmImage.load(
    "https://teachablemachine.withgoogle.com/models/MbSMHGKtH/model.json",
    "https://teachablemachine.withgoogle.com/models/MbSMHGKtH/metadata.json"
  );
  maxPredictions = model.getTotalClasses();
  webcam = new tmImage.Webcam(200, 200, true);
  await webcam.setup();
      await webcam.play();
    document.getElementById("webcam-container").appendChild(webcam.canvas);
  // 只插入一次 webcam 畫面，避免重複
}

function startFaceMesh() {
  const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  faceMesh.onResults((results) => {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      latestFaceLandmarks = results.multiFaceLandmarks[0];
    }
  });
  const video = webcam.canvas; // 使用 TM 的 video 畫面即可
  // 攝影機畫面僅透過 TM 或 MediaPipe 顯示，避免重疊
  const camera = new Camera(video, {
    onFrame: async () => {
      await faceMesh.send({ image: video });
    },
    width: 400,
    height: 400
  });
  camera.start();
}

async function init() {
  const suggestion = document.getElementById("suggestion");
  suggestion.innerHTML = "啟動攝影機中...";

  // 優先啟動 webcam 並顯示
  webcam = new tmImage.Webcam(400, 400, true);
  await webcam.setup();
  await webcam.play();
  document.getElementById("webcam-container").appendChild(webcam.canvas);
  suggestion.innerHTML = "鏡頭就緒，載入模型中...";

  // 接著載入模型與 MediaPipe
  model = await tmImage.load(
    "https://teachablemachine.withgoogle.com/models/MbSMHGKtH/model.json",
    "https://teachablemachine.withgoogle.com/models/MbSMHGKtH/metadata.json"
  );
  maxPredictions = model.getTotalClasses();

  faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });
  faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5 });
  faceMesh.onResults((results) => {
    if (results.multiFaceLandmarks.length > 0) {
      latestLandmarks = results.multiFaceLandmarks[0];
    }
  });

  camera = new Camera(webcam.webcam, {
    onFrame: async () => await faceMesh.send({ image: webcam.canvas }),
    width: 400,
    height: 400
  });
  camera.start();

  suggestion.innerHTML = "偵測中...";
  window.requestAnimationFrame(loop);
}

async function loop() {
  const now = Date.now();
  if (now - lastUpdateTime > updateInterval) {
    webcam.update();
    await detectEmotion();
    lastUpdateTime = now;
  }
  window.requestAnimationFrame(loop);
}

async function detectEmotion() {
  let className = "neutral";
  const predictions = await model.predict(webcam.canvas);
  const angry = predictions.find((p) => p.className === "angry");
  if (angry && angry.probability > 0.8) {
    className = "angry";
  } else if (latestFaceLandmarks) {
    const leftEyeTop = averageY([159, 160, 161]);
    const leftEyeBottom = averageY([144, 145, 153]);
    const eyeOpen = leftEyeBottom - leftEyeTop;
    const leftBrow = averageY([65, 66, 70]);
    const leftEye = averageY([33, 133]);
    const browLift = leftEye - leftBrow;
    const mouthTop = averageY([13]);
    const mouthBottom = averageY([14]);
    const mouthOpen = mouthBottom - mouthTop;
    const mouthLeft = latestFaceLandmarks[61];
    const mouthRight = latestFaceLandmarks[291];
    const mouthSlope = (mouthLeft.y + mouthRight.y) / 2 - mouthTop;

    if (mouthSlope < 0.015 && browLift > 0.005 && eyeOpen > 0.008) {
      className = "happy";
    } else if (eyeOpen < 0.005 && mouthOpen > 0.025) {
      className = "tired";
    } else {
      className = "neutral";
    }
  }

  displayEmotion(className);
}

function averageY(indices) {
  return indices.map((i) => latestFaceLandmarks[i].y).reduce((a, b) => a + b, 0) / indices.length;
}

function displayEmotion(className) {
  const emojiMap = { happy: "😊", angry: "😠", tired: "😴", neutral: "😐" };
  const bgColorMap = {
    happy: "#fff0f5",
    angry: "#ffeaea",
    tired: "#e8f0ff",
    neutral: "#f4f4f4"
  };

  const emoji = document.getElementById("emoji");
  const suggestion = document.getElementById("suggestion");
  const history = document.getElementById("history");

  const resultEmoji = emojiMap[className] || "❓";
  const pool = suggestionPool[className] || ["觀察中..."];
  const resultText = pool[Math.floor(Math.random() * pool.length)];

  emoji.innerHTML = resultEmoji;
  suggestion.innerHTML = resultText;
  document.body.style.backgroundColor = bgColorMap[className] || "#fff";

  triggerEmojiRain(resultEmoji);

  // 語音與音效播放
  if (!isLowLoadMode && isSpeakingEnabled && resultText !== lastSpokenText) {
    if (currentAudio && !currentAudio.paused) currentAudio.pause();
    const audios = audioMap[className];
    if (audios && audios.length > 0) {
      currentAudio = audios[Math.floor(Math.random() * audios.length)];
      currentAudio.currentTime = 0;
      currentAudio.play();
      emoji.classList.add("talking");
      setTimeout(() => emoji.classList.remove("talking"), 1000);
    }
    lastSpokenText = resultText;
    const speak = new SpeechSynthesisUtterance(resultText);
    speak.lang = "zh-TW";
    window.speechSynthesis.speak(speak);
  }

  // 歷史紀錄
  const timestamp = new Date().toLocaleTimeString();
  const record = document.createElement("div");
  record.textContent = `[${timestamp}] ${resultEmoji} ${resultText}`;
  record.style.color = getColorByClass(className);
  history.prepend(record);

  emotionLog[className]++;
  updateChart();
}

function triggerEmojiRain(emoji) {
  for (let i = 0; i < 10; i++) {
    const el = document.createElement("div");
    el.className = "emoji-float";
    el.innerText = emoji;
    el.style.left = Math.random() * 100 + "vw";
    el.style.animationDelay = i * 0.2 + "s";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
}

function updateChart() {
  const bars = document.querySelectorAll(".bar");
  bars.forEach(bar => {
    const emotion = bar.dataset.emotion;
    bar.style.width = emotionLog[emotion] * 10 + "px";
    bar.innerText = `${emotion}：${emotionLog[emotion]}`;
  });
}

function toggleSpeech() {
  isSpeakingEnabled = !isSpeakingEnabled;
  const button = document.getElementById("speech-toggle");
  button.innerText = isSpeakingEnabled ? "🔊 語音開啟" : "🔇 語音關閉";
}

function getColorByClass(className) {
  switch (className) {
    case "happy": return "#ff69b4";
    case "angry": return "#ff4d4d";
    case "tired": return "#999";
    case "neutral": return "#666";
    default: return "#333";
  }
}

window.addEventListener("click", () => {
  window.speechSynthesis.cancel();
});

let isLowLoadMode = false;

function toggleLowLoad() {
  isLowLoadMode = !isLowLoadMode;
  const btn = document.getElementById("load-toggle");
  btn.innerText = isLowLoadMode ? "⚡ 輕量模式開啟" : "⚙️ 全功能模式";
}
