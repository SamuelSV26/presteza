"use client";
import React from "react";

interface LabelProps {
  text: string;
  htmlFor?: string;
}

const Label: React.FC<LabelProps> = ({ text, htmlFor }) => {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-gray-700 font-semibold mb-1"
    >
      {text}
    </label>
  );
};

export default Label;
