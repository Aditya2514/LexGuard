import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const AdminRoute = () => {
  const token = localStorage.getItem('token');
  let isAdmin = false;

  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // The payload must contain the user role or the token allows fetching it.
      // If we don't have role in token, we have to trust it temporarily or 
      // rely on the API to return 403 on fetching metrics.
      // But let's assume the user object is in local storage too, or role is in token payload.
    } catch (e) {
      console.error('Invalid token payload');
    }
  }
  
  // It's safer to check localStorage for user role
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  isAdmin = user.role === 'admin';

  if (!token || !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default AdminRoute;
