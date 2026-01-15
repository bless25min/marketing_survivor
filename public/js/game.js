function update() {
    if (state.screen !== 'playing') return;

    if (state.hitStop > 0) {
        state.hitStop--;
        return;
    }

    state.frames++;
    if (state.frames % 60 === 0) {
        state.seconds++;
        checkTimeEvents();
    }

    // Player Move
    const moveSpeed = state.player.speed * state.stats.speedMult;
    let dx = 0, dy = 0;
    if (keys['ArrowUp'] || keys['w']) dy -= 1;
    if (keys['ArrowDown'] || keys['s']) dy += 1;
    if (keys['ArrowLeft'] || keys['a']) dx -= 1;
    if (keys['ArrowRight'] || keys['d']) dx += 1;

    // Joystick Input
    if (joystick.active) {
        const jdx = joystick.x - joystick.originX;
        const jdy = joystick.y - joystick.originY;
        const dist = Math.sqrt(jdx * jdx + jdy * jdy);
        if (dist > 10) { // Deadzone
            dx += jdx / dist;
            dy += jdy / dist;
        }
    }

    // Joystick Override
    if (joystick.active) {
        const jdx = joystick.x - joystick.originX;
        const jdy = joystick.y - joystick.originY;
        const dist = Math.sqrt(jdx * jdx + jdy * jdy);
        if (dist > 10) { // Deadzone
            dx = jdx / dist;
            dy = jdy / dist;
        }
    }

    // Normalize
    if (dx !== 0 || dy !== 0) {
        // Keyboard is already 0/1, Joystick is unit vector.
        // If mixed, just normalization handles it.
        const len = Math.sqrt(dx * dx + dy * dy);
        dx /= len; // Re-normalize if mixed
        dy /= len;
        state.player.x += dx * moveSpeed;
        state.player.y += dy * moveSpeed;

        // Map Boundaries (Limit player movement)
        const MAP_SIZE = 3000;
        state.player.x = Math.max(0, Math.min(MAP_SIZE, state.player.x));
        state.player.y = Math.max(0, Math.min(MAP_SIZE, state.player.y));
    }

    // Player Angle (Mouse)
    if (mouse.x !== 0 && mouse.y !== 0) {
        // Since we added camera translation (center - player), mouse logic needs adjustment.
        // Mouse coordinates are screen space.
        // World Space = Mouse - Translate
        // Translate = [cx - px, cy - py]
        // World Mouse = Mouse - [cx - px, cy - py] = Mouse - cx + px
        const cx = state.width / 2;
        const cy = state.height / 2;
        const wx = mouse.x - cx + state.player.x;
        const wy = mouse.y - cy + state.player.y;
        state.player.angle = Math.atan2(wy - state.player.y, wx - state.player.x);
    }

    // Weapons
    Object.values(weapons).forEach(w => w.update());

    // Update Entities
    updateEnemies();
    updateBullets();
    updateEnemyBullets();
    updateParticles();
    updateFloatingTexts();
    checkCollisions();

    // Shake decay
    if (state.shake > 0) {
        const mag = state.shake;
        const ang = Math.random() * Math.PI * 2;
        ctx.save();
        ctx.translate(Math.cos(ang) * mag, Math.sin(ang) * mag);
        state.shake *= 0.9;
        if (state.shake < 0.5) state.shake = 0;
    }
}

function loop() {
    requestAnimationFrame(loop);
    update();

    // Clear handled in draw by fillRect
    draw();

    if (state.shake > 0) ctx.restore(); // Restore shake translation
}

// Input Handling
const keys = {};
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

const mouse = { x: 0, y: 0 };
window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
// Consolidated Input (Mouse + Touch)
window.addEventListener('pointerdown', (e) => {
    if (state.screen === 'start') {
        resetGame();
        return;
    }
    if (state.screen === 'over') {
        if (e.target.closest('.course-btn')) return;
        state.screen = 'start';
        return;
    }

});

