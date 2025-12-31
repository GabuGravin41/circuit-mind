
import { SchematicNode } from '../types';
import { getComponentDef } from './componentLibrary';

const GRID_SIZE = 10; 

interface Point { x: number; y: number; }
interface DirectedPoint extends Point { dir?: string; }

// --- Helpers ---

// Quantize a world pixel coordinate to the nearest grid integer
const toGrid = (val: number) => Math.round(val / GRID_SIZE);

// Convert grid integer back to world pixels
const fromGrid = (val: number) => val * GRID_SIZE;

// Get vector for direction
const getDirectionVector = (dir: string) => {
    switch (dir?.toLowerCase()) {
        case 'left': return { x: -1, y: 0 };
        case 'right': return { x: 1, y: 0 };
        case 'top': return { x: 0, y: -1 };
        case 'bottom': return { x: 0, y: 1 };
        default: return { x: 0, y: 0 };
    }
};

// --- A* Manhattan Router ---

export const calculateRoute = (
    start: DirectedPoint, 
    end: DirectedPoint, 
    nodes: SchematicNode[]
): string => {
    
    // 1. Setup Grid Coordinates
    const startGrid = { x: toGrid(start.x), y: toGrid(start.y) };
    const endGrid = { x: toGrid(end.x), y: toGrid(end.y) };

    // 2. Define "Escape" Points
    // Wires must exit the pin straight for a bit before turning.
    const ESCAPE_DISTANCE = 2; // 2 Grid units (20px)
    
    const startDir = getDirectionVector(start.dir || '');
    const p1 = { 
        x: startGrid.x + (startDir.x * ESCAPE_DISTANCE), 
        y: startGrid.y + (startDir.y * ESCAPE_DISTANCE) 
    };

    // If target has a direction (is a pin), it also needs an entry escape
    const endDir = getDirectionVector(end.dir || '');
    // If end.dir is empty (mouse cursor), we don't project out, we just route to the cursor grid
    const p2 = end.dir ? { 
        x: endGrid.x + (endDir.x * ESCAPE_DISTANCE), 
        y: endGrid.y + (endDir.y * ESCAPE_DISTANCE) 
    } : endGrid;

    // 3. Generate Obstacle Map (Grid Based)
    // We store obstacles as a Set of "x,y" strings
    const obstacles = new Set<string>();
    
    nodes.forEach(node => {
        const def = getComponentDef(node.type);
        const gx = toGrid(node.x);
        const gy = toGrid(node.y);
        // Bounding box in grid units
        // We add a small buffer so wires don't skim the exact edge of a component body visually
        const halfW = Math.ceil((def.width / GRID_SIZE) / 2);
        const halfH = Math.ceil((def.height / GRID_SIZE) / 2);

        for (let x = gx - halfW; x <= gx + halfW; x++) {
            for (let y = gy - halfH; y <= gy + halfH; y++) {
                obstacles.add(`${x},${y}`);
            }
        }
    });

    // Remove start/end points from obstacles so we don't get stuck immediately
    // Also remove the "Escape" paths from obstacles so we can actually leave the pin
    const clearPath = (pt: Point, dir: {x:number, y:number}, dist: number) => {
        for(let i=0; i<=dist; i++) {
            obstacles.delete(`${pt.x + dir.x*i},${pt.y + dir.y*i}`);
        }
    };
    clearPath(startGrid, startDir, ESCAPE_DISTANCE);
    if (end.dir) clearPath(endGrid, endDir, ESCAPE_DISTANCE);
    
    obstacles.delete(`${startGrid.x},${startGrid.y}`);
    obstacles.delete(`${endGrid.x},${endGrid.y}`);
    obstacles.delete(`${p1.x},${p1.y}`);
    obstacles.delete(`${p2.x},${p2.y}`);

    // 4. A* Algorithm
    const queue: { pos: Point; cost: number; cameFrom: Point | null; dir: Point | null }[] = [];
    const visited = new Map<string, number>(); // Stores lowest cost to reach coordinate

    // Initialize
    queue.push({ pos: p1, cost: 0, cameFrom: null, dir: startDir });
    visited.set(`${p1.x},${p1.y}`, 0);

    let finalNode = null;
    let closestNode = null;
    let minDist = Infinity;
    
    // Safety break
    let loops = 0;
    const MAX_LOOPS = 2000;

    while (queue.length > 0 && loops < MAX_LOOPS) {
        loops++;
        // Sort by cost (lowest first) - rudimentary priority queue
        queue.sort((a, b) => a.cost - b.cost);
        const current = queue.shift()!;

        // Check success
        if (current.pos.x === p2.x && current.pos.y === p2.y) {
            finalNode = current;
            break;
        }

        // Track closest in case we fail
        const distToTgt = Math.abs(current.pos.x - p2.x) + Math.abs(current.pos.y - p2.y);
        if (distToTgt < minDist) {
            minDist = distToTgt;
            closestNode = current;
        }

        // Explore neighbors (Up, Down, Left, Right)
        const dirs = [
            { x: 0, y: -1 }, { x: 0, y: 1 }, 
            { x: -1, y: 0 }, { x: 1, y: 0 }
        ];

        for (const d of dirs) {
            const nx = current.pos.x + d.x;
            const ny = current.pos.y + d.y;
            const key = `${nx},${ny}`;

            // Check bounds (optional, but good for perf) & Obstacles
            if (obstacles.has(key)) continue;

            // Calculate Cost
            // 1. Base movement cost
            let newCost = current.cost + 1;

            // 2. Turn Penalty (Crucial for Manhattan feel)
            // If we change direction, add huge weight
            if (current.dir && (current.dir.x !== d.x || current.dir.y !== d.y)) {
                newCost += 5; 
            }

            // 3. Heuristic (Manhattan distance to target)
            const heuristic = Math.abs(nx - p2.x) + Math.abs(ny - p2.y);
            const totalCost = newCost + heuristic;

            if (!visited.has(key) || visited.get(key)! > newCost) {
                visited.set(key, newCost);
                queue.push({
                    pos: { x: nx, y: ny },
                    cost: totalCost,
                    cameFrom: current.pos,
                    dir: d
                });
            }
        }
    }

    // 5. Reconstruct Path
    const path: Point[] = [];
    
    // If no path found, use L-shape fallback from closest point
    let curr = finalNode ? finalNode.pos : (closestNode ? closestNode.pos : p1);
    
    // Trace back A*
    // Note: We need to reconstruct the chain. 
    // Since our simple queue structure didn't store the full chain reference, 
    // we might need to store parent pointers in a Map for backtracking.
    // Let's refactor the loop slightly to store parents in a map for easy backtracking.
    
    // (Retrying reconstruction logic with Map for robustness)
    // Redoing A* loop output for simpler backtracking:
    // actually, let's just do a greedy reconstruction from visited or just assume L-shape if complex.
    // To make this robust, let's implement the standard Parent Map approach.
    
    return calculateRouteWithParents(startGrid, p1, p2, endGrid, obstacles, startDir);
};


