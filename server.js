const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const tiktokConnector = require('tiktok-live-connector');

const TikTokConnectionClass = tiktokConnector.TikTokLiveConnection || tiktokConnector.WebcastPushConnection;
const WebcastEvent = tiktokConnector.WebcastEvent || { CHAT: 'chat', GIFT: 'gift', LIKE: 'like', FOLLOW: 'follow', SOCIAL: 'social' };
const ControlEvent = tiktokConnector.ControlEvent || { CONNECTED: 'connected', DISCONNECTED: 'disconnected', ERROR: 'error' };

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(__dirname));

let tiktokConnection = null;
let lastVoterSide = {};
let recentFollowers = new Map();
let activeMatchKeywords = { side0: ['1', 'TIME 1', 'FLA', 'MENGO', 'B1'], side1: ['2', 'TIME 2', 'COR', 'TIMAO', 'B2'] };

const TIKTOK_GIFT_CATALOG = {
    5655: { name: 'Combo 1', coins: 1, side: 0 },
    5269: { name: 'Combo 1', coins: 1, side: 1 },
    6064: { name: 'Combo 1', coins: 1, side: 1 },
    5827: { name: 'Combo 1', coins: 1, side: 1 },
    6592: { name: 'Combo 1', coins: 1, side: 1 },
    5487: { name: 'Combo 1', coins: 5, side: 0 },
    5879: { name: 'Combo VAR', coins: 30, side: 1 },
    5658: { name: 'Combo VAR', coins: 10, side: 0 },
    5585: { name: 'Super Poder', coins: 100, side: 0 },
    5660: { name: 'Super Poder', coins: 199, side: 1 },
    6093: { name: 'Combo VAR', coins: 99, side: 1 },
    5994: { name: 'Super Poder', coins: 1000, side: 1 },
    5659: { name: 'Super Poder', coins: 20000, side: 0 },
    5509: { name: 'Super Poder', coins: 29999, side: 0 },
    6788: { name: 'Super Poder', coins: 44999, side: 1 }
};

