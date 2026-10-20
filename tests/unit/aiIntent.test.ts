import { describe, expect, it } from 'vitest';
import type { CustomList, TaskItem } from '../../src/models/Task';
import {
  readFrequency, stripAddRequest, readConfirmation, readListTarget, referencesPending,
  inferList, describeProposal, asksForNoRepeat,
} from '../../src/utils/aiIntent';

const lists: CustomList[] = [
  { id: 'care', name: 'Care', color: '#af52de' },
  { id: 'limpieza', name: 'Limpieza', color: '#34c759' },
  { id: 'compra', name: 'Compra', color: '#34c759' },
  { id: 'trabajo', name: 'Trabajo', color: '#007aff' },
] as CustomList[];
const task = (title: string, categoryId: string): TaskItem => ({ id: title, title, categoryId, status: 'pending', created_at: '2026-01-01' } as TaskItem);

describe('frecuencias dichas con naturalidad', () => {
  it('«una vez al mes o así» es mensual y sale entera del título', () => {
    const f = readFrequency('una vez al mes o así hacerme las cejas');
    expect(f?.cycle).toBe('cycle_month');
    expect(f?.matched).toBe('una vez al mes o así');
  });
  it('veces por periodo', () => {
    expect(readFrequency('dos veces por semana ir al gimnasio')).toMatchObject({ cycle: 'cycle_week', targetCount: 2 });
    expect(readFrequency('beber agua 8 veces al día')).toMatchObject({ cycle: 'cycle_day', targetCount: 8 });
  });
  it('cada / todos los / -mente', () => {
    expect(readFrequency('regar las plantas cada semana')?.cycle).toBe('cycle_week');
    expect(readFrequency('todos los días leer')?.cycle).toBe('cycle_day');
    expect(readFrequency('revisar la caldera anualmente')?.cycle).toBe('cycle_year');
    expect(readFrequency('cada mes pagar el alquiler')?.cycle).toBe('cycle_month');
  });
  it('sin frecuencia, nada', () => {
    expect(readFrequency('comprar pan')).toBeNull();
    expect(asksForNoRepeat('mejor una sola vez')).toBe(true);
  });
});

describe('marcos de petición', () => {
  it('quita «quiero añadir», «apúntame un recordatorio para»…', () => {
    expect(stripAddRequest('Quiero añadir una vez al mes o así hacerme las cejas')).toBe('una vez al mes o así hacerme las cejas');
    expect(stripAddRequest('Apúntame un recordatorio para llamar al dentista')).toBe('llamar al dentista');
    expect(stripAddRequest('me gustaría poner un recordatorio de pagar el agua')).toBe('pagar el agua');
    expect(stripAddRequest('Comprar pan')).toBe('Comprar pan');
  });
});

describe('sí / no', () => {
  it('reconoce confirmaciones cortas', () => {
    for (const yes of ['Sí', 'si', 'Sí, añádelo', 'vale', 'Perfecto', 'ok', 'adelante', 'apúntalo']) expect(readConfirmation(yes)).toBe('yes');
    for (const no of ['No', 'déjalo', 'cancela', 'mejor no']) expect(readConfirmation(no)).toBe('no');
  });
  it('«no, en Care» no es un no: es una corrección', () => {
    expect(readConfirmation('no, en Care')).toBeNull();
    expect(readConfirmation('Sí pero en la lista de Care y cada semana')).toBeNull();
  });
});

describe('lista pedida (con negaciones)', () => {
  it('la frase real: no en la bandeja de entrada, en Care', () => {
    const text = 'Pero adónde se supone que Lo va a meter yo no quiero que lo meta la bandeja de entrada quiero que lo meta en la lista de Care';
    expect(readListTarget(text, lists)?.id).toBe('care');
    expect(referencesPending(text)).toBe(true);
  });
  it('variantes', () => {
    expect(readListTarget('no, en Care', lists)?.id).toBe('care');
    expect(readListTarget('en la bandeja no, en Compra', lists)?.id).toBe('compra');
    expect(readListTarget('no quiero que lo metas en la lista de Compra', lists)).toBeNull();
    expect(readListTarget('mejor en Trabajo', lists)?.id).toBe('trabajo');
    expect(readListTarget('ponlo en la bandeja de entrada', lists)?.id).toBe('inbox');
  });
});

describe('lista adecuada por contenido', () => {
  const existing = [task('Gimnasia facial', 'care'), task('Crema de noche', 'care'), task('Fregar el suelo', 'limpieza'), task('Leche', 'compra')];
  it('cejas → Care; fregar → Limpieza', () => {
    expect(inferList('Hacerme las cejas', lists, existing)?.list.id).toBe('care');
    expect(inferList('Hacerme las uñas', lists, existing)?.list.id).toBe('care');
    expect(inferList('Limpiar los cristales', lists, existing)?.list.id).toBe('limpieza');
  });
  it('si no está claro, no adivina', () => {
    expect(inferList('Llamar a mamá', lists, existing)).toBeNull();
  });
});

describe('la pregunta antes de crear', () => {
  it('es explícita: título, repetición y lista', () => {
    expect(describeProposal([{ title: 'Hacerme las cejas', cycle: 'cycle_month', listName: 'Care' }])).toBe('¿Apunto «Hacerme las cejas» cada mes en Care?');
    expect(describeProposal([{ title: 'Ir al gimnasio', cycle: 'cycle_week', targetCount: 2 }])).toBe('¿Apunto «Ir al gimnasio» 2 veces a la semana en Bandeja de entrada?');
    expect(describeProposal([{ title: 'Pan', listName: 'Compra' }, { title: 'Leche', listName: 'Compra' }])).toBe('¿Apunto estos 2 en Compra?');
  });
});
