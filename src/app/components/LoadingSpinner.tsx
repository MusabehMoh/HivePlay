export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-spotify-dark-elevated border-t-spotify-green rounded-full animate-spin-slow" />
    </div>
  );
}