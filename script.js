let isSpeakingEnabled = true;
let lastSpokenText = "";
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
    "你笑起來真迷人！",
    "心情很好呢～",
    "笑得像仙女一樣欸～"
  ],
  angry: [
    "感覺妳有點不開心，還好嗎？",
    "要不要我請你喝奶茶？不氣不氣～",
    "火氣上來了？我來抱抱你"
  ],
  tired: [
    "你是不是很累？休息一下吧～",
    "今天好辛苦，來點小確幸？",
    "想不想看個劇放鬆一下？"
  ],
  neutral: [
    "平靜也是一種幸福。",
    "這時候可以來點小話題～",
    "要不要聽個輕鬆的歌？"
  ]
};

function init() {
  const videoElement = document.createElement("video");
  videoElement.setAttribute("playsinline", true);
  videoElement.style.display = "none";
  document.body.appendChild(videoElement);

  const webcamContainer = document.getElementById("webcam-container");
  const canvasElement = document.createElement("canvas");
  canvasElement.width = 400;
  canvasElement.height = 400;
  webcamContainer.appendChild(canvasElement);
  const canvasCtx = canvasElement.getContext("2d");

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
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.restore();
      processEmotion();
    }
  });

  const camera = new Camera(videoElement, {
    onFrame: async () => {
      await faceMesh.send({ image: videoElement });
    },
    width: 400,
    height: 400
  });
  camera.start();
}

// 根據嘴角與嘴巴位置偵測情緒
function processEmotion() {
  if (!latestFaceLandmarks) return;

  const leftMouth = latestFaceLandmarks[61];
  const rightMouth = latestFaceLandmarks[291];
  const topLip = latestFaceLandmarks[13];
  const bottomLip = latestFaceLandmarks[14];
  const midMouth = latestFaceLandmarks[0];

  const avgMouthCornerY = (leftMouth.y + rightMouth.y) / 2;
  const mouthCenterY = (topLip.y + bottomLip.y) / 2;
  const mouthOpen = bottomLip.y - topLip.y;

  let emotion = "neutral";
  if (mouthOpen > 0.06) {
    emotion = "tired";
  } else if (avgMouthCornerY < mouthCenterY - 0.02) {
    emotion = "happy";
  } else if (avgMouthCornerY > mouthCenterY + 0.02) {
    emotion = "angry";
  }

  displayEmotion(emotion);
}

function displayEmotion(className) {
  const emojiMap = {
    happy: "😊",
    angry: "😠",
    tired: "😴",
    neutral: "😐"
  };

  const resultEmoji = emojiMap[className] || "❓";
  const pool = suggestionPool[className] || ["..."];
  const resultText = pool[Math.floor(Math.random() * pool.length)];

  document.getElementById("emoji").innerHTML = resultEmoji;
  document.getElementById("suggestion").innerHTML = resultText;

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

  const history = document.getElementById("history");
  const timestamp = new Date().toLocaleTimeString();
  const record = document.createElement("div");
  record.textContent = `[${timestamp}] ${resultEmoji} ${resultText}`;
  record.style.color = getColorByClass(className);
  history.prepend(record);
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
