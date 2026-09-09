import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

const careTasksData = [
  // --- SECCIÓN: DIARIA ---
  {
    section: 'care_diaria',
    title: 'Poner morritos hacia la izquierda derecha izquierda derecha para hacer pómulos',
    description: null
  },
  {
    section: 'care_diaria',
    title: '[D] Lavar rostro.',
    description: 'Usa un limpiador facial adecuado para tu tipo de piel (preferiblemente suave y sin sulfatos).'
  },
  {
    section: 'care_diaria',
    title: '[D] Aplicar tónico facial.',
    description: 'Utiliza un tónico sin alcohol para equilibrar el pH de la piel y prepararla para los siguientes pasos.'
  },
  {
    section: 'care_diaria',
    title: '[D] Aplicar sérum.',
    description: 'Emplea un sérum hidratante o con principios activos específicos según tus necesidades (por ejemplo, ácido hialurónico, vitamina C, niacinamida, etc.).'
  },
  {
    section: 'care_diaria',
    title: '[D] Aplicar contorno de ojos.',
    description: null
  },
  {
    section: 'care_diaria',
    title: '[D] Aplicar crema hidratante.',
    description: 'Usa una crema adaptada a tu tipo de piel para mantener la barrera cutánea.'
  },
  {
    section: 'care_diaria',
    title: '[D] Aplicar protector solar.',
    description: 'Usa FPS 50 incluso si no sales de casa; reaplica si estás al sol o frente a pantallas mucho tiempo.'
  },
  {
    section: 'care_diaria',
    title: '[D] Banda facial reafirmante.',
    description: 'Coloca la banda desde la barbilla hacia arriba y ajústala con el velcro; mantenla puesta entre 15 y 30 minutos para ayudar a definir el contorno facial.'
  },
  {
    section: 'care_diaria',
    title: '[D] Cuidado labial.',
    description: 'Aplica bálsamo o aceite labial para mantener los labios suaves e hidratados.'
  },
  {
    section: 'care_diaria',
    title: '[D] Crema de noche o tratamiento específico.',
    description: 'Finaliza con una crema más nutritiva o un tratamiento nocturno según tus necesidades (retinoides, ácido glicólico, etc.).'
  },
  {
    section: 'care_diaria',
    title: 'Piedra de alumbre',
    description: null
  },
  {
    section: 'care_diaria',
    title: 'Desodorante',
    description: null
  },
  {
    section: 'care_diaria',
    title: 'Perfume',
    description: null
  },

  // --- SECCIÓN: SEMANAL ---
  {
    section: 'care_semanal',
    title: '[S] Cepillado en seco corporal.',
    description: 'Antes de ducharte, con un cepillo de cerdas naturales. Comienza por los pies y sube en dirección al corazón. Mejora la circulación y exfolia.'
  },
  {
    section: 'care_semanal',
    title: '[S] Exfoliar el rostro.',
    description: 'Antes del lavado facial. Mezcla café, azúcar y yogur natural o miel. Aplica suavemente con movimientos circulares y aclara.'
  },
  {
    section: 'care_semanal',
    title: '[D] Lavar rostro.',
    description: 'Usa un limpiador facial adecuado para tu tipo de piel (preferiblemente suave y sin sulfatos).'
  },
  {
    section: 'care_semanal',
    title: '[S] Aplicar mascarilla facial.',
    description: 'Prepara una mezcla con yogur, miel y avena. Aplica en el rostro durante 15–20 minutos y aclara. Aporta nutrición e ilumina. Si no tienes, hay muchísimas combinaciones con miel (canela, zumo de limón…) y se pueden hacer varias según el objetivo'
  },
  {
    section: 'care_semanal',
    title: '[D] Aplicar tónico facial.',
    description: null
  },
  {
    section: 'care_semanal',
    title: '[D] Aplicar sérum.',
    description: 'Emplea un sérum hidratante o con principios activos específicos según tus necesidades (por ejemplo, ácido hialurónico, vitamina C, niacinamida, etc.).'
  },
  {
    section: 'care_semanal',
    title: '[D] Aplicar crema facial hidratante.',
    description: 'Usa Nivea para rostro y cuello después de lavarte. Aplica con movimientos ascendentes y suaves.'
  },
  {
    section: 'care_semanal',
    title: '[D] Aplicar protector solar facial.',
    description: 'Muy importante por la mañana. Usa uno con SPF adecuado incluso si está nublado. Evita manchas y envejecimiento.'
  },
  {
    section: 'care_semanal',
    title: '[D] Piedra de alumbre en axilas y cuello.',
    description: 'Humedece la piedra ligeramente y pásala por las axilas y cuello.'
  },
  {
    section: 'care_semanal',
    title: '[D] Aplicar desodorante corporal.',
    description: 'Usa tu desodorante habitual si quieres un extra además de la piedra de alumbre.'
  },
  {
    section: 'care_semanal',
    title: '[S] Exfoliar el cuerpo.',
    description: 'Durante la ducha. Mezcla casera: café molido, azúcar y un poco de aceite. Masajea con movimientos circulares y aclara.'
  },
  {
    section: 'care_semanal',
    title: '[S] Piedra pómez.',
    description: 'Durante la ducha, tras remojar bien los pies. Frota con suavidad sobre talones y zonas duras para eliminar piel muerta.'
  },
  {
    section: 'care_semanal',
    title: '[D] Aplicar crema corporal.',
    description: 'Usa la misma Nivea en brazos, torso y piernas. Ideal después de la ducha para sellar la hidratación.'
  },
  {
    section: 'care_semanal',
    title: '[S] Baño de pies.',
    description: 'Llena un recipiente con agua caliente, sal y piel de cítricos (naranja/limón). Deja los pies 10–15 minutos.'
  },
  {
    section: 'care_semanal',
    title: '[S] Estiramientos conscientes.',
    description: 'Dedica 5 a 10 minutos a estirar cuello, espalda, brazos y piernas con respiración profunda.'
  },
  {
    section: 'care_semanal',
    title: '[D] Aplicar crema en los pies.',
    description: 'Idealmente por la noche o tras ducharte.'
  },
  {
    section: 'care_semanal',
    title: '[D] Aplicar crema en las manos.',
    description: 'Aplica una cantidad pequeña, especialmente después de lavarlas o antes de dormir.'
  },
  {
    section: 'care_semanal',
    title: '[D] Banda reafirmante facial.',
    description: 'Coloca la banda desde la barbilla hasta la cabeza, ajustando con el velcro. Déjala actuar 10–15 minutos después de la ducha.'
  },

  // --- SECCIÓN: MENSUAL ---
  {
    section: 'care_mensual',
    title: '[M] Baño de vapor facial.',
    description: 'Hierve agua con manzanilla, menta o romero. Cubre tu cabeza con una toalla e inhala el vapor a 20 cm del bol durante 5–10 minutos. Abre los poros.'
  },
  {
    section: 'care_mensual',
    title: '[M] Mascarilla capilar casera.',
    description: 'Mezcla aceite de coco, romero y un poco de café. Aplica en medios y puntas, envuelve con gorro y deja actuar 30 minutos. Luego lava.'
  },
  {
    section: 'care_mensual',
    title: '[M] Aplicar mascarilla facial casera.',
    description: 'Mezcla yogur, miel y avena. Aplica 15–20 minutos y aclara.'
  },
  {
    section: 'care_mensual',
    title: '[S] Baño de pies.',
    description: 'Llena un recipiente con agua caliente, sal y piel de cítricos.'
  },
  {
    section: 'care_mensual',
    title: '[M] Masaje de pies.',
    description: 'Después del baño de pies, usa crema o aceite y masajea planta, talón y dedos.'
  },
  {
    section: 'care_mensual',
    title: '[S] Cepillado en seco corporal.',
    description: 'Antes de ducharte, con un cepillo de cerdas naturales.'
  },
  {
    section: 'care_mensual',
    title: '[S] Exfoliar el rostro.',
    description: 'Antes del lavado facial. Mezcla café, azúcar y yogur natural o miel.'
  },
  {
    section: 'care_mensual',
    title: '[D] Lavar el rostro.',
    description: 'Usa un limpiador facial suave, como el de EROSKI.'
  },
  {
    section: 'care_mensual',
    title: '[S] Exfoliar el cuerpo.',
    description: 'Durante la ducha, mezcla casera de café, azúcar y aceite.'
  },
  {
    section: 'care_mensual',
    title: '[S] Piedra pómez.',
    description: 'Durante la ducha, tras remojar bien los pies.'
  },
  {
    section: 'care_mensual',
    title: '[D] Aplicar crema en los pies.',
    description: 'Idealmente por la noche o tras ducharte.'
  },
  {
    section: 'care_mensual',
    title: '[D] Aplicar tónico facial.',
    description: 'Puedes usar agua de rosas o tónico sin alcohol.'
  },
  {
    section: 'care_mensual',
    title: '[D] Aplicar crema facial hidratante.',
    description: 'Usa Nivea para rostro y cuello.'
  },
  {
    section: 'care_mensual',
    title: '[D] Aplicar protector solar facial.',
    description: 'Muy importante por la mañana.'
  },
  {
    section: 'care_mensual',
    title: '[D] Piedra de alumbre en axilas y cuello.',
    description: 'Humedece la piedra ligeramente y pásala por las axilas y cuello.'
  },
  {
    section: 'care_mensual',
    title: '[D] Aplicar desodorante corporal.',
    description: null
  },
  {
    section: 'care_mensual',
    title: '[D] Aplicar crema corporal.',
    description: 'Usa Nivea en brazos, torso y piernas.'
  },
  {
    section: 'care_mensual',
    title: '[D] Aplicar crema en las manos.',
    description: 'Aplica una cantidad pequeña, especialmente después de lavarlas o antes de dormir.'
  },
  {
    section: 'care_mensual',
    title: '[M] Cuidado especial de manos.',
    description: 'Aplica una capa generosa de crema y ponte guantes de algodón durante 20 minutos.'
  },
  {
    section: 'care_mensual',
    title: '[D] Banda reafirmante facial.',
    description: 'Coloca la banda desde la barbilla hasta la cabeza, ajustando con el velcro. Déjala actuar 10–15 minutos después de la ducha.'
  },
  {
    section: 'care_mensual',
    title: '[M] Cortar uñas de los pies.',
    description: 'Hazlo después del baño, cuando están blandas.'
  },
  {
    section: 'care_mensual',
    title: '[M] Cortar uñas de las manos.',
    description: 'Hazlo tras una ducha o después del cuidado especial.'
  }
];

