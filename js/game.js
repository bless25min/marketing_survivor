function update() {
    if (state.screen !== 'playing') return;

    if (state.hitStop > 0) {
        state.hitStop--;
        return;
    }

    state.frames++;
    if (state.frames % 60 === 0) state.seconds++;

    // Player Move
    const moveSpeed = state.player.speed * state.stats.speedMult;
    let dx = 0, dy = 0;
    if (keys['ArrowUp'] || keys['w']) dy -= 1;
    if (keys['ArrowDown'] || keys['s']) dy += 1;
    if (keys['ArrowLeft'] || keys['a']) dx -= 1;
    if (keys['ArrowRight'] || keys['d']) dx += 1;

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

        // Simple bounds (optional, unlimited map is implied by grid)
        // state.player.x = Math.max(0, Math.min(state.width, state.player.x));
        // state.player.y = Math.max(0, Math.min(state.height, state.player.y));
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
window.addEventListener('mousedown', () => {
    if (state.screen === 'start') resetGame();
    if (state.screen === 'over') state.screen = 'start';
});

// Touch / Virtual Joystick
const joystick = { active: false, originX: 0, originY: 0, x: 0, y: 0 };

window.addEventListener('touchstart', e => {
    e.preventDefault();
    if (state.screen === 'start') { resetGame(); return; }
    if (state.screen === 'over') { state.screen = 'start'; return; }

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
    e.preventDefault();
    if (e.touches.length === 0) joystick.active = false;
});

// Upgrade System
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
    if (state.screen === 'start') {
        ui.innerHTML = `<h1>Marketing Survivor</h1><p>Click / Tap to Start</p>`;
        ui.style.display = 'flex';
    } else if (state.screen === 'over') {
        ui.innerHTML = `<h1>GAME OVER</h1><p>Survived: ${Math.floor(state.seconds)}s</p><p>Click / Tap to Restart</p>`;
        ui.style.display = 'flex';
    } else if (state.screen === 'upgrade') {
        let html = `<h2>Level Up! Choose Upgrade</h2><div class="cards">`;
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
    } else {
        ui.style.display = 'none';
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
            spawnFloatingText(`GET! ${weapons[id].def.name}`, state.player.x, state.player.y, '#fff');
        } else {
            weapons[id].upgrade();
            spawnFloatingText(`UPGRADE! ${weapons[id].def.name}`, state.player.x, state.player.y, '#fff');
        }
    } else if (u.type === 'synergy') {
        const [a, b] = u.pair;
        const key = `${a}+${b}`;
        state.synergies.push(key);
        // Traits are handled by Weapon.update() dynamically checking isSynergyUnlocked
        spawnFloatingText(`SYNERGY!`, state.player.x, state.player.y, '#fbbf24');
    }

    state.level++;
    state.screen = 'playing';
    updateUI();
};

function resetGame() {
    state.screen = 'playing';
    state.player.hp = 100;
    state.player.x = state.width / 2;
    state.player.y = state.height / 2;
    state.frames = 0;
    state.seconds = 0;
    state.xp = 0;
    state.level = 1;
    state.gemsNeeded = 5;
    state.shake = 0;

    state.bullets = [];
    state.enemies = [];
    state.particles = [];
    state.floatingTexts = [];
    state.gems = [];
    state.synergies = [];

    weapons = {
        'content': new Weapon('content')
    };
    weapons['content'].level = 1;

    state.stats = { damageMult: 1, areaMult: 1, speedMult: 1, cooldownMult: 1, amountMult: 0, pierce: 0 };
    updateUI();
}

// Start
updateUI();
resize();
loop();
