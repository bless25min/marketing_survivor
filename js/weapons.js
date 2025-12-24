function spawnBullet(opts) {
    state.bullets.push({
        x: opts.x, y: opts.y,
        vx: opts.vx || 0, vy: opts.vy || 0,
        ...opts,
        life: opts.duration || 60,
        duration: opts.duration || 60
    });
}

function fireProjectile(w, count, spread, stats) {
    const target = findNearestEnemy();
    const angle = target ? Math.atan2(target.y - state.player.y, target.x - state.player.x) : Math.random() * Math.PI * 2;

    for (let i = 0; i < count; i++) {
        const finalAngle = angle + (i - (count - 1) / 2) * (spread / Math.max(1, count));
        const speed = stats.speed * (stats.randomSpeed ? (0.8 + Math.random() * 0.4) : 1);
        spawnBullet({
            type: w.id,
            x: state.player.x, y: state.player.y,
            vx: Math.cos(finalAngle) * speed, vy: Math.sin(finalAngle) * speed,
            dmg: stats.dmg * state.stats.damageMult,
            duration: stats.duration,
            r: stats.r || 5,
            color: stats.color,
            explosive: stats.explosive,
            pierce: stats.pierce,
            visual: stats.visual,
            homing: stats.homing,
            leaveZone: stats.leaveZone,
            hasMinionTrait: stats.hasMinionTrait,
            hasLockonTrait: stats.hasLockonTrait
        });
    }
}

function fireThrow(w, count, stats) {
    for (let i = 0; i < count; i++) {
        // Filter targets within view
        const validTargets = state.enemies.filter(e => {
            const d = (e.x - state.player.x) ** 2 + (e.y - state.player.y) ** 2;
            return d < 600 ** 2; // ~Screen distance
        });
        const target = validTargets.length > 0 ? validTargets[Math.floor(Math.random() * validTargets.length)] : null;

        const tX = target ? target.x : state.player.x + (Math.random() - 0.5) * 300;
        const tY = target ? target.y : state.player.y + (Math.random() - 0.5) * 300;
        const angle = Math.atan2(tY - state.player.y, tX - state.player.x);

        // Calculate precise duration to land on target
        const speed = stats.speed || 4;
        const dist = Math.sqrt((tX - state.player.x) ** 2 + (tY - state.player.y) ** 2);
        const flightTime = Math.max(30, Math.floor(dist / speed)); // Min 0.5s flight

        spawnBullet({
            type: 'viral_throw',
            x: state.player.x, y: state.player.y,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            targetX: tX, targetY: tY,
            dmg: stats.dmg * state.stats.damageMult,
            duration: flightTime,
            color: stats.color || '#a855f7',
            r: stats.r || 15,
            area: stats.area,
            explodeOnContact: false,
            explosive: stats.explosive,
            leaveZone: stats.leaveZone,
            hasMinionTrait: stats.hasMinionTrait,
            hasLockonTrait: stats.hasLockonTrait,
            homing: stats.homing,
            drip: stats.drip
        });
    }
}

function spawnMinion(opts) {
    state.bullets.push({
        type: 'spider_minion',
        x: opts.x, y: opts.y,
        vx: 0, vy: 0,
        r: 8,
        dmg: opts.dmg,
        duration: opts.life,
        color: opts.color,
        life: opts.life,
        speed: opts.speed,
        pierce: 99,
        attackCd: 0 // Allow repeated attacks
    });
}

