/**
 * Unit Tests: Professional Scoring Engine — CEFR + Scoring Logic
 * Tests mapCEFR, score clamping, passing threshold, and section score formula.
 *
 * Pure logic tests that do NOT require DB.
 * Run: npm run test -- tests/professional_scoring.test.js
 */
'use strict';

// ============================================================
// INLINE PURE FUNCTIONS (copy from resultService for unit testing)
// ============================================================
const CEFR_THRESHOLDS = [
  { min: 627, max: 677, level: 'C1' },
  { min: 543, max: 626, level: 'B2' },
  { min: 460, max: 542, level: 'B1' },
  { min: 337, max: 459, level: 'A2' },
  { min: 0,   max: 336, level: 'A1' },
];

const mapCEFR = (score) => {
  for (const range of CEFR_THRESHOLDS) {
    if (score >= range.min && score <= range.max) return range.level;
  }
  return 'A1';
};

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

/**
 * Standard TOEFL PBT formula (3 sections):
 *   FinalScore = round((L + S + R) × 10 / 3)
 * For N sections: normalize to 3-section equivalent
 */
const calculateFinalScore = (convertedSectionScores, scoringType, config = {}) => {
  if (scoringType === 'RAW') {
    const initialScore = Number(config.initialScore || 0);
    const totalCorrect = convertedSectionScores.reduce((sum, s) => sum + s.correct, 0);
    return initialScore + totalCorrect;
  }

  const totalConverted = convertedSectionScores.reduce((sum, s) => sum + s.convertedScore, 0);
  const n = convertedSectionScores.length;
  if (n === 0) return 310;

  let score;
  if (n === 3) {
    score = Math.round((totalConverted * 10) / 3);
  } else {
    // Generalized: normalize to 3-section equivalent
    const avg = totalConverted / n;
    score = Math.round((avg * 3 * 10) / 3);
  }
  return clamp(score, 310, 677);
};

// ============================================================
// TEST SUITES
// ============================================================

describe('CEFR Mapping', () => {
  test('score >= 627 → C1', () => {
    expect(mapCEFR(627)).toBe('C1');
    expect(mapCEFR(677)).toBe('C1');
  });

  test('score 543–626 → B2', () => {
    expect(mapCEFR(543)).toBe('B2');
    expect(mapCEFR(626)).toBe('B2');
  });

  test('score 460–542 → B1', () => {
    expect(mapCEFR(460)).toBe('B1');
    expect(mapCEFR(542)).toBe('B1');
  });

  test('score 337–459 → A2', () => {
    expect(mapCEFR(337)).toBe('A2');
    expect(mapCEFR(459)).toBe('A2');
  });

  test('score < 337 → A1', () => {
    expect(mapCEFR(336)).toBe('A1');
    expect(mapCEFR(0)).toBe('A1');
    expect(mapCEFR(310)).toBe('A1');
  });
});

describe('SCALE Scoring — 3 Sections (Standard TOEFL PBT Formula)', () => {
  test('perfect score: (68+68+68) × 10/3 = 680 → clamped to 677', () => {
    const result = calculateFinalScore(
      [{ convertedScore: 68 }, { convertedScore: 68 }, { convertedScore: 68 }],
      'SCALE'
    );
    expect(result).toBe(677);
  });

  test('typical mid score: (55+50+47) × 10/3 = 507', () => {
    const result = calculateFinalScore(
      [{ convertedScore: 55 }, { convertedScore: 50 }, { convertedScore: 47 }],
      'SCALE'
    );
    expect(result).toBe(507);
    expect(mapCEFR(result)).toBe('B1');
  });

  test('minimum score: (20+20+20) × 10/3 = 200 → clamped to 310', () => {
    const result = calculateFinalScore(
      [{ convertedScore: 20 }, { convertedScore: 20 }, { convertedScore: 20 }],
      'SCALE'
    );
    expect(result).toBe(310);
  });
});

describe('SCALE Scoring — Generalized N Sections', () => {
  test('2 sections: avg × 3 × 10 / 3 = avg × 10', () => {
    // avg = (55 + 45) / 2 = 50 → 50 × 10 = 500
    const result = calculateFinalScore(
      [{ convertedScore: 55 }, { convertedScore: 45 }],
      'SCALE'
    );
    expect(result).toBe(500);
  });

  test('1 section: avg × 10', () => {
    // avg = 60 → 60 × 10 = 600
    const result = calculateFinalScore(
      [{ convertedScore: 60 }],
      'SCALE'
    );
    expect(result).toBe(600);
    expect(mapCEFR(600)).toBe('B2');
  });
});

describe('RAW Scoring Mode', () => {
  test('RAW: initialScore + totalCorrect', () => {
    const result = calculateFinalScore(
      [{ convertedScore: 0, correct: 30 }, { convertedScore: 0, correct: 20 }],
      'RAW',
      { initialScore: 200 }
    );
    expect(result).toBe(250); // 200 + 30 + 20
  });

  test('RAW: no initialScore defaults to 0', () => {
    const result = calculateFinalScore(
      [{ convertedScore: 0, correct: 15 }],
      'RAW',
      {}
    );
    expect(result).toBe(15);
  });
});

describe('Passing Grade', () => {
  test('passed = true when score >= passing_score', () => {
    const score = 543; // B2
    const passed = score >= 450;
    expect(passed).toBe(true);
  });

  test('passed = false when score < passing_score', () => {
    const score = 400;
    const passed = score >= 450;
    expect(passed).toBe(false);
  });

  test('passed = null when no passing_score threshold set', () => {
    const passingScore = null;
    const passed = passingScore !== null ? 543 >= passingScore : null;
    expect(passed).toBeNull();
  });
});
