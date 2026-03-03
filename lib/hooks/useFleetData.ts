import { useState, useEffect, useRef } from 'react';

export type VehicleType = 'VIP_LIMO' | 'SUV' | 'SHUTTLE_VAN' | 'BUS';
export type VehicleStatus = 'MOVING' | 'IDLE' | 'OFFLINE' | 'ALARM';

export interface Telemetry {
  speed: number;
  fuel: number;
  ignition: boolean;
  temperature?: number;
}

export interface DriverInfo {
  id: string;
  name: string;
  photoUrl?: string;
  trustScore?: number;
  isSuspended?: boolean;
}

export interface GuestInfo {
  name: string;
  roomNumber?: string;
  notes?: string;
}

export interface Vehicle {
  id: string;
  name: string;
  type: VehicleType;
  status: VehicleStatus;
  lat: number;
  lng: number;
  heading: number;
  telemetry: Telemetry;
  driver?: DriverInfo;
  guest?: GuestInfo;
  lastUpdate: number;
  ip_address_starlink?: string;
  serial_dsm_cam?: string;
  tablet_id?: string;
}

export interface FleetAlert {
  id: string;
  vehicleId: string;
  vehicleName: string;
  type: 'FATIGUE' | 'SMOKING' | 'CRASH' | 'GEOFENCE' | 'SOBRIETY_FAILURE';
  message: string;
  timestamp: number;
  active: boolean;
}

interface UseFleetDataReturn {
  vehicles: Vehicle[];
  alerts: FleetAlert[];
  isConnected: boolean;
}

const CENTER_LAT = 10.627543;
const CENTER_LNG = 103.522141;

const generateMockVehicles = (count: number): Vehicle[] => {
  const luxuryModels = [
    { name: 'Mercedes-Benz S-Class', type: 'VIP_LIMO' as VehicleType },
    { name: 'Mercedes-Benz Maybach S680', type: 'VIP_LIMO' as VehicleType },
    { name: 'Toyota Alphard', type: 'SHUTTLE_VAN' as VehicleType },
    { name: 'Toyota Vellfire', type: 'SHUTTLE_VAN' as VehicleType },
    { name: 'Range Rover SV', type: 'SUV' as VehicleType },
  ];

  const firstNames = ['Sokha', 'Chann', 'Pheakdey', 'Bora', 'Vannak', 'Sopheap', 'Kosal', 'Monita', 'Chea', 'Sovann'];

  return Array.from({ length: count }).map((_, i) => {
    const vModel = luxuryModels[i % luxuryModels.length];
    const isSuspended = i < 2; // Realism: 2 suspended drivers
    let status: VehicleStatus = isSuspended ? 'OFFLINE' : (Math.random() > 0.6 ? 'IDLE' : 'MOVING');

    // Make sure we have enough MOVING for the dispatch board to look active
    if (!isSuspended && i >= 2 && i < 15) {
      status = 'MOVING';
    }

    const padStr = String(i + 1).padStart(3, '0');

    return {
      id: `v-${i + 1}`,
      name: `${vModel.name} (VIP-${padStr})`,
      type: vModel.type,
      status,
      lat: CENTER_LAT + (Math.random() - 0.5) * 0.05,
      lng: CENTER_LNG + (Math.random() - 0.5) * 0.05,
      heading: Math.floor(Math.random() * 360),
      telemetry: {
        speed: status === 'MOVING' ? Math.floor(Math.random() * 60) + 20 : 0,
        fuel: Math.floor(Math.random() * 60) + 40,
        ignition: status === 'MOVING' || status === 'IDLE',
      },
      driver: {
        id: `d-${i}`,
        name: `${firstNames[i % firstNames.length]} Driver ${i + 1}`,
        trustScore: isSuspended ? Math.floor(Math.random() * 20) + 20 : Math.floor(Math.random() * 15) + 85,
        isSuspended,
      },
      guest: (status === 'MOVING' || status === 'IDLE') && (i % 2 === 0) ? {
        name: `VIP Guest ${i + 1}`,
        notes: i % 4 === 0 ? 'High Roller - Needs Champagne' : 'Requires discreet entry'
      } : undefined,
      lastUpdate: Date.now(),
      ip_address_starlink: `100.127.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254) + 1}`,
      serial_dsm_cam: `DSM-${Math.floor(Math.random() * 1000000).toString(16).toUpperCase().padStart(6, '0')}`,
      tablet_id: `TAB-VYL-${padStr}`,
    };
  });
};

