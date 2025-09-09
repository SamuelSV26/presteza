// /pages/index.tsx
import React from 'react';
import HomeTemplate from '../components/templates/HomeTemplate';

const Index: React.FC = () => {
  return (
    <HomeTemplate>
      <h1>Bienvenido a nuestro Restaurante</h1>
      <p>Explora nuestro menú y realiza tu reserva en línea.</p>
    </HomeTemplate>
  );
};

export default Index;
