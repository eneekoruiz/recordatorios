import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function importAll() {
  const user = await prisma.user.findUnique({
    where: { email: 'eneekoruiz@gmail.com' }
  });
  if (!user) throw new Error("User eneekoruiz@gmail.com not found");

  const now = new Date().toISOString();

  // ========================================================
  // 1. LISTA COMPRA
  // ========================================================
  console.log("--- PROCESANDO LISTA COMPRA ---");
  await prisma.list.upsert({
    where: { id: 'compra' },
    update: {
      payload: {
        id: 'compra',
        name: 'Compra',
        color: '#34c759',
        icon: 'ShoppingCart',
        isFinancial: true,
        _is_dirty: true,
        updated_at: now
      }
    },
    create: {
      id: 'compra',
      userId: user.id,
      payload: {
        id: 'compra',
        name: 'Compra',
        color: '#34c759',
        icon: 'ShoppingCart',
        isFinancial: true,
        _is_dirty: true,
        created_at: now,
        updated_at: now
      }
    }
  });

  const compraSections = [
    { id: 'compra_cuanto_antes', name: 'Cuánto antes', order: 0 },
    { id: 'compra_mensual', name: 'Mensual', order: 1 },
    { id: 'compra_anual', name: 'Anual', order: 2 },
    { id: 'compra_wish_list', name: 'Wish List', order: 3 },
    { id: 'compra_otros', name: 'Otros', order: 4 }
  ];

  for (const sec of compraSections) {
    await prisma.listSection.upsert({
      where: { id: sec.id },
      update: {
        payload: {
          id: sec.id,
          listId: 'compra',
          name: sec.name,
          order: sec.order,
          updated_at: now,
          _is_dirty: true
        }
      },
      create: {
        id: sec.id,
        userId: user.id,
        payload: {
          id: sec.id,
          listId: 'compra',
          name: sec.name,
          order: sec.order,
          created_at: now,
          updated_at: now,
          _is_dirty: true
        }
      }
    });
  }

  // Borrar tareas antiguas de compra para que quede perfecta y limpia
  const existingTasks = await prisma.task.findMany({ where: { userId: user.id } });
  const oldCompraTasks = existingTasks.filter(t => t.payload?.categoryId === 'compra');
  for (const t of oldCompraTasks) {
    await prisma.task.delete({ where: { id: t.id } });
  }
  console.log(`Borradas ${oldCompraTasks.length} tareas antiguas de Compra.`);

  // Definición de tareas para Compra
  const compraTree = [
    // --- CUÁNTO ANTES ---
    {
      section: 'compra_cuanto_antes',
      title: '!! Me falta de los ahorros',
      priority: 'medium',
      children: [
        { title: 'Cosas de 100e —> 200€', description: '-Perfume 100\n-Pantalla/bateria 100' },
        { title: 'Cosas de 50e —> 100€', description: '-Indus 50\n-Bazar chino 50' },
        { title: 'Cosas de 20e —> 105€ (una de 25)', description: '-Mugi 20\n-Axe 20\n-Piedras 20\n-Chicles 20\n-Alcohol (Negrita 2L) 25' },
        { title: 'Cosas de 10e —> 65€', description: '-Deli 10\n-Gas 10\n-Pelu 15\n-Recambio cepillo 30' }
      ]
    },
    { section: 'compra_cuanto_antes', title: 'Papel para sacar de manera fácil para el cajón de la mesilla' },
    { section: 'compra_cuanto_antes', title: 'Celo doble cara' },
    { section: 'compra_cuanto_antes', title: 'El oro verde, sobre todo el mechero que tiene un hueco y se abre por abajo' },
    { section: 'compra_cuanto_antes', title: 'AMAZON' },
    { section: 'compra_cuanto_antes', title: 'Ventilador con gancho mejor si es enchufable y con pilas con un brazo articulado de estos para poder engancharlo en el cabezal de la cama y moverlo a mi gusto' },
    { section: 'compra_cuanto_antes', title: 'protector de sillón acolchado todo esto para la buena bici' },

    // --- MENSUAL ---
    { section: 'compra_mensual', title: 'Peluquería', description: '15 e', price: 15 },
    { section: 'compra_mensual', title: 'Tabaco', description: '50 e', price: 50 },
    { section: 'compra_mensual', title: 'Masaje o fisio', description: '50 e', price: 50 },
    { section: 'compra_mensual', title: 'Spotify', description: '6 e', price: 6 },
    { section: 'compra_mensual', title: 'iCloud', description: '10 e', price: 10 },
    { section: 'compra_mensual', title: 'TOTAL: 131€' },

    // --- ANUAL ---
    {
      section: 'compra_anual',
      title: 'Ya tengo',
      children: [
        { title: '! Plantilla de pie ortopédica a medida', priority: 'low', description: '50 e', price: 50 },
        { title: 'La perla 10 sesiones 350 e', price: 350 },
        { title: 'Renovar ropa de casa, pijamas, calcetines de casa calentitos', description: '100 e', price: 100 },
        { title: 'Ropa nueva', description: '200e', price: 200 }
      ]
    },
    {
      section: 'compra_anual',
      title: 'Ropa interior 100 e',
      children: [
        { title: '5-10 Calzoncillos CK MIRAVIA', description: '50 e', price: 50 },
        { title: '10-20 Pares de calcetines marca MIRAVIA 20 e', description: '50 e', price: 50 }
      ]
    },
    {
      section: 'compra_anual',
      title: 'Zapatillas 200 e',
      children: [
        { title: 'Shox' },
        { title: 'Botas marrones claro' },
        { title: 'Air force 1' },
        { title: 'Globe' },
        { title: 'Air 90' },
        { title: 'Newbalance' },
        { title: 'Tn' }
      ]
    },
    {
      section: 'compra_anual',
      title: 'Tengo que',
      children: [
        { title: '!! Mugí', priority: 'medium', description: '150 e', price: 150 },
        { title: '!!! Perfume', priority: 'high', description: '100e', price: 100 },
        { title: 'Bronceamiento', description: '130', price: 130 },
        { title: 'Arreglar pantalla batería o seguro de móvil o lo que necesite' },
        { title: 'Seguro dental (LIMPIEZA Y BLANQUEAMIENTO DE LAPIZ)', description: '130', price: 130 },
        { title: 'Sábanas 2 pares invierno/ 2 pares verano algodon', description: '100 e', price: 100 },
        {
          title: 'AliExpress 60e',
          children: [
            { title: 'Oral B 12 Cabezales (minimo) ALIEXPRESS 15 e', priority: 'high', description: '50 e', price: 50 },
            { title: 'Paquetes de silicona y antipolillas con perfume', description: '10 e', price: 10 }
          ]
        },
        {
          title: '!!! Skin-care',
          priority: 'high',
          description: 'TOTAL: 50',
          children: [
            { title: 'Jabón facial 5 e', price: 5 },
            { title: 'Tónico' },
            { title: 'Sérum' },
            { title: 'Bálsamo labial' },
            { title: 'Jabón sin ph' },
            { title: 'Recambio de afeitar máquina o lo que sea' },
            { title: 'Axe', priority: 'medium', description: '30e', price: 30 },
            { title: 'Aceites esenciales' }
          ]
        },
        { title: 'TOTAL: 1540' }
      ]
    },

    // --- WISH LIST ---
    { section: 'compra_wish_list', title: 'Pendientes Swarosky' },
    { section: 'compra_wish_list', title: '!!! Depiladora afeitadora máquina buena', priority: 'high' },
    { section: 'compra_wish_list', title: 'Wonderboom para llevarlo a sitios' },
    { section: 'compra_wish_list', title: 'Piano + banqueta y sillín + micrófono profesional' },
    { section: 'compra_wish_list', title: 'Mochila con una red transpirable y un espacio entre la espalda y la mochila para el sudor (como en caravanas oiartzun)' },
    { section: 'compra_wish_list', title: 'Jagger 3L' },
    { section: 'compra_wish_list', title: 'Airtags 4 por 100e' },
    {
      section: 'compra_wish_list',
      title: '!! Cosas para hacer masaje',
      priority: 'medium',
      children: [
        { title: 'Masajeador de cuello hombros espalda de amasamiento 4D' },
        { title: 'Más cosas que se ocurran' },
        { title: 'Manos vibradoras' },
        { title: 'Manta de abalorios' },
        { title: 'Manta de calor sanadora' },
        { title: 'Aceites calor frío etc' }
      ]
    },
    {
      section: 'compra_wish_list',
      title: '! Ropa',
      priority: 'low',
      children: [
        { title: 'Nike Tailwind' },
        { title: 'Abrigo Nike' },
        { title: 'Un par de cinturones guapos' },
        { title: 'Antiarrugas de zapatos' },
        { title: 'Chanclas de marca talla 43' },
        { title: 'Nike zoom 2k' },
        { title: 'Chaqueta reflectante' },
        { title: 'Nike Tkno' },
        { title: 'Gorro Carhartt' }
      ]
    },
    {
      section: 'compra_wish_list',
      title: '! Acuario',
      priority: 'low',
      children: [
        { title: 'Pecera enorme' },
        { title: 'Bomba sumergible' },
        { title: 'Calentador' },
        { title: 'Termómetro agua' },
        { title: 'Alimentador de peces automático' }
      ]
    },

    // --- OTROS ---
    { section: 'compra_otros', title: 'El oro verde, sobre todo incluido el mechero que se abre por abajo para meter la droga' },
    { section: 'compra_otros', title: 'DBici', description: '50', price: 50 }
  ];

  let compraCount = 0;
  async function insertCompraNodes(nodes, sectionId, parentId = undefined) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const sec = node.section || sectionId;
      const id = uuidv4();
      const payload = {
        id,
        user_id: user.id,
        categoryId: 'compra',
        sectionId: sec,
        parentId,
        title: node.title,
        description: node.description || undefined,
        price: node.price,
        priority: node.priority || 'none',
        status: 'pending',
        type: 'task',
        order: i,
        created_at: now,
        updated_at: now,
        version: 1,
        alerts: [],
        blockedBy: [],
        completedAlerts: [],
        completionHistory: [],
        _is_dirty: true
      };

      await prisma.task.create({
        data: { id, userId: user.id, payload }
      });
      compraCount++;

      if (node.children && node.children.length > 0) {
        await insertCompraNodes(node.children, sec, id);
      }
    }
  }

  await insertCompraNodes(compraTree);
  console.log(`Insertadas ${compraCount} tareas en Compra con jerarquía y secciones.`);


  // ========================================================
  // 2. LISTA QUEHACERES
  // ========================================================
  console.log("\n--- PROCESANDO LISTA QUEHACERES ---");
  await prisma.list.upsert({
    where: { id: 'quehaceres' },
    update: {
      payload: {
        id: 'quehaceres',
        name: 'Quehaceres',
        color: '#ff3b30',
        icon: 'CheckSquare',
        _is_dirty: true,
        updated_at: now
      }
    },
    create: {
      id: 'quehaceres',
      userId: user.id,
      payload: {
        id: 'quehaceres',
        name: 'Quehaceres',
        color: '#ff3b30',
        icon: 'CheckSquare',
        _is_dirty: true,
        created_at: now,
        updated_at: now
      }
    }
  });

  const quehaceresSections = [
    { id: 'quehaceres_recurrentes', name: 'RECURRENTES', order: 0 },
    { id: 'quehaceres_diarias', name: 'DIARIAS', order: 1 },
    { id: 'quehaceres_semanales', name: 'SEMANALES', order: 2 },
    { id: 'quehaceres_mensuales', name: 'MENSUALES', order: 3 },
    { id: 'quehaceres_anuales', name: 'ANUALES', order: 4 },
    { id: 'quehaceres_te_aburres', name: 'Te aburres?', order: 5 }
  ];

  for (const sec of quehaceresSections) {
    await prisma.listSection.upsert({
      where: { id: sec.id },
      update: {
        payload: {
          id: sec.id,
          listId: 'quehaceres',
          name: sec.name,
          order: sec.order,
          updated_at: now,
          _is_dirty: true
        }
      },
      create: {
        id: sec.id,
        userId: user.id,
        payload: {
          id: sec.id,
          listId: 'quehaceres',
          name: sec.name,
          order: sec.order,
          created_at: now,
          updated_at: now,
          _is_dirty: true
        }
      }
    });
  }

  // Limpiar cualquier tarea previa en quehaceres por si acaso
  const oldQuehaceres = existingTasks.filter(t => t.payload?.categoryId === 'quehaceres');
  for (const t of oldQuehaceres) {
    await prisma.task.delete({ where: { id: t.id } });
  }

  const quehaceresTree = [
    // --- RECURRENTES ---
    { section: 'quehaceres_recurrentes', title: 'Repasar los documentos de la carpeta “podría servir en el cole”' },
    { section: 'quehaceres_recurrentes', title: 'RECORDATORIO DE RWSPIRAR POR LA MARIZ' },
    { section: 'quehaceres_recurrentes', title: 'Despertarse' },
    { section: 'quehaceres_recurrentes', title: 'Aseo básico', description: 'es de mañana, con lo cual llevarás prácticamente toda la noche sin hacer nada y tendrás ganas -Lavar cara 1' },
    { section: 'quehaceres_recurrentes', title: 'Aplicaciones permanentes 3 veces al dia', description: 'hay aplicaciones que para su uso adecuado tienen que estar siempre en segundo plano. Esas aplicaciones son Noti Save y Mi Fit. Asegúrate de que estén abiertas y en caso contrario, inícialas.' },
    { section: 'quehaceres_recurrentes', title: 'Agua 10 veces al dia' },
    { section: 'quehaceres_recurrentes', title: 'Desayunar' },
    { section: 'quehaceres_recurrentes', title: 'Lavarse los dientes 3 veces al dia' },
    { section: 'quehaceres_recurrentes', title: 'Lavarse las manos 4 veces al dia' },
    { section: 'quehaceres_recurrentes', title: 'Hacer cama' },
    { section: 'quehaceres_recurrentes', title: 'Almorzar' },
    { section: 'quehaceres_recurrentes', title: 'Merendar' },
    { section: 'quehaceres_recurrentes', title: 'Cenar' },
    { section: 'quehaceres_recurrentes', title: 'Estiramientos mañaneros' },
    { section: 'quehaceres_recurrentes', title: 'Dormir' },

    // --- DIARIAS ---
    {
      section: 'quehaceres_diarias',
      title: 'DIARIAS',
      children: [
        { title: 'Skin-care diaria', url: 'https://www.icloud.com/reminders/0a2l2ApcPfBIJQX1HTqCp-hxQCare' },
        { title: 'Limpieza diaria' }
      ]
    },
    { section: 'quehaceres_diarias', title: 'Duolingo' },
    { section: 'quehaceres_diarias', title: 'Ducha fría' },

    // --- SEMANALES ---
    {
      section: 'quehaceres_semanales',
      title: 'SEMANALES',
      dueDate: '2026-09-13T09:00:00.000Z',
      children: [
        { title: 'Limpieza semanal', description: 'Si coincide con la limpieza mensual, solo la segunda' },
        { title: 'Skincare semanal', url: 'https://www.icloud.com/reminders/0a2l2ApcPfBIJQX1HTqCp-hxQCare' }
      ]
    },
    { section: 'quehaceres_semanales', title: 'Hacer refill de pañuelos y mecheros' },
    { section: 'quehaceres_semanales', title: 'Masaje con los aparatos eléctricos de masaje' },
    {
      section: 'quehaceres_semanales',
      title: 'Tay',
      children: [
        { title: 'Limpiar comedero y bebedero' },
        { title: 'Duchar' },
        { title: 'Limpiar dientes' }
      ]
    },
    {
      section: 'quehaceres_semanales',
      title: 'Limpiar dispositivos electrónicos',
      children: [
        { title: 'AirPods' },
        { title: 'Cascos' },
        { title: 'Móvil' },
        { title: 'Ordenador' }
      ]
    },
    {
      section: 'quehaceres_semanales',
      title: 'Cargar dispositivos eléctricos',
      children: [
        { title: 'Cascos inalámbricos' },
        { title: 'Auriculares inalámbricos' },
        { title: 'Smartwatch' },
        { title: 'Powerbank' }
      ]
    },
    {
      section: 'quehaceres_semanales',
      title: 'Extras',
      children: [
        { title: 'Leer mi horóscopo' },
        { title: 'Mirar actualizaciones disponibles Apple Store' },
        { title: 'Mirar la sección de "novedades para ti" de Spotify y las tendencias de Youtube' },
        { title: 'Repasar vocabulario (ej. leer diccionario)' }
      ]
    },

    // --- MENSUALES ---
    {
      section: 'quehaceres_mensuales',
      title: 'MENSUALES',
      dueDate: '2026-10-07T09:00:00.000Z',
      children: [
        { title: 'Compra mensual' },
        { title: 'Limpieza mensual' },
        { title: 'Skin-care mensual', url: 'https://www.icloud.com/reminders/0a2l2ApcPfBIJQX1HTqCp-hxQCare' }
      ]
    },
    { section: 'quehaceres_mensuales', title: 'Regar plantas', dueDate: '2026-10-04T09:00:00.000Z' },
    { section: 'quehaceres_mensuales', title: 'Cortarme el pelo' },
    { section: 'quehaceres_mensuales', title: 'Ir a la perla' },
    { section: 'quehaceres_mensuales', title: 'Cambiar cabezal cepillo de dientes' },
    { section: 'quehaceres_mensuales', title: 'Cambiar cuchilla' },
    { section: 'quehaceres_mensuales', title: 'Revisar fotos móvil' },
    { section: 'quehaceres_mensuales', title: 'Seguimiento del cuerpo' },
    { section: 'quehaceres_mensuales', title: 'Aplicar lápiz blanqueador' },
    { section: 'quehaceres_mensuales', title: 'Ordenador', description: 'Winget upgrade all' },
    { section: 'quehaceres_mensuales', title: 'Tay', description: 'Limpieza profunda de cama, mantas, juguetes...' },
    {
      section: 'quehaceres_mensuales',
      title: 'Bici',
      children: [
        { title: 'Engrasar cadena' },
        { title: 'Hinchar ruedas' },
        { title: 'Vigilar frenos' }
      ]
    },
    {
      section: 'quehaceres_mensuales',
      title: 'Extras',
      children: [
        { title: 'Comprobar desvío de llamadas', description: 'Marcar *#21# en teléfono (para ver si el móvil está intervenido) y si lo está marcar ##002# para quitar la intervención' }
      ]
    },

    // --- ANUALES ---
    {
      section: 'quehaceres_anuales',
      title: 'ANUALES',
      dueDate: '2027-01-01T09:00:00.000Z',
      children: [
        { title: 'Compra anual' },
        { title: 'Limpieza anual' }
      ]
    },
    { section: 'quehaceres_anuales', title: 'Tirar basura de pilas' },
    { section: 'quehaceres_anuales', title: 'limpiarme las joyas del joyero con el espadachín este cómo se llame' },
    { section: 'quehaceres_anuales', title: 'Pedir cita para la limpieza de boca' },
    { section: 'quehaceres_anuales', title: 'Pedir analítica a la médica' },
    { section: 'quehaceres_anuales', title: 'Pedir cita oculista' },
    { section: 'quehaceres_anuales', title: 'Revisión dermatológica lunares' },
    { section: 'quehaceres_anuales', title: 'Vacunas' },
    { section: 'quehaceres_anuales', title: 'Mudar todo el tabaco, que el anterior se estará caducando' },
    { section: 'quehaceres_anuales', title: 'Arreglar mecheros acumulados para la colección' },
    { section: 'quehaceres_anuales', title: 'Asegurarse de que la privacidad de ninguna de mis cuentas ha sido vulnerada' },
    {
      section: 'quehaceres_anuales',
      title: 'Asegurarse de que todas las copias de seguridad están correctas',
      children: [
        {
          title: 'Copia de seguridad carpeta Estudios',
          description: 'Descargar la carpeta de los cursos realizados (academia, colegio, cursos...) y subirla a Estudios para convertirme en el propietario de las carpetas/archivos (si no, cuando te borren la cuenta se te borra todo). Asegurarte de que eres el propietario.',
          url: 'https://drive.google.com'
        },
        { title: 'WhatsApp' },
        { title: 'iCloud' },
        { title: 'Revisar si alguna cuenta importante ha recibido filtraciones' }
      ]
    },
    {
      section: 'quehaceres_anuales',
      title: 'Limpieza física tecnológica',
      children: [
        { title: 'Ventiladores del ordenador' },
        { title: 'Altavoces de los móviles' },
        { title: 'De más aparatos electrónicos' }
      ]
    },
    {
      section: 'quehaceres_anuales',
      title: 'Vehículos',
      description: 'Bici\nRevisar pedalier\nRevisar dirección\nRevisar luces y accesorios'
    },
    { section: 'quehaceres_anuales', title: 'Actualiza el currículum y actualizar cuentas de LinkedIn,github' },
    {
      section: 'quehaceres_anuales',
      title: 'propósitos del año',
      url: 'https://docs.google.com',
      children: [
        { title: 'Apuntar los de año siguiente' },
        { title: 'Comparar los del año anterior, a ver si se han conseguido' }
      ]
    }
  ];

  let quehaceresCount = 0;
  async function insertQuehaceresNodes(nodes, sectionId, parentId = undefined) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const sec = node.section || sectionId;
      const id = uuidv4();
      const payload = {
        id,
        user_id: user.id,
        categoryId: 'quehaceres',
        sectionId: sec,
        parentId,
        title: node.title,
        description: node.description || undefined,
        url: node.url || undefined,
        dueDate: node.dueDate || undefined,
        priority: 'none',
        status: 'pending',
        type: 'task',
        order: i,
        created_at: now,
        updated_at: now,
        version: 1,
        alerts: [],
        blockedBy: [],
        completedAlerts: [],
        completionHistory: [],
        _is_dirty: true
      };

      await prisma.task.create({
        data: { id, userId: user.id, payload }
      });
      quehaceresCount++;

      if (node.children && node.children.length > 0) {
        await insertQuehaceresNodes(node.children, sec, id);
      }
    }
  }

  await insertQuehaceresNodes(quehaceresTree);
  console.log(`Insertadas ${quehaceresCount} tareas en Quehaceres con jerarquía y secciones.`);

  console.log("\n✅ IMPORTACIÓN TOTAL COMPLETADA EXITOSAMENTE.");
}

importAll()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