const WEAPON_REGISTRY = {
    'content': {
        name: "內容行銷", icon: "📄", type: "projectile", trait: "rapid",
        baseStats: { cd: 40, dmg: 10, speed: 6, duration: 60, count: 1, spread: 0.2, color: '#facc15' },
        tags: ['content'],
        description: "發射文件攻擊最近的敵人 (Projectile)。\n效果：每級增加數量與傷害。",
        behavior: (w, s, stats) => {
            const bonusCount = stats.count - 1;
            fireProjectile(w, w.level + bonusCount, 0.2 + (stats.spread || 0), stats);
        }
    },
    'viral': {
        name: "病毒式傳播", icon: "💣", type: "throw", trait: "explosive",
        baseStats: { cd: 120, dmg: 40, speed: 4, duration: 60, area: 150, color: '#a855f7', r: 15, count: 1 },
        tags: ['viral'],
        description: "投擲會爆炸的病毒炸彈 (Throw)。\n效果：每級增加爆炸範圍與傷害。",
        behavior: (w, s, stats) => {
            const count = w.level + ((stats.count || 1) - 1); // 1 per level
            fireThrow(w, count, stats);
        }
    },
    'funnel': {
        name: "銷售漏斗", icon: "🌪️", type: "zone", trait: "zone",
        baseStats: { cd: 180, dmg: 5, duration: 180, count: 1, area: 60, color: '#ef4444' },
        tags: ['funnel'],
        description: "在隨機位置生成持續傷害的火焰旋風 (Zone)。\n效果：每級增加持續時間與範圍。",
        behavior: (w, s, stats) => {
            const bonusCount = stats.count - 1;
            const count = 1 + Math.floor(w.level / 2) + bonusCount;
            for (let i = 0; i < count; i++) {
                const tX = state.player.x + (Math.random() - 0.5) * 400;
                const tY = state.player.y + (Math.random() - 0.5) * 300;
                const areaMult = stats.area / 60;
                spawnBullet({
                    type: 'funnel_zone',
                    x: tX, y: tY, vx: 0, vy: 0,
                    r: 60 * areaMult * s.areaMult,
                    dmg: stats.dmg * s.damageMult,
                    duration: stats.duration,
                    color: stats.color,
                    color: stats.color,
                    drip: stats.drip,
                    explosive: stats.explosive,
                    hasMinionTrait: stats.hasMinionTrait,
                    hasLockonTrait: stats.hasLockonTrait,
                    leaveZone: stats.leaveZone
                });
            }
        }
    },
    'newsletter': {
        name: "電子報散射", icon: "✉️", type: "projectile", trait: "spread",
        baseStats: { cd: 60, dmg: 8, speed: 5, duration: 50, count: 3, spread: 0.8, color: '#10b981' },
        tags: ['email'],
        description: "向前方散射多封電子郵件 (Projectile)。\n效果：每級增加發射數量。",
        behavior: (w, s, stats) => {
            const bonusCount = stats.count - 1;
            fireProjectile(w, 3 + w.level + bonusCount, 0.8 + (stats.spread || 0), stats);
        }
    },
    'seo': {
        name: "SEO 爬蟲", icon: "🕷️", type: "summon", trait: "minion",
        baseStats: { cd: 300, dmg: 5, count: 2, duration: 600, speed: 3, color: '#22d3ee' },
        tags: ['seo'],
        description: "召喚自動追蹤並攻擊敵人的爬蟲 (Summon)。\n效果：每級增加召喚數量與存活時間。",
        behavior: (w, s, stats) => {
            const bonusCount = stats.count - 1;
            const count = 2 + w.level + bonusCount;
            for (let i = 0; i < count; i++) {
                spawnMinion({
                    x: state.player.x, y: state.player.y,
                    dmg: stats.dmg * s.damageMult,
                    life: stats.duration,
                    color: stats.color,
                    speed: stats.speed
                });
            }
        }
    },
    'cold_call': {
        name: "陌生開發", icon: "📞", type: "beam", trait: "lockon",
        baseStats: { cd: 120, dmg: 8, duration: 30, count: 1, color: '#fca5a5' },
        tags: ['outreach'],
        description: "對最近敵人發射雷射 (Laser Beam)。\n效果：每級增加鎖定目標數量。",
        behavior: (w, s, stats) => {
            const bonusCount = stats.count - 1;
            const count = w.level + bonusCount;
            const targets = findNearestEnemies(count);
            targets.forEach(target => {
                spawnBullet({
                    type: 'beam', target: target, targetX: target.x, targetY: target.y,
                    x: state.player.x, y: state.player.y,
                    dmg: stats.dmg * s.damageMult, duration: 20, color: stats.color
                });
                takeDamage(target, stats.dmg * 5);

                // Manually trigger traits since beams bypass standard collision
                const dummyBullet = { ...stats, x: target.x, y: target.y };
                applyTraitEffects(dummyBullet, target);
            });
        }
    },
    'hashtag': {
        name: "熱門標籤", icon: "#️⃣", type: "orbit", trait: "orbit",
        baseStats: { cd: 1, dmg: 5, duration: 2, count: 1, area: 90, color: '#f0abfc', speed: 1 },
        tags: ['social'],
        description: "在他身周圍旋轉的標籤護盾 (Orbit)。\n效果：每級增加旋轉數量與速度。",
        behavior: (w, s, stats) => {
            w.angle = (w.angle || 0) + 0.03 * s.speedMult * (stats.speed || 1);
            const bonusCount = stats.count - 1;
            const count = 1 + w.level + bonusCount;

            for (let i = 0; i < count; i++) {
                const theta = w.angle + (i * (Math.PI * 2 / count));
                const areaMult = stats.area / 90;
                const orbitR = 90 * areaMult * s.areaMult;

                spawnBullet({
                    type: 'hashtag', // Use specific type for visual
                    x: state.player.x + Math.cos(theta) * orbitR,
                    y: state.player.y + Math.sin(theta) * orbitR,
                    vx: 0, vy: 0, r: 8, dmg: stats.dmg * s.damageMult, duration: 2, color: stats.color,
                    explosive: stats.explosive,
                    hasMinionTrait: stats.hasMinionTrait,
                    hasLockonTrait: stats.hasLockonTrait,
                    leaveZone: stats.leaveZone
                });
            }
        }
    },
    'blog_post': {
        name: "長文佈道", icon: "📖", type: "heavy", trait: "heavy",
        baseStats: { cd: 100, dmg: 30, speed: 3, duration: 90, count: 1, color: '#3b82f6', r: 20 },
        tags: ['content'],
        description: "發射一本巨型書籍，穿透並擊退敵人 (Heavy)。\n效果：每級增加傷害與擊退力。",
        behavior: (w, s, stats) => {
            const bonusCount = stats.count - 1;
            const count = 1 + Math.floor(w.level / 5) + bonusCount;
            // Heavy logic: Pierce infinity
            stats.pierce = 999;
            // Random direction if no target
            fireProjectile(w, count, 0.1, stats);
        }
    },
    'pixel': {
        name: "像素追蹤", icon: "👁️", type: "homing", trait: "homing",
        baseStats: { cd: 60, dmg: 5, speed: 7, duration: 120, count: 2, color: '#4ade80' },
        tags: ['tech'],
        description: "發射會自動轉彎追蹤敵人的眼睛 (Homing)。\n效果：每級增加追蹤靈敏度與數量。",
        behavior: (w, s, stats) => {
            const bonusCount = stats.count - 1;
            stats.homing = true;
            // Custom logic to ensure visual type is pixel_tracker
            const count = 2 + w.level + bonusCount;
            const spread = 0.3;
            const target = findNearestEnemy();
            const angle = target ? Math.atan2(target.y - state.player.y, target.x - state.player.x) : Math.random() * Math.PI * 2;

            for (let i = 0; i < count; i++) {
                const finalAngle = angle + (i - (count - 1) / 2) * (spread / Math.max(1, count));
                const speed = stats.speed * (stats.randomSpeed ? (0.8 + Math.random() * 0.4) : 1);
                spawnBullet({
                    type: 'pixel_tracker',
                    x: state.player.x, y: state.player.y,
                    vx: Math.cos(finalAngle) * speed, vy: Math.sin(finalAngle) * speed,
                    dmg: stats.dmg * state.stats.damageMult,
                    duration: stats.duration,
                    color: stats.color,
                    homing: true,
                    explosive: stats.explosive,
                    hasMinionTrait: stats.hasMinionTrait,
                    hasLockonTrait: stats.hasLockonTrait
                });
            }
        }
    },
    'kol': {
        name: "網紅光環", icon: "✨", type: "aura", trait: "aura",
        baseStats: { cd: 1, dmg: 0.5, duration: 1, area: 60, color: '#ec4899' },
        tags: ['influencer'],
        description: "在身邊持續造成傷害的光環 (Aura)。\n效果：每級增加範圍與傷害。",
        behavior: (w, s, stats) => {
            // Permanent aura around player
            const baseArea = 60;
            const areaMult = stats.area / baseArea;
            const finalArea = (60 + (w.level * 10)) * areaMult;

            spawnBullet({
                type: 'kol_aura',
                x: state.player.x, y: state.player.y,
                vx: 0, vy: 0,
                dmg: stats.dmg * s.damageMult,
                duration: 2,
                r: finalArea * s.areaMult,
                color: stats.color,
                // Pass traits
                explosive: stats.explosive,
                hasMinionTrait: stats.hasMinionTrait
            });
        }
    }
};

