/**
 * Prince of Persia - Chapter 1: The Dungeon
 * A cinematic recreation of the classic level.
 */

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start-btn');
const overlay = document.getElementById('overlay');

// Configuration
const TILE_SIZE = 64;
const GRAVITY = 0.5;
const FRICTION = 0.8;
const JUMP_FORCE = -12;
const SPEED = 5;

// Level Map (0: Empty, 1: Stone, 2: Pillar, 3: Torch, 4: Door, 5: Sword, 6: Guard, 7: Spikes)
const levelMap = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 3, 0, 0, 0, 0, 0, 0, 2, 0, 3, 0, 0, 0, 2, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 0, 7, 0, 2, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 5, 1],
    [1, 0, 3, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 3, 0, 0, 0, 1],
    [1, 4, 0, 0, 6, 0, 0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 60;
        this.vx = 0;
        this.vy = 0;
        this.grounded = false;
        this.direction = 1; // 1: right, -1: left
        this.state = 'idle'; // idle, running, jumping, falling, hanging, dead
        this.frame = 0;
        this.color = '#fffbe6'; // Prince's tunic color
        this.hasSword = false;
        this.isAttacking = false;
        this.health = 3;
    }

    update() {
        if (this.state === 'dead') return;

        // Apply Gravity
        this.vy += GRAVITY;

        // Horizontal Movement (Cinematic Inertia)
        const targetSpeed = (keys['ArrowRight'] || keys['d']) ? SPEED : (keys['ArrowLeft'] || keys['a']) ? -SPEED : 0;

        console.log(`Keys: ArrowLeft=${keys['ArrowLeft']}, ArrowRight=${keys['ArrowRight']}, targetSpeed=${targetSpeed}, vx=${this.vx}, grounded=${this.grounded}`);

        if (targetSpeed !== 0) {
            this.vx += (targetSpeed - this.vx) * 0.4; // Faster acceleration for better responsiveness
            this.direction = targetSpeed > 0 ? 1 : -1;
            if (this.grounded) this.state = 'running';
        } else {
            this.vx *= 0.8; // Slightly less friction for smoother stop
            if (this.grounded && Math.abs(this.vx) < 0.1) {
                this.vx = 0;
                this.state = 'idle';
            }
        }

        console.log(`After update: vx=${this.vx}, x=${this.x}`);

        // Apply Movement & Collision (Separated X and Y)
        this.x += this.vx;
        this.checkCollisions(true); // Horizontal check

        this.y += this.vy;
        this.checkCollisions(false); // Vertical check

        // Jump Input
        if ((keys['ArrowUp'] || keys['w'] || keys[' ']) && this.grounded) {
            this.vy = JUMP_FORCE;
            this.grounded = false;
            this.state = 'jumping';
        }

        // Attack Input
        if (keys['Shift'] && this.hasSword && !this.isAttacking) {
            this.isAttacking = true;
            setTimeout(() => this.isAttacking = false, 300);
        }

        // Ledge Detection (Iconic)
        if (this.state === 'hanging') {
            if (keys['ArrowUp'] || keys['w']) {
                this.y -= TILE_SIZE;
                this.x += this.direction * (TILE_SIZE / 2);
                this.state = 'idle';
            } else if (keys['ArrowDown'] || keys['s']) {
                this.state = 'falling';
            }
        } else if (!this.grounded && this.state === 'falling') {
            this.checkLedges();
        }

        if (!this.grounded && this.state !== 'hanging') {
            this.state = this.vy < 0 ? 'jumping' : 'falling';
        }

        this.checkInteractions();
    }

    checkCollisions(horizontal) {
        const left = Math.floor(this.x / TILE_SIZE);
        const right = Math.floor((this.x + this.width) / TILE_SIZE);
        const top = Math.floor(this.y / TILE_SIZE);
        const bottom = Math.floor((this.y + this.height) / TILE_SIZE);

        if (!horizontal) this.grounded = false;

        for (let r = top; r <= bottom; r++) {
            for (let c = left; c <= right; c++) {
                if (levelMap[r] && levelMap[r][c] === 1) {
                    const tileX = c * TILE_SIZE;
                    const tileY = r * TILE_SIZE;

                    if (horizontal) {
                        // Horizontal Resolve
                        if (this.vx > 0) {
                            this.x = tileX - this.width;
                            this.vx = 0;
                        } else if (this.vx < 0) {
                            this.x = tileX + TILE_SIZE;
                            this.vx = 0;
                        }
                    } else {
                        // Vertical Resolve
                        if (this.vy > 0) {
                            this.y = tileY - this.height;
                            this.vy = 0;
                            this.grounded = true;
                        } else if (this.vy < 0) {
                            this.y = tileY + TILE_SIZE;
                            this.vy = 0;
                        }
                    }
                }
            }
        }
    }

    checkLedges() {
        // Placeholder for ledge hanging mechanic
    }

    checkInteractions() {
        // Check for sword pickup
        const playerCol = Math.floor((this.x + this.width / 2) / TILE_SIZE);
        const playerRow = Math.floor((this.y + this.height / 2) / TILE_SIZE);

        if (levelMap[playerRow] && levelMap[playerRow][playerCol] === 5) {
            this.hasSword = true;
            levelMap[playerRow][playerCol] = 0; // Remove sword from map
        }

        // Check for spike damage
        for (let spike of spikes) {
            if (this.x < spike.x + spike.width &&
                this.x + this.width > spike.x &&
                this.y < spike.y + spike.height &&
                this.y + this.height > spike.y) {
                this.takeDamage();
            }
        }
    }

    takeDamage() {
        if (this.state === 'dead') return;
        this.health--;
        updateUI();
        if (this.health <= 0) {
            this.state = 'dead';
        }
    }

    draw() {
        if (this.state === 'dead') {
            ctx.fillStyle = '#e4002b'; // LEGO Red
            ctx.fillRect(this.x - 10, this.y + this.height - 10, this.width + 20, 10);
            return;
        }

        ctx.save();

        // Minifigure Drawing Logic
        const headSize = 20;
        const torsoWidth = 36;
        const torsoHeight = 25;
        const legWidth = 15;
        const legHeight = 20;

        // Skin color - LEGO Yellow
        const skinColor = '#FDB813';
        const suitColor = '#eee'; // White tunic/suit

        // Legs
        ctx.fillStyle = suitColor;
        ctx.fillRect(this.x + 4, this.y + this.height - legHeight, legWidth, legHeight);
        ctx.fillRect(this.x + this.width - 4 - legWidth, this.y + this.height - legHeight, legWidth, legHeight);

        // Torso (Trapezoid)
        ctx.fillStyle = suitColor;
        ctx.beginPath();
        ctx.moveTo(this.x + 2, this.y + this.height - legHeight);
        ctx.lineTo(this.x + this.width - 2, this.y + this.height - legHeight);
        ctx.lineTo(this.x + this.width - 6, this.y + this.height - legHeight - torsoHeight);
        ctx.lineTo(this.x + 6, this.y + this.height - legHeight - torsoHeight);
        ctx.closePath();
        ctx.fill();

        // Waist
        ctx.fillStyle = '#8b0000'; // Red sash
        ctx.fillRect(this.x + 4, this.y + this.height - legHeight - 4, this.width - 8, 5);

        // Head
        ctx.fillStyle = skinColor;
        const headX = this.x + (this.width - headSize) / 2;
        const headY = this.y + this.height - legHeight - torsoHeight - headSize;
        ctx.beginPath();
        ctx.roundRect(headX, headY, headSize, headSize, 4);
        ctx.fill();

        // Stud on top of head
        ctx.fillRect(headX + 6, headY - 4, 8, 4);

        // Eyes (Small square dots)
        ctx.fillStyle = '#000';
        const eyeOffsetX = this.direction === 1 ? 12 : 4;
        ctx.fillRect(headX + eyeOffsetX, headY + 6, 2, 2);
        if (this.direction === 1) ctx.fillRect(headX + eyeOffsetX - 6, headY + 6, 2, 2);
        else ctx.fillRect(headX + eyeOffsetX + 6, headY + 6, 2, 2);

        // Sword
        if (this.hasSword) {
            ctx.fillStyle = '#bdc3c7'; // Silver LEGO sword
            const swordX = this.direction === 1 ? this.x + this.width + 5 : this.x - 5;
            const swordY = this.y + this.height - legHeight;

            ctx.save();
            ctx.translate(swordX, swordY);
            if (this.isAttacking) {
                ctx.rotate(this.direction * Math.PI / 2);
            }
            // Handle
            ctx.fillStyle = '#333';
            ctx.fillRect(-2, -5, 4, 10);
            // Blade
            ctx.fillStyle = '#bdc3c7';
            ctx.fillRect(-3, -35, 6, 30);
            ctx.restore();
        }

        ctx.restore();
    }
}

