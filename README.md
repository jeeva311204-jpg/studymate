# 🎓 StudyMate — AI Study Companion for Students

StudyMate is a modern full-stack web application designed to help students master course materials faster and prepare for exams with confidence. Powered by **Google Gemini API**, StudyMate transforms unstructured notes (PDF, TXT, or pasted text) into actionable study aids: high-yield bullet summaries, interactive 10-question multiple-choice quizzes, 15 flippable 3D flashcards, and personalized day-by-day exam roadmaps.

---

## 🚀 Key Features

1. **🔐 Authentication & User Profiles**
   - Secure registration, login, and session persistence using JWT (JSON Web Tokens) and bcrypt password hashing.
   - One-click Demo Student login for quick evaluation without setup hassle.

2. **📄 Notes Upload & AI Summarizer**
   - Upload course materials as **PDF** or **Plain Text (.txt)**, or paste raw lecture notes.
   - Automated text extraction on the backend via `pdf-parse` with memory buffering.
   - Generates structured, high-yield bullet summaries broken down into:
     - 📌 *Core Summary & Big Picture*
     - 🔑 *Key Concepts & Definitions*
     - 💡 *Critical Takeaways & Exam Tips*
   - Copy to clipboard, inspect original notes, or regenerate summary anytime.

3. **🎯 10-Question AI Quiz Arena**
   - Generates exactly 10 multiple-choice questions (MCQs) from your notes in strict JSON format.
   - **One Question at a Time**: Smooth question card transitions with real-time progress tracking.
   - **Instant Scoring & Explanation**: Immediate visual feedback highlighting correct/incorrect options with educational rationale.
   - **Comprehensive Results Page**: Accuracy percentage score, confetti celebration for high scores (≥ 70%), and full question review accordion.

4. **🃏 15 3D Flippable Flashcards**
   - Generates 15 active-recall flashcards with term/concept on the front and detailed definition on the back.
   - **Smooth 3D Flip Animation**: CSS 3D perspective transforms (`preserve-3d`, `rotateY(180deg)`).
   - **Intuitive Controls**: Flip card, Previous/Next navigation, Shuffle deck, and "Mark as Mastered" tracker.
   - **Keyboard Navigation**: Press **Spacebar** to flip, **Arrow Right** for next, and **Arrow Left** for previous.

5. **📅 AI Study Planner**
   - Enter your target exam date and daily study availability (hours per day).
   - Gemini calculates the days remaining and generates a realistic day-by-day roadmap with specific daily topics, actionable tasks, estimated study minutes, and cognitive learning tips.
   - Interactive task checklists: toggle tasks on/off in real-time with automatic progress tracking saved to MongoDB.

6. **📊 Student Dashboard & Score Trend Analytics**
   - Overview metrics: Saved Notes, Total Quizzes Taken, Average Score, and Active Study Plans.
   - **Visual Performance Chart**: Interactive SVG score trend chart displaying quiz accuracy across chronological sessions.
   - Quick access to recent notes, past quiz scores, and one-click study tool shortcuts.
   - **Dark / Light Theme Toggle**: Persistent aesthetic dark and light mode built with Tailwind CSS.

---

## 🛠️ Tech Stack

* **Frontend**:
  * React 18 (Vite)
  * Tailwind CSS v3.4 (with custom typography, 3D flip card utilities, and dark mode class strategy)
  * Lucide React (modern feather icons)
  * React Router v7
  * Axios (with JWT interceptors)
  * Canvas Confetti (delightful celebratory animations)
  * React Markdown (structured summary rendering)

* **Backend**:
  * Node.js & Express
  * Multer (multipart file handling for PDF & TXT)
  * `pdf-parse` (PDF text extraction)
  * MongoDB & Mongoose (with automated in-memory MongoDB fallback so the app works out-of-the-box!)
  * JSON Web Tokens (`jsonwebtoken`) & `bcryptjs`
  * `@google/generative-ai` (Google Gemini SDK)
  * Strict JSON Schema Validator with **1-attempt automatic corrective retry**

---

## 📁 Folder Structure

