"use client";
import React from "react";
import MenuTitle from "../atoms/MenuTitle";
import MenuItemCard from "../molecules/MenuItemCard";

export default function MenuSection() {
  const items = [
    {
      name: "Hamburguesa Clásica",
      price: 22.99,
      image:
        "https://cdn.pixabay.com/photo/2014/10/23/18/05/burger-500054_1280.jpg",
      description: "Jugosa carne con lechuga, tomate y pan artesanal.",
    },
    {
      name: "Pizza Margarita",
      price: 28.5,
      image:
        "https://cdn.pixabay.com/photo/2017/12/09/08/18/pizza-3007395_1280.jpg",
      description: "Deliciosa pizza con queso mozzarella y albahaca fresca.",
    },
    {
      name: "Pasta Alfredo",
      price: 24.0,
      image:
        "https://cdn.pixabay.com/photo/2016/06/02/17/44/spaghetti-1432842_1280.jpg",
      description: "Pasta cremosa con salsa Alfredo y toque de ajo.",
    },
  ];

  return (
    <section className="py-12 px-6 bg-gray-50">
      <MenuTitle text="Menú del Día 🍽️" />
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 justify-items-center">
        {items.map((item) => (
          <MenuItemCard key={item.name} {...item} />
        ))}
      </div>
    </section>
  );
}
