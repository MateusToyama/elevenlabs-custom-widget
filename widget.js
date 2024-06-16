const fieldData = {
  elevenLabsApiKey: '',
  elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
  elevenLabsVoiceStability: 50,
  elevenLabsVoiceSimilarity: 50,
  elevenLabsVoiceStyleExaggeration: 0,
  minAmountTTS: 5,
  minIntervalBetweenTTS: 5,
  volumeTTS: 50
};
const alertsQueue = [];

let alertPlaying = false;

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

  let wait = true;
  try {
    wait = await playAlert(alert);
  } catch (e) {
    console.error('Error playing alert', e);
  }

  const delay = wait ? fieldData.minIntervalBetweenTTS * 1000 : 0;

  setTimeout(() => {
    alertPlaying = false;
    playNextAlert();
  }, delay);
};

const playAlert = async ({ message, amount }) => {
  if (!message || amount < fieldData.minAmountTTS) {
    return false;
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

  return true;
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

window.addEventListener('onWidgetLoad', (obj) => {
  for (const key in obj.detail.fieldData) {
    fieldData[key] = obj.detail.fieldData[key];
  }
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
      const { message, amount } = event;
      newAlert({ message, amount });
      break;
  }
});