```
maha/
├── package.json              # Root package with multi-service commands
├── README.md                 # Project documentation
├── .env.example              # Root environment template
├── server/
│   ├── package.json          # Server dependencies
│   ├── .env.example          # Server environment template
│   ├── .env                  # Server local environment configuration
│   └── src/
│       ├── config/
│       │   ├── db.js         # MongoDB connection with in-memory fallback
│       │   └── gemini.js     # Google Gemini API client
│       ├── controllers/
│       │   ├── authController.js       # Register, login, profile
│       │   ├── noteController.js       # Notes upload, text extraction, summary
│       │   ├── quizController.js       # 10 MCQ generator, validation & scoring
│       │   ├── flashcardController.js  # 15 3D flashcards generator
│       │   ├── plannerController.js    # Day-by-day exam roadmap generator
│       │   └── dashboardController.js  # Metrics & progress analytics
│       ├── middleware/
│       │   ├── auth.js       # JWT bearer token verification
│       │   └── upload.js     # Multer file upload filter for .pdf & .txt
│       ├── models/
│       │   ├── User.js       # Student credentials & passwords
│       │   ├── Note.js       # Note text, summary & flashcard storage
│       │   ├── QuizResult.js # Past test results, scores & answers
│       │   └── StudyPlan.js  # Day-by-day schedules & task status
│       ├── routes/
│       │   ├── authRoutes.js
│       │   ├── noteRoutes.js
│       │   ├── quizRoutes.js
│       │   ├── flashcardRoutes.js
│       │   ├── plannerRoutes.js
│       │   └── dashboardRoutes.js
│       ├── utils/
│       │   ├── aiValidator.js    # JSON schema validator + 1-attempt retry
│       │   └── textExtractor.js  # Clean text extraction for PDF and TXT
│       └── index.js          # Express app bootstrap
└── client/
    ├── package.json          # Client dependencies
    ├── vite.config.js        # Vite config with API proxy
    ├── tailwind.config.js    # Tailwind configuration with dark mode
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── context/
        │   ├── AuthContext.jsx   # Authentication state & JWT handling
        │   └── ThemeContext.jsx  # Dark/Light mode toggle & persistence
        ├── services/
        │   └── api.js            # Axios client with auth interceptors
        ├── components/
        │   ├── common/
        │   │   └── ThemeToggle.jsx     # Sun/Moon switcher
        │   ├── layout/
        │   │   ├── Navbar.jsx          # Responsive header & mobile drawer
        │   │   └── ProtectedRoute.jsx  # Route guard
        │   ├── notes/
        │   │   ├── NoteUploader.jsx    # File drag & drop + paste editor
        │   │   └── SummaryViewer.jsx   # Markdown summary viewer
        │   ├── quiz/
        │   │   ├── QuizCard.jsx        # One-question card with instant feedback
        │   │   └── QuizResults.jsx     # Score circle, confetti, question review
        │   ├── flashcards/
        │   │   └── FlashcardDeck.jsx   # 3D interactive flip card deck
        │   └── planner/
        │       └── PlanTimeline.jsx    # Timeline milestone checklist
        ├── pages/
        │   ├── LoginPage.jsx     # Sign in + One-Click Demo Student
        │   ├── RegisterPage.jsx  # Account registration
        │   ├── DashboardPage.jsx # Metrics, SVG chart & quick links
        │   ├── NotesPage.jsx     # Library, upload & summary view
        │   ├── QuizPage.jsx      # Quiz setup, test session & results
        │   ├── FlashcardsPage.jsx# 15-card deck study arena
        │   └── PlannerPage.jsx   # Exam plan generation & tracking
        ├── App.jsx               # Client routes & providers
        ├── main.jsx              # React DOM entry
        └── index.css             # Tailwind base & 3D card flip styles
```

---

