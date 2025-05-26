let webcam;
let latestFaceLandmarks = null;
const emotionLog = { happy: 0, angry: 0, tired: 0, neutral: 0 };

let lastEmotion = "";
let lastTriggerTime = 0;
const cooldown = 3000;

let lastSpokenText = "";
let currentAudio = null;

const suggestionPool = {
  happy: [
    "她心情不錯！你可以說：『看到你我也整天都快樂！』",
    "氣氛超棒，可以說：『笑得像仙女一樣欸～』",
    "開心的時候最可愛，你可以說：『我是不是該錄起來，每天看一次』"
  ],
  angry: [
    "她可能有點不開心。你可以說：『我剛才是不是太急了？對不起嘛～抱一下？』",
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
    "平靜狀態～你可以說：『如果只能選一種飲料，你會喝？』",
    "平靜模式～用趣味破冰：『昨天夢到我們去環島欸！你夢到什麼？』"
  ]
};

const audioMap = {
  happy: [new Audio("happy_1.mp3"), new Audio("happy_2.mp3"), new Audio("happy_3.mp3")],
  angry: [new Audio("angry_1.mp3"), new Audio("angry_2.mp3"), new Audio("angry_3.mp3")],
  tired: [new Audio("tired_1.mp3"), new Audio("tired_2.mp3"), new Audio("tired_3.mp3")],
  neutral: [new Audio("neutral_1.mp3"), new Audio("neutral_2.mp3"), new Audio("neutral_3.mp3")]
};

async function init() {
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
    if (results.multiFaceLandmarks.length > 0) {
      latestFaceLandmarks = results.multiFaceLandmarks[0];
    }
  });

  webcam = new Camera(document.createElement("video"), {
    onFrame: async () => {
      await faceMesh.send({ image: webcam.video });
      detectEmotion();
    },
    width: 400,
    height: 400
  });

  await webcam.start();
  document.getElementById("webcam-container").appendChild(webcam.video);
}

function detectEmotion() {
  if (!latestFaceLandmarks) return;

  const mouthOpen = averageY([14]) - averageY([13]);
  const eyeOpen = averageY([145, 153]) - averageY([159, 160]);
  const browLift = averageY([33, 133]) - averageY([65, 66]);

  let className = "neutral";

  if (browLift > 0.008 && eyeOpen > 0.006) {
    className = "happy";
  } else if (mouthOpen > 0.025) {
    className = "tired";
  } else if (mouthOpen < 0.012 && browLift < 0.010) {
    className = "angry";
  } else if (
    Math.abs(mouthOpen) < 0.015 &&
    Math.abs(browLift) < 0.008 &&
    Math.abs(eyeOpen) < 0.006
  ) {
    className = "neutral";
  }

  const now = Date.now();
  if (className === lastEmotion && now - lastTriggerTime < cooldown) return;

  lastEmotion = className;
  lastTriggerTime = now;

  displayEmotion(className);
}

function averageY(indices) {
  return indices.map(i => latestFaceLandmarks[i].y).reduce((a, b) => a + b, 0) / indices.length;
}

function displayEmotion(className) {
  const emojiMap = {
    happy: "😊",
    angry: "😠",
    tired: "😴",
    neutral: "😐"
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
  const textPool = suggestionPool[className] || ["觀察中..."];
  const resultText = textPool[Math.floor(Math.random() * textPool.length)];

  emoji.innerHTML = resultEmoji;
  suggestion.innerHTML = resultText;
  document.body.style.backgroundColor = bgColorMap[className] || "#fff";

  // 播放對應情緒的 mp3（先停止上一個）
  if (resultText !== lastSpokenText) {
    if (currentAudio && !currentAudio.paused) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

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

  emotionLog[className]++;
  updateChart();
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

function updateChart() {
  const bars = document.querySelectorAll(".bar");
  bars.forEach((bar) => {
    const emotion = bar.dataset.emotion;
    bar.style.width = emotionLog[emotion] * 10 + "px";
    bar.innerText = `${emotion}：${emotionLog[emotion]}`;
  });
}
