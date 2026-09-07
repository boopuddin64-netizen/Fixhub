import { LocationCoordinates } from '../types/index';

export interface NigerianArea {
  name: string;
  city: string;
  state: string;
  landmark?: string;
  lat: number;
  lng: number;
  isTechHub?: boolean;
}

export const POPULAR_NIGERIAN_LOCATIONS: NigerianArea[] = [
  // Rivers State (Port Harcourt) Seeded Repair Locations & Hubs
  {
    name: 'Garrison Junction / Aba Road (Electronics & Phone Market)',
    city: 'Port Harcourt',
    state: 'Rivers State',
    landmark: 'Garrison Junction',
    lat: 4.8156,
    lng: 7.0128,
    isTechHub: true,
  },
  {
    name: 'Aba Road (Commercial & Tech Corridor)',
    city: 'Port Harcourt',
    state: 'Rivers State',
    landmark: 'Waterlines / Hotel Presidential',
    lat: 4.8210,
    lng: 7.0180,
    isTechHub: true,
  },
  {
    name: 'Mile 1 Market / Diobu (Phone & Gadgets Hub)',
    city: 'Port Harcourt',
    state: 'Rivers State',
    landmark: 'Mile 1 Flyover',
    lat: 4.7865,
    lng: 7.0051,
    isTechHub: true,
  },
  {
    name: 'Mile 2 / Diobu (Ikwerre Road Axis)',
    city: 'Port Harcourt',
    state: 'Rivers State',
    landmark: 'Education Bus Stop',
    lat: 4.7930,
    lng: 7.0010,
  },
  {
    name: 'Rumuola (Rumuola Link Road)',
    city: 'Port Harcourt',
    state: 'Rivers State',
    landmark: 'Rumuola Flyover',
    lat: 4.8350,
    lng: 6.9980,
  },
  {
    name: 'Rumuokoro (East-West Road Transit Hub)',
    city: 'Port Harcourt',
    state: 'Rivers State',
    landmark: 'Rumuokoro Flyover',
    lat: 4.8692,
    lng: 6.9854,
    isTechHub: true,
  },
  {
    name: 'D-Line (Olu Obasanjo Road)',
    city: 'Port Harcourt',
    state: 'Rivers State',
    landmark: 'Kaduna Street Junction',
    lat: 4.8080,
    lng: 7.0060,
  },
  {
    name: 'Old GRA (Forces Avenue / Secretariat)',
    city: 'Port Harcourt',
    state: 'Rivers State',
    landmark: 'Government House Area',
    lat: 4.7780,
    lng: 7.0150,
  },
  {
    name: 'New GRA (Tombia Street)',
    city: 'Port Harcourt',
    state: 'Rivers State',
    landmark: 'Polo Club',
    lat: 4.8242,
    lng: 6.9984,
  },
  {
    name: 'Woji (Woji Estate Road)',
    city: 'Port Harcourt',
    state: 'Rivers State',
    landmark: 'YKC Junction',
    lat: 4.8220,
    lng: 7.0620,
  },
  {
    name: 'Eliozu (Chief G.U. Ake Road)',
    city: 'Port Harcourt',
    state: 'Rivers State',
    landmark: 'Eliozu Flyover',
    lat: 4.8720,
    lng: 7.0250,
  },
  {
    name: 'Choba (Uniport Campus Axis)',
    city: 'Port Harcourt',
    state: 'Rivers State',
    landmark: 'Uniport Junction / Choba Bridge',
    lat: 4.8980,
    lng: 6.9150,
  },
  {
    name: 'Rumuigbo (Ikwerre Road)',
    city: 'Port Harcourt',
    state: 'Rivers State',
    landmark: 'Psychiatric Hospital Junction',
    lat: 4.8480,
    lng: 6.9910,
  },
  {
    name: 'Trans-Amadi (Industrial Layout)',
    city: 'Port Harcourt',
    state: 'Rivers State',
    landmark: 'Slaughter / Ordinance Road',
    lat: 4.8120,
    lng: 7.0420,
    isTechHub: true,
  },
  {
    name: 'Peter Odili Road (Trans-Amadi Axis)',
    city: 'Port Harcourt',
    state: 'Rivers State',
    landmark: 'Genesis Cinema / The Dome',
    lat: 4.8010,
    lng: 7.0510,
  },
];

export function searchNigerianLocations(query: string): NigerianArea[] {
  if (!query.trim()) return POPULAR_NIGERIAN_LOCATIONS;
  const q = query.toLowerCase().trim();
  return POPULAR_NIGERIAN_LOCATIONS.filter(
    (loc) =>
      loc.name.toLowerCase().includes(q) ||
      loc.city.toLowerCase().includes(q) ||
      loc.state.toLowerCase().includes(q) ||
      (loc.landmark && loc.landmark.toLowerCase().includes(q))
  );
}
