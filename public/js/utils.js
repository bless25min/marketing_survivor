function findNearestEnemy() {
    let nearest = null;
    let minDist = Infinity;
    state.enemies.forEach(e => {
        if (e.type === 'boss') return; // Ignore Boss
        const d = (e.x - state.player.x) ** 2 + (e.y - state.player.y) ** 2;
        if (d < minDist) {
            minDist = d;
            nearest = e;
        }
    });
    return nearest;
}

function findNearestEnemies(count) {
    // Sort by distance
    const sorted = [...state.enemies]
        .filter(e => e.type !== 'boss') // Ignore Boss
        .sort((a, b) => {
            const da = (a.x - state.player.x) ** 2 + (a.y - state.player.y) ** 2;
            const db = (b.x - state.player.x) ** 2 + (b.y - state.player.y) ** 2;
            return da - db;
        });
    return sorted.slice(0, count);
}

function getWeaponName(key) { return WEAPON_REGISTRY[key] ? WEAPON_REGISTRY[key].name : key; }

// Check if synergy pair is active
function isSynergyUnlocked(a, b) {
    const key1 = `${a}+${b}`;
    const key2 = `${b}+${a}`;
    return state.synergies.includes(key1) || state.synergies.includes(key2);
}

function hasWeapon(id) { return weapons[id] && weapons[id].level > 0; }
function hasSynergy(name) {
    if (name === 'meme_virus') return hasWeapon('content') && hasWeapon('viral');
    if (name === 'drip_campaign') return hasWeapon('funnel') && hasWeapon('newsletter');
    return false;
}

function takeDamage(e, dmg) {
    if (e.type === 'boss') return; // ABSOLUTE IMMUNITY: Boss cannot take damage or effect

    e.hp -= dmg;
    // Floating Text
    spawnFloatingText(Math.ceil(dmg), e.x, e.y - 10, '#fff');
    e.flash = 5; // Flash white

    // Knockback
    // Knockback
    if (!e.knockbackImmune) {
        const angle = Math.atan2(e.y - state.player.y, e.x - state.player.x);
        e.x += Math.cos(angle) * 5;
        e.y += Math.sin(angle) * 5;
    }

    if (dmg > 10 || e.hp <= 0) {
        state.hitStop = 3; // Freeze for 3 frames
    }

    if (e.hp <= 0) {
        // Kill - Explosion of debris
        spawnParticleBurst(e.x, e.y, e.color, 8);
        // Emoji Debris
        spawnDebris(e.x, e.y, ['💀', '💸', '💢'], 3);

        state.gems.push({ x: e.x, y: e.y, val: e.xp });
        e.dead = true;
    }
}

function createExplosion(x, y, r, dmg, sourceBullet) {
    // Visual
    spawnParticleBurst(x, y, '#facc15', 20);
    // Logic
    state.enemies.forEach(e => {
        // Boss Immunity to Explosions
        if (e.type === 'boss') return;

        const d = (e.x - x) ** 2 + (e.y - y) ** 2;
        if (d < r ** 2) {
            takeDamage(e, dmg);
            if (sourceBullet) {
                applyTraitEffects(sourceBullet, e);
            }
        }
    });
    // Camera Shake
    state.shake = 10;
}

function applyTraitEffects(b, e) {
    // SYNERGY: Meme Virus (Explosions)
    if (b.explosive) {
        createExplosion(b.x, b.y, 40, b.dmg * 0.5);
    }
    // Trait: Zone
    if (b.leaveZone) {
        spawnBullet({ type: 'funnel_zone', x: e.x, y: e.y, vx: 0, vy: 0, r: 30, dmg: b.dmg * 0.3, duration: 60, color: '#facc15' });
    }
    // Trait: Minion
    if (b.hasMinionTrait && Math.random() < 1.0) {
        spawnMinion({ type: 'spider_minion', x: e.x, y: e.y, dmg: b.dmg * 0.5, life: 120, color: '#22d3ee', speed: 4 });
        b.hasMinionTrait = false;
    }
    // Trait: Lockon
    if (b.hasLockonTrait) {
        spawnBullet({ type: 'beam', target: e, targetX: e.x, targetY: e.y, x: state.player.x, y: state.player.y, dmg: 0, duration: 10, color: '#fca5a5' });
        takeDamage(e, b.dmg * 0.5);
    }
}

