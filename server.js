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

app.get('/auth/discogs/callback', (req, res) => {
    if (req.session.grant && req.session.grant.response) {
        const { access_token, access_secret } = req.session.grant.response;
        req.session.oauth = {
            accessToken: access_token,
            accessTokenSecret: access_secret
        };
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

    if (!req.session.oauth || !req.session.oauth.accessToken) {
        console.error('Not authenticated with Discogs. Missing OAuth tokens in session.');
        return res.status(401).send('Not authenticated with Discogs');
    }

    const accessToken = req.session.oauth.accessToken;

    try {
        const response = await axios.get(`https://api.discogs.com/database/search?q=${query}&format=vinyl`, {
            headers: {
                'Authorization': `OAuth oauth_consumer_key="${process.env.DISCOGS_CONSUMER_KEY}",oauth_token="${accessToken}",oauth_signature_method="HMAC-SHA1",oauth_timestamp="${Math.floor(Date.now() / 1000)}",oauth_nonce="${Math.random().toString(36).substr(2)}",oauth_version="1.0"`
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error("Error fetching data from Discogs:", error.message);
        res.status(500).send('Error making authenticated request');
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
