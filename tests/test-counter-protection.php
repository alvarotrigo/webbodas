<?php
/**
 * Test counter and word-count protection in generate-section-text.php
 */

function testProtection() {
    $testCases = [
        // Counter protection
        [
            'name' => 'Counter with role - should preserve',
            'originalText' => '1',
            'newText' => 'Book Now',
            'role' => 'counter',
            'expected' => '1'
        ],
        [
            'name' => 'Short text (1-2 chars) without role - should protect',
            'originalText' => '2',
            'newText' => 'First Session',
            'role' => null,
            'expected' => '2'
        ],
        [
            'name' => 'Button counter - should protect',
            'originalText' => '1',
            'newText' => 'Click Me',
            'role' => 'counter',
            'expected' => '1'
        ],

        // Word count protection
        [
            'name' => 'Name (2 words) replaced with phrase (4+ words) - should revert',
            'originalText' => 'Michael Chen',
            'newText' => 'Expert in Anxiety Management',
            'role' => null,
            'expected' => 'Michael Chen'
        ],
        [
            'name' => 'Title (1 word) replaced with sentence - should revert',
            'originalText' => 'CTO',
            'newText' => 'Specializing in helping individuals navigate anxiety',
            'role' => null,
            'expected' => 'CTO'
        ],
        [
            'name' => 'Title (3 words) replaced with phrase (5 words) - should revert',
            'originalText' => 'CEO & Founder',
            'newText' => 'Chief Executive Officer and Founder',
            'role' => null,
            'expected' => 'CEO & Founder'
        ],
        [
            'name' => 'Title (3 words) replaced with 3 words - should allow',
            'originalText' => 'CEO & Founder',
            'newText' => 'Psychologist & Therapist',
            'role' => null,
            'expected' => 'Psychologist & Therapist'
        ],
        [
            'name' => 'Name (2 words) replaced with 2 words - should allow',
            'originalText' => 'Sarah Johnson',
            'newText' => 'Dr. Rivera',
            'role' => null,
            'expected' => 'Dr. Rivera'
        ],

        // Normal text (4+ words) - should allow replacement freely
        [
            'name' => 'Long text replaced with longer text - should allow',
            'originalText' => 'Meet our talented team members',
            'newText' => 'Discover the compassionate professionals dedicated to guiding you',
            'role' => null,
            'expected' => 'Discover the compassionate professionals dedicated to guiding you'
        ],
        [
            'name' => 'Button with normal text - should allow',
            'originalText' => 'Click Here',
            'newText' => 'Get Started',
            'role' => 'button',
            'expected' => 'Get Started'
        ],
    ];

    $passed = 0;
    $failed = 0;

    foreach ($testCases as $test) {
        $result = applyProtection(
            $test['newText'],
            $test['originalText'],
            $test['role']
        );

        $ok = $result === $test['expected'];
        $status = $ok ? '✓ PASS' : '✗ FAIL';
        if ($ok) $passed++; else $failed++;

        echo sprintf(
            "%s - %s\n  Original: '%s' (%d words), New: '%s' (%d words), Role: %s\n  Expected: '%s', Got: '%s'\n\n",
            $status,
            $test['name'],
            $test['originalText'],
            str_word_count($test['originalText']),
            $test['newText'],
            str_word_count($test['newText']),
            $test['role'] ?? 'null',
            $test['expected'],
            $result
        );
    }

    echo sprintf("Results: %d passed, %d failed\n", $passed, $failed);
}

function applyProtection($newText, $originalText, $role) {
    // Counter role: always preserve original
    if ($role === 'counter') {
        return $originalText;
    }

    // Counter safety: 1-2 char originals with much longer replacement
    $originalLen = mb_strlen($originalText);
    $newLen = mb_strlen($newText);
    if ($originalLen > 0 && $originalLen <= 2 && $newLen > 4) {
        return $originalText;
    }

    // Word count protection: if original < 4 words, replacement must also be < 4 words
    if ($originalText !== '') {
        $originalWordCount = str_word_count($originalText);
        $newWordCount = str_word_count($newText);
        if ($originalWordCount < 4 && $newWordCount >= 4) {
            return $originalText;
        }
    }

    return $newText;
}

echo "Text Protection Test\n";
echo "====================\n\n";
testProtection();