// Touch / Virtual Joystick
const joystick = { active: false, originX: 0, originY: 0, x: 0, y: 0 };

window.addEventListener('touchstart', e => {
    // e.preventDefault(); // Remove global preventDefault to allow button clicks? No, it might break joystick.
    // Instead, handle explicitly.

    // Touch UI handled by pointerdown now.
    // Joystick Logic Only
    if (state.screen !== 'playing') return;

    // First touch is joystick
    if (!joystick.active) {
        const t = e.touches[0];
        joystick.active = true;
        joystick.originX = t.clientX;
        joystick.originY = t.clientY;
        joystick.x = t.clientX;
        joystick.y = t.clientY;
    }
}, { passive: false });

window.addEventListener('touchmove', e => {
    if (state.screen === 'upgrade') return; // Allow scrolling
    e.preventDefault();
    if (joystick.active) {
        // Find touch that started joystick? Simplified: just use first touch
        const t = e.touches[0];
        joystick.x = t.clientX;
        joystick.y = t.clientY;

        // Update player angle based on joystick too
        state.player.angle = Math.atan2(joystick.y - joystick.originY, joystick.x - joystick.originX);
    }
}, { passive: false });

window.addEventListener('touchend', e => {
    if (state.screen === 'upgrade') return; // Allow click generation
    e.preventDefault();
    if (e.touches.length === 0) joystick.active = false;
});

// Upgrade System
function gameOver() {
    state.screen = 'over';
    updateUI();
}

function levelUp() {
    state.screen = 'upgrade';
    state.xp -= state.xpNeeded;
    // Increase XP requirement
    state.xpNeeded = Math.ceil(state.xpNeeded * 1.5);
    generateUpgradeOptions();
    updateUI();
}

function generateUpgradeOptions() {
    const pool = [];

    // 1. All Registered Weapons
    Object.keys(WEAPON_REGISTRY).forEach(key => {
        pool.push({
            id: `w_${key}`,
            title: WEAPON_REGISTRY[key].name,
            desc: WEAPON_REGISTRY[key].description,
            icon: WEAPON_REGISTRY[key].icon,
            type: 'weapon',
            key: key
        });
    });


    // 2. Pairwise Synergy Options (Dynamic)
    const unlockedIds = Object.keys(weapons).filter(k => weapons[k].level > 0);

    for (let i = 0; i < unlockedIds.length; i++) {
        for (let j = i + 1; j < unlockedIds.length; j++) {
            const a = unlockedIds[i];
            const b = unlockedIds[j];

            if (!isSynergyUnlocked(a, b)) {
                const tA = WEAPON_REGISTRY[a].trait;
                const tB = WEAPON_REGISTRY[b].trait;
                const nameA = TRAIT_NAMES[tA] || tA;
                const nameB = TRAIT_NAMES[tB] || tB;

                pool.push({
                    id: `syn_${a}_${b}`,
                    title: `🔗 連動：${WEAPON_REGISTRY[a].name} + ${WEAPON_REGISTRY[b].name}`,
                    desc: `交換特徵！\n${WEAPON_REGISTRY[a].name} 獲得 [${nameB}]\n${WEAPON_REGISTRY[b].name} 獲得 [${nameA}]`,
                    icon: '♾️',
                    type: 'synergy',
                    pair: [a, b]
                });
            }
        }
    }

    // Shuffle and pick 3
    state.upgradeOptions = pool.sort(() => 0.5 - Math.random()).slice(0, 3);
}

