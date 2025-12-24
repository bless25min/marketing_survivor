const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const state = {
    screen: 'start', // start, playing, upgrade, over
    width: 0,
    height: 0,
    frames: 0,
    seconds: 0,

    player: { x: 0, y: 0, r: 10, speed: 4, hp: 100, maxHp: 100, angle: 0 },

    bullets: [],
    enemyBullets: [],
    enemies: [],
    particles: [],
    floatingTexts: [],
    gems: [], // XP Drops

    level: 1,
    xp: 0,
    xpNeeded: 10,

    gemsNeeded: 5, // Legacy counter? No, let's use xp/xpNeeded

    // Upgrades
    stats: {
        damageMult: 1,
        areaMult: 1,
        speedMult: 1,
        cooldownMult: 1,
        amountMult: 0,
        pierce: 0
    },

    synergies: [], // Unlocked synergy keys ['content+viral']

    // Systems
    shake: 0,
    hitStop: 0,

    // Upgrade Menu
    upgradeOptions: [],

    // Logic
    lastStoryTime: 0,
    zoom: 1.0
};

let weapons = {};

function resize() {
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    canvas.width = state.width;
    canvas.height = state.height;
}
window.addEventListener('resize', resize);
resize();
