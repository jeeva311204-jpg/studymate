# 🎓 StudyMate — AI Study Companion for Students

StudyMate is a modern full-stack web application designed to help students master course materials faster and prepare for exams with confidence. Powered by **Google Gemini** and **Cloudflare Workers AI**, StudyMate transforms unstructured notes (PDF, TXT, or pasted text) into actionable study aids: high-yield bullet summaries, interactive 10-question multiple-choice quizzes, 15 flippable 3D flashcards, personalized day-by-day exam roadmaps, and an intelligent academic tutor with vector diagrams and image generation.

---

## 🚀 Key Features

### 1. 🤖 Ask AI — Academic Assistant & Visual Diagram Arena
- **Multimodal Student Inquiry**: Ask study questions with optional note references (up to 8,000 characters) or attached lecture images (PNG, JPEG, WebP with magic-byte verification).
- **Academic Answering Modes**:
  - ❓ **Doubt Resolution (`doubt`)**: Step-by-step academic explanation resolving tricky concepts, followed by an illustrative example.
  - 📝 **2-Mark Answer (`mark2`)**: Exam-style 2-mark answer written strictly in 2 to 3 concise, high-yield sentences.
  - 📋 **8-Mark Structured Answer (`mark8`)**: Structured exam answer (250–350 words) with clear headings and bulleted key points.
  - 📚 **16-Mark Comprehensive Essay (`mark16`)**: University essay (500–700 words) with Introduction, Conceptual Headings, Diagram Description, and Conclusion.
  - ⚡ **Fast Revision Notes (`short_notes`)**: Rapid-recall bullet points optimized for last-minute exam prep.
  - 💡 **Simple Analogies (`simple`)**: Beginner-friendly explanation using intuitive real-world metaphors.
  - 🎯 **Smart Auto-Routing (`auto`)**: Automatically analyzes the question to choose the optimal mode, routing diagram requests to SVG and explicit imperative generation requests to Image.
  - 📐 **Diagram (SVG) Mode (`svg`)**: Generates clean, self-contained SVG vector diagrams with dark/light theme contrast.
  - 🎨 **Image Generation Mode (`image`)**: Generates scientific and educational illustrations via Cloudflare Flux Schnell or Gemini.
- **Robust Fallback & Quota Protection**:
  - Per-user daily cap of 40 asks and 5 generated images (tracked in Asia/Kolkata timezone).
  - Configurable global daily image cap (`IMAGE_DAILY_GLOBAL_CAP`, default: 100).
  - If image generation fails, is unconfigured, hits rate limits, or is blocked by safety filters, the reserved slot is automatically refunded and the assistant gracefully falls back to an SVG diagram.
- **Enterprise-Grade SVG Sanitization**:
  - Strips malicious vectors: `<script>`, `onload` and all `on*` event handlers, `<foreignObject>`, `<iframe>`, `javascript:` URLs, and `<image>`/`<img>` tags.
  - Strips external `url()` references in `style` attributes while preserving local `#id` gradient and marker references.
  - Drops empty `<use>` tags and unwraps attribute-less `<a>` tags.
  - Preserves standard SVG `viewBox` casing and camelCase attributes (`markerWidth`, `markerHeight`, `refX`, `refY`, `gradientUnits`, `gradientTransform`, `preserveAspectRatio`).
- **Conversation History**:
  - Saved multi-turn chat threads (up to 30 conversations per user, 40 messages per thread).
  - Deduplicated message responses with stored SVG size capped at 60 KB per message.

### 2. 🔐 Authentication & User Profiles
- Secure registration, login, and session persistence using JWT (JSON Web Tokens) and bcrypt password hashing.
- One-click Demo Student login for instant evaluation without manual setup.

### 3. 📄 Notes Upload & AI Summarizer
- Upload course materials as **PDF** or **Plain Text (.txt)**, or paste raw lecture notes.
- Backend text extraction via `pdf-parse` with memory buffering.
- Generates structured, high-yield bullet summaries:
  - 📌 *Core Summary & Big Picture*
  - 🔑 *Key Concepts & Definitions*
  - 💡 *Critical Takeaways & Exam Tips*

### 4. 🎯 10-Question AI Quiz Arena
- Generates exactly 10 multiple-choice questions (MCQs) in strict JSON format.
- **One Question at a Time**: Smooth question card transitions with real-time progress tracking.
- **Instant Scoring & Explanation**: Immediate visual feedback highlighting correct/incorrect options with educational rationale.
- **Comprehensive Results Page**: Accuracy percentage score, confetti celebration for high scores (≥ 70%), and full question review accordion.

### 5. 🃏 15 3D Flippable Flashcards
- Generates 15 active-recall flashcards with concept on front and detailed definition on back.
- **Smooth 3D Flip Animation**: CSS 3D perspective transforms (`preserve-3d`, `rotateY(180deg)`).
- **Controls & Accessibility**: Flip card, Previous/Next navigation, Shuffle deck, "Mark as Mastered" tracker, and keyboard shortcuts (`Spacebar`, `Arrow Left`, `Arrow Right`).

