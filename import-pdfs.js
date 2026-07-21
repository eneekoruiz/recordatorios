import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

const pdfData = {
  Mensual: [
    "[S] Limpiar lavabo, grifos, ducha e inodoro.",
    "[D] Recoger ropa y objetos sueltos / llevar la ropa sucia al cesto.",
    "[S] Barrer el balcón y retirar hojas o suciedad.",
    "[D] Ventilar la habitación (abrir ventana 10 min).",
    "⚠ [M] Cambiar ambientador o recarga.",
    "[S] Pasar el polvo por superficies (de arriba a abajo).\nTodo lo semanal +\narmario por dentro\nArriba de la tele\nBaldas",
    "[S] Aspirar toda la habitación a fondo.",
    "[S] Fregar el suelo.",
    "[S] Aspirar y fregar suelo.",
    "[S] Limpiar espejos de entrada.",
    "[M] Pasar aspiradora detrás de muebles accesibles.",
    "[M] Limpiar puerta de entrada por dentro.",
    "[D] Fregar platos o meter en lavavajillas.",
    "[S] Limpiar microondas por dentro y fuera.",
    "[S] Pasar trapo por tiradores y frentes accesibles.",
    "[S] Limpiar fregadero y grifo a fondo.",
    "⚠ [S] Limpiar silicona del escurreplatos.",
    "[M] Limpiar horno a fondo.",
    "[M] Limpiar campana extractora y filtros.",
    "[M] Aspirar el colchón y la base del canapé.",
    "[M] Girar el colchón.",
    "[D] Hacer la cama / acomodar la cama.",
    "⚠ [S] Cambiar la ropa de cama.",
    "[M] Revisar y limpiar neceseres, mochilas y bolsas.",
    "[D] Pasar agua rápida al lavabo si está sucio.",
    "⚠ [S] Vaciar y enjuagar portacepillos.",
    "⚠ [S] Limpiar bandejitas y jaboneras.",
    "[M] Limpiar juntas y baldosas visibles.",
    "[M] Limpiar rejilla y tapón del desagüe.",
    "[M] Limpiar rebosadero del lavabo.",
    "⚠ [M] Vaciar los anti-humedades.",
    "[M] Limpiar barandilla y muebles a fondo.",
    "[D] Recoger cosas fuera de sitio (salón, pasillo, entrada).",
    "Quitar telarañas"
  ],
  "Propósitos Anuales": [
    "2020",
    "mantener a las personas que se lo merecen en mi vida CASI CASI",
    "valorarme, que soy la polla HECHO",
    "cambiar mis reacciones a la hora de enfadarme FIFTY FIFTY",
    "enamorarme, pero que sea diferente NADA",
    "intentar dejar de darle mil vueltas a todo HECHO CASI CASI",
    "no desearle el mal a nadie, ni cuando me enfade NO HE AVANZADO",
    "valorar lo que tengo HE AVANZADO",
    "hacerlo HE AVANZADO",
    "Terminarlo y mantenerlo BUENO",
    "saber soltar algo o a alguien FIFTY",
    "olvidarte LO HICE",
    "2021",
    "Sacar lo mejor de mi",
    "Valorar más",
    "Enamorarme, pero que sea diferente",
    "Estar más con mi familia",
    "Callar más",
    "Saber soltar totalmente a las personal",
    "Fumar muchísimo menos porfavor",
    "No utilizar las palabras en vano, cumplir lo que digo",
    "2022",
    "Terminarlo y mantenerlo 🤣",
    "2023",
    "Tener más paciencia",
    "Terminar TODO lo pendiente. TO DO.",
    "80? 85? No se tu veras pero dale porfi, esa definición que querías",
    "Ser constante",
    "Seguir así",
    "Aprender cual es tu manera propia de dejar ir",
    "2024",
    "2025",
    "2026",
    "Aprender a andar recto",
    "No tener “cosas que hacer”",
    "Fumar menos",
    "Volver al gym",
    "Formar una relación más sana con la comida",
    "Sentirme completo",
    "Sentir que soy capaz",
    "Sentir que soy importante para alguien o que hago una contribución grande a algo",
    "Entiendo que las cosas que me pasan tengo yo influencia"
  ],
  Series: [
    "Cómo defender a un asesino",
    "Una serie de catastróficas desdichas",
    "Érase una vez",
    "Los protegidos",
    "Call my agent",
    "Vedex",
    "Succes",
    "Titanes",
    "Single parents",
    "19-2",
    "Roswell",
    "New Mexico",
    "Clase Letal",
    "El embarcadero",
    "Matadero",
    "skam",
    "True Detective",
    "Derry Girls",
    "Legends of Tomorrow",
    "Young Justice",
    "Mr. Inbetween",
    "Día a día",
    "La otra mirada",
    "Sorry For Your Loss",
    "The Looming Tower",
    "Stranger Things",
    "The Crown",
    "Los originales",
    "Mommy be mine",
    "The blacklist",
    "The Witcher"
  ],
  Semanal: [
    "[D] Fregar platos o meter en lavavajillas.",
    "[D] Pasar un agua rápida al fregadero y secarlo.",
    "[S] Limpiar fregadero y grifo a fondo.",
    "[D] Ventilar la habitación (abrir ventana 10 min).",
    "[D] Si hay, llevar la ropa sucia al cesto.",
    "[S] Poner una lavadora",
    "[S] Limpiar microondas por dentro y fuera.",
    "[D] Pasar agua rápida al lavabo si está sucio.",
    "[S] Limpiar lavabo y grifos a fondo.",
    "[M] Pasar un paño por armarios y tiradores.",
    "[S] Limpiar inodoro por dentro y fuera.",
    "[S] Limpiar ducha/bañera.",
    "⚠ [S] Limpiar/desinfectar cepillo de dientes.\nPorta cepillos también si aplica",
    "⚠ [S] Limpiar bandejitas y jaboneras.",
    "[S] Limpiar toalleros.",
    "[S] Limpiar espejos de entrada.",
    "[S] Pasar trapo por zapatero y estantes.",
    "[S] Aspirar y fregar suelo",
    "[S] Pasar trapo por tiradores y frentes accesibles.",
    "[S] Pasar el polvo por superficies (de arriba a abajo).\nArriba de las puertas\nDobleces de las ventanas\nEnchufes e interruptores",
    "[S] Barrer el balcón y retirar hojas o suciedad.",
    "[S] Limpiar barandilla y muebles superficiales.",
    "[D] Recoger objetos sueltos",
    "⚠ [S] Cambiar la ropa de cama.",
    "[D] Hacer la cama",
    "[S] Vaciar papeleras pequeñas.",
    "⚠ [S] Limpiar zapatillas del zapatero.",
    "⚠ [M] Limpiar pre-filtro del purificador de aire.",
    "[D] Revisar encimera y mesa y recoger migas o salpicaduras.",
    "⚠ [S] Limpiar silicona del escurreplatos y utensilios de silicona.",
    "[S] Cambiar bayeta/valleta si está sucia.",
    "⚠ [S] Vaciar los anti-humedades si corresponde.",
    "[D] Pasar agua rápida al lavabo si está sucio."
  ],
  Diaria: [
    "[D] Ventilar (abrir ventana 10 min).",
    "[D] Pasar agua rápida al lavabo si está sucio.",
    "[D] Revisar espejo y grifo (pasar trapo rápido si hay manchas).",
    "[D] Dejar toallas bien colgadas.",
    "[D] Acomodar los productos del lavabo o ducha.",
    "[D] Fregar platos o meter en lavavajillas.",
    "[D] Pasar un agua rápida al fregadero y secarlo.",
    "[D] Revisar encimera y mesa y recoger migas o salpicaduras.",
    "[D] Pasar trapo rápido por la vitro con producto",
    "[D] Vaciar papeleras si están llenas.",
    "[D] Hacer la cama",
    "[D] Poner la ropa sucia en el cesto.",
    "[D] Dejar el escritorio y mesillas despejadas.",
    "[D] Dejar toallas o bata bien colgadas.",
    "[D] Recoger cosas fuera de sitio (salón, pasillo, entrada).",
    "[D] Aspirar la casa"
  ]
};

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'eneekoruiz@gmail.com' }
  });
  if (!user) throw new Error("User not found");

  const colors = {
    "Mensual": "#ff9500",
    "Propósitos Anuales": "#ff2d55",
    "Series": "#5856d6",
    "Semanal": "#ffcc00",
    "Diaria": "#34c759"
  };

  let importedCount = 0;

  for (const [listName, items] of Object.entries(pdfData)) {
    const listId = listName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    // Create the list
    await prisma.task.upsert({
      where: { id: listId },
      update: {},
      create: {
        id: listId,
        userId: user.id,
        payload: {
          id: listId,
          type: 'list',
          name: listName,
          color: colors[listName],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          _is_dirty: true
        }
      }
    });
    
    for (const itemText of items) {
      let title = itemText.split('\n')[0];
      const notes = itemText.includes('\n') ? itemText.substring(itemText.indexOf('\n') + 1) : undefined;
      
      let cycle_id = undefined;
      if (title.includes('[D]')) cycle_id = 'cycle_day';
      if (title.includes('[S]')) cycle_id = 'cycle_week';
      if (title.includes('[M]')) cycle_id = 'cycle_month';
      
      // Clean title
      title = title.replace(/\[[DSM]\]\s*/, '').trim();
      let flagged = false;
      if (title.includes('⚠')) {
        flagged = true;
        title = title.replace('⚠', '').trim();
      }

      const now = new Date().toISOString();

      const payload = {
        id: uuidv4(),
        user_id: user.id,
        categoryId: listId,
        cycle_id,
        type: 'task',
        title,
        description: notes,
        status: 'pending',
        priority: 0,
        flagged,
        created_at: now,
        updated_at: now,
        version: 1,
        alerts: [],
        blockedBy: [],
        completedAlerts: [],
        completionHistory: []
      };

      await prisma.task.create({
        data: {
          id: payload.id,
          userId: user.id,
          payload
        }
      });
      importedCount++;
    }
  }

  console.log(`Successfully imported ${importedCount} tasks from PDFs!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
