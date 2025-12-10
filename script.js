// Selectors
const form = document.getElementById('form');
const search = document.getElementById('search');
const result = document.getElementById('result');
const more = document.getElementById('more');
const lyricsCache = {};

// API URLs & keys 
const OVH_API = 'https://api.lyrics.ovh';
const MUSIXMATCH_API = 'https://api.musixmatch.com/ws/1.1/';
const MUSIXMATCH_KEY = 'YOUR_MUSIXMATCH_KEY'; // Replace with your key
const GENIUS_API = 'https://api.genius.com';
const GENIUS_KEY = 'YOUR_GENIUS_KEY'; // Replace with your key

// Search by song or artist
async function searchSongs(term) {
    result.innerHTML = `<p class="loading">Searching for "${term}"...</p>`;
    more.innerHTML = '';

    try {
        const res = await fetch(`${OVH_API}/suggest/${encodeURIComponent(term)}`);
        const data = await res.json();
        showDataSafe(data);
    } catch (err) {
        result.innerHTML = `<p>Something went wrong while searching for "${term}".</p>`;
        console.error(err);
    }
}

// Pagination
async function getMoreSongs(url) {
    try {
        const res = await fetch(`https://cors-anywhere.herokuapp.com/${url}`);
        const data = await res.json();
        showDataSafe(data);
    } catch (err) {
        result.innerHTML = `<p>Something went wrong fetching more songs.</p>`;
        console.error(err);
    }
}

// Event listeners
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const searchTerm = search.value.trim();
    if (!searchTerm) {
        alert('Please type in a search term');
    } else {
        searchSongs(searchTerm);
    }
});

// Show results (safe)
function showDataSafe(lyrics) {
    result.innerHTML = '';
    more.innerHTML = '';

    const ul = document.createElement('ul');
    ul.className = 'songs';

    lyrics.data.forEach((song) => {
        const li = document.createElement('li');

        const img = document.createElement('img');
        img.src = song.album.cover_small;
        img.alt = `${song.title} Album Cover`;
        img.className = "album-art";
        li.appendChild(img);

        const span = document.createElement('span');
        const strong = document.createElement('strong');
        strong.textContent = song.artist.name;
        span.appendChild(strong);
        span.append(document.createTextNode(` - ${song.title}`));
        li.appendChild(span);

        const button = document.createElement('button');
        button.className = 'btn';
        button.textContent = 'Get Lyrics';
        button.dataset.artist = song.artist.name;
        button.dataset.songtitle = song.title;
        li.appendChild(button);

        ul.appendChild(li);
    });

    result.appendChild(ul);

    if (lyrics.prev || lyrics.next) {
        if (lyrics.prev) {
            const prevButton = document.createElement('button');
            prevButton.className = 'btn';
            prevButton.textContent = 'Prev';
            prevButton.addEventListener('click', () => getMoreSongs(lyrics.prev));
            more.appendChild(prevButton);
        }
        if (lyrics.next) {
            const nextButton = document.createElement('button');
            nextButton.className = 'btn';
            nextButton.textContent = 'Next';
            nextButton.addEventListener('click', () => getMoreSongs(lyrics.next));
            more.appendChild(nextButton);
        }
    }
}

// Get lyrics button click
result.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' && e.target.dataset.artist) {
        const artist = e.target.dataset.artist;
        const songTitle = e.target.dataset.songtitle;
        getLyricsWithFallback(artist, songTitle);
    }
});

// Get lyrics with fallback system
async function getLyricsWithFallback(artist, songTitle) {
    const key = `${artist} - ${songTitle}`;
    if (lyricsCache[key]) {
        renderLyrics(lyricsCache[key], artist, songTitle);
        return;
    }

    result.innerHTML = `<p class="loading">Fetching lyrics for "${artist} - ${songTitle}"...</p>`;
    more.innerHTML = '';

    // 1️⃣ Try lyrics.ovh
    try {
        const res = await fetch(`${OVH_API}/v1/${encodeURIComponent(artist)}/${encodeURIComponent(songTitle)}`);
        const data = await res.json();
        if (data.lyrics) {
            lyricsCache[key] = data.lyrics;
            renderLyrics(data.lyrics, artist, songTitle);
            return;
        }
    } catch (err) {
        console.warn('lyrics.ovh failed, trying Musixmatch/Genius...', err);
    }

    // 2️⃣ Try Musixmatch
    try {
        const res = await fetch(`${MUSIXMATCH_API}matcher.lyrics.get?q_track=${encodeURIComponent(songTitle)}&q_artist=${encodeURIComponent(artist)}&apikey=${MUSIXMATCH_KEY}`);
        const data = await res.json();
        if (data.message.body.lyrics && data.message.body.lyrics.lyrics_body) {
            const lyrics = data.message.body.lyrics.lyrics_body;
            lyricsCache[key] = lyrics;
            renderLyrics(lyrics, artist, songTitle);
            return;
        }
    } catch (err) {
        console.warn('Musixmatch failed, trying Genius...', err);
    }

    // 3️⃣ Try Genius (API + scrape)
    try {
        const res = await fetch(`${GENIUS_API}/search?q=${encodeURIComponent(artist + ' ' + songTitle)}`, {
            headers: { 'Authorization': `Bearer ${GENIUS_KEY}` }
        });
        const data = await res.json();
        if (data.response.hits.length > 0) {
            const songPath = data.response.hits[0].result.path;
            const lyricRes = await fetch(`https://genius.com${songPath}`);
            const html = await lyricRes.text();
            const lyricsMatch = html.match(/<div data-lyrics-container="true">([\s\S]*?)<\/div>/g);
            if (lyricsMatch) {
                const lyrics = lyricsMatch.map(l => l.replace(/<br>/g, '\n').replace(/<[^>]*>/g, '')).join('\n');
                lyricsCache[key] = lyrics;
                renderLyrics(lyrics, artist, songTitle);
                return;
            }
        }
    } catch (err) {
        console.warn('Genius failed', err);
    }

    // 4️⃣ If all fail
    result.innerHTML = `<p>Sorry, lyrics not found for "${artist} - ${songTitle}".</p>`;
}

// Render lyrics helper
function renderLyrics(lyrics, artist, songTitle) {
    result.innerHTML = '';
    more.innerHTML = '';

    const heading = document.createElement('h2');
    heading.append(document.createElement('strong'), ` - ${songTitle}`);
    heading.querySelector('strong').textContent = artist;
    result.append(heading);

    const span = document.createElement('span');
    lyrics.split(/\r\n|\r|\n/).forEach((line, i) => {
        span.append(line);
        if (i < lyrics.split(/\r\n|\r|\n/).length - 1) span.append(document.createElement('br'));
    });
    result.append(span);
}
