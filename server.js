/*
═══════════════════════════════════════════════════════════════
COMPLETE WORKING BACKEND - REPLACE YOUR CURRENT SERVER.JS
Deploy to: https://nexus-backend-of9x.onrender.com
═══════════════════════════════════════════════════════════════
*/

const express = require('express');
const axios = require('axios');
const session = require('express-session');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ═══ CONFIGURATION ═══
const CLIENT_ID = "1462605560884101130";
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "your_secret_here";
const REDIRECT_URI = "https://nexus-backend-of9x.onrender.com/auth/callback";
const FRONTEND_URL = "https://nexus-site-hv2f.onrender.com";

// ═══ CORS - ALLOW YOUR FRONTEND ═══
app.use(cors({
    origin: [FRONTEND_URL, 'https://nexus-site-hv2f.onrender.com'],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ═══ SESSION ═══
app.use(session({
    secret: process.env.SESSION_SECRET || 'nexus-secret-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
}));

// ═══ PET SHOP DATA (HOURLY ROTATION) ═══
const PET_POOLS = {
    common: [
        { id: 'dog', name: 'Loyal Dog', emoji: '🐕', rarity: 'Common', description: 'A faithful companion', price: 500 },
        { id: 'cat', name: 'Cute Cat', emoji: '🐈', rarity: 'Common', description: 'Independent and playful', price: 500 },
        { id: 'rabbit', name: 'Fluffy Rabbit', emoji: '🐇', rarity: 'Common', description: 'Soft and cuddly', price: 600 },
        { id: 'hamster', name: 'Tiny Hamster', emoji: '🐹', rarity: 'Common', description: 'Small and adorable', price: 400 }
    ],
    rare: [
        { id: 'wolf', name: 'Wild Wolf', emoji: '🐺', rarity: 'Rare', description: 'Fierce and loyal', price: 2000 },
        { id: 'fox', name: 'Clever Fox', emoji: '🦊', rarity: 'Rare', description: 'Smart and cunning', price: 2500 },
        { id: 'panda', name: 'Rare Panda', emoji: '🐼', rarity: 'Rare', description: 'Endangered species', price: 3000 }
    ],
    legendary: [
        { id: 'dragon', name: 'Fire Dragon', emoji: '🐉', rarity: 'Legendary', description: 'Mythical beast!', price: 10000 },
        { id: 'unicorn', name: 'Mystical Unicorn', emoji: '🦄', rarity: 'Legendary', description: 'Magical creature', price: 15000 }
    ]
};

function getHourlyShop() {
    const hour = new Date().getHours();
    const seed = hour;
    
    const rng = (s) => {
        const x = Math.sin(s++) * 10000;
        return x - Math.floor(x);
    };
    
    const shop = [];
    
    // 2 common pets
    for (let i = 0; i < 2; i++) {
        const index = Math.floor(rng(seed + i) * PET_POOLS.common.length);
        shop.push(PET_POOLS.common[index]);
    }
    
    // 1 rare pet
    const rareIndex = Math.floor(rng(seed + 10) * PET_POOLS.rare.length);
    shop.push(PET_POOLS.rare[rareIndex]);
    
    // 1 legendary pet (30% chance)
    if (rng(seed + 20) < 0.3) {
        const legIndex = Math.floor(rng(seed + 21) * PET_POOLS.legendary.length);
        shop.push(PET_POOLS.legendary[legIndex]);
    }
    
    return shop;
}

// ═══ MOCK DATABASE FUNCTIONS ═══
// TODO: Replace with real database
const mockUsers = new Map();

function getBalance(userId) {
    if (!mockUsers.has(userId)) {
        mockUsers.set(userId, { balance: 5000, pets: [] });
    }
    return mockUsers.get(userId).balance;
}

function deductBalance(userId, amount) {
    const user = mockUsers.get(userId);
    if (user) {
        user.balance -= amount;
        return true;
    }
    return false;
}

function addPet(userId, pet) {
    const user = mockUsers.get(userId);
    if (user) {
        user.pets.push(pet);
        return true;
    }
    return false;
}

// ═══ ROOT ═══
app.get('/', (req, res) => {
    res.json({
        message: 'Nexus Main Backend API',
        version: '5.0',
        status: 'RUNNING',
        timestamp: new Date().toISOString(),
        endpoints: {
            health: 'GET /health',
            shop: 'GET /api/shop/pets',
            buy: 'POST /api/shop/buy',
            oauth: 'GET /auth/callback',
            me: 'GET /api/auth/me',
            logout: 'POST /api/auth/logout'
        }
    });
});

// ═══ HEALTH CHECK ═══
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        redirect_uri: REDIRECT_URI,
        frontend_url: FRONTEND_URL,
        features: ['OAuth', 'Shop', 'Purchase']
    });
});

