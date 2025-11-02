import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-nosotros',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nosotros.component.html',
  styleUrls: ['./nosotros.component.css']
})
export class NosotrosComponent {
  team = [
    {
      name: 'Gustavo',
      role: 'Fundador & Chef',
      description: 'Apasionado por la gastronomía y comprometido con la excelencia culinaria',
      image: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Gustavo&backgroundColor=b6e3f4,c0aede,d1d4f9'
    },
    {
      name: 'Angela',
      role: 'Fundadora & Directora',
      description: 'Dedicada a crear experiencias únicas para nuestros comensales',
      image: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Angela&backgroundColor=ffd5dc,ffdfbf'
    }
  ];

  values = [
    {
      icon: 'bi-shield-check',
      title: 'Calidad Premium',
      description: 'Cada ingrediente es cuidadosamente seleccionado para garantizar la mejor experiencia gastronómica'
    },
    {
      icon: 'bi-heart-fill',
      title: 'Pasión',
      description: 'Nuestro amor por la comida se refleja en cada plato que servimos'
    },
    {
      icon: 'bi-people-fill',
      title: 'Tradición Familiar',
      description: 'Recetas heredadas de generación en generación, adaptadas con un toque moderno'
    },
    {
      icon: 'bi-trophy-fill',
      title: 'Excelencia',
      description: 'Comprometidos con brindar la mejor experiencia en cada visita'
    }
  ];

  history = {
    title: 'Nuestra Historia',
    content: 'Presteza nació de la pasión por crear experiencias gastronómicas únicas. Desde nuestros inicios, nos hemos enfocado en ofrecer productos de la más alta calidad, preparados con ingredientes frescos y técnicas culinarias refinadas. Cada plato cuenta una historia, cada sabor despierta emociones. Somos más que un restaurante, somos un lugar donde los momentos especiales cobran vida.',
    year: '2020',
    milestone: 'Iniciamos con el sueño de compartir nuestra pasión por la gastronomía'
  };
}
