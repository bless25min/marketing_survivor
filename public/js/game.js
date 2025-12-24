function update() {
    if (state.screen !== 'playing') return;

    if (state.hitStop > 0) {
        state.hitStop--;
        return;
    }

    state.frames++;
    if (state.frames % 60 === 0) {
        state.seconds++;
        checkTimeStory();
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
    if (state.screen === 'story') {
        // PREVENT GHOST EVENTS: Telling browser we handled this.
        e.preventDefault();

        const now = Date.now();
        if (now - (state.lastStoryTime || 0) < 300) return; // 0.3s Debounce for natural reading rhythm
        state.lastStoryTime = now;

        state.storyStep = (state.storyStep || 0) + 1;
        if (state.storyStep < state.storyContent.length) {
            updateUI();
        } else {
            state.screen = 'playing';
            updateUI();
        }
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
        ui.innerHTML = `<h1 style="font-size: 4rem; color: #fbbf24; text-shadow: 0 0 20px #b45309;">行銷倖存者</h1><p style="font-size: 1.5rem; animation: pulse 1s infinite;">點擊畫面開始挑戰</p>`;
        ui.style.display = 'flex';
        ui.style.background = 'rgba(0,0,0,0.6)';
        ui.style.border = 'none';
    } else if (state.screen === 'over') {
        ui.innerHTML = `
            <h1 style="color: #ef4444; text-shadow: 0 0 20px #7f1d1d; font-size: 4rem;">任務失敗</h1>
            <p style="font-size: 1.5rem; color: #e5e7eb;">存活時間: ${Math.floor(state.seconds)} 秒</p>
            <p style="margin-top: 20px; color: #94a3b8;">點擊畫面重新開始</p>
            
            <div style="margin-top: 40px; text-align: center;">
                <p style="color: #fbbf24; font-size: 1.2rem; margin-bottom: 10px;">想知道如何突破行銷瓶頸？</p>
                <button class="course-btn" onclick="window.open('https://www.25min.co/', '_blank')" 
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
    } else if (state.screen === 'story') {
        // Story Rendering logic (already handled by dynamic content)
        // Re-using the logic from previous edits but ensuring it's robust
        const currentSlide = state.storyContent[state.storyStep] || state.storyContent[0];

        let avatar = '👨‍🏫';
        let nameColor = '#facc15';
        let borderColor = '#a855f7';

        if (currentSlide.speaker !== 'AI COACH' && currentSlide.speaker !== 'Narrator' && currentSlide.speaker !== 'Marketing Director') {
            avatar = '😰'; // User avatar
            nameColor = '#38bdf8'; // Blue for users
            borderColor = '#0ea5e9';
        } else if (currentSlide.speaker === 'Thinking') {
            avatar = '🤔';
        }

        ui.innerHTML = `
            <div style="background: rgba(15, 23, 42, 0.95); padding: 40px; border-radius: 20px; border: 2px solid ${borderColor}; max-width: 600px; text-align: center; box-shadow: 0 0 50px rgba(0,0,0,0.8);">
                <div style="font-size: 4rem; margin-bottom: 10px;">${avatar}</div>
                <h2 style="color: ${nameColor}; margin-bottom: 20px; font-size: 2rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">${currentSlide.name}</h2>
                <div style="font-size: 1.5rem; line-height: 1.6; color: #e2e8f0; white-space: pre-line; text-align: left; background: rgba(0,0,0,0.3); padding: 20px; border-radius: 10px;">${currentSlide.content}</div>
                
                <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #64748b; font-size: 0.9rem;">${state.storyStep + 1} / ${state.storyContent.length}</span>
                    <div style="font-size: 1.2rem; color: #facc15; animation: pulse 1s infinite; font-weight: bold; cursor: pointer;">
                        ${currentSlide.action || "點擊繼續 ▶"}
                    </div>
                </div>
            </div>
        `;
        ui.style.display = 'flex';
        ui.style.background = 'rgba(0,0,0,0.7)';
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
    state.player.x = state.width / 2;
    state.player.y = state.height / 2;
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

    state.storyShown = {}; // Reset story tracking
    state.storyStep = 0; // Initialize story step
    updateUI();
}

// Narrative Script (Interactive Visual Novel Style) - Full Content Version
const STORY_TIMELINE = {
    1: [
        {
            speaker: "Narrator",
            name: "案例一：小杰 (行銷企劃)",
            content: "小杰是行銷企劃，他看過遊戲化理論、玩過案例，也能說出一堆動機設計名詞。\n\n但每次真的要做活動時，問題就來了。\n他知道「要有關卡、回饋、動機」，卻不知道第一步該怎麼開始。",
            action: "TAP TO CONTINUE"
        },
        {
            speaker: "Little Jie",
            name: "小杰",
            content: "「我畫了一堆心智圖流程圖，最後還是回到一個靜態落地頁，加一句『加入 LINE 獲得好康』...\n不是我不懂理論，而是理論跟實作之間，根本少了一條橋。」",
            action: "TAP TO CONTINUE"
        },
        {
            speaker: "AI Coach",
            name: "AI COACH",
            content: "這堂課，就是把那條橋搭起來：\n從「我要加 LINE 好友」開始，一步一步拆成「使用者會怎麼玩、什麼時候願意登入、完成後得到什麼」。",
            action: "TAP TO CONTINUE"
        },
        {
            speaker: "AI Coach",
            name: "AI COACH",
            content: "他第一次發現，原來遊戲化不是想得漂亮，而是流程走得順。",
            action: "此為【真實案例】改編 ▶"
        }
    ],
    30: [
        {
            speaker: "Narrator",
            name: "案例二：阿慧 (品牌主)",
            content: "阿慧每個月都在投廣告，曝光數看起來不差，但 LINE 好友數卻成長得很慢。\n她試過很多方式：換圖、換文案、送折扣、送抽獎，但加好友的那一步，永遠是最大的斷點。",
            action: "TAP TO CONTINUE"
        },
        {
            speaker: "Ah Hui",
            name: "阿慧",
            content: "「後來我才意識到一件事：問題不在誘因，而在使用者根本沒有『參與感』。\n廣告只是被看過，但沒有被『玩過』。」",
            action: "TAP TO CONTINUE"
        },
        {
            speaker: "AI Coach",
            name: "AI COACH",
            content: "在課程中，她把原本的 CTA 改成一個簡單的互動流程，讓使用者先完成一個小任務，再自然引導 LINE Login。\n\n結果不是奇蹟式爆量，而是完成率與加好友率穩定上升。",
            action: "TAP TO CONTINUE"
        },
        {
            speaker: "AI Coach",
            name: "AI COACH",
            content: "她第一次明白，行銷不是喊人留下資料，而是設計一段「讓人願意走完的體驗」。",
            action: "此為【真實案例】改編 ▶"
        }
    ],
    60: [
        {
            speaker: "Narrator",
            name: "案例三：阿哲 (行銷人)",
            content: "阿哲很早就開始用 AI。他用 ChatGPT 寫文案、想點子，看起來都很厲害。\n但那些內容，始終停留在文件裡。",
            action: "TAP TO CONTINUE"
        },
        {
            speaker: "Ah Zhe",
            name: "阿哲",
            content: "「我不知道怎麼把這些想法變成真的上線的網頁，更不會寫程式串接互動...\n我好像想得到，但就是做不出來。\nAI 對我來說只是一個靈感產生器，不是能幫我把事情完成的工具。」",
            action: "TAP TO CONTINUE"
        },
        {
            speaker: "AI Coach",
            name: "AI COACH",
            content: "直到在這堂課，他第一次用 AI 做的不是「文案」，而是整個遊戲化落地頁的結構。\n\n用 AI 拆解目標、產出遊戲流程、選項、引導說明，並直接拿來部署。",
            action: "TAP TO CONTINUE"
        },
        {
            speaker: "AI Coach",
            name: "AI COACH",
            content: "原來不用寫程式，也可以把創意真正做成落地頁！\n\nAI 在這裡不再只是「幫你想」，而是幫你把想法拆成結構、變成頁面、丟進市場跑。",
            action: "TAP TO CONTINUE"
        },
        {
            speaker: "AI Coach",
            name: "AI COACH",
            content: "更關鍵的是，他不再問「哪個比較好」，而是直接做兩個版本實際跑廣告看數據。\n\n那一刻他才理解，AI 的價值不是創意，而是把創意變成可以被驗證的東西。",
            action: "此為【真實案例】改編 ▶"
        }
    ],
    90: [
        {
            speaker: "Narrator",
            name: "案例四：告別行銷腦霧",
            content: "許多行銷人在面對新專案時，常陷入「腦霧」狀態：\n看著產品，腦袋卻一片空白，完全不知道該從何下手。",
            action: "TAP TO CONTINUE"
        },
        {
            speaker: "Marketing Director",
            name: "行銷總監",
            content: "「我們不是沒經驗，而是每次都要從零發想，消耗巨大心力。\n我們需要的，不只是偶爾的靈感，而是一套能穩定產出的邏輯。」",
            action: "TAP TO CONTINUE"
        },
        {
            speaker: "AI Coach",
            name: "AI COACH",
            content: "腦霧的成因，是因為缺乏「行銷邏輯架構」。\n試圖在沒有骨架的狀態下填肉，自然會迷失方向。",
            action: "TAP TO CONTINUE"
        },
        {
            speaker: "AI Coach",
            name: "AI COACH",
            content: "本單元不談複雜理論，只教一套「簡單廣告邏輯」。\n將「產品核心」直接對應到「互動腳本」。\n\n一旦結構確立，創意就不再是天馬行空，而是精準填空。",
            action: "此為【真實案例】改編 ▶"
        }
    ],
    120: [
        {
            speaker: "Narrator",
            name: "總結：共通痛點",
            content: "這四個案例，指向同一個問題：\n\n1. 學過理論卻做不出來 → 缺實作流程\n2. 廣告有人看卻沒轉換 → 缺參與感\n3. 用 AI 但成效不穩 → 缺驗證機制\n4. 想不到怎麼結合產品 → 缺行銷結構",
            action: "TAP TO CONTINUE"
        },
        {
            speaker: "AI Coach",
            name: "AI COACH: FINAL LESSON",
            content: "👉 問題不是創意不足，而是沒有一套「好想的結構」。\n\n接下來的最後一波攻勢，請證明你能運用結構，存活下來！",
            action: "任務指令：活下去，並優化它！"
        }
    ]
};

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
                <button class="course-btn" onclick="window.open('https://www.25min.co/', '_blank')" style="
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
    } else if (state.screen === 'story') {
        const step = state.storyStep || 0;
        // Safety check
        if (!state.storyContent || !state.storyContent[step]) return;

        const content = state.storyContent[step];
        const isSpeakerAI = content.speaker.includes('AI');

        ui.innerHTML = `
            <div style="
                position: fixed;
                bottom: 50px;
                left: 50%;
                transform: translateX(-50%);
                width: 85%;
                max-width: 800px;
                background: rgba(15, 23, 42, 0.95);
                border: 2px solid ${isSpeakerAI ? '#facc15' : '#3b82f6'};
                border-radius: 12px;
                padding: 20px 30px;
                box-shadow: 0 0 30px rgba(${isSpeakerAI ? '250, 204, 21' : '59, 130, 246'}, 0.3);
                display: flex;
                flex-direction: column;
                font-family: 'Segoe UI', sans-serif;
                z-index: 1000;
                pointer-events: auto; 
                cursor: pointer;
            ">
                <div style="
                    display: flex; 
                    align-items: center; 
                    margin-bottom: 15px;
                    border-bottom: 1px solid #334155; 
                    padding-bottom: 10px; 
                ">
                    <span style="
                        font-size: 1.2rem; 
                        font-weight: bold; 
                        color: ${isSpeakerAI ? '#facc15' : '#60a5fa'};
                        margin-right: 15px;
                    ">
                        ${content.name}
                    </span>
                </div>

                <div style="flex-grow: 1; min-height: 100px;">
                    <p style="
                        font-size: 1.15rem; 
                        line-height: 1.6; 
                        color: #e2e8f0; 
                        white-space: pre-line;
                        margin: 0;
                    ">
                        ${content.content}
                    </p>
                </div>

                <div style="
                    text-align: right; 
                    margin-top: 15px; 
                    font-size: 0.9rem; 
                    color: #94a3b8; 
                    animation: pulse 1s infinite;
                ">
                    ${content.action}
                </div>
            </div>
        `;
        ui.style.display = 'flex';
        ui.style.background = 'rgba(0, 0, 0, 0.4)';
        ui.style.alignItems = 'flex-end';
        ui.style.justifyContent = 'center';
        ui.style.paddingBottom = '0';
    } else {
        ui.style.display = 'none';
        ui.style.background = 'transparent';
    }
}

function checkTimeStory() {
    // Check if current second has a story and it hasn't been shown
    if (STORY_TIMELINE[state.seconds] && !state.storyShown[state.seconds]) {
        state.screen = 'story';
        state.storyContent = STORY_TIMELINE[state.seconds];
        state.storyStep = 0; // Initialize step to 0
        state.storyShown[state.seconds] = true;
        updateUI();
        return true;
    }
    return false;
}

// Start
updateUI();
resize();
loop();
