
import React from 'react';
import { ComponentType, SchematicNode } from '../types';

export interface PinDefinition {
  id: string;
  label: string;
  x: number;
  y: number;
  orientation: 'left' | 'right' | 'top' | 'bottom';
}

export interface ComponentDefinition {
  type: ComponentType;
  label: string;
  category: string;
  width: number;
  height: number;
  pins: PinDefinition[];
  draw: (props: { color: string, node?: SchematicNode }) => React.ReactNode;
}

export const rotatePoint = (x: number, y: number, rotation: number) => {
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
        x: Math.round(x * cos - y * sin),
        y: Math.round(x * sin + y * cos)
    };
};

/**
 * FIX: Changed Record to Partial<Record> to resolve the missing properties error on line 33.
 * Since the library doesn't implement every single ComponentType yet, Partial is appropriate.
 */
export const COMPONENT_LIBRARY: Partial<Record<ComponentType, ComponentDefinition>> = {
  [ComponentType.RESISTOR]: {
    type: ComponentType.RESISTOR, label: "Resistor", category: "Passives", width: 80, height: 20,
    pins: [{ id: "1", label: "", x: -40, y: 0, orientation: 'left' }, { id: "2", label: "", x: 40, y: 0, orientation: 'right' }],
    draw: ({ color }) => React.createElement('path', { d: "M-40,0 L-30,0 L-25,-10 L-15,10 L-5,-10 L5,10 L15,-10 L25,10 L30,0 L40,0", fill: "none", stroke: color, strokeWidth: "2" })
  },
  [ComponentType.CAPACITOR]: {
    type: ComponentType.CAPACITOR, label: "Capacitor", category: "Passives", width: 40, height: 40,
    pins: [{ id: "1", label: "", x: -20, y: 0, orientation: 'left' }, { id: "2", label: "", x: 20, y: 0, orientation: 'right' }],
    draw: ({ color }) => React.createElement('g', null,
      React.createElement('path', { d: "M-20,0 L-5,0 M5,0 L20,0", fill: "none", stroke: color, strokeWidth: "2" }),
      React.createElement('line', { x1: "-5", y1: "-15", x2: "-5", y2: "15", stroke: color, strokeWidth: "2" }),
      React.createElement('line', { x1: "5", y1: "-15", x2: "5", y2: "15", stroke: color, strokeWidth: "2" })
    )
  },
  [ComponentType.IC_GENERIC]: {
    type: ComponentType.IC_GENERIC, label: "Generic IC", category: "Integrated Circuits", width: 100, height: 120,
    pins: [], // Default empty, usually provided by AI
    draw: ({ color, node }) => {
        const pins = node?.pins || [];
        // Calculate dynamic dimensions based on pins if needed
        let minX = -50, maxX = 50, minY = -60, maxY = 60;
        pins.forEach(p => {
            minX = Math.min(minX, p.x + 10);
            maxX = Math.max(maxX, p.x - 10);
            minY = Math.min(minY, p.y + 10);
            maxY = Math.max(maxY, p.y - 10);
        });
        const w = 100;
        const h = Math.max(120, pins.length * 15);
        return React.createElement('g', null,
            React.createElement('rect', { x: -w/2, y: -h/2, width: w, height: h, rx: 4, fill: "#111113", stroke: color, strokeWidth: "2" }),
            React.createElement('text', { x: 0, y: 0, textAnchor: "middle", fill: color, fontSize: "10", fontWeight: "bold", fontFamily: "monospace" }, node?.label || "IC"),
            React.createElement('circle', { cx: -w/2 + 10, cy: -h/2 + 10, r: 3, fill: color, opacity: 0.5 })
        );
    }
  },
  [ComponentType.TRANSISTOR_NPN]: {
    type: ComponentType.TRANSISTOR_NPN, label: "NPN BJT", category: "Semiconductors", width: 60, height: 60,
    pins: [{ id: "B", label: "B", x: -30, y: 0, orientation: 'left' }, { id: "C", label: "C", x: 10, y: -30, orientation: 'top' }, { id: "E", label: "E", x: 10, y: 30, orientation: 'bottom' }],
    draw: ({ color }) => React.createElement('g', null,
      React.createElement('circle', { cx: "0", cy: "0", r: "20", fill: "none", stroke: color, strokeWidth: "1.5" }),
      React.createElement('line', { x1: "-10", y1: "-15", x2: "-10", y2: "15", stroke: color, strokeWidth: "2" }), 
      React.createElement('path', { d: "M-30,0 L-10,0", stroke: color, strokeWidth: "2" }), 
      React.createElement('path', { d: "M-6,-8 L10,-30", stroke: color, strokeWidth: "2" }), 
      React.createElement('path', { d: "M-6,8 L10,30", stroke: color, strokeWidth: "2" }), 
      React.createElement('path', { d: "M6,22 L10,30", stroke: color, strokeWidth: "2" }) 
    )
  },
  [ComponentType.REGULATOR]: {
      type: ComponentType.REGULATOR, label: "Voltage Reg", category: "Power", width: 80, height: 60,
      pins: [{ id: "IN", label: "IN", x: -40, y: 0, orientation: 'left' }, { id: "OUT", label: "OUT", x: 40, y: 0, orientation: 'right' }, { id: "GND", label: "GND", x: 0, y: 30, orientation: 'bottom' }],
      draw: ({ color }) => React.createElement('rect', { x: -40, y: -30, width: 80, height: 60, rx: 2, fill: "#111113", stroke: color, strokeWidth: "2" })
  },
  [ComponentType.SWITCH]: {
    type: ComponentType.SWITCH, label: "Switch", category: "Logic", width: 60, height: 20,
    pins: [{ id: "1", label: "", x: -30, y: 0, orientation: 'left' }, { id: "2", label: "", x: 30, y: 0, orientation: 'right' }],
    draw: ({ color }) => React.createElement('g', null,
        React.createElement('path', { d: "M-30,0 L-10,0 M10,0 L30,0", stroke: color, strokeWidth: "2" }),
        React.createElement('path', { d: "M-10,0 L10,-15", stroke: color, strokeWidth: "2", fill: "none" })
    )
  },
  [ComponentType.SENSOR]: {
    type: ComponentType.SENSOR, label: "Generic Sensor", category: "Integrated Circuits", width: 60, height: 60,
    pins: [{ id: "VCC", label: "VCC", x: -30, y: -15, orientation: 'left' }, { id: "GND", label: "GND", x: -30, y: 15, orientation: 'left' }, { id: "OUT", label: "OUT", x: 30, y: 0, orientation: 'right' }],
    draw: ({ color }) => React.createElement('g', null,
        React.createElement('rect', { x: -30, y: -30, width: 60, height: 60, rx: 10, fill: "#111113", stroke: color, strokeWidth: "2" }),
        React.createElement('circle', { cx: 0, cy: 0, r: 10, stroke: color, strokeWidth: "1", fill: "none", opacity: 0.3 })
    )
  },
  [ComponentType.VOLTAGE_SOURCE]: {
    type: ComponentType.VOLTAGE_SOURCE, label: "Power", category: "Power", width: 40, height: 80,
    pins: [{ id: "POS", label: "+", x: 0, y: -40, orientation: 'top' }, { id: "NEG", label: "-", x: 0, y: 40, orientation: 'bottom' }],
    draw: ({ color }) => React.createElement('g', null,
      React.createElement('circle', { cx: "0", cy: "-20", r: "15", fill: "none", stroke: color, strokeWidth: "2" }),
      React.createElement('circle', { cx: "0", cy: "20", r: "15", fill: "none", stroke: color, strokeWidth: "2" }),
      React.createElement('text', { x: "0", y: "-15", textAnchor: "middle", fill: color, fontSize: "14" }, "+"),
      React.createElement('text', { x: "0", y: "25", textAnchor: "middle", fill: color, fontSize: "14" }, "-")
    )
  },
  [ComponentType.GROUND]: {
    type: ComponentType.GROUND, label: "Ground", category: "Power", width: 40, height: 40,
    pins: [{ id: "1", label: "GND", x: 0, y: -20, orientation: 'top' }],
    draw: ({ color }) => React.createElement('g', { transform: "translate(0, -5)" },
      React.createElement('path', { d: "M0,-15 L0,5 M-15,5 L15,5 M-10,12 L10,12 M-5,19 L5,19", fill: "none", stroke: color, strokeWidth: "2" })
    )
  },
  [ComponentType.UNKNOWN]: {
    type: ComponentType.UNKNOWN, label: "Unknown", category: "Misc", width: 40, height: 40, pins: [],
    draw: ({ color }) => React.createElement('rect', { x: "-20", y: "-20", width: "40", height: "40", fill: "none", stroke: color, strokeDasharray: "4" })
  }
};

/**
 * FIX: Updated return type and added a cast to ComponentDefinition.
 * Since IC_GENERIC is guaranteed to be in COMPONENT_LIBRARY, this is safe.
 */
export const getComponentDef = (type: ComponentType): ComponentDefinition => {
    // We use IC_GENERIC as a fallback because it is defined in our library
    return (COMPONENT_LIBRARY[type] || COMPONENT_LIBRARY[ComponentType.IC_GENERIC]) as ComponentDefinition;
};