### 6. 📅 AI Study Planner
- Enter target exam date and daily study availability (hours per day).
- Generates a day-by-day roadmap with specific daily topics, actionable tasks, estimated study minutes, and cognitive learning tips.
- Interactive task checklists with real-time progress tracking saved to MongoDB.

### 7. 📊 Student Dashboard & Score Trend Analytics
- Overview metrics: Saved Notes, Total Quizzes Taken, Average Score, and Active Study Plans.
- Interactive SVG score trend chart displaying quiz accuracy across chronological sessions.
- Dark and Light mode toggle with persistent theme settings.

---

## 🛠️ Tech Stack

* **Frontend**:
  * React 18 (Vite)
  * Tailwind CSS v3.4 (with custom typography, 3D flip card utilities, and dark mode)
  * Lucide React (modern icons)
  * React Router v7
  * Axios (with JWT auth interceptors)
  * Canvas Confetti (celebratory score animations)
  * React Markdown (structured text and markdown rendering)

* **Backend**:
  * Node.js & Express
  * Multer (multipart file handling for PDF & TXT)
  * `pdf-parse` (PDF text extraction)
  * MongoDB & Mongoose (with automated in-memory MongoDB fallback)
  * JSON Web Tokens (`jsonwebtoken`) & `bcryptjs`
  * `@google/generative-ai` (Google Gemini API)
  * Cloudflare Workers AI REST API (`@cf/black-forest-labs/flux-1-schnell`)
  * `sanitize-html` with custom SVG post-processing rules

---

## 📁 Folder Structure

```
maha/
├── package.json                    # Root scripts for client and server
├── README.md                       # Project documentation
├── server/
│   ├── package.json                # Server dependencies & scripts
│   └── src/
│       ├── config/
│       │   ├── db.js               # MongoDB connection with in-memory fallback
│       │   ├── gemini.js           # Gemini API client with fallback & retry
│       │   └── jwt.js              # JWT configuration & secret management
│       ├── controllers/
│       │   ├── askController.js    # Ask AI: multi-mode, SVG, image, conversations
│       │   ├── authController.js   # User registration, login, profile
│       │   ├── dashboardController.js # Metrics & progress analytics
│       │   ├── flashcardController.js # 15 3D flashcards generator
│       │   ├── noteController.js   # Note upload, extraction, summary
│       │   ├── plannerController.js# Exam roadmap generator
│       │   └── quizController.js   # 10 MCQ generator & scoring
│       ├── middleware/
│       │   ├── auth.js             # JWT bearer verification
│       │   ├── upload.js           # Multer file upload filter for notes
│       │   └── validateObjectId.js # MongoDB ObjectId validator
│       ├── models/
│       │   ├── AskUsage.js         # Per-user daily ask & image usage tracking
│       │   ├── Conversation.js     # Saved chat history (capped at 60KB SVG)
│       │   ├── GlobalImageUsage.js # Global daily image generation counter
│       │   ├── Note.js             # User notes, summaries & flashcard decks
│       │   ├── QuizResult.js       # Quiz submissions, scores & answers
│       │   ├── StudyPlan.js        # Day-by-day study roadmap & milestones
│       │   └── User.js             # User credentials & profile data
│       ├── routes/
│       │   ├── askRoutes.js        # Ask AI endpoints & conversation history
│       │   ├── authRoutes.js       # Auth endpoints
│       │   ├── dashboardRoutes.js  # Dashboard metrics endpoints
│       │   ├── flashcardRoutes.js  # Flashcard endpoints
│       │   ├── noteRoutes.js       # Note management endpoints
│       │   ├── plannerRoutes.js    # Planner endpoints
│       │   └── quizRoutes.js       # Quiz endpoints
│       ├── utils/
│       │   ├── aiValidator.js      # JSON schema validation with 1-attempt retry
│       │   ├── cloudflareImage.js  # Cloudflare Flux-1-schnell REST client
│       │   ├── geminiImage.js      # Gemini Image Generation client
│       │   ├── svgSanitizer.js     # High-security SVG sanitizer & casing preserver
│       │   └── textExtractor.js    # Clean text extraction from PDF & TXT
│       ├── index.js                # Express application bootstrap
│       └── tests/
│           └── api.test.js         # Comprehensive test suite (Node test runner)
└── client/
    ├── package.json                # Client dependencies
    ├── vite.config.js              # Vite bundler configuration & API proxy
    ├── tailwind.config.js          # Tailwind CSS styling configuration
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── context/
        │   ├── AuthContext.jsx     # Authentication state & session
        │   └── ThemeContext.jsx    # Dark/light mode state & persistence
        ├── services/
        │   └── api.js              # Axios HTTP client with auth interceptors
        ├── components/
        │   ├── common/
        │   │   └── ThemeToggle.jsx # Sun/moon theme toggle
        │   ├── layout/
        │   │   ├── Navbar.jsx      # Navigation header & mobile drawer
        │   │   └── ProtectedRoute.jsx # Route authentication guard
        │   ├── notes/
        │   │   ├── NoteUploader.jsx# File upload & paste editor
        │   │   └── SummaryViewer.jsx# Markdown summary display
        │   ├── quiz/
        │   │   ├── QuizCard.jsx    # Question card with instant feedback
        │   │   └── QuizResults.jsx # Results view with celebration confetti
        │   ├── flashcards/
        │   │   └── FlashcardDeck.jsx# 3D interactive flip card deck
        │   └── planner/
        │       └── PlanTimeline.jsx# Milestone checklist
        ├── pages/
        │   ├── AskPage.jsx         # Ask AI chat, diagram & image arena
        │   ├── DashboardPage.jsx   # Metrics, SVG score chart & links
        │   ├── FlashcardsPage.jsx  # Flashcards interface
        │   ├── LoginPage.jsx       # Sign in & one-click demo student
        │   ├── NotesPage.jsx       # Notes library & upload
        │   ├── PlannerPage.jsx     # Exam planner interface
        │   ├── QuizPage.jsx        # Quiz test session & review
        │   └── RegisterPage.jsx    # Account registration
        ├── App.jsx                 # Client application routes
        ├── main.jsx                # React DOM entry point
        └── index.css               # Tailwind base & 3D animation rules
```

