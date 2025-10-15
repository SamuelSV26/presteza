"use client";
import Image from "next/image";

export default function Logo() {
  return (
    <div className="flex items-center gap-2 cursor-pointer">
      <Image
        src="/logo.svg"
        alt="Logo"
        width={32}
        height={32}
        priority
      />
      <span className="font-bold text-lg text-blue-600">MiTienda</span>
    </div>
  );
}
