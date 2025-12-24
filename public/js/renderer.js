function drawGrid() {
    ctx.strokeStyle = CONFIG.COLORS.grid;
    ctx.lineWidth = 1;
    const gridSize = 40;
    const offsetX = Math.floor(state.player.x / gridSize) * gridSize; // Stationary grid relative to world
    const offsetY = Math.floor(state.player.y / gridSize) * gridSize;

    // Parallax or standard camera? 
    // Current logic: Player moves, camera stays? No, usually camera centers.
    // draw() translate handles camera.

    // Let's assume global coordinates.
    // We need to draw grid lines covering the view.
    // The view is translated by -shake. 
    // Actually we need to draw grid based on player pos to give feeling of movement if background is static.
    // Original simplified logic:
    for (let x = -state.width; x < state.width * 2; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, -state.height); ctx.lineTo(x, state.height * 2); ctx.stroke();
    }
    for (let y = -state.height; y < state.height * 2; y += 40) {
        ctx.beginPath(); ctx.moveTo(-state.width, y); ctx.lineTo(state.width * 2, y); ctx.stroke();
    }
}

function drawPlayer() {
    ctx.save();
    ctx.translate(state.player.x, state.player.y);
    ctx.rotate(state.player.angle);
    ctx.shadowColor = CONFIG.COLORS.player;
    ctx.shadowBlur = 15;
    ctx.fillStyle = CONFIG.COLORS.player;
    ctx.beginPath();
    ctx.arc(0, 0, state.player.r, 0, Math.PI * 2);
    ctx.fill();

    // Overhead Health Bar
    ctx.restore(); // Restore separate from bar to avoid rotation

    if (state.player.hp < state.player.maxHp) {
        const hpPct = Math.max(0, state.player.hp / state.player.maxHp);
        const barWidth = 40;
        const barY = state.player.y - state.player.r - 15;

        // Background
        ctx.fillStyle = '#374151'; // Gray-700
        ctx.fillRect(state.player.x - barWidth / 2, barY, barWidth, 4);

        // Health
        ctx.fillStyle = hpPct > 0.5 ? '#4ade80' : (hpPct > 0.2 ? '#facc15' : '#ef4444');
        ctx.fillRect(state.player.x - barWidth / 2, barY, barWidth * hpPct, 4);
    }
}

