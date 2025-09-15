// /components/molecules/FormField.tsx
import React from 'react';
import Label from '../atoms/Label';
import Input from '../atoms/Input';

interface FormFieldProps {
  label: string;
  type: string;
  name: string;
  value: string | number;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
}

const FormField: React.FC<FormFieldProps> = ({ label, type, name, value, onChange, placeholder }) => {
  return (
    <div className="mb-4">
      <Label text={label} />
      <Input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
};

export default FormField;