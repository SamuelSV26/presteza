// app/page.tsx
import Header from "@/components/organisms/Header";
import HomeTemplate from "@/components/templates/HomeTemplate"; // Importa el template

export default function Home() {
  return (
    <main className="bg-white">
      {/* Header */}
      <Header />

      {/* Home Template con el contenido de la página */}
      <HomeTemplate />
    </main>
  );
}
