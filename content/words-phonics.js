/*
 * Word bank for the phonics, spelling and word-recognition strands.
 *
 * Authored here rather than copied. Ordered phonics scope-and-sequences are
 * mostly proprietary (UFLI, Wilson, Reading Universe); what is not copyrightable
 * is which graphemes exist and roughly what order they are taught in, so the
 * ordering follows the consensus of several published sequences and the words
 * themselves are chosen fresh.
 *
 * Two things to preserve if you edit this:
 *
 *   Every word must actually contain the pattern it is filed under, and — for
 *   the contrast lists — must NOT contain the pattern it is a foil for. A foil
 *   that secretly matches turns a right answer into a wrong one.
 *
 *   Spelling entries carry a `clue`. Speech is an enhancement, not a guarantee:
 *   on a browser without speechSynthesis a "spell the word you hear" item would
 *   be unanswerable, so every spelling item is also solvable from its clue.
 */
(function () {
    'use strict';

    const W = {};

    // ---- short vowels, CVC ------------------------------------------------
    W.cvc = {
        a: ['cat', 'map', 'bag', 'hat', 'ran', 'sad', 'tap', 'jam', 'pan', 'rat', 'wag', 'lap'],
        e: ['bed', 'net', 'leg', 'pen', 'wet', 'hen', 'jet', 'red', 'ten', 'get'],
        i: ['pig', 'sit', 'lid', 'win', 'fin', 'dig', 'hit', 'rib', 'zip', 'kid'],
        o: ['dog', 'hop', 'pot', 'top', 'mop', 'rod', 'log', 'box', 'fox', 'job'],
        u: ['cup', 'bug', 'sun', 'rug', 'mud', 'hut', 'bun', 'tub', 'gum', 'nut'],
    };

    // ---- consonant digraphs ------------------------------------------------
    W.digraph = {
        sh: ['ship', 'shop', 'fish', 'wish', 'shed', 'cash', 'shell', 'brush'],
        ch: ['chip', 'chin', 'much', 'rich', 'chest', 'lunch', 'bench', 'chop'],
        th: ['thin', 'that', 'with', 'bath', 'moth', 'path', 'them', 'cloth'],
        ck: ['duck', 'rock', 'sick', 'back', 'lock', 'pick', 'neck', 'truck'],
        ng: ['ring', 'song', 'king', 'long', 'wing', 'bang', 'sting', 'strong'],
        wh: ['when', 'whip', 'whale', 'wheel', 'white', 'which'],
    };

    // ---- blends ------------------------------------------------------------
    W.blendInitial = ['stop', 'flag', 'trip', 'clap', 'grin', 'sled', 'swim', 'plan',
        'drum', 'skip', 'spin', 'brag', 'crab', 'frog', 'glad', 'snap'];
    W.blendFinal = ['hand', 'nest', 'lamp', 'jump', 'milk', 'belt', 'gift', 'sand',
        'best', 'wind', 'bank', 'desk', 'cold', 'help'];

    // ---- silent e ----------------------------------------------------------
    // Paired with the short-vowel word the silent e changes, which is the whole
    // point of the pattern and the clearest way to test it.
    W.vcePairs = [
        ['cap', 'cape'], ['tap', 'tape'], ['hat', 'hate'], ['man', 'mane'], ['can', 'cane'],
        ['pin', 'pine'], ['kit', 'kite'], ['rid', 'ride'], ['bit', 'bite'], ['din', 'dine'],
        ['hop', 'hope'], ['not', 'note'], ['rob', 'robe'], ['cod', 'code'], ['dot', 'dote'],
        ['cub', 'cube'], ['tub', 'tube'], ['us', 'use'], ['cut', 'cute'],
    ];
    W.vce = W.vcePairs.map((p) => p[1]);

    // ---- vowel teams -------------------------------------------------------
    W.vowelTeamLong = {
        ai: ['rain', 'mail', 'wait', 'train', 'paint', 'chain'],
        ay: ['day', 'play', 'stay', 'tray', 'clay', 'away'],
        ee: ['feet', 'tree', 'green', 'sleep', 'sweet', 'queen'],
        ea: ['team', 'leaf', 'beach', 'clean', 'dream', 'seat'],
        oa: ['boat', 'road', 'coat', 'soap', 'toast', 'float'],
        ow: ['snow', 'grow', 'yellow', 'window', 'throw', 'pillow'],
        igh: ['night', 'light', 'high', 'right', 'bright', 'sight'],
        ie: ['pie', 'tie', 'lie', 'died', 'cried', 'tried'],
    };

    W.vowelTeamMore = {
        'oo (long)': ['moon', 'soon', 'food', 'room', 'pool', 'zoo'],
        'oo (short)': ['book', 'look', 'good', 'foot', 'wood', 'cook'],
        ew: ['new', 'grew', 'flew', 'chew', 'drew', 'stew'],
        au: ['sauce', 'August', 'haunt', 'launch', 'author'],
        aw: ['saw', 'draw', 'lawn', 'crawl', 'yawn', 'straw'],
    };

    // Same spelling, different sound — the over-generalisation trap.
    W.vowelTeamExceptions = [
        { team: 'ea', usual: ['beach', 'clean', 'dream'], odd: ['bread', 'head', 'ready'] },
        { team: 'ow', usual: ['snow', 'grow', 'yellow'], odd: ['cow', 'down', 'brown'] },
        { team: 'oo', usual: ['moon', 'food', 'room'], odd: ['book', 'foot', 'good'] },
    ];

    // ---- r-controlled ------------------------------------------------------
    // No explicit CCSS home; placement is convention. See PROFICIENCIES.md.
    W.rControlled = {
        ar: ['car', 'star', 'farm', 'park', 'sharp', 'garden'],
        or: ['fork', 'corn', 'storm', 'north', 'short', 'horse'],
        er: ['her', 'water', 'sister', 'letter', 'under', 'winter'],
        ir: ['bird', 'girl', 'first', 'shirt', 'third', 'thirty'],
        ur: ['turn', 'hurt', 'burn', 'purple', 'church', 'Thursday'],
    };

    // ---- diphthongs --------------------------------------------------------
    W.diphthong = {
        oi: ['coin', 'boil', 'join', 'point', 'soil', 'noise'],
        oy: ['boy', 'toy', 'joy', 'enjoy', 'royal', 'destroy'],
        ou: ['out', 'loud', 'round', 'house', 'mouth', 'cloud'],
        ow: ['cow', 'now', 'down', 'brown', 'town', 'flower'],
    };

    // ---- odds and ends ------------------------------------------------------
    W.softC = ['city', 'cent', 'circle', 'ice', 'race', 'pencil'];
    W.hardC = ['cat', 'cup', 'cold', 'card', 'coat', 'cave'];
    W.softG = ['gem', 'giant', 'giraffe', 'cage', 'page', 'magic'];
    W.hardG = ['got', 'gum', 'game', 'goat', 'garden', 'gate'];

    W.silent = {
        kn: ['knee', 'knife', 'knock', 'know', 'knot'],
        wr: ['write', 'wrong', 'wrap', 'wrist', 'wreck'],
        mb: ['lamb', 'thumb', 'comb', 'climb', 'crumb'],
        gn: ['gnaw', 'sign', 'gnome'],
    };

    W.yVowel = {
        'long i': ['cry', 'fly', 'sky', 'try', 'why', 'dry'],
        'long e': ['happy', 'baby', 'funny', 'city', 'penny', 'story'],
    };

    W.tchDge = {
        tch: ['catch', 'match', 'pitch', 'watch', 'kitchen'],
        dge: ['badge', 'bridge', 'edge', 'judge', 'hedge'],
    };

    W.ffllss = ['puff', 'cliff', 'bell', 'spell', 'grass', 'dress', 'buzz', 'miss'];

    /*
     * Which spellings make the SAME sound. The tables above are keyed by
     * spelling, and several spellings share a sound — ew and long oo, oi and oy,
     * ou and ow, er and ir and ur. A foil drawn from a same-sound group is a
     * correct answer to a question about sound, so generators must consult this
     * before choosing one.
     */
    W.soundClass = {
        // vowel teams, long
        ai: 'long-a', ay: 'long-a',
        ee: 'long-e', ea: 'long-e',
        oa: 'long-o', ow: 'long-o',
        igh: 'long-i', ie: 'long-i',
        // vowel teams, more
        'oo (long)': 'oo', ew: 'oo',
        'oo (short)': 'uu',
        au: 'aw', aw: 'aw',
        // r-controlled: er, ir and ur are indistinguishable by ear
        ar: 'ar', or: 'or', er: 'er', ir: 'er', ur: 'er',
        // diphthongs
        oi: 'oi', oy: 'oi',
        ou: 'ow-dip',
    };

    // `ow` appears in two tables with two different sounds, so it cannot live in
    // a single flat map. Generators pass the table name to disambiguate.
    W.soundClassIn = function (table, key) {
        if (table === 'diphthong' && key === 'ow') return 'ow-dip';
        return W.soundClass[key] || key;
    };

    // ---- inflections --------------------------------------------------------
    // base, plus the three inflected forms, so one entry serves both the reading
    // node and the spelling-rule node.
    W.inflect = [
        { base: 'jump', s: 'jumps', ed: 'jumped', ing: 'jumping', rule: 'add' },
        { base: 'play', s: 'plays', ed: 'played', ing: 'playing', rule: 'add' },
        { base: 'walk', s: 'walks', ed: 'walked', ing: 'walking', rule: 'add' },
        { base: 'hop', s: 'hops', ed: 'hopped', ing: 'hopping', rule: 'double' },
        { base: 'stop', s: 'stops', ed: 'stopped', ing: 'stopping', rule: 'double' },
        { base: 'run', s: 'runs', ed: null, ing: 'running', rule: 'double' },
        { base: 'sit', s: 'sits', ed: null, ing: 'sitting', rule: 'double' },
        { base: 'hope', s: 'hopes', ed: 'hoped', ing: 'hoping', rule: 'dropE' },
        { base: 'smile', s: 'smiles', ed: 'smiled', ing: 'smiling', rule: 'dropE' },
        { base: 'bake', s: 'bakes', ed: 'baked', ing: 'baking', rule: 'dropE' },
        { base: 'cry', s: 'cries', ed: 'cried', ing: 'crying', rule: 'yToI' },
        { base: 'try', s: 'tries', ed: 'tried', ing: 'trying', rule: 'yToI' },
        { base: 'carry', s: 'carries', ed: 'carried', ing: 'carrying', rule: 'yToI' },
    ];

    // ---- syllables ----------------------------------------------------------
    W.twoSyllable = ['rabbit', 'napkin', 'basket', 'sunset', 'muffin', 'picnic', 'tennis',
        'kitten', 'magnet', 'puppet', 'contest', 'invite'];
    W.multisyllable = ['fantastic', 'wonderful', 'important', 'celebrate', 'understand',
        'invisible', 'imagination', 'temperature', 'photograph', 'remember'];
    // The unstressed vowel that collapses to /uh/ — the reason long words are
    // hard to read even once every grapheme is known.
    // Each entry carries the word's own syllables, so the distractors are the
    // other parts of THAT word. Offering fragments of other words makes the item
    // answerable without reading it, and risks a "distractor" that is genuinely
    // part of the word too.
    W.schwa = [
        { w: 'about', syls: ['a', 'bout'], syl: 'a' },
        { w: 'pencil', syls: ['pen', 'cil'], syl: 'cil' },
        { w: 'problem', syls: ['prob', 'lem'], syl: 'lem' },
        { w: 'banana', syls: ['ba', 'na', 'na'], syl: 'ba' },
        { w: 'family', syls: ['fam', 'i', 'ly'], syl: 'i' },
        { w: 'animal', syls: ['an', 'i', 'mal'], syl: 'mal' },
        { w: 'garden', syls: ['gar', 'den'], syl: 'den' },
        { w: 'ribbon', syls: ['rib', 'bon'], syl: 'bon' },
        { w: 'circus', syls: ['cir', 'cus'], syl: 'cus' },
        { w: 'button', syls: ['but', 'ton'], syl: 'ton' },
        { w: 'dragon', syls: ['dra', 'gon'], syl: 'gon' },
        { w: 'carrot', syls: ['car', 'rot'], syl: 'rot' },
        { w: 'seven', syls: ['sev', 'en'], syl: 'en' },
        { w: 'oven', syls: ['ov', 'en'], syl: 'en' },
    ];

    // ---- high-frequency and irregular ---------------------------------------
    W.hfEarly = ['the', 'and', 'is', 'you', 'that', 'was', 'for', 'are', 'as', 'with',
        'his', 'they', 'have', 'this', 'from', 'one', 'had', 'not', 'but', 'what'];
    W.hfExtended = ['because', 'people', 'through', 'another', 'important', 'different',
        'thought', 'should', 'enough', 'together', 'sometimes', 'once'];

    /*
     * Heart words: irregular high-frequency words, with the ONE part that has to
     * be learned by heart marked. The regular parts are still decodable, and
     * teaching the whole word as a picture is the misconception this exists to
     * prevent.
     */
    W.heart = [
        { w: 'said', odd: 'ai', parts: ['s', 'ai', 'd'], why: 'ai here says /e/' },
        { w: 'was', odd: 'a', parts: ['w', 'a', 's'], why: 'a here says /u/' },
        { w: 'of', odd: 'f', parts: ['o', 'f'], why: 'f here says /v/' },
        { w: 'come', odd: 'o', parts: ['c', 'o', 'm', 'e'], why: 'o here says /u/' },
        { w: 'some', odd: 'o', parts: ['s', 'o', 'm', 'e'], why: 'o here says /u/' },
        { w: 'they', odd: 'ey', parts: ['th', 'ey'], why: 'ey here says long a' },
        { w: 'do', odd: 'o', parts: ['d', 'o'], why: 'o here says /oo/' },
        { w: 'you', odd: 'ou', parts: ['y', 'ou'], why: 'ou here says /oo/' },
        { w: 'friend', odd: 'ie', parts: ['fr', 'ie', 'n', 'd'], why: 'ie here says /e/' },
        { w: 'once', odd: 'o', parts: ['o', 'n', 'ce'], why: 'o here says /w/ then /u/' },
        { w: 'give', odd: 'e', parts: ['g', 'i', 'v', 'e'], why: 'the e does not make the i long' },
        { w: 'have', odd: 'e', parts: ['h', 'a', 'v', 'e'], why: 'the e does not make the a long' },
        { w: 'want', odd: 'a', parts: ['w', 'a', 'n', 't'], why: 'a here says /o/' },
        { w: 'said', odd: 'ai', parts: ['s', 'ai', 'd'], why: 'ai here says /e/' },
    ];

    // ---- spelling, with clues so audio is never required ---------------------
    W.spell = {
        cvc: [
            { w: 'cat', clue: 'a pet that purrs' }, { w: 'bed', clue: 'you sleep in it' },
            { w: 'pig', clue: 'a farm animal that says oink' }, { w: 'dog', clue: 'a pet that barks' },
            { w: 'sun', clue: 'it shines in the day' }, { w: 'hat', clue: 'you wear it on your head' },
            { w: 'box', clue: 'you put things in it' }, { w: 'cup', clue: 'you drink from it' },
            { w: 'bus', clue: 'it carries lots of people' },
            { w: 'net', clue: 'you catch fish with it' },
            { w: 'log', clue: 'a piece of a tree trunk' },
            { w: 'pin', clue: 'a small sharp metal point' },
            { w: 'mug', clue: 'you drink tea from it' },
            { w: 'fan', clue: 'it blows air to cool you' },
            { w: 'web', clue: 'a spider makes one' },
            { w: 'rock', clue: 'a hard lump of stone' },
        ],
        vceVowelTeams: [
            { w: 'cake', clue: 'you eat it on your birthday' }, { w: 'rain', clue: 'water falling from the sky' },
            { w: 'boat', clue: 'it floats on water' }, { w: 'tree', clue: 'it has leaves and branches' },
            { w: 'kite', clue: 'you fly it on a windy day' }, { w: 'road', clue: 'cars drive on it' },
            { w: 'moon', clue: 'it shines at night' }, { w: 'green', clue: 'the colour of grass' },
            { w: 'snail', clue: 'it moves slowly and carries its shell' },
            { w: 'road', clue: 'cars drive along it' },
            { w: 'sheep', clue: 'a farm animal with wool' },
            { w: 'coat', clue: 'you wear it when it is cold' },
            { w: 'night', clue: 'the dark part of the day' },
            { w: 'spoon', clue: 'you eat soup with it' },
            { w: 'leaf', clue: 'it grows on a tree branch' },
            { w: 'snake', clue: 'a long animal with no legs' },
        ],
        rControlled: [
            { w: 'star', clue: 'it twinkles in the night sky' }, { w: 'bird', clue: 'it has feathers and flies' },
            { w: 'farm', clue: 'where cows and sheep live' }, { w: 'horse', clue: 'you can ride it' },
            { w: 'girl', clue: 'a young female person' }, { w: 'turn', clue: 'to go round a corner' },
            { w: 'shark', clue: 'a large fish with sharp teeth' },
            { w: 'corner', clue: 'where two walls meet' },
            { w: 'letter', clue: 'you post it to someone' },
            { w: 'winter', clue: 'the coldest season' },
            { w: 'purple', clue: 'the colour of a plum' },
            { w: 'thirty', clue: 'the number after twenty-nine' },
        ],
        irregularHF: [
            { w: 'said', clue: 'the past tense of say' }, { w: 'because', clue: 'it gives a reason' },
            { w: 'friend', clue: 'someone you like to be with' }, { w: 'people', clue: 'more than one person' },
            { w: 'they', clue: 'the word for more than one other person' },
            { w: 'once', clue: 'one time only' },
            { w: 'through', clue: 'in one side and out the other' },
            { w: 'thought', clue: 'the past tense of think' },
            { w: 'enough', clue: 'as much as you need' },
            { w: 'another', clue: 'one more' },
            { w: 'together', clue: 'with each other' },
            { w: 'beautiful', clue: 'very lovely to look at' },
            { w: 'different', clue: 'not the same' },
            { w: 'favourite', clue: 'the one you like best' },
        ],
    };

    /*
     * What a speech recogniser plausibly returns for a CORRECT reading.
     *
     * Read-aloud items measure decoding — did the child turn these letters into
     * the right sounds. A recogniser returns *words*, so when two words sound
     * identical it has to guess which one was meant, and it guesses on context
     * we deliberately have not given it. A child who reads "knot" perfectly gets
     * back "not", and marking that wrong would be marking the recogniser's
     * ignorance against the child.
     *
     * Two rules keep this honest:
     *
     *   Only true homophones. Never a word that merely sounds similar. Accepting
     *   "sheep" for "ship" would destroy the exact contrast the node measures.
     *
     *   Never on a spelling node. Telling "knot" from "not" is precisely what
     *   spell.* and vocab.homophone assess, and a microphone cannot do it at
     *   all — which is why those nodes are barred from read-aloud entirely.
     *
     * Digits are here for a duller reason: recognisers normalise number words to
     * numerals, so "seven" comes back as "7" without anything having gone wrong.
     *
     * This is a first table built from predictable behaviour. Tuning it properly
     * needs a real microphone and a real child, and the list should grow from
     * transcripts rather than from guesses.
     */
    W.heard = {
        // true homophones
        know: ['no'], knot: ['not'], knew: ['new'], new: ['knew'],
        night: ['knight'], write: ['right'], right: ['write', 'rite'], wrap: ['rap'],
        won: ['one', '1'], some: ['sum'], sun: ['son'], for: ['four', '4'],
        mail: ['male'], mane: ['main'], rain: ['reign', 'rein'], road: ['rode'],
        beach: ['beech'], feet: ['feat'], flew: ['flu', 'flue'], through: ['threw'],
        bread: ['bred'], red: ['read'], sight: ['site', 'cite'], sign: ['sine'],
        horse: ['hoarse'], flower: ['flour'], cent: ['scent', 'sent'], sauce: ['source'],
        which: ['witch'], whale: ['wail'], wheel: ["we'll"], wood: ['would'],
        loud: ['allowed', 'aloud'], lie: ['lye'], tie: ['thai'], die: ['dye'],
        died: ['dyed'], plane: ['plain'], sale: ['sail'], week: ['weak'],

        // recognisers normalise number words to numerals, which is not an error
        one: ['won', '1'], two: ['2'], ten: ['10'], seven: ['7'],
        thirty: ['30'], third: ['3rd'], first: ['1st'],
    };

    /** Every spelling a correct reading of `word` might come back as. */
    W.heardAs = function (word) {
        return (W.heard[String(word).toLowerCase()] || []).slice();
    };

    window.WORDS = W;
    if (typeof module !== 'undefined' && module.exports) module.exports = W;
})();