class Guard {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 60;
        this.vx = 1;
        this.vy = 0;
        this.direction = 1;
        this.health = 2;
        this.state = 'patrolling';
        this.attackCooldown = 0;
    }

    update() {
        if (this.state === 'dead') return;

        this.x += this.vx * this.direction;

        const nextTileX = this.direction === 1 ? this.x + this.width + 5 : this.x - 5;
        const nextTileY = this.y + this.height + 5;
        const col = Math.floor(nextTileX / TILE_SIZE);
        const row = Math.floor(nextTileY / TILE_SIZE);

        if (!levelMap[row] || levelMap[row][col] !== 1 || levelMap[Math.floor(this.y / TILE_SIZE)][col] === 1) {
            this.direction *= -1;
        }

        this.vy += GRAVITY;
        this.y += this.vy;

        const bottomRow = Math.floor((this.y + this.height) / TILE_SIZE);
        const currentTileCol = Math.floor((this.x + this.width / 2) / TILE_SIZE);
        if (levelMap[bottomRow] && levelMap[bottomRow][currentTileCol] === 1) {
            this.y = bottomRow * TILE_SIZE - this.height;
            this.vy = 0;
        }

        if (this.attackCooldown <= 0 && this.isPlayerNearby(player)) {
            this.attackPlayer(player);
            this.attackCooldown = 60;
        } else {
            this.attackCooldown--;
        }
    }

    isPlayerNearby(player) {
        const distanceX = Math.abs(this.x - player.x);
        const distanceY = Math.abs(this.y - player.y);
        return distanceX < TILE_SIZE * 1.5 && distanceY < TILE_SIZE;
    }

    attackPlayer(player) {
        if (player.state === 'dead') return;
        if (player.isAttacking && player.hasSword &&
            ((player.direction === 1 && player.x + player.width > this.x && player.x < this.x + this.width) ||
                (player.direction === -1 && player.x < this.x + this.width && player.x + player.width > this.x))) {
            this.takeDamage();
        } else {
            player.takeDamage();
        }
    }

    takeDamage() {
        this.health--;
        if (this.health <= 0) {
            this.state = 'dead';
        }
    }

    draw() {
        if (this.state === 'dead') return;

        ctx.save();

        // Guard Minifigure (Red Suit)
        const skinColor = '#FDB813';
        const suitColor = '#e4002b';
        const helmColor = '#444';

        // Legs
        ctx.fillStyle = suitColor;
        ctx.fillRect(this.x + 4, this.y + this.height - 20, 15, 20);
        ctx.fillRect(this.x + this.width - 4 - 15, this.y + this.height - 20, 15, 20);

        // Torso
        ctx.beginPath();
        ctx.moveTo(this.x + 2, this.y + this.height - 20);
        ctx.lineTo(this.x + this.width - 2, this.y + this.height - 20);
        ctx.lineTo(this.x + this.width - 6, this.y + this.height - 45);
        ctx.lineTo(this.x + 6, this.y + this.height - 45);
        ctx.closePath();
        ctx.fill();

        // Head
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.roundRect(this.x + 10, this.y - 5, 20, 20, 4);
        ctx.fill();

        // Helmet
        ctx.fillStyle = helmColor;
        ctx.fillRect(this.x + 8, this.y - 8, 24, 10);
        ctx.fillRect(this.x + 18, this.y - 12, 4, 12); // Stud on top

        // Sword
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(this.x + (this.direction === 1 ? 35 : -5), this.y + 20, 10, 30);

        ctx.restore();
    }
}