async function run() {
  const user = await prisma.user.findUnique({
    where: { email: 'eneekoruiz@gmail.com' }
  });
  if (!user) throw new Error("User eneekoruiz@gmail.com not found");

  const now = new Date().toISOString();

  // 1. Ensure list 'care' exists in List table
  await prisma.list.upsert({
    where: { id: 'care' },
    update: {
      payload: {
        id: 'care',
        name: 'Care',
        color: '#ff2d55',
        icon: 'Sparkles',
        _is_dirty: true,
        updated_at: now
      }
    },
    create: {
      id: 'care',
      userId: user.id,
      payload: {
        id: 'care',
        name: 'Care',
        color: '#ff2d55',
        icon: 'Sparkles',
        _is_dirty: true,
        created_at: now,
        updated_at: now
      }
    }
  });

  // 2. Ensure sections exist: DIARIA, SEMANAL, MENSUAL
  const sections = [
    { id: 'care_diaria', name: 'DIARIA', order: 0 },
    { id: 'care_semanal', name: 'SEMANAL', order: 1 },
    { id: 'care_mensual', name: 'MENSUAL', order: 2 }
  ];

  for (const sec of sections) {
    await prisma.listSection.upsert({
      where: { id: sec.id },
      update: {
        payload: {
          id: sec.id,
          listId: 'care',
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
          listId: 'care',
          name: sec.name,
          order: sec.order,
          created_at: now,
          updated_at: now,
          _is_dirty: true
        }
      }
    });
  }

  // 3. Clean up existing tasks for 'care'
  const existingTasks = await prisma.task.findMany({
    where: { userId: user.id }
  });
  const oldCareTasks = existingTasks.filter(t => t.payload?.categoryId === 'care');
  console.log(`Found ${oldCareTasks.length} old care tasks to remove.`);

  for (const oldTask of oldCareTasks) {
    await prisma.task.delete({
      where: { id: oldTask.id }
    });
  }
  console.log("Old care test tasks deleted successfully.");

  // 4. Insert all 53 tasks in order
  let inserted = 0;
  for (let i = 0; i < careTasksData.length; i++) {
    const item = careTasksData[i];
    const taskId = uuidv4();

    const taskPayload = {
      id: taskId,
      user_id: user.id,
      categoryId: 'care',
      sectionId: item.section,
      type: 'task',
      title: item.title,
      description: item.description || undefined,
      status: 'pending',
      priority: 'none',
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
      data: {
        id: taskId,
        userId: user.id,
        payload: taskPayload
      }
    });
    inserted++;
  }

  console.log(`Successfully imported ${inserted} tasks into Care list!`);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
