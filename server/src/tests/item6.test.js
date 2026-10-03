const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Note = require('../models/Note');

describe('Item 6: models/Note.js defaults', () => {
  it('does not default question frequency to "High Probability"', () => {
    const note = new Note({
      user: '507f1f77bcf86cd799439011',
      title: 'Test Note',
      rawContent: 'Sample content',
      examQuestions: {
        twoMarks: [
          { question: 'What is X?', answer: 'X is...', marks: 2 },
        ],
      },
    });

    assert.equal(note.examQuestions.twoMarks[0].frequency, undefined);
    assert.notEqual(note.examQuestions.twoMarks[0].frequency, 'High Probability');
  });

  it('does not default topic module importance to "High Weightage"', () => {
    const note = new Note({
      user: '507f1f77bcf86cd799439011',
      title: 'Test Note 2',
      rawContent: 'Sample content 2',
      topicModules: [
        { title: 'Module 1' },
      ],
    });

    assert.equal(note.topicModules[0].importance, undefined);
    assert.notEqual(note.topicModules[0].importance, 'High Weightage');
  });
});
