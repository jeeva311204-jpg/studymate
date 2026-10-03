const Note = require('../models/Note');
const QuizResult = require('../models/QuizResult');
const StudyPlan = require('../models/StudyPlan');

// @desc    Get dashboard metrics, recent activity, and progress chart data
// @route   GET /api/dashboard/stats
// @access  Private
exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const [notesCount, quizResults, studyPlans, recentNotes] = await Promise.all([
      Note.countDocuments({ user: userId }),
      QuizResult.find({ user: userId }).sort({ createdAt: -1 }),
      StudyPlan.find({ user: userId }).sort({ createdAt: -1 }),
      Note.find({ user: userId }).select('title sourceType summary createdAt flashcards').sort({ createdAt: -1 }).limit(5),
    ]);

    const totalQuizzes = quizResults.length;
    let averageScore = 0;
    if (totalQuizzes > 0) {
      const sum = quizResults.reduce((acc, q) => acc + (q.percentage || 0), 0);
      averageScore = Math.round(sum / totalQuizzes);
    }

    // Chart trend data: chronological past 10 quiz percentages
    const scoreTrend = [...quizResults]
      .reverse()
      .slice(-10)
      .map((q, idx) => ({
        id: q._id,
        sessionNumber: idx + 1,
        title: q.noteTitle || `Quiz ${idx + 1}`,
        score: q.percentage,
        date: new Date(q.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      }));

    // Most recent study plan
    const activePlan = studyPlans.length > 0 ? studyPlans[0] : null;

    return res.status(200).json({
      metrics: {
        totalNotes: notesCount,
        totalQuizzes,
        averageScore,
        activePlansCount: studyPlans.length,
      },
      scoreTrend,
      recentNotes,
      recentQuizzes: quizResults.slice(0, 5),
      activePlan,
    });
  } catch (err) {
    console.error('[DashboardController.getDashboardStats] Error:', err);
    return res.status(500).json({ message: 'Failed to load dashboard statistics.' });
  }
};
