import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Navigation, User, Star, Check, X, LogOut, Power, Bell, Map as MapIcon, ChevronRight } from 'lucide-react';
import { Location, RideRequest, DriverState } from '../types';

interface DriverDashboardProps {
  isOnline: boolean;
  onToggleOnline: () => void;
  pendingRequests: RideRequest[];
  onAcceptRide: (request: RideRequest) => void;
  onDeclineRide: (rideId: string) => void;
  activeRide: RideRequest | null;
  onCompleteRide: () => void;
  driverLocation: Location | null;
}

export default function DriverDashboard({
  isOnline,
  onToggleOnline,
  pendingRequests,
  onAcceptRide,
  onDeclineRide,
  activeRide,
  onCompleteRide,
  driverLocation
}: DriverDashboardProps) {
  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white font-sans">
      {/* Header */}
      <div className="p-6 pt-12 flex justify-between items-center border-b border-white/10 bg-zinc-900/50 backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Шофьорски панел</h1>
          <p className="text-xs text-zinc-400 uppercase tracking-widest mt-1">
            {isOnline ? 'В мрежата' : 'Извън мрежата'}
          </p>
        </div>
        <button
          onClick={onToggleOnline}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
            isOnline 
              ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]' 
              : 'bg-zinc-800 text-zinc-500'
          }`}
        >
          <Power size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeRide ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900 rounded-3xl p-6 border border-emerald-500/30 shadow-xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center border border-white/10">
                  <User size={24} className="text-zinc-400" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{activeRide.passengerName}</h3>
                  <div className="flex items-center gap-1 text-amber-400 text-sm">
                    <Star size={14} fill="currentColor" />
                    <span>{activeRide.passengerRating}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Цена</p>
                <p className="text-xl font-black text-emerald-400">{activeRide.price.toFixed(2)} лв.</p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex gap-3">
                <div className="flex flex-col items-center py-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <div className="w-px flex-1 bg-zinc-800 my-1" />
                  <div className="w-2 h-2 rounded-full bg-zinc-500" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">От</p>
                    <p className="text-sm font-medium line-clamp-1">{activeRide.pickup.address || 'Текущо местоположение'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">До</p>
                    <p className="text-sm font-medium line-clamp-1">{activeRide.destination.address}</p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={onCompleteRide}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              <Check size={20} />
              Завърши пътуването
            </button>
          </motion.div>
        ) : (
          <>
            {!isOnline && (
              <div className="h-64 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-zinc-800 rounded-3xl">
                <Power size={48} className="text-zinc-800 mb-4" />
                <h3 className="text-zinc-400 font-medium">Влезте в мрежата, за да получавате поръчки</h3>
              </div>
            )}

            {isOnline && pendingRequests.length === 0 && (
              <div className="h-64 flex flex-col items-center justify-center text-center p-8">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
                  <div className="relative w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/30">
                    <Navigation size={32} className="text-emerald-500 animate-pulse" />
                  </div>
                </div>
                <h3 className="text-zinc-300 font-medium">Търсене на поръчки...</h3>
                <p className="text-xs text-zinc-500 mt-2">Изчакайте нова заявка в района</p>
              </div>
            )}

            {isOnline && pendingRequests.map((req) => (
              <motion.div
                key={req.rideId}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-zinc-900 rounded-3xl p-5 border border-white/5 shadow-lg"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                      <User size={20} className="text-zinc-500" />
                    </div>
                    <div>
                      <p className="font-bold">{req.passengerName}</p>
                      <div className="flex items-center gap-1 text-amber-400 text-[10px]">
                        <Star size={10} fill="currentColor" />
                        <span>{req.passengerRating}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    <span className="text-emerald-400 font-bold text-sm">{req.price.toFixed(2)} лв.</span>
                  </div>
                </div>

                <div className="space-y-3 mb-5">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <MapPin size={14} className="text-emerald-500" />
                    <p className="text-xs truncate">{req.pickup.address || 'Близо до вас'}</p>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Navigation size={14} className="text-zinc-500" />
                    <p className="text-xs truncate">{req.destination.address}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => onDeclineRide(req.rideId)}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold py-3 rounded-xl transition-all"
                  >
                    Откажи
                  </button>
                  <button
                    onClick={() => onAcceptRide(req)}
                    className="flex-[2] bg-white text-black hover:bg-zinc-200 font-bold py-3 rounded-xl transition-all shadow-lg"
                  >
                    Приеми
                  </button>
                </div>
              </motion.div>
            ))}
          </>
        )}
      </div>

      {/* Stats Footer */}
      <div className="p-6 border-t border-white/10 bg-zinc-900/80 backdrop-blur-md grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Днес</p>
          <p className="font-bold">42.50 лв.</p>
        </div>
        <div className="text-center border-x border-white/5">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Рейтинг</p>
          <div className="flex items-center justify-center gap-1">
            <Star size={12} fill="currentColor" className="text-amber-400" />
            <p className="font-bold">4.9</p>
          </div>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Курсове</p>
          <p className="font-bold">8</p>
        </div>
      </div>
    </div>
  );
}
