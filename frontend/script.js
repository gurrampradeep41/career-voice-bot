// ============================================================
// CONFIGURATION
// ============================================================
const BACKEND_URL = "https://career-voice-bot.onrender.com";

// ============================================================
// DOM ELEMENTS
// ============================================================
const micButton = document.getElementById("micButton");
const statusContainer = document.getElementById("status");
const statusLabel = document.getElementById("statusLabel");
const userText = document.getElementById("userText");
const aiText = document.getElementById("aiText");

// ============================================================
// STATE
// ============================================================
let recognition = null;
let isListening = false;
let isSpeaking = false;
let isProcessing = false;
let autoListen = true;
let isStopped = false;
let availableVoices = [];

// ============================================================
// VOICE PRELOADING & AUDIO UNLOCK
// ============================================================
function loadSystemVoices() {
    if ("speechSynthesis" in window) {
        availableVoices = window.speechSynthesis.getVoices();
    }
}

// Pre-populate system voices as soon as the browser exposes them
loadSystemVoices();
if ("speechSynthesis" in window && window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadSystemVoices;
}

// Mobile Audio Context Unlock: 
// Browsers require a user interaction to prime speech synthesis
function unlockBrowserAudio() {
    if ("speechSynthesis" in window) {
        window.speechSynthesis.resume();
        const silentUtterance = new SpeechSynthesisUtterance("");
        silentUtterance.volume = 0;
        window.speechSynthesis.speak(silentUtterance);
    }
}

// ============================================================
// SPEECH RECOGNITION (STT) SETUP
// ============================================================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
    statusLabel.textContent = "Browser not supported. Use Chrome or Edge.";
    micButton.disabled = true;
} else {
    recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = function(event) {
        const text = event.results[0][0].transcript.trim();
        if (!text) return;
        userText.textContent = text;
        sendVoiceMessage(text);
    };

    recognition.onstart = function() {
        isListening = true;
        updateMicUI(true);
        setStatus("Listening...", true);
    };

    recognition.onend = function() {
        isListening = false;
        updateMicUI(false);
        if (!isSpeaking && !isProcessing && !isStopped) {
            setStatus("Ready", false);
        }
    };

    recognition.onerror = function(event) {
        console.warn("Speech Recognition notice:", event.error);
        isListening = false;
        updateMicUI(false);

        if (event.error === "not-allowed") {
            setStatus("Microphone permission denied", false);
            autoListen = false;
        } else if (!isSpeaking && !isProcessing) {
            setStatus("Ready", false);
        }
    };
}

// ============================================================
// MICROPHONE TRIGGER
// ============================================================
micButton.addEventListener("click", function() {
    unlockBrowserAudio(); // Primes the audio engine on user click

    if (isListening) {
        stopListening();
        return;
    }
    autoListen = true;
    isStopped = false;
    startVoice();
});

function startVoice() {
    if (!recognition || isListening || isSpeaking || isProcessing || isStopped) return;
    try {
        recognition.start();
    } catch (e) {
        console.warn(e);
    }
}

function stopListening() {
    if (!recognition) return;
    try {
        recognition.stop();
    } catch (e) {}
    isListening = false;
    updateMicUI(false);
    setStatus("Microphone paused", false);
}

// ============================================================
// BACKEND COMMUNICATION
// ============================================================
async function sendVoiceMessage(message) {
    isProcessing = true;
    setStatus("Thinking...", false);
    updateMicUI(false);

    try {
        const response = await fetch(`${BACKEND_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: message,
                student_name: "",
                course: ""
            })
        });

        if (!response.ok) {
            throw new Error(`Server returned status ${response.status}`);
        }

        const data = await response.json();
        const aiResponse = data.reply || data.response || "Sorry, I could not generate an answer.";

        aiText.textContent = aiResponse;
        isProcessing = false;
        speakResponse(aiResponse);

    } catch (error) {
        console.error("Backend Error:", error);
        isProcessing = false;
        const errorMessage = "Server is waking up. Please allow 30 seconds and try speaking again.";
        aiText.textContent = errorMessage;
        setStatus("Ready", false);
        speakResponse(errorMessage);
    }
}

// ============================================================
// SPEECH SYNTHESIS (TTS) - CROSS-DEVICE ENGINE
// ============================================================
function speakResponse(text) {
    if (!("speechSynthesis" in window)) {
        isSpeaking = false;
        restartListening();
        return;
    }

    // Cancel pending utterances and resume engine if suspended
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();

    const utterance = new SpeechSynthesisUtterance(text);

    // Refresh voices if list was unpopulated earlier
    if (availableVoices.length === 0) {
        availableVoices = window.speechSynthesis.getVoices();
    }

    // Find the best matching English voice on the user's specific platform
    const selectedVoice = availableVoices.find(v => v.lang === "en-IN") ||
                          availableVoices.find(v => v.lang === "en-US") ||
                          availableVoices.find(v => v.lang === "en-GB") ||
                          availableVoices.find(v => v.lang.toLowerCase().includes("en")) ||
                          null;

    if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
    } else {
        utterance.lang = "en-US";
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = function() {
        isSpeaking = true;
        setStatus("Speaking...", false);
    };

    utterance.onend = function() {
        isSpeaking = false;
        setStatus("Ready", false);
        restartListening();
    };

    utterance.onerror = function(event) {
        console.error("Audio Playback Error:", event);
        isSpeaking = false;
        setStatus("Ready", false);
        restartListening();
    };

    window.speechSynthesis.speak(utterance);
}

function restartListening() {
    if (!autoListen || isStopped || isProcessing) return;
    setTimeout(() => {
        startVoice();
    }, 600);
}

// ============================================================
// CONTROL ACTIONS
// ============================================================
function stopAudio() {
    autoListen = false;
    isStopped = true;
    isSpeaking = false;
    isProcessing = false;

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }
    stopListening();
    setStatus("Stopped", false);
}

function restartAudio() {
    autoListen = true;
    isStopped = false;

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }
    isSpeaking = false;
    isProcessing = false;
    setStatus("Ready", false);
    setTimeout(startVoice, 400);
}

function continueConversation() {
    autoListen = true;
    isStopped = false;
    if (!isSpeaking && !isProcessing) {
        setTimeout(startVoice, 300);
    }
}

// ============================================================
// UI HELPERS
// ============================================================
function setStatus(text, isLive) {
    statusLabel.textContent = text;
    if (isLive) {
        statusContainer.classList.add("listening");
    } else {
        statusContainer.classList.remove("listening");
    }
}

function updateMicUI(listening) {
    if (listening) {
        micButton.classList.add("listening");
    } else {
        micButton.classList.remove("listening");
    }
}

window.stopAudio = stopAudio;
window.restartAudio = restartAudio;
window.continueConversation = continueConversation;