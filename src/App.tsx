import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import MainLayout from '@/components/Layout/MainLayout';

const Dashboard = lazy(() => import('@/components/Dashboard/Dashboard'));
const ServerDetail = lazy(() => import('@/components/ServerDetail/ServerDetail').then(m => ({ default: m.ServerDetail })));
const IssueList = lazy(() => import('@/components/IssueTracker/IssueList').then(m => ({ default: m.IssueList })));
const IssueDetail = lazy(() => import('@/components/IssueTracker/IssueDetail').then(m => ({ default: m.IssueDetail })));
const NetworkProfiles = lazy(() => import('@/components/NetworkProfiles/NetworkProfiles'));
const FleetManagement = lazy(() => import('@/components/FleetManagement/FleetManagement'));
const Settings = lazy(() => import('@/components/Settings/Settings'));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />
        <span className="text-[#94A3B8] text-sm tracking-wide">LOADING</span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <div className="scanline" />
      <Routes>
        <Route element={<MainLayout />}>
          <Route
            path="/"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <Dashboard />
              </Suspense>
            }
          />
          <Route
            path="/server/:id"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <ServerDetail />
              </Suspense>
            }
          />
          <Route
            path="/issues"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <IssueList />
              </Suspense>
            }
          />
          <Route
            path="/issues/:id"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <IssueDetail />
              </Suspense>
            }
          />
          <Route
            path="/profiles"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <NetworkProfiles />
              </Suspense>
            }
          />
          <Route
            path="/fleet"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <FleetManagement />
              </Suspense>
            }
          />
          <Route
            path="/settings"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <Settings />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </>
  );
}
