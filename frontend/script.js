// ============================================================
// CONFIGURATION
// Keep your live backend link
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

// ============================================================
// SPEECH RECOGNITION (STT)
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
        console.error("Speech Recognition Error:", event.error);
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
// MIC CONTROLS
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
    } catch (e) {
        console.warn(e);
    }
}

function stopListening() {
    if (!recognition) return;
    try {
        recognition.stop();
    } catch (e) {
        console.warn(e);
    }
    isListening = false;
    updateMicUI(false);
    setStatus("Microphone paused", false);
}

// ============================================================
// BACKEND API REQUEST
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
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        const aiResponse = data.reply || data.response || "Sorry, I could not generate a response.";

        aiText.textContent = aiResponse;
        isProcessing = false;
        speakResponse(aiResponse);

    } catch (error) {
        console.error("Backend Error:", error);
        isProcessing = false;
        const errorMessage = "Could not reach the AI server. If using free hosting, please allow 30 seconds for it to wake up.";
        aiText.textContent = errorMessage;
        setStatus("Connection issue", false);
        speakResponse(errorMessage);
    }
}

// ============================================================
// SPEECH SYNTHESIS (TTS)
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

    utterance.onstart = function() {
        isSpeaking = true;
        setStatus("Speaking...", false);
    };

    utterance.onend = function() {
        isSpeaking = false;
        setStatus("Ready", false);
        restartListening();
    };

    utterance.onerror = function() {
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
// HELPER ACTIONS
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
    setStatus("Stopped", false);
}

function restartAudio() {
    autoListen = true;
    isStopped = false;
    if (window.speechSynthesis) {
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