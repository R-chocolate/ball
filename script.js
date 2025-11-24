const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');
const pauseToggle = document.getElementById('pauseToggle');
const resetBtn = document.getElementById('resetBtn');
const scoreBoard = document.getElementById('scoreBoard');

// RWD 設定
let width, height;
let polygonRadius; 

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    
    // 動態計算半徑
    polygonRadius = Math.min(width, height) * 0.30;
    
    if (!isRunning) {
        if(polygon && ball) {
            polygon.updatePoints();
            // 這裡畫一次就好
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
const initialSpeed = 3; 
const speedIncrease = 1.02; 
const maxSpeed = 35; 
const gravity = 0.3;  
const trailLength = 10; // [新增] 尾巴的長度 (存幾個點)

// 預設顏色
const defaultColor = '#666'; 
const defaultBallColor = '#4ecdc4';

// 產生隨機霓虹色
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
        const centerX = width / 2;
        const centerY = height / 2;
        
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
        this.x = x;
        this.y = y;
        this.radius = 12;
        this.color = defaultBallColor;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = -5; 
        
        // [新增] 用來存尾巴軌跡的陣列
        this.trail = []; 
    }

    update() {
        this.vy += gravity;

        // --- 紀錄軌跡 ---
        // 每次移動前，把當前的位置和顏色存起來
        this.trail.push({
            x: this.x, 
            y: this.y,
            color: this.color // 紀錄當下的顏色，這樣尾巴會有漸層變色效果
        });
        
        // 如果尾巴太長，就把最舊的刪掉
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
        
        const distFromCenter = Math.sqrt(Math.pow(this.x - width/2, 2) + Math.pow(this.y - height/2, 2));
        if (distFromCenter > polygonRadius + 100) {
            this.x = width/2;
            this.y = height/2;
            this.vx = 0;
            this.vy = 0;
        }
    }

    checkWallCollision(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const toCenterX = (width/2) - midX;
        const toCenterY = (height/2) - midY;
        
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
        // --- 先畫尾巴 ---
        for (let i = 0; i < this.trail.length; i++) {
            const point = this.trail[i];
            // 計算比例：越新的點越大、越不透明
            const ratio = (i + 1) / this.trail.length; 
            
            ctx.beginPath();
            // 尾巴的圓圈稍微小一點，製造彗星感
            ctx.arc(point.x, point.y, this.radius * ratio * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = point.color;
            // 設定透明度
            ctx.globalAlpha = ratio * 0.5; 
            ctx.fill();
            ctx.closePath();
        }
        // 畫完尾巴記得把透明度設回來，不然多邊形會變透明
        ctx.globalAlpha = 1.0;


        // --- 再畫球本體 ---
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
    ball = new Ball(width/2, height/2 - 50); 
    
    if(scoreBoard) {
        scoreBoard.innerText = "3 SIDES";
    }
}

function loop() {
    if (!isRunning) return;

    // [重要修改] 這裡改成完全清除！
    // 因為球現在自己會畫尾巴了，所以背景不需要保留殘影，這樣多邊形就會超級乾淨
    ctx.clearRect(0, 0, width, height);
    
    ball.update();
    polygon.draw();
    ball.draw();

    animationId = requestAnimationFrame(loop);
}

// 事件監聽
pauseToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
        isRunning = true;
        loop();
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
    // 這裡不需要再呼叫 drawStatic，因為 init 裡面 resize 已經會做了
});

// 啟動
init();