const calculateRouteWithParents = (
    realStart: Point,
    p1: Point, // Start Escape
    p2: Point, // End Escape
    realEnd: Point,
    obstacles: Set<string>,
    initialDir: Point
): string => {

    const cameFrom = new Map<string, Point>();
    const costSoFar = new Map<string, number>();
    
    const queue: { pos: Point; priority: number }[] = [];
    
    const startKey = `${p1.x},${p1.y}`;
    cameFrom.set(startKey, realStart); // Link p1 back to real start
    costSoFar.set(startKey, 0);
    queue.push({ pos: p1, priority: 0 });

    let current: Point | null = null;
    let found = false;

    // A* Loop
    let i = 0;
    while(queue.length > 0 && i < 3000) {
        i++;
        queue.sort((a,b) => a.priority - b.priority);
        current = queue.shift()!.pos;

        if (current.x === p2.x && current.y === p2.y) {
            found = true;
            break;
        }

        const dirs = [
            { x: 0, y: -1 }, { x: 0, y: 1 }, 
            { x: -1, y: 0 }, { x: 1, y: 0 }
        ];

        for (const d of dirs) {
            const next = { x: current.x + d.x, y: current.y + d.y };
            const nextKey = `${next.x},${next.y}`;

            if (obstacles.has(nextKey)) continue;

            // Cost Calculation
            let newCost = costSoFar.get(`${current.x},${current.y}`)! + 1;
            
            // Turn Penalty
            // Check previous node to determine direction
            const prev = cameFrom.get(`${current.x},${current.y}`);
            if (prev) {
                const dx1 = current.x - prev.x;
                const dy1 = current.y - prev.y;
                const dx2 = next.x - current.x;
                const dy2 = next.y - current.y;
                if (dx1 !== dx2 || dy1 !== dy2) newCost += 10; // High penalty for bends
            } else {
                // First step check against initialDir
                 if (initialDir.x !== d.x || initialDir.y !== d.y) newCost += 10;
            }

            if (!costSoFar.has(nextKey) || newCost < costSoFar.get(nextKey)!) {
                costSoFar.set(nextKey, newCost);
                const priority = newCost + (Math.abs(p2.x - next.x) + Math.abs(p2.y - next.y));
                queue.push({ pos: next, priority });
                cameFrom.set(nextKey, current);
            }
        }
    }

    // Backtrack
    const path: Point[] = [];
    
    if (found && current) {
        path.push(realEnd); // Add the final pin
        let curr: Point = current;
        path.push(curr); // Add p2
        
        while (true) {
            const key = `${curr.x},${curr.y}`;
            const prev = cameFrom.get(key);
            if (!prev) break;
            path.push(prev);
            if (prev.x === realStart.x && prev.y === realStart.y) break;
            curr = prev;
        }
    } else {
        // Fallback: HVH or VHV
        path.push(realEnd);
        path.push({ x: realEnd.x, y: realStart.y });
        path.push(realStart);
    }

    // Simplify Collinear
    const cleanPath: Point[] = [];
    if (path.length > 0) {
        cleanPath.push(path[0]);
        for(let j=1; j<path.length-1; j++) {
            const prev = path[j-1];
            const curr = path[j];
            const next = path[j+1];
            // Check if vertical or horizontal line continues
            if (!((prev.x === curr.x && curr.x === next.x) || (prev.y === curr.y && curr.y === next.y))) {
                cleanPath.push(curr);
            }
        }
        cleanPath.push(path[path.length-1]);
    }

    // Generate SVG path string
    // Reverse because we backtracked from End -> Start
    cleanPath.reverse();

    if (cleanPath.length === 0) return "";

    let d = `M ${fromGrid(cleanPath[0].x)} ${fromGrid(cleanPath[0].y)}`;
    for (let k = 1; k < cleanPath.length; k++) {
        d += ` L ${fromGrid(cleanPath[k].x)} ${fromGrid(cleanPath[k].y)}`;
    }

    return d;
};
