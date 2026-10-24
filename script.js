
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const livesElement = document.getElementById("lives");
const bestElement = document.getElementById("best");
const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const controls = document.querySelector(".controls");

let player;
let bullets = [];
let enemies = [];
let particles = [];
let score = 0;
let lives = 5;
let best = Number(localStorage.getItem("spaceBest")) || 0;

let running = false;
let paused = false;
let gameOver = false;

let lastTime = 0;
let spawnTimer = 0;
let shootTimer = 0;
let animationId = null;

const keys = {};
const touch = { left: false, right: false, shoot: false };

const stars = Array.from({ length: 100 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  size: Math.random() * 2 + 0.5,
  speed: Math.random() * 25 + 10
}));

function resetPlayer() {
  player = {
    x: canvas.width / 2 - 18,
    y: canvas.height - 65,
    width: 36,
    height: 38,
    speed: 300
  };
}

function updateHUD() {
  scoreElement.textContent = score;
  livesElement.textContent = lives;
  bestElement.textContent = best;
}

function drawBackground(dt = 0) {
  ctx.fillStyle = "#050916";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const star of stars) {
    if (running && !paused) {
      star.y += star.speed * dt;

      if (star.y > canvas.height) {
        star.y = 0;
        star.x = Math.random() * canvas.width;
      }
    }

    ctx.fillStyle = "#b8d8ff";
    ctx.globalAlpha = 0.4 + star.size / 4;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }

  ctx.globalAlpha = 1;
}

function drawPlayer() {
  if (!player) return;

  ctx.save();
  ctx.translate(player.x + player.width / 2, player.y);

  // Ship body
  ctx.fillStyle = "#55f5ff";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-player.width / 2, player.height);
  ctx.lineTo(-8, player.height - 8);
  ctx.lineTo(0, player.height - 2);
  ctx.lineTo(8, player.height - 8);
  ctx.lineTo(player.width / 2, player.height);
  ctx.closePath();
  ctx.fill();

  // Cockpit
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(0, 18, 5, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Engine flame
  if (running && !paused) {
    ctx.fillStyle = "#ff9d42";
    ctx.beginPath();
    ctx.moveTo(-6, player.height - 2);
    ctx.lineTo(0, player.height + 12 + Math.random() * 6);
    ctx.lineTo(6, player.height - 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawEnemies() {
  for (const enemy of enemies) {
    ctx.save();
    ctx.translate(enemy.x + enemy.width / 2, enemy.y);

    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    ctx.moveTo(-enemy.width / 2, 0);
    ctx.lineTo(enemy.width / 2, 0);
    ctx.lineTo(enemy.width / 2 + 5, enemy.height * 0.6);
    ctx.lineTo(enemy.width / 2 - 4, enemy.height);
    ctx.lineTo(-enemy.width / 2 + 4, enemy.height);
    ctx.lineTo(-enemy.width / 2 - 5, enemy.height * 0.6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-8, 9, 5, 5);
    ctx.fillRect(3, 9, 5, 5);

    ctx.restore();
  }
}

function drawBullets() {
  for (const bullet of bullets) {
    ctx.fillStyle = "#55f5ff";
    ctx.shadowColor = "#55f5ff";
    ctx.shadowBlur = 10;
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  }

  ctx.shadowBlur = 0;
}

function drawParticles() {
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / 0.4);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, 4, 4);
  }

  ctx.globalAlpha = 1;
}

function createExplosion(x, y, color) {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 180,
      vy: (Math.random() - 0.5) * 180,
      life: 0.4,
      color
    });
  }
}

function spawnEnemy() {
  const size = 30 + Math.random() * 10;

  enemies.push({
    x: Math.random() * (canvas.width - size),
    y: -size,
    width: size,
    height: size,
    speed: 55 + Math.random() * 25,
    color: Math.random() > 0.5 ? "#ff416c" : "#b36bff"
  });
}

function shoot() {
  if (shootTimer > 0 || !player) return;

  bullets.push({
    x: player.x + player.width / 2 - 3,
    y: player.y - 12,
    width: 6,
    height: 16,
    speed: 450
  });

  shootTimer = 0.22;
}

