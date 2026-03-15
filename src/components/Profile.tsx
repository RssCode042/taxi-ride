import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, User, CreditCard, MapPin, Home, Briefcase, Plus, Star, HelpCircle, Mail, Phone, ChevronRight, ChevronDown, ChevronUp, Navigation, Clock, Filter, Calendar, Search, X } from 'lucide-react';
import { UserProfile, PaymentMethod, SavedLocation } from '../types';

const monthsBG: { [key: string]: number } = {
  'Яну': 0, 'Фев': 1, 'Мар': 2, 'Апр': 3, 'Май': 4, 'Юни': 5,
  'Юли': 6, 'Авг': 7, 'Сеп': 8, 'Окт': 9, 'Ное': 10, 'Дек': 11
};

const parseBGDate = (dateStr: string) => {
  const parts = dateStr.split(' ');
  if (parts.length !== 3) return new Date(0);
  const day = parseInt(parts[0]);
  const month = monthsBG[parts[1]] || 0;
  const year = parseInt(parts[2]);
  return new Date(year, month, day);
};

interface ProfileProps {
  onClose: () => void;
  profile: UserProfile;
  paymentMethods: PaymentMethod[];
  savedLocations: SavedLocation[];
  onClearSavedLocations: () => void;
  onSetDestination: (location: SavedLocation) => void;
  onToggleFavorite: (location: SavedLocation) => void;
  appMode: 'passenger' | 'driver';
  onSwitchMode: (mode: 'passenger' | 'driver') => void;
}

