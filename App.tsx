
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import SchematicCanvas from './components/SchematicCanvas';
import ChatInterface from './components/ChatInterface';
import { SchematicData, ChatMessage, SchematicNode, SchematicWire, ToolMode, ComponentType } from './types';
import { generateSchematic } from './services/geminiService';
import { COMPONENT_LIBRARY } from './services/componentLibrary';

const Icons = {
    Cursor: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>,
    Wire: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h2"/><path d="M17 12h2"/><path d="M9 12h6"/><circle cx="3" cy="12" r="2"/><circle cx="21" cy="12" r="2"/></svg>,
    Pan: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>,
    Undo: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>,
    Redo: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{transform: 'scaleX(-1)'}}><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>,
    Rotate: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.25L21 3v8h-8l3.22-3.22A6.98 6.98 0 1 0 12 19a7 7 0 0 0 7-7h2z"/></svg>,
    Bot: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4M8 16v2M16 16v2"/></svg>,
    List: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>,
    Chip: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M11 3v18M15 3v18M19 3v18M3 7h18M3 11h18M3 15h18M3 19h18"/></svg>
};

const App: React.FC = () => {
  const [schematic, setSchematic] = useState<SchematicData>({ title: "New Design", description: "", nodes: [], wires: [] });
  const [history, setHistory] = useState<SchematicData[]>([]);
  const [redoStack, setRedoStack] = useState<SchematicData[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [toolMode, setToolMode] = useState<ToolMode>(ToolMode.SELECT);
  const [selectedComponentType, setSelectedComponentType] = useState<ComponentType>();
  const [rightTab, setRightTab] = useState<'AI' | 'PROPERTIES' | 'LOG' | 'NETLIST'>('AI');

  const pushToHistory = useCallback((data: SchematicData) => {
    setHistory(prev => [...prev, schematic]);
    setRedoStack([]);
    setSchematic(data);
  }, [schematic]);

  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack(stack => [...stack, schematic]);
    setHistory(stack => stack.slice(0, -1));
    setSchematic(prev);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory(stack => [...stack, schematic]);
    setRedoStack(stack => stack.slice(0, -1));
    setSchematic(next);
  };

  const rotateSelected = useCallback(() => {
    if (!selectedNodeId) return;
    const updatedNodes = schematic.nodes.map(n => 
        n.id === selectedNodeId ? { ...n, rotation: (n.rotation + 90) % 360 } : n
    );
    pushToHistory({ ...schematic, nodes: updatedNodes });
  }, [selectedNodeId, schematic, pushToHistory]);

  const handleDeleteNode = (id: string) => {
    pushToHistory({
      ...schematic,
      nodes: schematic.nodes.filter(n => n.id !== id),
      wires: schematic.wires.filter(w => w.sourceId !== id && w.targetId !== id)
    });
    setSelectedNodeId(undefined);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';
      if (isInput) return;
      if (e.key === 'Escape') { setToolMode(ToolMode.SELECT); setSelectedComponentType(undefined); setSelectedNodeId(undefined); }
      if (e.key === 'r' || e.key === 'R') rotateSelected();
      if (e.key === 'w' || e.key === 'W') setToolMode(ToolMode.WIRE);
      if (e.key === 's' || e.key === 'S') setToolMode(ToolMode.SELECT);
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedNodeId) handleDeleteNode(selectedNodeId); }
      if (e.ctrlKey && e.key === 'z') undo();
      if (e.ctrlKey && e.key === 'y') redo();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, schematic, rotateSelected]);

  const handleSendMessage = async (text: string) => {
    setMessages(prev => [...prev, { role: 'user', text, timestamp: Date.now() }]);
    setIsLoading(true);
    try {
      const result = await generateSchematic(text, schematic.nodes.length > 0 ? schematic : undefined);
      pushToHistory(result);
      setMessages(prev => [...prev, { role: 'model', text: "Design updated. Checking ERC rules...", timestamp: Date.now() }]);
      setRightTab('LOG');
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'model', text: `Synthesis Error: ${e.message}`, timestamp: Date.now(), isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateNetlist = useMemo(() => {
    let out = "* CircuitMind Generated Netlist\n";
    schematic.nodes.forEach(n => {
        out += `${n.label} ${n.type} ${n.value || ''}\n`;
    });
    schematic.wires.forEach(w => {
        out += `.connect ${w.sourceId}.${w.sourcePin} ${w.targetId}.${w.targetPin}\n`;
    });
    return out;
  }, [schematic]);

  const selectedNode = schematic.nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#080809] text-zinc-300 font-sans overflow-hidden select-none">
      {/* Engineering Header */}
      <div className="h-14 bg-[#0f0f11] border-b border-zinc-800/60 flex items-center justify-between px-4 z-50 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-sky-500/20">C</div>
            <div className="flex flex-col">
                <span className="font-bold text-zinc-100 leading-none text-base tracking-tight">CircuitMind</span>
                <span className="text-[9px] text-sky-500 font-black tracking-widest uppercase">Parametric Synthesis Engine</span>
            </div>
          </div>
          
          <div className="flex bg-zinc-900/80 p-1 rounded-xl gap-1 border border-zinc-800/50">
            <button title="Select (S)" onClick={() => setToolMode(ToolMode.SELECT)} className={`p-1.5 rounded-lg transition-all ${toolMode === ToolMode.SELECT ? 'bg-sky-500 text-white' : 'hover:bg-zinc-800 text-zinc-500'}`}>{Icons.Cursor}</button>
            <button title="Wire (W)" onClick={() => setToolMode(ToolMode.WIRE)} className={`p-1.5 rounded-lg transition-all ${toolMode === ToolMode.WIRE ? 'bg-sky-500 text-white' : 'hover:bg-zinc-800 text-zinc-500'}`}>{Icons.Wire}</button>
            <button title="Pan (P)" onClick={() => setToolMode(ToolMode.PAN)} className={`p-1.5 rounded-lg transition-all ${toolMode === ToolMode.PAN ? 'bg-sky-500 text-white' : 'hover:bg-zinc-800 text-zinc-500'}`}>{Icons.Pan}</button>
          </div>
        </div>

        <div className="flex items-center gap-4">
            <button onClick={() => setRightTab('NETLIST')} className="text-[10px] font-black text-zinc-500 hover:text-sky-400 transition-colors tracking-widest uppercase">View Netlist</button>
            <div className="w-[1px] h-8 bg-zinc-800" />
            <button className="bg-zinc-100 hover:bg-white text-black text-xs font-black px-5 py-2 rounded-lg transition-all active:scale-95 shadow-lg">EXPORT Gerber/EDIF</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Component Sidebar */}
        <div className="w-60 bg-[#0f0f11] border-r border-zinc-800/60 flex flex-col z-40">
          <div className="p-4 flex items-center justify-between border-b border-zinc-800/40">
            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Global Library</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {['Passives', 'Semiconductors', 'Integrated Circuits', 'Power'].map(cat => (
              <div key={cat} className="space-y-1.5">
                <div className="px-2 py-1 text-[9px] font-black text-zinc-700 uppercase tracking-tighter">{cat}</div>
                <div className="grid grid-cols-2 gap-1.5 px-1">
                  {Object.values(COMPONENT_LIBRARY).filter(c => c.category === cat).map(item => (
                    <button key={item.type} onClick={() => { setToolMode(ToolMode.COMPONENT); setSelectedComponentType(item.type); }} className={`flex flex-col items-center p-2 rounded-xl border transition-all ${selectedComponentType === item.type && toolMode === ToolMode.COMPONENT ? 'bg-sky-500/10 border-sky-500/40 text-sky-400' : 'bg-zinc-900/20 border-zinc-800/40 hover:border-zinc-700 text-zinc-600'}`}>
                      <svg width="22" height="22" viewBox="-20 -20 40 40" className="mb-1.5 overflow-visible">{item.draw({ color: 'currentColor' })}</svg>
                      <span className="text-[9px] text-center font-bold leading-tight">{item.label.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CAD Canvas */}
        <div className="flex-1 relative bg-[#080809]">
          <SchematicCanvas data={schematic} toolMode={toolMode} selectedComponentType={selectedComponentType} onNodeClick={setSelectedNodeId} selectedNodeId={selectedNodeId} onUpdateNodes={nodes => pushToHistory({ ...schematic, nodes })} onAddNode={node => pushToHistory({ ...schematic, nodes: [...schematic.nodes, node] })} onAddWire={wire => pushToHistory({ ...schematic, wires: [...schematic.wires, wire] })} onDelete={handleDeleteNode} showGrid={true} onToolChange={setToolMode} />
          {selectedNodeId && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 flex bg-zinc-900/90 backdrop-blur border border-zinc-700 p-1 rounded-xl shadow-2xl z-40">
                  <button onClick={rotateSelected} title="Rotate (R)" className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-sky-400 transition-colors">{Icons.Rotate}</button>
                  <button onClick={() => handleDeleteNode(selectedNodeId)} title="Delete (Del)" className="p-2 hover:bg-red-500/10 rounded-lg text-zinc-400 hover:text-red-500 transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
              </div>
          )}
        </div>

        {/* Right Intelligence Panel */}
        <div className="w-96 bg-[#0f0f11] border-l border-zinc-800/60 flex flex-col z-40">
          <div className="flex p-1 bg-zinc-950/80 m-3 rounded-xl border border-zinc-800/40">
            <button onClick={() => setRightTab('AI')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${rightTab === 'AI' ? 'bg-zinc-800 text-sky-400' : 'text-zinc-600'}`}>Co-Pilot</button>
            <button onClick={() => setRightTab('LOG')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${rightTab === 'LOG' ? 'bg-zinc-800 text-sky-400' : 'text-zinc-600'}`}>ERC</button>
            <button onClick={() => setRightTab('PROPERTIES')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${rightTab === 'PROPERTIES' ? 'bg-zinc-800 text-sky-400' : 'text-zinc-600'}`}>Props</button>
          </div>

          <div className="flex-1 overflow-hidden">
            {rightTab === 'AI' && <ChatInterface messages={messages} onSendMessage={handleSendMessage} isLoading={isLoading} />}
            {rightTab === 'NETLIST' && (
                <div className="p-5 h-full flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Spice Netlist View</span>
                        <button onClick={() => setRightTab('AI')} className="text-zinc-600 hover:text-zinc-300">✕</button>
                    </div>
                    <pre className="flex-1 bg-zinc-950 p-4 rounded-xl border border-zinc-800 font-mono text-[11px] text-emerald-500 overflow-auto">
                        {generateNetlist}
                    </pre>
                </div>
            )}
            {rightTab === 'LOG' && (
              <div className="p-5 space-y-4 h-full overflow-y-auto">
                <h3 className="text-zinc-300 font-black text-[11px] uppercase tracking-widest">Engineering Rationale</h3>
                <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50 text-xs font-mono leading-relaxed text-zinc-400 italic">
                   {schematic.description || "// No analysis generated yet."}
                </div>
              </div>
            )}
            {rightTab === 'PROPERTIES' && (
              <div className="p-6 space-y-6">
                {selectedNode ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-600 uppercase">Designator</label>
                      <input className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-lg text-sm outline-none" value={selectedNode.label} onChange={e => setSchematic(s => ({ ...s, nodes: s.nodes.map(n => n.id === selectedNodeId ? { ...n, label: e.target.value } : n) }))} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-600 uppercase">Value</label>
                      <input className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-lg text-sm outline-none text-sky-400" value={selectedNode.value || ''} onChange={e => setSchematic(s => ({ ...s, nodes: s.nodes.map(n => n.id === selectedNodeId ? { ...n, value: e.target.value } : n) }))} />
                    </div>
                  </>
                ) : <div className="text-center py-20 text-zinc-700 text-[10px] uppercase font-black">Select an item</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
