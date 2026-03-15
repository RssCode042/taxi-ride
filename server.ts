import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    console.log('Client connected:', socket.id);

    socket.on('request_ride', ({ userLocation, destination, route, preferences }) => {
      // 1. Driver found nearby
      const startLat = userLocation.lat + 0.005;
      const startLng = userLocation.lng + 0.005;
      
      const mockDriver = {
        id: 'd1',
        name: 'Иван Иванов',
        photo: 'https://i.pravatar.cc/150?img=11',
        rating: 4.9,
        carModel: 'Toyota Prius',
        carPlate: 'CB 1234 AB',
        carColor: 'Бял',
        carYear: 2021,
        preferences: preferences || {
          nonSmoking: true,
          pets: false,
          luggage: false
        }
      };

      socket.emit('driver_found', {
        location: { lat: startLat, lng: startLng },
        eta: 3,
        driver: mockDriver
      });

      // 2. Approach user
      let approachStep = 0;
      const approachTotal = 10; // 10 ticks = 5 seconds at 500ms
      
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

          // 3. Ride to destination
          if (route && route.length > 0) {
            let rideStep = 0;
            const rideInterval = setInterval(() => {
              rideStep += Math.max(1, Math.floor(route.length / 20)); // Finish in ~20 steps
              
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
            // Fallback if no route
            socket.emit('ride_arrived');
          }
        }
      }, 500);

      socket.data.approachInterval = approachInterval;
    });

    socket.on('cancel_ride', () => {
      if (socket.data.approachInterval) clearInterval(socket.data.approachInterval);
      if (socket.data.rideInterval) clearInterval(socket.data.rideInterval);
    });

    socket.on('disconnect', () => {
      if (socket.data.approachInterval) clearInterval(socket.data.approachInterval);
      if (socket.data.rideInterval) clearInterval(socket.data.rideInterval);
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