class Weapon {
    constructor(id) {
        this.id = id;
        this.def = WEAPON_REGISTRY[id];
        this.level = 0;
        this.cooldown = 0;
        this.traits = [];
    }
    upgrade() { this.level++; }

    hasSynergyTrait(traitName) {
        for (const key of state.synergies) {
            const [a, b] = key.split('+');
            if (a === this.id && WEAPON_REGISTRY[b].trait === traitName) return true;
            if (b === this.id && WEAPON_REGISTRY[a].trait === traitName) return true;
        }
        return false;
    }

    update() {
        if (this.level === 0) return;
        this.cooldown--;
        if (this.cooldown <= 0) {
            let stats = { ...this.def.baseStats };

            if (this.hasSynergyTrait('rapid')) { stats.cd *= 0.5; stats.count += 2; stats.speed = (stats.speed || 1) * 1.5; }
            if (this.hasSynergyTrait('heavy')) { stats.dmg *= 2.0; stats.r = (stats.r || 10) * 1.5; stats.pierce = 999; }
            if (this.hasSynergyTrait('spread')) { stats.count += 4; stats.spread = (stats.spread || 0) + 0.8; }
            if (this.hasSynergyTrait('aura')) {
                spawnBullet({ type: 'kol_aura', x: state.player.x, y: state.player.y, vx: 0, vy: 0, r: 100, dmg: stats.dmg * 0.8 * state.stats.damageMult, duration: 20, color: '#ec4899', isTrait: true });
            }
            if (this.hasSynergyTrait('minion')) {
                stats.hasMinionTrait = true;
            }
            if (this.hasSynergyTrait('homing')) { stats.homing = true; stats.speed *= 1.2; }
            if (this.hasSynergyTrait('lockon')) { stats.hasLockonTrait = true; }
            if (this.hasSynergyTrait('orbit')) { stats.hasOrbitTrait = true; }
            if (this.hasSynergyTrait('explosive')) { stats.explosive = true; stats.dmg *= 1.2; }
            if (this.hasSynergyTrait('zone')) { stats.leaveZone = true; }

            // Special Synergy Logic
            if (this.id === 'funnel' && this.hasSynergyTrait('spread')) {
                stats.drip = true;
            }

            this.def.behavior(this, state.stats, stats);

            if (stats.hasOrbitTrait) {
                for (let k = 0; k < 3; k++) {
                    const angel = (Math.random() + k) * (Math.PI * 2 / 3);
                    const dist = 60 + Math.random() * 20;
                    spawnBullet({
                        type: 'orbit_hit',
                        x: state.player.x + Math.cos(angel) * dist,
                        y: state.player.y + Math.sin(angel) * dist,
                        vx: 0, vy: 0, r: 12,
                        dmg: stats.dmg * 1.0 * state.stats.damageMult,
                        duration: 60,
                        color: stats.color
                    });
                }
            }

            this.cooldown = (stats.cd * state.stats.cooldownMult) / (1 + this.level * 0.1);
        }
    }
}
