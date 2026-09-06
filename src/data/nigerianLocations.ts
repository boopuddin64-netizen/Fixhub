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
  // Lagos State
  {
    name: 'Computer Village (Otigba / Pepple St)',
    city: 'Ikeja',
    state: 'Lagos State',
    landmark: 'Otigba Street / Under Bridge',
    lat: 6.5954,
    lng: 3.3364,
    isTechHub: true,
  },
  {
    name: 'Allen Avenue / Opebi',
    city: 'Ikeja',
    state: 'Lagos State',
    landmark: 'Oshopey Plaza',
    lat: 6.5964,
    lng: 3.3421,
  },
  {
    name: 'Victoria Island (Adetokunbo Ademola / Saka)',
    city: 'Lagos Island',
    state: 'Lagos State',
    landmark: 'Eko Hotel roundabout',
    lat: 6.4281,
    lng: 3.4219,
  },
  {
    name: 'Lekki Phase 1 (Admiralty Way)',
    city: 'Eti-Osa',
    state: 'Lagos State',
    landmark: 'Lekki Toll Gate',
    lat: 6.4474,
    lng: 3.4731,
  },
  {
    name: 'Yaba / Sabo (Commercial Ave)',
    city: 'Lagos Mainland',
    state: 'Lagos State',
    landmark: 'Yaba Tech / Sabo Market',
    lat: 6.5095,
    lng: 3.3711,
    isTechHub: true,
  },
  {
    name: 'Surulere (Adeniran Ogunsanya)',
    city: 'Surulere',
    state: 'Lagos State',
    landmark: 'Adeniran Ogunsanya Mall',
    lat: 6.4969,
    lng: 3.3578,
  },
  {
    name: 'Festac Town (21 / 22 Road)',
    city: 'Amuwo Odofin',
    state: 'Lagos State',
    landmark: 'Festac 1st Gate',
    lat: 6.4674,
    lng: 3.2842,
  },
  {
    name: 'Marina / Broad Street',
    city: 'Lagos Island',
    state: 'Lagos State',
    landmark: 'CMS Bus Stop',
    lat: 6.4531,
    lng: 3.3958,
  },

  // Rivers State (Port Harcourt)
  {
    name: 'Garrison / Aba Road (Electronics & Phone Market)',
    city: 'Port Harcourt',
    state: 'Rivers State',
    landmark: 'Garrison Junction',
    lat: 4.8156,
    lng: 7.0128,
    isTechHub: true,
  },
  {
    name: 'GRA Phase 2 (Tombia Street)',
    city: 'Port Harcourt',
    state: 'Rivers State',
    landmark: 'Polo Club',
    lat: 4.8242,
    lng: 6.9984,
  },
  {
    name: 'Rumuokoro (East-West Road)',
    city: 'Port Harcourt',
    state: 'Rivers State',
    landmark: 'Rumuokoro Flyover',
    lat: 4.8692,
    lng: 6.9854,
  },
  {
    name: 'Mile 1 / Diobu Market',
    city: 'Port Harcourt',
    state: 'Rivers State',
    landmark: 'Mile 1 Flyover',
    lat: 4.7865,
    lng: 7.0051,
  },

  // Abuja FCT
  {
    name: 'Emab Plaza / Wuse 2 (Aminu Kano Cres)',
    city: 'Abuja Municipal',
    state: 'Abuja FCT',
    landmark: 'Emab Plaza Phone Hub',
    lat: 9.0765,
    lng: 7.4721,
    isTechHub: true,
  },
  {
    name: 'Garki 2 (Ladoke Akintola Blvd)',
    city: 'Abuja Municipal',
    state: 'Abuja FCT',
    landmark: 'Garki Area 2 Shopping Complex',
    lat: 9.0345,
    lng: 7.4912,
  },
  {
    name: 'Maitama (Maitama Shopping Centre)',
    city: 'Abuja Municipal',
    state: 'Abuja FCT',
    landmark: 'Farmers Market',
    lat: 9.0882,
    lng: 7.4942,
  },
  {
    name: 'Utako / Jabi (Plaza Complex)',
    city: 'Abuja Municipal',
    state: 'Abuja FCT',
    landmark: 'Jabi Lake Mall',
    lat: 9.0621,
    lng: 7.4265,
  },

  // Oyo State (Ibadan)
  {
    name: 'Dugbe Commercial District (Iwo Road / Dugbe)',
    city: 'Ibadan',
    state: 'Oyo State',
    landmark: 'Cocoa House',
    lat: 7.3912,
    lng: 3.8824,
    isTechHub: true,
  },
  {
    name: 'Bodija / UI (Secretariat Road)',
    city: 'Ibadan',
    state: 'Oyo State',
    landmark: 'Bodija Market / UI Gate',
    lat: 7.4321,
    lng: 3.9054,
  },

  // Edo State (Benin City)
  {
    name: 'Mission Road / Ring Road',
    city: 'Benin City',
    state: 'Edo State',
    landmark: 'King Square Ring Road',
    lat: 6.3350,
    lng: 5.6037,
    isTechHub: true,
  },

  // Enugu State (Enugu)
  {
    name: 'Ogbete Main Market (Kenyatta / Holy Ghost)',
    city: 'Enugu',
    state: 'Enugu State',
    landmark: 'Holy Ghost Cathedral',
    lat: 6.4413,
    lng: 7.4988,
    isTechHub: true,
  },

  // Kano State (Kano)
  {
    name: 'Farm Centre Phone Market (Post Office Rd)',
    city: 'Kano',
    state: 'Kano State',
    landmark: 'Farm Centre GSM Village',
    lat: 11.9964,
    lng: 8.5167,
    isTechHub: true,
  },
];

export function searchNigerianLocations(query: string): NigerianArea[] {
  if (!query.trim()) return POPULAR_NIGERIAN_LOCATIONS.slice(0, 6);
  const q = query.toLowerCase().trim();
  return POPULAR_NIGERIAN_LOCATIONS.filter(
    (loc) =>
      loc.name.toLowerCase().includes(q) ||
      loc.city.toLowerCase().includes(q) ||
      loc.state.toLowerCase().includes(q) ||
      (loc.landmark && loc.landmark.toLowerCase().includes(q))
  );
}