class Spike {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = TILE_SIZE;
        this.height = TILE_SIZE / 2;
    }

    draw() {
        ctx.fillStyle = '#7f8c8d'; // Silver/Grey spikes
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(this.x + (i * 16), this.y + this.height);
            ctx.lineTo(this.x + (i * 16) + 8, this.y);
            ctx.lineTo(this.x + (i * 16) + 16, this.y + this.height);
            ctx.fill();
        }
    }
}

const keys = {};
let player = new Player(TILE_SIZE * 2, TILE_SIZE * 5);
let guards = [];
let spikes = [];

function init() {
    window.addEventListener('keydown', (e) => keys[e.key] = true);
    window.addEventListener('keyup', (e) => keys[e.key] = false);

    // Mobile Control Listeners
    const setupMobileBtn = (id, key) => {
        const btn = document.getElementById(id);
        if (!btn) return;

        const startAction = (e) => {
            e.preventDefault();
            keys[key] = true;
            console.log(`Button ${id} pressed, setting ${key} to true`);
        };
        const endAction = (e) => {
            e.preventDefault();
            keys[key] = false;
            console.log(`Button ${id} released, setting ${key} to false`);
        };

        btn.addEventListener('pointerdown', startAction);
        btn.addEventListener('pointerup', endAction);
        btn.addEventListener('pointerleave', endAction);
        btn.addEventListener('pointercancel', endAction);
    };

    setupMobileBtn('btn-left', 'ArrowLeft');
    setupMobileBtn('btn-right', 'ArrowRight');
    setupMobileBtn('btn-down', 'ArrowDown');
    setupMobileBtn('btn-jump', 'ArrowUp');

    // Initialize entities from map
    for (let r = 0; r < levelMap.length; r++) {
        for (let c = 0; c < levelMap[r].length; c++) {
            if (levelMap[r][c] === 6) {
                guards.push(new Guard(c * TILE_SIZE, r * TILE_SIZE));
                levelMap[r][c] = 0; // Clear from map
            } else if (levelMap[r][c] === 7) {
                spikes.push(new Spike(c * TILE_SIZE, r * TILE_SIZE + TILE_SIZE / 2));
            }
        }
    }

    resize();
    window.addEventListener('resize', resize);
    updateUI();

    startBtn.addEventListener('click', () => {
        overlay.classList.add('hidden');
        gameLoop();
    });
}

