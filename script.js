// Time and state helpers (Sydney logic hidden in UI)

function getSydneyTimeInfo() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  });

  const parts = formatter.formatToParts(now);

  let weekdayStr = "";
  let hour = 0;
  let minute = 0;

  for (const part of parts) {
    if (part.type === "weekday") {
      weekdayStr = part.value;
    } else if (part.type === "hour") {
      hour = parseInt(part.value, 10);
    } else if (part.type === "minute") {
      minute = parseInt(part.value, 10);
    }
  }

  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekdayIndex = weekdayNames.indexOf(weekdayStr);

  return { weekdayIndex, hour, minute };
}

function isMezcalWindow() {
  const { weekdayIndex, hour } = getSydneyTimeInfo();
  const isMezcalDay = weekdayIndex === 4 || weekdayIndex === 5 || weekdayIndex === 6; // Thu Fri Sat
  const inWindow = hour >= 17 && hour < 22; // 5 pm to before 10 pm
  return isMezcalDay && inWindow;
}

function isLateOrEarly() {
  const { hour } = getSydneyTimeInfo();
  return hour >= 22 || hour < 9; // After 10 pm until 9 am
}

function getVisualState() {
  const { hour } = getSydneyTimeInfo();
  if (hour >= 22 || hour < 5) {
    return "night";
  }
  if (hour < 9) {
    return "morning";
  }
  return "day";
}

function applyVisualState() {
  const state = getVisualState();
  const body = document.body;
  body.classList.remove("state-morning", "state-day", "state-night", "party-celebrate");

  if (state === "morning") {
    body.classList.add("state-morning");
  } else if (state === "day") {
    body.classList.add("state-day");
  } else {
    body.classList.add("state-night");
  }
}

// Audio helpers

let audioCtx = null;

function ensureAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!audioCtx) {
    audioCtx = new AudioContext();
  } else if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

// Clock tick during spin

function playTick() {
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  const now = ctx.currentTime;

  osc.type = "square";
  osc.frequency.setValueAtTime(1200, now);

  gain.gain.setValueAtTime(0.03, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.07);
}

function playResultDing(isYes, isNightWindow) {
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const baseTime = ctx.currentTime;
  const firstFreq = isYes ? 880 : 660;
  const secondFreq = isYes ? 1200 : 880;

  [0, 0.18].forEach((offset, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const freq = index === 0 ? firstFreq : secondFreq;

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, baseTime + offset);

    gain.gain.setValueAtTime(0.045, baseTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, baseTime + offset + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(baseTime + offset);
    osc.stop(baseTime + offset + 0.25);
  });
}

// Copy systems

const yesMessages = [
  "Fate says sip the mezcal.",
  "Permission granted. Mezcal time.",
  "You already poured it in your mind.",
  "Yes. Make it a good one.",
  "Absolutely. Mezcal and good decisions only."
];

const morningNoMessages = [
  "You knew this was going to be a no.",
  "Look at the time. You knew.",
  "Nice try. Not before breakfast.",
  "Respect yourself. Have something sensible.",
  "Be honest. You opened this for a laugh."
];

const daytimeNoMessages = [
  "Not yet. Future you will thank you.",
  "Hold your horses. Mezcal has office hours.",
  "Consider this a friendly intervention.",
  "If you have to ask right now, the answer is no.",
  "Bank this restraint for later."
];

const lateNightMessages = [
  "Nothing good happens after 10 pm.",
  "Night mode activated. Mezcal denied.",
  "Put the mezcal down and walk away.",
  "If you are opening this now, the answer was always no.",
  "Late night choices are rarely elite.",
  "Tomorrow will thank you for this one.",
  "Respect the night. Save the mezcal for daylight."
];

function pickRandom(arr) {
  if (!arr || arr.length === 0) return "";
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

function getSuggestion(isYes) {
  const { hour } = getSydneyTimeInfo();

  if (isYes) {
    return {
      main: "Have a mezcal.",
      sub: pickRandom(yesMessages)
    };
  }

  const inLateOrEarly = isLateOrEarly();

  if (inLateOrEarly) {
    if (hour < 9) {
      const suggestionMain = Math.random() < 0.5 ? "Have a coffee." : "Have a water.";
      return {
        main: suggestionMain,
        sub: pickRandom(lateNightMessages)
      };
    }
    return {
      main: "Have a water.",
      sub: pickRandom(lateNightMessages)
    };
  }

  if (hour < 9) {
    const suggestionMain = Math.random() < 0.5 ? "Have a coffee." : "Have a water.";
    return {
      main: suggestionMain,
      sub: pickRandom(morningNoMessages)
    };
  }

  return {
    main: "Have a water.",
    sub: pickRandom(daytimeNoMessages)
  };
}

// Spin logic

function spinWheel() {
  const resultWheel = document.getElementById("resultWheel");
  const drinkMain = document.getElementById("drinkMain");
  const drinkSub = document.getElementById("drinkSub");
  const button = document.getElementById("spinButton");
  const drinkBox = document.getElementById("drinkBox");

  if (!resultWheel || !drinkMain || !drinkSub || !button || !drinkBox) return;

  if (button.classList.contains("disabled")) {
    return;
  }

  ensureAudioContext();

  button.classList.add("disabled");
  button.textContent = "Consulting the mezcal gods...";

  document.body.classList.remove("party-celebrate");
  drinkBox.classList.remove("wiggle", "highlight");

  resultWheel.classList.add("spinning");
  drinkBox.classList.add("spinning");

  const flickerValues = ["YES", "NO", "···"];
  let flickerIndex = 0;

  const flickerInterval = setInterval(() => {
    // Values spin but are fully blurred in CSS
    resultWheel.textContent = flickerValues[flickerIndex % flickerValues.length];
    drinkMain.textContent = "Thinking...";
    drinkSub.textContent = "";
    flickerIndex += 1;
  }, 120);

  const tickInterval = setInterval(() => {
    playTick();
  }, 220);

  const spinDuration = 4800;

  const mezcalWindow = isMezcalWindow();
  const lateOrEarly = isLateOrEarly();

  setTimeout(() => {
    clearInterval(flickerInterval);
    clearInterval(tickInterval);

    resultWheel.classList.remove("spinning");
    drinkBox.classList.remove("spinning");

    button.classList.remove("disabled");
    button.textContent = "Tap to reveal the answer";

    let isYes;
    if (mezcalWindow) {
      isYes = Math.random() < 0.5;
    } else {
      isYes = false;
    }

    const resultText = isYes ? "YES" : "NO";
    const suggestion = getSuggestion(isYes);

    resultWheel.textContent = resultText;
    drinkMain.textContent = suggestion.main;
    drinkSub.textContent = suggestion.sub;

    applyVisualState();

    if (isYes && mezcalWindow) {
      document.body.classList.add("party-celebrate");
      drinkBox.classList.add("highlight");
    } else {
      drinkBox.classList.add("wiggle");
    }

    playResultDing(isYes, lateOrEarly);
  }, spinDuration);
}

document.addEventListener("DOMContentLoaded", () => {
  applyVisualState();

  const button = document.getElementById("spinButton");
  if (button) {
    button.addEventListener("click", spinWheel);
  }
});
