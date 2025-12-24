function spawnOneEnemy() {
    // Edges
    let x, y;
    if (Math.random() < 0.5) {
        x = Math.random() < 0.5 ? -30 : state.width + 30;
        y = Math.random() * state.height;
    } else {
        x = Math.random() * state.width;
        y = Math.random() < 0.5 ? -30 : state.height + 30;
    }

    // Type logic based on time
    let type = 'lead'; // Basic
    if (state.seconds >= 60 && Math.random() > 0.7) type = 'tank';
    if (state.seconds >= 120 && Math.random() > 0.8) type = 'dasher';
    if (state.seconds >= 180 && Math.random() > 0.85) type = 'ranged';
    if (state.seconds >= 240 && Math.random() > 0.95 && !state.enemies.some(e => e.type === 'boss')) type = 'boss';

    // Scaling: Base * 1.08^Level + Time Scaling (Slower ramp)
    const difficultyMult = Math.pow(1.08, state.level) + (state.seconds / 90);

    let stats = { hp: 10, speed: 2, visual: '👻', r: 15, xp: 5 * (1 + state.level * 0.1) };

    if (type === 'lead') {
        stats = { hp: 10 * difficultyMult, speed: (2 + Math.random()) * 0.45, visual: '👻', r: 15, xp: 5 * (1 + state.level * 0.1) };
    }
    else if (type === 'tank') {
        stats = { hp: 40 * difficultyMult, speed: 1.0 * 0.45, visual: '😡', r: 25, xp: 20 * (1 + state.level * 0.1) };
    }
    else if (type === 'dasher') {
        stats = { hp: 15 * difficultyMult, speed: 4.0 * 0.45, visual: '💸', r: 12, xp: 10 * (1 + state.level * 0.1) };
    }
    else if (type === 'ranged') {
        stats = { hp: 20 * difficultyMult, speed: 1.5 * 0.45, visual: '🧙', r: 18, xp: 15 * (1 + state.level * 0.1), type: 'ranged', shootCd: 0 };
    }
    else if (type === 'boss') {
        stats = { hp: 5000 * difficultyMult, speed: 0.5 * 0.45, visual: '👹', r: 60, xp: 500 * (1 + state.level * 0.1), type: 'boss', knockbackImmune: true };
    }

    state.enemies.push({ x, y, ...stats, maxHp: stats.hp });
}

function updateEnemies() {
    if (state.frames % CONFIG.SPAWN_RATE_INITIAL === 0) {
        // Spawn rate increases with time
        const rate = Math.max(10, 60 - Math.floor(state.seconds / 10)); // Cap at 1 spawn per 10 frames
        if (state.frames % rate === 0) spawnOneEnemy();
    }
    // Always spawn at least one occasionally if rate logic is weird
    if (state.frames % 60 === 0) spawnOneEnemy();

    // Move logic
    for (let i = state.enemies.length - 1; i >= 0; i--) {
        const e = state.enemies[i];
        const angle = Math.atan2(state.player.y - e.y, state.player.x - e.x);

        // Ranged logic
        if (e.type === 'ranged') {
            const d = Math.sqrt((e.x - state.player.x) ** 2 + (e.y - state.player.y) ** 2);
            if (d > 200) {
                e.x += Math.cos(angle) * e.speed;
                e.y += Math.sin(angle) * e.speed;
            }
            // Shoot
            e.shootCd = (e.shootCd || 0) - 1;
            if (e.shootCd <= 0) {
                e.shootCd = 240; // 4 seconds
                state.enemyBullets.push({
                    x: e.x, y: e.y,
                    vx: Math.cos(angle) * 2, vy: Math.sin(angle) * 2,
                    r: 8,
                    dmg: 10,
                    duration: 300,
                    color: '#ef4444',
                    type: 'enemy_orb'
                });
            }
        } else {
            e.x += Math.cos(angle) * e.speed;
            e.y += Math.sin(angle) * e.speed;
        }
    }
}

function updateEnemyBullets() {
    for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
        const b = state.enemyBullets[i];
        b.x += b.vx;
        b.y += b.vy;
        b.duration--;

        // Collision with Player
        const d = (b.x - state.player.x) ** 2 + (b.y - state.player.y) ** 2;
        if (d < (state.player.r + b.r) ** 2) {
            state.player.hp -= b.dmg;
            state.shake = 5;
            spawnParticleBurst(state.player.x, state.player.y, '#ef4444', 10);
            state.enemyBullets.splice(i, 1);
            if (state.player.hp <= 0 && state.screen === 'playing') {
                // Game Over handled in main loop usually, or simple check here
                state.screen = 'over';
                updateUI();
            }
            continue;
        }

        if (b.duration <= 0) {
            state.enemyBullets.splice(i, 1);
        }
    }
}