export function useFleetData(): UseFleetDataReturn {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [alerts, setAlerts] = useState<FleetAlert[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Use Ref to access latest vehicles in intervals without re-triggering them
  const vehiclesRef = useRef<Vehicle[]>([]);

  useEffect(() => {
    vehiclesRef.current = vehicles;
  }, [vehicles]);

  useEffect(() => {
    // Delay initialization to avoid hydration mismatch
    setTimeout(() => {
      const initialVehicles = generateMockVehicles(50);
      setVehicles(initialVehicles);
      vehiclesRef.current = initialVehicles;
      setIsConnected(true);

      // Generate initial sobriety failure alerts for suspended drivers
      const initialAlerts: FleetAlert[] = initialVehicles
        .filter(v => v.driver?.isSuspended)
        .map(v => ({
          id: `alert-sobriety-${v.id}`,
          vehicleId: v.id,
          vehicleName: v.name,
          type: 'SOBRIETY_FAILURE',
          message: `Sobriety Check Failed: ${v.driver?.name} (BAC: 0.12%)`,
          timestamp: Date.now() - Math.floor(Math.random() * 3600000), // Sometime in the last hour
          active: true
        }));
      setAlerts(initialAlerts);

    }, 0);
  }, []);

  useEffect(() => {
    if (!isConnected) return;

    // Movement Loop
    const moveInterval = setInterval(() => {
      setVehicles((prev: Vehicle[]) => prev.map((v: Vehicle) => {
        if (v.status === 'OFFLINE' || v.status === 'ALARM' || v.driver?.isSuspended) return v;

        let { lat, lng, heading } = v;
        let speed = v.telemetry.speed;
        let status: VehicleStatus = v.status;

        // Simulate Random Status Change
        if (Math.random() > 0.995) {
          status = status === 'MOVING' ? 'IDLE' : 'MOVING';
          speed = status === 'MOVING' ? 30 : 0;
        }

        if (status === 'MOVING') {
          const speedFactor = 0.00005;
          const rad = (heading * Math.PI) / 180;
          lat += Math.cos(rad) * speedFactor;
          lng += Math.sin(rad) * speedFactor;

          if (Math.random() > 0.9) {
            heading = (heading + (Math.random() - 0.5) * 20 + 360) % 360;
          }

          // Constrain movement to VIP bounding box (approx 2.5km)
          const BOUNDARY = 0.025;
          if (Math.abs(lat - CENTER_LAT) > BOUNDARY || Math.abs(lng - CENTER_LNG) > BOUNDARY) {
            heading = (heading + 180 + (Math.random() - 0.5) * 45) % 360;
            lat = Math.max(CENTER_LAT - BOUNDARY, Math.min(CENTER_LAT + BOUNDARY, lat));
            lng = Math.max(CENTER_LNG - BOUNDARY, Math.min(CENTER_LNG + BOUNDARY, lng));
          }
        }

        return {
          ...v,
          lat,
          lng,
          heading,
          status,
          telemetry: {
            ...v.telemetry,
            speed,
            fuel: Math.max(0, v.telemetry.fuel - 0.001),
            ignition: status === 'MOVING' || status === 'IDLE'
          },
          lastUpdate: Date.now()
        };
      }));
    }, 1000);

    // Alert Loop
    const alertInterval = setInterval(() => {
      const currentVehicles = vehiclesRef.current;
      const activeVehicles = currentVehicles.filter(v => v.status === 'MOVING');

      if (activeVehicles.length > 0) { // 100% chance every 12s
        const idToAlert = Math.floor(Math.random() * activeVehicles.length);
        const target = activeVehicles[idToAlert];

        if (!target) return;

        const isFatigue = Math.random() > 0.5;
        const type = isFatigue ? 'FATIGUE' : 'GEOFENCE';
        const message = isFatigue
          ? `Fatigue Detected: AI DSM Alert for ${target.driver?.name || 'Driver'}`
          : `Geofence Violation: ${target.name} left designated VIP route`;

        // Create Alert
        const newAlert: FleetAlert = {
          id: `alert-${Date.now()}`,
          vehicleId: target.id,
          vehicleName: target.name,
          type,
          message,
          timestamp: Date.now(),
          active: true
        };

        setAlerts((prevAlerts: FleetAlert[]) => [newAlert, ...prevAlerts].slice(0, 15));

        // Set Vehicle to ALARM
        setVehicles((prev: Vehicle[]) => prev.map((v: Vehicle) => v.id === target.id ? { ...v, status: 'ALARM' } : v));

        // Auto-resolve after 8s
        setTimeout(() => {
          setVehicles((curr: Vehicle[]) => curr.map((v: Vehicle) => v.id === target.id && v.status === 'ALARM' ? { ...v, status: 'MOVING' } : v));
        }, 8000);
      }
    }, 12000);

    return () => {
      clearInterval(moveInterval);
      clearInterval(alertInterval);
    };
  }, [isConnected]);

  return { vehicles, alerts, isConnected };
}
