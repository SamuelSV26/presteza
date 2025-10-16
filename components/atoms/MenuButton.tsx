"use client";
import React from "react";

interface MenuButtonProps {
  text: string;
  onClick?: () => void;
}

export default function MenuButton({ text, onClick }: MenuButtonProps) {
  return (
    <button
      onClick={onClick}
      className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
    >
      {text}
    </button>
  );
}