function checkCollisions() {
    // 1. Bullets vs Enemies
    state.bullets.forEach(b => {
        state.enemies.forEach(e => {
            if (e.dead) return;

            // BOSS IMMUNITY: Bosses ignore all bullets to prevent lag and ensure they are unstoppable
            if (e.type === 'boss') return;

            if (b.type === 'funnel_zone') {
                // Circle collision
                const d = ((e.x - b.x) ** 2 + (e.y - b.y) ** 2);
                if (d < b.r ** 2) {
                    // Zone damage tick
                    if (state.frames % 10 === 0) {
                        takeDamage(e, b.dmg);
                        applyTraitEffects(b, e); // Allow zones to trigger traits on tick
                    }
                    e.x -= (e.x - b.x) * 0.05;
                }
            } else if (b.type === 'spider_minion') {
                // Minion Collision (Bite)
                const d = ((e.x - b.x) ** 2 + (e.y - b.y) ** 2);
                if (d < (e.r + b.r) ** 2) {
                    if (b.attackCd <= 0) {
                        b.attackCd = 30; // Bite every 0.5s
                        takeDamage(e, b.dmg);
                        // Knockback minion slightly?
                        const angle = Math.atan2(b.y - e.y, b.x - e.x);
                        b.vx += Math.cos(angle) * 5;
                        b.vy += Math.sin(angle) * 5;
                    }
                }
            } else if (['content', 'newsletter', 'blog_post', 'beam', 'orbit_hit', 'pixel_tracker', 'hashtag'].includes(b.type)) {
                // Point collision
                const d = ((e.x - b.x) ** 2 + (e.y - b.y) ** 2);
                if (d < (e.r + b.r) ** 2) {
                    if (b.hitIds && b.hitIds.has(e)) return;

                    takeDamage(e, b.dmg);
                    applyTraitEffects(b, e);

                    // Pierce Logic
                    if (b.pierce && b.pierce > 0) {
                        b.pierce--;
                        if (!b.hitIds) b.hitIds = new WeakSet();
                        b.hitIds.add(e);
                    } else {
                        b.duration = 0;
                    }
                    state.shake = 2;
                }
            } else if (b.type === 'viral_throw') {
                const d = ((e.x - b.x) ** 2 + (e.y - b.y) ** 2);
                if (d < (e.r + b.r) ** 2 && b.explodeOnContact) {
                    createExplosion(b.x, b.y, b.area || 100, b.dmg);
                    b.duration = 0;
                }
            } else if (b.type === 'poison_pool') {
                const d = ((e.x - b.x) ** 2 + (e.y - b.y) ** 2);
                if (d < b.r ** 2) {
                    if (state.frames % 15 === 0) {
                        takeDamage(e, b.dmg);
                        applyTraitEffects(b, e); // Allow poison to trigger traits? Sure
                    }
                }
            } else if (b.type === 'kol_aura') {
                const d = ((e.x - b.x) ** 2 + (e.y - b.y) ** 2);
                if (d < b.r ** 2) {
                    if (state.frames % 10 === 0) {
                        takeDamage(e, b.dmg);
                        applyTraitEffects(b, e); // Allow aura to trigger traits
                    }
                    const angle = Math.atan2(e.y - b.y, e.x - b.x);
                    e.x += Math.cos(angle) * 0.5;
                    e.y += Math.sin(angle) * 0.5;
                }
            }
        });
    });

    // Remove dead enemies
    state.enemies = state.enemies.filter(e => !e.dead);

    // 2. Player vs Enemies
    state.enemies.forEach(e => {
        const d = ((e.x - state.player.x) ** 2 + (e.y - state.player.y) ** 2);
        if (d < (state.player.r + e.r) ** 2) {
            // Hit player
            state.player.hp -= 1; // 1 DMG per frame contact? Ouch. Maybe cooldown?
            state.player.hp = Math.max(0, state.player.hp);
            state.shake = 5;
            spawnParticleBurst(state.player.x, state.player.y, '#ef4444', 10);

            // Push back enemy
            const angle = Math.atan2(e.y - state.player.y, e.x - state.player.x);
            e.x += Math.cos(angle) * 50;
            e.y += Math.sin(angle) * 50;

            if (state.player.hp <= 0) {
                gameOver();
            }
        }
    });

    // 3. Gems
    // Magnet
    const magnetR = CONFIG.BASE_MAGNET * (1 + (weapons.funnel ? weapons.funnel.level * 0.1 : 0));

    for (let i = state.gems.length - 1; i >= 0; i--) {
        const g = state.gems[i];
        const dx = state.player.x - g.x;
        const dy = state.player.y - g.y;
        const d2 = dx * dx + dy * dy;

        if (d2 < magnetR ** 2) {
            // Pull
            g.x += dx * 0.1;
            g.y += dy * 0.1;
        }

        if (d2 < state.player.r ** 2) {
            // Collect
            // XP Calculation
            // Default: 50% Nerf
            // Logged In: 100% (Bonus restored)
            const xpMult = state.player.image ? 1.0 : 0.5;
            state.xp += g.val * xpMult;
            state.gems.splice(i, 1);
            // Ding sound?
            if (state.xp >= state.xpNeeded) {
                levelUp();
            }
        }
    }
}