function drawBullets() {
    state.bullets.forEach(b => {
        ctx.save();
        ctx.translate(b.x, b.y);

        if (b.color) {
            ctx.shadowColor = b.color;
            ctx.shadowBlur = 10;
            ctx.fillStyle = b.color;
        }

        if (b.type === 'beam') {
            // FIX: Correct line drawing
            if (b.targetX !== undefined && b.targetY !== undefined) {
                ctx.shadowBlur = 0;
                const tx = b.targetX - b.x;
                const ty = b.targetY - b.y;

                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(tx, ty);

                ctx.strokeStyle = b.color || '#fca5a5';
                ctx.lineWidth = Math.max(1, (b.duration / 15) * 5);
                ctx.lineCap = 'round';
                ctx.shadowBlur = 15;
                ctx.shadowColor = b.color;
                ctx.stroke();

                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(tx, ty, 6, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (b.type === 'funnel_zone') {
            const isFire = (state.frames % 20 < 10);
            ctx.fillStyle = isFire ? '#fbbf24' : '#ef4444';
            ctx.globalAlpha = 0.5;
            ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#fca5a5';
            ctx.lineWidth = 2;
            ctx.rotate(state.frames * 0.2);
            ctx.beginPath();
            ctx.moveTo(b.r, 0); ctx.lineTo(-b.r, 0);
            ctx.moveTo(0, b.r); ctx.lineTo(0, -b.r);
            ctx.stroke();

        } else if (b.type === 'viral_throw') {
            // Draw Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.ellipse(0, 0, b.r, b.r * 0.5, 0, 0, Math.PI * 2); ctx.fill();

            // Draw Projectile with Height Arc
            const t = (b.life - b.duration) / b.life;
            const height = Math.sin(t * Math.PI) * 50; // 50px peak height
            ctx.translate(0, -height);

            ctx.fillStyle = '#1e293b';
            ctx.strokeStyle = b.color || '#a855f7';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, b.r || 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#facc15';
            ctx.beginPath(); ctx.arc(b.r * 0.7, -b.r * 0.7, 3, 0, Math.PI * 2); ctx.fill();
            // Undo translate is handled by restore
        } else if (b.type === 'blog_post') {
            const size = b.r || 15;
            ctx.fillStyle = '#f8fafc';
            ctx.beginPath();
            ctx.moveTo(0, -size);
            ctx.quadraticCurveTo(-size / 2, -size - 5, -size, -size);
            ctx.lineTo(-size, size);
            ctx.quadraticCurveTo(-size / 2, size - 5, 0, size);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(0, -size);
            ctx.quadraticCurveTo(size / 2, -size - 5, size, -size);
            ctx.lineTo(size, size);
            ctx.quadraticCurveTo(size / 2, size - 5, 0, size);
            ctx.fill();
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(-2, -size - 2, 4, size * 2 + 4);
            ctx.fillStyle = '#1e293b';
            for (let k = 0; k < 3; k++) {
                ctx.fillRect(-size + 4, -size / 2 + k * 6, size - 8, 2);
                ctx.fillRect(4, -size / 2 + k * 6, size - 8, 2);
            }

        } else if (b.type === 'pixel_tracker') {
            const size = 8;
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = b.color || '#4ade80';
            ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(0, 0, size / 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = b.color;
            ctx.globalAlpha = 0.5;
            ctx.beginPath(); ctx.arc(-size, 0, size / 2, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1.0;

        } else if (b.type === 'kol_aura') {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = b.color;
            ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 0.8;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.stroke();
            if (Math.random() > 0.5) {
                const r = Math.random() * b.r;
                const a = Math.random() * Math.PI * 2;
                ctx.fillStyle = '#fff';
                ctx.fillRect(Math.cos(a) * r, Math.sin(a) * r, 2, 2);
            }
            ctx.globalAlpha = 1.0;

        } else if (b.type === 'hashtag') {
            ctx.fillStyle = b.color || '#f0abfc';
            ctx.font = 'bold 20px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('#', 0, 0);
        } else if (b.type === 'orbit_hit') {
            // Generic Orbit Visual
            ctx.fillStyle = b.color || '#fff';
            ctx.shadowBlur = 10; ctx.shadowColor = b.color;
            ctx.beginPath();
            const s = 4;
            ctx.moveTo(0, -s * 2); ctx.lineTo(s, -s); ctx.lineTo(s * 2, 0); ctx.lineTo(s, s);
            ctx.lineTo(0, s * 2); ctx.lineTo(-s, s); ctx.lineTo(-s * 2, 0); ctx.lineTo(-s, -s);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (b.type === 'newsletter') {
            const s = 8;
            ctx.fillStyle = b.color || '#10b981';
            ctx.beginPath();
            ctx.moveTo(-s, -s * 0.6); ctx.lineTo(s, -s * 0.6); ctx.lineTo(s, s * 0.6); ctx.lineTo(-s, s * 0.6);
            ctx.fill();
            ctx.strokeStyle = '#064e3b';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-s, -s * 0.6); ctx.lineTo(0, 0); ctx.lineTo(s, -s * 0.6);
            ctx.stroke();
        } else if (b.type === 'content') {
            ctx.fillStyle = b.color || '#facc15';
            const s = 6;
            ctx.beginPath();
            ctx.moveTo(-s * 0.7, -s); ctx.lineTo(s * 0.7, -s); ctx.lineTo(s * 0.7, s); ctx.lineTo(-s * 0.7, s);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.fillRect(-s * 0.4, -s * 0.5, s * 0.8, 1);
            ctx.fillRect(-s * 0.4, -s * 0.1, s * 0.8, 1);
            ctx.fillRect(-s * 0.4, s * 0.3, s * 0.5, 1);
        } else if (b.type === 'spider_minion') {
            const size = 6;
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let k = 0; k < 4; k++) {
                ctx.moveTo(-size, 0); ctx.lineTo(-size - 6, Math.sin(state.frames * 0.8 + k) * 6);
                ctx.moveTo(size, 0); ctx.lineTo(size + 6, Math.sin(state.frames * 0.8 + k + Math.PI) * 6);
            }
            ctx.stroke();
            ctx.fillStyle = '#0f172a';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#67e8f9';
            ctx.shadowBlur = 10; ctx.shadowColor = '#06b6d4';
            ctx.beginPath(); ctx.arc(-2, -2, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(2, -2, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
        } else {
            ctx.beginPath(); ctx.arc(0, 0, b.r || 4, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
    });
}

function drawEnemyBullets() {
    state.enemyBullets.forEach(b => {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = b.color;

        if (b.type === 'enemy_orb') {
            // Dark core, red glow
            ctx.fillStyle = '#7f1d1d';
            ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
    });
}

function drawEnemies() {
    state.enemies.forEach(e => {
        ctx.save();
        ctx.translate(e.x, e.y);
        // Flip if moving left
        if ((e.x - state.player.x) > 0) ctx.scale(-1, 1);

        if (e.flash > 0) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI * 2); ctx.fill();
            e.flash--;
            ctx.restore();
            return;
        }

        // Font based visuals
        ctx.globalAlpha = 1;
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#f00';
        ctx.shadowBlur = 5;
        ctx.fillText(e.visual, 0, 0);
        ctx.shadowBlur = 0;

        // HP Bar
        if (e.hp < e.maxHp) {
            const hpPct = Math.max(0, e.hp / e.maxHp);
            ctx.fillStyle = '#334155';
            ctx.fillRect(-12, -20, 24, 4);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(-12, -20, 24 * hpPct, 4);
        }

        ctx.restore();
    });
}

function drawGems() {
    state.gems.forEach(g => {
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.fillStyle = '#3b82f6';
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, -5); ctx.lineTo(4, 0); ctx.lineTo(0, 5); ctx.lineTo(-4, 0);
        ctx.fill();
        ctx.restore();
    });
}

function drawParticles() {
    state.particles.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        if (p.type === 'text') {
            ctx.fillStyle = '#fff';
            ctx.font = `${p.size}px sans-serif`;
            ctx.fillText(p.char, 0, 0);
        } else {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life / 30; // Fade out
            ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    });
}

function drawFloatingTexts() {
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    state.floatingTexts.forEach(t => {
        ctx.globalAlpha = Math.max(0, t.life);
        ctx.fillStyle = t.color;
        ctx.shadowColor = t.color; ctx.shadowBlur = 5;
        ctx.fillText(t.text, t.x, t.y);
        ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1.0;
}

function drawHUD() {
    // Health Bar (Bottom, above XP)
    const hpPct = Math.max(0, state.player.hp / state.player.maxHp);
    const hpBarY = state.height - 35;

    // Background
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, hpBarY, state.width, 15);

    // Foreground
    ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : '#ef4444';
    ctx.fillRect(0, hpBarY, state.width * hpPct, 15);

    // Text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`HP: ${Math.ceil(state.player.hp)} / ${state.player.maxHp}`, state.width / 2, hpBarY + 11);

    // XP Bar
    const xpPct = state.xp / state.xpNeeded;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, state.width, 20);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(0, 0, state.width * xpPct, 20);

    // Level
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`等級 ${state.level}`, 10, 16);

    // Timer
    const mins = Math.floor(state.seconds / 60);
    const secs = Math.floor(state.seconds % 60).toString().padStart(2, '0');
    ctx.textAlign = 'center';
    ctx.fillText(`${mins}:${secs}`, state.width / 2, 16);

    // Wave Countdown (Red Warning Style)
    if (state.nextWaveTime > 0) {
        const remaining = Math.max(0, state.nextWaveTime - state.seconds);
        const rMins = Math.floor(remaining / 60);
        const rSecs = Math.floor(remaining % 60).toString().padStart(2, '0');

        // Pulsing Effect
        const pulse = Math.abs(Math.sin(state.frames * 0.1));
        const fontSize = 16 + (pulse * 4); // Pulse between 16px and 20px

        ctx.fillStyle = '#ef4444'; // Red Warning Color
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.shadowColor = '#991b1b';
        ctx.shadowBlur = 10;
        ctx.fillText(`⚠️ 下一波: ${rMins}:${rSecs} ⚠️`, state.width / 2, 40); // Moved down slightly
        ctx.shadowBlur = 0;
    } else {
        const pulse = Math.abs(Math.sin(state.frames * 0.1));
        const fontSize = 16 + (pulse * 4);

        ctx.fillStyle = '#ef4444';
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.shadowColor = '#f00';
        ctx.shadowBlur = 15;
        ctx.fillText(`🔥 最後一波 (BOSS) 🔥`, state.width / 2, 40);
        ctx.shadowBlur = 0;
    }

    // Stats
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff'; // Reset color
    ctx.font = '12px monospace';
    // ctx.fillText(`Enemies: ${state.enemies.length}`, state.width - 10, 16);
}

function draw() {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, state.width, state.height);
    drawGrid();

    ctx.save();
    // Centering is tricky with fixed grid.
    // Let's just translate world relative to center.
    // But then grid needs to move.
    // Simplified: No camera follow for now or simple "center on player"
    // Since we handle player pos directly on screen for now, let's keep it steady.
    // Wait, original code had a restore at end of drawEntities.
    // Let's just draw entities at their coords.
    // If we want camera, we need to translate context by (Center - PlayerPos).
    const cx = state.width / 2;
    const cy = state.height / 2;

    // Camera Transform with Zoom
    // 1. Center
    // 2. Scale
    // 3. Move to world pos
    ctx.translate(cx, cy);
    ctx.scale(state.zoom, state.zoom);
    ctx.translate(-state.player.x, -state.player.y);

    drawGems();
    drawBullets();
    drawEnemyBullets();
    drawEnemies();
    drawPlayer();
    drawParticles();
    drawFloatingTexts();

    ctx.restore();

    if (state.screen === 'playing' || state.screen === 'over') {
        drawHUD();
        drawJoystick();
    }
}

function drawJoystick() {
    if (typeof joystick === 'undefined' || !joystick.active) return;

    // Outer Ring
    ctx.beginPath();
    ctx.arc(joystick.originX, joystick.originY, 50, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Inner Thumb
    ctx.beginPath();
    ctx.arc(joystick.x, joystick.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();
}
