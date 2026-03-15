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

      console.log(`Searching for real drivers for ride ${rideId}...`);
    });

    socket.on('cancel_ride', () => {
      // Notify driver if assigned
      const ride = Array.from(activeRides.values()).find(r => r.passengerSocketId === socket.id);
      if (ride && ride.driverSocketId) {
        io.to(ride.driverSocketId).emit('ride_cancelled_by_passenger');
        const driver = drivers.get(ride.driverId);
        if (driver) driver.status = 'available';
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
    });
  });

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
