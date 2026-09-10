// ============================================================
// CONFIGURATION
// Replace with your live Render backend URL when deployed!
// ============================================================
const BACKEND_URL = "https://career-voice-bot.onrender.com/"; 
// Example after deploying to Render: "https://your-app-name.onrender.com"

// ============================================================
// DOM ELEMENTS
// ============================================================
const micButton = document.getElementById("micButton");
const statusText = document.getElementById("status");
const userText = document.getElementById("userText");
const aiText = document.getElementById("aiText");

// ============================================================
// STATE VARIABLES
// ============================================================
let recognition = null;
let isListening = false;
let isSpeaking = false;
let isProcessing = false;
let autoListen = true;
let isStopped = false;

// ============================================================
// SPEECH RECOGNITION (STT)
// ============================================================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
    statusText.textContent = "Speech recognition is not supported in this browser. Please use Chrome or Edge.";
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
        statusText.textContent = "Listening...";
    };

    recognition.onend = function() {
        isListening = false;
        updateMicUI(false);
        if (!isSpeaking && !isProcessing && !isStopped) {
            statusText.textContent = "Ready";
        }
    };

    recognition.onerror = function(event) {
        console.error("Speech recognition error:", event.error);
        isListening = false;
        updateMicUI(false);

        if (event.error === "not-allowed") {
            statusText.textContent = "Microphone access denied. Please enable mic permissions.";
            autoListen = false;
        } else if (!isSpeaking && !isProcessing) {
            statusText.textContent = "Ready";
        }
    };
}

// ============================================================
// MIC CONTROL
// ============================================================
micButton.addEventListener("click", function() {
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
    } catch (error) {
        console.warn("Recognition start error:", error);
    }
}

function stopListening() {
    if (!recognition) return;
    try {
        recognition.stop();
    } catch (error) {
        console.warn(error);
    }
    isListening = false;
    updateMicUI(false);
    statusText.textContent = "Microphone paused.";
}

// ============================================================
// SEND MESSAGE TO BACKEND
// ============================================================
async function sendVoiceMessage(message) {
    isProcessing = true;
    statusText.textContent = "Thinking...";
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
            throw new Error(`Server returned status: ${response.status}`);
        }

        const data = await response.json();
        const aiResponse = data.reply || data.response || "Sorry, I could not generate a response.";

        aiText.textContent = aiResponse;
        isProcessing = false;
        speakResponse(aiResponse);

    } catch (error) {
        console.error("Backend request failed:", error);
        isProcessing = false;
        const errorMessage = "Could not connect to the AI server. Check your connection or deployment.";
        aiText.textContent = errorMessage;
        statusText.textContent = "Connection error.";
        speakResponse(errorMessage);
    }
}

// ============================================================
// TEXT TO SPEECH (TTS)
// ============================================================
function speakResponse(text) {
    if (!window.speechSynthesis) {
        isSpeaking = false;
        restartListening();
        return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = function() {
        isSpeaking = true;
        statusText.textContent = "Speaking...";
    };

    utterance.onend = function() {
        isSpeaking = false;
        statusText.textContent = "Ready";
        restartListening();
    };

    utterance.onerror = function(err) {
        console.error("SpeechSynthesis error:", err);
        isSpeaking = false;
        statusText.textContent = "Ready";
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
// CONTROLS & UI
// ============================================================
function stopAudio() {
    autoListen = false;
    isStopped = true;
    isSpeaking = false;
    isProcessing = false;

    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    stopListening();
    statusText.textContent = "Stopped.";
}

function restartAudio() {
    autoListen = true;
    isStopped = false;
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    isSpeaking = false;
    isProcessing = false;
    statusText.textContent = "Ready";
    setTimeout(startVoice, 400);
}

function continueConversation() {
    autoListen = true;
    isStopped = false;
    if (!isSpeaking && !isProcessing) {
        setTimeout(startVoice, 300);
    }
}

function updateMicUI(listening) {
    if (listening) {
        micButton.classList.add("listening");
        micButton.innerHTML = "🎙️";
    } else {
        micButton.classList.remove("listening");
        micButton.innerHTML = "🎤";
    }
}

window.stopAudio = stopAudio;
window.restartAudio = restartAudio;
window.continueConversation = continueConversation;

window.addEventListener("load", () => {
    statusText.textContent = "Ready";
});