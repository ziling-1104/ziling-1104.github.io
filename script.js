let webcam;
let latestFaceLandmarks = null;
let lastUpdateTime = 0;
const updateInterval = 3000;
let currentAudio = null;

const emotionLog = { happy: 0, angry: 0, tired: 0, neutral: 0 };

const suggestionPool = {
  happy: [
    "她心情不錯！你可以說：『看到你我也整天都快樂！』",
    "氣氛超棒，可以說：『笑得像仙女一樣欸～』",
    "開心的時候最可愛，你可以說：『我是不是該錄起來，每天看一次』"
  ],
  angry: [
    "她可能有點生氣了，試著安撫她：『我剛才是不是太急了？對不起嘛～抱一下？』",
    "眉頭緊皺嘴唇閉緊？可能是怒氣值上升：『要不要我請你喝奶茶？不氣不氣～』"
  ],
  tired: [
    "她好像很累。你可以說：『辛苦啦～今天不要再想工作了！』",
    "她有點疲倦。輕輕一句：『來，我幫你按摩三分鐘～』"
  ],
  neutral: [
    "她現在沒特別情緒。你可以說：『這週末你有想去哪裡嗎？』",
    "平靜模式～你可以說：『昨天夢到我們去環島欸！你夢到什麼？』"
  ]
};

async function init() {
  webcam = new Camera(document.createElement("video"), {
    onFrame: async () => {
      await faceMesh.send({ image: webcam.video });
    },
    width: 400,
    height: 400
  });
  await webcam.start();
  document.getElementById("webcam-container").appendChild(webcam.video);
  startFaceMesh();
  window.requestAnimationFrame(loop);
}

function startFaceMesh() {
  faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  faceMesh.onResults((results) => {
    if (results.multiFaceLandmarks.length > 0) {
      latestFaceLandmarks = results.multiFaceLandmarks[0];
    }
  });
}

async function loop() {
  const now = Date.now();
  if (now - lastUpdateTime > updateInterval && latestFaceLandmarks) {
    detectEmotion();
    lastUpdateTime = now;
  }
  window.requestAnimationFrame(loop);
}

function detectEmotion() {
  const mouthTop = averageY([13]);
  const mouthBottom = averageY([14]);
  const mouthOpen = mouthBottom - mouthTop;

  const leftEyeTop = averageY([159, 160, 161]);
  const leftEyeBottom = averageY([144, 145, 153]);
  const eyeOpen = leftEyeBottom - leftEyeTop;

  const browTop = averageY([65, 66, 70]);
  const eyeCenter = averageY([33, 133]);
  const browLift = eyeCenter - browTop;

  let emotion = "neutral";

  if (mouthOpen > 0.025 && eyeOpen < 0.006) {
    emotion = "tired";
  } else if (mouthOpen < 0.01 && browLift < 0.005) {
    emotion = "angry";
  } else if (mouthOpen > 0.015 && browLift > 0.008 && eyeOpen > 0.01) {
    emotion = "happy";
  }

  displayEmotion(emotion);
}

function averageY(indices) {
  return indices.map(i => latestFaceLandmarks[i].y).reduce((a, b) => a + b, 0) / indices.length;
}

function displayEmotion(emotion) {
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

  const resultEmoji = emojiMap[emotion] || "❓";
  const pool = suggestionPool[emotion] || ["觀察中..."];
  const resultText = pool[Math.floor(Math.random() * pool.length)];

  emoji.innerHTML = resultEmoji;
  suggestion.innerHTML = resultText;
  document.body.style.backgroundColor = bgColorMap[emotion];

  triggerEmojiRain(resultEmoji);

  const timestamp = new Date().toLocaleTimeString();
  const record = document.createElement("div");
  record.textContent = `[${timestamp}] ${resultEmoji} ${resultText}`;
  record.style.color = getColorByClass(emotion);
  history.prepend(record);

  emotionLog[emotion]++;
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

function getColorByClass(className) {
  switch (className) {
    case "happy": return "#ff69b4";
    case "angry": return "#ff4d4d";
    case "tired": return "#999";
    case "neutral": return "#666";
    default: return "#333";
  }
}