export default function Profile({ onClose, profile, paymentMethods, savedLocations, onClearSavedLocations, onSetDestination, onToggleFavorite, appMode, onSwitchMode }: ProfileProps) {
  const [view, setView] = useState<'main' | 'support' | 'history'>('main');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // History Filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterDestination, setFilterDestination] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filteredHistory = useMemo(() => {
    return (profile.rideHistory || []).filter(ride => {
      const rideDate = parseBGDate(ride.date);
      
      if (filterStartDate) {
        const start = new Date(filterStartDate);
        start.setHours(0, 0, 0, 0);
        if (rideDate < start) return false;
      }
      
      if (filterEndDate) {
        const end = new Date(filterEndDate);
        end.setHours(23, 59, 59, 999);
        if (rideDate > end) return false;
      }
      
      if (filterDestination) {
        if (!ride.destination.toLowerCase().includes(filterDestination.toLowerCase())) return false;
      }
      
      return true;
    });
  }, [profile.rideHistory, filterStartDate, filterEndDate, filterDestination]);

  const clearFilters = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterDestination('');
  };

  const faqs = [
    {
      question: 'Как да променя метода си на плащане?',
      answer: 'Можете да добавите или премахнете метод на плащане от секция "Плащане" във вашия профил. За да промените основния метод, просто изберете желания от списъка.'
    },
    {
      question: 'Какво да направя, ако си забравя багажа?',
      answer: 'Свържете се с нашия център за обслужване на клиенти възможно най-скоро чрез бутона "Обадете ни се" по-долу. Ние ще се свържем с шофьора, за да проверим за забравени вещи.'
    },
    {
      question: 'Как се изчислява цената на пътуването?',
      answer: 'Цената се изчислява на база начална такса, изминато разстояние и време на пътуване. При повишено търсене може да има динамично ценообразуване.'
    }
  ];

  if (view === 'history') {
    return (
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-[2000] bg-black text-white flex flex-col font-sans"
      >
        {/* Header */}
        <div className="bg-gray-900/80 backdrop-blur-xl px-3 py-3 flex items-center justify-between shadow-sm shrink-0 border-b border-white/10 sticky top-0 z-10">
          <div className="flex items-center">
            <button onClick={() => { setView('main'); clearFilters(); setShowFilters(false); }} className="p-1.5 -ml-1.5 hover:bg-gray-800 rounded-full transition-all active:scale-95">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold ml-2 tracking-tight">История на пътуванията</h1>
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-xl transition-all active:scale-95 ${showFilters ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400'}`}
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-gray-900/50 border-b border-white/10 overflow-hidden"
            >
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" /> От дата
                    </label>
                    <input 
                      type="date" 
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="w-full bg-gray-800 border border-white/5 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" /> До дата
                    </label>
                    <input 
                      type="date" 
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="w-full bg-gray-800 border border-white/5 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Search className="w-3 h-3" /> Дестинация
                  </label>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Търси дестинация..."
                      value={filterDestination}
                      onChange={(e) => setFilterDestination(e.target.value)}
                      className="w-full bg-gray-800 border border-white/5 rounded-xl pl-9 pr-3 py-2.5 text-xs focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  </div>
                </div>
                {(filterStartDate || filterEndDate || filterDestination) && (
                  <button 
                    onClick={clearFilters}
                    className="w-full py-2 text-[10px] font-bold text-red-400 bg-red-500/10 rounded-lg border border-red-500/20 hover:bg-red-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                  >
                    <X className="w-3 h-3" /> Изчисти филтрите
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {filteredHistory.length > 0 ? (
            filteredHistory.map(ride => (
              <div key={ride.id} className="bg-gray-900/50 border border-white/5 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{ride.date}, {ride.time}</span>
                  </div>
                  <span className="font-bold text-white text-base">{ride.price.toFixed(2)} лв.</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gray-800/80 rounded-full flex items-center justify-center shrink-0 border border-white/5">
                    <MapPin className="w-4 h-4 text-gray-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-0.5">Дестинация</p>
                    <p className="font-medium text-white text-sm truncate">{ride.destination}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <Navigation className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm">
                {filterStartDate || filterEndDate || filterDestination 
                  ? 'Няма пътувания, отговарящи на филтрите.' 
                  : 'Нямате предишни пътувания.'}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  if (view === 'support') {
    return (
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-[2000] bg-black text-white flex flex-col font-sans"
      >
        {/* Header */}
        <div className="bg-gray-900/80 backdrop-blur-xl px-3 py-3 flex items-center shadow-sm shrink-0 border-b border-white/10 sticky top-0 z-10">
          <button onClick={() => setView('main')} className="p-1.5 -ml-1.5 hover:bg-gray-800 rounded-full transition-all active:scale-95">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold ml-2 tracking-tight">Помощ и поддръжка</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Contact Options */}
          <div className="bg-gray-900/50 border border-white/5 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="font-bold text-base mb-1">Свържете се с нас</h3>
            <button className="w-full flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-all active:scale-[0.98] border border-white/5">
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-white text-base">Обадете ни се</p>
                <p className="text-xs text-gray-400">24/7 поддръжка по телефон</p>
              </div>
            </button>
            <button className="w-full flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-all active:scale-[0.98] border border-white/5">
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-white text-base">Пишете ни</p>
                <p className="text-xs text-gray-400">support@taxiapp.bg</p>
              </div>
            </button>
          </div>

          {/* FAQs */}
          <div className="bg-gray-900/50 border border-white/5 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="font-bold text-base mb-1">Често задавани въпроси</h3>
            <div className="space-y-2">
              {faqs.map((faq, idx) => (
                <div key={idx} className="border border-white/5 rounded-xl overflow-hidden bg-gray-800/30">
                  <button 
                    onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-800/50 transition-colors text-left"
                  >
                    <span className="font-medium pr-3 text-sm">{faq.question}</span>
                    {expandedFaq === idx ? (
                      <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    )}
                  </button>
                  <AnimatePresence>
                    {expandedFaq === idx && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-3 pb-3 text-gray-400 text-xs leading-relaxed"
                      >
                        <div className="pt-2 border-t border-white/5">
                          {faq.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ x: '-100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[2000] bg-black text-white flex flex-col font-sans"
    >
      {/* Header */}
      <div className="bg-gray-900/80 backdrop-blur-xl px-3 py-3 flex items-center shadow-sm shrink-0 border-b border-white/10 sticky top-0 z-10">
        <button onClick={onClose} className="p-1.5 -ml-1.5 hover:bg-gray-800 rounded-full transition-all active:scale-95">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold ml-2 tracking-tight">Профил</h1>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* User Info */}
        <div className="bg-gray-900/50 rounded-2xl p-4 shadow-sm flex items-center gap-4 border border-white/5">
          <div className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center overflow-hidden shrink-0 border-2 border-white/10">
            <User className="w-7 h-7 text-gray-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold tracking-tight">{profile.name}</h2>
            <div className="flex items-center text-[10px] text-gray-400 mt-0.5 bg-gray-800/50 w-fit px-1.5 py-0.5 rounded-full border border-white/5">
              <Star className="w-3 h-3 text-yellow-400 fill-current mr-1" />
              <span className="font-medium text-gray-300">{profile.rating}</span>
            </div>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="bg-gray-900/50 rounded-2xl p-4 shadow-sm border border-white/5">
          <h3 className="font-bold text-base mb-3">Режим на работа</h3>
          <div className="flex bg-gray-800/50 p-1 rounded-xl border border-white/5">
            <button 
              onClick={() => onSwitchMode('passenger')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${appMode === 'passenger' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              Пътник
            </button>
            <button 
              onClick={() => onSwitchMode('driver')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${appMode === 'driver' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-gray-400 hover:text-white'}`}
            >
              Шофьор
            </button>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-gray-900/50 rounded-2xl p-4 shadow-sm space-y-3 border border-white/5">
          <h3 className="font-bold text-base mb-1">Лични данни</h3>
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <span className="text-gray-400 text-sm">Телефон</span>
            <span className="font-medium text-sm">{profile.phone}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Имейл</span>
            <span className="font-medium text-sm">{profile.email}</span>
          </div>
        </div>

        {/* Saved Locations */}
        <div className="bg-gray-900/50 rounded-2xl p-4 shadow-sm space-y-3 border border-white/5">
          <div className="flex justify-between items-center mb-1">
            <h3 className="font-bold text-base">Запазени места</h3>
            {savedLocations.length > 0 && (
              <button 
                onClick={onClearSavedLocations}
                className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium active:scale-95"
              >
                Изчисти всички
              </button>
            )}
          </div>
          {savedLocations.length === 0 && (
            <p className="text-gray-400 text-xs">Няма запазени места.</p>
          )}
          {savedLocations.map(loc => (
            <div key={loc.id} className="flex flex-col gap-2 border-b border-white/5 pb-4 last:border-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-800/80 rounded-full flex items-center justify-center shrink-0 border border-white/5">
                  {loc.icon === 'home' ? <Home className="w-5 h-5 text-gray-300" /> : 
                   loc.icon === 'work' ? <Briefcase className="w-5 h-5 text-gray-300" /> : 
                   <MapPin className="w-5 h-5 text-gray-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-base truncate flex items-center gap-1.5">
                    {loc.name}
                    {loc.isFavorite && <Star className="w-3 h-3 text-yellow-400 fill-current" />}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{loc.address}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pl-13">
                <button 
                  onClick={() => onSetDestination(loc)}
                  className="flex-1 bg-white text-black hover:bg-gray-200 text-[10px] font-bold py-2 px-2.5 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1 shadow-md"
                >
                  <Navigation className="w-3 h-3" />
                  Към дестинация
                </button>
                <button 
                  onClick={() => onToggleFavorite(loc)}
                  className={`flex-1 text-[10px] font-bold py-2 px-2.5 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1 border ${
                    loc.isFavorite 
                      ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20' 
                      : 'bg-gray-800/50 border-white/5 text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <Star className={`w-3 h-3 ${loc.isFavorite ? 'fill-current' : ''}`} />
                  {loc.isFavorite ? 'Премахни' : 'Любимо'}
                </button>
              </div>
            </div>
          ))}
          <button className="flex items-center gap-3 text-blue-400 font-medium pt-2 w-full hover:opacity-80 transition-opacity active:scale-[0.98] text-sm">
            <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center shrink-0 border border-blue-500/20">
              <Plus className="w-5 h-5" />
            </div>
            Добави ново място
          </button>
        </div>

        {/* Payment Methods */}
        <div className="bg-gray-900/50 rounded-2xl p-4 shadow-sm space-y-3 border border-white/5">
          <h3 className="font-bold text-base mb-1">Плащане</h3>
          {paymentMethods.map(pm => (
            <div key={pm.id} className="flex items-center gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0">
              <div className="w-10 h-10 bg-gray-800/80 rounded-full flex items-center justify-center shrink-0 border border-white/5">
                <CreditCard className="w-5 h-5 text-gray-300" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-white text-base">
                  {pm.type === 'cash' ? 'В брой' : `${pm.brand} •••• ${pm.last4}`}
                </p>
                {pm.isDefault && <p className="text-[9px] text-green-400 font-medium bg-green-500/10 w-fit px-1.5 py-0.5 rounded-full mt-0.5">Основен метод</p>}
              </div>
            </div>
          ))}
          <button className="flex items-center gap-3 text-blue-400 font-medium pt-2 w-full hover:opacity-80 transition-opacity active:scale-[0.98] text-sm">
            <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center shrink-0 border border-blue-500/20">
              <Plus className="w-5 h-5" />
            </div>
            Добави метод за плащане
          </button>
        </div>

        {/* Ride History */}
        {profile.rideHistory && profile.rideHistory.length > 0 && (
          <div className="bg-gray-900/50 rounded-2xl p-4 shadow-sm space-y-3 border border-white/5">
            <h3 className="font-bold text-base mb-1">История на пътуванията</h3>
            {profile.rideHistory.map(ride => (
              <div key={ride.id} className="flex flex-col gap-1.5 border-b border-white/5 pb-3 last:border-0 last:pb-0">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{ride.date}, {ride.time}</span>
                  </div>
                  <span className="font-bold text-white text-sm">{ride.price.toFixed(2)} лв.</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-gray-800/80 rounded-full flex items-center justify-center shrink-0 border border-white/5">
                    <MapPin className="w-3.5 h-3.5 text-gray-300" />
                  </div>
                  <p className="font-medium text-white text-sm truncate">{ride.destination}</p>
                </div>
              </div>
            ))}
            <button 
              onClick={() => setView('history')}
              className="flex items-center justify-center gap-1.5 text-blue-400 font-medium pt-2 w-full hover:opacity-80 transition-opacity active:scale-[0.98] text-sm"
            >
              Виж всички пътувания
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Help & Support Button */}
        <button 
          onClick={() => setView('support')}
          className="w-full bg-gray-900/50 rounded-2xl p-4 shadow-sm flex items-center gap-3 border border-white/5 hover:bg-gray-800/80 transition-all active:scale-[0.98]"
        >
          <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center shrink-0">
            <HelpCircle className="w-4 h-4 text-gray-300" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-bold text-base text-white">Помощ и поддръжка</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
        </button>
      </div>
    </motion.div>
  );
}
