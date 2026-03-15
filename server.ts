import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const firebaseConfigPath = path.join(__dirname, 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));

admin.initializeApp({
  projectId: firebaseConfig.projectId,
});

const db = admin.firestore();
if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') {
  // If a specific database ID is provided, we use it. 
  // Note: firebase-admin v11+ supports multiple databases.
  // For simplicity, we assume the default or the one configured.
}

// In-memory mapping for transient socket data
const userSockets = new Map(); // uid -> socketId
const socketToUid = new Map(); // socketId -> uid

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

    // --- AUTH / IDENTITY ---
    socket.on('identify', (uid) => {
      userSockets.set(uid, socket.id);
      socketToUid.set(socket.id, uid);
      console.log(`User ${uid} identified with socket ${socket.id}`);
    });

    // --- DRIVER LOGIC ---
    socket.on('driver_online', async (driverData) => {
      const uid = driverData.id;
      userSockets.set(uid, socket.id);
      socketToUid.set(socket.id, uid);

      try {
        await db.collection('active_drivers').doc(uid).set({
          location: driverData.location,
          status: 'available',
          name: driverData.name,
          rating: driverData.rating,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        socket.join('drivers');
        console.log(`Driver ${uid} is online (persisted)`);
      } catch (error) {
        console.error('Error setting driver online:', error);
      }
    });

    socket.on('driver_location_update', async (data) => {
      const uid = data.driverId;
      try {
        await db.collection('active_drivers').doc(uid).update({
          location: data.location,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Find if this driver is on an active ride
        const ridesSnapshot = await db.collection('rides')
          .where('driverId', '==', uid)
          .where('status', 'in', ['accepted', 'arrived', 'in_progress'])
          .limit(1)
          .get();

        if (!ridesSnapshot.empty) {
          const rideDoc = ridesSnapshot.docs[0];
          const rideData = rideDoc.data();
          const passengerSocketId = userSockets.get(rideData.passengerUid);
          
          if (passengerSocketId) {
            io.to(passengerSocketId).emit('driver_location_sync', {
              location: data.location,
              eta: data.eta
            });
          }
        }
      } catch (error) {
        console.error('Error updating driver location:', error);
      }
    });

    socket.on('accept_ride', async (data) => {
      const rideId = data.rideId;
      const driverId = data.driverId;

      try {
        const rideRef = db.collection('rides').doc(rideId);
        const rideDoc = await rideRef.get();

        if (rideDoc.exists && rideDoc.data()?.status === 'searching') {
          await rideRef.update({
            status: 'accepted',
            driverId: driverId,
            driverName: data.driver.name,
            driverRating: data.driver.rating,
            carModel: data.driver.carModel,
            carPlate: data.driver.carPlate,
            acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          await db.collection('active_drivers').doc(driverId).update({
            status: 'busy'
          });

          const passengerUid = rideDoc.data()?.passengerUid;
          const passengerSocketId = userSockets.get(passengerUid);

          if (passengerSocketId) {
            io.to(passengerSocketId).emit('driver_found', {
              driver: data.driver,
              location: data.location,
              eta: data.eta
            });
          }
          
          console.log(`Ride ${rideId} accepted by driver ${driverId} (persisted)`);
        }
      } catch (error) {
        console.error('Error accepting ride:', error);
      }
    });

    // --- PASSENGER LOGIC ---
    socket.on('request_ride', async (rideRequest) => {
      const rideId = rideRequest.rideId;
      
      // The client already created the ride in Firestore, but we can ensure it's tracked
      // and notify drivers.
      socket.join(`ride_${rideId}`);
      
      // Notify all available drivers
      io.to('drivers').emit('new_ride_request', {
        ...rideRequest
      });

      console.log(`Broadcasting ride request ${rideId} to drivers...`);
    });

    socket.on('cancel_ride', async () => {
      const uid = socketToUid.get(socket.id);
      if (!uid) return;

      try {
        // Find active ride for this passenger
        const ridesSnapshot = await db.collection('rides')
          .where('passengerUid', '==', uid)
          .where('status', 'in', ['searching', 'accepted'])
          .limit(1)
          .get();

        if (!ridesSnapshot.empty) {
          const rideDoc = ridesSnapshot.docs[0];
          const rideData = rideDoc.data();
          
          await rideDoc.ref.update({
            status: 'cancelled',
            cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          if (rideData.driverId) {
            const driverSocketId = userSockets.get(rideData.driverId);
            if (driverSocketId) {
              io.to(driverSocketId).emit('ride_cancelled_by_passenger');
            }
            await db.collection('active_drivers').doc(rideData.driverId).update({
              status: 'available'
            });
          }
        }
      } catch (error) {
        console.error('Error cancelling ride:', error);
      }
    });

    socket.on('disconnect', async () => {
      const uid = socketToUid.get(socket.id);
      if (uid) {
        userSockets.delete(uid);
        socketToUid.delete(socket.id);
        
        // Optionally mark driver as offline in Firestore
        try {
          // We might want to keep them online for a short grace period, 
          // but for this demo we'll remove them.
          await db.collection('active_drivers').doc(uid).delete();
          console.log(`Driver ${uid} disconnected and removed from active_drivers`);
        } catch (error) {
          // Ignore if not a driver
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