function scrapeRoomIdDirectFromTikTokHtml(uniqueId) {
    return new Promise((resolve) => {
        const url = 'https://www.tiktok.com/@' + encodeURIComponent(uniqueId) + '/live';
        const req = https.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36' },
            timeout: 7000
        }, (res) => {
            let html = '';
            res.on('data', chunk => { html += chunk; });
            res.on('end', () => {
                const m1 = html.match(/"roomId"\s*:\s*"(\d{10,25})"/);
                const m2 = html.match(/"room_id"\s*:\s*"(\d{10,25})"/);
                resolve((m1 && m1[1]) || (m2 && m2[1]) || null);
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

function extractTikTokUser(data = {}) {
    const u = data.user || data.sender || data.fromUser || data;
    const rawHandle = u.uniqueId || u.displayId || data.uniqueId || data.displayId || u.nickname || 'torcedor';
    const cleanHandle = String(rawHandle).replace(/^@/, '').trim() || 'torcedor';
    let avatarUrl = '';
    if (u.profilePicture && Array.isArray(u.profilePicture.urls) && u.profilePicture.urls.length > 0) avatarUrl = u.profilePicture.urls[0];
    else if (u.profilePicture && Array.isArray(u.profilePicture.urlList) && u.profilePicture.urlList.length > 0) avatarUrl = u.profilePicture.urlList[0];
    else if (u.avatarThumb && Array.isArray(u.avatarThumb.urlList) && u.avatarThumb.urlList.length > 0) avatarUrl = u.avatarThumb.urlList[0];
    else if (typeof u.profilePictureUrl === 'string' && u.profilePictureUrl) avatarUrl = u.profilePictureUrl;
    else if (typeof data.profilePictureUrl === 'string' && data.profilePictureUrl) avatarUrl = data.profilePictureUrl;
    if (!avatarUrl) avatarUrl = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(cleanHandle);
    return { uniqueId: cleanHandle, username: '@' + cleanHandle, initials: cleanHandle.substring(0, 2).toUpperCase(), avatarUrl };
}

function extractChatComment(data = {}) {
    return String(data.comment ?? data.content ?? data.msg ?? data.text ?? '').trim();
}

function extractGiftDetails(data = {}) {
    const giftObj = data.gift || {};
    const extObj = data.extendedGiftInfo || data.giftInfo || {};
    const giftId = Number(data.giftId ?? giftObj.id ?? extObj.id ?? 0);
    const cat = TIKTOK_GIFT_CATALOG[giftId] || null;
    const giftName = giftObj.name || extObj.name || data.giftName || (cat && cat.name) || 'Combo';
    const diamondCount = Number(giftObj.diamondCount ?? extObj.diamond_count ?? data.diamondCount ?? (cat && cat.coins) ?? 1) || 1;
    const repeatCount = Number(data.repeatCount ?? giftObj.repeatCount ?? 1) || 1;
    const giftType = Number(giftObj.type ?? giftObj.giftType ?? data.giftType ?? 0);
    const repeatEnd = Boolean(data.repeatEnd === true || data.repeatEnd === 1 || giftObj.repeatEnd === true || giftObj.repeatEnd === 1);
    return { giftName: String(giftName), totalCoins: diamondCount * repeatCount, catalogSide: cat ? cat.side : null, isStreakInProgress: (giftType === 1 && !repeatEnd) };
}

function detectSideByGiftName(giftName = '', catalogSide = null) {
    if (catalogSide === 0 || catalogSide === 1) return catalogSide;
    const g = giftName.toUpperCase();
    if (g.includes('ROSE') || g.includes('ROSA') || g.includes('BEER') || g.includes('CERVEJA') || g.includes('HEART') || g.includes('CORA') || g.includes('ROCKET') || g.includes('FOGUETE') || g.includes('LION') || g.includes('LEÃO')) return 0;
    if (g.includes('COFFEE') || g.includes('CAF') || g.includes('ICE CREAM') || g.includes('CASQUINHA') || g.includes('TIKTOK') || g.includes('LIGHTNING') || g.includes('RAIO') || g.includes('SUNGLASS') || g.includes('ÓCULOS') || g.includes('CROWN') || g.includes('COROA') || g.includes('GALAXY') || g.includes('GALÁXIA') || g.includes('TROPHY') || g.includes('TROFÉU') || g.includes('UNIVERSE') || g.includes('UNIVERSO')) return 1;
    return null;
}

function detectClubVoteCode(msg = '') {
    if (/\bB1\b/.test(msg) || msg.includes('FLA') || msg.includes('MENGO')) return 'B1';
    if (/\bB2\b/.test(msg) || msg.includes('COR') || msg.includes('TIMAO') || msg.includes('TIMÃO')) return 'B2';
    if (/\bB3\b/.test(msg) || msg.includes('PAL') || msg.includes('VERDAO') || msg.includes('VERDÃO')) return 'B3';
    if (/\bB4\b/.test(msg) || msg.includes('SAO') || msg.includes('SÃO PAULO') || msg.includes('SPFC')) return 'B4';
    if (/\bB5\b/.test(msg) || msg.includes('VASCO') || msg.includes('GIGANTE')) return 'B5';
    if (/\bE1\b/.test(msg) || msg.includes('REAL') || msg.includes('MADRID') || msg.includes('RMA')) return 'E1';
    if (/\bE2\b/.test(msg) || msg.includes('BARCA') || msg.includes('BARÇA') || msg.includes('BARCELONA')) return 'E2';
    if (/\bE3\b/.test(msg) || msg.includes('CITY') || msg.includes('MCI')) return 'E3';
    if (/\bE4\b/.test(msg) || msg.includes('PSG') || msg.includes('PARIS')) return 'E4';
    if (/\bE5\b/.test(msg) || msg.includes('BAYERN') || msg.includes('BAY')) return 'E5';
    return null;
}

function detectMatchSideFromChat(msgUpper = '', clubCode = null) {
    if (msgUpper === '1' || msgUpper === '13' || /\b1\b/.test(msgUpper) || msgUpper.includes('TIME 1')) return 0;
    if (msgUpper === '2' || msgUpper === '22' || /\b2\b/.test(msgUpper) || msgUpper.includes('TIME 2')) return 1;
    for (const kw of activeMatchKeywords.side0) { if (kw && msgUpper.includes(kw)) return 0; }
    for (const kw of activeMatchKeywords.side1) { if (kw && msgUpper.includes(kw)) return 1; }
    if (clubCode) return clubCode.startsWith('B') ? 0 : 1;
    return null;
}

async function connectTikTok(username) {
    const cleanUser = String(username || '').replace(/^@/, '').trim();
    if (!cleanUser) return;
    if (tiktokConnection) { try { tiktokConnection.disconnect(); } catch (e) {} }
    io.emit('admin_command', { type: 'tiktok_status', payload: { status: 'connecting', username: cleanUser, message: '⏳ Conectando na live de @' + cleanUser + '...' } });
    try {
        if (tiktokConnector.RoomIdRouteConfig) tiktokConnector.RoomIdRouteConfig.disableEulerFallbacks = true;
        if (tiktokConnector.IsLiveRouteConfig) tiktokConnector.IsLiveRouteConfig.disableEulerFallbacks = true;
        tiktokConnection = new TikTokConnectionClass(cleanUser, { processInitialData: false, enableExtendedGiftInfo: false, fetchRoomInfoOnConnect: false });
    } catch (e) {
        io.emit('admin_command', { type: 'tiktok_status', payload: { status: 'error', username: cleanUser, message: '❌ Erro: ' + e.message } });
        return;
    }
    tiktokConnection.on(WebcastEvent.CHAT || 'chat', data => {
        const rawComment = extractChatComment(data);
        const msg = rawComment.toUpperCase();
        const user = extractTikTokUser(data);
        const clubCode = detectClubVoteCode(msg);
        const side = detectMatchSideFromChat(msg, clubCode);
        if (side !== null || clubCode !== null) {
            const finalSide = side !== null ? side : 0;
            lastVoterSide[user.uniqueId] = finalSide;
            io.emit('live_event', { type: 'vote', side: finalSide, tier: 'comment', voteClubCode: clubCode, comment: rawComment, user });
        } else {
            io.emit('live_event', { type: 'chat_raw', username: user.username, comment: rawComment, user });
        }
    });
    tiktokConnection.on(WebcastEvent.GIFT || 'gift', data => {
        const giftInfo = extractGiftDetails(data);
        if (giftInfo.isStreakInProgress) return;
        const user = extractTikTokUser(data);
        let side = lastVoterSide[user.uniqueId] !== undefined ? lastVoterSide[user.uniqueId] : detectSideByGiftName(giftInfo.giftName, giftInfo.catalogSide);
        if (side === null) side = user.uniqueId.length % 2;
        const tier = giftInfo.totalCoins >= 100 ? 'super' : (giftInfo.totalCoins >= 10 ? 'var' : 'rose');
        io.emit('live_event', { type: 'vote', side, tier, coins: giftInfo.totalCoins, giftName: '⚡ Combo Especial', user });
    });
    tiktokConnection.on(WebcastEvent.LIKE || 'like', data => {
        const user = extractTikTokUser(data);
        const count = Number(data.likeCount ?? data.count ?? 15) || 15;
        io.emit('live_event', { type: 'like', count, user });
    });
    const handleFollow = data => {
        const user = extractTikTokUser(data);
        const now = Date.now();
        if (recentFollowers.has(user.uniqueId) && (now - recentFollowers.get(user.uniqueId)) < 8000) return;
        recentFollowers.set(user.uniqueId, now);
        const side = lastVoterSide[user.uniqueId] !== undefined ? lastVoterSide[user.uniqueId] : (user.uniqueId.length % 2);
        io.emit('live_event', { type: 'follow', side, user });
    };
    tiktokConnection.on(WebcastEvent.FOLLOW || 'follow', handleFollow);
    tiktokConnection.on(WebcastEvent.SOCIAL || 'social', data => {
        const dt = String(data.displayType || data.label || '').toLowerCase();
        if (dt.includes('follow')) handleFollow(data);
    });
    try {
        const scrapedId = await scrapeRoomIdDirectFromTikTokHtml(cleanUser);
        const st = scrapedId ? await tiktokConnection.connect(scrapedId) : await tiktokConnection.connect();
        const roomId = (st && st.roomId) ? st.roomId : (scrapedId || 'Ativa');
        io.emit('admin_command', { type: 'tiktok_status', payload: { status: 'connected', username: cleanUser, message: '🟢 CONECTADO NA LIVE DE @' + cleanUser + ' (Sala: ' + roomId + ')' } });
    } catch (err) {
        io.emit('admin_command', { type: 'tiktok_status', payload: { status: 'error', username: cleanUser, message: '❌ Falha ao conectar @' + cleanUser + ': Verifique se está AO VIVO!' } });
    }
}

io.on('connection', socket => {
    socket.on('connect_tiktok', ({ username }) => connectTikTok(username));
    socket.on('update_match_keywords', ({ side0, side1 }) => {
        if (Array.isArray(side0)) activeMatchKeywords.side0 = side0;
        if (Array.isArray(side1)) activeMatchKeywords.side1 = side1;
    });
    socket.on('admin_command', cmd => io.emit('admin_command', cmd));
});

server.listen(3000, '0.0.0.0', () => {
    console.log('✅ SERVIDOR PIXEL PENALTY SHOWDOWN + VAR (BYPASS EULER v2.5) RODANDO!');
});