function updateUI() {
    const ui = document.getElementById('ui');

    // Default centering for most screens
    ui.style.alignItems = 'center';
    ui.style.justifyContent = 'center';
    ui.style.paddingBottom = '0';

    if (state.screen === 'start') {
        const isLoggedIn = !!state.player.image;

        ui.innerHTML = `
            <h1 style="font-size: 4rem; color: #fbbf24; text-shadow: 0 0 20px #b45309;">行銷倖存者</h1>
            <p style="font-size: 1.5rem; animation: pulse 1s infinite;">點擊畫面開始挑戰</p>
            
            ${!isLoggedIn ? `
            <button onclick="window.location.href='/auth/login'" style="
                margin-top: 30px;
                background: #06C755;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 1.2rem;
                font-weight: bold;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 10px;
                pointer-events: auto;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                transition: transform 0.1s;
            " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                <span style="font-size: 1.5rem;">💬</span> 使用 LINE 登入 (XP +50%)
            </button>
            ` : `
            <div style="
                margin-top: 20px;
                background: rgba(6, 199, 85, 0.2);
                border: 1px solid #06C755;
                padding: 10px 20px;
                border-radius: 20px;
                color: #06C755;
                display: flex;
                align-items: center;
                gap: 10px;
            ">
                <span>✅ LINE 登入成功 - XP 加成啟動!</span>
            </div>
            `}
        `;
        ui.style.display = 'flex';
        ui.style.flexDirection = 'column'; // Ensure vertical stacking
        ui.style.background = 'rgba(0,0,0,0.6)';
        ui.style.border = 'none';
    } else if (state.screen === 'over') {
        ui.innerHTML = `
            <h1 style="color: #ef4444; text-shadow: 0 0 20px #7f1d1d; font-size: 4rem;">任務失敗</h1>
            <p style="font-size: 1.5rem; color: #e5e7eb;">存活時間: ${Math.floor(state.seconds)} 秒</p>
            <p style="margin-top: 20px; color: #94a3b8;">點擊畫面重新開始</p>
            
            <div style="margin-top: 40px; text-align: center;">
                <p style="color: #fbbf24; font-size: 1.2rem; margin-bottom: 10px;">想知道如何突破行銷瓶頸？</p>
                <button class="course-btn" onclick="window.open('https://ppa.tw/s/B85ADABB', '_blank')" 
                    style="padding: 15px 30px; font-size: 1.5rem; background: #6366f1; color: white; border: none; border-radius: 10px; cursor: pointer; box-shadow: 0 0 15px #4f46e5; transition: transform 0.1s;">
                    🎓 前往課程 (View Course)
                </button>
            </div>
        `;
        ui.style.display = 'flex';
        ui.style.flexDirection = 'column';
        ui.style.background = 'rgba(0, 0, 0, 0.85)';
    } else if (state.screen === 'upgrade') {
        let html = `<h2 style="color: #fbbf24; text-shadow: 0 0 10px #b45309;">升級！選擇你的強化</h2><div class="cards">`;
        state.upgradeOptions.forEach((u, i) => {
            html += `
            <div class="card" onclick="selectUpgrade(${i})">
                <div class="icon">${u.icon}</div>
                <h3>${u.title}</h3>
                <p>${u.desc}</p>
            </div>`;
        });
        html += `</div>`;
        ui.innerHTML = html;
        ui.style.display = 'flex';
        ui.style.background = 'rgba(0,0,0,0.8)';

    } else {
        ui.style.display = 'none';

        // Update Game HUD (Floating)
        // We need to render the floating level/time text manually or here
        // The game loop calls drawHUD which does this on canvas.
        // So we don't need HTML HUD unless requested.
    }
}

// Global scope required for HTML onclick
window.selectUpgrade = function (index) {
    const u = state.upgradeOptions[index];
    if (!u) return;

    if (u.type === 'weapon') {
        const id = u.key;
        if (!weapons[id] || !weapons[id].level) {
            // First time unlock
            weapons[id] = new Weapon(id);
            weapons[id].level = 1;
            spawnFloatingText(`獲得! ${weapons[id].def.name}`, state.player.x, state.player.y, '#fff');
        } else {
            weapons[id].upgrade();
            spawnFloatingText(`升級! ${weapons[id].def.name}`, state.player.x, state.player.y, '#fff');
        }
    } else if (u.type === 'synergy') {
        const [a, b] = u.pair;
        const key = `${a}+${b}`;
        state.synergies.push(key);
        // Traits are handled by Weapon.update() dynamically checking isSynergyUnlocked
        spawnFloatingText(`連動啟動!`, state.player.x, state.player.y, '#fbbf24');
    }

    state.level++;
    state.screen = 'playing';
    updateUI();
};

