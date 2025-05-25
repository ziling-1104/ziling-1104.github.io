
let model, webcam, maxPredictions;
let latestFaceLandmarks = null;
let isSpeakingEnabled = true;
let lastSpokenText = "";
let lastUpdateTime = 0;
const updateInterval = 4000;
let currentAudio = null;

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
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  faceMesh.onResults((results) => {
    if (
      results.multiFaceLandmarks &&
      results.multiFaceLandmarks.length > 0
    ) {
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
    height: 400,
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

  // Teachable Machine 專門判斷 angry
  const predictions = await model.predict(webcam.canvas);
  const angry = predictions.find((p) => p.className === "angry");
  if (angry && angry.probability > 0.8) {
    className = "angry";
  } else if (latestFaceLandmarks) {
    // 其餘表情由 MediaPipe 判斷
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
    const mouthSlope =
      (mouthLeft.y + mouthRight.y) / 2 - mouthTop;

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
    neutral: "😐",
  };
  const emoji = document.getElementById("emoji");
  const suggestion = document.getElementById("suggestion");

  emoji.innerHTML = emojiMap[className] || "❓";
  suggestion.innerHTML = `目前偵測為 ${className.toUpperCase()}`;

  // 語音 + 音效
  if (isSpeakingEnabled && className !== lastSpokenText) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(suggestion.innerText);
    utter.lang = "zh-TW";
    window.speechSynthesis.speak(utter);
    lastSpokenText = className;
  }
}
