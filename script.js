const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');
const pauseToggle = document.getElementById('pauseToggle');
const resetBtn = document.getElementById('resetBtn');
const scoreBoard = document.getElementById('scoreBoard');

// FPS 控制
let lastTime = 0;
const fps = 60; 
const interval = 1000 / fps;

// RWD 與中心點設定
let width, height;
let polygonRadius; 
let centerX, centerY; 

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    
    // --- 關鍵修改：區分手機與電腦 ---
    
    // 判斷邏輯：如果寬度小於高度，代表是「直屏 (手機)」
    if (width < height) {
        // [手機版設定]
        // 半徑小一點，左右留白
        polygonRadius = Math.min(width, height) * 0.32;
        centerX = width / 2;
        // 中心點大幅上移，讓出底部給按鈕
        centerY = (height / 2) - 60; 
    } else {
        // [電腦版設定]
        // 半徑可以大一點，因為電腦螢幕寬
        // 注意：這裡改用 height * 0.35，確保上下不會頂到
        polygonRadius = height * 0.28; 
        centerX = width / 2;
        // 電腦版中心點「不」上移，保持在正中間，或者只微調
        // 這樣就不會撞到上面的文字了
        centerY = height / 2-15; 
    }
    
    if (!isRunning) {
        if(polygon && ball) {
            polygon.updatePoints();
            ctx.clearRect(0, 0, width, height);
            if(polygon) polygon.draw();
            if(ball) ball.draw();
        }
    }
}
window.addEventListener('resize', resize);

// 狀態變數
let isRunning = false;
let animationId;
let ball;
let polygon;

// 遊戲參數
const initialSpeed = 1;    
const speedIncrease = 1.01; 
const maxSpeed = 25;       
const gravity = 0.2;       
const trailLength = 10; 

const defaultColor = '#666'; 
const defaultBallColor = '#4ecdc4';

