const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let ants = [];
let foods = [];
let enemies = [];
let bugs = []; // Array to store bugs
const numAnts = 10;
const numFoods = 5;
const dotRadiusMin = 3;
const dotRadiusMax = 6;
const mouseRepulsionRadius = 50;
const foodRadius = 10;
const homeRadius = 50;
const friction = 0.98;
const antVisionRadius = 150; // Only detect food within 150px
const enemySpawnInterval = 10000; // Spawn an enemy every 10 seconds
const bugSpawnThreshold = 200; // Number of ants required to spawn bugs
const bugFoodMass = 500; // Mass of food pile created by dead bugs
let teamCounts = { red: 0, green: 0, blue: 0, yellow: 0 }; // Track number of ants per team
let score = { red: 0, green: 0, blue: 0, yellow: 0 }; // Track score for each team
let foodPieces = []; // To store food pieces around the home
let showScore = false;
let antCooldown = 5; // Cooldown timer for creating new ants
const foodColor = 'brown';

let offsetX = 0;
let offsetY = 0;
let scale = 1;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

// Set canvas width and height to full screen
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Create a random home location
let home = createRandomHome();

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    foods = createFoods();
    home = createRandomHome();
});

//if the mouse is clicked, toggle the score board
canvas.addEventListener('click', () => {
    showScore = !showScore;
});

canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});

canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        offsetX += dx;
        offsetY += dy;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = 0.1;
    const zoom = e.deltaY < 0 ? 1 + zoomFactor : 1 - zoomFactor;
    scale *= zoom;
    offsetX = e.clientX - (e.clientX - offsetX) * zoom;
    offsetY = e.clientY - (e.clientY - offsetY) * zoom;
});

function createRandomHome() {
    return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height
    };
}

