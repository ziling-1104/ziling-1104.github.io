const modelURL = "https://teachablemachine.withgoogle.com/models/MbSMHGKtH/model.json";
const metadataURL = "https://teachablemachine.withgoogle.com/models/MbSMHGKtH/metadata.json";

let model, webcam, maxPredictions;
let isSpeakingEnabled = true;
let lastSpokenText = "";
let lastUpdateTime = 0;
const updateInterval = 4000;
let currentAudio = null;
let latestFaceLandmarks = null;

const audioMap = {
  happy: [new Audio("happy_1.mp3"), new Audio("happy_2.mp3"), new Audio("happy_3.mp3")],
  angry: [new Audio("angry_1.mp3"), new Audio("angry_2.mp3"), new Audio("angry_3.mp3")],
  tired: [new Audio("tired_1.mp3"), new Audio("tired_2.mp3"), new Audio("tired_3.mp3")],
  neutral: [new Audio("neutral_1.mp3"), new Audio("neutral_2.mp3"), new Audio("neutral_3.mp3")]
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

async function init() {
  const suggestion = document.getElementById("suggestion");
  suggestion.innerHTML = "正在載入模型...";
  model = await tmImage.load(modelURL, metadataURL);
  maxPredictions = model.getTotalClasses();

  suggestion.innerHTML = "正在啟動攝影機...";
  const flip = true;
  webcam = new tmImage.Webcam(400, 400, flip);
  await webcam.setup();
  await webcam.play();
  document.getElementById("webcam-container").appendChild(webcam.canvas);
  suggestion.innerHTML = "偵測中...";

  startFaceMesh();
  window.requestAnimationFrame(loop);
}

async function loop() {
  webcam.update();
  const now = Date.now();
  if (now - lastUpdateTime > updateInterval) {
    await predict();
    lastUpdateTime = now;
  }
  setTimeout(() => {
    window.requestAnimationFrame(loop);
  }, 200);
}

async function predict() {
  const prediction = await model.predict(webcam.canvas);
  const best = prediction.reduce((a, b) => a.probability > b.probability ? a : b);
  let className = best.className;

  className = getCorrectedClass(className);
  displayEmotion(className);
}

function getCorrectedClass(tmClass) {
  if (!latestFaceLandmarks) return tmClass;

  const left = latestFaceLandmarks[61];
  const right = latestFaceLandmarks[291];
  const topLip = latestFaceLandmarks[13];
  const bottomLip = latestFaceLandmarks[14];

  const mouthHeight = bottomLip.y - topLip.y;
  const mouthSlope = ((left.y + right.y) / 2 - topLip.y);

  if (tmClass !== "happy" && mouthSlope < 0.02) return "happy";
  if (tmClass !== "angry" && mouthSlope > 0.05) return "angry";
  if (tmClass !== "tired" && mouthHeight > 0.07) return "tired";
  if (
    mouthSlope >= 0.02 && mouthSlope <= 0.05 &&
    mouthHeight <= 0.05 &&
    tmClass !== "neutral"
  ) return "neutral";

  return tmClass;
}

function displayEmotion(className) {
  const emojiMap = {
    happy: "😊", angry: "😠", tired: "😴", neutral: "😐"
  };

  const emoji = document.getElementById("emoji");
  const suggestion = document.getElementById("suggestion");
  const history = document.getElementById("history");

  const resultEmoji = emojiMap[className] || "❓";
  const pool = suggestionPool[className] || ["再觀察一下唷～"];
  const resultText = pool[Math.floor(Math.random() * pool.length)];

  emoji.innerHTML = resultEmoji;
  suggestion.innerHTML = resultText;

  if (isSpeakingEnabled && resultText !== lastSpokenText) {
    if (currentAudio && !currentAudio.paused) currentAudio.pause();
    const audios = audioMap[className];
    if (audios && audios.length > 0) {
      currentAudio = audios[Math.floor(Math.random() * audios.length)];
      currentAudio.currentTime = 0;
      currentAudio.play();
    }
    lastSpokenText = resultText;
  }

  const timestamp = new Date().toLocaleTimeString();
  const record = document.createElement("div");
  record.textContent = `[${timestamp}] ${resultEmoji} ${resultText}`;
  record.style.color = getColorByClass(className);
  history.prepend(record);
}

function startFaceMesh() {
  const faceMesh = new FaceMesh({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
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

  const camera = new Camera(webcam.webcam, {
    onFrame: async () => {
      await faceMesh.send({ image: webcam.webcam });
    },
    width: 400,
    height: 400
  });
  camera.start();
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
