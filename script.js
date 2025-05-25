let webcam;
let latestFaceLandmarks = null;
let lastUpdateTime = 0;
const updateInterval = 2000;
const emotionLog = { happy: 0, angry: 0, tired: 0, neutral: 0 };

const suggestionPool = {
  happy: [
    "她心情不錯！你可以說：『看到你我也整天都快樂！』",
    "氣氛超棒，可以說：『笑得像仙女一樣欸～』"
  ],
  angry: [
    "她可能有點不開心。你可以說：『我剛才是不是太急了？對不起嘛～抱一下？』",
    "她似乎有點氣氣的。試試：『要不要我請你喝奶茶？不氣不氣～』"
  ],
  tired: [
    "她好像很累。你可以說：『辛苦啦～今天不要再想工作了！』",
    "她有點疲倦。輕輕一句：『來，我幫你按摩三分鐘～』"
  ],
  neutral: [
    "她現在沒特別情緒。你可以說：『這週末你有想去哪裡嗎？』",
    "中性狀態～你可以說：『昨天夢到我們去環島欸！你夢到什麼？』"
  ]
};

async function init() {
  webcam = new Camera(document.createElement("video"), {
    onFrame: async () => await faceMesh.send({ image: webcam.video }),
    width: 400,
    height: 400
  });

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
    if (results.multiFaceLandmarks.length > 0) {
      latestFaceLandmarks = results.multiFaceLandmarks[0];
    }
  });

  await webcam.start();
  document.getElementById("webcam-container").appendChild(webcam.video);
  window.requestAnimationFrame(loop);
}

async function loop() {
  const now = Date.now();
  if (now - lastUpdateTime > updateInterval) {
    await detectEmotion();
    lastUpdateTime = now;
  }
  window.requestAnimationFrame(loop);
}

async function detectEmotion() {
  if (!latestFaceLandmarks) return;

  const mouthTop = averageY([13]);
  const mouthBottom = averageY([14]);
  const mouthOpen = mouthBottom - mouthTop;

  const eyeTop = averageY([159, 160, 161]);
  const eyeBottom = averageY([144, 145, 153]);
  const eyeOpen = eyeBottom - eyeTop;

  const brow = averageY([65, 66, 70]);
  const eye = averageY([33, 133]);
  const browLift = eye - brow;

  let className = "neutral";

  if (mouthOpen > 0.035) {
    className = "tired";
  } else if (mouthOpen < 0.010) {
    className = "angry";
  } else if (browLift > 0.015 && eyeOpen > 0.01) {
    className = "happy";
  }

  displayEmotion(className);
}

function averageY(indices) {
  return (
    indices
      .map((i) => latestFaceLandmarks[i].y)
      .reduce((a, b) => a + b, 0) / indices.length
  );
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
    case "happy":
      return "#ff69b4";
    case "angry":
      return "#ff4d4d";
    case "tired":
      return "#999";
    case "neutral":
      return "#666";
    default:
      return "#333";
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
