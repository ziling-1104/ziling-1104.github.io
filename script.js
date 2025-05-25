let isSpeakingEnabled = true;
let lastSpokenText = "";
let lastUpdateTime = 0;
const updateInterval = 4000;
let currentAudio = null;
let latestFaceLandmarks = null;

const emotionLog = { happy: 0, angry: 0, tired: 0, neutral: 0 };

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
  suggestion.innerHTML = "正在啟動攝影機...";
  const video = document.createElement("video");
  document.getElementById("webcam-container").appendChild(video);
  const camera = new Camera(video, {
    onFrame: async () => {
      await faceMesh.send({ image: video });
    },
    width: 400,
    height: 400
  });
  await camera.start();
  suggestion.innerHTML = "偵測中...";
  startFaceMesh();
  window.requestAnimationFrame(loop);
}

async function loop() {
  const now = Date.now();
  if (now - lastUpdateTime > updateInterval) {
    detectEmotion();
    lastUpdateTime = now;
  }
  window.requestAnimationFrame(loop);
}

function detectEmotion() {
  if (!latestFaceLandmarks) return;

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
  const mouthSlope = ((mouthLeft.y + mouthRight.y) / 2 - mouthTop);

  let className = "neutral";

  if (mouthSlope < 0.015 && browLift > 0.005 && eyeOpen > 0.008) {
    className = "happy";
  } else if (browLift < -0.001 && eyeOpen < 0.009 && mouthOpen < 0.03) {
    className = "angry";
  } else if (eyeOpen < 0.005 && mouthOpen > 0.025) {
    className = "tired";
  } else if (
    mouthSlope >= 0.003 && mouthSlope <= 0.02 &&
    browLift >= -0.005 && browLift <= 0.01 &&
    eyeOpen >= 0.006 && eyeOpen <= 0.02
  ) {
    className = "neutral";
  }

  displayEmotion(className);
}

function averageY(indices) {
  return indices.map(i => latestFaceLandmarks[i].y).reduce((a, b) => a + b) / indices.length;
}

function displayEmotion(className) {
  const emojiMap = {
    happy: "😊", angry: "😠", tired: "😴", neutral: "😐"
  };

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
  const pool = suggestionPool[className] || ["再觀察一下唷～"];
  const resultText = pool[Math.floor(Math.random() * pool.length)];

  emoji.innerHTML = resultEmoji;
  suggestion.innerHTML = resultText;
  document.body.style.backgroundColor = bgColorMap[className] || "#fff";

  // emoji 雨動畫
  triggerEmojiRain(resultEmoji);

  // 更新統計圖表
  emotionLog[className]++;
  updateChart();

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
  }

  const timestamp = new Date().toLocaleTimeString();
  const record = document.createElement("div");
  record.textContent = `[${timestamp}] ${resultEmoji} ${resultText}`;
  record.style.color = getColorByClass(className);
  history.prepend(record);
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

  window.faceMesh = faceMesh;
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
