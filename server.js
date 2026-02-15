/*
═══════════════════════════════════════════════════════════════
FILE LOCATION: oauth_server/server.js
PUT THIS FILE IN: NEW FOLDER → oauth_server → server.js
DEPLOY THIS TO RENDER AS A WEB SERVICE (NOT STATIC SITE)
═══════════════════════════════════════════════════════════════

NEXUS OAUTH BACKEND - NODE.JS
Handles /auth/callback route from Discord
Exchanges code for token, manages sessions
*/

const express = require('express');
const axios = require('axios');
const session = require('express-session');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ═══ CONFIGURATION ═══
const CLIENT_ID = "1462605560884101130";  // Your bot ID
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;  // Set in Render env vars
const REDIRECT_URI = "https://nexus-site-hv2f.onrender.com/auth/callback";
const FRONTEND_URL = "https://nexus-site-hv2f.onrender.com";

// ═══ MIDDLEWARE ═══
app.use(cors({
    origin: FRONTEND_URL,
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'nexus-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000  // 24 hours
    }
}));

// ═══ DISCORD OAUTH CALLBACK ROUTE ═══
app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
        return res.redirect(`${FRONTEND_URL}?error=no_code`);
    }
    
    try {
        console.log('📥 Received OAuth callback with code');
        
        // Exchange code for access token
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
            new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        const { access_token, token_type } = tokenResponse.data;
        
        console.log('✅ Got access token from Discord');
        
        // Get user info from Discord
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `${token_type} ${access_token}`
            }
        });
        
        const user = userResponse.data;
        
        console.log(`✅ Got user info: ${user.username}#${user.discriminator}`);
        
        // Store user in session
        req.session.user = {
            id: user.id,
            username: `${user.username}#${user.discriminator}`,
            avatar: user.avatar 
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
                : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator) % 5}.png`,
            accessToken: access_token
        };
        
        // TODO: Fetch NEX balance from bot database here
        // For now, set default
        req.session.user.balance = 0;
        
        // Redirect back to frontend with success
        res.redirect(`${FRONTEND_URL}?login=success`);
        
    } catch (error) {
        console.error('❌ OAuth error:', error.response?.data || error.message);
        res.redirect(`${FRONTEND_URL}?error=oauth_failed`);
    }
});

// ═══ GET CURRENT USER SESSION ═══
app.get('/api/auth/me', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    res.json({
        success: true,
        user: req.session.user
    });
});

// ═══ LOGOUT ═══
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true });
    });
});

// ═══ HEALTH CHECK ═══
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK',
        timestamp: new Date().toISOString(),
        redirect_uri: REDIRECT_URI
    });
});

// ═══ ROOT ROUTE ═══
app.get('/', (req, res) => {
    res.json({
        message: 'Nexus OAuth Backend',
        endpoints: {
            callback: '/auth/callback',
            me: '/api/auth/me',
            logout: '/api/auth/logout',
            health: '/health'
        }
    });
});

// ═══ START SERVER ═══
app.listen(PORT, () => {
    console.log('═══════════════════════════════════════');
    console.log('✅ Nexus OAuth Backend Running');
    console.log(`📡 Port: ${PORT}`);
    console.log(`🔗 Redirect URI: ${REDIRECT_URI}`);
    console.log(`🌐 Frontend: ${FRONTEND_URL}`);
    console.log('═══════════════════════════════════════');
});