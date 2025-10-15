import Image from "next/image";
import Header from "../organisms/Header";

const HomeTemplate = () => {
  return (
    <div className="bg-red-500">
      <Header />
      <section className="bg-[#f7f7f7] py-16">
        <div className="max-w-7xl mx-auto px-8 text-center">
          <h2 className="text-4xl font-bold mb-8">Disfruta de Nuestros Platos</h2>

          {/* Platos en Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            {/* Plato 1 */}
            <div className="bg-white shadow-lg rounded-lg overflow-hidden">
              <Image
                src="" // Asegúrate de tener la imagen en la carpeta public
                alt="Pizza Margarita"
                width={350}
                height={250}
                className="w-full h-56 object-cover"
              />
              <div className="p-4">
                <h3 className="text-xl font-semibold">Pizza Margarita</h3>
                <p className="text-lg text-gray-600">Tomate, queso mozzarella, albahaca fresca</p>
                <p className="text-xl font-bold mt-2">$12.99</p>
                <button className="mt-4 bg-[#8B1A1A] text-white py-2 px-4 rounded-full hover:bg-[#A42626] transition-colors">
                  Personalizar
                </button>
              </div>
            </div>

            {/* Plato 2 */}
            <div className="bg-white shadow-lg rounded-lg overflow-hidden">
              <Image
                src="" // Asegúrate de tener la imagen en la carpeta public
                alt="Pasta Italiana"
                width={350}
                height={250}
                className="w-full h-56 object-cover"
              />
              <div className="p-4">
                <h3 className="text-xl font-semibold">Pasta Italiana</h3>
                <p className="text-lg text-gray-600">Pasta fresca con salsa de tomate y albahaca</p>
                <p className="text-xl font-bold mt-2">$14.99</p>
                <button className="mt-4 bg-[#8B1A1A] text-white py-2 px-4 rounded-full hover:bg-[#A42626] transition-colors">
                  Personalizar
                </button>
              </div>
            </div>

            {/* Plato 3 */}
            <div className="bg-white shadow-lg rounded-lg overflow-hidden">
              <Image
                src="" // Asegúrate de tener la imagen en la carpeta public
                alt="Ensalada Fresca"
                width={350}
                height={250}
                className="w-full h-56 object-cover"
              />
              <div className="p-4">
                <h3 className="text-xl font-semibold">Ensalada Fresca</h3>
                <p className="text-lg text-gray-600">Lechuga, tomate, pepino, zanahoria y vinagreta</p>
                <p className="text-xl font-bold mt-2">$8.99</p>
                <button className="mt-4 bg-[#8B1A1A] text-white py-2 px-4 rounded-full hover:bg-[#A42626] transition-colors">
                  Personalizar
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomeTemplate;