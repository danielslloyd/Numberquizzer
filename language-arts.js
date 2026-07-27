/* ============================================================================
 * language-arts.js — five tappable English / language-arts puzzle modes.
 *
 * DESIGN NOTE (clean merges): every line of this feature lives in this file and
 * language-arts.css. Nothing here rewrites app.js / index.html / styles.css, so
 * this branch cannot conflict with other in-flight branches. The modes plug into
 * the existing app by *adding* keys to the global `TAB_ENTRY` / `SCREEN_TAB`
 * const objects declared in app.js (top-level const → shared script scope), and
 * by injecting their own stylesheet, tab buttons, and screen <div>s at load.
 *
 * Namespacing: everything is `la*` (language arts). Per-mode sub-prefixes:
 * vocab / cap / punct / subj / diag. The whole file is wrapped in an IIFE so no
 * extra globals leak.
 * ==========================================================================*/
(function () {
    'use strict';

    /* ---- tiny utilities ---------------------------------------------------*/
    const rand = (n) => Math.floor(Math.random() * n);
    const pick = (arr) => arr[rand(arr.length)];
    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = rand(i + 1);
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    // Resolve a {easy:[], hard:[]} bank for the chosen difficulty tier.
    const poolFor = (bank, diff) =>
        diff === 'mixed' ? bank.easy.concat(bank.hard) : bank[diff];
    // Capitalize / lower-case just the first letter (leave the rest as authored).
    const capFirst = (w) => w.charAt(0).toUpperCase() + w.slice(1);
    const lowerFirst = (w) => w.charAt(0).toLowerCase() + w.slice(1);
    const isCapFirst = (w) => {
        const c = w.charAt(0);
        return c !== c.toLowerCase() && c === c.toUpperCase();
    };

    /* ========================================================================
     * CONTENT BANKS
     * easy ≈ K–2, hard ≈ 3–5. "Mixed" difficulty draws from both.
     * ======================================================================*/
    const LA = {
        vocab: {
            synonym: {
                easy: [
                    { word: 'big', correct: 'large', distractors: ['tiny', 'cold', 'slow'] },
                    { word: 'happy', correct: 'glad', distractors: ['angry', 'sleepy', 'loud'] },
                    { word: 'fast', correct: 'quick', distractors: ['heavy', 'soft', 'late'] },
                    { word: 'small', correct: 'little', distractors: ['huge', 'bright', 'wide'] },
                    { word: 'cold', correct: 'chilly', distractors: ['warm', 'dry', 'sweet'] },
                    { word: 'sad', correct: 'unhappy', distractors: ['funny', 'brave', 'clean'] },
                    { word: 'pretty', correct: 'lovely', distractors: ['ugly', 'rough', 'empty'] },
                    { word: 'begin', correct: 'start', distractors: ['stop', 'close', 'lose'] },
                    { word: 'jump', correct: 'leap', distractors: ['crawl', 'sit', 'wait'] },
                    { word: 'shout', correct: 'yell', distractors: ['whisper', 'sleep', 'walk'] },
                    { word: 'tired', correct: 'sleepy', distractors: ['awake', 'hungry', 'silly'] },
                    { word: 'quiet', correct: 'silent', distractors: ['noisy', 'sunny', 'sticky'] },
                    { word: 'smart', correct: 'clever', distractors: ['lazy', 'rude', 'plain'] },
                    { word: 'nice', correct: 'kind', distractors: ['mean', 'dark', 'wet'] },
                    { word: 'scared', correct: 'afraid', distractors: ['bored', 'proud', 'calm'] },
                    { word: 'tiny', correct: 'small', distractors: ['giant', 'loud', 'heavy'] },
                ],
                hard: [
                    { word: 'enormous', correct: 'gigantic', distractors: ['minor', 'gentle', 'silent'] },
                    { word: 'ancient', correct: 'old', distractors: ['modern', 'eager', 'polite'] },
                    { word: 'furious', correct: 'angry', distractors: ['cheerful', 'weary', 'timid'] },
                    { word: 'brave', correct: 'courageous', distractors: ['fearful', 'clumsy', 'greedy'] },
                    { word: 'wealthy', correct: 'rich', distractors: ['broke', 'hollow', 'plain'] },
                    { word: 'delicious', correct: 'tasty', distractors: ['bitter', 'stale', 'dull'] },
                    { word: 'exhausted', correct: 'tired', distractors: ['alert', 'joyful', 'sturdy'] },
                    { word: 'gigantic', correct: 'massive', distractors: ['petite', 'narrow', 'faint'] },
                    { word: 'timid', correct: 'shy', distractors: ['bold', 'loud', 'proud'] },
                    { word: 'rapid', correct: 'swift', distractors: ['sluggish', 'gentle', 'faint'] },
                    { word: 'weary', correct: 'tired', distractors: ['eager', 'sturdy', 'merry'] },
                    { word: 'vacant', correct: 'empty', distractors: ['crowded', 'sturdy', 'lively'] },
                    { word: 'gleaming', correct: 'shiny', distractors: ['dull', 'muddy', 'coarse'] },
                    { word: 'peculiar', correct: 'strange', distractors: ['ordinary', 'gentle', 'sturdy'] },
                    { word: 'abundant', correct: 'plentiful', distractors: ['scarce', 'fragile', 'distant'] },
                    { word: 'content', correct: 'satisfied', distractors: ['restless', 'furious', 'anxious'] },
                ],
            },
            antonym: {
                easy: [
                    { word: 'hot', correct: 'cold', distractors: ['warm', 'red', 'fast'] },
                    { word: 'up', correct: 'down', distractors: ['over', 'far', 'near'] },
                    { word: 'day', correct: 'night', distractors: ['noon', 'week', 'sun'] },
                    { word: 'open', correct: 'closed', distractors: ['wide', 'clear', 'full'] },
                    { word: 'happy', correct: 'sad', distractors: ['glad', 'kind', 'nice'] },
                    { word: 'big', correct: 'small', distractors: ['tall', 'long', 'round'] },
                    { word: 'fast', correct: 'slow', distractors: ['soon', 'quick', 'busy'] },
                    { word: 'new', correct: 'old', distractors: ['clean', 'fresh', 'bright'] },
                    { word: 'wet', correct: 'dry', distractors: ['damp', 'cool', 'soft'] },
                    { word: 'full', correct: 'empty', distractors: ['heavy', 'wide', 'round'] },
                    { word: 'first', correct: 'last', distractors: ['next', 'early', 'fast'] },
                    { word: 'loud', correct: 'quiet', distractors: ['sharp', 'busy', 'bright'] },
                    { word: 'high', correct: 'low', distractors: ['tall', 'far', 'deep'] },
                    { word: 'happy', correct: 'sad', distractors: ['angry', 'kind', 'silly'] },
                    { word: 'push', correct: 'pull', distractors: ['lift', 'hold', 'drop'] },
                    { word: 'over', correct: 'under', distractors: ['above', 'beside', 'around'] },
                ],
                hard: [
                    { word: 'ancient', correct: 'modern', distractors: ['aged', 'dusty', 'stone'] },
                    { word: 'generous', correct: 'stingy', distractors: ['kind', 'giving', 'rich'] },
                    { word: 'brave', correct: 'cowardly', distractors: ['bold', 'daring', 'strong'] },
                    { word: 'expand', correct: 'shrink', distractors: ['grow', 'widen', 'stretch'] },
                    { word: 'praise', correct: 'criticize', distractors: ['cheer', 'honor', 'thank'] },
                    { word: 'victory', correct: 'defeat', distractors: ['win', 'trophy', 'glory'] },
                    { word: 'ascend', correct: 'descend', distractors: ['climb', 'rise', 'soar'] },
                    { word: 'permanent', correct: 'temporary', distractors: ['lasting', 'fixed', 'stable'] },
                    { word: 'increase', correct: 'decrease', distractors: ['enlarge', 'gather', 'double'] },
                    { word: 'artificial', correct: 'natural', distractors: ['fake', 'plastic', 'shiny'] },
                    { word: 'ordinary', correct: 'extraordinary', distractors: ['common', 'plain', 'usual'] },
                    { word: 'accept', correct: 'reject', distractors: ['receive', 'welcome', 'gather'] },
                    { word: 'shallow', correct: 'deep', distractors: ['narrow', 'wide', 'flat'] },
                    { word: 'confident', correct: 'nervous', distractors: ['certain', 'proud', 'bold'] },
                    { word: 'freedom', correct: 'captivity', distractors: ['liberty', 'justice', 'safety'] },
                    { word: 'harsh', correct: 'gentle', distractors: ['rough', 'severe', 'bitter'] },
                ],
            },
            definition: {
                easy: [
                    { word: 'puppy', correct: 'a young dog', distractors: ['a young cat', 'a small bird', 'a baby cow'] },
                    { word: 'ocean', correct: 'a very large sea', distractors: ['a small pond', 'a tall hill', 'a dry desert'] },
                    { word: 'author', correct: 'a person who writes books', distractors: ['a person who bakes', 'a person who sings', 'a person who paints'] },
                    { word: 'brave', correct: 'not afraid of danger', distractors: ['very hungry', 'feeling sleepy', 'very funny'] },
                    { word: 'gentle', correct: 'soft and kind', distractors: ['loud and mean', 'cold and wet', 'fast and hard'] },
                    { word: 'meadow', correct: 'a grassy field', distractors: ['a sandy beach', 'a rocky cave', 'a busy street'] },
                    { word: 'nibble', correct: 'to take small bites', distractors: ['to run away', 'to jump high', 'to fall asleep'] },
                    { word: 'chilly', correct: 'a little cold', distractors: ['very hot', 'very loud', 'very funny'] },
                    { word: 'gigantic', correct: 'very big', distractors: ['very small', 'very quiet', 'very slow'] },
                    { word: 'crumble', correct: 'to break into little pieces', distractors: ['to grow tall', 'to swim fast', 'to shout loudly'] },
                ],
                hard: [
                    { word: 'migrate', correct: 'to move from one place to another', distractors: ['to fall asleep', 'to build a nest', 'to eat quickly'] },
                    { word: 'fragile', correct: 'easily broken', distractors: ['very heavy', 'brightly colored', 'extremely loud'] },
                    { word: 'ancestor', correct: 'a relative who lived long ago', distractors: ['a new neighbor', 'a close friend', 'a family pet'] },
                    { word: 'evaporate', correct: 'to turn from liquid into vapor', distractors: ['to freeze solid', 'to grow larger', 'to sink down'] },
                    { word: 'reluctant', correct: 'unwilling to do something', distractors: ['eager to help', 'very tired', 'full of joy'] },
                    { word: 'summit', correct: 'the highest point of a mountain', distractors: ['the bottom of a lake', 'the middle of a forest', 'the edge of a field'] },
                    { word: 'drowsy', correct: 'sleepy and tired', distractors: ['wide awake', 'very hungry', 'full of energy'] },
                    { word: 'generous', correct: 'willing to give and share', distractors: ['quick to get angry', 'afraid of the dark', 'careful with money'] },
                    { word: 'vast', correct: 'huge in size or amount', distractors: ['tiny and thin', 'warm and cozy', 'bright and shiny'] },
                    { word: 'weary', correct: 'very tired', distractors: ['very excited', 'very curious', 'very hungry'] },
                ],
            },
            fillblank: {
                easy: [
                    { sentence: 'The bird will ___ to its nest.', correct: 'fly', distractors: ['swim', 'read', 'bake'] },
                    { sentence: 'Please ___ the door quietly.', correct: 'close', distractors: ['eat', 'sing', 'jump'] },
                    { sentence: 'We ___ apples from the tree.', correct: 'picked', distractors: ['painted', 'slept', 'drove'] },
                    { sentence: 'The sun is very ___ today.', correct: 'bright', distractors: ['quiet', 'empty', 'soft'] },
                    { sentence: 'She likes to ___ her bike to school.', correct: 'ride', distractors: ['pour', 'melt', 'sew'] },
                    { sentence: 'The baby began to ___ when she was hungry.', correct: 'cry', distractors: ['bloom', 'float', 'stack'] },
                    { sentence: 'We put on our coats because it was ___.', correct: 'cold', distractors: ['purple', 'square', 'loud'] },
                    { sentence: 'The frog can ___ across the pond.', correct: 'hop', distractors: ['read', 'bake', 'spell'] },
                    { sentence: 'Please ___ your hands before dinner.', correct: 'wash', distractors: ['climb', 'throw', 'sing'] },
                    { sentence: 'The kite flew high in the ___.', correct: 'sky', distractors: ['spoon', 'chair', 'sock'] },
                ],
                hard: [
                    { sentence: 'The scientist made an important ___.', correct: 'discovery', distractors: ['blanket', 'staircase', 'whisper'] },
                    { sentence: 'A drought is a long period without ___.', correct: 'rain', distractors: ['friends', 'homework', 'music'] },
                    { sentence: 'The knight showed great ___ in battle.', correct: 'courage', distractors: ['laundry', 'silence', 'furniture'] },
                    { sentence: 'They had to ___ the plan when it started to storm.', correct: 'abandon', distractors: ['celebrate', 'photograph', 'inflate'] },
                    { sentence: 'The old bridge was too ___ to cross safely.', correct: 'fragile', distractors: ['cheerful', 'delicious', 'punctual'] },
                    { sentence: 'The detective looked for a ___ to solve the case.', correct: 'clue', distractors: ['meadow', 'ceiling', 'harvest'] },
                    { sentence: 'The volcano began to ___ without warning.', correct: 'erupt', distractors: ['giggle', 'purchase', 'organize'] },
                    { sentence: 'Heavy rain can ___ the small streams overnight.', correct: 'flood', distractors: ['polish', 'whisper', 'schedule'] },
                    { sentence: 'The team worked hard to ___ their goal.', correct: 'achieve', distractors: ['scatter', 'wrinkle', 'stumble'] },
                    { sentence: 'A thick fog began to ___ over the harbor.', correct: 'drift', distractors: ['sparkle', 'lecture', 'multiply'] },
                ],
            },
        },

        // Capitalization: author the CORRECT sentence. The engine lower-cases it,
        // and the answer key is derived (any word whose first letter is a capital).
        cap: {
            easy: [
                'My dog can run fast.',
                'We went to the park on Monday.',
                'I like to play with Sam.',
                'The cat sat on my lap.',
                'Anna and I read a book.',
                'On Friday we had pizza.',
                'My friend lives in Ohio.',
                'Can Ben come to my house?',
                'We saw a movie on Saturday.',
                'My birthday is in July.',
                'Mr. Diaz teaches our class.',
                'I have a pet named Rex.',
                'The bus goes to Main Street.',
                'Grandpa and I baked bread.',
                'Is it raining in Miami?',
                'Lucy found a shiny rock.',
            ],
            hard: [
                'Last summer we visited Chicago with Aunt Maria.',
                'Doctor Lee said I should drink more water.',
                'The Mississippi River is very long.',
                'On Thanksgiving, Grandma made a huge dinner.',
                'My favorite book is Charlotte\'s Web.',
                'We drove through Texas and New Mexico.',
                'President Lincoln gave a famous speech.',
                'In December, snow fell all over Denver.',
                'The Golden Gate Bridge spans San Francisco Bay.',
                'My cousin studies Spanish at Lincoln High School.',
                'We watched the Fourth of July fireworks near Lake Erie.',
                'Captain Reyes sailed across the Atlantic Ocean.',
                'The Rocky Mountains stretch from Canada to New Mexico.',
                'Every Sunday, Uncle Joe and I visit the Museum of Science.',
                'Did Professor Adams grade the reports about Egypt?',
                'The Nile is the longest river in Africa.',
            ],
        },

        punct: {
            // End marks: sentence WITHOUT terminal punctuation + the right mark.
            end: {
                easy: [
                    { s: 'The dog is brown', correct: '.' },
                    { s: 'Are you my friend', correct: '?' },
                    { s: 'Watch out for the ball', correct: '!' },
                    { s: 'I like ice cream', correct: '.' },
                    { s: 'What is your name', correct: '?' },
                    { s: 'We won the game', correct: '!' },
                    { s: 'My shoes are new', correct: '.' },
                    { s: 'Where did the cat go', correct: '?' },
                    { s: 'That spider is huge', correct: '!' },
                    { s: 'The pond is frozen', correct: '.' },
                    { s: 'Can you help me', correct: '?' },
                    { s: 'Happy birthday to you', correct: '!' },
                ],
                hard: [
                    { s: 'How many planets are in our solar system', correct: '?' },
                    { s: 'The library closes at six o\'clock', correct: '.' },
                    { s: 'That was the best surprise ever', correct: '!' },
                    { s: 'Do you know where the museum is', correct: '?' },
                    { s: 'Please remember to feed the fish', correct: '.' },
                    { s: 'Look out, the volcano is erupting', correct: '!' },
                    { s: 'Which team scored the winning goal', correct: '?' },
                    { s: 'The recipe needs two cups of flour', correct: '.' },
                    { s: 'What an amazing sunset that was', correct: '!' },
                    { s: 'Have you finished reading the chapter yet', correct: '?' },
                    { s: 'Our train leaves the station at noon', correct: '.' },
                    { s: 'Watch out for that falling branch', correct: '!' },
                ],
            },
            // Comma: author WITH commas; engine strips them and asks the learner to
            // tap the gaps where a comma belongs.
            comma: {
                easy: [
                    'I bought apples, pears, and grapes.',
                    'We have red, blue, and green paint.',
                    'She likes cats, dogs, and fish.',
                    'Yes, I will help you.',
                    'Sam, please close the door.',
                    'I need a pen, a ruler, and paper.',
                    'No, I have not seen it.',
                    'We ate pizza, salad, and cake.',
                    'The flag is red, white, and blue.',
                    'Maria, can you hear me?',
                ],
                hard: [
                    'On Monday, we will visit the aquarium, the zoo, and the park.',
                    'After the storm, the sun came out, and the birds sang.',
                    'My aunt, who lives in Maine, is coming to visit.',
                    'We need flour, sugar, eggs, and butter for the cake.',
                    'Well, I think we should leave now.',
                    'Before we go, please turn off the lights, lock the door, and grab your keys.',
                    'The package, which arrived today, was soaking wet.',
                    'She packed sandwiches, apples, and juice, and then she left.',
                    'Yes, I remember, but I still cannot find it.',
                    'On our trip we saw lions, tigers, and bears.',
                ],
            },
            // Apostrophe: contraction / possessive multiple choice.
            apos: {
                easy: [
                    { prompt: '___ raining outside.', correct: "It's", distractors: ['Its'] },
                    { prompt: "That is the ___ bone.", correct: "dog's", distractors: ['dogs'] },
                    { prompt: '___ my turn now.', correct: "It's", distractors: ['Its'] },
                    { prompt: "I ___ know the answer.", correct: "don't", distractors: ['dont'] },
                    { prompt: "This is ___ book.", correct: "Anna's", distractors: ['Annas'] },
                    { prompt: "We ___ going to the park.", correct: "we're", distractors: ['were'] },
                    { prompt: "That is my ___ hat.", correct: "sister's", distractors: ['sisters'] },
                    { prompt: "I ___ finished my lunch.", correct: "haven't", distractors: ['havent'] },
                    { prompt: "Look at the ___ nest.", correct: "bird's", distractors: ['birds'] },
                    { prompt: "___ time to go home.", correct: "It's", distractors: ['Its'] },
                ],
                hard: [
                    { prompt: 'The dog wagged ___ tail.', correct: 'its', distractors: ["it's"] },
                    { prompt: 'All the ___ desks were clean.', correct: "students'", distractors: ["student's", 'students'] },
                    { prompt: "They ___ going to the fair.", correct: "they're", distractors: ['their', 'there'] },
                    { prompt: 'We left ___ coats at home.', correct: 'our', distractors: ['are', 'hour'] },
                    { prompt: "The ___ toys were everywhere.", correct: "children's", distractors: ["childrens'", 'childrens'] },
                    { prompt: "Both ___ bikes had flat tires.", correct: "boys'", distractors: ["boy's", 'boys'] },
                    { prompt: "___ the one who called earlier?", correct: "Who's", distractors: ['Whose'] },
                    { prompt: "The ___ wings were bright orange.", correct: "butterfly's", distractors: ["butterflies'", 'butterflys'] },
                    { prompt: "You ___ leave your bike in the rain.", correct: "shouldn't", distractors: ['shouldnt', "should'nt"] },
                    { prompt: "The ___ manes blew in the wind.", correct: "horses'", distractors: ["horse's", 'horses'] },
                ],
            },
        },

        // Subject & verb: 0-based word indices into the space-split sentence.
        subj: {
            easy: [
                { s: 'The dog barks loudly.', subject: 1, verb: 2 },
                { s: 'My sister sings well.', subject: 1, verb: 2 },
                { s: 'The red ball rolled away.', subject: 2, verb: 3 },
                { s: 'Birds fly south in winter.', subject: 0, verb: 1 },
                { s: 'The baby laughed happily.', subject: 1, verb: 2 },
                { s: 'A big truck honked twice.', subject: 2, verb: 3 },
                { s: 'The bell rang loudly.', subject: 1, verb: 2 },
                { s: 'Two frogs jumped away.', subject: 1, verb: 2 },
                { s: 'My little brother giggled.', subject: 2, verb: 3 },
                { s: 'The tall trees swayed gently.', subject: 2, verb: 3 },
                { s: 'Snow fell all night.', subject: 0, verb: 1 },
                { s: 'The busy bees buzzed nearby.', subject: 2, verb: 3 },
            ],
            hard: [
                { s: 'The curious kitten climbed the tall tree.', subject: 2, verb: 3 },
                { s: 'Our whole class visited the science museum.', subject: 2, verb: 3 },
                { s: 'The old wooden bridge creaked in the wind.', subject: 3, verb: 4 },
                { s: 'Several excited fans cheered for the team.', subject: 2, verb: 3 },
                { s: 'The bright morning sun melted the frost.', subject: 3, verb: 4 },
                { s: 'A flock of geese landed on the pond.', subject: 1, verb: 4 },
                { s: 'The tired travelers rested near the river.', subject: 2, verb: 3 },
                { s: 'A sudden gust of wind slammed the gate.', subject: 2, verb: 5 },
                { s: 'The young scientist recorded her results carefully.', subject: 2, verb: 3 },
                { s: 'The excited puppy chewed a rubber toy.', subject: 2, verb: 3 },
                { s: 'The rusty old gate squeaked on its hinges.', subject: 3, verb: 4 },
                { s: 'Our neighbors planted a garden last spring.', subject: 1, verb: 2 },
            ],
        },

        // Diagramming: author the full sentence in `s` plus the grammatical roles by
        // word. laDiagNormalize() resolves each role word to a token index (repeats
        // resolved left-to-right) so EVERY word maps to exactly one diagram slot.
        // Fields: subject/subjMods, verb/verbMods, object/objMods, iobject{word,mods},
        // subjComp{kind:'PN'|'PA',word,mods}, preps[{prep,object,mods,attach}].
        diag: {
            easy: [
                { s: 'Dogs bark.', subject: 'Dogs', verb: 'bark' },
                { s: 'Birds sing.', subject: 'Birds', verb: 'sing' },
                { s: 'The baby slept.', subject: 'baby', subjMods: ['The'], verb: 'slept' },
                { s: 'The dog chased the cat.', subject: 'dog', subjMods: ['The'], verb: 'chased', object: 'cat', objMods: ['the'] },
                { s: 'The cat drinks milk.', subject: 'cat', subjMods: ['The'], verb: 'drinks', object: 'milk' },
                { s: 'A boy kicked the ball.', subject: 'boy', subjMods: ['A'], verb: 'kicked', object: 'ball', objMods: ['the'] },
                { s: 'Small children build sandcastles.', subject: 'children', subjMods: ['Small'], verb: 'build', object: 'sandcastles' },
                { s: 'The happy dog chased the red ball.', subject: 'dog', subjMods: ['The', 'happy'], verb: 'chased', object: 'ball', objMods: ['the', 'red'] },
            ],
            hard: [
                { s: 'The farmer grows sweet corn.', subject: 'farmer', subjMods: ['The'], verb: 'grows', object: 'corn', objMods: ['sweet'] },
                { s: 'The wind shook the tall trees.', subject: 'wind', subjMods: ['The'], verb: 'shook', object: 'trees', objMods: ['the', 'tall'] },
                { s: 'The old man walked slowly.', subject: 'man', subjMods: ['The', 'old'], verb: 'walked', verbMods: ['slowly'] },
                { s: 'My mother is a teacher.', subject: 'mother', subjMods: ['My'], verb: 'is', subjComp: { kind: 'PN', word: 'teacher', mods: ['a'] } },
                { s: 'The soup smells delicious.', subject: 'soup', subjMods: ['The'], verb: 'smells', subjComp: { kind: 'PA', word: 'delicious' } },
                { s: 'The pitcher threw me the ball.', subject: 'pitcher', subjMods: ['The'], verb: 'threw', iobject: { word: 'me' }, object: 'ball', objMods: ['the'] },
                { s: 'The cat sat on the mat.', subject: 'cat', subjMods: ['The'], verb: 'sat', preps: [{ prep: 'on', object: 'mat', mods: ['the'], attach: 'verb' }] },
                { s: 'The children built a castle in the sand.', subject: 'children', subjMods: ['The'], verb: 'built', object: 'castle', objMods: ['a'], preps: [{ prep: 'in', object: 'sand', mods: ['the'], attach: 'verb' }] },
                { s: 'A girl with red hair sang.', subject: 'girl', subjMods: ['A'], verb: 'sang', preps: [{ prep: 'with', object: 'hair', mods: ['red'], attach: 'subject' }] },
                { s: 'Birds fly to the south.', subject: 'Birds', verb: 'fly', preps: [{ prep: 'to', object: 'south', mods: ['the'], attach: 'verb' }] },
                // Participles work as ordinary adjective modifiers on the noun.
                { s: 'The barking dog scared the mail carrier.', subject: 'dog', subjMods: ['The', 'barking'], verb: 'scared', object: 'carrier', objMods: ['the', 'mail'] },
                { s: 'The frightened kitten hid.', subject: 'kitten', subjMods: ['The', 'frightened'], verb: 'hid' },
                // Adverb clauses: the conjunction rides the dashed connector to the sub-clause.
                { s: 'The dog barked when the mail came.', subject: 'dog', subjMods: ['The'], verb: 'barked', subordinate: { kind: 'adverb', attach: 'verb', conj: 'when', subject: 'mail', subjMods: ['the'], verb: 'came' } },
                { s: 'We stayed inside because it rained.', subject: 'We', verb: 'stayed', verbMods: ['inside'], subordinate: { kind: 'adverb', attach: 'verb', conj: 'because', subject: 'it', verb: 'rained' } },
                { s: 'She smiled after she won.', subject: 'She', verb: 'smiled', subordinate: { kind: 'adverb', attach: 'verb', conj: 'after', subject: 'she', verb: 'won' } },
                // Relative clauses: the relative pronoun sits in its clause slot, joined by a dash.
                { s: 'The book that I read was long.', subject: 'book', subjMods: ['The'], verb: 'was', subjComp: { kind: 'PA', word: 'long' }, subordinate: { kind: 'relative', attach: 'subject', relRole: 'object', subject: 'I', verb: 'read', object: 'that' } },
                { s: 'The dog that barked ran away.', subject: 'dog', subjMods: ['The'], verb: 'ran', verbMods: ['away'], subordinate: { kind: 'relative', attach: 'subject', relRole: 'subject', subject: 'that', verb: 'barked' } },
            ],
        },
    };

    /* ========================================================================
     * SHARED FEEDBACK + SCORE
     * ======================================================================*/
    function setFeedback(el, kind, text) {
        el.textContent = text;
        el.className = 'feedback-display' +
            (kind === 'correct' ? ' la-fb-correct' : kind === 'wrong' ? ' la-fb-wrong' : '');
    }
    function bumpScore(state, scoreEl) {
        state.score++;
        scoreEl.textContent = 'Score: ' + state.score;
    }

    /* Difficulty toggle group wiring. Each mode has a `.tt-btn-group` with
     * `.la-diff-btn[data-la-diff]`. */
    function wireDiff(groupId, state, onChange) {
        document.getElementById(groupId).addEventListener('click', (e) => {
            const btn = e.target.closest('.la-diff-btn');
            if (!btn) return;
            state.diff = btn.dataset.laDiff;
            document.querySelectorAll('#' + groupId + ' .la-diff-btn').forEach((b) =>
                b.classList.toggle('active', b.dataset.laDiff === state.diff));
            onChange();
        });
    }
    function wireSub(groupId, cls, attr, onPick) {
        document.getElementById(groupId).addEventListener('click', (e) => {
            const btn = e.target.closest('.' + cls);
            if (!btn) return;
            document.querySelectorAll('#' + groupId + ' .' + cls).forEach((b) =>
                b.classList.toggle('active', b === btn));
            onPick(btn.dataset[attr]);
        });
    }

    /* 4-choice engine: renders buttons for a {choices, correct} item and handles
     * lock / feedback / advance. `correct` is the index of the right choice. */
    function renderChoices(choicesEl, feedbackEl, item, state, scoreEl, next) {
        choicesEl.innerHTML = '';
        setFeedback(feedbackEl, '', '');
        let locked = false;
        item.choices.forEach((c, i) => {
            const b = document.createElement('button');
            b.className = 'btn btn-secondary la-choice';
            b.textContent = c;
            b.addEventListener('click', () => {
                if (locked) return;
                locked = true;
                if (i === item.correct) {
                    b.classList.add('la-correct');
                    setFeedback(feedbackEl, 'correct', '✓');
                    bumpScore(state, scoreEl);
                    setTimeout(next, 700);
                } else {
                    b.classList.add('la-wrong');
                    choicesEl.children[item.correct].classList.add('la-correct');
                    setFeedback(feedbackEl, 'wrong', '✗');
                    setTimeout(next, 1400);
                }
            });
            choicesEl.appendChild(b);
        });
    }
    // Build a {choices, correct} from a curated {correct, distractors} item.
    function buildChoices(correct, distractors, n) {
        n = n || 4;
        const opts = shuffle(distractors).slice(0, n - 1);
        opts.push(correct);
        const choices = shuffle(opts);
        return { choices, correct: choices.indexOf(correct) };
    }

    /* Tap-in-sentence engine: render word/gap tokens into a host element.
     * tokens: [{text, kind, idx}], onTap(idx). */
    function renderTokens(host, tokens, onTap) {
        host.innerHTML = '';
        tokens.forEach((t) => {
            const span = document.createElement('span');
            span.className = 'la-token la-token-' + t.kind;
            span.dataset.idx = t.idx;
            span.textContent = t.text;
            if (t.kind !== 'static') span.addEventListener('click', () => onTap(t.idx, span));
            host.appendChild(span);
        });
    }

    /* ========================================================================
     * MODE 1 — VOCABULARY  (screen id: la-vocab)
     * ======================================================================*/
    const vocab = { diff: 'easy', sub: 'synonym', score: 0 };
    function vocabInit() {
        vocab.score = 0;
        document.getElementById('la-vocab-score').textContent = 'Score: 0';
        vocabRound();
    }
    function vocabRound() {
        const promptEl = document.getElementById('la-vocab-prompt');
        const choicesEl = document.getElementById('la-vocab-choices');
        const fbEl = document.getElementById('la-vocab-feedback');
        const scoreEl = document.getElementById('la-vocab-score');
        const item = pick(poolFor(LA.vocab[vocab.sub], vocab.diff));
        let promptHTML;
        if (vocab.sub === 'synonym') promptHTML = 'Which word means the <b>same</b> as<br><span class="la-cue">' + item.word + '</span>?';
        else if (vocab.sub === 'antonym') promptHTML = 'Which word means the <b>opposite</b> of<br><span class="la-cue">' + item.word + '</span>?';
        else if (vocab.sub === 'definition') promptHTML = 'What does <span class="la-cue">' + item.word + '</span> mean?';
        else promptHTML = 'Which word fits the blank?<br><span class="la-cue">' + item.sentence + '</span>';
        promptEl.innerHTML = promptHTML;
        const built = buildChoices(item.correct, item.distractors);
        renderChoices(choicesEl, fbEl, built, vocab, scoreEl, vocabRound);
    }

    /* ========================================================================
     * MODE 2 — CAPITALIZATION  (screen id: la-cap)
     * Tap the words that should be capitalized, then Check.
     * ======================================================================*/
    const cap = { diff: 'easy', score: 0, words: [], key: [], state: [], locked: false };
    function capInit() {
        cap.score = 0;
        document.getElementById('la-cap-score').textContent = 'Score: 0';
        capRound();
    }
    function capRound() {
        cap.locked = false;
        const canonical = pick(poolFor(LA.cap, cap.diff)).split(' ');
        cap.words = canonical.map(lowerFirst);          // what we show (lower-cased)
        cap.key = canonical.map(isCapFirst);            // which SHOULD be capital
        cap.state = canonical.map(() => false);         // learner's current choice
        setFeedback(document.getElementById('la-cap-feedback'), '', '');
        capRender();
    }
    function capRender() {
        const host = document.getElementById('la-cap-sentence');
        host.innerHTML = '';
        cap.words.forEach((w, i) => {
            const span = document.createElement('span');
            span.className = 'la-token la-token-word' + (cap.state[i] ? ' la-token-on' : '');
            span.textContent = cap.state[i] ? capFirst(w) : w;
            span.addEventListener('click', () => {
                if (cap.locked) return;
                cap.state[i] = !cap.state[i];
                capRender();
            });
            host.appendChild(span);
        });
    }
    function capCheck() {
        if (cap.locked) return;
        const fb = document.getElementById('la-cap-feedback');
        const ok = cap.state.every((v, i) => v === cap.key[i]);
        if (ok) {
            cap.locked = true;
            setFeedback(fb, 'correct', '✓ Correct!');
            bumpScore(cap, document.getElementById('la-cap-score'));
            setTimeout(capRound, 900);
        } else {
            setFeedback(fb, 'wrong', '✗ Not quite — try again.');
        }
    }

    /* ========================================================================
     * MODE 3 — PUNCTUATION  (screen id: la-punct)
     * Sub-modes: end marks (choice) / comma (tap gaps) / apostrophe (choice).
     * ======================================================================*/
    const punct = { diff: 'easy', sub: 'end', score: 0, gapKey: [], gapState: [], locked: false };
    function punctInit() {
        punct.score = 0;
        document.getElementById('la-punct-score').textContent = 'Score: 0';
        punctShowPanels();
        punctRound();
    }
    function punctShowPanels() {
        document.getElementById('la-punct-choice-panel').classList.toggle('hidden', punct.sub === 'comma');
        document.getElementById('la-punct-comma-panel').classList.toggle('hidden', punct.sub !== 'comma');
    }
    function punctRound() {
        setFeedback(document.getElementById('la-punct-feedback'), '', '');
        if (punct.sub === 'comma') return punctCommaRound();
        return punctChoiceRound();
    }
    function punctChoiceRound() {
        const promptEl = document.getElementById('la-punct-prompt');
        const choicesEl = document.getElementById('la-punct-choices');
        const fbEl = document.getElementById('la-punct-feedback');
        const scoreEl = document.getElementById('la-punct-score');
        if (punct.sub === 'end') {
            const item = pick(poolFor(LA.punct.end, punct.diff));
            promptEl.innerHTML = 'Which end mark belongs here?<br><span class="la-cue">' + item.s + ' __</span>';
            const marks = ['.', '?', '!'];
            const built = { choices: marks, correct: marks.indexOf(item.correct) };
            renderChoices(choicesEl, fbEl, built, punct, scoreEl, punctRound);
        } else { // apostrophe
            const item = pick(poolFor(LA.punct.apos, punct.diff));
            promptEl.innerHTML = 'Choose the correct word.<br><span class="la-cue">' + item.prompt + '</span>';
            const built = buildChoices(item.correct, item.distractors, Math.min(4, item.distractors.length + 1));
            renderChoices(choicesEl, fbEl, built, punct, scoreEl, punctRound);
        }
    }
    function punctCommaRound() {
        punct.locked = false;
        const canonical = pick(poolFor(LA.punct.comma, punct.diff));
        // Split into words; a comma in the source attaches to the preceding word.
        const raw = canonical.replace(/\.$/, '').split(' ');
        const words = [];
        const commaAfter = [];
        raw.forEach((tok) => {
            const hasComma = tok.endsWith(',');
            words.push(hasComma ? tok.slice(0, -1) : tok);
            commaAfter.push(hasComma);
        });
        // Gaps sit between adjacent words: gap i is after word i (0..words.length-2).
        punct.gapKey = commaAfter.slice(0, words.length - 1);
        punct.gapState = punct.gapKey.map(() => false);
        punct.commaWords = words;
        setFeedback(document.getElementById('la-punct-feedback'), '', '');
        punctCommaRender();
    }
    function punctCommaRender() {
        const host = document.getElementById('la-punct-sentence');
        host.innerHTML = '';
        punct.commaWords.forEach((w, i) => {
            const word = document.createElement('span');
            word.className = 'la-token la-token-static';
            word.textContent = w;
            host.appendChild(word);
            if (i < punct.commaWords.length - 1) {
                const gap = document.createElement('span');
                gap.className = 'la-gap' + (punct.gapState[i] ? ' la-gap-on' : '');
                gap.textContent = punct.gapState[i] ? ',' : '·';
                gap.title = 'Tap to add or remove a comma';
                gap.addEventListener('click', () => {
                    if (punct.locked) return;
                    punct.gapState[i] = !punct.gapState[i];
                    punctCommaRender();
                });
                host.appendChild(gap);
            }
        });
    }
    function punctCommaCheck() {
        if (punct.locked) return;
        const fb = document.getElementById('la-punct-feedback');
        const ok = punct.gapState.every((v, i) => v === punct.gapKey[i]);
        if (ok) {
            punct.locked = true;
            setFeedback(fb, 'correct', '✓ Correct!');
            bumpScore(punct, document.getElementById('la-punct-score'));
            setTimeout(punctRound, 900);
        } else {
            setFeedback(fb, 'wrong', '✗ Not quite — try again.');
        }
    }

    /* ========================================================================
     * MODE 4 — SUBJECT & VERB  (screen id: la-subj)
     * Tap the subject (underlined once), then the verb (underlined twice).
     * ======================================================================*/
    const subj = { diff: 'easy', score: 0, item: null, phase: 'subject', picked: {}, locked: false };
    function subjInit() {
        subj.score = 0;
        document.getElementById('la-subj-score').textContent = 'Score: 0';
        subjRound();
    }
    function subjRound() {
        subj.item = pick(poolFor(LA.subj, subj.diff));
        subj.phase = 'subject';
        subj.picked = {};
        subj.locked = false;
        setFeedback(document.getElementById('la-subj-feedback'), '', '');
        subjSetPrompt();
        subjRender();
    }
    function subjSetPrompt() {
        const p = document.getElementById('la-subj-prompt');
        if (subj.phase === 'subject') p.innerHTML = 'Tap the <b>subject</b> <span class="la-hint">(underline once)</span>';
        else p.innerHTML = 'Tap the <b>verb</b> <span class="la-hint">(underline twice)</span>';
    }
    function subjRender() {
        const host = document.getElementById('la-subj-sentence');
        host.innerHTML = '';
        subj.item.s.split(' ').forEach((w, i) => {
            const span = document.createElement('span');
            let cls = 'la-token la-token-word';
            if (subj.picked.subject === i) cls += ' la-underline-once';
            if (subj.picked.verb === i) cls += ' la-underline-twice';
            span.className = cls;
            span.textContent = w;
            span.addEventListener('click', () => subjTap(i));
            host.appendChild(span);
        });
    }
    function subjTap(i) {
        if (subj.locked) return;
        if (subj.phase === 'subject') {
            subj.picked.subject = i;
            subj.phase = 'verb';
            subjSetPrompt();
            subjRender();
        } else {
            if (i === subj.picked.subject) return; // can't be both
            subj.picked.verb = i;
            subjRender();
            subjCheck();
        }
    }
    function subjCheck() {
        subj.locked = true;
        const fb = document.getElementById('la-subj-feedback');
        const ok = subj.picked.subject === subj.item.subject && subj.picked.verb === subj.item.verb;
        if (ok) {
            setFeedback(fb, 'correct', '✓ Correct!');
            bumpScore(subj, document.getElementById('la-subj-score'));
            setTimeout(subjRound, 1000);
        } else {
            // Reveal the correct answer briefly, then re-ask.
            const host = document.getElementById('la-subj-sentence');
            host.querySelectorAll('.la-token').forEach((el, i) => {
                el.classList.remove('la-underline-once', 'la-underline-twice');
                if (i === subj.item.subject) el.classList.add('la-underline-once');
                if (i === subj.item.verb) el.classList.add('la-underline-twice');
            });
            setFeedback(fb, 'wrong', '✗ The answer is shown — here comes another.');
            setTimeout(subjRound, 1800);
        }
    }

    /* ========================================================================
     * MODE 5 — SENTENCE DIAGRAMMING  (screen id: la-diag)
     * Pointer-drag word chips onto a Reed-Kellogg skeleton. Touch-safe (no HTML5
     * drag-and-drop, which doesn't fire on touch devices).
     * ======================================================================*/
    const diag = { diff: 'easy', mode: 'fill', score: 0, item: null, tokens: [], slots: [], assign: {}, chips: null, layout: null, locked: false, advanceTimer: null };
    // Approximate text measurement for sizing slots/lines (font may not be loaded yet).
    let _diagCtx = null;
    function laMeasure(t) {
        if (!_diagCtx) { _diagCtx = document.createElement('canvas').getContext('2d'); _diagCtx.font = "700 18px Fredoka, sans-serif"; }
        return _diagCtx.measureText(t).width;
    }

    function diagInit() {
        diag.score = 0;
        diag.chips = null; // fresh chip set on (re)entry
        document.getElementById('la-diag-score').textContent = 'Score: 0';
        if (diag.mode === 'build') buildRound(); else diagRound();
    }
    function diagSetMode(m) {
        diag.mode = m;
        document.querySelectorAll('.la-diag-mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
        document.getElementById('la-build-tools').classList.toggle('hidden', m !== 'build');
        if (m === 'build') buildRound();
        else { diag.chips = null; diagRound(); }
    }
    function diagRefresh() { if (diag.mode === 'build') buildRound(); else { diag.chips = null; diagRound(); } }
    /* Normalize an authored item into { tokens, spec }. Every role word is resolved
     * to a token index (repeats consumed left-to-right in canonical sentence order),
     * so in a complete diagram every token maps to exactly one slot. */
    function laDiagNormalize(item) {
        const tokens = item.s.replace(/[.?!]+$/, '').split(/\s+/);
        const used = new Array(tokens.length).fill(false);
        const norm = (w) => w.replace(/[.,?!;:]+$/, '').toLowerCase();
        function resolve(word) {
            const target = norm(word);
            for (let i = 0; i < tokens.length; i++) {
                if (!used[i] && norm(tokens[i]) === target) { used[i] = true; return i; }
            }
            return -1;
        }
        const spec = {};
        spec.subject = { tok: resolve(item.subject), mods: (item.subjMods || []).map(resolve) };
        spec.verb = { tok: resolve(item.verb), mods: (item.verbMods || []).map(resolve) };
        if (item.iobject) spec.iobject = { tok: resolve(item.iobject.word), mods: (item.iobject.mods || []).map(resolve) };
        if (item.object) spec.object = { tok: resolve(item.object), mods: (item.objMods || []).map(resolve) };
        if (item.subjComp) spec.subjComp = { kind: item.subjComp.kind, tok: resolve(item.subjComp.word), mods: (item.subjComp.mods || []).map(resolve) };
        spec.preps = (item.preps || []).map((p) => ({
            tok: resolve(p.prep), attach: p.attach || 'verb',
            object: { tok: resolve(p.object), mods: (p.mods || []).map(resolve) },
        }));
        // Subordinate clause (resolved AFTER the main clause so shared duplicate words
        // are consumed in sentence order). kind 'adverb' rides a conjunction on the
        // dashed connector; kind 'relative' puts the relative pronoun in a clause slot.
        if (item.subordinate) {
            const sub = item.subordinate;
            const subSpec = {
                subject: { tok: resolve(sub.subject), mods: (sub.subjMods || []).map(resolve) },
                verb: { tok: resolve(sub.verb), mods: (sub.verbMods || []).map(resolve) },
                preps: [],
            };
            if (sub.iobject) subSpec.iobject = { tok: resolve(sub.iobject.word), mods: (sub.iobject.mods || []).map(resolve) };
            if (sub.object) subSpec.object = { tok: resolve(sub.object), mods: (sub.objMods || []).map(resolve) };
            if (sub.subjComp) subSpec.subjComp = { kind: sub.subjComp.kind, tok: resolve(sub.subjComp.word), mods: (sub.subjComp.mods || []).map(resolve) };
            spec.subordinate = {
                spec: subSpec,
                kind: sub.kind || 'adverb',
                attach: sub.attach || 'verb',
                relRole: sub.relRole || null,
                conjTok: sub.conj ? resolve(sub.conj) : -1,
            };
        }
        return { tokens, spec };
    }

    /* Two-pass Reed-Kellogg layout. Returns SVG primitives, drop slots (each with an
     * `expect` token index), text labels, and the diagram's intrinsic {w,h}. */
    const D = { PAD: 26, LINE_Y: 64, SLOT_H: 30, WMIN: 46, GAPD: 13, MOD_DY: 42, MOD_DX: 26, PREP_DY: 46, PREP_DX: 24 };
    const LBL = { subject: 'subject', verb: 'verb', object: 'object', comp: 'complement', iobject: 'indirect' };
    // Lay out a single clause anchored at (ox, oy). idp namespaces slot ids so a main
    // clause and a subordinate clause don't collide. Returns heads (role -> cx) too.
    function laDiagLayout(spec, tokens, ox, oy, idp) {
        ox = ox == null ? D.PAD : ox;
        oy = oy == null ? D.LINE_Y : oy;
        idp = idp || '';
        const lines = [], slots = [], labels = [];
        let maxX = 0, maxY = oy + D.SLOT_H;
        const bump = (x, y) => { if (x > maxX) maxX = x; if (y > maxY) maxY = y; };
        const r = (n) => Math.round(n * 10) / 10;
        const L = (x1, y1, x2, y2, cls) => `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" class="la-diag-line${cls ? ' ' + cls : ''}"/>`;
        const wslot = (tok) => Math.max(D.WMIN, laMeasure(tokens[tok]) + 16);
        const heads = {};

        // ---- Phase 1: baseline (subject | verb | object/complement) ----
        let x = ox;
        function baseWord(node, role, id) {
            const w = wslot(node.tok);
            const cx = x + w / 2;
            slots.push({ id: idp + id, role, expect: node.tok, cx, cy: oy - D.SLOT_H / 2 - 3, w });
            if (LBL[role]) labels.push({ x: cx, y: oy - D.SLOT_H - 8, text: LBL[role] });
            heads[id] = cx;
            x += w; bump(x + D.PAD, oy + D.SLOT_H);
        }
        baseWord(spec.subject, 'subject', 'subject');
        x += D.GAPD; const dv1 = x; x += D.GAPD;
        lines.push(L(dv1, oy - 26, dv1, oy + 14));                 // subject|verb crosses the line
        baseWord(spec.verb, 'verb', 'verb');
        if (spec.object) {
            x += D.GAPD; const dv2 = x; x += D.GAPD;
            lines.push(L(dv2, oy - 26, dv2, oy));                  // verb|object sits on the line
            baseWord(spec.object, 'object', 'object');
        } else if (spec.subjComp) {
            x += D.GAPD; const dv2 = x; x += D.GAPD;
            lines.push(L(dv2, oy, dv2 - 16, oy - 22, 'la-diag-slant')); // complement line leans toward subject
            baseWord(spec.subjComp, 'comp', 'comp');
        }
        const baseRight = x;
        lines.unshift(L(ox - 8, oy, baseRight + 8, oy));        // baseline (behind everything)
        bump(baseRight + D.PAD, oy + D.SLOT_H);

        // ---- Phase 2: hang danglers (modifiers, prep phrases, indirect object) ----
        // A head can carry several danglers at once (e.g. an article AND a prep phrase),
        // so they are spread left-to-right under the head instead of stacked on one point.
        function widthOf(tok) { return D.MOD_DX + wslot(tok) + 8; }
        function prepWidth(p) {
            const objMods = p.object.mods || [];
            return Math.max(D.PREP_DX + wslot(p.object.tok) + 24, (objMods.length ? (objMods.length - 1) * 30 + D.MOD_DX + wslot(objMods[0]) : 0)) + 8;
        }
        function ioWidth(node) { return D.PREP_DX + wslot(node.tok) + 24 + 8; }

        function addModAt(topX, tok, id) {
            const botX = topX + D.MOD_DX, botY = oy + D.MOD_DY;
            lines.push(L(topX, oy + 1, botX, botY, 'la-diag-slant'));
            const w = wslot(tok);
            slots.push({ id, role: 'modifier', expect: tok, cx: (topX + botX) / 2 + w / 2, cy: (oy + 1 + botY) / 2 + 4, w });
            bump(botX + w, botY + D.SLOT_H);
        }
        // slant down from topX to a horizontal carrying `node` (+ its own modifiers)
        function addHorizObject(kx, ky, node, idBase) {
            const ow = wslot(node.tok), horizW = ow + 24;
            lines.push(L(kx, ky, kx + horizW, ky));
            slots.push({ id: idBase, role: 'object', expect: node.tok, cx: kx + horizW / 2, cy: ky - D.SLOT_H / 2 - 2, w: ow });
            bump(kx + horizW + D.PAD, ky + 4);
            (node.mods || []).forEach((tok, i) => {
                const sp = 30, total = ((node.mods.length) - 1) * sp;
                const topX = (kx + horizW / 2) - total / 2 + i * sp, botX = topX + D.MOD_DX, botY = ky + D.MOD_DY;
                lines.push(L(topX, ky + 1, botX, botY, 'la-diag-slant'));
                const w = wslot(tok);
                slots.push({ id: idBase + 'm' + i, role: 'modifier', expect: tok, cx: (topX + botX) / 2 + w / 2, cy: (ky + 1 + botY) / 2 + 4, w });
                bump(botX + w, botY + D.SLOT_H);
            });
        }
        function addPrepAt(topX, p, id) {
            const kx = topX + D.PREP_DX, ky = oy + D.PREP_DY;
            lines.push(L(topX, oy + 1, kx, ky, 'la-diag-slant'));
            const pw = wslot(p.tok);
            slots.push({ id, role: 'prep', expect: p.tok, cx: (topX + kx) / 2 + pw / 2 - 2, cy: (oy + ky) / 2, w: pw });
            addHorizObject(kx, ky, p.object, id + 'o');
        }
        function addIOAt(topX, node, id) {
            const kx = topX + D.PREP_DX, ky = oy + D.PREP_DY;
            lines.push(L(topX, oy + 1, kx, ky, 'la-diag-slant'));
            labels.push({ x: kx + (wslot(node.tok) + 24) / 2, y: ky + 16, text: 'indirect' });
            addHorizObject(kx, ky, node, id);
        }

        // Gather every dangler for a head, then lay them out side by side.
        function placeDanglers(headId, modList, idPfx) {
            const hx = heads[headId];
            if (hx === undefined) return;
            const dl = [];
            (modList || []).forEach((tok, i) => dl.push({ type: 'mod', tok, id: idp + idPfx + i, w: widthOf(tok) }));
            (spec.preps || []).forEach((p, pi) => {
                let at = p.attach || 'verb';
                if (at === 'object' && heads['object'] === undefined) at = 'verb';
                if (at === headId) dl.push({ type: 'prep', prep: p, id: idp + 'prep' + pi, w: prepWidth(p) });
            });
            if (headId === 'verb' && spec.iobject) dl.push({ type: 'io', node: spec.iobject, id: idp + 'iobject', w: ioWidth(spec.iobject) });
            if (!dl.length) return;
            const gap = 8;
            const totalW = dl.reduce((a, d) => a + d.w, 0) + gap * (dl.length - 1);
            let cx = hx - totalW / 2;
            dl.forEach((d) => {
                const aX = cx + 4;
                if (d.type === 'mod') addModAt(aX, d.tok, d.id);
                else if (d.type === 'prep') addPrepAt(aX, d.prep, d.id);
                else addIOAt(aX, d.node, d.id);
                cx += d.w + gap;
            });
        }
        placeDanglers('subject', spec.subject.mods, 'sm');
        placeDanglers('verb', spec.verb.mods, 'vm');
        if (spec.object) placeDanglers('object', spec.object.mods, 'om');
        if (spec.subjComp) placeDanglers('comp', spec.subjComp.mods, 'cm');

        return { lines, slots, labels, heads, w: Math.ceil(maxX), h: Math.ceil(maxY + D.PAD) };
    }

    // Compose a main clause with an optional subordinate clause (adverb or relative),
    // joined by a dashed connector. Verbal phrases (gerund/infinitive/participle) are
    // handled inside the clause layout via their spec nodes.
    function laDiagLayoutFull(spec, tokens) {
        const main = laDiagLayout(spec, tokens, D.PAD, D.LINE_Y, '');
        let lines = main.lines.slice(), slots = main.slots.slice(), labels = main.labels.slice();
        let w = main.w, h = main.h;
        if (spec.subordinate) {
            const so = spec.subordinate;
            const subOY = h + 16;
            const attachCx = (main.heads[so.attach] != null) ? main.heads[so.attach] : main.heads['verb'];
            const subOX = Math.max(D.PAD, attachCx - 50);
            const sub = laDiagLayout(so.spec, tokens, subOX, subOY, 'sub_');
            lines = lines.concat(sub.lines); slots = slots.concat(sub.slots); labels = labels.concat(sub.labels);
            w = Math.max(w, sub.w); h = Math.max(h, sub.h);
            const r = (n) => Math.round(n * 10) / 10;
            const fromX = attachCx, fromY = D.LINE_Y + D.SLOT_H / 2 + 2;
            const toRole = so.kind === 'relative' ? (so.relRole === 'subject' ? 'subject' : 'object') : 'verb';
            const toX = (sub.heads[toRole] != null) ? sub.heads[toRole] : sub.heads['verb'];
            const toY = subOY - D.SLOT_H / 2 - 3;
            lines.push(`<line x1="${r(fromX)}" y1="${r(fromY)}" x2="${r(toX)}" y2="${r(toY)}" class="la-diag-line la-diag-dash"/>`);
            if (so.conjTok >= 0) {   // subordinating conjunction rides the dashed line
                const mx = (fromX + toX) / 2, my = (fromY + toY) / 2;
                slots.push({ id: 'subconj', role: 'conj', expect: so.conjTok, cx: mx, cy: my, w: Math.max(D.WMIN, laMeasure(tokens[so.conjTok]) + 12) });
            }
        }
        return { lines, slots, labels, w: Math.ceil(w), h: Math.ceil(h) };
    }

    // Debug audit (used by tests): every diag item must map all tokens bijectively to slots.
    window.__laDiagAudit = function () {
        const problems = [];
        ['easy', 'hard'].forEach((tier) => (LA.diag[tier] || []).forEach((item, idx) => {
            try {
                const n = laDiagNormalize(item);
                const lay = laDiagLayoutFull(n.spec, n.tokens);
                const expects = lay.slots.map((s) => s.expect).sort((a, b) => a - b);
                const ok = expects.length === n.tokens.length && expects.every((v, i) => v === i);
                if (!ok) problems.push({ tier, idx, s: item.s, tokens: n.tokens.length, slots: lay.slots.length, expects });
            } catch (err) { problems.push({ tier, idx, s: item.s, error: String(err) }); }
        }));
        return problems;
    };
    // Debug: correct slotId -> tokenIndex for the diagram currently on screen.
    window.__laDiagAnswer = function () {
        const a = {};
        diag.slots.forEach((s) => { a[s.id] = s.expect; });
        return a;
    };
    // Debug: force a specific item (deterministic tests).
    window.__laDiagForce = function (tier, idx) { diag.locked = false; diagRound(LA.diag[tier][idx]); };
    window.__laDiagCounts = function () { return { easy: LA.diag.easy.length, hard: LA.diag.hard.length }; };
    function diagRound(forceItem) {
        if (diag.advanceTimer) { clearTimeout(diag.advanceTimer); diag.advanceTimer = null; }
        diag.locked = false;
        diag.assign = {};
        diag.item = forceItem || pick(poolFor(LA.diag, diag.diff));
        const norm = laDiagNormalize(diag.item);
        diag.tokens = norm.tokens;
        const lay = laDiagLayoutFull(norm.spec, norm.tokens);
        diag.layout = lay;
        diag.slots = lay.slots;
        diag.chips = norm.tokens.map((w, i) => ({ id: 'c' + i, word: w, tok: i }));
        setFeedback(document.getElementById('la-diag-feedback'), '', '');
        document.getElementById('la-diag-prompt').textContent = 'Drag each word onto the diagram.';

        const stage = document.getElementById('la-diag-stage');
        // Match the stage box aspect to the viewBox so the HTML slot overlay (positioned
        // by %) lines up exactly with the scaled SVG (xMidYMid meet, no letterboxing).
        stage.style.aspectRatio = lay.w + ' / ' + lay.h;
        stage.innerHTML =
            `<svg viewBox="0 0 ${lay.w} ${lay.h}" class="la-diag-svg" preserveAspectRatio="xMidYMid meet">` +
            lay.lines.join('') +
            lay.labels.map((l) => `<text x="${l.x}" y="${l.y}" class="la-diag-slotlabel">${l.text}</text>`).join('') +
            `</svg>`;
        lay.slots.forEach((s) => {
            const el = document.createElement('div');
            el.className = 'la-diag-slot';
            el.dataset.slot = s.id;
            el.style.left = (s.cx / lay.w * 100) + '%';
            el.style.top = (s.cy / lay.h * 100) + '%';
            el.style.width = (s.w / lay.w * 100) + '%';
            stage.appendChild(el);
        });
        diagRender();
    }
    // Render tray (full sentence, in order; placed words shown greyed but still visible)
    // and the chips sitting in their diagram slots.
    function diagRender() {
        const stage = document.getElementById('la-diag-stage');
        stage.querySelectorAll('.la-diag-chip').forEach((c) => c.remove());
        stage.querySelectorAll('.la-diag-slot').forEach((s) => s.classList.remove('la-slot-filled'));
        const tray = document.getElementById('la-diag-tray');
        tray.innerHTML = '';
        const placedTok = {}; // tokenIndex -> slotId
        Object.keys(diag.assign).forEach((sid) => { placedTok[diag.assign[sid]] = sid; });

        // Tray: every sentence word, in order. Placed ones stay visible but greyed.
        diag.chips.forEach((chip) => {
            const used = placedTok[chip.tok] !== undefined;
            const b = document.createElement('div');
            b.className = 'la-diag-chip la-diag-bubble' + (used ? ' la-bubble-used' : '');
            b.textContent = chip.word;
            if (!used) diagAttachDrag(b, chip.tok);
            tray.appendChild(b);
        });
        // Placed chips over their slots.
        Object.keys(diag.assign).forEach((sid) => {
            const tok = diag.assign[sid];
            const slotEl = stage.querySelector('.la-diag-slot[data-slot="' + sid + '"]');
            if (!slotEl) return;
            slotEl.classList.add('la-slot-filled');
            const el = document.createElement('div');
            el.className = 'la-diag-chip la-diag-chip-placed';
            el.textContent = diag.tokens[tok];
            el.style.left = slotEl.style.left;
            el.style.top = slotEl.style.top;
            diagAttachDrag(el, tok);
            stage.appendChild(el);
        });
    }
    // Drag a token (from tray or a slot). Drop on a slot to place; drop elsewhere to return it.
    function diagAttachDrag(el, tok) {
        el.addEventListener('pointerdown', (e) => {
            if (diag.locked) return;
            e.preventDefault();
            const stage = document.getElementById('la-diag-stage');
            const ghost = el.cloneNode(true);
            ghost.classList.add('la-diag-ghost');
            ghost.classList.remove('la-bubble-used');
            document.body.appendChild(ghost);
            el.classList.add('la-diag-dragging');
            const move = (ev) => { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; };
            const up = (ev) => {
                document.removeEventListener('pointermove', move);
                document.removeEventListener('pointerup', up);
                ghost.remove();
                el.classList.remove('la-diag-dragging');
                let target = null;
                stage.querySelectorAll('.la-diag-slot').forEach((slotEl) => {
                    const r = slotEl.getBoundingClientRect();
                    if (ev.clientX >= r.left && ev.clientX <= r.right &&
                        ev.clientY >= r.top && ev.clientY <= r.bottom) target = slotEl.dataset.slot;
                });
                Object.keys(diag.assign).forEach((k) => { if (diag.assign[k] === tok) delete diag.assign[k]; });
                if (target) {
                    if (diag.assign[target] !== undefined) delete diag.assign[target]; // bump the previous word back
                    diag.assign[target] = tok;
                }
                diagRender();
            };
            document.addEventListener('pointermove', move);
            document.addEventListener('pointerup', up);
            move(e);
        });
    }
    function diagCheck() {
        if (diag.locked) return;
        const fb = document.getElementById('la-diag-feedback');
        const allFilled = diag.slots.every((s) => diag.assign[s.id] !== undefined);
        if (!allFilled) {
            setFeedback(fb, 'wrong', 'Place every word first.');
            return;
        }
        // Grade by word (duplicate identical words are interchangeable between their slots).
        const lc = (t) => (diag.tokens[t] || '').toLowerCase();
        const ok = diag.slots.every((s) => lc(diag.assign[s.id]) === lc(s.expect));
        if (ok) {
            diag.locked = true;
            setFeedback(fb, 'correct', '✓ Correct!');
            bumpScore(diag, document.getElementById('la-diag-score'));
            diag.advanceTimer = setTimeout(diagRound, 1200);
        } else {
            setFeedback(fb, 'wrong', '✗ Some words are in the wrong place.');
        }
    }
    function diagReset() {
        if (diag.locked) return;
        diag.assign = {};
        diagRender();
        setFeedback(document.getElementById('la-diag-feedback'), '', '');
    }

    /* ========================================================================
     * BUILD MODE — construct the diagram with guided gestures:
     *   1. Tap the baseline to split it into subject | verb.
     *   2. Drag the subject to the left region, the verb to the right.
     *   3. Drag a word after the verb (object/complement; pick the connector type).
     *   4. Drag a word ONTO a placed word to subordinate it (a modifier).
     * Graded structurally against the answer (by word + role + head role), so the
     * gestures are free-form-feeling but auto-checkable. Build uses simple sentences
     * only (no prepositional phrases, clauses, or verbals).
     * ======================================================================*/
    const BW = 600, BH = 210, BY = 95;
    const build = { item: null, tokens: [], answer: null, split: false, assign: {}, compType: 'object', locked: false };
    const inRect = (ev, r) => ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;

    function buildPool() {
        const simple = (it) => !it.preps && !it.iobject && !it.subordinate;
        const easy = LA.diag.easy.filter(simple), hard = LA.diag.hard.filter(simple);
        const pool = diag.diff === 'hard' ? (hard.length ? hard : easy) : diag.diff === 'mixed' ? easy.concat(hard) : easy;
        return pool.length ? pool : LA.diag.easy;
    }
    function buildAnswerRoles(spec) {
        const roles = {};
        roles[spec.subject.tok] = { role: 'subject' };
        (spec.subject.mods || []).forEach((t) => roles[t] = { role: 'mod', head: 'subject' });
        roles[spec.verb.tok] = { role: 'verb' };
        (spec.verb.mods || []).forEach((t) => roles[t] = { role: 'mod', head: 'verb' });
        if (spec.object) {
            roles[spec.object.tok] = { role: 'object' };
            (spec.object.mods || []).forEach((t) => roles[t] = { role: 'mod', head: 'object' });
        } else if (spec.subjComp) {
            roles[spec.subjComp.tok] = { role: 'comp' };
            (spec.subjComp.mods || []).forEach((t) => roles[t] = { role: 'mod', head: 'comp' });
        }
        return roles;
    }
    function buildRound(forceItem) {
        if (diag.advanceTimer) { clearTimeout(diag.advanceTimer); diag.advanceTimer = null; }
        build.locked = false; build.split = false; build.assign = {}; build.compType = 'object';
        build.item = forceItem || pick(buildPool());
        const norm = laDiagNormalize(build.item);
        build.tokens = norm.tokens;
        build.answer = buildAnswerRoles(norm.spec);
        document.querySelectorAll('.la-ctype-btn').forEach((b) => b.classList.toggle('active', b.dataset.ctype === 'object'));
        setFeedback(document.getElementById('la-diag-feedback'), '', '');
        buildRender();
    }
    function buildPrompt() {
        const p = document.getElementById('la-diag-prompt');
        const hasSubj = Object.values(build.assign).some((a) => a.role === 'subject');
        const hasVerb = Object.values(build.assign).some((a) => a.role === 'verb');
        if (!build.split) p.innerHTML = '<b>1.</b> Tap the line to split the <b>subject</b> and <b>verb</b>.';
        else if (!hasSubj || !hasVerb) p.innerHTML = '<b>2.</b> Drag the <b>subject</b> to the left, the <b>verb</b> to the right.';
        else p.innerHTML = 'Drag a word <b>onto another word</b> to make it a modifier. Drop objects after the verb.';
    }
    function buildRender() {
        const stage = document.getElementById('la-diag-stage');
        stage.style.aspectRatio = BW + ' / ' + BH;
        const line = (x1, y1, x2, y2, cls) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="la-diag-line${cls ? ' ' + cls : ''}"/>`;
        const parts = [line(20, BY, 580, BY)];
        const zones = [];
        const heads = {};
        const tail = Object.entries(build.assign).find((e) => e[1].role === 'object' || e[1].role === 'comp');
        const tailRole = tail ? tail[1].role : null;
        let labelsSVG = '';
        if (build.split) {
            parts.push(line(250, BY - 26, 250, BY + 14));      // subject|verb divider (crosses)
            heads.subject = 150; heads.verb = 350;
            zones.push({ zone: 'subject', cx: 150 }, { zone: 'verb', cx: 350 }, { zone: 'tail', cx: 520 });
            if (build.compType === 'comp') parts.push(line(440, BY, 424, BY - 20, 'la-diag-slant'));
            else parts.push(line(440, BY - 26, 440, BY));
            heads[tailRole || 'object'] = 520;
            labelsSVG = `<text x="150" y="${BY - 40}" class="la-diag-slotlabel">subject</text>` +
                `<text x="350" y="${BY - 40}" class="la-diag-slotlabel">verb</text>` +
                `<text x="520" y="${BY - 40}" class="la-diag-slotlabel">${build.compType === 'comp' ? 'complement' : 'object'}</text>`;
        }
        // modifiers under their heads
        const modsByHead = {};
        Object.entries(build.assign).forEach((e) => { if (e[1].role === 'mod') (modsByHead[e[1].head] = modsByHead[e[1].head] || []).push(+e[0]); });
        const modSlot = {};
        Object.keys(modsByHead).forEach((hr) => {
            const hx = heads[hr] != null ? heads[hr] : (hr === 'verb' ? 350 : (hr === 'object' || hr === 'comp') ? 520 : 150);
            const list = modsByHead[hr], sp = 44, total = (list.length - 1) * sp;
            list.forEach((tok, i) => {
                const topX = hx - total / 2 + i * sp, botX = topX + 24, botY = BY + 42;
                parts.push(line(topX, BY + 1, botX, botY, 'la-diag-slant'));
                modSlot[tok] = { cx: (topX + botX) / 2 + 14, cy: (BY + botY) / 2 + 6 };
            });
        });
        stage.innerHTML = `<svg viewBox="0 0 ${BW} ${BH}" class="la-diag-svg" preserveAspectRatio="xMidYMid meet">${parts.join('')}${labelsSVG}</svg>`;
        // tap-to-split bar
        if (!build.split) {
            const bar = document.createElement('div');
            bar.className = 'la-build-splitbar';
            bar.title = 'Tap to split the line';
            bar.addEventListener('click', () => { if (!build.locked) { build.split = true; buildRender(); buildPrompt(); } });
            stage.appendChild(bar);
        }
        // drop zones
        zones.forEach((z) => {
            const el = document.createElement('div');
            el.className = 'la-build-zone';
            el.dataset.zone = z.zone;
            el.style.left = (z.cx / BW * 100) + '%';
            el.style.top = ((BY - 18) / BH * 100) + '%';
            stage.appendChild(el);
        });
        // placed chips
        Object.entries(build.assign).forEach((e) => {
            const tok = +e[0], a = e[1];
            let cx, cy, headRole = null;
            if (a.role === 'subject') { cx = 150; cy = BY - 18; headRole = 'subject'; }
            else if (a.role === 'verb') { cx = 350; cy = BY - 18; headRole = 'verb'; }
            else if (a.role === 'object' || a.role === 'comp') { cx = 520; cy = BY - 18; headRole = a.role; }
            else if (a.role === 'mod' && modSlot[tok]) { cx = modSlot[tok].cx; cy = modSlot[tok].cy; }
            if (cx == null) return;
            const el = document.createElement('div');
            el.className = 'la-diag-chip la-diag-chip-placed';
            el.textContent = build.tokens[tok];
            el.style.left = (cx / BW * 100) + '%';
            el.style.top = (cy / BH * 100) + '%';
            if (headRole) el.dataset.headRole = headRole;
            buildDrag(el, tok);
            stage.appendChild(el);
        });
        // tray (full sentence, placed words greyed)
        const tray = document.getElementById('la-diag-tray');
        tray.innerHTML = '';
        build.tokens.forEach((w, tok) => {
            const used = build.assign[tok] !== undefined;
            const b = document.createElement('div');
            b.className = 'la-diag-chip la-diag-bubble' + (used ? ' la-bubble-used' : '');
            b.textContent = w;
            if (!used) buildDrag(b, tok);
            tray.appendChild(b);
        });
        buildPrompt();
    }
    function buildDrag(el, tok) {
        el.addEventListener('pointerdown', (e) => {
            if (build.locked) return;
            e.preventDefault();
            const stage = document.getElementById('la-diag-stage');
            const ghost = el.cloneNode(true);
            ghost.classList.add('la-diag-ghost');
            ghost.classList.remove('la-bubble-used');
            document.body.appendChild(ghost);
            el.classList.add('la-diag-dragging');
            const move = (ev) => { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; };
            const up = (ev) => {
                document.removeEventListener('pointermove', move);
                document.removeEventListener('pointerup', up);
                ghost.remove();
                el.classList.remove('la-diag-dragging');
                let headRole = null, zone = null;
                // Prefer dropping ONTO a placed head word (the "subordinate" gesture).
                stage.querySelectorAll('.la-diag-chip-placed[data-head-role]').forEach((ch) => {
                    if (ch === el) return;
                    if (inRect(ev, ch.getBoundingClientRect())) headRole = ch.dataset.headRole;
                });
                if (!headRole) stage.querySelectorAll('.la-build-zone').forEach((z) => {
                    if (inRect(ev, z.getBoundingClientRect())) zone = z.dataset.zone;
                });
                delete build.assign[tok];
                if (headRole) build.assign[tok] = { role: 'mod', head: headRole };
                else if (zone === 'subject') build.assign[tok] = { role: 'subject' };
                else if (zone === 'verb') build.assign[tok] = { role: 'verb' };
                else if (zone === 'tail') build.assign[tok] = { role: build.compType };
                buildRender();
            };
            document.addEventListener('pointermove', move);
            document.addEventListener('pointerup', up);
            move(e);
        });
    }
    function buildSetCompType(t) {
        build.compType = t;
        Object.keys(build.assign).forEach((tok) => { const a = build.assign[tok]; if (a.role === 'object' || a.role === 'comp') build.assign[tok] = { role: t }; });
        buildRender();
    }
    function buildSig(roles) {
        return Object.keys(roles).map((tok) => {
            const r = roles[tok], w = (build.tokens[tok] || '').toLowerCase();
            return r.role === 'mod' ? ('mod:' + w + '@' + r.head) : (r.role + ':' + w);
        }).sort();
    }
    function buildCheck() {
        if (build.locked) return;
        const fb = document.getElementById('la-diag-feedback');
        if (Object.keys(build.assign).length !== build.tokens.length) {
            setFeedback(fb, 'wrong', 'Place every word first.');
            return;
        }
        const a = buildSig(build.assign), b = buildSig(build.answer);
        const ok = a.length === b.length && a.every((v, i) => v === b[i]);
        if (ok) {
            build.locked = true;
            setFeedback(fb, 'correct', '✓ Correct!');
            bumpScore(diag, document.getElementById('la-diag-score'));
            diag.advanceTimer = setTimeout(() => { if (diag.mode === 'build') buildRound(); }, 1200);
        } else {
            setFeedback(fb, 'wrong', '✗ Not quite — check the structure.');
        }
    }
    function buildReset() {
        if (build.locked) return;
        build.assign = {};
        buildRender();
        setFeedback(document.getElementById('la-diag-feedback'), '', '');
    }
    // Debug hooks (tests).
    window.__laBuildForce = function (tier, idx) {
        const pool = buildPool();
        buildRound(pool[idx % pool.length]);
        return { s: build.item.s, poolSize: pool.length };
    };
    window.__laBuildAnswer = function () { return build.answer; };
    window.__laBuildState = function () { return { split: build.split, assign: build.assign, compType: build.compType }; };

    /* ========================================================================
     * SCREEN HTML (injected — keeps index.html untouched beyond one <script>)
     * ======================================================================*/
    function diffGroup(mode) {
        return '<div class="tt-btn-group la-diff-group" id="la-' + mode + '-diff">' +
            '<button class="btn btn-secondary la-diff-btn active" data-la-diff="easy">Easy</button>' +
            '<button class="btn btn-secondary la-diff-btn" data-la-diff="hard">Hard</button>' +
            '<button class="btn btn-secondary la-diff-btn" data-la-diff="mixed">Mixed</button>' +
            '</div>';
    }
    function scoreBar(mode) {
        return '<div class="la-score-bar"><span id="la-' + mode + '-score" class="la-score">Score: 0</span></div>';
    }

    const SCREENS = {
        'la-vocab': `
            <div class="container la-container">
                <div class="la-config">
                    <div class="tt-btn-group la-sub-group" id="la-vocab-sub">
                        <button class="btn btn-secondary la-vocab-sub-btn active" data-sub="synonym">Synonym</button>
                        <button class="btn btn-secondary la-vocab-sub-btn" data-sub="antonym">Antonym</button>
                        <button class="btn btn-secondary la-vocab-sub-btn" data-sub="definition">Meaning</button>
                        <button class="btn btn-secondary la-vocab-sub-btn" data-sub="fillblank">Fill Blank</button>
                    </div>
                    ${diffGroup('vocab')}
                </div>
                ${scoreBar('vocab')}
                <div id="la-vocab-prompt" class="la-prompt"></div>
                <div id="la-vocab-choices" class="la-choices"></div>
                <div id="la-vocab-feedback" class="feedback-display"></div>
            </div>`,
        'la-cap': `
            <div class="container la-container">
                <div class="la-config">${diffGroup('cap')}</div>
                ${scoreBar('cap')}
                <div class="la-prompt">Tap every word that should start with a <b>capital</b> letter.</div>
                <div id="la-cap-sentence" class="la-sentence"></div>
                <button id="la-cap-check" class="btn btn-primary la-check-btn">Check</button>
                <div id="la-cap-feedback" class="feedback-display"></div>
            </div>`,
        'la-punct': `
            <div class="container la-container">
                <div class="la-config">
                    <div class="tt-btn-group la-sub-group" id="la-punct-sub">
                        <button class="btn btn-secondary la-punct-sub-btn active" data-sub="end">End Marks</button>
                        <button class="btn btn-secondary la-punct-sub-btn" data-sub="comma">Commas</button>
                        <button class="btn btn-secondary la-punct-sub-btn" data-sub="apos">Apostrophes</button>
                    </div>
                    ${diffGroup('punct')}
                </div>
                ${scoreBar('punct')}
                <div id="la-punct-choice-panel">
                    <div id="la-punct-prompt" class="la-prompt"></div>
                    <div id="la-punct-choices" class="la-choices"></div>
                </div>
                <div id="la-punct-comma-panel" class="hidden">
                    <div class="la-prompt">Tap each <b>·</b> where a comma belongs.</div>
                    <div id="la-punct-sentence" class="la-sentence"></div>
                    <button id="la-punct-check" class="btn btn-primary la-check-btn">Check</button>
                </div>
                <div id="la-punct-feedback" class="feedback-display"></div>
            </div>`,
        'la-subj': `
            <div class="container la-container">
                <div class="la-config">${diffGroup('subj')}</div>
                ${scoreBar('subj')}
                <div id="la-subj-prompt" class="la-prompt"></div>
                <div id="la-subj-sentence" class="la-sentence la-sentence-lg"></div>
                <div id="la-subj-feedback" class="feedback-display"></div>
            </div>`,
        'la-diag': `
            <div class="container la-container la-diag-wide">
                <div class="la-config">
                    <div class="tt-btn-group la-sub-group" id="la-diag-mode">
                        <button class="btn btn-secondary la-diag-mode-btn active" data-mode="fill">Fill In</button>
                        <button class="btn btn-secondary la-diag-mode-btn" data-mode="build">Build It</button>
                    </div>
                    ${diffGroup('diag')}
                </div>
                ${scoreBar('diag')}
                <div id="la-diag-prompt" class="la-prompt">Drag each word onto the diagram.</div>
                <div id="la-build-tools" class="la-build-tools hidden">
                    <span class="la-hint">Word after the verb is a:</span>
                    <div class="tt-btn-group">
                        <button class="btn btn-secondary la-ctype-btn active" data-ctype="object">Object&nbsp;|</button>
                        <button class="btn btn-secondary la-ctype-btn" data-ctype="comp">Predicate&nbsp;\\</button>
                    </div>
                </div>
                <div id="la-diag-stage" class="la-diag-stage"></div>
                <div id="la-diag-tray" class="la-diag-tray"></div>
                <div class="la-diag-buttons">
                    <button id="la-diag-reset" class="btn btn-secondary la-check-btn">Reset</button>
                    <button id="la-diag-check" class="btn btn-primary la-check-btn">Check</button>
                </div>
                <div id="la-diag-feedback" class="feedback-display"></div>
            </div>`,
    };

    const TAB_BUTTONS = [
        ['la-vocab', 'Vocabulary'],
        ['la-cap', 'Capitals'],
        ['la-punct', 'Punctuation'],
        ['la-subj', 'Subject/Verb'],
        ['la-diag', 'Diagramming'],
    ];

    /* ========================================================================
     * BOOTSTRAP — inject stylesheet, screens, tabs; register; wire events.
     * ======================================================================*/
    function injectStylesheet() {
        if (document.querySelector('link[data-la-css]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'language-arts.css?v=4';
        link.dataset.laCss = '1';
        document.head.appendChild(link);
    }
    function injectScreens() {
        const anchor = document.getElementById('sprite-layer'); // screens are body-level
        Object.keys(SCREENS).forEach((name) => {
            const div = document.createElement('div');
            div.id = name + '-screen';
            div.className = 'screen';
            div.innerHTML = SCREENS[name];
            if (anchor) document.body.insertBefore(div, anchor);
            else document.body.appendChild(div);
        });
    }
    function injectTabs() {
        const bar = document.getElementById('tab-bar');
        if (!bar) return;
        TAB_BUTTONS.forEach(([tab, label]) => {
            const btn = document.createElement('button');
            btn.className = 'tab-btn';
            btn.dataset.tab = tab;
            btn.textContent = label;
            bar.appendChild(btn);
        });
    }
    function register() {
        // TAB_ENTRY / SCREEN_TAB are top-level consts in app.js's shared scope.
        TAB_ENTRY['la-vocab'] = () => { showScreen('la-vocab'); vocabInit(); };
        TAB_ENTRY['la-cap'] = () => { showScreen('la-cap'); capInit(); };
        TAB_ENTRY['la-punct'] = () => { showScreen('la-punct'); punctInit(); };
        TAB_ENTRY['la-subj'] = () => { showScreen('la-subj'); subjInit(); };
        TAB_ENTRY['la-diag'] = () => { showScreen('la-diag'); diagInit(); };
        ['la-vocab', 'la-cap', 'la-punct', 'la-subj', 'la-diag'].forEach((n) => { SCREEN_TAB[n] = n; });
    }

    function wireEvents() {
        // Vocabulary
        wireSub('la-vocab-sub', 'la-vocab-sub-btn', 'sub', (s) => { vocab.sub = s; vocabRound(); });
        wireDiff('la-vocab-diff', vocab, vocabRound);
        // Capitalization
        wireDiff('la-cap-diff', cap, capRound);
        document.getElementById('la-cap-check').addEventListener('click', capCheck);
        // Punctuation
        wireSub('la-punct-sub', 'la-punct-sub-btn', 'sub', (s) => { punct.sub = s; punctShowPanels(); punctRound(); });
        wireDiff('la-punct-diff', punct, punctRound);
        document.getElementById('la-punct-check').addEventListener('click', punctCommaCheck);
        // Subject / verb
        wireDiff('la-subj-diff', subj, subjRound);
        // Diagramming (Fill + Build sub-modes)
        wireDiff('la-diag-diff', diag, diagRefresh);
        document.getElementById('la-diag-mode').addEventListener('click', (e) => {
            const b = e.target.closest('.la-diag-mode-btn');
            if (b) diagSetMode(b.dataset.mode);
        });
        document.getElementById('la-build-tools').addEventListener('click', (e) => {
            const b = e.target.closest('.la-ctype-btn');
            if (!b) return;
            document.querySelectorAll('.la-ctype-btn').forEach((x) => x.classList.toggle('active', x === b));
            buildSetCompType(b.dataset.ctype);
        });
        document.getElementById('la-diag-check').addEventListener('click', () => diag.mode === 'build' ? buildCheck() : diagCheck());
        document.getElementById('la-diag-reset').addEventListener('click', () => diag.mode === 'build' ? buildReset() : diagReset());
    }

    function boot() {
        // Guard: only run if the host app's dispatch tables exist.
        if (typeof TAB_ENTRY === 'undefined' || typeof SCREEN_TAB === 'undefined') return;
        injectStylesheet();
        injectScreens();
        injectTabs();
        register();
        wireEvents();
    }

    // Script is loaded at end of <body> after app.js, so the DOM + app globals
    // are ready; run immediately, but fall back to DOMContentLoaded just in case.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