// ═══ GET SHOP PETS (THIS WAS MISSING!) ═══
app.get('/api/shop/pets', (req, res) => {
    try {
        const pets = getHourlyShop();
        const nextHour = new Date();
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
        
        console.log(`📦 Sending ${pets.length} pets to shop`);
        
        res.json({
            success: true,
            pets: pets,
            nextRotation: nextHour.toISOString()
        });
    } catch (error) {
        console.error('Shop error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load shop',
            details: error.message
        });
    }
});

// ═══ OAUTH CALLBACK ═══
app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
        return res.redirect(`${FRONTEND_URL}?error=no_code`);
    }
    
    try {
        // Exchange code for token
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token',
            new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        
        const { access_token, token_type } = tokenResponse.data;
        
        // Get user info
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `${token_type} ${access_token}` }
        });
        
        const user = userResponse.data;
        const balance = getBalance(user.id);
        
        // Initialize user if not exists
        if (!mockUsers.has(user.id)) {
            mockUsers.set(user.id, { balance: 5000, pets: [] });
        }
        
        req.session.user = {
            id: user.id,
            username: `${user.username}#${user.discriminator}`,
            avatar: user.avatar 
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
                : `https://cdn.discordapp.com/embed/avatars/0.png`,
            balance: balance
        };
        
        console.log(`✅ User logged in: ${user.username} (${balance} NEX)`);
        
        res.redirect(`${FRONTEND_URL}?login=success`);
        
    } catch (error) {
        console.error('OAuth error:', error.response?.data || error.message);
        res.redirect(`${FRONTEND_URL}?error=oauth_failed`);
    }
});

// ═══ GET CURRENT USER ═══
app.get('/api/auth/me', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    // Refresh balance
    const freshBalance = getBalance(req.session.user.id);
    req.session.user.balance = freshBalance;
    
    res.json({
        success: true,
        user: req.session.user
    });
});

// ═══ BUY PET ═══
app.post('/api/shop/buy', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const { petId } = req.body;
    
    if (!petId) {
        return res.status(400).json({ error: 'Missing petId' });
    }
    
    try {
        const shop = getHourlyShop();
        const pet = shop.find(p => p.id === petId);
        
        if (!pet) {
            return res.status(404).json({ error: 'Pet not in current shop rotation' });
        }
        
        const currentBalance = getBalance(req.session.user.id);
        
        if (currentBalance < pet.price) {
            return res.status(400).json({ 
                error: 'Insufficient NEX',
                required: pet.price,
                current: currentBalance
            });
        }
        
        // Deduct NEX
        deductBalance(req.session.user.id, pet.price);
        
        // Add pet
        addPet(req.session.user.id, pet);
        
        // Get new balance
        const newBalance = getBalance(req.session.user.id);
        req.session.user.balance = newBalance;
        
        console.log(`✅ ${req.session.user.username} bought ${pet.name}`);
        
        res.json({
            success: true,
            message: `${pet.name} added to your inventory!`,
            newBalance: newBalance,
            pet: pet
        });
        
    } catch (error) {
        console.error('Purchase error:', error);
        res.status(500).json({ 
            error: 'Purchase failed', 
            details: error.message 
        });
    }
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

// ═══ 404 HANDLER ═══
app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        requested: `${req.method} ${req.path}`,
        availableRoutes: [
            'GET /',
            'GET /health',
            'GET /api/shop/pets',
            'POST /api/shop/buy',
            'GET /auth/callback',
            'GET /api/auth/me',
            'POST /api/auth/logout'
        ]
    });
});

// ═══ START SERVER ═══
app.listen(PORT, () => {
    console.log('═══════════════════════════════════════');
    console.log('✅ Nexus Main Backend RUNNING');
    console.log(`📡 Port: ${PORT}`);
    console.log(`🔗 Redirect: ${REDIRECT_URI}`);
    console.log(`🌐 Frontend: ${FRONTEND_URL}`);
    console.log(`🏪 Shop API: /api/shop/pets`);
    console.log('');
    console.log('Routes available:');
    console.log('  GET  /');
    console.log('  GET  /health');
    console.log('  GET  /api/shop/pets ← SHOP ROUTE');
    console.log('  POST /api/shop/buy');
    console.log('  GET  /auth/callback');
    console.log('  GET  /api/auth/me');
    console.log('  POST /api/auth/logout');
    console.log('═══════════════════════════════════════');
});