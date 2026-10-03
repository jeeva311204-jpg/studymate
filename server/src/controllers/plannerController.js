const StudyPlan = require('../models/StudyPlan');
const Note = require('../models/Note');
const { getGenerativeModel, getGeminiClient, generateWithModelFallback } = require('../config/gemini');
const { executeWithRetry } = require('../utils/aiValidator');

// Helper to validate the day-by-day schedule schema
const validateScheduleSchema = (parsed) => {
  let schedule = parsed;
  if (!Array.isArray(parsed) && Array.isArray(parsed.schedule)) {
    schedule = parsed.schedule;
  }

  if (!Array.isArray(schedule) || schedule.length === 0) {
    return { valid: false, error: 'Expected an array of daily schedules.' };
  }

  for (let i = 0; i < schedule.length; i++) {
    const day = schedule[i];
    if (day.dayNumber === undefined) {
      day.dayNumber = i + 1;
    }
    if (!day.focusTopic || typeof day.focusTopic !== 'string') {
      return { valid: false, error: `Day ${i + 1} is missing a valid 'focusTopic'.` };
    }
    if (!Array.isArray(day.tasks) || day.tasks.length === 0) {
      return { valid: false, error: `Day ${i + 1} must contain a list of 'tasks'.` };
    }
    // Normalize tasks to { text: string, completed: boolean }
    day.tasks = day.tasks.map((t) => {
      if (typeof t === 'string') return { text: t, completed: false };
      return { text: t.text || 'Study session', completed: Boolean(t.completed) };
    });
  }

  return { valid: true, data: schedule };
};

// @desc    Generate a customized day-by-day study plan
// @route   POST /api/planner/generate
// @access  Private
exports.generatePlan = async (req, res) => {
  const client = getGeminiClient();

  // If Gemini key is not configured, do not return fake schedule; return 503 immediately
  if (!client) {
    return res.status(503).json({
      error: true,
      message: 'AI Study Planner is unavailable: GEMINI_API_KEY is not configured in server/.env. Please configure a valid API key.',
    });
  }

  try {
    const { title, examDate, dailyHours, selectedNoteIds } = req.body;

    if (!examDate || !dailyHours) {
      return res.status(400).json({ message: 'Exam date and daily study hours are required.' });
    }

    const exam = new Date(examDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = exam.getTime() - today.getTime();
    const daysRemaining = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Fetch titles and content summaries of selected notes
    let notesData = [];
    if (Array.isArray(selectedNoteIds) && selectedNoteIds.length > 0) {
      notesData = await Note.find({ _id: { $in: selectedNoteIds }, user: req.user._id }).select('title summary');
    } else {
      notesData = await Note.find({ user: req.user._id }).select('title summary').limit(5);
    }

    const topicsList = notesData.map((n) => n.title);
    const planTitle = title?.trim() || `${topicsList[0] || 'Exam'} Preparation Plan`;

    const model = getGenerativeModel({
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const maxDays = Math.min(daysRemaining, 30); // Cap at 30 structured days to ensure high quality
    const basePrompt = `You are a world-class academic study coach.
Design a realistic, day-by-day study roadmap for a student preparing for an exam.

INPUT DATA:
- Exam Date: ${exam.toLocaleDateString()}
- Total Days to Prepare: ${maxDays} days
- Daily Study Time Available: ${dailyHours} hours/day (${Math.round(dailyHours * 60)} minutes)
- Topics / Notes to Cover: ${topicsList.join(', ') || 'General Course Material'}

STRICT JSON SCHEMA:
Return a JSON array of daily schedule objects:
[
  {
    "dayNumber": 1,
    "date": "Month Day (e.g. Oct 1)",
    "focusTopic": "Specific clear topic for the day",
    "tasks": [
      { "text": "Specific actionable task (e.g. Read summary of Mitochondria)", "completed": false },
      { "text": "Practice 15 flashcards on cell membrane", "completed": false },
      { "text": "Take 10-question practice quiz", "completed": false }
    ],
    "estimatedMinutes": 120,
    "tips": "Practical cognitive learning advice for this day's focus."
  }
]

RULES:
1. Distribute all topics evenly with space for review and a final review day before the exam.
2. Provide exactly ${maxDays} daily items.
3. Output ONLY the JSON array, no commentary.`;

    const generatorFn = async (correctiveFeedback) => {
      const prompt = correctiveFeedback ? `${basePrompt}\n\n${correctiveFeedback}` : basePrompt;
      return await generateWithModelFallback(prompt, {
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });
    };

    const schedule = await executeWithRetry(generatorFn, validateScheduleSchema);

    // Persist plan in DB
    const studyPlan = await StudyPlan.create({
      user: req.user._id,
      title: planTitle,
      examDate: exam,
      dailyHours: Number(dailyHours),
      notesCovered: notesData.map((n) => n._id),
      schedule,
    });

    return res.status(201).json({
      message: 'Study plan generated successfully',
      plan: studyPlan,
    });
  } catch (err) {
    console.error('[PlannerController.generatePlan] Error:', err);
    return res.status(503).json({
      error: true,
      message: err.message || 'Failed to generate study plan. Gemini AI service is unavailable.',
    });
  }
};

// @desc    Get all study plans for the user
// @route   GET /api/planner
// @access  Private
exports.getPlans = async (req, res) => {
  try {
    const plans = await StudyPlan.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({ plans });
  } catch (err) {
    console.error('[PlannerController.getPlans] Error:', err);
    return res.status(500).json({ message: 'Failed to retrieve study plans.' });
  }
};

// @desc    Get single study plan by ID
// @route   GET /api/planner/:id
// @access  Private
exports.getPlanById = async (req, res) => {
  try {
    const plan = await StudyPlan.findOne({ _id: req.params.id, user: req.user._id });
    if (!plan) {
      return res.status(404).json({ message: 'Study plan not found.' });
    }
    return res.status(200).json({ plan });
  } catch (err) {
    console.error('[PlannerController.getPlanById] Error:', err);
    return res.status(500).json({ message: 'Failed to retrieve plan.' });
  }
};

// @desc    Toggle completion state of a specific day's task
// @route   PATCH /api/planner/:id/toggle-task
// @access  Private
exports.toggleTask = async (req, res) => {
  try {
    const { dayIndex, taskIndex } = req.body;
    const plan = await StudyPlan.findOne({ _id: req.params.id, user: req.user._id });

    if (!plan) {
      return res.status(404).json({ message: 'Plan not found.' });
    }

    if (
      plan.schedule[dayIndex] &&
      plan.schedule[dayIndex].tasks[taskIndex] !== undefined
    ) {
      const current = plan.schedule[dayIndex].tasks[taskIndex].completed;
      plan.schedule[dayIndex].tasks[taskIndex].completed = !current;
      await plan.save();
      return res.status(200).json({
        message: 'Task updated',
        plan,
      });
    }

    return res.status(400).json({ message: 'Invalid day or task index.' });
  } catch (err) {
    console.error('[PlannerController.toggleTask] Error:', err);
    return res.status(500).json({ message: 'Failed to toggle task.' });
  }
};

// @desc    Delete study plan
// @route   DELETE /api/planner/:id
// @access  Private
exports.deletePlan = async (req, res) => {
  try {
    const plan = await StudyPlan.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!plan) {
      return res.status(404).json({ message: 'Plan not found.' });
    }
    return res.status(200).json({ message: 'Study plan deleted successfully.' });
  } catch (err) {
    console.error('[PlannerController.deletePlan] Error:', err);
    return res.status(500).json({ message: 'Failed to delete plan.' });
  }
};
