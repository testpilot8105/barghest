// One Blueprint icon per ontology type, for Gotham's icon nodes and the Timeline's subject. The ontology gives every
// type the same cube, so the picture is chosen here; a type this list doesn't know keeps the cube.
import type { ComponentType } from 'react';
import {
  At,
  BankAccount,
  Box,
  Build,
  Calendar,
  Clipboard,
  Comment,
  Cube,
  Document,
  Flows,
  Home,
  Learning,
  MapMarker,
  Office,
  People,
  Person,
  Target,
  Truck,
  WarningSign,
  type SVGIconProps,
} from '@blueprintjs/icons';

const ICONS: Record<string, ComponentType<SVGIconProps>> = {
  Person,
  Organization: Office,
  Location: MapMarker,
  Event: Calendar,
  DigitalAccount: At,
  OnlineGroup: People,
  Incident: WarningSign,
  Firearm: Target,
  EvidenceItem: Box,
  School: Learning,
  LGU: BankAccount,
  Barangay: Home,
  Hauler: Office,
  Contract: Document,
  Facility: Build,
  Vehicle: Truck,
  Inspection: Clipboard,
  Complaint: Comment,
  Thing: Cube,
  Relationship: Flows,
  Document,
};

export function typeIcon(type: string): ComponentType<SVGIconProps> {
  return ICONS[type] ?? Cube;
}

/** "Type:pk", the way the engine and the address bar name an object. */
export function objectKey(type: string, pk: string): string {
  return `${type}:${pk}`;
}

export function parseKey(key: string | null): { type: string; pk: string } | null {
  if (!key) return null;
  const i = key.indexOf(':');
  return i > 0 && i < key.length - 1 ? { type: key.slice(0, i), pk: key.slice(i + 1) } : null;
}
