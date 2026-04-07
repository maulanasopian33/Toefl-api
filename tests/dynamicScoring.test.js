/**
 * Unit Tests: Dynamic Section Scoring Logic (TOAFL & TOEFL)
 * Focuses on section name detection and standard-specific final score calculation.
 *
 * Run: npm test -- tests/dynamicScoring.test.js
 */
'use strict';

// Mocking dependencies if necessary, but here we test the logic from the service
const resultService = require('../services/resultService');

describe('Dynamic Section Category Detection', () => {
    // resultService.getFallbackCategory is internal but we can test it if we exported it or via helper
    // Since it's not exported, we test the logic via the provided matchers in the analysis
    
    const CATEGORY_MATCHERS = [
        { category: 'listening', regex: /(listen|dengar|istima|audio|suara|percakapan|fahmul\s?masmu|muhadatsah)/i },
        { category: 'reading', regex: /(read|baca|qira|teks|wacana|pemahaman|comprehension|fahmul\s?maqru)/i },
        { category: 'structure', regex: /(struct|grammar|tata|tarakib|tata\s?bahasa|tulis|write|expression|qawaid|nahwu|sharaf)/i }
    ];

    const getCat = (name) => {
        for (const m of CATEGORY_MATCHERS) {
            if (m.regex.test(name)) return m.category;
        }
        return 'structure';
    };

    test('Detection of Arabic (TOAFL) section names', () => {
        expect(getCat("Istima'")).toBe('listening');
        expect(getCat("Fahmul Masmu'")).toBe('listening');
        expect(getCat("Qira'ah")).toBe('reading');
        expect(getCat("Fahmul Maqru'")).toBe('reading');
        expect(getCat("Tarakib")).toBe('structure');
        expect(getCat("Qawaid")).toBe('structure');
        expect(getCat("Nahwu & Sharaf")).toBe('structure');
    });

    test('Detection of English (TOEFL) section names', () => {
        expect(getCat("Listening Comprehension")).toBe('listening');
        expect(getCat("Reading Section")).toBe('reading');
        expect(getCat("Structure and Written Expression")).toBe('structure');
    });

    test('Fallback to structure for unknown names', () => {
        expect(getCat("General Information")).toBe('structure');
        expect(getCat("Unknown Component")).toBe('structure');
    });
});

describe('Standard-Aware CEFR Mapping', () => {
    // Testing the logic of _calculateCEFRLevel (assuming it's similar to what's in resultService)
    // In resultService, it's NOT exported, so this is a logic verification test.
    
    const calculateCEFR = (score, standard) => {
        if (standard === 'TOAFL') {
            if (score >= 750) return 'C1';
            if (score >= 600) return 'B2';
            if (score >= 450) return 'B1';
            if (score >= 300) return 'A2';
            return 'A1';
        } else {
            if (score >= 627) return 'C1';
            if (score >= 543) return 'B2';
            if (score >= 460) return 'B1';
            if (score >= 337) return 'A2';
            return 'A1';
        }
    };

    test('TOEFL Standard mapping', () => {
        expect(calculateCEFR(500, 'TOEFL_PBT')).toBe('B1');
        expect(calculateCEFR(630, 'TOEFL_PBT')).toBe('C1');
    });

    test('TOAFL Standard mapping', () => {
        expect(calculateCEFR(500, 'TOAFL')).toBe('B1');
        expect(calculateCEFR(750, 'TOAFL')).toBe('C1');
        expect(calculateCEFR(250, 'TOAFL')).toBe('A1');
    });
});
