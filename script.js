let model, webcam, maxPredictions;
let isSpeakingEnabled = true;
let lastSpokenText = "";
let lastUpdateTime = 0;
const updateInterval = 4000;
let currentAudio = null;
let faceMesh;
let camera;
let latestLandmarks = null;
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
  suggestion.innerHTML = "正在載入模型...";
  
  // Teachable Machine
  model = await tmImage.load(
    "https://teachablemachine.withgoogle.com/models/MbSMHGKtH/model.json",
    "https://teachablemachine.withgoogle.com/models/MbSMHGKtH/metadata.json"
  );
  maxPredictions = model.getTotalClasses();

  // Webcam 初始化
  webcam = new tmImage.Webcam(400, 400, true);
  await webcam.setup();
  await webcam.play();
  document.getElementById("webcam-container").appendChild(webcam.canvas);

  // MediaPipe FaceMesh 初始化
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
  webcam.update();
  const now = Date.now();
  if (now - lastUpdateTime > updateInterval) {
    await predict();
    lastUpdateTime = now;
  }
  window.requestAnimationFrame(loop);
}

async function predict() {
  const prediction = await model.predict(webcam.canvas);
  const best = prediction.reduce((a, b) => a.probability > b.probability ? a : b);

  let className = best.className;

  // MediaPipe 判斷其他表情（如果不是 angry）
  if (className !== "angry" && latestLandmarks) {
    const mouth = latestLandmarks;
    const left = mouth[61]; const right = mouth[291]; // 嘴角
    const topLip = mouth[13]; const bottomLip = mouth[14];
    const smile = (right.x - left.x) / (bottomLip.y - topLip.y);

    if (smile > 2.0) className = "happy";
    else if ((topLip.y + bottomLip.y) / 2 > 0.5) className = "tired";
    else className = "neutral";
  }

  updateUI(className);
}
function updateUI(className) {
  const emojiMap = {
    happy: "😊", angry: "😠", tired: "😴", neutral: "😐"
  };
  const bgMap = {
    happy: "#fffde7", angry: "#ffebee", tired: "#e0f7fa", neutral: "#eeeeee"
  };

  const emoji = document.getElementById("emoji");
  const suggestion = document.getElementById("suggestion");
  const history = document.getElementById("history");

  const resultEmoji = emojiMap[className] || "❓";
  const suggestions = suggestionPool[className] || ["暫時無法判斷情緒"];
  const resultText = suggestions[Math.floor(Math.random() * suggestions.length)];

  emoji.innerHTML = resultEmoji;
  emoji.classList.add("talking");
  setTimeout(() => emoji.classList.remove("talking"), 600);
  suggestion.innerText = resultText;

  if (isSpeakingEnabled && resultText !== lastSpokenText) {
    if (currentAudio && !currentAudio.paused) currentAudio.pause();
    const audios = audioMap[className];
    if (audios) {
      currentAudio = audios[Math.floor(Math.random() * audios.length)];
      currentAudio.currentTime = 0;
      currentAudio.play();
    }

    const utter = new SpeechSynthesisUtterance(resultText);
    utter.lang = "zh-TW";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
    lastSpokenText = resultText;
  }

  // 記錄歷史
  const timestamp = new Date().toLocaleTimeString();
  const record = document.createElement("div");
  record.textContent = `[${timestamp}] ${resultEmoji} ${resultText}`;
  record.style.color = getColorByClass(className);
  history.prepend(record);

  // 背景色
  document.body.style.backgroundColor = bgMap[className] || "#ffffff";

  // emoji 雨
  const floatEmoji = document.createElement("div");
  floatEmoji.className = "emoji-float";
  floatEmoji.innerText = resultEmoji;
  floatEmoji.style.left = Math.random() * 100 + "vw";
  document.body.appendChild(floatEmoji);
  setTimeout(() => floatEmoji.remove(), 4000);

  // 統計更新
  emotionLog[className]++;
  updateChart();
}

function updateChart() {
  Object.keys(emotionLog).forEach(emotion => {
    const bar = document.querySelector(`.bar[data-emotion="${emotion}"]`);
    const count = emotionLog[emotion];
    bar.style.width = Math.min(count * 20, 300) + "px";
    bar.innerText = `${emotion}：${count}`;
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

function toggleSpeech() {
  isSpeakingEnabled = !isSpeakingEnabled;
  const button = document.getElementById("speech-toggle");
  button.innerText = isSpeakingEnabled ? "🔊 語音開啟" : "🔇 語音關閉";
}

window.addEventListener("click", () => {
  window.speechSynthesis.cancel(); // 啟動點擊互動
});