## ⚡ Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v24)
- **npm**: v9+
- (Optional) Local MongoDB or MongoDB Atlas URI (if not provided, an in-memory database will automatically initialize).
- (Optional) **Gemini API Key**: Obtain a free API key from [Google AI Studio](https://aistudio.google.com/).

### 2. Configure Environment Variables

Edit `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/studymate
JWT_SECRET=your_secret_key_studymate_2026
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

(Optional) Edit `client/.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

> **Note on Gemini Key**: A valid `GEMINI_API_KEY` is required for generating AI summaries, quizzes, flashcards, and study plans. If unconfigured or unavailable, a clear 503 error message is returned and shown directly in the UI.

### 3. Run the Backend Server
```bash
cd server
npm run dev
```
The server will start on `http://localhost:5000`.

### 4. Run the Frontend Client
In a new terminal:
```bash
cd client
npm run dev
```
The frontend application will be live at `http://localhost:5173/`.

### 5. Running Both from Root
Alternatively, from the project root:
```bash
# Terminal 1:
npm run server

# Terminal 2:
npm run client
```

---

## 🧪 Validating Features

1. **Authentication**: Open `http://localhost:5173/`. Click **One-Click Demo Student Login** on the login page to immediately sign in as `Alex Morgan`.
2. **Notes & Summary**: Go to **Notes & Summary** in the navbar. Upload a PDF or paste text (e.g., biology or machine learning notes). Click **Generate AI Summary** to view the bullet points.
3. **10-MCQ Quiz**: From the note summary or the **Quiz Arena** page, select a note and click **Generate & Start 10-Question Quiz**. Answer each question, observe the instant feedback and explanation, and view the final results with confetti!
4. **15 3D Flashcards**: Navigate to **Flashcards**, choose your note, and click **Generate 15 Flashcards**. Click on the card or press `Space` to see the 3D flip animation. Press `Arrow Right` for the next card.
5. **Study Planner**: Go to **Study Planner**, set your exam date and daily study availability (e.g. 2 hours/day), and generate your day-by-day roadmap. Check off tasks to see real-time progress updates.
6. **Dashboard**: Return to **Dashboard** to see all updated metrics and the SVG score trend chart. Toggle between Dark and Light mode using the sun/moon icon in the navbar.

---

## 🛡️ AI Robustness & Validation

- All Gemini API prompts for Quizzes, Flashcards, and Study Plans strictly enforce JSON output mode.
- Output is validated against predefined schemas (e.g. exactly 10 questions with 4 options and valid `correctAnswer`; exactly 15 flashcards with front and back; day-by-day structured schedules).
- If validation fails or malformed JSON is returned, the engine triggers **1 automatic corrective retry** with targeted feedback before returning an error to the user.

---

## 🚀 Deployment

### Server Deployment (Render, Railway, Heroku, VPS)
- **Node.js Runtime**: Requires Node.js `>=20` (specified in `server/package.json` engines).
- **Build & Start Commands**:
  - Install dependencies: `npm install`
  - Start server: `npm start`
- **Environment Variables (Server)**:
  | Variable | Required | Description | Example / Default |
  |---|---|---|---|
  | `PORT` | Optional | Port for the Express backend API server | `5000` |
  | `NODE_ENV` | Recommended | Environment mode (`development` or `production`) | `production` |
  | `MONGODB_URI` | Required in prod | MongoDB connection string (local or MongoDB Atlas SRV) | `mongodb+srv://user:pass@cluster.mongodb.net/studymate` |
  | `JWT_SECRET` | Required | Secret key used to sign and verify student JWT authentication tokens | `your_strong_jwt_secret_here` |
  | `GEMINI_API_KEY` | Required for AI | Google Gemini API key from Google AI Studio | `AIzaSy...` |
  | `GEMINI_MODEL` | Optional | Google Gemini model identifier | `gemini-3.5-flash-lite` |
  | `GEMINI_IMAGE_MODEL` | Optional | Gemini image generation model identifier (e.g. `gemini-3.1-flash-lite-image`). Set only after testing access on your key. | (empty) |
  | `MAX_NOTE_CHARACTERS` | Optional | Maximum character length for AI processing | `100000` |
  | `CLIENT_URL` | Required in prod | Allowed frontend URL for CORS origin checking (comma-separated for multiple origins) | `https://studymate.vercel.app` |

### Client Deployment (Vercel)
- **Framework**: Vite / React Single Page Application (SPA).
- **Vercel Routing**: Configured via `client/vercel.json` with a wildcard route rewrite to `/index.html` to support client-side routing across all routes (`/notes`, `/quiz`, `/flashcards`, `/planner`, `/questions`, `/login`, `/register`).
- **Build Settings**:
  - Build command: `npm run build`
  - Output directory: `dist`
- **Environment Variables (Client)**:
  | Variable | Required | Description | Example / Default |
  |---|---|---|---|
  | `VITE_API_URL` | Required in prod | Backend base API URL endpoint | `https://your-api.onrender.com/api` |

