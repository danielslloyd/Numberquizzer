/*
 * Content bank for morphology, vocabulary, comprehension and grammar.
 *
 * Morphology gets the most entries here, and that is the deliberate weighting:
 * morphological instruction improves reading, spelling AND vocabulary together,
 * with the strongest effects for weaker readers, and breaking a long word into
 * its parts is also how multisyllable decoding works. Fifteen root and affix
 * entries buy more downstream vocabulary than several hundred word-list entries.
 *
 * Vocabulary is deliberately NOT a word list. School texts hold 88,500+ word
 * families and children pick up roughly 3,000 a year, almost all incidentally;
 * direct instruction reaches a few hundred. So what is stored here is the
 * machinery — context inference, word parts, and general academic words that
 * recur across subjects — and the app should say plainly that wide reading is
 * the part it cannot replace.
 */
(function () {
    'use strict';

    const L = {};

    // ---- morphology ---------------------------------------------------------
    L.prefixes = [
        { p: 'un', means: 'not', ex: 'unhappy', base: 'happy' },
        { p: 're', means: 'again', ex: 'rewrite', base: 'write' },
        { p: 'dis', means: 'not, or the opposite', ex: 'disagree', base: 'agree' },
        { p: 'pre', means: 'before', ex: 'preheat', base: 'heat' },
        { p: 'mis', means: 'wrongly', ex: 'misspell', base: 'spell' },
        { p: 'sub', means: 'under', ex: 'submarine', base: 'marine' },
        { p: 'over', means: 'too much', ex: 'overcook', base: 'cook' },
        { p: 'non', means: 'not', ex: 'nonsense', base: 'sense' },
    ];

    L.suffixes = [
        { s: 'ful', means: 'full of', ex: 'hopeful', base: 'hope' },
        { s: 'less', means: 'without', ex: 'careless', base: 'care' },
        { s: 'ly', means: 'in that way', ex: 'quickly', base: 'quick' },
        { s: 'ness', means: 'the state of being', ex: 'kindness', base: 'kind' },
        { s: 'able', means: 'can be done', ex: 'washable', base: 'wash' },
        { s: 'er', means: 'a person who does it', ex: 'teacher', base: 'teach' },
        { s: 'ment', means: 'the result of', ex: 'movement', base: 'move' },
        { s: 'tion', means: 'the act of', ex: 'action', base: 'act' },
    ];

    // Which part of speech a suffix produces — the lever that turns one known
    // word into four.
    L.posShift = [
        { base: 'happy', pos: 'adjective', made: 'happiness', madePos: 'noun', sfx: 'ness' },
        { base: 'quick', pos: 'adjective', made: 'quickly', madePos: 'adverb', sfx: 'ly' },
        { base: 'teach', pos: 'verb', made: 'teacher', madePos: 'noun', sfx: 'er' },
        { base: 'move', pos: 'verb', made: 'movement', madePos: 'noun', sfx: 'ment' },
        { base: 'danger', pos: 'noun', made: 'dangerous', madePos: 'adjective', sfx: 'ous' },
        { base: 'beauty', pos: 'noun', made: 'beautiful', madePos: 'adjective', sfx: 'ful' },
        { base: 'act', pos: 'verb', made: 'action', madePos: 'noun', sfx: 'ion' },
    ];

    L.rootsLatin = [
        { r: 'port', means: 'carry', words: ['transport', 'portable', 'export', 'import'] },
        { r: 'dict', means: 'say', words: ['predict', 'dictate', 'dictionary', 'contradict'] },
        { r: 'spect', means: 'look', words: ['inspect', 'spectator', 'respect', 'spectacles'] },
        { r: 'rupt', means: 'break', words: ['erupt', 'interrupt', 'rupture', 'disrupt'] },
        { r: 'struct', means: 'build', words: ['construct', 'structure', 'destruct', 'instruct'] },
        { r: 'tract', means: 'pull', words: ['tractor', 'attract', 'subtract', 'extract'] },
        { r: 'vis', means: 'see', words: ['visible', 'vision', 'visit', 'television'] },
        { r: 'form', means: 'shape', words: ['transform', 'uniform', 'formation', 'reform'] },
    ];

    L.rootsGreek = [
        { r: 'photo', means: 'light', words: ['photograph', 'photosynthesis'] },
        { r: 'graph', means: 'write or draw', words: ['autograph', 'paragraph', 'graphic'] },
        { r: 'tele', means: 'far away', words: ['telephone', 'telescope', 'television'] },
        { r: 'bio', means: 'life', words: ['biology', 'biography'] },
        { r: 'micro', means: 'small', words: ['microscope', 'microphone'] },
        { r: 'scope', means: 'look at', words: ['telescope', 'microscope', 'periscope'] },
        { r: 'geo', means: 'earth', words: ['geography', 'geology'] },
        { r: 'auto', means: 'self', words: ['automatic', 'autograph', 'automobile'] },
    ];

    // ---- vocabulary ----------------------------------------------------------
    L.synonyms = [
        { w: 'happy', same: 'glad', opp: 'sad' },
        { w: 'big', same: 'large', opp: 'small' },
        { w: 'fast', same: 'quick', opp: 'slow' },
        { w: 'begin', same: 'start', opp: 'finish' },
        { w: 'brave', same: 'bold', opp: 'cowardly' },
        { w: 'ancient', same: 'old', opp: 'modern' },
        { w: 'difficult', same: 'hard', opp: 'easy' },
        { w: 'quiet', same: 'silent', opp: 'noisy' },
        { w: 'wealthy', same: 'rich', opp: 'poor' },
        { w: 'shiny', same: 'glossy', opp: 'dull' },
    ];

    L.multiMeaning = [
        { w: 'bark', a: 'the sound a dog makes', b: 'the outside of a tree',
          sa: 'The dog began to bark at the postman.', sb: 'The bark of the oak was rough.' },
        { w: 'bat', a: 'a wooden stick for hitting a ball', b: 'an animal that flies at night',
          sa: 'She swung the bat and hit the ball.', sb: 'A bat flew out of the dark cave.' },
        { w: 'left', a: 'the opposite of right', b: 'went away',
          sa: 'Turn left at the corner.', sb: 'They left before the rain started.' },
        { w: 'ring', a: 'jewellery worn on a finger', b: 'the sound a bell makes',
          sa: 'She wore a silver ring.', sb: 'I heard the bell ring twice.' },
        { w: 'trunk', a: 'the thick stem of a tree', b: "an elephant's nose",
          sa: 'Moss grew on the trunk of the tree.', sb: 'The elephant lifted its trunk.' },
    ];

    L.homophones = [
        { a: 'their', b: 'there', clue: 'belonging to them', sentence: 'The children collected ___ coats.' },
        { a: 'there', b: 'their', clue: 'in that place', sentence: 'Please put the box over ___.' },
        { a: 'too', b: 'two', clue: 'as well, or more than enough', sentence: 'It is far ___ cold to swim.' },
        { a: 'two', b: 'too', clue: 'the number 2', sentence: 'She has ___ older brothers.' },
        { a: 'hear', b: 'here', clue: 'to listen with your ears', sentence: 'Can you ___ the music?' },
        { a: 'here', b: 'hear', clue: 'in this place', sentence: 'Come and sit ___ beside me.' },
    ];

    // Tier 2: general academic words that turn up across every subject, which is
    // exactly what makes them worth teaching directly.
    L.academic = [
        { w: 'compare', means: 'look for what is the same', s: 'We ___ the two stories to find what they shared.' },
        { w: 'observe', means: 'watch carefully', s: 'Scientists ___ the plants every day for a month.' },
        { w: 'predict', means: 'say what will happen next', s: 'Can you ___ what the weather will do tomorrow?' },
        { w: 'describe', means: 'say what something is like', s: 'Please ___ the animal you saw.' },
        { w: 'explain', means: 'make something clear', s: 'She will ___ how the machine works.' },
        { w: 'summarise', means: 'give the main points briefly', s: 'Try to ___ the chapter in three sentences.' },
        { w: 'evidence', means: 'facts that support an idea', s: 'What ___ is there that it rained?' },
        { w: 'estimate', means: 'make a sensible guess', s: 'I ___ there were about fifty people.' },
    ];

    L.figurative = [
        { s: 'She was over the moon about her results.', lit: false, means: 'extremely pleased' },
        { s: 'The rain fell steadily all afternoon.', lit: true, means: null },
        { s: 'He let the cat out of the bag before the party.', lit: false, means: 'gave away a secret' },
        { s: 'The cat sat on the warm windowsill.', lit: true, means: null },
        { s: 'It was raining cats and dogs.', lit: false, means: 'raining very heavily' },
        { s: 'Time flies when you are enjoying yourself.', lit: false, means: 'time seems to pass quickly' },
        { s: 'The clock on the wall stopped at noon.', lit: true, means: null },
        { s: 'She has a heart of gold.', lit: false, means: 'she is very kind' },
    ];

    // ---- comprehension --------------------------------------------------------
    // Short authored passages. Original text, so there is nothing to license.
    L.passages = [
        {
            id: 'fox-well',
            text: 'A thirsty fox found a deep well with water at the bottom. He could not reach it, '
                + 'so he dropped pebbles in one at a time. Slowly the water rose. When it was high '
                + 'enough, the fox drank and trotted away pleased with himself.',
            pronoun: { word: 'he', refersTo: 'the fox', options: ['the well', 'the water', 'a pebble'] },
            inference: {
                q: 'Why did the fox drop pebbles into the well?',
                a: 'To make the water rise high enough to reach',
                wrong: ['Because he was angry', 'To fill up the well', 'To scare away other animals'],
            },
            mainIdea: {
                a: 'A fox solves a problem by thinking',
                wrong: ['Wells are dangerous places', 'Foxes like to play with stones',
                    'It is important to drink water'],
            },
        },
        {
            id: 'ice-lolly',
            text: 'Maya left her ice lolly on the step while she ran to fetch her bike. When she came '
                + 'back there was only a sticky puddle and the wooden stick. She looked up at the '
                + 'bright sun and sighed.',
            pronoun: { word: 'she', refersTo: 'Maya', options: ['the lolly', 'the bike', 'the sun'] },
            inference: {
                q: 'What happened to the ice lolly?',
                a: 'It melted in the sun',
                wrong: ['Someone ate it', 'It rolled away', 'Maya took it with her'],
            },
            mainIdea: {
                a: 'Something left in the sun melts',
                wrong: ['Maya does not like ice lollies', 'Bikes are faster than walking',
                    'Maya lost her bike'],
            },
        },
        {
            id: 'bird-nest',
            text: 'Every spring a pair of swallows returns to the same barn. They gather mud and dry '
                + 'grass and build a cup-shaped nest under the roof. The farmer leaves the door open '
                + 'for them, because the birds eat the insects that trouble his cattle.',
            pronoun: { word: 'they', refersTo: 'the swallows', options: ['the cattle', 'the insects', 'the farmers'] },
            inference: {
                q: 'Why does the farmer leave the barn door open?',
                a: 'Because the swallows eat insects that bother his cattle',
                wrong: ['Because the door is broken', 'Because he likes the noise',
                    'Because the barn is too warm'],
            },
            mainIdea: {
                a: 'The swallows and the farmer each get something useful',
                wrong: ['Swallows build nests out of mud', 'Barns are good places for cattle',
                    'Spring is the best season'],
            },
        },
        {
            id: 'lost-glove',
            text: 'Sam searched his pockets twice, then his bag. The glove was not there. He '
                + 'remembered taking it off to tie his laces by the gate, and he turned back up '
                + 'the hill without saying a word.',
            pronoun: { word: 'it', refersTo: 'the glove', options: ['the bag', 'the gate', 'the hill'] },
            inference: {
                q: 'Where does Sam think the glove is?',
                a: 'By the gate, where he took it off',
                wrong: ['In his bag', 'At the top of the hill', 'He has no idea'],
            },
            mainIdea: {
                a: 'Sam works out where he lost something and goes back for it',
                wrong: ['Gloves are easy to lose', 'Sam does not like tying his laces',
                    'It is cold at the top of the hill'],
            },
        },
        {
            id: 'library-cat',
            text: 'A grey cat began sitting outside the library each morning. At first the '
                + 'librarian shooed her away. Then she noticed that the children who were shy '
                + 'about reading aloud would happily read to the cat, so she propped the door open.',
            pronoun: { word: 'she', refersTo: 'the librarian', options: ['the cat', 'the children', 'the library'] },
            inference: {
                q: 'Why did the librarian prop the door open?',
                a: 'So the cat could come in and children would read to it',
                wrong: ['Because the library was too warm', 'To let the shy children leave',
                    'Because the door was broken'],
            },
            mainIdea: {
                a: 'Something unexpected turned out to help children read',
                wrong: ['Cats like libraries', 'Librarians do not like animals',
                    'Reading aloud is difficult'],
            },
        },
        {
            id: 'seed-jar',
            text: 'Priya put a bean seed in a jar with damp paper against the glass. Nothing '
                + 'happened for three days. On the fourth morning a white root had pushed '
                + 'downwards, and by the end of the week a pale shoot was reaching the other way.',
            pronoun: { word: 'it', refersTo: 'the seed', options: ['the jar', 'the paper', 'the glass'] },
            inference: {
                q: 'Which direction did the root grow?',
                a: 'Downwards',
                wrong: ['Upwards', 'Sideways', 'It did not grow'],
            },
            mainIdea: {
                a: 'A seed sprouts, with the root and shoot growing opposite ways',
                wrong: ['Beans need a jar to grow', 'Priya waited three days',
                    'Paper holds water well'],
            },
        },
        {
            id: 'bridge-queue',
            text: 'The footbridge over the stream was only wide enough for one person. Every '
                + 'morning a crowd built up on both banks while people edged across. Then someone '
                + 'painted arrows on the planks, one direction on each side, and the queues melted away.',
            pronoun: { word: 'someone', refersTo: 'a person who painted the arrows', options: ['the stream', 'the planks', 'the crowd'] },
            inference: {
                q: 'Why did the queues disappear?',
                a: 'The arrows kept people moving the same way at the same time',
                wrong: ['The bridge was made wider', 'Fewer people used the bridge',
                    'The stream dried up'],
            },
            mainIdea: {
                a: 'A small change fixed a crowding problem',
                wrong: ['Footbridges are dangerous', 'Painting is useful',
                    'Mornings are busy'],
            },
        },
        {
            id: 'moth-lamp',
            text: 'Moths gathered round the porch lamp every summer night. Ada read that moths '
                + 'steer by keeping the moon at a fixed angle, and that a nearby lamp confuses '
                + 'that trick into a tightening spiral. She started switching the lamp off.',
            pronoun: { word: 'she', refersTo: 'Ada', options: ['the moon', 'a moth', 'the lamp'] },
            inference: {
                q: 'Why did Ada start switching the lamp off?',
                a: 'Because the lamp was confusing the moths',
                wrong: ['To save electricity', 'Because the porch was too bright to sleep',
                    'Because she disliked moths'],
            },
            mainIdea: {
                a: 'Learning why moths circle a lamp changed what Ada did',
                wrong: ['Moths come out in summer', 'The moon is useful for navigation',
                    'Porch lamps attract insects'],
            },
        },
        {
            id: 'wrong-bus',
            text: 'Noor got on the 14 instead of the 41. She noticed at the third stop, when the '
                + 'bus turned away from the park rather than towards it. Rather than panic she '
                + 'stayed on until the next stop, crossed the road, and waited for one going back.',
            pronoun: { word: 'it', refersTo: 'the park', options: ['the bus', 'the road', 'the stop'] },
            inference: {
                q: 'How did Noor realise she was on the wrong bus?',
                a: 'The bus turned away from the park instead of towards it',
                wrong: ['Someone told her', 'She checked the number again',
                    'The bus stopped running'],
            },
            mainIdea: {
                a: 'Noor notices a mistake and calmly sorts it out',
                wrong: ['Buses are often late', 'The 14 and the 41 look alike',
                    'The park is far away'],
            },
        },
    ];

    // ---- grammar ---------------------------------------------------------------
    L.sentences = [
        { s: 'The small dog barked loudly at the postman.',
          noun: 'dog', verb: 'barked', adj: 'small', adv: 'loudly' },
        { s: 'A tall giraffe reached the leaves easily.',
          noun: 'giraffe', verb: 'reached', adj: 'tall', adv: 'easily' },
        { s: 'The old clock ticked quietly in the hall.',
          noun: 'clock', verb: 'ticked', adj: 'old', adv: 'quietly' },
        { s: 'My little sister sang beautifully at the concert.',
          noun: 'sister', verb: 'sang', adj: 'little', adv: 'beautifully' },
        { s: 'The hungry cat waited patiently by the door.',
          noun: 'cat', verb: 'waited', adj: 'hungry', adv: 'patiently' },
    ];

    L.fragments = [
        { text: 'Because it was raining.', kind: 'fragment' },
        { text: 'Running down the hill.', kind: 'fragment' },
        { text: 'The tall trees by the river.', kind: 'fragment' },
        { text: 'We went home early.', kind: 'sentence' },
        { text: 'The dog barked.', kind: 'sentence' },
        { text: 'She finished her book last night.', kind: 'sentence' },
        { text: 'I like apples they are sweet and crunchy.', kind: 'runon' },
        { text: 'The bell rang we all went outside.', kind: 'runon' },
    ];

    L.agreement = [
        { subj: 'The dog', right: 'runs', wrong: 'run' },
        { subj: 'The dogs', right: 'run', wrong: 'runs' },
        { subj: 'My friend', right: 'was', wrong: 'were' },
        { subj: 'My friends', right: 'were', wrong: 'was' },
        { subj: 'She', right: 'has', wrong: 'have' },
        { subj: 'They', right: 'have', wrong: 'has' },
    ];

    L.tense = [
        { base: 'walk', past: 'walked', present: 'walks', future: 'will walk' },
        { base: 'eat', past: 'ate', present: 'eats', future: 'will eat' },
        { base: 'go', past: 'went', present: 'goes', future: 'will go' },
        { base: 'run', past: 'ran', present: 'runs', future: 'will run' },
        { base: 'see', past: 'saw', present: 'sees', future: 'will see' },
        { base: 'write', past: 'wrote', present: 'writes', future: 'will write' },
    ];

    L.apostrophe = [
        { right: "it's", wrong: 'its', clue: 'short for "it is"', s: "___ going to rain later." },
        { right: 'its', wrong: "it's", clue: 'belonging to it', s: 'The dog wagged ___ tail.' },
        { right: "they're", wrong: 'their', clue: 'short for "they are"', s: '___ coming to tea.' },
        { right: "don't", wrong: 'dont', clue: 'short for "do not"', s: 'Please ___ touch that.' },
        { right: "dog's", wrong: 'dogs', clue: 'the bowl belonging to one dog', s: "The ___ bowl was empty." },
    ];

    L.commas = [
        { right: 'I bought apples, pears and plums.', wrong: 'I bought apples pears and plums.', why: 'items in a list' },
        { right: 'After the film, we walked home.', wrong: 'After the film we walked home.', why: 'after an opening phrase' },
        { right: 'Is that you, Steve?', wrong: 'Is that you Steve?', why: 'before naming who you are speaking to' },
        { right: 'It was cold, but we went anyway.', wrong: 'It was cold but, we went anyway.', why: 'before the joining word in a compound sentence' },
    ];

    L.conjunctions = [
        { s: 'It was raining ___ we stayed inside.', right: 'so', wrong: ['but', 'or', 'because'] },
        { s: 'I wanted to go ___ I was too tired.', right: 'but', wrong: ['so', 'and', 'or'] },
        { s: 'We stayed inside ___ it was raining.', right: 'because', wrong: ['so', 'or', 'but'] },
        { s: 'You can have an apple ___ a pear.', right: 'or', wrong: ['because', 'so', 'but'] },
    ];

    L.capitals = [
        { right: 'On Monday we visited London.', wrong: 'on monday we visited london.', why: 'sentence start, day, place' },
        { right: 'My friend Ravi lives in France.', wrong: 'my friend ravi lives in france.', why: 'sentence start, name, country' },
        { right: 'We read a book called The Iron Man.', wrong: 'we read a book called the iron man.', why: 'sentence start and title' },
    ];

    window.LANG = L;
    if (typeof module !== 'undefined' && module.exports) module.exports = L;
})();
