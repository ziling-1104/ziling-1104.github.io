const URL = "https://teachablemachine.withgoogle.com/models/YOUR_MODEL_URL/"; // ← 改成你的 TM 模型網址
let model, webcam, maxPredictions;
let videoElement;
let useLowLoad = false;
let speechEnabled = false;
let detecting = false;
let lastEmotion = "";
const counts = { happy: 0, angry: 0, tired: 0, neutral: 0 };

async function init() {
  const modelURL = URL + "model.json";
  const metadataURL = URL + "metadata.json";
  model = await tmImage.load(modelURL, metadataURL);

  webcam = new tmImage.Webcam(400, 400, true); // width, height, flip
  await webcam.setup();
  await webcam.play();
  document.getElementById("webcam-container").appendChild(webcam.canvas);

  videoElement = webcam.webcam; // 這是 <video> 元素
  setupMediaPipe();

  window.requestAnimationFrame(loop);
}

function toggleSpeech() {
  speechEnabled = !speechEnabled;
  document.getElementById("speech-toggle").textContent = speechEnabled ? "🔇 語音關閉" : "🔊 語音開啟";
}

function toggleLowLoad() {
  useLowLoad = !useLowLoad;
  document.getElementById("load-toggle").textContent = useLowLoad ? "⚙️ 節能模式" : "⚙️ 全功能模式";
}

async function loop() {
  webcam.update();
  if (!detecting) {
    detecting = true;
    await detectAngry();
    detecting = false;
  }
  window.requestAnimationFrame(loop);
}

async function detectAngry() {
  const prediction = await model.predict(webcam.canvas);
  const angry = prediction.find(p => p.className === "angry");
  if (angry && angry.probability > 0.85) {
    showResult("angry", "😠", "深呼吸一下，冷靜一下心情吧！");
  }
}

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

function setupMediaPipe() {
  const faceMesh = new FaceMesh({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  faceMesh.onResults(onResults);

  const camera = new Camera(videoElement, {
    onFrame: async () => {
      await faceMesh.send({ image: videoElement });
    },
    width: 400,
    height: 400
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

  if (lastEmotion === "angry") return; // 若是生氣，暫不讓 MediaPipe 蓋掉

  if (mouthOpen > 0.05) {
    showResult("happy", "😄", "你看起來很開心！");
  } else if (eyeOpenness < 0.015) {
    showResult("tired", "🥱", "感覺有點疲倦，休息一下吧！");
  } else {
    showResult("neutral", "🙂", "你現在很平靜喔。");
  }
}