function getRandomNeonColor() {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 85%, 60%)`;
}

class Polygon {
    constructor(sides) {
        this.sides = sides;
        this.points = [];
        this.rotation = -Math.PI / 2;
        this.color = defaultColor; 
        this.updatePoints();
        this.updateScore();
    }

    updatePoints() {
        this.points = [];
        for (let i = 0; i < this.sides; i++) {
            const angle = this.rotation + (i * 2 * Math.PI / this.sides);
            this.points.push({
                x: centerX + polygonRadius * Math.cos(angle),
                y: centerY + polygonRadius * Math.sin(angle)
            });
        }
    }

    increaseSides() {
        this.sides++;
        this.updatePoints();
        this.updateScore();
    }

    updateScore() {
        if(scoreBoard) {
            scoreBoard.innerText = `${this.sides} SIDES`;
        }
    }

    draw() {
        this.updatePoints();
        
        ctx.beginPath();
        ctx.lineWidth = 5; 
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = this.color;
        
        if (this.points.length > 0) {
            ctx.moveTo(this.points[0].x, this.points[0].y);
            for (let i = 1; i < this.points.length; i++) {
                ctx.lineTo(this.points[i].x, this.points[i].y);
            }
            ctx.closePath();
        }
        
        ctx.stroke();
    }
}

class Ball {
    constructor(x, y) {
        this.reset(x, y);
    }

    reset(x, y) {
        // 重置時也要確保位置是新的中心點
        // 為了避免電腦版球在正中間太無聊，稍微往上一點點掉下來
        this.x = centerX;
        this.y = centerY - 50; 
        
        this.radius = 12;
        this.color = defaultBallColor;
        this.vx = (Math.random() - 0.5) * 8; 
        this.vy = -4; 
        this.trail = []; 
    }

    update() {
        this.vy += gravity;

        this.trail.push({
            x: this.x, 
            y: this.y,
            color: this.color 
        });
        
        if (this.trail.length > trailLength) {
            this.trail.shift();
        }

        const subSteps = 20; 
        
        const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (currentSpeed > maxSpeed) {
            const scale = maxSpeed / currentSpeed;
            this.vx *= scale;
            this.vy *= scale;
        }

        for (let s = 0; s < subSteps; s++) {
            this.x += this.vx / subSteps;
            this.y += this.vy / subSteps;

            let collided = false;
            for (let i = 0; i < polygon.sides; i++) {
                const p1 = polygon.points[i];
                const p2 = polygon.points[(i + 1) % polygon.sides];
                
                if (this.checkWallCollision(p1, p2)) {
                    collided = true;
                }
            }

            if (collided) {
                polygon.increaseSides();
                const newColor = getRandomNeonColor();
                polygon.color = newColor; 
                this.color = newColor;    
                polygon.updateScore();   
                break; 
            }
        }
        
        const distFromCenter = Math.sqrt(Math.pow(this.x - centerX, 2) + Math.pow(this.y - centerY, 2));
        if (distFromCenter > polygonRadius + 100) {
            this.x = centerX;
            this.y = centerY;
            this.vx = 0;
            this.vy = 0;
        }
    }

    checkWallCollision(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        
        const toCenterX = centerX - midX;
        const toCenterY = centerY - midY;
        
        let nx = -dy;
        let ny = dx;
        
        if (nx * toCenterX + ny * toCenterY < 0) {
            nx = dy;
            ny = -dx;
        }
        
        const len = Math.sqrt(nx*nx + ny*ny);
        nx /= len;
        ny /= len;

        const fx = this.x - p1.x;
        const fy = this.y - p1.y;
        const lenSq = dx * dx + dy * dy;
        let param = (fx * dx + fy * dy) / lenSq;
        
        if (param < 0) param = 0;
        else if (param > 1) param = 1;

        const closestX = p1.x + param * dx;
        const closestY = p1.y + param * dy;

        const distX = this.x - closestX;
        const distY = this.y - closestY;
        const distance = Math.sqrt(distX * distX + distY * distY);
        
        if (distance < this.radius) {
            const overlap = this.radius - distance;
            
            this.x += nx * overlap;
            this.y += ny * overlap;

            const dotProduct = this.vx * nx + this.vy * ny;
            
            if (dotProduct < 0) {
               this.vx -= 2 * dotProduct * nx;
               this.vy -= 2 * dotProduct * ny;
               this.vx *= speedIncrease;
               this.vy *= speedIncrease;
               this.vx += (Math.random() - 0.5) * 0.5;
               return true;
            }
        }
        return false;
    }

    draw() {
        for (let i = 0; i < this.trail.length; i++) {
            const point = this.trail[i];
            const ratio = (i + 1) / this.trail.length; 
            ctx.beginPath();
            ctx.arc(point.x, point.y, this.radius * ratio * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = point.color;
            ctx.globalAlpha = ratio * 0.5; 
            ctx.fill();
            ctx.closePath();
        }
        ctx.globalAlpha = 1.0;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color; 
        ctx.fill();
        ctx.shadowBlur = 25; 
        ctx.shadowColor = this.color; 
        ctx.closePath();
        ctx.shadowBlur = 0;
    }
}

function init() {
    resize(); 
    polygon = new Polygon(3);
    ball = new Ball(centerX, centerY - 50); 
    if(scoreBoard) scoreBoard.innerText = "3 SIDES";
}

function loop(timestamp) {
    if (!isRunning) return;
    animationId = requestAnimationFrame(loop);

    const deltaTime = timestamp - lastTime;
    
    if (deltaTime >= interval) {
        lastTime = timestamp - (deltaTime % interval);

        ctx.clearRect(0, 0, width, height);
        
        ball.update();
        polygon.draw();
        ball.draw();
    }
}

pauseToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
        isRunning = true;
        lastTime = performance.now();
        loop(lastTime);
    } else {
        isRunning = false;
        cancelAnimationFrame(animationId);
    }
});

resetBtn.addEventListener('click', () => {
    isRunning = false;
    cancelAnimationFrame(animationId);
    pauseToggle.checked = false; 
    init();
});

init();



