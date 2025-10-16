"use client";
import React from "react";

interface MenuTitleProps {
  text: string;
}

export default function MenuTitle({ text }: MenuTitleProps) {
  return (
    <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
      {text}
    </h2>
  );
}
