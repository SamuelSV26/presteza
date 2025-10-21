import React from 'react';
import Label from '../atoms/Label';

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
      <input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder} className="border border-gray-300 rounded-md p-2 w-full" />
    </div>
  );
};

export default FormField;