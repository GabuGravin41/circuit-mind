
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { SchematicData, SchematicNode, SchematicWire, ToolMode, ComponentType } from '../types';
import { getComponentDef, rotatePoint } from '../services/componentLibrary';
import { calculateRoute } from '../services/routeEngine';

interface SchematicCanvasProps {
  data: SchematicData;
  toolMode: ToolMode;
  selectedComponentType?: ComponentType;
  onNodeClick: (nodeId: string) => void;
  selectedNodeId?: string;
  onUpdateNodes: (nodes: SchematicNode[]) => void;
  onAddNode: (node: SchematicNode) => void;
  onAddWire: (wire: SchematicWire) => void;
  onDelete: (selectedId: string) => void;
  showGrid: boolean;
  onToolChange: (mode: ToolMode) => void;
}

const GRID_SIZE = 10;

const SchematicCanvas: React.FC<SchematicCanvasProps> = ({ 
    data, toolMode, selectedComponentType, onNodeClick, selectedNodeId, 
    onUpdateNodes, onAddNode, onAddWire, onDelete, showGrid, onToolChange 
}) => {
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 0.8 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [wireStart, setWireStart] = useState<{ nodeId: string, pinId: string } | null>(null);
  const [mouseWorldPos, setMouseWorldPos] = useState({ x: 0, y: 0 });
  const [hoverPin, setHoverPin] = useState<{ nodeId: string, pinId: string } | null>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);

  const screenToWorld = (screenX: number, screenY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (screenX - rect.left - viewport.x) / viewport.scale,
      y: (screenY - rect.top - viewport.y) / viewport.scale
    };
  };

  const getPinWorldPosition = (node: SchematicNode, pinId: string) => {
    const def = getComponentDef(node.type);
    const pins = node.pins || def.pins;
    const pin = pins.find(p => p.id === pinId) || pins[0];
    const offset = rotatePoint(pin.x, pin.y, node.rotation);
    return {
      x: Math.round(node.x + offset.x),
      y: Math.round(node.y + offset.y),
      dir: pin.orientation
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    
    if (e.button === 2) {
        setWireStart(null);
        onToolChange(ToolMode.SELECT);
        return;
    }

    if (e.button === 1 || toolMode === ToolMode.PAN) {
      setIsPanning(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (toolMode === ToolMode.COMPONENT && selectedComponentType) {
      const snapped = { x: Math.round(worldPos.x / 50) * 50, y: Math.round(worldPos.y / 50) * 50 };
      onAddNode({ 
        id: `U${Date.now()}`, 
        type: selectedComponentType, 
        label: `${selectedComponentType.substring(0, 1)}${data.nodes.length + 1}`, 
        x: snapped.x, 
        y: snapped.y, 
        rotation: 0 
      });
      return;
    }

    if (toolMode === ToolMode.WIRE) {
      if (hoverPin) {
          if (!wireStart) {
              setWireStart(hoverPin);
          } else if (wireStart.nodeId !== hoverPin.nodeId) {
              onAddWire({ 
                  id: `w${Date.now()}`, 
                  sourceId: wireStart.nodeId, 
                  sourcePin: wireStart.pinId, 
                  targetId: hoverPin.nodeId, 
                  targetPin: hoverPin.pinId 
              });
              setWireStart(null);
          }
      } else {
          setWireStart(null);
      }
      return;
    }

    const hit = data.nodes.find(n => {
      const def = getComponentDef(n.type);
      return Math.abs(worldPos.x - n.x) < def.width/2 && Math.abs(worldPos.y - n.y) < def.height/2;
    });

    if (hit) {
      onNodeClick(hit.id);
      setDraggingNodeId(hit.id);
    } else {
      onNodeClick('');
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    setMouseWorldPos(worldPos);

    if (isPanning) {
      setViewport(prev => ({ ...prev, x: prev.x + (e.clientX - dragStart.x), y: prev.y + (e.clientY - dragStart.y) }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }

    if (draggingNodeId) {
      const snappedX = Math.round(worldPos.x / GRID_SIZE) * GRID_SIZE;
      const snappedY = Math.round(worldPos.y / GRID_SIZE) * GRID_SIZE;
      const updatedNodes = data.nodes.map(n => n.id === draggingNodeId ? { ...n, x: snappedX, y: snappedY } : n);
      onUpdateNodes(updatedNodes);
    }

    let closest = null;
    data.nodes.forEach(node => {
      const pins = node.pins || getComponentDef(node.type).pins;
      pins.forEach(pin => {
        const pos = getPinWorldPosition(node, pin.id);
        if (Math.abs(pos.x - worldPos.x) < 20 && Math.abs(pos.y - worldPos.y) < 20) {
          closest = { nodeId: node.id, pinId: pin.id };
        }
      });
    });
    setHoverPin(closest);
  };

  const wires = useMemo(() => data.wires.map(w => {
    const sNode = data.nodes.find(n => n.id === w.sourceId);
    const tNode = data.nodes.find(n => n.id === w.targetId);
    if (!sNode || !tNode) return null;
    return { ...w, path: calculateRoute(getPinWorldPosition(sNode, w.sourcePin), getPinWorldPosition(tNode, w.targetPin), data.nodes) };
  }), [data.wires, data.nodes]);

  const activeWirePath = useMemo(() => {
    if (!wireStart) return "";
    const startNode = data.nodes.find(n => n.id === wireStart.nodeId);
    if (!startNode) return "";
    const targetPos = hoverPin ? getPinWorldPosition(data.nodes.find(n => n.id === hoverPin.nodeId)!, hoverPin.pinId) : { x: Math.round(mouseWorldPos.x/10)*10, y: Math.round(mouseWorldPos.y/10)*10 };
    return calculateRoute(getPinWorldPosition(startNode, wireStart.pinId), targetPos, data.nodes);
  }, [wireStart, hoverPin, mouseWorldPos, data.nodes]);

  return (
    <div 
      ref={canvasRef}
      className="w-full h-full bg-[#080809] relative overflow-hidden cursor-crosshair"
      onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => {setIsPanning(false); setDraggingNodeId(null);}}
      onContextMenu={e => e.preventDefault()}
    >
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(#1a1a1c 1.5px, transparent 1.5px)`, backgroundSize: `${GRID_SIZE * viewport.scale * 2}px ${GRID_SIZE * viewport.scale * 2}px`, backgroundPosition: `${viewport.x}px ${viewport.y}px`, pointerEvents: 'none' }} />

      <div style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`, transformOrigin: '0 0' }}>
        <svg className="overflow-visible absolute inset-0 pointer-events-none">
          {wires.map(w => w && (
            <g key={w.id}>
                <path d={w.path} fill="none" stroke={selectedNodeId === w.sourceId || selectedNodeId === w.targetId ? "#38bdf8" : "#2d2d30"} strokeWidth="5" strokeLinecap="round" className="opacity-10" />
                <path d={w.path} fill="none" stroke={selectedNodeId === w.sourceId || selectedNodeId === w.targetId ? "#38bdf8" : "#4ade80"} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </g>
          ))}
          {wireStart && (
            <path d={activeWirePath} fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeDasharray="4 4" strokeLinejoin="round" />
          )}
        </svg>

        {data.nodes.map(node => {
          const def = getComponentDef(node.type);
          const isSelected = selectedNodeId === node.id;
          const pins = node.pins || def.pins;
          return (
            <div key={node.id} style={{ left: node.x, top: node.y, position: 'absolute', transform: `translate(-50%, -50%) rotate(${node.rotation}deg)`, cursor: toolMode === ToolMode.SELECT ? 'grab' : 'crosshair' }}>
              <svg width={def.width + 100} height={def.height + 100} viewBox={`${-def.width/2 - 50} ${-def.height/2 - 50} ${def.width+100} ${def.height+100}`} className="overflow-visible">
                {isSelected && <rect x={-def.width/2-8} y={-def.height/2-8} width={def.width+16} height={def.height+16} fill="rgba(14, 165, 233, 0.05)" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="4 2" rx="8" />}
                {def.draw({ color: isSelected ? '#0ea5e9' : '#a1a1aa', node })}
                {pins.map(p => {
                  const isHovered = hoverPin?.nodeId === node.id && hoverPin?.pinId === p.id;
                  const isActive = wireStart?.nodeId === node.id && wireStart?.pinId === p.id;
                  return (
                    <g key={p.id}>
                        <circle cx={p.x} cy={p.y} r={isHovered ? 6 : 4} fill={isHovered || isActive ? "#fbbf24" : "#3f3f46"} />
                        {(isHovered || isSelected) && <text x={p.x} y={p.y - 10} textAnchor="middle" fill="#52525b" fontSize="8" className="font-mono font-bold uppercase select-none">{p.label || p.id}</text>}
                    </g>
                  );
                })}
              </svg>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 text-center pointer-events-none" style={{ transform: `rotate(${-node.rotation}deg)` }}>
                <div className="text-[10px] font-black text-sky-400 whitespace-nowrap drop-shadow-sm uppercase tracking-tighter">{node.label}</div>
                <div className="text-[9px] text-zinc-600 font-mono font-bold whitespace-nowrap">{node.value}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SchematicCanvas;
