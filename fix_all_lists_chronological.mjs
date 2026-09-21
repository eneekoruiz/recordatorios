import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CARE_DIARIA = [
  { title: 'Lavar rostro (Limpiador suave)', tod: 'morning' },
  { title: 'Aplicar tónico facial', tod: 'morning' },
  { title: 'Aplicar contorno de ojos', tod: 'morning' },
  { title: 'Aplicar sérum (Vitamina C / Hidratante)', tod: 'morning' },
  { title: 'Aplicar crema hidratante', tod: 'morning' },
  { title: 'Aplicar protector solar (FPS 50)', tod: 'morning' },
  { title: 'Desodorante / Piedra de alumbre', tod: 'morning' },
  { title: 'Ejercicios faciales (pómulos)', tod: 'afternoon' },
  { title: 'Doble limpieza facial (Desmaquillante + Jabón)', tod: 'night' },
  { title: 'Aplicar tónico facial', tod: 'night' },
  { title: 'Aplicar contorno de ojos', tod: 'night' },
  { title: 'Aplicar sérum de noche (Retinol / Activos)', tod: 'night' },
  { title: 'Aplicar crema de noche / Mascarilla nocturna', tod: 'night' },
  { title: 'Cuidado labial (Bálsamo)', tod: 'night' },
  { title: 'Banda facial reafirmante', tod: 'night' }
];

const CARE_SEMANAL = [
  { title: 'Exfoliar el rostro' },
  { title: 'Aplicar mascarilla facial profunda' },
  { title: 'Cepillado en seco corporal' },
  { title: 'Exfoliar el cuerpo' },
  { title: 'Cortar y arreglar uñas (manos y pies)' },
  { title: 'Mascarilla capilar / Cuidado de cabello' }
];

const LIMPIEZA_DIARIA = [
  { title: 'Ventilar la casa (10 min)', tod: 'morning' },
  { title: 'Hacer la cama', tod: 'morning' },
  { title: 'Recoger ropa suelta y llevar al cesto', tod: 'morning' },
  { title: 'Fregar platos o cargar lavavajillas', tod: 'afternoon' },
  { title: 'Pasar trapo rápido por la vitrocerámica y encimera', tod: 'afternoon' },
  { title: 'Pasar un agua rápida al fregadero', tod: 'afternoon' },
  { title: 'Recoger objetos fuera de sitio (salón, pasillo)', tod: 'night' },
  { title: 'Dejar el escritorio despejado', tod: 'night' },
  { title: 'Vaciar papeleras si están llenas', tod: 'night' }
];

const LIMPIEZA_SEMANAL = [
  { title: 'Cambiar la ropa de cama' },
  { title: 'Poner lavadora(s) de ropa y sábanas' },
  { title: 'Quitar el polvo de superficies y muebles' },
  { title: 'Limpiar espejos (baño y entrada)' },
  { title: 'Limpiar a fondo el baño (inodoro, lavabo, ducha)' },
  { title: 'Limpiar a fondo la cocina (microondas, frentes, encimera)' },
  { title: 'Aspirar toda la casa (suelos y alfombras)' },
  { title: 'Fregar el suelo de toda la casa' },
  { title: 'Barrer el balcón' },
  { title: 'Bajar el reciclaje (vidrio, papel, plásticos)' } // Idea extra
];

const LIMPIEZA_MENSUAL = [
  { title: 'Limpiar cristales y ventanas' },
  { title: 'Limpiar interior de la nevera' },
  { title: 'Limpiar horno a fondo' },
  { title: 'Limpiar campana extractora y filtros' },
  { title: 'Limpiar azulejos del baño y cocina' },
  { title: 'Aspirar colchón y limpiar debajo del canapé' },
  { title: 'Revisar y limpiar desagües (baño y cocina)' },
  { title: 'Limpiar puertas y rodapiés' }
];