---

## ⚙️ Environment Variables

### Backend Server (`server/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | Optional | Port for the Express server (defaults to `5000`, tests run on `5001`) |
| `NODE_ENV` | Recommended | Environment mode (`development` or `production`) |
| `MONGODB_URI` | Required in Prod | MongoDB connection URI (Atlas SRV or local connection string) |
| `MONGODB_TEST_URI` | Optional | MongoDB URI dedicated strictly to tests (must target `studymate_test`) |
| `JWT_SECRET` | Required | Secret key for signing student authentication tokens |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for academic responses, summaries, and SVG diagrams |
| `GEMINI_MODEL` | Optional | Preferred Gemini model (e.g., `gemini-2.5-flash`) |
| `GEMINI_IMAGE_MODEL` | Optional | Gemini model identifier for image generation |
| `IMAGE_PROVIDER` | Optional | Image generation provider: `cloudflare`, `gemini`, or `none` |
| `IMAGE_DAILY_GLOBAL_CAP` | Optional | Global maximum daily generated images across all users (defaults to `100`) |
| `CF_ACCOUNT_ID` | Optional | Cloudflare account ID for Workers AI Flux-1-schnell |
| `CF_API_TOKEN` | Optional | Cloudflare API bearer token for Workers AI |
| `MAX_NOTE_CHARACTERS` | Optional | Maximum character length for uploaded notes (defaults to `100000`) |
| `CLIENT_URL` | Required in Prod | Allowed frontend origin URL for CORS verification |

### Frontend Client (`client/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Required in Prod | Backend API base URL endpoint (e.g. `https://your-api.domain.com/api`) |

---

## ⚡ Local Setup Guide

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v20 & v24)
- **npm**: v9+
- (Optional) Local MongoDB or MongoDB Atlas URI (an in-memory database will automatically initialize if omitted)

### 2. Configure Environment
Create `server/.env` with the required keys (see table above).

### 3. Install Dependencies & Run
From the root directory:
```bash
# Terminal 1: Start Backend Server
cd server
npm install
npm run dev

# Terminal 2: Start Frontend Client
cd client
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173/` and the backend on `http://localhost:5000/`.

---

## 🚢 Deployment Steps

### Backend Deployment (Render, Railway, Fly.io, VPS)
1. **Repository**: Push your repository to GitHub or GitLab.
2. **Environment**:
   - Set `NODE_ENV=production`
   - Set `PORT` (assigned automatically by most platforms)
   - Set `MONGODB_URI` pointing to your MongoDB Atlas cluster
   - Set `JWT_SECRET` to a cryptographically secure random string
   - Set `CLIENT_URL` to your production frontend URL (e.g., `https://studymate.vercel.app`)
   - Set AI credentials (`GEMINI_API_KEY`, and optionally `CF_ACCOUNT_ID` + `CF_API_TOKEN`)
3. **Build & Start Commands**:
   - Root directory / working directory: `server`
   - Build command: `npm install --omit=dev`
   - Start command: `npm start`
4. **Health Check**: Verify `GET /api/ask/capabilities` returns HTTP 200 with authentication.

### Frontend Deployment (Vercel)
1. **Framework Preset**: Vite
2. **Root Directory**: `client`
3. **Build Settings**:
   - Build command: `npm run build`
   - Output directory: `dist`
4. **Environment Variables**:
   - Set `VITE_API_URL` to your production backend API URL (e.g., `https://studymate-api.onrender.com/api`)
5. **SPA Routing**: Handled automatically via `client/vercel.json` rewrite to `/index.html`.

---

## 🧪 Running Automated Tests

Tests strictly run against the `studymate_test` database on `PORT=5001`:

```bash
cd server
npm test
```
