import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, nivelExigido }) {
  const user = JSON.parse(localStorage.getItem('@Houzen:user'));

  // Se não estiver logado, volta para o login
  if (!user) {
    return <Navigate to="/" />;
  }

  // Se for uma rota de admin e o usuário não for admin, volta para o dashboard comum
  if (nivelExigido === 'admin' && user.nivel !== 'admin') {
    return <Navigate to="/dashboard" />;
  }

  return children;
}