function updateBullets() {
    for (let i = state.bullets.length - 1; i >= 0; i--) {
        const b = state.bullets[i];
        b.duration--;
        if (b.duration <= 0) {
            // Expire
            if (b.type === 'viral_throw') {
                // Explode on expire
                createExplosion(b.targetX, b.targetY, b.area || 100, b.dmg, b);
            }
            state.bullets.splice(i, 1);
            continue;
        }
        b.x += b.vx; b.y += b.vy;

        // Special Bullet Logic
        if (b.type === 'funnel_zone' && b.drip) {
            b.dripCd = (b.dripCd || 0) - 1;
            if (b.dripCd <= 0) {
                b.dripCd = 60;
                const target = findNearestEnemy();
                const angle = target ? Math.atan2(target.y - b.y, target.x - b.x) : Math.random() * Math.PI * 2;
                for (let j = 0; j < 3; j++) {
                    const finalAngle = angle + (j - 1) * 0.4;
                    spawnBullet({
                        type: 'newsletter',
                        x: b.x, y: b.y,
                        vx: Math.cos(finalAngle) * 8, vy: Math.sin(finalAngle) * 8,
                        dmg: 5 * state.stats.damageMult,
                        duration: 30,
                        r: 4,
                        color: '#10b981'
                    });
                }
            }
        } else if (b.type === 'beam') {
            // FIX: Update target position references
            if (b.target && !b.target.dead) {
                b.targetX = b.target.x;
                b.targetY = b.target.y;
            } else if (b.targetX === undefined) {
                b.duration = 0;
            }
        } else if (b.homing) {
            const target = findNearestEnemy();
            if (target) {
                const angle = Math.atan2(target.y - b.y, target.x - b.x);
                b.vx += Math.cos(angle) * 0.5;
                b.vy += Math.sin(angle) * 0.5;
                const speed = Math.sqrt(b.vx ** 2 + b.vy ** 2);
                if (speed > 8) { b.vx *= 0.9; b.vy *= 0.9; }
            }
            b.x += b.vx; b.y += b.vy; // Double move? No, already moved above. Remove duplicate move.
            // Oh wait, `b.x +=` is above. So this modifies v for NEXT frame. Correct.
        } else if (b.type === 'spider_minion') {
            // Minion AI
            b.attackCd = (b.attackCd || 0) - 1;
            let target = findNearestEnemy();
            if (target) {
                const angle = Math.atan2(target.y - b.y, target.x - b.x);
                b.vx = Math.cos(angle) * b.speed;
                b.vy = Math.sin(angle) * b.speed;
            }
            // Minions override standard bullet movement which is purely ballistic? 
            // `b.x += b.vx` is already called at start of loop.
            // But we just set vx/vy. So it will move next frame.
            // To make it responsive, we can move it now or accept 1 frame delay. 1 frame is fine.
        }
    }
}

function spawnParticleBurst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        state.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 30 + Math.random() * 20,
            color,
            size: Math.random() * 3 + 2
        });
    }
}

function spawnDebris(x, y, emojis, count) {
    for (let i = 0; i < count; i++) {
        const char = emojis[Math.floor(Math.random() * emojis.length)];
        state.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15 - 5,
            life: 40,
            type: 'text',
            char: char,
            size: 20,
            gravity: 0.5
        });
    }
}

function updateParticles() {
    for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx; p.y += p.vy;

        if (p.type === 'text') {
            p.vy += p.gravity || 0;
            p.life--;
        } else {
            p.life -= 1; // Standardize
        }

        if (p.life <= 0) state.particles.splice(i, 1);
    }
}

function spawnFloatingText(text, x, y, color) {
    state.floatingTexts.push({ text, x, y, color, life: 1.0, vy: -1 });
}

function updateFloatingTexts() {
    // Logic handled in draw? No, update logic should be here.
    // The original code mixed draw/update. I will move update logic here.
    for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
        const t = state.floatingTexts[i];
        t.y += t.vy;
        t.life -= 0.02;
        if (t.life <= 0) state.floatingTexts.splice(i, 1);
    }
}