function updateUI() {
    const healthContainer = document.querySelector('.health-bar');
    healthContainer.innerHTML = '';
    for (let i = 0; i < player.health; i++) {
        const heart = document.createElement('div');
        heart.className = 'heart';
        healthContainer.appendChild(heart);
    }
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function drawLevel() {
    for (let r = 0; r < levelMap.length; r++) {
        for (let c = 0; c < levelMap[r].length; c++) {
            const tile = levelMap[r][c];
            const x = c * TILE_SIZE;
            const y = r * TILE_SIZE;

            if (tile === 1) { // LEGO Wall/Floor
                ctx.fillStyle = '#6d6e71'; // LEGO Dark Grey
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#444';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);

                // Add Studs on top if there's no solid tile above
                if (!levelMap[r - 1] || levelMap[r - 1][c] !== 1) {
                    ctx.fillStyle = '#555';
                    ctx.beginPath();
                    ctx.arc(x + TILE_SIZE / 4, y + 2, 6, 0, Math.PI * 2);
                    ctx.arc(x + TILE_SIZE * 3 / 4, y + 2, 6, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (tile === 2) { // Pillar
                ctx.fillStyle = '#4d4e51';
                ctx.fillRect(x + 10, y, TILE_SIZE - 20, TILE_SIZE);
            } else if (tile === 3) { // LEGO Torch
                ctx.fillStyle = '#333';
                ctx.fillRect(x + TILE_SIZE / 2 - 2, y + 20, 4, 15);

                // LEGO Transparent Orange Piece
                const flicker = Math.random() * 5;
                ctx.fillStyle = 'rgba(255, 100, 0, 0.8)';
                ctx.beginPath();
                ctx.roundRect(x + TILE_SIZE / 2 - 6, y + 10, 12, 12, 2);
                ctx.fill();

                // Glow
                const gradient = ctx.createRadialGradient(
                    x + TILE_SIZE / 2, y + 15, 0,
                    x + TILE_SIZE / 2, y + 15, 15 + flicker
                );
                gradient.addColorStop(0, 'rgba(255, 165, 0, 0.4)');
                gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x + TILE_SIZE / 2, y + 15, 12 + flicker, 0, Math.PI * 2);
                ctx.fill();
            } else if (tile === 4) { // Door
                ctx.fillStyle = '#222';
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#e4002b'; // Red door frame
                ctx.lineWidth = 4;
                ctx.strokeRect(x + 5, y + 5, TILE_SIZE - 10, TILE_SIZE - 5);
            } else if (tile === 5) { // Sword (LEGO Piece)
                ctx.fillStyle = '#bdc3c7';
                ctx.fillRect(x + TILE_SIZE / 2 - 2, y + TILE_SIZE - 40, 4, 30);
                ctx.fillStyle = '#333';
                ctx.fillRect(x + TILE_SIZE / 2 - 6, y + TILE_SIZE - 15, 12, 4);
            }
        }
    }
}

function gameLoop() {
    // Clear canvas
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Camera follow (simple)
    ctx.save();
    // Centering player
    const camX = Math.round(-player.x + canvas.width / 2);
    const camY = Math.round(-player.y + canvas.height / 2);
    ctx.translate(camX, camY);

    drawLevel();

    spikes.forEach(s => s.draw());
    guards.forEach(g => {
        g.update();
        g.draw();
    });

    player.update();
    player.draw();

    ctx.restore();

    requestAnimationFrame(gameLoop);
}

init();
