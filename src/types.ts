export type Location = {
  lat: number;
  lng: number;
  address?: string;
};

export type RideState =
  | 'IDLE'
  | 'SELECTING_DESTINATION'
  | 'SEARCHING_ADDRESS'
  | 'SELECTING_ON_MAP'
  | 'CONFIRMING'
  | 'SEARCHING_DRIVER'
  | 'DRIVER_EN_ROUTE'
  | 'RIDING'
  | 'ARRIVED';

export type DriverState = 
  | 'OFFLINE'
  | 'ONLINE'
  | 'BUSY'
  | 'ON_RIDE';

export type RideRequest = {
  rideId: string;
  passengerUid: string;
  passengerName: string;
  passengerRating: number;
  pickup: Location;
  destination: Location;
  price: number;
  rideOption: string;
};

export type RideOption = {
  id: string;
  name: string;
  price: number;
  eta: number; // minutes
  capacity: number;
  image: string;
  description?: string;
};

export type PaymentMethod = {
  id: string;
  type: 'card' | 'cash';
  last4?: string;
  brand?: string;
  isDefault: boolean;
};

export type SavedLocation = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  icon: 'home' | 'work' | 'other';
  isFavorite?: boolean;
};

export type RideHistoryItem = {
  id: string;
  date: string;
  time: string;
  destination: string;
  price: number;
};

export type UserProfile = {
  name: string;
  email: string;
  phone: string;
  rating: number;
  rideHistory?: RideHistoryItem[];
};

export type Driver = {
  id: string;
  name: string;
  photo: string;
  rating: number;
  carModel: string;
  carPlate: string;
  carColor?: string;
  carYear?: number;
  preferences?: {
    nonSmoking: boolean;
    pets: boolean;
    luggage: boolean;
  };
};

export type RideReview = {
  driverId: string;
  rating: number;
  feedback: string;
  date: string;
};