function resetGame() {
    state.screen = 'playing';
    state.player.hp = 100;
    // Spawn in Middle of Map (1500, 1500)
    const CENTER = 1500;
    state.player.x = CENTER;
    state.player.y = CENTER;

    // Mobile Zoom: If width < 800, zoom out (0.6) to see more.
    state.zoom = state.width < 800 ? 0.6 : 1.0;

    state.frames = 0;
    state.seconds = 0;
    state.xp = 0;
    state.level = 1;
    state.gemsNeeded = 5;
    state.shake = 0;

    state.bullets = [];
    state.enemyBullets = []; // FIX: Clear enemy bullets on reset
    state.enemies = [];
    state.particles = [];
    state.floatingTexts = [];
    state.gems = [];
    state.synergies = [];
    state.nextWaveTime = 30; // Initialize to first wave time

    weapons = {
        'content': new Weapon('content')
    };
    weapons['content'].level = 1;

    state.stats = { damageMult: 1, areaMult: 1, speedMult: 1, cooldownMult: 1, amountMult: 0, pierce: 0 };


    updateUI();
}



function updateUI() {
    const ui = document.getElementById('ui');

    // Default centering for most screens
    ui.style.alignItems = 'center';
    ui.style.justifyContent = 'center';
    ui.style.paddingBottom = '0';

    if (state.screen === 'start') {
        ui.innerHTML = `<h1 style="font-size: 4rem; color: #fbbf24; text-shadow: 0 0 20px #b45309;">行銷倖存者</h1><p style="font-size: 1.5rem; animation: pulse 1s infinite;">點擊畫面開始挑戰</p>`;
        ui.style.display = 'flex';
        ui.style.background = 'rgba(0,0,0,0.5)';
        ui.style.border = 'none';
    } else if (state.screen === 'over') {
        ui.innerHTML = `
            <h1 style="color: #ef4444; text-shadow: 0 0 20px #7f1d1d;">任務失敗</h1>
            <p>存活時間: ${Math.floor(state.seconds)} 秒</p>
            <div style="display: flex; gap: 20px; margin-top: 20px; pointer-events: auto;">
                <button class="course-btn" onclick="window.open('https://ppa.tw/s/B85ADABB', '_blank')" style="
                    background: #facc15; 
                    color: #000; 
                    border: none; 
                    padding: 15px 30px; 
                    font-size: 1.2rem; 
                    font-weight: bold; 
                    border-radius: 8px; 
                    cursor: pointer; 
                    box-shadow: 0 0 15px rgba(250, 204, 21, 0.5);
                    transition: transform 0.1s;
                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    🎓 前往課程 (View Course)
                </button>
            </div>
            <p style="margin-top: 20px; font-size: 0.9rem; color: #9ca3af;">Click anywhere else to Restart</p>
        `;
        ui.style.display = 'flex';
        ui.style.background = 'rgba(20, 0, 0, 0.9)';
    } else if (state.screen === 'upgrade') {
        let html = `<h2 style="color:#fbbf24; text-shadow:0 0 10px #fbbf24;">>> UPGRADE AVAILABLE <<</h2><div class="cards">`;
        state.upgradeOptions.forEach((u, i) => {
            html += `
            <div class="card" onclick="selectUpgrade(${i})" style="border: 1px solid #4ade80; background: rgba(0, 20, 0, 0.9);">
                <div class="icon">${u.icon}</div>
                <div style="flex: 1;"> <!-- Text Wrapper -->
                    <h3 style="color:#4ade80; margin: 0 0 5px 0;">${u.title}</h3>
                    <p style="color:#a7f3d0; margin: 0;">${u.desc}</p>
                </div>
            </div>`;
        });
        html += `</div>`;
        ui.innerHTML = html;
        ui.style.display = 'flex';
        ui.style.background = 'rgba(0,0,0,0.85)';

    } else if (state.screen === 'login_prompt') {
        ui.innerHTML = `
            <div style="background: rgba(15, 23, 42, 0.95); padding: 40px; border-radius: 20px; border: 2px solid #a855f7; text-align: center; box-shadow: 0 0 50px rgba(168, 85, 247, 0.4); max-width: 500px; pointer-events: auto;">
                <h1 style="color: #a855f7; margin-bottom: 20px; font-size: 2.2rem; text-shadow: 0 0 10px #000;">脫離默默無名的詛咒</h1>
                <p style="color: #cbd5e1; font-size: 1.1rem; margin-bottom: 20px; line-height: 1.6;">
                    你現在只是一個路人甲...<br>
                    無法發揮真正的實力 <span style="color: #ef4444;">(經驗值 50% 限制中)</span>
                </p>
                <p style="color: #facc15; font-size: 1.5rem; margin-bottom: 30px; font-weight: bold; text-shadow: 0 0 10px #b45309;">
                    唯有「取得名稱之力」<br>才能解除封印！
                </p>
                
                <button onclick="window.location.href='/auth/login'" style="
                    background: linear-gradient(135deg, #06C755 0%, #059669 100%);
                    color: white;
                    border: 2px solid #bef264;
                    padding: 15px 30px;
                    border-radius: 10px;
                    font-size: 1.3rem;
                    font-weight: bold;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    width: 100%;
                    margin-bottom: 15px;
                    box-shadow: 0 0 20px rgba(6, 199, 85, 0.5);
                    transition: transform 0.1s;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.3);
                " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                    <span style="font-size: 1.5rem;">⚔️</span> 取得名稱之力 (LINE Login)
                </button>
            </div>
        `;
        ui.style.display = 'flex';
        ui.style.background = 'rgba(0,0,0,0.85)';
    } else {
        ui.style.display = 'none';
        ui.style.background = 'transparent';
    }
}



