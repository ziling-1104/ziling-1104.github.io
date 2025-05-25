const URL = "https://teachablemachine.withgoogle.com/models/YOUR_MODEL_URL/"; // ← 替換成你自己的模型網址
let model, webcam, maxPredictions;
let useLowLoad = false;
let speechEnabled = false;
let camera;
let lastEmotion = "";
const counts = { happy: 0, angry: 0, tired: 0, neutral: 0 };

async function init() {
  const modelURL = URL + "model.json";
  const metadataURL = URL + "metadata.json";
  model = await tmImage.load(modelURL, metadataURL);

  const flip = true;
  webcam = new tmImage.Webcam(400, 400, flip);
  await webcam.setup();
  await webcam.play();
  document.getElementById("webcam-container").appendChild(webcam.canvas);

  window.requestAnimationFrame(loop);
  setupMediaPipe();
}

function toggleSpeech() {
  speechEnabled = !speechEnabled;
  const btn = document.getElementById("speech-toggle");
  btn.textContent = speechEnabled ? "🔇 語音關閉" : "🔊 語音開啟";
}

function toggleLowLoad() {
  useLowLoad = !useLowLoad;
  const btn = document.getElementById("load-toggle");
  btn.textContent = useLowLoad ? "⚙️ 節能模式" : "⚙️ 全功能模式";
}

async function loop() {
  webcam.update();
  await predict();
  window.requestAnimationFrame(loop);
}

async function predict() {
  const prediction = await model.predict(webcam.canvas);
  const angry = prediction.find(p => p.className === "angry");
  if (angry && angry.probability > 0.8) {
    showResult("angry", "😠", "深呼吸一下，冷靜一下心情吧！");
    return;
  }
}

// 顯示結果與語音等
function showResult(emotion, emoji, suggestion) {
  if (emotion !== lastEmotion) {
    lastEmotion = emotion;
    counts[emotion]++;
    document.getElementById("emoji").textContent = emoji;
    document.getElementById("suggestion").textContent = suggestion;
    updateHistory(emotion, emoji);
    updateChart();
    if (speechEnabled) speakSuggestion(suggestion);
  }
}

function updateHistory(emotion, emoji) {
  const history = document.getElementById("history");
  const div = document.createElement("div");
  div.textContent = `${new Date().toLocaleTimeString()} - ${emoji} ${emotion}`;
  history.prepend(div);
}

function updateChart() {
  for (let emotion in counts) {
    const bar = document.querySelector(`.bar[data-emotion="${emotion}"]`);
    if (bar) {
      bar.style.width = counts[emotion] * 20 + "px";
      bar.textContent = counts[emotion];
    }
  }
}

function speakSuggestion(text) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "zh-TW";
  speechSynthesis.speak(utter);
}

// ─────── MediaPipe ───────
function setupMediaPipe() {
  const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  faceMesh.onResults(onResults);

  camera = new Camera(webcam.webcam, {
    onFrame: async () => {
      await faceMesh.send({ image: webcam.webcam });
    },
    width: 400,
    height: 400,
  });
  camera.start();
}

function onResults(results) {
  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) return;

  const landmarks = results.multiFaceLandmarks[0];
  const leftEye = landmarks[159];
  const rightEye = landmarks[386];
  const topLip = landmarks[13];
  const bottomLip = landmarks[14];

  const eyeOpenness = Math.abs(leftEye.y - rightEye.y);
  const mouthOpen = Math.abs(topLip.y - bottomLip.y);

  if (mouthOpen > 0.05) {
    showResult("happy", "😄", "你看起來很開心！");
  } else if (eyeOpenness < 0.015) {
    showResult("tired", "🥱", "感覺有點疲倦，休息一下吧！");
  } else {
    showResult("neutral", "🙂", "你現在很平靜喔。");
  }
}
