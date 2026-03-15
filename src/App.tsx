import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import { MapPin, Search, Navigation, Clock, CreditCard, ChevronLeft, ChevronRight, User, Star, Phone, Map as MapIcon, Car, Settings, X, Home, Briefcase, Banknote, Check, LogIn } from 'lucide-react';
import Map from './components/Map';
import BottomSheet from './components/BottomSheet';
import Profile from './components/Profile';
import DriverDashboard from './components/DriverDashboard';
import { Location, RideState, RideOption, UserProfile, PaymentMethod, SavedLocation, Driver, RideReview, RideRequest } from './types';
import { searchAddress, getRoute, reverseGeocode } from './utils/api';
import { auth, db, googleProvider, signInWithPopup, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot, serverTimestamp, addDoc, getDocs, writeBatch, FirebaseUser, handleFirestoreError, OperationType } from './firebase';

const RIDE_OPTIONS: RideOption[] = [
  { id: 'standard', name: 'Стандарт', price: 8.50, eta: 3, capacity: 4, image: 'https://raw.githubusercontent.com/rss042/taxi-assets/main/standard_3d.png', description: 'Достъпни ежедневни пътувания' },
  { id: 'eco', name: 'Еко', price: 7.00, eta: 5, capacity: 4, image: 'https://raw.githubusercontent.com/rss042/taxi-assets/main/eco_3d.png', description: 'Екологични автомобили' },
  { id: 'wagon', name: 'Комби', price: 12.00, eta: 8, capacity: 5, image: 'https://raw.githubusercontent.com/rss042/taxi-assets/main/wagon_3d.png', description: 'Повече място за багаж' },
];

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [state, setState] = useState<RideState>('IDLE');
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [selectedRide, setSelectedRide] = useState<RideOption | null>(null);
  const [dynamicRideOptions, setDynamicRideOptions] = useState<RideOption[]>(RIDE_OPTIONS);
  const [driverLocation, setDriverLocation] = useState<Location | null>(null);
  const [driverEta, setDriverEta] = useState<number>(0);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number, lng: number } | null>(null);
  
  const [driver, setDriver] = useState<Driver | null>(null);
  const [rideRating, setRideRating] = useState<number>(0);
  const [rideFeedback, setRideFeedback] = useState<string>('');
  const [reviews, setReviews] = useState<RideReview[]>([]);

  const [appMode, setAppMode] = useState<'passenger' | 'driver'>('passenger');
  const [isDriverOnline, setIsDriverOnline] = useState(false);
  const [pendingRideRequests, setPendingRideRequests] = useState<RideRequest[]>([]);
  const [activeDriverRide, setActiveDriverRide] = useState<RideRequest | null>(null);

  const [showProfile, setShowProfile] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // Ride Preferences
  const [prefNonSmoking, setPrefNonSmoking] = useState(true);
  const [prefPets, setPrefPets] = useState(false);
  const [prefLuggage, setPrefLuggage] = useState(false);
  const [prefLanguage, setPrefLanguage] = useState(false);
  const [prefInvoice, setPrefInvoice] = useState(false);
  
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'terminal'>('cash');
  const [scheduleTime, setScheduleTime] = useState<'now' | 'later'>('now');

  // User Data from Firestore
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [paymentMethods] = useState<PaymentMethod[]>([
    { id: '1', type: 'card', brand: 'Visa', last4: '4242', isDefault: true },
    { id: '2', type: 'cash', isDefault: false }
  ]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthReady(true);
      
      if (firebaseUser) {
        // Ensure user profile exists in Firestore
        const userRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            const newUser: UserProfile = {
              name: firebaseUser.displayName || 'Потребител',
              email: firebaseUser.email || '',
              phone: firebaseUser.phoneNumber || '',
              rating: 5.0,
              rideHistory: []
            };
            await setDoc(userRef, {
              ...newUser,
              uid: firebaseUser.uid,
              createdAt: serverTimestamp()
            });
            setUserProfile(newUser);
          } else {
            setUserProfile(userSnap.data() as UserProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUserProfile(null);
        setSavedLocations([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync Saved Locations
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'savedLocations'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const locations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavedLocation));
      setSavedLocations(locations);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/savedLocations`);
    });
    return () => unsubscribe();
  }, [user]);

  // Sync Ride History
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'rides'), where('passengerUid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUserProfile(prev => prev ? { ...prev, rideHistory: history as any } : null);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'rides');
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  // Initialize Socket.IO connection
  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('driver_found', (data) => {
      setState('DRIVER_EN_ROUTE');
      setDriverLocation(data.location);
      setDriverEta(data.eta);
      setDriver(data.driver);
    });

    newSocket.on('driver_approach_update', (data) => {
      setDriverLocation(data.location);
      setDriverEta(data.eta);
    });

    newSocket.on('driver_arrived_at_user', () => {
      setState('RIDING');
    });

    newSocket.on('ride_update', (data) => {
      setUserLocation(prev => prev ? { ...prev, lat: data.location[0], lng: data.location[1] } : null);
      setDriverLocation({ lat: data.location[0], lng: data.location[1] });
    });

    newSocket.on('ride_arrived', () => {
      setState('ARRIVED');
    });

    // --- DRIVER SOCKET EVENTS ---
    newSocket.on('new_ride_request', (request: RideRequest) => {
      setPendingRideRequests(prev => [...prev, request]);
      // Play sound or notification if possible
    });

    newSocket.on('ride_cancelled_by_passenger', () => {
      setActiveDriverRide(null);
      alert('Пътникът отказа поръчката.');
    });

    return () => {
      newSocket.close();
    };
  }, []);

  // Identify user to socket server
  useEffect(() => {
    if (socket && user) {
      socket.emit('identify', user.uid);
    }
  }, [socket, user]);

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            address: 'Текуща локация'
          });
        },
        (err) => console.error(err),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // Handle search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length > 2 && state === 'SEARCHING_ADDRESS') {
        const results = await searchAddress(searchQuery, userLocation?.lat, userLocation?.lng);
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, state, userLocation]);

  const handleSelectDestination = async (loc: Location) => {
    setDestination(loc);
    setState('SELECTING_DESTINATION');
    setSearchQuery('');
    setSearchResults([]);
    
    if (userLocation) {
      const r = await getRoute(userLocation, loc);
      if (r) {
        setRoute(r.coords);
        
        // Calculate dynamic prices based on distance and duration
        const distanceKm = r.distance / 1000;
        const durationMin = r.duration / 60;
        
        const dynamicOptions = RIDE_OPTIONS.map(opt => {
          let baseFare = 2.50;
          let perKm = 1.20;
          let perMin = 0.30;
          let etaBase = 3;
          
          if (opt.id === 'eco') {
            baseFare = 2.00;
            perKm = 1.00;
            perMin = 0.25;
            etaBase = 5;
          } else if (opt.id === 'wagon') {
            baseFare = 3.50;
            perKm = 1.50;
            perMin = 0.40;
            etaBase = 8;
          }
          
          const calculatedPrice = baseFare + (distanceKm * perKm) + (durationMin * perMin);
          return {
            ...opt,
            price: Math.max(baseFare + 2, calculatedPrice), // Minimum fare
            eta: etaBase + Math.floor(Math.random() * 3) // Randomize ETA slightly
          };
        });
        
        setDynamicRideOptions(dynamicOptions);
        setSelectedRide(dynamicOptions[0]);
      } else {
        setRoute(null);
        setDynamicRideOptions(RIDE_OPTIONS);
        setSelectedRide(RIDE_OPTIONS[0]);
      }
    } else {
      setDynamicRideOptions(RIDE_OPTIONS);
      setSelectedRide(RIDE_OPTIONS[0]);
    }
  };

  const handleMapClick = async (lat: number, lng: number) => {
    // We now use mapCenter and a confirm button for better UX
  };

  const handleMapMove = (lat: number, lng: number) => {
    if (state === 'SELECTING_ON_MAP') {
      setMapCenter({ lat, lng });
    }
  };

  const handleConfirmMapLocation = async () => {
    if (mapCenter) {
      const address = await reverseGeocode(mapCenter.lat, mapCenter.lng);
      handleSelectDestination({ ...mapCenter, address });
    }
  };

  const handleRequestRide = async () => {
    if (!user) return;
    
    setState('SEARCHING_DRIVER');
    
    const rideData = {
      passengerUid: user.uid,
      destination: destination?.address || 'Неизвестна дестинация',
      status: 'searching',
      createdAt: serverTimestamp(),
      date: new Date().toLocaleDateString('bg-BG', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: new Date().toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' }),
      price: selectedRide?.price || 0
    };

    try {
      const rideRef = await addDoc(collection(db, 'rides'), rideData);
      
      socket?.emit('request_ride', { 
        rideId: rideRef.id,
        userLocation, 
        destination, 
        route,
        passengerName: userProfile?.name || 'Потребител',
        passengerRating: userProfile?.rating || 5.0,
        price: selectedRide?.price || 0,
        preferences: {
          nonSmoking: prefNonSmoking,
          pets: prefPets,
          luggage: prefLuggage,
          terminal: paymentMethod === 'terminal'
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'rides');
    }
  };

  const resetApp = () => {
    setState('IDLE');
    setDestination(null);
    setRoute(null);
    setDriverLocation(null);
    setSelectedRide(null);
    setDriver(null);
    setRideRating(0);
    setRideFeedback('');
    setPrefNonSmoking(true);
    setPrefPets(false);
    setPrefLuggage(false);
    socket?.emit('cancel_ride');
  };

  const submitReviewAndReset = () => {
    if (driver && rideRating > 0) {
      const newReview: RideReview = {
        driverId: driver.id,
        rating: rideRating,
        feedback: rideFeedback,
        date: new Date().toISOString()
      };
      setReviews(prev => [...prev, newReview]);
      console.log('Review submitted:', newReview);
    }
    resetApp();
  };

  const handleToggleDriverOnline = () => {
    if (!user) return;
    const nextState = !isDriverOnline;
    setIsDriverOnline(nextState);
    
    if (nextState) {
      socket?.emit('driver_online', {
        id: user.uid,
        name: userProfile?.name,
        rating: userProfile?.rating,
        location: userLocation
      });
    }
  };

  const handleAcceptRide = (request: RideRequest) => {
    if (!user) return;
    
    setActiveDriverRide(request);
    setPendingRideRequests(prev => prev.filter(r => r.rideId !== request.rideId));
    
    socket?.emit('accept_ride', {
      rideId: request.rideId,
      driverId: user.uid,
      driver: {
        id: user.uid,
        name: userProfile?.name,
        rating: userProfile?.rating,
        carModel: 'Toyota Prius',
        carPlate: 'CB 1234 AB'
      },
      location: userLocation,
      eta: 5
    });
  };

  const handleDeclineRide = (rideId: string) => {
    setPendingRideRequests(prev => prev.filter(r => r.rideId !== rideId));
  };

  const handleCompleteRide = async () => {
    if (!activeDriverRide) return;
    
    try {
      const rideRef = doc(db, 'rides', activeDriverRide.rideId);
      await updateDoc(rideRef, {
        status: 'completed',
        completedAt: serverTimestamp()
      });
      
      setActiveDriverRide(null);
      alert('Пътуването е завършено!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rides/${activeDriverRide.rideId}`);
    }
  };

  const DriverProfileDisplay = ({ driver }: { driver: Driver | null }) => {
    if (!driver) return null;
    return (
      <div className="flex flex-col p-3 bg-gray-900/50 rounded-2xl border border-white/5 gap-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-800 rounded-full overflow-hidden border-2 border-white/10 shadow-sm">
              <img src={driver.photo || "https://i.pravatar.cc/150?img=11"} alt="Driver" className="w-full h-full object-cover" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight">{driver.name || 'Иван Иванов'}</h3>
              <div className="flex items-center text-[10px] text-gray-400 mt-0.5 bg-gray-800/50 w-fit px-1.5 py-0.5 rounded-full border border-white/5">
                <Star className="w-3 h-3 text-yellow-400 fill-current mr-1" /> 
                <span className="font-medium text-white mr-1">{driver.rating || 4.9}</span> 
                <span className="text-[9px]">(124 пътувания)</span>
              </div>
            </div>
          </div>
          <div className="text-right flex flex-col items-end">
            <div className="bg-gray-800/80 px-2 py-1 rounded-lg border border-white/5 mb-1 shadow-sm">
              <p className="font-bold text-base tracking-wider text-white">{driver.carPlate || 'CB 1234 AB'}</p>
            </div>
            <p className="text-[10px] text-gray-400 flex items-center gap-1 font-medium">
              <Car className="w-3 h-3 text-gray-300" /> {driver.carColor || 'Бял'} {driver.carModel || 'Toyota Prius'}
            </p>
          </div>
        </div>
        
        {driver.preferences && (
          <div className="flex flex-wrap gap-1.5 pt-3 border-t border-white/5">
            <span className="text-[10px] font-medium px-2 py-1 bg-gray-800/50 border border-white/5 text-gray-300 rounded-lg">
              {driver.preferences.nonSmoking ? '🚭 Непушач' : '🚬 Пушач'}
            </span>
            {driver.preferences.pets && (
              <span className="text-[10px] font-medium px-2 py-1 bg-gray-800/50 border border-white/5 text-gray-300 rounded-lg">
                🐾 С домашен любимец
              </span>
            )}
            {driver.preferences.luggage && (
              <span className="text-[10px] font-medium px-2 py-1 bg-gray-800/50 border border-white/5 text-gray-300 rounded-lg">
                🧳 Комби / Багаж
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!isAuthReady) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center mb-8">
          <Car className="w-12 h-12 text-blue-500" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">TaxiRide</h1>
        <p className="text-gray-400 mb-12 max-w-xs">Вашето надеждно такси в София. Влезте, за да започнете.</p>
        
        <button 
          onClick={handleLogin}
          className="w-full max-w-sm bg-white text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-all active:scale-95 shadow-xl"
        >
          <LogIn className="w-5 h-5" />
          Влез с Google
        </button>
        
        <div className="mt-12 text-[10px] text-gray-600 uppercase tracking-widest font-bold">
          © 2024 TaxiRide Bulgaria
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden text-white font-sans">
      {/* Map Background - Always present */}
      <div className="absolute inset-0 z-0">
        <Map 
          userLocation={userLocation} 
          destination={appMode === 'driver' && activeDriverRide ? activeDriverRide.pickup : destination} 
          driverLocation={appMode === 'passenger' ? driverLocation : null}
          route={appMode === 'driver' && activeDriverRide ? null : route}
          onMapClick={handleMapClick}
          onMapMove={handleMapMove}
          isSelectingOnMap={state === 'SELECTING_ON_MAP'}
          appMode={appMode}
        />
      </div>

      {appMode === 'driver' ? (
        <DriverDashboard 
          isOnline={isDriverOnline}
          onToggleOnline={handleToggleDriverOnline}
          pendingRequests={pendingRideRequests}
          onAcceptRide={handleAcceptRide}
          onDeclineRide={handleDeclineRide}
          activeRide={activeDriverRide}
          onCompleteRide={handleCompleteRide}
          driverLocation={userLocation}
        />
      ) : (
        <>
          {/* Top Bar */}
          {state === 'IDLE' && (
        <div className="absolute top-0 left-0 right-0 z-[1000] p-3 pointer-events-none flex justify-between">
          <button 
            onClick={() => setShowProfile(true)}
            className="w-10 h-10 bg-gray-900/80 backdrop-blur-md rounded-full shadow-lg flex items-center justify-center pointer-events-auto hover:bg-gray-800 transition-all active:scale-95 border border-white/10"
          >
            <User className="w-5 h-5 text-gray-300" />
          </button>
        </div>
      )}
      {state !== 'IDLE' && state !== 'ARRIVED' && (
        <div className="absolute top-0 left-0 right-0 z-[1000] p-3 pointer-events-none">
          <button 
            onClick={() => {
              if (state === 'SELECTING_DESTINATION') resetApp();
              else if (state === 'SEARCHING_ADDRESS') setState('SELECTING_DESTINATION');
              else if (state === 'SELECTING_ON_MAP') setState('SEARCHING_ADDRESS');
              else setState('IDLE');
            }}
            className="w-10 h-10 bg-gray-900/80 backdrop-blur-md rounded-full shadow-lg flex items-center justify-center pointer-events-auto hover:bg-gray-800 transition-all active:scale-95 border border-white/10"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
        </div>
      )}

      {/* Profile Overlay */}
      {showProfile && (
        <Profile 
          onClose={() => setShowProfile(false)} 
          profile={userProfile}
          paymentMethods={paymentMethods}
          savedLocations={savedLocations}
          appMode={appMode}
          onSwitchMode={(mode) => {
            setAppMode(mode);
            setShowProfile(false);
          }}
          onClearSavedLocations={async () => {
            if (!user) return;
            try {
              const q = query(collection(db, 'savedLocations'), where('uid', '==', user.uid));
              const snapshot = await getDocs(q);
              const batch = writeBatch(db);
              snapshot.docs.forEach((doc) => batch.delete(doc.ref));
              await batch.commit();
            } catch (error) {
              handleFirestoreError(error, OperationType.DELETE, 'savedLocations');
            }
          }}
          onSetDestination={(loc) => {
            setShowProfile(false);
            handleSelectDestination(loc);
          }}
          onToggleFavorite={async (loc) => {
            if (!user) return;
            try {
              const docRef = doc(db, 'savedLocations', loc.id);
              await updateDoc(docRef, { isFavorite: !loc.isFavorite });
            } catch (error) {
              handleFirestoreError(error, OperationType.UPDATE, 'savedLocations');
            }
          }}
        />
      )}

      {/* Map Selection Confirm Button */}
      {state === 'SELECTING_ON_MAP' && (
        <div className="absolute bottom-10 left-0 right-0 z-[2000] px-6 flex flex-col items-center gap-4 pointer-events-none">
          <div className="bg-gray-900/90 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg pointer-events-auto">
            <p className="text-xs font-bold text-gray-300">Преместете картата, за да изберете</p>
          </div>
          <button 
            onClick={handleConfirmMapLocation}
            className="w-full max-w-xs bg-blue-600 text-white font-bold py-3.5 rounded-2xl shadow-2xl pointer-events-auto hover:bg-blue-500 transition-all active:scale-95 flex items-center justify-center gap-2 border border-white/10"
          >
            <MapPin className="w-5 h-5" />
            Потвърди локацията
          </button>
        </div>
      )}

      {/* Bottom Sheet UI */}
      <BottomSheet>
        {state === 'IDLE' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-black tracking-tighter">Накъде?</h1>
              <div className="flex gap-2">
                <div className="w-8 h-8 bg-gray-900/60 rounded-full flex items-center justify-center border border-white/5">
                  <Search className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>

            <div 
              className="w-full bg-gray-900/60 border border-white/10 p-3 rounded-2xl flex items-center gap-3 cursor-pointer transition-all active:scale-[0.98] shadow-lg group"
              onClick={() => setState('SELECTING_DESTINATION')}
            >
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(37,99,235,0.3)] group-hover:bg-blue-500 transition-colors">
                <Search className="w-5 h-5 text-white" />
              </div>
              <span className="text-base font-bold text-gray-400">Въведете дестинация</span>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Любими места</h3>
                <button className="text-[10px] font-bold text-blue-400">Виж всички</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {savedLocations.slice(0, 2).map(loc => (
                  <button 
                    key={loc.id}
                    onClick={() => handleSelectDestination(loc)}
                    className="flex flex-col gap-2 bg-gray-900/40 backdrop-blur-sm border border-white/5 p-4 rounded-xl hover:bg-gray-800/60 transition-all active:scale-95 text-left"
                  >
                    <div className="w-8 h-8 bg-gray-800/80 rounded-full flex items-center justify-center shrink-0 border border-white/5">
                      {loc.icon === 'home' ? <Home className="w-4 h-4 text-blue-400" /> : 
                       loc.icon === 'work' ? <Briefcase className="w-4 h-4 text-orange-400" /> : 
                       <MapPin className="w-4 h-4 text-gray-300" />}
                    </div>
                    <div>
                      <p className="font-black text-white text-sm leading-tight">{loc.name}</p>
                      <p className="text-[10px] text-gray-500 truncate mt-0.5">{loc.address.split(',')[0]}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {state === 'SEARCHING_ADDRESS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black tracking-tighter">Търсене</h2>
              <button 
                onClick={() => setState('SELECTING_DESTINATION')}
                className="p-1.5 bg-gray-900/60 rounded-full border border-white/5"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Search className="w-4 h-4 text-blue-400" />
              </div>
              <input 
                type="text" 
                placeholder="Въведете адрес или място..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-gray-900/60 border border-white/10 p-3 pl-11 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-lg font-bold text-base"
              />
            </div>

            <div className="space-y-1 max-h-[400px] overflow-y-auto hide-scrollbar">
              <button 
                onClick={() => {
                  setState('SELECTING_ON_MAP');
                  if (userLocation) {
                    setMapCenter({ lat: userLocation.lat, lng: userLocation.lng });
                  } else {
                    setMapCenter({ lat: 42.6977, lng: 23.3219 }); // Default Sofia
                  }
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800/40 transition-all group"
              >
                <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center shrink-0 border border-blue-500/20 group-hover:bg-blue-500/20">
                  <MapIcon className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-white text-sm">Избери от картата</p>
                  <p className="text-[10px] text-gray-500">Посочете точното място на картата</p>
                </div>
              </button>

              <div className="h-px bg-white/5 mx-4 my-1" />

              {searchResults.length > 0 ? (
                searchResults.map((result, index) => (
                  <button 
                    key={index}
                    onClick={() => handleSelectDestination(result)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800/40 transition-all group"
                  >
                    <div className="w-10 h-10 bg-gray-900/60 rounded-full flex items-center justify-center shrink-0 border border-white/5 group-hover:border-white/10">
                      <MapPin className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="font-bold text-white truncate text-sm">{result.address.split(',')[0]}</p>
                      <p className="text-[10px] text-gray-500 truncate">{result.address}</p>
                    </div>
                  </button>
                ))
              ) : searchQuery.length > 2 ? (
                <div className="py-8 text-center space-y-2">
                  <div className="w-12 h-12 bg-gray-900/40 rounded-full flex items-center justify-center mx-auto border border-white/5">
                    <Search className="w-6 h-6 text-gray-700" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium">Няма намерени резултати</p>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">Последни търсения</h3>
                  {savedLocations.map(loc => (
                    <button 
                      key={loc.id}
                      onClick={() => handleSelectDestination(loc)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800/40 transition-all"
                    >
                      <div className="w-10 h-10 bg-gray-900/60 rounded-full flex items-center justify-center shrink-0 border border-white/5">
                        <Clock className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-white text-sm">{loc.name}</p>
                        <p className="text-[10px] text-gray-500 truncate">{loc.address}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {state === 'SELECTING_ON_MAP' && (
          <div className="space-y-4 text-center py-6">
            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
              <MapPin className="w-10 h-10 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Изберете локация</h2>
            <p className="text-gray-400 max-w-xs mx-auto">Кликнете върху картата, за да изберете вашата дестинация.</p>
          </div>
        )}

        {state === 'SELECTING_DESTINATION' && (
          <div className="space-y-4">
            {/* Address Inputs - Inspired by image */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-red-500 rounded-full shrink-0 shadow-[0_0_6px_rgba(239,68,68,0.4)]" />
                <div className="flex-1 border-b border-white/10 pb-1.5">
                  <p className="text-[10px] text-gray-500 font-medium mb-0.5">Откъде</p>
                  <p className="text-white font-semibold truncate text-sm">{userLocation?.address || 'Текуща локация'}</p>
                </div>
              </div>
              <div 
                onClick={() => setState('SEARCHING_ADDRESS')}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0 shadow-[0_0_6px_rgba(59,130,246,0.4)]" />
                <div className="flex-1 border-b border-white/10 pb-1.5 group-hover:border-white/20 transition-colors">
                  <p className="text-[10px] text-gray-500 font-medium mb-0.5">Накъде</p>
                  <p className={`font-semibold truncate text-sm ${destination ? 'text-white' : 'text-gray-400'}`}>
                    {destination ? destination.address : 'Въведете дестинация'}
                  </p>
                </div>
                <div className="w-6 h-6 bg-gray-800/50 rounded-full flex items-center justify-center border border-white/5">
                  <ChevronRight className="w-3 h-3 text-gray-400" />
                </div>
              </div>
            </div>

            {/* Ride Options - Inspired by image */}
            <div className="flex gap-3 overflow-x-auto pb-3 hide-scrollbar">
              {dynamicRideOptions.map((option) => (
                <div 
                  key={option.id}
                  onClick={() => setSelectedRide(option)}
                  className={`min-w-[90px] p-3 rounded-2xl border-2 cursor-pointer transition-all active:scale-[0.98] flex flex-col items-center text-center relative ${
                    selectedRide?.id === option.id 
                      ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                      : 'border-transparent bg-gray-900/40 hover:bg-gray-800/60'
                  }`}
                >
                  <div className="h-12 flex items-center justify-center mb-2">
                    {option.image.startsWith('http') ? (
                      <img 
                        src={option.image} 
                        alt={option.name} 
                        className="h-full w-auto object-contain drop-shadow-xl transform group-hover:scale-110 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-3xl drop-shadow-lg">{option.image}</div>
                    )}
                  </div>
                  <h3 className="font-bold text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{option.name}</h3>
                  {destination ? (
                    <p className="font-black text-base text-white">{Math.round(option.price)} лв.</p>
                  ) : (
                    <p className="text-[10px] text-gray-500">от {Math.round(option.price)} лв.</p>
                  )}
                  {selectedRide?.id === option.id && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-black shadow-lg">
                      <Star className="w-2.5 h-2.5 text-white fill-current" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer - Inspired by image */}
            <div className="flex items-center gap-2 pt-1">
              <button 
                onClick={() => setShowPaymentModal(true)}
                className="w-16 h-12 bg-gray-900/60 rounded-xl flex flex-col items-center justify-center border border-white/5 hover:bg-gray-800 transition-all active:scale-95 shadow-sm"
              >
                {paymentMethod === 'cash' ? (
                  <Banknote className="w-4 h-4 text-gray-300 mb-0.5" />
                ) : (
                  <CreditCard className="w-4 h-4 text-gray-300 mb-0.5" />
                )}
                <span className="text-[8px] font-bold text-gray-500 uppercase">
                  {paymentMethod === 'cash' ? 'В брой' : 'Терминал'}
                </span>
              </button>
              
              <button 
                onClick={handleRequestRide}
                disabled={!destination}
                className={`flex-1 font-black text-lg py-3 rounded-xl transition-all shadow-xl flex items-center justify-center gap-2 ${
                  destination 
                    ? 'bg-blue-600 text-white hover:bg-blue-500 active:scale-[0.98]' 
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                {destination ? 'Поръчай такси' : 'Избери дестинация'}
              </button>

              <button 
                onClick={() => setShowSettingsModal(true)}
                className="w-12 h-12 bg-gray-900/60 rounded-xl flex items-center justify-center border border-white/5 hover:bg-gray-800 transition-all active:scale-95 shadow-sm"
              >
                <Settings className="w-5 h-5 text-gray-300" />
              </button>
            </div>
          </div>
        )}

        {state === 'SEARCHING_DRIVER' && (
          <div className="py-8 flex flex-col items-center justify-center space-y-6">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-3 border-gray-800 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Search className="w-6 h-6 text-blue-400 animate-pulse" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold tracking-tight">Търсене на шофьор...</h2>
              <p className="text-xs text-gray-400">Свързваме ви с най-близкото такси.</p>
            </div>
            <button 
              onClick={resetApp}
              className="w-full mt-2 bg-red-500/10 text-red-400 py-3 rounded-xl font-bold hover:bg-red-500/20 active:scale-95 transition-all border border-red-500/20 text-sm"
            >
              Откажи
            </button>
          </div>
        )}

        {state === 'DRIVER_EN_ROUTE' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-gray-900/50 p-4 rounded-2xl border border-white/5">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Пристига след {driverEta} мин</h2>
                <p className="text-xs text-gray-400 mt-0.5">Вашият шофьор пътува към вас</p>
              </div>
              <div className="h-12 flex items-center justify-center">
                {selectedRide?.image.startsWith('http') ? (
                  <img 
                    src={selectedRide.image} 
                    alt={selectedRide.name} 
                    className="h-full w-auto object-contain drop-shadow-2xl"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="text-3xl drop-shadow-lg">{selectedRide?.image}</div>
                )}
              </div>
            </div>
            
            <DriverProfileDisplay driver={driver} />

            <div className="flex gap-3">
              <button className="flex-1 bg-gray-800/80 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-700 transition-all active:scale-95 border border-white/5 shadow-sm text-sm">
                <Phone className="w-4 h-4" /> Обади се
              </button>
              <button 
                onClick={resetApp}
                className="flex-1 bg-red-500/10 text-red-400 py-3 rounded-xl font-bold hover:bg-red-500/20 transition-all active:scale-95 border border-red-500/20 shadow-sm text-sm"
              >
                Откажи
              </button>
            </div>
          </div>
        )}

        {state === 'RIDING' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-gray-900/50 p-4 rounded-2xl border border-white/5">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Пътуване...</h2>
                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">Към {destination?.address?.split(',')[0]}</p>
              </div>
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-500/30">
                <Navigation className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            
            <DriverProfileDisplay driver={driver} />
            
            <div className="p-4 bg-gray-900/50 rounded-2xl border border-white/5 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs text-gray-400 font-medium">Очаквано пристигане</span>
                <span className="font-bold text-base">{new Date(Date.now() + 15 * 60000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
              <div className="w-full bg-gray-800/80 h-2 rounded-full overflow-hidden border border-white/5">
                <div className="bg-blue-500 h-full w-1/3 animate-pulse rounded-full shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
              </div>
            </div>
          </div>
        )}

        {state === 'ARRIVED' && (
          <div className="py-1 flex flex-col items-center justify-center space-y-3">
            <div className="text-center bg-gray-900/50 w-full p-3 rounded-xl border border-white/5">
              <h2 className="text-lg font-bold mb-0.5 tracking-tight text-white">Пристигнахте!</h2>
              <p className="text-gray-400 text-xs">Обща сума: <span className="text-white font-bold text-base ml-1">{selectedRide?.price.toFixed(2)} лв.</span></p>
            </div>

            {driver && (
              <div className="w-full bg-gray-900/50 p-3 rounded-xl border border-white/5 flex flex-col items-center space-y-3 relative mt-5">
                <div className="w-12 h-12 bg-gray-800 rounded-full overflow-hidden absolute -top-6 border-3 border-[#0a0a0a] shadow-lg">
                  <img src={driver.photo || "https://i.pravatar.cc/150?img=11"} alt="Driver" className="w-full h-full object-cover" />
                </div>
                <div className="text-center pt-5">
                  <h3 className="font-bold text-base tracking-tight">{driver.name || 'Иван Иванов'}</h3>
                  <div className="flex items-center justify-center text-[9px] text-gray-400 mt-1 bg-gray-800/50 px-1.5 py-0.5 rounded-full border border-white/5 w-fit mx-auto">
                    <Star className="w-2.5 h-2.5 text-yellow-400 fill-current mr-1" /> 
                    <span className="font-medium text-white mr-1">{driver.rating || 4.9}</span>
                    <span className="mx-1">•</span> {driver.carModel || 'Toyota Prius'} <span className="mx-1">•</span> {driver.carPlate || 'CB 1234 AB'}
                  </div>
                </div>
                
                <div className="w-full pt-2 border-t border-white/5 flex flex-col items-center">
                  <h4 className="font-medium text-[10px] text-gray-300 mb-2">Оценете пътуването</h4>
                  <div className="flex gap-1.5 mb-3">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button 
                        key={star} 
                        onClick={() => setRideRating(star)}
                        className="focus:outline-none transition-all hover:scale-110 active:scale-95"
                      >
                        <Star className={`w-7 h-7 drop-shadow-sm ${rideRating >= star ? 'text-yellow-400 fill-current' : 'text-gray-700'}`} />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={rideFeedback}
                    onChange={(e) => setRideFeedback(e.target.value)}
                    placeholder="Оставете коментар (по желание)..."
                    className="w-full bg-gray-800/50 p-2.5 rounded-lg text-white outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-gray-800 transition-all resize-none h-16 border border-white/5 text-[10px]"
                  />
                </div>
              </div>
            )}

            <button 
              onClick={submitReviewAndReset}
              className="w-full bg-white text-black font-bold text-sm py-2.5 rounded-lg hover:bg-gray-200 active:scale-[0.98] transition-all shadow-[0_0_15px_rgba(255,255,255,0.05)] mt-1"
            >
              {rideRating > 0 ? 'Оцени и завърши' : 'Пропусни и завърши'}
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-gray-900 w-full max-w-md rounded-t-xl p-3 border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold tracking-tight">Финни настройки</h2>
              <button onClick={() => setShowSettingsModal(false)} className="p-1 bg-gray-800/80 rounded-full hover:bg-gray-700 transition-colors active:scale-95">
                <X className="w-3.5 h-3.5 text-gray-300" />
              </button>
            </div>
            <div className="space-y-1.5">
              <button onClick={() => setPrefNonSmoking(!prefNonSmoking)} className={`w-full flex justify-between items-center p-2.5 rounded-lg border transition-all active:scale-[0.98] ${prefNonSmoking ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.05)]' : 'bg-gray-800/50 border-white/5 hover:bg-gray-800 text-gray-300'}`}>
                <span className="font-medium text-xs flex items-center gap-2"><span className="text-base">🚭</span> Непушач</span>
                {prefNonSmoking && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_6px_rgba(59,130,246,0.8)]" />}
              </button>
              <button onClick={() => setPrefPets(!prefPets)} className={`w-full flex justify-between items-center p-2.5 rounded-lg border transition-all active:scale-[0.98] ${prefPets ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.05)]' : 'bg-gray-800/50 border-white/5 hover:bg-gray-800 text-gray-300'}`}>
                <span className="font-medium text-xs flex items-center gap-2"><span className="text-base">🐾</span> Пътуване с животно</span>
                {prefPets && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_6px_rgba(59,130,246,0.8)]" />}
              </button>
              <button onClick={() => setPrefLuggage(!prefLuggage)} className={`w-full flex justify-between items-center p-2.5 rounded-lg border transition-all active:scale-[0.98] ${prefLuggage ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.05)]' : 'bg-gray-800/50 border-white/5 hover:bg-gray-800 text-gray-300'}`}>
                <span className="font-medium text-xs flex items-center gap-2"><span className="text-base">🧳</span> Комби / Багаж</span>
                {prefLuggage && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_6px_rgba(59,130,246,0.8)]" />}
              </button>
              <button onClick={() => setPrefLanguage(!prefLanguage)} className={`w-full flex justify-between items-center p-2.5 rounded-lg border transition-all active:scale-[0.98] ${prefLanguage ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.05)]' : 'bg-gray-800/50 border-white/5 hover:bg-gray-800 text-gray-300'}`}>
                <span className="font-medium text-xs flex items-center gap-2"><span className="text-base">🗣️</span> Чужд език</span>
                {prefLanguage && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_6px_rgba(59,130,246,0.8)]" />}
              </button>
              <button onClick={() => setPrefInvoice(!prefInvoice)} className={`w-full flex justify-between items-center p-2.5 rounded-lg border transition-all active:scale-[0.98] ${prefInvoice ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.05)]' : 'bg-gray-800/50 border-white/5 hover:bg-gray-800 text-gray-300'}`}>
                <span className="font-medium text-xs flex items-center gap-2"><span className="text-base">🧾</span> Фактура</span>
                {prefInvoice && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_6px_rgba(59,130,246,0.8)]" />}
              </button>
            </div>
            <button onClick={() => setShowSettingsModal(false)} className="w-full mt-3 bg-white text-black font-bold text-sm py-2.5 rounded-lg hover:bg-gray-200 transition-all active:scale-[0.98] shadow-[0_0_15px_rgba(255,255,255,0.05)]">
              Готово
            </button>
          </div>
        </div>
      )}

      {/* Payment Method Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowPaymentModal(false)}
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold tracking-tight">Начин на плащане</h2>
              <button onClick={() => setShowPaymentModal(false)} className="p-1 bg-gray-800/80 rounded-full hover:bg-gray-700 transition-colors active:scale-95">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <button 
                onClick={() => {
                  setPaymentMethod('cash');
                  setShowPaymentModal(false);
                }}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all active:scale-[0.98] ${
                  paymentMethod === 'cash' 
                    ? 'bg-blue-600/10 border-blue-500/50' 
                    : 'bg-gray-900/50 border-white/5 hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    paymentMethod === 'cash' ? 'bg-blue-500/20' : 'bg-gray-800'
                  }`}>
                    <Banknote className={`w-6 h-6 ${paymentMethod === 'cash' ? 'text-blue-400' : 'text-gray-400'}`} />
                  </div>
                  <div className="text-left">
                    <p className={`font-bold text-base ${paymentMethod === 'cash' ? 'text-white' : 'text-gray-300'}`}>В брой</p>
                    <p className="text-xs text-gray-500">Плащане директно на шофьора</p>
                  </div>
                </div>
                {paymentMethod === 'cash' && <Check className="w-6 h-6 text-blue-400" />}
              </button>

              <button 
                onClick={() => {
                  setPaymentMethod('terminal');
                  setShowPaymentModal(false);
                }}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all active:scale-[0.98] ${
                  paymentMethod === 'terminal' 
                    ? 'bg-blue-600/10 border-blue-500/50' 
                    : 'bg-gray-900/50 border-white/5 hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    paymentMethod === 'terminal' ? 'bg-blue-500/20' : 'bg-gray-800'
                  }`}>
                    <CreditCard className={`w-6 h-6 ${paymentMethod === 'terminal' ? 'text-blue-400' : 'text-gray-400'}`} />
                  </div>
                  <div className="text-left">
                    <p className={`font-bold text-base ${paymentMethod === 'terminal' ? 'text-white' : 'text-gray-300'}`}>ПОС терминал</p>
                    <p className="text-xs text-gray-500">Търсене на кола с терминал</p>
                  </div>
                </div>
                {paymentMethod === 'terminal' && <Check className="w-6 h-6 text-blue-400" />}
              </button>
            </div>

            <p className="mt-6 text-[10px] text-gray-500 text-center px-4">
              При избор на ПОС терминал, времето за изчакване може да се увеличи поради по-малък брой налични автомобили с това оборудване.
            </p>
          </motion.div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
