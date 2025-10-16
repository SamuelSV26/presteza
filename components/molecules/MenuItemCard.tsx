"use client";
import Image from "next/image";
import MenuButton from "../atoms/MenuButton";

interface MenuItemProps {
  name: string;
  price: number;
  image: string;
  description: string;
}

export default function MenuItemCard({ name, price, image, description }: MenuItemProps) {
  return (
    <div className="border rounded-xl shadow-md p-4 flex flex-col items-center text-center hover:shadow-lg transition-all bg-white">
      <Image
        src={image}
        alt={name}
        width={200}
        height={150}
        className="rounded-lg mb-3 object-cover"
      />
      <h3 className="font-bold text-lg text-gray-800">{name}</h3>
      <p className="text-gray-500 text-sm mt-1 mb-2">{description}</p>
      <span className="text-yellow-600 font-semibold mb-3">${price.toFixed(2)}</span>
      <MenuButton text="Agregar al carrito" />
    </div>
  );
}
