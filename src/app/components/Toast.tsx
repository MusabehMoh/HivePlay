import { useEffect } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaTimes } from 'react-icons/fa';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div 
      className={`animate-slide-up flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg
        ${type === 'success' ? 'bg-spotify-green/90' : 'bg-red-500/90'}
        backdrop-blur-md`}
    >
      {type === 'success' ? (
        <FaCheckCircle className="flex-shrink-0 w-5 h-5" />
      ) : (
        <FaExclamationCircle className="flex-shrink-0 w-5 h-5" />
      )}
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="p-1 -mr-1 rounded-full hover:bg-black/20 transition-colors"
      >
        <FaTimes className="w-4 h-4" />
      </button>
    </div>
  );
}