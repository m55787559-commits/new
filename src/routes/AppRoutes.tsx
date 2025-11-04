
import { Routes, Route, Outlet } from 'react-router-dom'
import Home from '../pages/Home'
import Login from '../pages/Login'
import AuthCallback from '../pages/AuthCallback'
import AddPlace from '../pages/AddPlace'
import EditPlace from '../pages/EditPlace'
import AddService from '../pages/AddService'
import PlaceDetails from '../pages/PlaceDetails'
import ServiceDetails from '../pages/ServiceDetails'
import Offers from '../pages/Offers'
import Favorites from '../pages/Favorites'
import Profile from '../pages/Profile'
import Navbar from '../components/Navbar'
import AdminDashboard from '../pages/admin/AdminDashboard'
import AdminProviders from '../pages/admin/AdminProviders'
import AdminPackages from '../pages/admin/AdminPackages'
import AdminRoute from './AdminRoute'
import PackagesPage from '../pages/Packages'
import AdminAccounts from '../pages/admin/AdminAccounts'
import UserProfile from '../pages/admin/UserProfile'
import DatabaseChecker from '../pages/admin/DatabaseChecker'
import AdminSubscriptions from '../pages/admin/AdminSubscriptions'
import AdminPaymentSettings from '../pages/admin/AdminPaymentSettings'

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/add-place" element={<AddPlace />} />
        <Route path="/edit-place/:id" element={<EditPlace />} />
        <Route path="/add-service" element={<AddService />} />
        <Route path="/place/:id" element={<PlaceDetails />} />
        <Route path="/service/:id" element={<ServiceDetails />} />
        <Route path="/offers" element={<Offers />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/providers" element={<AdminRoute><AdminProviders /></AdminRoute>} />
        <Route path="/admin/packages" element={<AdminRoute><AdminPackages /></AdminRoute>} />
        <Route path="/admin/accounts" element={<AdminRoute><AdminAccounts /></AdminRoute>} />
        <Route path="/admin/subscriptions" element={<AdminRoute><AdminSubscriptions /></AdminRoute>} />
        <Route path="/admin/payment-settings" element={<AdminRoute><AdminPaymentSettings /></AdminRoute>} />
        <Route path="/admin/user/:id" element={<AdminRoute><UserProfile /></AdminRoute>} />
        <Route path="/admin/database-checker" element={<AdminRoute><DatabaseChecker /></AdminRoute>} />
        <Route path="/packages" element={<PackagesPage />} />
        <Route path="/places" element={<Home />} />
        <Route path="/services" element={<Home />} />
        <Route path="/ads" element={<Home />} />
        <Route path="*" element={<Home />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
    </Routes>
  )
}

function Layout() {
  return (
    <div>
      <Navbar />
      <div style={{ paddingTop: 8 }}>
        <Outlet />
      </div>
    </div>
  )
}
