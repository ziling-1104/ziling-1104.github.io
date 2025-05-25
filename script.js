const modelURL = "https://teachablemachine.withgoogle.com/models/MbSMHGKtH/model.json";
const metadataURL = "https://teachablemachine.withgoogle.com/models/MbSMHGKtH/metadata.json";

let model, webcam, maxPredictions;
let isSpeakingEnabled = true;
let lastSpokenText = "";
let lastUpdateTime = 0;
const updateInterval = 4000;
let currentAudio = null;
let latestFaceLandmarks = null; // 存放嘴角座標

// 預錄語音地圖
const audioMap = {
  happy: [new Audio("happy_1.mp3"), new Audio("happy_2.mp3"), new Audio("happy_3.mp3")],
  angry: [new Audio("angry_1.mp3"), new Audio("angry_2.mp3"), new Audio("angry_3.mp3")],
  tired: [new Audio("tired_1.mp3"), new Audio("tired_2.mp3"), new Audio("tired_3.mp3")],
  neutral: [new Audio("neutral_1.mp3"), new Audio("neutral_2.mp3"), new Audio("neutral_3.mp3")]
};

// 顯示用建議語句
const suggestionPool = {
  happy: [
    "她心情不錯！你可以說：『看到你我也整天都快樂！』",
    "氣氛超棒，可以說：『笑得像仙女一樣欸～』",
    "開心的時候最可愛，你可以說：『我是不是該錄起來，每天看一次』"
  ],
  angry: [ /* 略 */ ],
  tired: [ /* 略 */ ],
  neutral: [ /* 略 */ ]
};

// 初始化
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

  // 啟用 FaceMesh
  startFaceMesh();

  window.requestAnimationFrame(loop);
}

// TM 模型主迴圈
async function loop() {
  webcam.update();
  const now = Date.now();
  if (now - lastUpdateTime > updateInterval) {
    await predict();
    lastUpdateTime = now;
  }
  window.requestAnimationFrame(loop);
}

// TM 模型預測
async function predict() {
  const prediction = await model.predict(webcam.canvas);
  const best = prediction.reduce((a, b) => a.probability > b.probability ? a : b);
  let className = best.className;

  // ✅ 嘴角上揚補強邏輯
  if (className !== "happy" && isSmiling()) {
    className = "happy";
  }

  const emojiMap = {
    happy: "😊", angry: "😠", tired: "😴", neutral: "😐"
  };
  const emoji = document.getElementById("emoji");
  const suggestion = document.getElementById("suggestion");
  const history = document.getElementById("history");

  const resultEmoji = emojiMap[className] || "❓";
  const pool = suggestionPool[className] || ["無法判斷情緒，再觀察一下唷。"];
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

// ✅ 嘴角上揚判定（根據嘴角高低差）
function isSmiling() {
  if (!latestFaceLandmarks) return false;
  const leftMouth = latestFaceLandmarks[61];
  const rightMouth = latestFaceLandmarks[291];
  const topLip = latestFaceLandmarks[13];
  const bottomLip = latestFaceLandmarks[14];

  if (!leftMouth || !rightMouth || !topLip || !bottomLip) return false;

  const mouthHeight = bottomLip.y - topLip.y;
  const mouthSlope = (leftMouth.y + rightMouth.y) / 2 - topLip.y;

  return mouthHeight > 0.03 && mouthSlope < 0.02;
}

// ✅ 啟動 FaceMesh 偵測嘴角
function startFaceMesh() {
  const faceMesh = new FaceMesh({ locateFile: (file) => 
    `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });
  faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5 });

  faceMesh.onResults((results) => {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      latestFaceLandmarks = results.multiFaceLandmarks[0];
    }
  });

  const videoElement = webcam.webcam;
  const camera = new Camera(videoElement, {
    onFrame: async () => {
      await faceMesh.send({ image: videoElement });
    },
    width: 400,
    height: 400
  });
  camera.start();
}

// 語音開關
function toggleSpeech() {
  isSpeakingEnabled = !isSpeakingEnabled;
  const button = document.getElementById("speech-toggle");
  button.innerText = isSpeakingEnabled ? "🔊 語音開啟" : "🔇 語音關閉";
}

// 顏色
function getColorByClass(className) {
  switch (className) {
    case "happy": return "#ff69b4";
    case "angry": return "#ff4d4d";
    case "tired": return "#999";
    case "neutral": return "#666";
    default: return "#333";
  }
}

// 修正播放限制
window.addEventListener("click", () => {
  window.speechSynthesis.cancel();
});