function checkTimeEvents() {
    // 45s Login Prompt
    if (state.seconds === 45 && !state.storyShown['login_prompt']) {
        state.storyShown['login_prompt'] = true;
        // Only show if NOT logged in
        if (!state.player.image) {
            state.screen = 'login_prompt';
            updateUI();
            return true;
        }
    }
    return false;
}

// Start
// LINE Login Logic
(async function initLineLogin() {
    // 1. LIFF Initialization (Native Support)
    try {
        await liff.init({ liffId: '2008795055-Ynkzrcep' }); // Provided LIFF ID
        if (liff.isLoggedIn()) {
            const profile = await liff.getProfile();
            if (profile.pictureUrl) {
                localStorage.setItem('player_image', profile.pictureUrl);
                console.log('LIFF Login Success:', profile.displayName);
            }
        } else if (liff.isInClient()) {
            // Auto login if in LINE App but somehow not logged in
            liff.login();
        }
    } catch (err) {
        console.warn('LIFF Init Failed:', err);
    }

    // 2. Check URL Params (Web Redirect Fallback)
    const params = new URLSearchParams(window.location.search);
    const pictureUrl = params.get('pictureUrl');

    if (pictureUrl) {
        localStorage.setItem('player_image', pictureUrl);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 3. Load from LocalStorage
    const storedImage = localStorage.getItem('player_image');
    if (storedImage) {
        const img = new Image();
        img.src = storedImage;
        img.onload = () => {
            state.player.image = img;
            console.log('Player Image Loaded');
        };
    }
})();

updateUI();
resize();
loop();
