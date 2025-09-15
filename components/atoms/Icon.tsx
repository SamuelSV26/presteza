import React from 'react';

interface InputProps {
  type: string;
  name: string;
  value: string | number;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  className?: string;
}

const Input: React.FC<InputProps> = ({ type, name, value, onChange, placeholder, className = '' }) => {
  return (
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`p-2 border rounded-md ${className}`}
    />
  );
};

export default Input;