class Ant {
    constructor(x, y, isBaby = false) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.radius = isBaby ? dotRadiusMin : Math.random() * (dotRadiusMax - dotRadiusMin) + dotRadiusMin;
        this.team = isBaby ? null : this.assignTeam();
        this.color = isBaby ? 'white' : this.assignColor();
        this.hasFood = false;
        this.workingTime = 0; // Time spent working on food
        this.targetFood = null; // Target food location
        this.lastFoodLocation = null; // Remember last food location
        this.isBaby = isBaby;
        this.foodEaten = 0; // Track food eaten by baby ant
        this.eatingTime = 0; // Time spent eating food
        this.health = 100; // Health of the ant
        this.timeWithoutFood = 0; // Time spent without finding food
        if (!isBaby) {
            teamCounts[this.team]++; // Increment team count
        }
    }

    assignTeam() {
        const colors = ['red', 'green', 'blue', 'yellow'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    assignColor() {
        // Assign a random color based on team with slight variations
        const baseColors = {
            red: { r: 255, g: 0, b: 0 },
            green: { r: 0, g: 255, b: 0 },
            blue: { r: 0, g: 0, b: 255 },
            yellow: { r: 255, g: 255, b: 0 }
        };
        const baseColor = baseColors[this.team];
        const variation = () => Math.floor(Math.random() * 100) - 50; // Random variation between -50 and 50
        const r = Math.min(255, Math.max(0, baseColor.r + variation()));
        const g = Math.min(255, Math.max(0, baseColor.g + variation()));
        const b = Math.min(255, Math.max(0, baseColor.b + variation()));
        return `rgb(${r},${g},${b})`;
    }

    update() {
        if (this.health <= 0) {
            // Remove dead ant
            ants = ants.filter(dot => dot !== this);
            if (this.team) {
                teamCounts[this.team]--; // Decrement team count
            }
            return;
        }

        if (this.isBaby) {
            // Baby ant stays at home and eats food
            if (foodPieces.length > 0) {
                this.eatingTime++;
                if (this.eatingTime > 100) { // Increase time required to eat each piece of food
                    foodPieces.pop(); // Eat one food piece
                    this.foodEaten++;
                    this.eatingTime = 0; // Reset eating time
                    if (this.foodEaten >= 5) {
                        this.isBaby = false; // Become a normal ant
                        this.team = this.assignTeam();
                        this.color = this.assignColor();
                        this.radius = Math.random() * (dotRadiusMax - dotRadiusMin) + dotRadiusMin;
                        teamCounts[this.team]++; // Increment team count
                    }
                }
            }
        } else if (this.hasFood) {
            // Move toward home when carrying food.
            const dxHome = home.x - this.x;
            const dyHome = home.y - this.y;
            const angleHome = Math.atan2(dyHome, dxHome);
            this.vx += Math.cos(angleHome) * 0.05;
            this.vy += Math.sin(angleHome) * 0.05;
        } else {
            // Return to last food location if remembered
            if (this.lastFoodLocation) {
                const dxFood = this.lastFoodLocation.x - this.x;
                const dyFood = this.lastFoodLocation.y - this.y;
                const distanceFood = Math.sqrt(dxFood * dxFood + dyFood * dyFood);
                const angleFood = Math.atan2(dyFood, dxFood);
                this.vx += Math.cos(angleFood) * 0.05;
                this.vy += Math.sin(angleFood) * 0.05;

                // Check if reached the last food location
                if (distanceFood < foodRadius) {
                    this.lastFoodLocation = null; // Clear last food location
                }
            } else {
                // Search for food only if within vision radius.
                const targetFood = this.findClosestFood();
                if (targetFood) {
                    const dxFood = targetFood.x - this.x;
                    const dyFood = targetFood.y - this.y;
                    const angleFood = Math.atan2(dyFood, dxFood);
                    this.vx += Math.cos(angleFood) * 0.05;
                    this.vy += Math.sin(angleFood) * 0.05;
                    
                    // Work on the food if close enough.
                    const distanceFood = Math.sqrt(dxFood * dxFood + dyFood * dyFood);
                    if (distanceFood < foodRadius) {
                        this.workingTime++;
                        if (this.workingTime > 100) { // Threshold for working time
                            this.hasFood = true;
                            this.workingTime = 0;
                            targetFood.mass -= 10; // Reduce food mass
                            if (targetFood.mass <= 0) {
                                foods = foods.filter(f => f !== targetFood); // Remove the food if mass is zero
                                foods.push(createFood()); // Add a new food
                            }
                            this.notifyOthers(targetFood); // Notify other ants of the food location
                            this.lastFoodLocation = { x: targetFood.x, y: targetFood.y }; // Remember last food location
                        }
                    }
                } else {
                    // No food in vision; wander randomly.
                    this.vx += (Math.random() - 0.5) * 0.5;
                    this.vy += (Math.random() - 0.5) * 0.5;
                    this.timeWithoutFood++;
                    if (this.timeWithoutFood > 500) { // Threshold for time without food
                        this.returnHome();
                    }
                }
            }
        }
        
        // Apply friction, update position.
        this.vx *= friction;
        this.vy *= friction;
        this.x += this.vx;
        this.y += this.vy;
        if (this.isBaby) {
            // Keep baby ants within the home radius
            const dxHome = home.x - this.x;
            const dyHome = home.y - this.y;
            const distanceHome = Math.sqrt(dxHome * dxHome + dyHome * dyHome);
            if (distanceHome > homeRadius) {
                const angleHome = Math.atan2(dyHome, dxHome);
                this.x = home.x + Math.cos(angleHome) * homeRadius;
                this.y = home.y + Math.sin(angleHome) * homeRadius;
            }
        }
        
        // Drop off food at home.
        if (this.hasFood) {
            const dxHome = home.x - this.x;
            const dyHome = home.y - this.y;
            const distanceHome = Math.sqrt(dxHome * dxHome + dyHome * dyHome);
            if (distanceHome < homeRadius) {
                this.hasFood = false;
                // Add food piece at a random spot inside the home circle
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * homeRadius;
                const foodX = home.x + radius * Math.cos(angle);
                const foodY = home.y + radius * Math.sin(angle);
                foodPieces.push({ x: foodX, y: foodY, color: foodColor });
                // Check if food pieces reached 5
                if (foodPieces.length >= 5 && antCooldown <= 0 || foodPieces.length >= 50) {  
                    foodPieces = foodPieces.slice(5); // Remove the first 5 food pieces
                    createNewAnt(); // Create a new baby ant
                    antCooldown = 5; // Reset cooldown timer
                }
            }
        }

        // Attack enemies
        if (!this.isBaby) {
            enemies.forEach(enemy => {
                const dxEnemy = enemy.x - this.x;
                const dyEnemy = enemy.y - this.y;
                const distanceEnemy = Math.sqrt(dxEnemy * dxEnemy + dyEnemy * dyEnemy);
                if (distanceEnemy < antVisionRadius) {
                    const angleEnemy = Math.atan2(dyEnemy, dxEnemy);
                    this.vx += Math.cos(angleEnemy) * 0.1;
                    this.vy += Math.sin(angleEnemy) * 0.1;
                    if (distanceEnemy < this.radius + enemy.radius) {
                        enemy.health -= 1; // Attack enemy
                        this.health -= 1; // Get hurt by enemy
                    }
                }
            });

            // Attack bugs
            bugs.forEach(bug => {
                const dxBug = bug.x - this.x;
                const dyBug = bug.y - this.y;
                const distanceBug = Math.sqrt(dxBug * dxBug + dyBug * dyBug);
                if (distanceBug < antVisionRadius) {
                    const angleBug = Math.atan2(dyBug, dxBug);
                    this.vx += Math.cos(angleBug) * 0.1;
                    this.vy += Math.sin(angleBug) * 0.1;
                    if (distanceBug < this.radius + bug.radius) {
                        bug.health -= 1; // Attack bug
                        this.health -= 1; // Get hurt by bug
                    }
                }
            });
        }
    }

    returnHome() {
        const dxHome = home.x - this.x;
        const dyHome = home.y - this.y;
        const angleHome = Math.atan2(dyHome, dxHome);
        this.vx += Math.cos(angleHome) * 0.05;
        this.vy += Math.sin(angleHome) * 0.05;
        const distanceHome = Math.sqrt(dxHome * dxHome + dyHome * dyHome);
        if (distanceHome < homeRadius) {
            this.timeWithoutFood = 0; // Reset time without food
            const nearestFood = this.findClosestFood();
            if (nearestFood) {
                this.lastFoodLocation = { x: nearestFood.x, y: nearestFood.y }; // Get location of nearest discovered food
            } else {
                // Random chance to find one of the foods on the map
                if (Math.random() < 0.5 && foods.length > 0) { // 50% chance
                    const randomFood = foods[Math.floor(Math.random() * foods.length)];
                    this.lastFoodLocation = { x: randomFood.x, y: randomFood.y };
                }
            }
        }
    }

    findClosestFood() {
        let closestFood = null;
        let minDistance = Infinity;
        foods.forEach(food => {
            const dx = food.x - this.x;
            const dy = food.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < antVisionRadius && distance < minDistance) {
                minDistance = distance;
                closestFood = food;
            }
        });
        return closestFood;
    }

    notifyOthers(food) {
        ants.forEach(dot => {
            const dx = dot.x - this.x;
            const dy = dot.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < antVisionRadius && !dot.hasFood) {
                dot.targetFood = food; // Notify other ants of the food location
            }
        });
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.radius = dotRadiusMax;
        this.color = 'purple';
        this.health = 1500; // Health of the enemy
    }

    update() {
        if (this.health <= 0) {
            // Remove dead enemy
            enemies = enemies.filter(enemy => enemy !== this);
            return;
        }

        // Move randomly
        this.vx += (Math.random() - 0.5) * 0.5;
        this.vy += (Math.random() - 0.5) * 0.5;

        // Apply friction, update position.
        this.vx *= friction;
        this.vy *= friction;
        this.x += this.vx;
        this.y += this.vy;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

class Bug {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.radius = dotRadiusMax * 2;
        this.color = 'black';
        this.health = 3000; // Health of the bug
    }

    update() {
        if (this.health <= 0) {
            // Remove dead bug and create a big food pile
            bugs = bugs.filter(bug => bug !== this);
            foods.push({ x: this.x, y: this.y, mass: bugFoodMass });
            return;
        }

        // Move randomly
        this.vx += (Math.random() - 0.5) * 0.5;
        this.vy += (Math.random() - 0.5) * 0.5;

        // Apply friction, update position.
        this.vx *= friction;
        this.vy *= friction;
        this.x += this.vx;
        this.y += this.vy;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

function createAnts() {
    for (let i = 0; i < numAnts; i++) {
        let x = Math.random() * canvas.width;
        let y = Math.random() * canvas.height;
        ants.push(new Ant(x, y));
    }
}

function createNewAnt() {
    let x = home.x; // Create the new baby ant at the home location
    let y = home.y; // Create the new baby ant at the home location
    ants.push(new Ant(x, y, true)); // Create a new baby ant
    for (let i = 0; i < 5 && foodPieces.length > 0; i++) {
        foodPieces.pop(); // Remove one of the food pieces
    }
}

function createFood() {
    return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        mass: 100 // Initial mass of the food
    };
}

function createFoods() {
    let foods = [];
    for (let i = 0; i < numFoods; i++) {
        foods.push(createFood());
    }
    return foods;
}

function createEnemy() {
    let x = Math.random() * canvas.width;
    let y = Math.random() * canvas.height;
    //only spawn enemies if there are more than 50% Ants
    if (ants.length > (enemies.length + 1) * 50)
        enemies.push(new Enemy(x, y));
}

function createBug() {
    let x = Math.random() * canvas.width;
    let y = Math.random() * canvas.height;
    bugs.push(new Bug(x, y));
}

function drawFoods() {
    foods.forEach(food => {
        ctx.beginPath();
        const radius = foodRadius * (food.mass / 100); // Scale radius based on mass
        ctx.arc(food.x, food.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = foodColor; // Change food color to brown
        ctx.fill();
        ctx.closePath();
    });
}

function drawHome() {
    ctx.beginPath();
    ctx.arc(home.x, home.y, homeRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'gray';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.closePath();
}

function drawFoodPieces() {
    foodPieces.forEach(piece => {
        ctx.beginPath();
        ctx.arc(piece.x, piece.y, 2, 0, Math.PI * 2); // Draw small food piece
        ctx.fillStyle = piece.color;
        ctx.fill();
        ctx.closePath();
    });
}

function drawScore() {
    if (!showScore) return;
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    let y = 30;
    for (let team in teamCounts) {
        ctx.fillText(`Team ${team}: ${teamCounts[team]} ants`, 20, y);
        y += 30;
    }
}

function drawAntCooldown() {
    if (!showScore) return;
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText(`Ant Cooldown: ${Math.max(0, antCooldown).toFixed(1)}s`, 20, 60 + Object.keys(teamCounts).length * 30);
}

function drawBugs() {
    bugs.forEach(bug => {
        bug.update();
        bug.draw();
    });
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    drawFoods();
    drawHome();
    drawFoodPieces();
    drawScore();
    drawAntCooldown();
    
    ants.forEach(dot => {
        dot.update();
        dot.draw();
    });

    enemies.forEach(enemy => {
        enemy.update();
        enemy.draw();
    });

    drawBugs();

    ctx.restore();
    requestAnimationFrame(animate);
}

createAnts();
foods = createFoods();
animate();
setInterval(createEnemy, enemySpawnInterval); // Spawn an enemy every 10 seconds

setInterval(() => {
    if (antCooldown > 0) {
        antCooldown -= 1;
    }
    if (ants.length > bugSpawnThreshold && bugs.length === 0) {
        createBug(); // Spawn a bug if the number of ants exceeds the threshold
    }
}, 1000);
