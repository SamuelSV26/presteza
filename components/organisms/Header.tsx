import Link from "next/link";
import Image from "next/image";

const Header = () => {
  return (
    <header className="bg-[#2D1A1A] w-full py-8">
      <div className="max-w-7xl mx-auto px-8 flex items-center justify-between">
        {/* Logo */}
        <Link href="/">
          <Image
            src="https://thumbs.dreamstime.com/b/s%C3%ADmbolo-del-logotipo-restaurante-de-la-comida-con-gorra-chef-cuchillo-cocina-cruzado-e-icono-vector-horquilla-263741713.jpg"
            alt="Presteza Logo"
            width={75}
            height={75}
            priority
          />
        </Link>

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