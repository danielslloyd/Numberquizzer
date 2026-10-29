/*
 * Regenerates the PG_LEAGUES team tables in app.js.
 *
 * Run by hand when a league expands or renames a team; never a build gate.
 *
 *   node tools/gen-leagues.js          # prints the tables to stdout
 *
 * Why the tables are baked in at all: ESPN's teams API sends no
 * Access-Control-Allow-Origin header, so the browser cannot call it — this
 * script can, because Node is not bound by CORS. The logo CDN
 * (a.espncdn.com) DOES allow cross-origin fetches, which is why the app can
 * pull the images themselves at generation time.
 *
 * MLB is deliberately absent here. Its table points at mlbstatic's cap logos,
 * which are single-colour silhouettes that survive being printed at 6mm;
 * ESPN's full-colour MLB logos do not. Edit that one by hand.
 *
 * A league needs at least 26 teams to fill the alphabet. Probed and rejected
 * for being too small: WNBA (15), NWSL (16), Bundesliga (18), Ligue 1 (18),
 * Liga MX (18), Premier League (20), La Liga (20), Serie A (20), PLL (12).
 * The NCAA endpoints do have enough teams — 362 for basketball, 676 for
 * football — but a random 26 out of those is mostly schools nobody can
 * identify, which makes for a worse puzzle rather than a better one.
 */
const LEAGUES = [
    ['nfl', 'NFL', 'football', 'nfl'],
    ['nba', 'NBA', 'basketball', 'nba'],
    ['nhl', 'NHL', 'hockey', 'nhl'],
    ['mls', 'MLS', 'soccer', 'usa.1'],
];

const api = (s, l) => `https://site.api.espn.com/apis/site/v2/sports/${s}/${l}/teams?limit=1000`;

(async () => {
    let problems = 0;

    for (const [key, label, sport, league] of LEAGUES) {
        const j = await (await fetch(api(sport, league))).json();
        const teams = (j.sports[0].leagues[0].teams || []).map(t => t.team).filter(t => t.logos?.length);

        // The slug is the last path segment of the logo href — 'ari' for the
        // big leagues, a numeric id for soccer.
        const rows = teams.map(t => {
            const href = t.logos[0].href.split('?')[0];
            return {
                slug: href.slice(href.lastIndexOf('/') + 1).replace(/\.png$/, ''),
                dir:  href.slice(0, href.lastIndexOf('/')),
                short: t.shortDisplayName,
                display: t.displayName,
            };
        });

        // Short names read better, but only where they are unique inside the
        // league — MLS has several clubs whose short name is just "United".
        const seen = {};
        rows.forEach(r => { seen[r.short] = (seen[r.short] || 0) + 1; });
        rows.forEach(r => { r.name = seen[r.short] > 1 ? r.display : r.short; });
        rows.sort((a, b) => a.name.localeCompare(b.name));

        // One template has to rebuild every URL in the league, so the directory
        // must be identical across it.
        const dirs = [...new Set(rows.map(r => r.dir))];
        const dupes = rows.map(r => r.name).filter((n, i, a) => a.indexOf(n) !== i);

        if (rows.length < 26) { console.error(`!! ${label}: only ${rows.length} teams — too few for 26 letters`); problems++; }
        if (dirs.length > 1)  { console.error(`!! ${label}: logos span ${dirs.length} directories: ${dirs.join(', ')}`); problems++; }
        if (dupes.length)     { console.error(`!! ${label}: duplicate names: ${[...new Set(dupes)].join(', ')}`); problems++; }
        console.error(`${label}: ${rows.length} teams`);

        console.log(`    ${key}: {`);
        console.log(`        label: '${label}',`);
        console.log(`        logo: s => \`${dirs[0]}/\${s}.png\`,`);
        console.log(`        teams: [`);
        for (let i = 0; i < rows.length; i += 3) {
            console.log(`            ${rows.slice(i, i + 3).map(r => `['${r.slug}', ${JSON.stringify(r.name)}]`).join(', ')},`);
        }
        console.log(`        ],`);
        console.log(`    },`);
    }

    if (problems) { console.error(`\n${problems} problem(s) — do not paste this in unchecked.`); process.exit(1); }
})();
