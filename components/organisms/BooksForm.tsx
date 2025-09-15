// /components/organisms/ReservasForm.tsx
import React, { useState } from 'react';
import FormField from '../molecules/FormField';
import Button from '../atoms/Button';

const ReservasForm: React.FC = () => {
  const [form, setForm] = useState({
    fecha: '',
    hora: '',
    personas: '',
    preferencias: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log(form);
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField label="Fecha" type="date" name="fecha" value={form.fecha} onChange={handleChange} />
      <FormField label="Hora" type="time" name="hora" value={form.hora} onChange={handleChange} />
      <FormField label="Número de personas" type="number" name="personas" value={form.personas} onChange={handleChange} />
      <FormField label="Preferencias especiales" type="text" name="preferencias" value={form.preferencias} onChange={handleChange} />
      <Button label="Reservar" />
    </form>
  );
};

export default ReservasForm;