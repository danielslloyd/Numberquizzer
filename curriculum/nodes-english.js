/*
 * English proficiency nodes.
 *
 * See curriculum/PROFICIENCIES.md — that document is the source of authority,
 * this file is the same list as data. Change the document first.
 *
 * Same conventions as nodes-math.js: `rung` is implicit in array order, `prereq`
 * holds only incoming edges, and `provenance` is authoring metadata that NO UI
 * CODE MAY READ.
 *
 * Structure follows the Simple View of Reading (RC = D x LC, multiplicative).
 * Word recognition (pa, phon, omap, flu) and language comprehension (morph,
 * vocab, comp) are independent ladders. Their scores must never be averaged into
 * a single "reading level" — a learner can sit at a high comprehension ceiling
 * behind a low decoding bottleneck, and that is the common case here.
 *
 * `params.audio: true` marks a node whose stem is meaningless as text — the
 * runner must speak it. Anything asking a learner to work with *sounds* rather
 * than letters is in this category, and it is why TTS is a Phase-1 requirement
 * rather than a later enhancement.
 */
(function () {
    'use strict';

    const STRANDS = [

    // ---------------------------------------------------------------
    // Word recognition
    // ---------------------------------------------------------------
    { strand: 'pa', pack: 'ela-pa', label: 'Phonological awareness', nodes: [

        { id: 'pa.rhyme', label: 'Hear when words rhyme', tier: 2,
          types: ['mc'], params: { audio: true },
          provenance: { ccss: ['RF.K.2a'] } },

        { id: 'pa.syllable', label: 'Count and blend syllables',
          types: ['numeric', 'mc'], params: { audio: true },
          provenance: { ccss: ['RF.K.2b'] } },

        { id: 'pa.onsetRime', label: 'Blend onset and rime', tier: 2,
          prereq: ['pa.syllable'], types: ['mc', 'text'], params: { audio: true },
          provenance: { ccss: ['RF.K.2c'] } },

        { id: 'pa.isolate', label: 'Hear the first, last and middle sound',
          prereq: ['pa.syllable'], types: ['mc'], params: { audio: true },
          misconceptions: ['names the letter rather than the sound'],
          provenance: { ccss: ['RF.K.2d', 'RF.1.2c'] } },

        { id: 'pa.blend', label: 'Blend sounds into a word',
          prereq: ['pa.isolate'], types: ['mc', 'text'], params: { audio: true, letters: true },
          provenance: { ccss: ['RF.K.2d', 'RF.1.2b'] } },

        { id: 'pa.segment', label: 'Break a word into its sounds',
          prereq: ['pa.isolate'], types: ['numeric', 'tap-token'], params: { audio: true, letters: true },
          misconceptions: ['counts letters instead of sounds — says 4 for "ship"'],
          provenance: { ccss: ['RF.1.2d'] } },

        { id: 'pa.manipulate', label: 'Add, take away or swap a sound', tier: 2,
          prereq: ['pa.blend', 'pa.segment'], types: ['text', 'mc'], params: { audio: true },
          provenance: { ccss: ['RF.K.2e'] } },
    ]},

    // ---------------------------------------------------------------
    { strand: 'phon', pack: 'ela-phon', label: 'Phonics & decoding', nodes: [

        { id: 'phon.letterNames', label: 'Name every letter, capital and small',
          automaticity: { targetMs: 2000 }, types: ['mc', 'text'],
          provenance: { ccss: ['RF.K.1d'] } },

        { id: 'phon.consonants', label: 'The sound each consonant makes',
          prereq: ['phon.letterNames', 'pa.isolate'], automaticity: { targetMs: 2500 },
          types: ['mc'], params: { audio: true },
          provenance: { ccss: ['RF.K.3a'] } },

        { id: 'phon.shortVowels', label: 'The five short vowel sounds',
          prereq: ['phon.letterNames', 'pa.isolate'], automaticity: { targetMs: 2500 },
          types: ['mc'], params: { audio: true },
          misconceptions: ['confuses short e and short i'],
          provenance: { ccss: ['RF.K.3b'] } },

        { id: 'phon.cvc', label: 'Read short-vowel words like cat and hop',
          prereq: ['phon.consonants', 'phon.shortVowels', 'pa.blend'],
          types: ['mc', 'text', 'speech'], practice: ['sorting'],
          provenance: { ccss: ['RF.K.3d', 'RF.1.3b'] } },

        { id: 'phon.digraphs', label: 'Two letters, one sound — sh, ch, th, ck',
          prereq: ['phon.cvc'], types: ['mc', 'text', 'speech'], practice: ['sorting'],
          misconceptions: ['sounds each letter of the digraph separately'],
          provenance: { ccss: ['RF.1.3a'] } },

        { id: 'phon.blends.initial', label: 'Blends at the start — st, bl, tr',
          prereq: ['phon.cvc', 'pa.segment'], types: ['mc', 'text', 'speech'],
          misconceptions: ['drops the second letter of the blend — reads "top" for "stop"'],
          provenance: { ccss: ['RF.1.2b'] } },

        { id: 'phon.blends.final', label: 'Blends at the end — nd, st, mp',
          prereq: ['phon.blends.initial'], types: ['mc', 'text', 'speech'],
          provenance: { ccss: ['RF.1.2b'] } },

        { id: 'phon.ffllss', label: 'Doubling f, l and s at the end', tier: 2,
          prereq: ['phon.cvc'], types: ['mc', 'text', 'speech'],
          provenance: { ccss: ['RF.1.3'] } },

        { id: 'phon.vce', label: 'Silent e makes the vowel say its name',
          prereq: ['phon.cvc', 'phon.digraphs'], types: ['mc', 'text', 'speech'], practice: ['sorting'],
          misconceptions: ['reads the silent e aloud', 'ignores it and reads cap for cape'],
          provenance: { ccss: ['RF.1.3c'] } },

        { id: 'phon.vowelTeams.long', label: 'Vowel teams — ai, ee, oa, igh',
          prereq: ['phon.vce'], types: ['mc', 'text', 'speech'], practice: ['sorting'],
          provenance: { ccss: ['RF.1.3c', 'RF.2.3b'] } },

        { id: 'phon.vowelTeams.more', label: 'More vowel teams — oo, ew, au, aw',
          prereq: ['phon.vowelTeams.long'], types: ['mc', 'text', 'speech'], practice: ['sorting'],
          provenance: { ccss: ['RF.2.3b'] } },

        { id: 'phon.vowelTeams.exceptions', label: 'When a vowel team changes its sound', tier: 2,
          prereq: ['phon.vowelTeams.more'], types: ['mc', 'sort-bins', 'speech'],
          misconceptions: ['applies one sound to ea everywhere — reads "bread" as "breed"'],
          provenance: { ccss: ['RF.2.3e'] } },

        { id: 'phon.rControlled', label: 'When r changes the vowel — ar, or, er, ir, ur',
          prereq: ['phon.vowelTeams.long'], types: ['mc', 'text', 'speech'], practice: ['sorting'],
          misconceptions: ['tries to give the vowel its short sound before the r'],
          provenance: { ccss: ['RF.2.3b', 'RF.2.3e'], note: 'no explicit CCSS home; placement is convention' } },

        { id: 'phon.diphthongs', label: 'Gliding vowels — oi, oy, ou, ow',
          prereq: ['phon.vowelTeams.more'], types: ['mc', 'text', 'speech'],
          provenance: { ccss: ['RF.2.3b'], note: 'no explicit CCSS home; placement is convention' } },

        { id: 'phon.softCG', label: 'Soft c and soft g', tier: 2,
          prereq: ['phon.digraphs'], types: ['mc', 'sort-bins', 'speech'],
          provenance: { ccss: ['RF.2.3e'], note: 'no explicit CCSS home; placement is convention' } },

        { id: 'phon.tchDge', label: 'tch and dge after a short vowel', tier: 2,
          prereq: ['phon.digraphs'], types: ['mc', 'text', 'speech'],
          provenance: { ccss: ['RF.2.3e'] } },

        { id: 'phon.silentLetters', label: 'Silent letters — kn, wr, mb', tier: 2,
          prereq: ['phon.digraphs'], types: ['mc', 'text', 'speech'],
          provenance: { ccss: ['RF.2.3e'] } },

        { id: 'phon.yAsVowel', label: 'When y acts as a vowel', tier: 2,
          prereq: ['phon.vowelTeams.long'], types: ['mc', 'sort-bins', 'speech'],
          provenance: { ccss: ['RF.2.3b'] } },

        { id: 'phon.inflections', label: 'Reading -s, -ed and -ing endings',
          prereq: ['phon.blends.final', 'phon.vce'], types: ['mc', 'text'],
          misconceptions: ['expects -ed to always sound like /ed/'],
          provenance: { ccss: ['RF.1.3f'] } },

        { id: 'phon.syllableTypes', label: 'The six kinds of syllable',
          prereq: ['phon.vce', 'phon.rControlled', 'phon.vowelTeams.more'],
          types: ['mc', 'sort-bins'],
          provenance: { ccss: ['RF.3.3c', 'RF.4.3a'] } },

        { id: 'phon.consonantLe', label: 'The -le ending', tier: 2,
          prereq: ['phon.syllableTypes'], types: ['mc', 'text', 'speech'],
          provenance: { ccss: ['RF.3.3c'] } },

        { id: 'phon.syllableDivision', label: 'Where to split a long word',
          prereq: ['phon.syllableTypes', 'pa.syllable'], types: ['tap-token', 'mc'],
          provenance: { ccss: ['RF.3.3c', 'RF.4.3a'] } },

        { id: 'phon.twoSyllable', label: 'Read two-syllable words',
          prereq: ['phon.syllableDivision'], types: ['mc', 'text', 'speech'],
          provenance: { ccss: ['RF.1.3e', 'RF.2.3c'] } },

        { id: 'phon.schwa', label: 'The lazy vowel in unstressed syllables',
          prereq: ['phon.twoSyllable'], types: ['mc', 'speech'], params: { audio: true },
          misconceptions: ['expects every vowel to keep its full sound'],
          provenance: { ccss: ['RF.3.3c'] } },

        { id: 'phon.multisyllable', label: 'Read long unfamiliar words',
          prereq: ['phon.schwa', 'phon.twoSyllable'], types: ['mc', 'text', 'speech'],
          provenance: { ccss: ['RF.3.3c', 'RF.4.3a', 'RF.5.3a'] } },
    ]},

    // ---------------------------------------------------------------
    { strand: 'omap', pack: 'ela-omap', label: 'Word recognition by sight', nodes: [

        { id: 'omap.hfWords.early', label: 'The first everyday words',
          prereq: ['phon.cvc'], automaticity: { targetMs: 2000 }, types: ['mc', 'text'],
          provenance: { ccss: ['RF.K.3c'] } },

        { id: 'omap.heartWords', label: 'Tricky words — which part is the odd one',
          prereq: ['omap.hfWords.early', 'pa.segment'], types: ['tap-token', 'mc'],
          misconceptions: ['memorises the whole word as a picture instead of mapping the regular parts'],
          provenance: { ccss: ['RF.1.3g', 'RF.2.3f'] } },

        { id: 'omap.hfWords.extended', label: 'More everyday words',
          prereq: ['omap.heartWords'], automaticity: { targetMs: 2000 }, types: ['mc', 'text'],
          provenance: { ccss: ['RF.2.3f', 'RF.3.3d'] } },

        { id: 'omap.autoRecognition', label: 'Know a word the instant you see it',
          prereq: ['omap.hfWords.extended'], automaticity: { targetMs: 1200 },
          types: ['mc'],
          provenance: { ccss: ['RF.3.3d'] } },
    ]},

    // ---------------------------------------------------------------
    { strand: 'flu', pack: 'ela-flu', label: 'Reading fluency', nodes: [

        { id: 'flu.wordList', label: 'Read a list of words quickly and accurately',
          prereq: ['phon.vce', 'omap.autoRecognition'], automaticity: { targetMs: 1500 },
          types: ['mc'],
          provenance: { ccss: ['RF.2.4b', 'RF.3.4b'] } },

        { id: 'flu.phrase', label: 'Read a phrase without stumbling', tier: 2,
          prereq: ['flu.wordList'], automaticity: { targetMs: 4000 }, types: ['mc'],
          provenance: { ccss: ['RF.3.4b'] } },
    ]},

    // ---------------------------------------------------------------
    // Language comprehension
    // ---------------------------------------------------------------
    { strand: 'morph', pack: 'ela-morph', label: 'Word parts & meaning', nodes: [

        { id: 'morph.compound', label: 'Two words joined into one', tier: 2,
          prereq: ['phon.cvc'], types: ['mc', 'tap-token'], practice: ['la-vocab'],
          provenance: { ccss: ['L.2.4d'] } },

        { id: 'morph.inflect.plural', label: 'Making things plural',
          prereq: ['phon.inflections'], types: ['text', 'mc'],
          provenance: { ccss: ['L.1.1c', 'L.2.1b'] } },

        { id: 'morph.inflect.tense', label: 'Endings that change the time',
          prereq: ['phon.inflections'], types: ['text', 'mc'],
          provenance: { ccss: ['L.1.1e', 'L.1.4c'] } },

        { id: 'morph.baseWord', label: 'Find the base word inside a longer one',
          prereq: ['morph.inflect.plural', 'morph.inflect.tense'],
          types: ['tap-token', 'text'],
          misconceptions: ['strips letters that are part of the base — "sing" out of "single"'],
          provenance: { ccss: ['L.1.4c', 'L.3.4c'] } },

        { id: 'morph.prefix.common', label: 'Prefixes that flip or repeat a meaning',
          prereq: ['morph.baseWord'], types: ['mc', 'match'], practice: ['la-vocab'],
          provenance: { ccss: ['L.2.4b', 'L.3.4b'] } },

        { id: 'morph.suffix.common', label: 'Suffixes that add a meaning',
          prereq: ['morph.baseWord'], types: ['mc', 'match'], practice: ['la-vocab'],
          provenance: { ccss: ['L.3.4b'] } },

        { id: 'morph.suffix.posShift', label: 'Suffixes that change a word\'s job',
          prereq: ['morph.suffix.common', 'gram.partsOfSpeech'], types: ['mc', 'text'],
          provenance: { ccss: ['L.4.1', 'L.5.4b'] } },

        { id: 'morph.roots.latin', label: 'Latin roots — port, dict, spect',
          prereq: ['morph.prefix.common', 'morph.suffix.common'],
          types: ['mc', 'match'], practice: ['la-vocab'],
          provenance: { ccss: ['L.4.4b', 'L.5.4b'] } },

        { id: 'morph.roots.greek', label: 'Greek word parts — photo, graph, tele',
          prereq: ['morph.roots.latin'], types: ['mc', 'match'], practice: ['la-vocab'],
          provenance: { ccss: ['L.4.4b', 'L.5.4b'] } },

        { id: 'morph.wordFamily', label: 'Build a family from one root',
          prereq: ['morph.roots.latin'], types: ['multi', 'text'],
          provenance: { ccss: ['L.3.4c', 'L.5.4b'] } },

        { id: 'morph.decomposeLong', label: 'Break a long word into its parts to read it',
          prereq: ['morph.roots.latin', 'phon.multisyllable'], types: ['tap-token', 'mc'],
          provenance: { ccss: ['RF.4.3a', 'RF.5.3a'] } },

        { id: 'morph.inferMeaning', label: 'Work out a new word from its parts',
          prereq: ['morph.decomposeLong', 'morph.wordFamily'], types: ['mc'],
          practice: ['la-vocab'],
          provenance: { ccss: ['L.4.4b', 'L.5.4b'] } },

        { id: 'morph.absorbedPrefix', label: 'Prefixes that change shape — in-, im-, il-, ir-', tier: 3,
          prereq: ['morph.prefix.common', 'morph.roots.latin'], types: ['mc', 'text'],
          provenance: { ccss: ['L.5.4b'] } },
    ]},

    // ---------------------------------------------------------------
    { strand: 'vocab', pack: 'ela-vocab', label: 'Vocabulary', nodes: [

        { id: 'vocab.contextClues', label: 'Work out a word from the sentence around it',
          prereq: ['omap.hfWords.extended'], types: ['mc'], practice: ['la-vocab'],
          provenance: { ccss: ['L.2.4a', 'L.3.4a', 'L.5.4a'] } },

        { id: 'vocab.synonymAntonym', label: 'Words that mean the same or the opposite',
          prereq: ['vocab.contextClues'], types: ['mc', 'match'], practice: ['la-vocab'],
          provenance: { ccss: ['L.4.5c', 'L.5.5c'] } },

        { id: 'vocab.multipleMeaning', label: 'One word, more than one meaning',
          prereq: ['vocab.contextClues'], types: ['mc'], practice: ['la-vocab'],
          misconceptions: ['keeps the first meaning it knows regardless of context'],
          provenance: { ccss: ['L.4.4a', 'L.5.4a'] } },

        { id: 'vocab.shadesOfMeaning', label: 'How close words differ in strength', tier: 2,
          prereq: ['vocab.synonymAntonym'], types: ['order', 'mc'],
          provenance: { ccss: ['L.2.5b', 'L.3.5c'] } },

        { id: 'vocab.categories', label: 'How words group together', tier: 2,
          prereq: ['vocab.synonymAntonym'], types: ['sort-bins', 'multi', 'mc'], practice: ['sorting'],
          provenance: { ccss: ['L.2.5a', 'L.3.5b'] } },

        { id: 'vocab.homophone', label: 'Sound the same, spelled differently',
          prereq: ['vocab.multipleMeaning', 'spell.irregularHF'], types: ['mc', 'cloze'],
          misconceptions: ['picks by sound alone — their/there/they\'re, to/too/two'],
          provenance: { ccss: ['L.4.1g'] } },

        { id: 'vocab.homograph', label: 'Spelled the same, said differently', tier: 2,
          prereq: ['vocab.multipleMeaning'], types: ['mc'],
          provenance: { ccss: ['L.5.5c'] } },

        { id: 'vocab.tier2Academic', label: 'Words that turn up across every subject',
          prereq: ['vocab.contextClues', 'morph.inferMeaning'], types: ['mc', 'cloze'],
          practice: ['la-vocab'],
          provenance: { ccss: ['L.4.6', 'L.5.6'] } },

        { id: 'vocab.figurative.literal', label: 'When words do not mean what they say',
          prereq: ['vocab.multipleMeaning'], types: ['mc'],
          provenance: { ccss: ['L.3.5a', 'RL.3.4'] } },

        { id: 'vocab.simileMetaphor', label: 'Similes and metaphors', tier: 2,
          prereq: ['vocab.figurative.literal'], types: ['mc'],
          provenance: { ccss: ['L.4.5a', 'L.5.5a'] } },

        { id: 'vocab.idiom', label: 'Idioms, adages and proverbs', tier: 2,
          prereq: ['vocab.figurative.literal'], types: ['mc', 'match'],
          provenance: { ccss: ['L.4.5b', 'L.5.5b'] } },
    ]},

    // ---------------------------------------------------------------
    { strand: 'comp', pack: 'ela-comp', label: 'Comprehension', nodes: [

        { id: 'comp.anaphora', label: 'Who does this word point back to?',
          prereq: ['gram.pronouns'], types: ['mc', 'tap-token'],
          misconceptions: ['picks the nearest noun rather than the one that fits'],
          provenance: { ccss: ['RL.3.1', 'RI.3.1'] } },

        { id: 'comp.inference.local', label: 'Work out what is not said outright',
          prereq: ['vocab.contextClues', 'comp.anaphora'], types: ['mc'],
          provenance: { ccss: ['RL.4.1', 'RI.4.1'] } },

        { id: 'comp.mainIdea', label: 'What the passage is mostly about',
          prereq: ['comp.inference.local'], types: ['mc'],
          misconceptions: ['picks a true detail rather than the overall point'],
          provenance: { ccss: ['RL.4.2', 'RI.4.2'] } },

        { id: 'comp.textStructure', label: 'How a passage is put together', tier: 2,
          prereq: ['comp.mainIdea'], types: ['mc'],
          provenance: { ccss: ['RI.4.5', 'RI.5.5'] } },

        { id: 'comp.evidence', label: 'Which sentence backs this up', tier: 2,
          prereq: ['comp.mainIdea'], types: ['mc', 'tap-token'],
          provenance: { ccss: ['RI.5.1', 'RI.5.8'] } },
    ]},

    // ---------------------------------------------------------------
    // Production
    // ---------------------------------------------------------------
    { strand: 'spell', pack: 'ela-spell', label: 'Spelling', nodes: [

        { id: 'spell.phonetic', label: 'Spell a word the way it sounds',
          prereq: ['pa.segment', 'phon.consonants'], types: ['text'], params: { audio: true },
          provenance: { ccss: ['L.K.2d', 'L.1.2e'] } },

        { id: 'spell.cvcPatterns', label: 'Spell short-vowel words',
          prereq: ['spell.phonetic', 'phon.cvc'], types: ['text'], params: { audio: true },
          provenance: { ccss: ['L.1.2d'] } },

        { id: 'spell.vceVowelTeams', label: 'Spell long-vowel words',
          prereq: ['spell.cvcPatterns', 'phon.vowelTeams.long'], types: ['text'],
          params: { audio: true },
          misconceptions: ['picks any spelling with the right sound — "rane" for "rain"'],
          provenance: { ccss: ['L.2.2d'] } },

        { id: 'spell.rControlled', label: 'Spell words with ar, or, er, ir, ur',
          prereq: ['spell.vceVowelTeams', 'phon.rControlled'], types: ['text'],
          params: { audio: true },
          provenance: { ccss: ['L.2.2d'] } },

        { id: 'spell.plurals', label: 'Spell plurals, regular and odd', tier: 2,
          prereq: ['spell.cvcPatterns', 'morph.inflect.plural'], types: ['text'],
          provenance: { ccss: ['L.2.1b', 'L.3.2e'] } },

        { id: 'spell.suffixRules', label: 'Doubling, dropping e, and y to i',
          prereq: ['spell.vceVowelTeams', 'morph.suffix.common'], types: ['text', 'mc'],
          misconceptions: ['adds the suffix without adjusting the base — "hoping"/"hopping" confusion'],
          provenance: { ccss: ['L.3.2e', 'L.3.2f'] } },

        { id: 'spell.irregularHF', label: 'Spell the tricky everyday words',
          prereq: ['spell.cvcPatterns', 'omap.heartWords'], types: ['text'],
          params: { audio: true },
          provenance: { ccss: ['L.1.2d', 'L.3.2e'] } },

        { id: 'spell.positionRules', label: 'Which spelling goes where — ck, tch, dge', tier: 2,
          prereq: ['spell.cvcPatterns', 'phon.tchDge'], types: ['text', 'mc'],
          provenance: { ccss: ['L.3.2f'] } },
    ]},

    // ---------------------------------------------------------------
    { strand: 'gram', pack: 'ela-gram', label: 'Grammar & mechanics', nodes: [

        { id: 'gram.sentence', label: 'What makes a complete sentence',
          prereq: ['omap.hfWords.early'], types: ['mc'], practice: ['la-diag'],
          provenance: { ccss: ['L.1.1j', 'RF.1.1a'] } },

        { id: 'gram.partsOfSpeech', label: 'Nouns, verbs, adjectives, adverbs',
          prereq: ['gram.sentence'], types: ['tap-token', 'sort-bins', 'mc'], practice: ['la-diag'],
          misconceptions: ['classifies by meaning rather than by the word\'s job in the sentence'],
          provenance: { ccss: ['L.3.1a'] } },

        { id: 'gram.endPunctuation', label: 'Full stops, question marks, exclamation marks',
          prereq: ['gram.sentence'], types: ['mc'], practice: ['la-punct'],
          provenance: { ccss: ['L.K.2b', 'L.1.2b'] } },

        { id: 'gram.capitalisation', label: 'What gets a capital letter', tier: 2,
          prereq: ['gram.sentence'], types: ['tap-token', 'mc'], practice: ['la-cap'],
          provenance: { ccss: ['L.1.2a', 'L.2.2a', 'L.3.2a'] } },

        { id: 'gram.subjectVerb', label: 'Matching the subject and the verb',
          prereq: ['gram.partsOfSpeech'], types: ['tap-token', 'mc'], practice: ['la-subj'],
          provenance: { ccss: ['L.1.1c', 'L.3.1f'] } },

        { id: 'gram.tense', label: 'Past, present and future — and staying put',
          prereq: ['gram.partsOfSpeech', 'morph.inflect.tense'], types: ['mc', 'cloze'],
          misconceptions: ['shifts tense mid-passage'],
          provenance: { ccss: ['L.1.1e', 'L.3.1e', 'L.5.1c', 'L.5.1d'] } },

        { id: 'gram.pronouns', label: 'Pronouns and who they stand for',
          prereq: ['gram.partsOfSpeech'], types: ['mc', 'tap-token'],
          provenance: { ccss: ['L.1.1d', 'L.3.1f', 'L.4.1a'] } },

        { id: 'gram.apostrophe', label: 'Apostrophes for shortening and owning',
          prereq: ['gram.pronouns', 'gram.partsOfSpeech'], types: ['mc', 'text'],
          practice: ['la-punct'],
          misconceptions: ['its/it\'s reversed', 'apostrophe added to plain plurals'],
          provenance: { ccss: ['L.2.2c', 'L.3.2d'] } },

        { id: 'gram.conjunctions', label: 'Joining words that build longer sentences',
          prereq: ['gram.sentence', 'gram.partsOfSpeech'], types: ['mc', 'cloze'],
          practice: ['la-diag'],
          provenance: { ccss: ['L.1.1g', 'L.3.1h', 'L.5.1e'] } },

        { id: 'gram.comma', label: 'Where commas go',
          prereq: ['gram.conjunctions', 'gram.endPunctuation'], types: ['tap-token', 'mc'],
          practice: ['la-punct'],
          provenance: { ccss: ['L.1.2c', 'L.3.2b', 'L.4.2c', 'L.5.2a', 'L.5.2b'] } },

        { id: 'gram.fragmentRunOn', label: 'Spot a fragment or a run-on',
          prereq: ['gram.conjunctions', 'gram.subjectVerb'], types: ['mc'],
          misconceptions: ['treats any long sentence as a run-on'],
          provenance: { ccss: ['L.4.1f'] } },

        { id: 'gram.sentenceTypes', label: 'Statements, questions, commands, exclamations', tier: 2,
          prereq: ['gram.endPunctuation'], types: ['mc', 'sort-bins'],
          provenance: { ccss: ['L.1.1j'] } },

        { id: 'gram.quotation', label: 'Punctuating what someone said', tier: 2,
          prereq: ['gram.comma'], types: ['mc'], practice: ['la-punct'],
          provenance: { ccss: ['L.3.2c', 'L.4.2b'] } },
    ]},

    ];

    function norm() {
        const out = [];
        STRANDS.forEach((s) => {
            s.nodes.forEach((n, i) => {
                out.push({
                    id:             n.id,
                    strand:         s.strand,
                    strandLabel:    s.label,
                    rung:           i + 1,
                    label:          n.label,
                    tier:           n.tier || 1,
                    prereq:         n.prereq || [],
                    automaticity:   n.automaticity || null,
                    misconceptions: n.misconceptions || [],
                    provenance:     n.provenance || {},
                    pack:           s.pack,
                    types:          n.types || ['mc'],
                    practice:       n.practice || [],
                    params:         n.params || {},
                });
            });
        });
        return out;
    }

    const NODES = norm();

    if (typeof CUR !== 'undefined' && CUR.registerNodes) {
        CUR.registerNodes(NODES);
    } else if (typeof window !== 'undefined') {
        (window.__CUR_PENDING = window.__CUR_PENDING || []).push.apply(window.__CUR_PENDING, NODES);
    }

    if (typeof module !== 'undefined' && module.exports) module.exports = NODES;
})();
