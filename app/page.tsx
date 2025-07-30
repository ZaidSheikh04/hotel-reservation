"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, StepBackIcon as Stairs, Users } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Hotel structure constants
const FLOORS = 10
const ROOMS_PER_FLOOR = [10, 10, 10, 10, 10, 10, 10, 10, 10, 7] // Floor 10 has only 7 rooms
const MAX_ROOMS_PER_BOOKING = 5

// Room status enum
enum RoomStatus {
  AVAILABLE = "available",
  OCCUPIED = "occupied",
  SELECTED = "selected",
}

// Room interface
interface Room {
  number: number
  floor: number
  position: number // 1-based position on floor (1 = leftmost, closest to stairs)
  status: RoomStatus
}

// Booking result interface
interface BookingResult {
  rooms: Room[]
  totalTravelTime: number
  success: boolean
  message: string
}

export default function HotelReservationSystem() {
  // Initialize hotel rooms
  const initializeRooms = (): Room[] => {
    const rooms: Room[] = []

    for (let floor = 1; floor <= FLOORS; floor++) {
      const roomsOnFloor = ROOMS_PER_FLOOR[floor - 1]
      for (let position = 1; position <= roomsOnFloor; position++) {
        const roomNumber = floor === 10 ? 1000 + position : floor * 100 + position
        rooms.push({
          number: roomNumber,
          floor,
          position,
          status: RoomStatus.AVAILABLE,
        })
      }
    }

    return rooms
  }

  const [rooms, setRooms] = useState<Room[]>(initializeRooms())
  const [requestedRooms, setRequestedRooms] = useState<number>(1)
  const [lastBooking, setLastBooking] = useState<BookingResult | null>(null)

  // Calculate travel time between two rooms
  const calculateTravelTime = (room1: Room, room2: Room): number => {
    const verticalTime = Math.abs(room1.floor - room2.floor) * 2 // 2 minutes per floor
    const horizontalTime = room1.floor === room2.floor ? Math.abs(room1.position - room2.position) : 0 // Only count horizontal if same floor

    return verticalTime + horizontalTime
  }

  // Calculate total travel time for a set of rooms (from first to last)
  const calculateTotalTravelTime = (roomSet: Room[]): number => {
    if (roomSet.length <= 1) return 0

    // Sort rooms by floor first, then by position
    const sortedRooms = [...roomSet].sort((a, b) => {
      if (a.floor !== b.floor) return a.floor - b.floor
      return a.position - b.position
    })

    let totalTime = 0
    for (let i = 0; i < sortedRooms.length - 1; i++) {
      totalTime += calculateTravelTime(sortedRooms[i], sortedRooms[i + 1])
    }

    return totalTime
  }

  // Get available rooms on a specific floor
  const getAvailableRoomsOnFloor = (floor: number): Room[] => {
    return rooms
      .filter((room) => room.floor === floor && room.status === RoomStatus.AVAILABLE)
      .sort((a, b) => a.position - b.position)
  }

  // Find optimal room assignment
  const findOptimalRooms = (numRooms: number): BookingResult => {
    if (numRooms > MAX_ROOMS_PER_BOOKING) {
      return {
        rooms: [],
        totalTravelTime: 0,
        success: false,
        message: `Maximum ${MAX_ROOMS_PER_BOOKING} rooms per booking allowed`,
      }
    }

    const availableRooms = rooms.filter((room) => room.status === RoomStatus.AVAILABLE)

    if (availableRooms.length < numRooms) {
      return {
        rooms: [],
        totalTravelTime: 0,
        success: false,
        message: `Only ${availableRooms.length} rooms available`,
      }
    }

    // Strategy 1: Try to book all rooms on the same floor
    for (let floor = 1; floor <= FLOORS; floor++) {
      const floorRooms = getAvailableRoomsOnFloor(floor)
      if (floorRooms.length >= numRooms) {
        const selectedRooms = floorRooms.slice(0, numRooms)
        return {
          rooms: selectedRooms,
          totalTravelTime: calculateTotalTravelTime(selectedRooms),
          success: true,
          message: `Booked ${numRooms} rooms on Floor ${floor}`,
        }
      }
    }

    // Strategy 2: Find combination across floors that minimizes travel time
    let bestCombination: Room[] = []
    let minTravelTime = Number.POSITIVE_INFINITY

    // Generate all possible combinations of available rooms
    const generateCombinations = (rooms: Room[], size: number): Room[][] => {
      if (size === 1) return rooms.map((room) => [room])

      const combinations: Room[][] = []
      for (let i = 0; i <= rooms.length - size; i++) {
        const smaller = generateCombinations(rooms.slice(i + 1), size - 1)
        smaller.forEach((combo) => combinations.push([rooms[i], ...combo]))
      }
      return combinations
    }

    // For performance, limit combinations check for larger requests
    if (numRooms <= 3 || availableRooms.length <= 20) {
      const combinations = generateCombinations(availableRooms, numRooms)

      combinations.forEach((combination) => {
        const travelTime = calculateTotalTravelTime(combination)
        if (travelTime < minTravelTime) {
          minTravelTime = travelTime
          bestCombination = combination
        }
      })
    } else {
      // Greedy approach for larger requests
      bestCombination = availableRooms
        .sort((a, b) => {
          // Prioritize lower floors and positions closer to stairs
          if (a.floor !== b.floor) return a.floor - b.floor
          return a.position - b.position
        })
        .slice(0, numRooms)

      minTravelTime = calculateTotalTravelTime(bestCombination)
    }

    if (bestCombination.length === numRooms) {
      return {
        rooms: bestCombination,
        totalTravelTime: minTravelTime,
        success: true,
        message: `Booked ${numRooms} rooms across multiple floors`,
      }
    }

    return {
      rooms: [],
      totalTravelTime: 0,
      success: false,
      message: "Unable to find optimal room combination",
    }
  }

  // Book rooms
  const bookRooms = useCallback(() => {
    const result = findOptimalRooms(requestedRooms)

    if (result.success) {
      setRooms((prevRooms) =>
        prevRooms.map((room) => {
          const isSelected = result.rooms.some((selectedRoom) => selectedRoom.number === room.number)
          return isSelected ? { ...room, status: RoomStatus.SELECTED } : room
        }),
      )
    }

    setLastBooking(result)
  }, [requestedRooms, rooms])

  // Generate random occupancy
  const generateRandomOccupancy = useCallback(() => {
    setRooms((prevRooms) =>
      prevRooms.map((room) => ({
        ...room,
        status: Math.random() < 0.3 ? RoomStatus.OCCUPIED : RoomStatus.AVAILABLE,
      })),
    )
    setLastBooking(null)
  }, [])

  // Reset all bookings
  const resetBookings = useCallback(() => {
    setRooms(initializeRooms())
    setLastBooking(null)
  }, [])

  // Get room status color
  const getRoomStatusColor = (status: RoomStatus): string => {
    switch (status) {
      case RoomStatus.AVAILABLE:
        return "bg-green-100 border-green-300 text-green-800"
      case RoomStatus.OCCUPIED:
        return "bg-red-100 border-red-300 text-red-800"
      case RoomStatus.SELECTED:
        return "bg-blue-100 border-blue-300 text-blue-800"
      default:
        return "bg-gray-100 border-gray-300 text-gray-800"
    }
  }

  // Get available room count
  const availableRoomCount = rooms.filter((room) => room.status === RoomStatus.AVAILABLE).length
  const occupiedRoomCount = rooms.filter((room) => room.status === RoomStatus.OCCUPIED).length
  const selectedRoomCount = rooms.filter((room) => room.status === RoomStatus.SELECTED).length

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Hotel Room Reservation System</CardTitle>
            <div className="flex justify-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
                <span>Available ({availableRoomCount})</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
                <span>Occupied ({occupiedRoomCount})</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
                <span>Selected ({selectedRoomCount})</span>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <label htmlFor="rooms" className="text-sm font-medium">
                  Number of Rooms:
                </label>
                <Input
                  id="rooms"
                  type="number"
                  min="1"
                  max={MAX_ROOMS_PER_BOOKING}
                  value={requestedRooms}
                  onChange={(e) => setRequestedRooms(Number.parseInt(e.target.value) || 1)}
                  className="w-20"
                />
              </div>
              <Button onClick={bookRooms} className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>Book Rooms</span>
              </Button>
              <Button onClick={generateRandomOccupancy} variant="outline">
                Generate Random Occupancy
              </Button>
              <Button onClick={resetBookings} variant="outline">
                Reset All Bookings
              </Button>
            </div>

            {lastBooking && (
              <Alert className={lastBooking.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {lastBooking.message}
                  {lastBooking.success && lastBooking.totalTravelTime > 0 && (
                    <span className="block mt-1">Total travel time: {lastBooking.totalTravelTime} minutes</span>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Hotel Visualization */}
        <Card>
          <CardHeader>
            <CardTitle>Hotel Layout</CardTitle>
            <p className="text-sm text-gray-600">97 rooms across 10 floors. Stairs/lift on the left side.</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: FLOORS }, (_, i) => FLOORS - i).map((floor) => {
                const floorRooms = rooms.filter((room) => room.floor === floor)
                return (
                  <div key={floor} className="border rounded-lg p-4 bg-white">
                    <div className="flex items-center space-x-4">
                      {/* Stairs/Lift indicator */}
                      <div className="flex flex-col items-center justify-center w-12 h-16 bg-gray-100 border rounded">
                        <Stairs className="w-6 h-6 text-gray-600" />
                        <span className="text-xs font-medium">F{floor}</span>
                      </div>

                      {/* Rooms */}
                      <div className="flex flex-wrap gap-2">
                        {floorRooms
                          .sort((a, b) => a.position - b.position)
                          .map((room) => (
                            <Badge
                              key={room.number}
                              variant="outline"
                              className={`${getRoomStatusColor(room.status)} px-3 py-1 text-xs font-medium`}
                            >
                              {room.number}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Travel Time Information */}
        <Card>
          <CardHeader>
            <CardTitle>Travel Time Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              • <strong>Horizontal travel:</strong> 1 minute per room (same floor)
            </p>
            <p>
              • <strong>Vertical travel:</strong> 2 minutes per floor (stairs/lift)
            </p>
            <p>
              • <strong>Booking priority:</strong> Same floor first, then minimize total travel time
            </p>
            <p>
              • <strong>Maximum booking:</strong> {MAX_ROOMS_PER_BOOKING} rooms per guest
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
