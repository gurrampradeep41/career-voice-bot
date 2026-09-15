import os
import re
from typing import Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq

from dotenv import load_dotenv
load_dotenv()
# ============================================================
# CONFIGURATION & CLIENT
# ============================================================

# Read API key from environment variable (for Render/Cloud) or fallback
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY environment variable is missing. Set it before running.")

groq_client = Groq(api_key=GROQ_API_KEY)

MODEL_NAME = "openai/gpt-oss-120b"

CHAT_MAX_TOKENS = 400
DETAILED_MAX_TOKENS = 800

# ============================================================
# APP SETUP
# ============================================================

app = FastAPI(
    title="Techpathies AI Voice Career Assistant",
    version="2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# COURSE CATALOG
# ============================================================

COURSES = {
    "Data Analytics": {
        "skills": ["Excel", "SQL", "Power BI", "Python", "Statistics", "Data Cleaning", "Data Visualization"],
        "jobs": ["Data Analyst", "Reporting Analyst", "Business Analyst", "BI Analyst"]
    },
    "Data Analytics with GenAI": {
        "skills": ["Excel", "SQL", "Power BI", "Python", "Statistics", "Generative AI", "Prompt Engineering", "AI Automation"],
        "jobs": ["Data Analyst", "AI Data Analyst", "Business Analyst", "Analytics Consultant"]
    },
    "AI Engineer": {
        "skills": ["Python", "Machine Learning", "Deep Learning", "APIs", "LLMs", "GenAI", "Deployment"],
        "jobs": ["AI Engineer", "ML Engineer", "AI Developer"]
    },
    "AI & ML Engineer": {
        "skills": ["Python", "Statistics", "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "MLOps"],
        "jobs": ["ML Engineer", "AI Engineer", "Machine Learning Developer"]
    },
    "Generative AI Engineer": {
        "skills": ["Python", "LLMs", "Prompt Engineering", "RAG", "Vector Databases", "LangChain", "APIs"],
        "jobs": ["Generative AI Engineer", "LLM Engineer", "AI Engineer"]
    },
    "Agentic AI Developer": {
        "skills": ["Python", "LLMs", "Prompt Engineering", "AI Agents", "Tool Calling", "RAG", "APIs", "Automation"],
        "jobs": ["Agentic AI Developer", "AI Automation Developer", "AI Engineer"]
    },
    "Data Scientist": {
        "skills": ["Python", "SQL", "Statistics", "Machine Learning", "Pandas", "NumPy", "Data Visualization"],
        "jobs": ["Data Scientist", "ML Analyst", "Junior Data Scientist"]
    },
    "Business Analyst": {
        "skills": ["Excel", "SQL", "Power BI", "Business Communication", "Requirements Analysis", "Documentation"],
        "jobs": ["Business Analyst", "Business Intelligence Analyst", "Product Analyst"]
    },
    "Full Stack": {
        "skills": ["HTML", "CSS", "JavaScript", "React", "Python", "FastAPI", "SQL", "Git"],
        "jobs": ["Full Stack Developer", "Web Developer", "Software Developer"]
    },
    "DevOps": {
        "skills": ["Linux", "Git", "Docker", "Kubernetes", "CI/CD", "AWS", "Jenkins"],
        "jobs": ["DevOps Engineer", "Cloud DevOps Engineer"]
    },
    "Cloud": {
        "skills": ["Cloud Basics", "AWS", "Azure", "Linux", "Networking", "Docker"],
        "jobs": ["Cloud Engineer", "Cloud Support Engineer"]
    }
}

# ============================================================
# REQUEST SCHEMAS
# ============================================================

class ChatRequest(BaseModel):
    message: str
    student_name: Optional[str] = ""
    course: Optional[str] = ""

class CareerRequest(BaseModel):
    career: str

class CompareRequest(BaseModel):
    career1: str
    career2: str

# ============================================================
# HELPERS
# ============================================================

def clean_response(text: str) -> str:
    if not text:
        return "Sorry, I could not generate a response."
    # Strip markdown headers or symbols that sound awkward in TTS
    text = re.sub(r"[\*\_#`]", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

def ask_groq(prompt: str, max_tokens: int = CHAT_MAX_TOKENS) -> str:
    system_prompt = (
        "You are Techpathies AI Career Assistant.\n"
        "Rules for responses:\n"
        "1. Keep answers concise, clear, and direct.\n"
        "2. Use 4 to 6 short numbered points.\n"
        "3. Keep each sentence conversational and optimized for voice speech synthesis.\n"
        "4. Avoid markdown styling like asterisks, bold, or complex tables.\n"
        "5. Do not include internal thought processes or meta commentary."
    )
    try:
        completion = groq_client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=max_tokens,
            top_p=0.8
        )
        return clean_response(completion.choices[0].message.content)
    except Exception as e:
        print("Groq API Error:", e)
        return "Sorry, I could not generate an answer right now. Please try again."

def find_course(name: str):
    if not name:
        return None
    name_lower = name.lower().strip()
    for course in COURSES:
        if course.lower() == name_lower or name_lower in course.lower():
            return course
    return None

def course_text(course_name: str) -> str:
    course = find_course(course_name)
    if not course:
        return "Course not found. We offer Data Analytics, AI Engineering, GenAI, Full Stack, and Cloud."
    data = COURSES[course]
    skills = ", ".join(data["skills"])
    jobs = ", ".join(data["jobs"])
    return f"For {course}, the key skills are: {skills}. Career opportunities include: {jobs}."

# ============================================================
# ROUTES
# ============================================================

@app.get("/")
def home():
    return {"message": "Techpathies AI Career Assistant is running", "model": MODEL_NAME}

@app.get("/health")
def health():
    return {"fastapi": "online", "model": MODEL_NAME}

@app.post("/chat")
def chat(request: ChatRequest):
    message = request.message.strip()
    if not message:
        return {"response": "Please speak or type a question.", "reply": "Please speak or type a question."}

    lower = message.lower()

    if lower in ["stop", "stop listening", "stop speaking", "quiet"]:
        return {"response": "Okay, I will stop.", "reply": "Okay, I will stop."}

    if lower in ["hi", "hello", "hey", "good morning", "good evening"]:
        ans = "Hello! I am Techpathies AI Career Assistant. Ask me about careers, roadmaps, skills, or job preparation."
        return {"response": ans, "reply": ans}

    # Direct course match
    detected = None
    for c in COURSES:
        if c.lower() in lower:
            detected = c
            break

    if detected and any(k in lower for k in ["skill", "skills", "learn", "requirement"]):
        ans = course_text(detected)
        return {"response": ans, "reply": ans}

    prompt = f"Student: {request.student_name or 'Learner'}\nQuestion: {message}\nProvide practical, job-focused career guidance in short spoken points."
    answer = ask_groq(prompt, CHAT_MAX_TOKENS)
    return {"response": answer, "reply": answer}

@app.post("/get-career-guidance")
def career_guidance(request: CareerRequest):
    prompt = f"Explain career opportunities for {request.career}. Cover key responsibilities, entry difficulty, and recommended projects."
    ans = ask_groq(prompt, DETAILED_MAX_TOKENS)
    return {"response": ans, "reply": ans}

@app.post("/compare-careers")
def compare_careers(request: CompareRequest):
    prompt = f"Compare {request.career1} and {request.career2}. Detail learning difficulty, programming requirements, and fresher job demand."
    ans = ask_groq(prompt, DETAILED_MAX_TOKENS)
    return {"response": ans, "reply": ans}

@app.post("/get-career-roadmap")
def career_roadmap(request: CareerRequest):
    prompt = f"Create a practical roadmap for a beginner wanting to become a {request.career}. Number each stage clearly."
    ans = ask_groq(prompt, DETAILED_MAX_TOKENS)
    return {"response": ans, "reply": ans}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)