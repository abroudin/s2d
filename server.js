const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const cors = require('cors');
const session = require('express-session');
const grant = require('grant').express();

dotenv.config();

const app = express();
const PORT = 3000;

// CORS configuration
const corsOptions = {
    origin: 'http://localhost:3001',
    methods: 'GET,POST',
    allowedHeaders: 'Content-Type,Authorization',
    credentials: true
};

app.use(cors(corsOptions));

app.use(session({
    secret: 'very secret key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

const grantConfig = {
    "defaults": {
        "origin": "http://localhost:3000",
        "transport": "session"
    },
    "discogs": {
        "key": process.env.DISCOGS_CONSUMER_KEY,
        "secret": process.env.DISCOGS_CONSUMER_SECRET,
        "callback": "/auth/discogs/callback",
        "request_url": "https://api.discogs.com/oauth/request_token",
        "authorize_url": "https://www.discogs.com/oauth/authorize",
        "access_url": "https://api.discogs.com/oauth/access_token",
        "oauth": 1
    }
};

app.use(grant(grantConfig));


// Redirect user to Spotify's authorization page
app.get('/login', (req, res) => {
    console.log('Login route accessed'); // Debugging line

    const scopes = 'user-read-private user-read-email user-library-read';
    const redirect_uri = 'http://localhost:3000/callback';
    const redirectURL = 'https://accounts.spotify.com/authorize' +
        '?response_type=code' +
        '&client_id=' + process.env.SPOTIFY_CLIENT_ID +
        '&show_dialog=true' +
        (scopes ? '&scope=' + encodeURIComponent(scopes) : '') +
        '&redirect_uri=' + encodeURIComponent(redirect_uri);

    console.log("Redirect URL:", redirectURL); // Debugging line
    res.redirect(redirectURL);
});


// Handle the callback after user grants/denies permission
app.get('/callback', async (req, res) => {
    const code = req.query.code;
    const redirect_uri = 'http://localhost:3000/callback';

    try {
        const response = await axios.post('https://accounts.spotify.com/api/token', null, {
            params: {
                code: code,
                redirect_uri: redirect_uri,
                grant_type: 'authorization_code',
            },
            headers: {
                'Authorization': 'Basic ' + (new Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const data = response.data;
        const access_token = data.access_token;

        // Redirect to the React app's set-token route with the access token as a query parameter
        res.redirect(`http://localhost:3001/set-token?token=${access_token}`);

    } catch (error) {
        console.error('Error fetching tokens:', error.message);
        res.status(400).send('Error fetching tokens: ' + error.message);
    }
});

app.get('/auth/discogs/callback', async (req, res, next) => {
    // console.log("auth", req.session.grant)

    if (req.session.grant?.response) {
        res.redirect('http://localhost:3001/?discogsAuthSuccess=true');
    } else {
        console.error('Error during Discogs OAuth callback.');
        res.status(500).send('Error during Discogs OAuth callback');
    }
});

app.get('/test-session', (req, res) => {
    res.send(req.session);
});

app.get('/search-discogs/:query', async (req, res) => {
    const query = req.params.query;

    if (!req.session?.grant?.response) {
        console.error('Not authenticated with Discogs. Missing OAuth tokens in session.');
        return res.status(401).send('Not authenticated with Discogs');
    }

    const { access_secret: tokenSecret, access_token: token }  = req.session.grant.response

    try {
        const response = await axios.get(`https://api.discogs.com/database/search?q=${query}&format=vinyl&per_page=10`, {
            headers: {
                'Authorization': `OAuth oauth_consumer_key="${process.env.DISCOGS_CONSUMER_KEY}",oauth_signature="${process.env.DISCOGS_CONSUMER_SECRET}%26${tokenSecret}",oauth_token="${token}",oauth_signature_method="PLAINTEXT",oauth_timestamp="${Math.floor(Date.now() / 1000)}",oauth_nonce="${Math.random().toString(36).substr(2)}",oauth_version="1.0"`
            }
        });

        // Filter the results to get only the first release
        const releases = response.data.results.filter(item => item.type === 'release');
        const limitedResults = releases.length > 0 ? [releases[0]] : [];

        res.json(limitedResults);
    } catch (error) {
        console.error("Error fetching data from Discogs:", error.message);
        res.status(500).send('Error making authenticated request');
    }
});





// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});