import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

export function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