async function main() {
  const allTasks = await prisma.task.findMany({ where: { deletedAt: null } });
  
  // 1. DELETE existing daily/weekly tasks for Care and Limpieza to avoid duplicates and mess
  const tasksToDelete = allTasks.filter(t => {
    let p = typeof t.payload === 'string' ? JSON.parse(t.payload) : t.payload;
    const cat = (p.categoryId || p.category_id || '').toLowerCase();
    return cat === 'care' || cat.startsWith('limpieza');
  });

  console.log(`Deleting ${tasksToDelete.length} messy old tasks from Care and Limpieza...`);
  for (const t of tasksToDelete) {
    await prisma.task.update({ where: { id: t.id }, data: { deletedAt: new Date() } });
  }

  // Helper to create task
  const createTask = async (catId, title, cycleId, tod = 'none', order = 0) => {
    const payload = {
      title,
      categoryId: catId,
      cycle_id: cycleId,
      timeOfDay: tod,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      order
    };
    await prisma.task.create({
      data: {
        id: crypto.randomUUID(),
        user_id: 'clx012345678901234567890', // Default fallback, but Prisma doesn't strictly check if no constraint, wait... I should copy user_id from an existing task
        title: title,
        payload: payload
      }
    });
  };

  const userId = allTasks[0]?.user_id;
  
  // Function to create with specific user
  const insertTask = async (catId, title, cycleId, tod = 'none', order = 0) => {
    const prefix = cycleId === 'cycle_day' ? '[D] ' : cycleId === 'cycle_week' ? '[S] ' : cycleId === 'cycle_month' ? '[M] ' : '';
    const fullTitle = prefix + title;
    
    const payload = {
      id: crypto.randomUUID(),
      title: fullTitle,
      categoryId: catId,
      cycle_id: cycleId,
      timeOfDay: tod,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      order,
      version: 1
    };
    await prisma.task.create({
      data: {
        id: payload.id,
        user_id: userId,
        type: 'task',
        title: fullTitle,
        payload: payload
      }
    });
  };

  // Re-insert Care
  console.log('Inserting Care...');
  for (let i = 0; i < CARE_DIARIA.length; i++) {
    await insertTask('care', CARE_DIARIA[i].title, 'cycle_day', CARE_DIARIA[i].tod, i);
  }
  for (let i = 0; i < CARE_SEMANAL.length; i++) {
    await insertTask('care', CARE_SEMANAL[i].title, 'cycle_week', 'none', i);
  }

  // Re-insert Limpieza
  console.log('Inserting Limpieza...');
  for (let i = 0; i < LIMPIEZA_DIARIA.length; i++) {
    await insertTask('limpieza', LIMPIEZA_DIARIA[i].title, 'cycle_day', LIMPIEZA_DIARIA[i].tod, i);
  }
  for (let i = 0; i < LIMPIEZA_SEMANAL.length; i++) {
    await insertTask('limpieza', LIMPIEZA_SEMANAL[i].title, 'cycle_week', 'none', i);
  }
  for (let i = 0; i < LIMPIEZA_MENSUAL.length; i++) {
    await insertTask('limpieza', LIMPIEZA_MENSUAL[i].title, 'cycle_month', 'none', i);
  }

  // Review Compras
  // Let's add basic missing ones in Compras as "Sugerencias añadidas automáticamente"
  const NEW_COMPRAS = [
    { title: 'Papel higiénico', cat: 'compra' },
    { title: 'Bolsas de basura', cat: 'compra' },
    { title: 'Pastillas lavavajillas / Lavavajillas mano', cat: 'compra' },
    { title: 'Detergente y suavizante para la ropa', cat: 'compra' },
    { title: 'Lejía o limpiador desinfectante', cat: 'compra' },
    { title: 'Fregasuelos', cat: 'compra' },
    { title: 'Pasta de dientes', cat: 'compra' },
    { title: 'Hilo dental / Enjuague bucal', cat: 'compra' },
    { title: 'Cuchillas de afeitar / Recambios', cat: 'compra' },
    { title: 'Discos desmaquillantes / Algodón', cat: 'compra' },
    { title: 'Bastoncillos para los oídos', cat: 'compra' }
  ];

  for (const c of NEW_COMPRAS) {
    // Check if exists
    const exists = allTasks.some(t => t.title.toLowerCase().includes(c.title.split(' ')[0].toLowerCase()) && t.categoryId === 'compra');
    if (!exists) {
      const payload = {
        id: crypto.randomUUID(),
        title: c.title,
        categoryId: 'compra',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1
      };
      await prisma.task.create({
        data: {
          id: payload.id,
          user_id: userId,
          type: 'task',
          title: c.title,
          payload: payload
        }
      });
    }
  }

  console.log('All done!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
