import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// Note: We use local enums here to avoid ESM/CJS interop issues with ts-node when running the seed script.
// These values MUST match the ones in types/enums.ts.

// User Roles
const UserRole = {
  ADMIN: 'ADMIN',
  DISPATCHER: 'DISPATCHER',
  DRIVER: 'DRIVER',
}

// Vehicle Status
const VehicleStatus = {
  AVAILABLE: 'AVAILABLE',
  ON_TRIP: 'ON_TRIP',
  MAINTENANCE: 'MAINTENANCE',
}

// Vehicle Type
const VehicleType = {
  VIP_LIMO: 'VIP_LIMO',
  SUV: 'SUV',
  SHUTTLE_VAN: 'SHUTTLE_VAN',
}

// Driver Status
const DriverStatus = {
  AVAILABLE: 'AVAILABLE',
  ON_TRIP: 'ON_TRIP',
  OFF_DUTY: 'OFF_DUTY',
  SUSPENDED: 'SUSPENDED',
}

const TripStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
}

const prisma = new PrismaClient()

const randomElement = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomNumber = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

async function main() {
  const password = await bcrypt.hash('password123', 10)

  // Create Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@vyleramove.com' },
    update: {},
    create: {
      email: 'admin@vyleramove.com',
      name: 'Admin User',
      password,
      role: UserRole.ADMIN,
    },
  })

  // Create User Driver
  const driverUser = await prisma.user.upsert({
    where: { email: 'driver@vyleramove.com' },
    update: {},
    create: {
      email: 'driver@vyleramove.com',
      name: 'John Driver',
      password,
      role: UserRole.DRIVER,
    },
  })

  console.log('Generating 50 Vehicles...')
  const luxuryModels = [
    { make: 'Mercedes-Benz', model: 'S-Class', type: VehicleType.VIP_LIMO, capacity: 3 },
    { make: 'Mercedes-Benz', model: 'Maybach S680', type: VehicleType.VIP_LIMO, capacity: 3 },
    { make: 'Mercedes-Benz', model: 'V-Class', type: VehicleType.SHUTTLE_VAN, capacity: 6 },
    { make: 'Toyota', model: 'Alphard', type: VehicleType.SHUTTLE_VAN, capacity: 6 },
    { make: 'Toyota', model: 'Vellfire', type: VehicleType.SHUTTLE_VAN, capacity: 6 },
    { make: 'Land Rover', model: 'Range Rover SV', type: VehicleType.SUV, capacity: 4 },
  ]

  const createdVehicles = []
  for (let i = 1; i <= 50; i++) {
    const vModel = randomElement(luxuryModels)
    const padStr = String(i).padStart(3, '0')
    const v = await prisma.vehicle.upsert({
      where: { licensePlate: `VIP-${padStr}` },
      update: {},
      create: {
        make: vModel.make,
        model: vModel.model,
        licensePlate: `VIP-${padStr}`,
        vin: crypto.randomBytes(8).toString('hex').toUpperCase(),
        capacity: vModel.capacity,
        status: VehicleStatus.AVAILABLE,
        type: vModel.type,
        currentMileage: randomNumber(2000, 60000),
        ip_address_starlink: `100.127.${randomNumber(0, 255)}.${randomNumber(1, 254)}`,
        serial_dsm_cam: `DSM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        serial_road_cam: `RCAM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        tablet_id: `TAB-VYL-${padStr}`,
        imei_tracker: `35${randomNumber(1000000000000, 9999999999999)}`,
      },
    })
    createdVehicles.push(v)
  }

  console.log('Generating 20 Drivers...')
  const drivers = []
  const firstNames = ['Sokha', 'Chann', 'Pheakdey', 'Bora', 'Vannak', 'Sopheap', 'Kosal', 'Monita', 'Chea', 'Sovann']
  for (let i = 1; i <= 20; i++) {
    const isSuspended = i <= 2
    const d = await prisma.driver.upsert({
      where: { rfid_card_id: `RFID-${String(i).padStart(3, '0')}` },
      update: {},
      create: {
        name: `${randomElement(firstNames)} Driver ${i}`,
        phone: `+855 12 ${randomNumber(100, 999)} ${randomNumber(100, 999)}`,
        license_number: `L${randomNumber(10000000, 99999999)}`,
        license_expiry: new Date(`${randomNumber(2025, 2030)}-12-31`),
        rfid_card_id: `RFID-${String(i).padStart(3, '0')}`,
        status: isSuspended ? DriverStatus.SUSPENDED : randomElement([DriverStatus.AVAILABLE, DriverStatus.OFF_DUTY]),
        languages: randomElement(['Khmer, English', 'Khmer, Chinese', 'English, Chinese', 'Khmer, English, Chinese']),
        rating: isSuspended ? (randomNumber(15, 35) / 10) : (randomNumber(42, 50) / 10),
        trust_score: isSuspended ? randomNumber(20, 45) : randomNumber(85, 100),
        kpi_grade: isSuspended ? 'D' : randomElement(['A', 'B']),
        is_suspended: isSuspended,
      },
    })
    drivers.push(d)

    if (isSuspended) {
      await prisma.sobrietyTest.create({
        data: {
          timestamp: new Date(),
          result: 'FAIL',
          bac_level: randomNumber(8, 15) / 100,
          is_override: false,
          vehicleId: createdVehicles[i - 1].id,
          driverId: d.id,
        },
      })
    }
  }

  console.log('Generating 15-20 Trips...')
  const tripLocations = [
    'VIP Airport Terminal',
    'Private Helipad',
    'Roemah Koffie',
    'Marina Bay',
    'Casino Main Entrance',
    'Diamond Suites',
    'Golf Club',
    'Private Marina'
  ]
  const guestNotes = [
    'High Roller - Needs Champagne',
    'Requires discreet entry',
    'VIP Guest - No photos',
    'Prefers quiet ride',
    'Luggage: 4 large bags',
    'Celebrity - Use rear entrance',
    'Requires wheelchair assistance',
    'Has small dog',
    ''
  ]

  const numTrips = randomNumber(15, 20)
  for (let i = 1; i <= numTrips; i++) {
    const status = randomElement([TripStatus.PENDING, TripStatus.ACTIVE])
    const assignedVehicle = createdVehicles[randomNumber(0, createdVehicles.length - 1)]
    const availableDrivers = drivers.filter(d => !d.is_suspended)
    const assignedDriver = availableDrivers[randomNumber(0, availableDrivers.length - 1)]

    await prisma.trip.create({
      data: {
        guest_name: `VIP Guest ${i}`,
        guest_phone: `+855 99 ${randomNumber(100, 999)} ${randomNumber(100, 999)}`,
        pickup_location: randomElement(tripLocations),
        dropoff_location: randomElement(tripLocations),
        pickup_time: new Date(Date.now() + randomNumber(-1000 * 60 * 60, 1000 * 60 * 60 * 24)),
        status: status,
        notes: randomElement(guestNotes),
        vehicleId: status === TripStatus.ACTIVE ? assignedVehicle.id : null,
        driverId: status === TripStatus.ACTIVE ? assignedDriver.id : null,
      },
    })

    if (status === TripStatus.ACTIVE) {
      await prisma.vehicle.update({
        where: { id: assignedVehicle.id },
        data: { status: VehicleStatus.ON_TRIP }
      })
      await prisma.driver.update({
        where: { id: assignedDriver.id },
        data: { status: DriverStatus.ON_TRIP }
      })
    }
  }

  console.log('Seed completed successfully.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
