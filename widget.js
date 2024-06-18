const fieldData = {
  elevenLabsApiKey: '',
  elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
  elevenLabsVoiceStability: 50,
  elevenLabsVoiceSimilarity: 50,
  elevenLabsVoiceStyleExaggeration: 0,
  alertMessage:
    '<span class="alert-text-highlight">{name}</span> superchatted <span class="alert-text-highlight">${amount}</span>!',
  alertInterval: 3,
  enableTTS: true,
  minAmountTTS: 5,
  volumeTTS: 50
};
const alertsQueue = [];

let alertPlaying = false;
let alertVideo = null;
let alertVideoResolveFn = () => {};
let alertVideoRejectFn = () => {};
let alertText = null;

const newAlert = (alert) => {
  alertsQueue.push(alert);
  playNextAlert();
};

const playNextAlert = async () => {
  if (alertPlaying || alertsQueue.length === 0) {
    return;
  }

  alertPlaying = true;

  const alert = alertsQueue[0];
  alertsQueue.splice(0, 1);

  try {
    await playAlert(alert);
  } catch (e) {
    console.error('Error playing alert', JSON.stringify(e));
  }

  await sleep(fieldData.alertInterval * 1000);
  alertPlaying = false;
  playNextAlert();
};

const playAlert = async ({ displayName, message, amount }) => {
  alertVideo.style.display = 'block';
  alertText.innerHTML = fieldData.alertMessage
    .replaceAll('{name}', displayName)
    .replaceAll('{amount}', amount);
  alertText.style.display = 'block';

  const promises = [playVideo(), playTTS({ message, amount })];
  const result = await Promise.allSettled(promises);

  alertVideo.style.display = 'none';
  alertText.style.display = 'none';

  const errors = result.filter((r) => r.status === 'rejected');
  if (errors.length > 0) {
    throw new Error(errors);
  }
};

const playVideo = async () => {
  return new Promise((resolve, reject) => {
    alertVideo.pause();
    alertVideo.currentTime = 0;

    alertVideoResolveFn = resolve;
    alertVideoRejectFn = reject;

    alertVideo.play();
  });
};

const playTTS = async ({ message, amount }) => {
  if (!fieldData.enableTTS || !message || amount < fieldData.minAmountTTS) {
    return;
  }

  const body = {
    text: message,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: fieldData.elevenLabsVoiceStability / 100,
      similarity_boost: fieldData.elevenLabsVoiceSimilarity / 100,
      style: fieldData.elevenLabsVoiceStyleExaggeration / 100
    }
  };

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': fieldData.elevenLabsApiKey
    },
    body: JSON.stringify(body)
  };

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${fieldData.elevenLabsVoiceId}`,
    options
  );

  const blob = await response.blob();
  const objectURL = URL.createObjectURL(blob);
  await playAudio(objectURL);
  URL.revokeObjectURL(objectURL);
};

const playAudio = async (url) => {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.volume = fieldData.volumeTTS / 100;
    audio.addEventListener('ended', resolve);
    audio.addEventListener('error', reject);
    audio.play();
  });
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

window.addEventListener('onWidgetLoad', (obj) => {
  for (const key in obj.detail.fieldData) {
    fieldData[key] = obj.detail.fieldData[key];
  }

  alertVideo = document.getElementById('alert-video');
  alertVideo.addEventListener('ended', (e) => alertVideoResolveFn(e));
  alertVideo.addEventListener('error', (e) => alertVideoRejectFn(e));

  alertText = document.getElementById('alert-text');
  alertText.style.display = 'none';

  const style = document.createElement('style');
  style.innerHTML = obj.detail.fieldData.alertCustomCss;
  document.head.appendChild(style);
});

window.addEventListener('onEventReceived', (obj) => {
  if (!obj.detail.event) {
    return;
  }

  if (typeof obj.detail.event.itemId !== 'undefined') {
    obj.detail.listener = 'redemption-latest';
  }

  const listener = obj.detail.listener.split('-')[0];
  const event = obj.detail.event;

  switch (listener) {
    case 'superchat':
      const { displayName, message, amount } = event;
      newAlert({ displayName, message, amount });
      break;
  }
});
