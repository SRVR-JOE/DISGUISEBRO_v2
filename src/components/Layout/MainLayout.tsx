import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function MainLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0A0E17]">
      {/* Sidebar */}
      <Sidebar />

      {/* Main area (offset by sidebar width) */}
      <div className="flex flex-col flex-1 ml-16">
        {/* Header */}
        <Header />

        {/* Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
