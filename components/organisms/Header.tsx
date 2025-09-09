// components/organisms/Header.tsx
import Link from "next/link";
import Image from "next/image";

const Header = () => {
  return (
    <header className="bg-[#2D1A1A] w-full py-8">
      <div className="max-w-7xl mx-auto px-8 flex items-center justify-between">
        {/* Logo */}
        <Link href="/">
          <Image
            src="/presteza-logo.svg" // Asegúrate de tener tu logo en la carpeta public/
            alt="Presteza Logo"
            width={200}
            height={50}
            priority
          />
        </Link>

        {/* Menú de navegación */}
        <nav>
          <ul className="flex space-x-8 text-lg">
            <li>
              <Link href="/" className="text-white hover:text-[#F4F4F4]">
                Inicio
              </Link>
            </li>
            <li>
              <Link href="/menu" className="text-white hover:text-[#F4F4F4]">
                Menú
              </Link>
            </li>
            <li>
              <Link href="/reservas" className="text-white hover:text-[#F4F4F4]">
                Reservas
              </Link>
            </li>
            <li>
              <Link href="/domicilios" className="text-white hover:text-[#F4F4F4]">
                Domicilios
              </Link>
            </li>
            <li>
              <Link href="/ubicacion" className="text-white hover:text-[#F4F4F4]">
                Ubicación
              </Link>
            </li>
            <li>
              <Link href="/contacto" className="text-white hover:text-[#F4F4F4]">
                Contacto
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