function collides(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function endGame() {
  running = false;
  paused = false;
  gameOver = true;

  if (score > best) {
    best = score;
    localStorage.setItem("spaceBest", best);
  }

  updateHUD();

  document.getElementById("finalScore").textContent = score;
  gameOverScreen.classList.remove("hidden");
  startScreen.classList.add("hidden");
  controls.style.display = "none";

  document.getElementById("pauseBtn").textContent = "⏸ Pause";
}

function update(dt) {
  if (!running || paused || gameOver) return;

  // Player movement
  if (keys["ArrowLeft"] || keys["a"] || touch.left) {
    player.x -= player.speed * dt;
  }

  if (keys["ArrowRight"] || keys["d"] || touch.right) {
    player.x += player.speed * dt;
  }

  player.x = Math.max(
    0,
    Math.min(canvas.width - player.width, player.x)
  );

  // Shooting
  shootTimer = Math.max(0, shootTimer - dt);

  if (keys[" "] || touch.shoot) {
    shoot();
  }

  // Spawn enemies
  spawnTimer += dt;
  const spawnRate = 2.0;

  if (spawnTimer >= spawnRate) {
    spawnEnemy();
    spawnTimer = 0;
  }

  // Move bullets
  for (const bullet of bullets) {
    bullet.y -= bullet.speed * dt;
  }

  bullets = bullets.filter(bullet => bullet.y + bullet.height > 0);

  // Move enemies
  for (const enemy of enemies) {
    enemy.y += enemy.speed * dt;
  }

  // Move explosion particles
  for (const particle of particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
  }

  particles = particles.filter(particle => particle.life > 0);

  // Bullet-enemy collisions
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];

    for (let j = bullets.length - 1; j >= 0; j--) {
      if (collides(bullets[j], enemy)) {
        createExplosion(
          enemy.x + enemy.width / 2,
          enemy.y + enemy.height / 2,
          enemy.color
        );

        enemies.splice(i, 1);
        bullets.splice(j, 1);
        score += 10;
        updateHUD();
        break;
      }
    }
  }

  // Enemy-player collisions and enemies that pass the player
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];

    if (collides(player, enemy)) {
      createExplosion(
        enemy.x + enemy.width / 2,
        enemy.y + enemy.height / 2,
        "#ff416c"
      );

      enemies.splice(i, 1);
      lives--;
      updateHUD();
    } else if (enemy.y > canvas.height) {
      enemies.splice(i, 1);
      lives--;
      updateHUD();
    }

    if (lives <= 0) {
      lives = 0;
      endGame();
      return;
    }
  }
}

function draw(dt = 0) {
  drawBackground(dt);
  drawBullets();
  drawEnemies();
  drawPlayer();
  drawParticles();

  if (paused && running) {
    ctx.fillStyle = "#050916bb";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#55f5ff";
    ctx.font = "bold 38px Arial";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2);
  }
}

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0, 0.05);
  lastTime = timestamp;

  update(dt);
  draw(dt);

  animationId = requestAnimationFrame(gameLoop);
}

function startGame() {
  score = 0;
  lives = 3;
  bullets = [];
  enemies = [];
  particles = [];
  spawnTimer = 0;
  shootTimer = 0;
  paused = false;
  gameOver = false;
  running = true;

  resetPlayer();
  updateHUD();

  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  controls.style.display = "flex";

  document.getElementById("pauseBtn").textContent = "⏸ Pause";
}

function togglePause() {
  if (!running || gameOver) return;

  paused = !paused;

  document.getElementById("pauseBtn").textContent =
    paused ? "▶ Resume" : "⏸ Pause";
}

function drawInitialScreen() {
  resetPlayer();
  updateHUD();
  draw(0);
}

// Keyboard controls
document.addEventListener("keydown", event => {
  const key = event.key.length === 1
    ? event.key.toLowerCase()
    : event.key;

  if (
    ["ArrowLeft", "ArrowRight", " "].includes(event.key)
  ) {
    event.preventDefault();
  }

  keys[key] = true;

  if (event.key.toLowerCase() === "p") {
    togglePause();
  }
});

document.addEventListener("keyup", event => {
  const key = event.key.length === 1
    ? event.key.toLowerCase()
    : event.key;

  keys[key] = false;
});

// Main buttons
document.getElementById("beginBtn").addEventListener("click", startGame);
document.getElementById("startBtn").addEventListener("click", () => {
  if (!running || gameOver) startGame();
});
document.getElementById("pauseBtn").addEventListener("click", togglePause);
document.getElementById("restartBtn").addEventListener("click", startGame);
document.getElementById("playAgainBtn").addEventListener("click", startGame);

// Mobile buttons: hold to move or shoot
function setupHoldButton(id, action) {
  const button = document.getElementById(id);

  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    touch[action] = true;
  });

  for (const eventName of ["pointerup", "pointercancel", "pointerleave"]) {
    button.addEventListener(eventName, () => {
      touch[action] = false;
    });
  }
}

setupHoldButton("leftBtn", "left");
setupHoldButton("rightBtn", "right");
setupHoldButton("shootBtn", "shoot");

// Clear held keys if the browser window loses focus
window.addEventListener("blur", () => {
  for (const key in keys) keys[key] = false;
  touch.left = false;
  touch.right = false;
  touch.shoot = false;
});

// Initialize and keep the animation running
drawInitialScreen();
animationId = requestAnimationFrame(gameLoop);
