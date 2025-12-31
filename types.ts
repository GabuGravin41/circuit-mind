
export enum ComponentType {
  RESISTOR = 'RESISTOR',
  CAPACITOR = 'CAPACITOR',
  INDUCTOR = 'INDUCTOR',
  DIODE = 'DIODE',
  LED = 'LED',
  TRANSISTOR_NPN = 'TRANSISTOR_NPN',
  TRANSISTOR_PNP = 'TRANSISTOR_PNP',
  MOSFET_N = 'MOSFET_N',
  MOSFET_P = 'MOSFET_P',
  IC_GENERIC = 'IC_GENERIC', // Parametric IC
  IC_555 = 'IC_555',
  IC_OPAMP = 'IC_OPAMP',
  MCU_GENERIC = 'MCU_GENERIC', // Microcontrollers
  LOGIC_AND = 'LOGIC_AND',
  LOGIC_OR = 'LOGIC_OR',
  LOGIC_NOT = 'LOGIC_NOT',
  LOGIC_NAND = 'LOGIC_NAND',
  VOLTAGE_SOURCE = 'VOLTAGE_SOURCE',
  GROUND = 'GROUND',
  CONNECTOR = 'CONNECTOR',
  SWITCH = 'SWITCH',
  SENSOR = 'SENSOR',
  REGULATOR = 'REGULATOR',
  UNKNOWN = 'UNKNOWN'
}

export enum ToolMode {
    SELECT = 'SELECT',
    WIRE = 'WIRE',
    COMPONENT = 'COMPONENT',
    PAN = 'PAN',
    DELETE = 'DELETE'
}

export interface SchematicNode {
  id: string;
  type: ComponentType;
  label: string;
  value?: string; 
  x: number; 
  y: number; 
  rotation: number; 
  pins?: { id: string; label: string; x: number; y: number; orientation: string }[]; // AI can provide custom pins
  properties?: Record<string, string>;
}

export interface SchematicWire {
  id: string;
  sourceId: string;
  sourcePin: string;
  targetId: string;
  targetPin: string;
  label?: string;
  netId?: string;
}

export interface SchematicData {
  title: string;
  description: string;
  nodes: SchematicNode[];
  wires: SchematicWire[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isError?: boolean;
}
