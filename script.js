let model, webcam, maxPredictions;
let latestFaceLandmarks = null;
let isSpeakingEnabled = true;
let lastSpokenText = "";
let lastUpdateTime = 0;
const updateInterval = 4000;
let currentAudio = null;

const emotionLog = { happy: 0, angry: 0, tired: 0, neutral: 0 };

const audioMap = {
  happy: [new Audio("happy_1.mp3")],
  angry: [new Audio("angry_1.mp3")],
  tired: [new Audio("tired_1.mp3")],
  neutral: [new Audio("neutral_1.mp3")]
};

const suggestionPool = {
  happy: ["你看起來很開心！來點開心的建議吧～"],
  angry: ["你看起來有點生氣，要不要深呼吸一下？"],
  tired: ["累了嗎？休息一下比較好唷！"],
  neutral: ["一切平靜～來點放鬆的對話吧。"]
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
  const video = document.createElement("video");
  document.getElementById("webcam-container").appendChild(video);
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
  await loadTeachableModel();
  startFaceMesh();
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
  if (isSpeakingEnabled && resultText !== lastSpokenText) {
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
