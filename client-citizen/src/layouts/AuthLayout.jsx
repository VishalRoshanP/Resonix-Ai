import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl flex items-center justify-center animate-slide-up">
        <Outlet />
      </div>
    </div>
  );
}
