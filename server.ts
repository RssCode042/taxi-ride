import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory state (for demo purposes, use Redis/DB for production)
const drivers = new Map(); // driverId -> { socketId, location, status }
const activeRides = new Map(); // rideId -> { passengerId, driverId, status }

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });
  const PORT = Number(process.env.PORT) || 3000;

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    // --- DRIVER LOGIC ---
    socket.on('driver_online', (driverData) => {
      drivers.set(driverData.id, {
        socketId: socket.id,
        location: driverData.location,
        status: 'available',
        ...driverData
      });
      socket.join('drivers');
      console.log(`Driver ${driverData.id} is online`);
    });

    socket.on('driver_location_update', (data) => {
      const driver = drivers.get(data.driverId);
      if (driver) {
        driver.location = data.location;
        // If driver is on a ride, notify the passenger
        const ride = Array.from(activeRides.values()).find(r => r.driverId === data.driverId);
        if (ride) {
          io.to(ride.passengerSocketId).emit('driver_location_sync', {
            location: data.location,
            eta: data.eta
          });
        }
      }
    });

    socket.on('accept_ride', (data) => {
      const ride = activeRides.get(data.rideId);
      if (ride && ride.status === 'searching') {
        ride.status = 'accepted';
        ride.driverId = data.driverId;
        ride.driverSocketId = socket.id;
        
        drivers.get(data.driverId).status = 'busy';

        // Notify passenger
        io.to(ride.passengerSocketId).emit('driver_found', {
          driver: data.driver,
          location: data.location,
          eta: data.eta
        });
        
        console.log(`Ride ${data.rideId} accepted by driver ${data.driverId}`);
      }
    });

    // --- PASSENGER LOGIC ---
    socket.on('request_ride', (rideRequest) => {
      const rideId = `ride_${Date.now()}`;
      const newRide = {
        id: rideId,
        passengerSocketId: socket.id,
        status: 'searching',
        ...rideRequest
      };
      
      activeRides.set(rideId, newRide);

      // Notify all available drivers
      io.to('drivers').emit('new_ride_request', {
        rideId,
        ...rideRequest
      });

      // MOCK FALLBACK: If no real driver accepts in 5 seconds, trigger the simulation
      // Remove this once you have the real Driver App connected
      setTimeout(() => {
        const ride = activeRides.get(rideId);
        if (ride && ride.status === 'searching') {
          console.log('No real driver accepted. Starting simulation...');
          simulateRide(socket, rideRequest);
        }
      }, 5000);
    });

    socket.on('cancel_ride', () => {
      // Cleanup intervals if any
      if (socket.data.approachInterval) clearInterval(socket.data.approachInterval);
      if (socket.data.rideInterval) clearInterval(socket.data.rideInterval);
      
      // Notify driver if assigned
      const ride = Array.from(activeRides.values()).find(r => r.passengerSocketId === socket.id);
      if (ride && ride.driverSocketId) {
        io.to(ride.driverSocketId).emit('ride_cancelled_by_passenger');
        drivers.get(ride.driverId).status = 'available';
      }
      
      // Remove ride
      const rideEntry = Array.from(activeRides.entries()).find(([_, r]) => r.passengerSocketId === socket.id);
      if (rideEntry) activeRides.delete(rideEntry[0]);
    });

    socket.on('disconnect', () => {
      // Cleanup driver
      for (const [id, d] of drivers.entries()) {
        if (d.socketId === socket.id) {
          drivers.delete(id);
          break;
        }
      }
      if (socket.data.approachInterval) clearInterval(socket.data.approachInterval);
      if (socket.data.rideInterval) clearInterval(socket.data.rideInterval);
    });
  });

  // Helper for the simulation (keep it for testing)
  function simulateRide(socket, { userLocation, destination, route, preferences }) {
    const startLat = userLocation.lat + 0.005;
    const startLng = userLocation.lng + 0.005;
    
    const mockDriver = {
      id: 'sim_d1',
      name: 'Симулатор (Тест)',
      photo: 'https://i.pravatar.cc/150?img=11',
      rating: 4.9,
      carModel: 'Toyota Prius',
      carPlate: 'CB 1234 AB',
      carColor: 'Бял',
      carYear: 2021,
      preferences: preferences || { nonSmoking: true, pets: false, luggage: false }
    };

    socket.emit('driver_found', {
      location: { lat: startLat, lng: startLng },
      eta: 3,
      driver: mockDriver
    });

    let approachStep = 0;
    const approachTotal = 10;
    const approachInterval = setInterval(() => {
      approachStep++;
      const fraction = approachStep / approachTotal;
      const currentLat = startLat + (userLocation.lat - startLat) * fraction;
      const currentLng = startLng + (userLocation.lng - startLng) * fraction;

      socket.emit('driver_approach_update', {
        location: { lat: currentLat, lng: currentLng },
        eta: Math.ceil(3 * (1 - fraction))
      });

      if (approachStep >= approachTotal) {
        clearInterval(approachInterval);
        socket.emit('driver_arrived_at_user');

        if (route && route.length > 0) {
          let rideStep = 0;
          const rideInterval = setInterval(() => {
            rideStep += Math.max(1, Math.floor(route.length / 20));
            if (rideStep >= route.length) {
              rideStep = route.length - 1;
              socket.emit('ride_update', { location: route[rideStep] });
              clearInterval(rideInterval);
              socket.emit('ride_arrived');
            } else {
              socket.emit('ride_update', { location: route[rideStep] });
            }
          }, 500);
          socket.data.rideInterval = rideInterval;
        } else {
          socket.emit('ride_arrived');
        }
      }
    }, 500);
    socket.data.approachInterval = approachInterval;
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
