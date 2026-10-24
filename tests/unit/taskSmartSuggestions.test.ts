import { describe, it, expect } from 'vitest';
import { detectTaskSmartSuggestion } from '../../src/utils/taskSmartSuggestions';

describe('detectTaskSmartSuggestion', () => {
  it('detecta ciclos diarios como sugerencia interactiva y limpia el título', () => {
    const res = detectTaskSmartSuggestion({
      title: 'Hacer flexiones todos los días'
    });
    expect(res).not.toBeNull();
    expect(res?.type).toBe('cycle');
    expect(res?.prompt).toBe('¿Repetir diariamente?');
    expect(res?.actionLabel).toBe('Convertir');
    expect(res?.patch.cycle_id).toBe('cycle_day');
    expect(res?.cleanTitle).toBe('Hacer flexiones');
  });

  it('detecta "y que se repita todas las semanas" como sugerencia semanal', () => {
    const res = detectTaskSmartSuggestion({
      title: 'Comprar fruta y que se repita todas las semanas'
    });
    expect(res).not.toBeNull();
    expect(res?.type).toBe('cycle');
    expect(res?.prompt).toBe('¿Repetir semanalmente?');
    expect(res?.patch.cycle_id).toBe('cycle_week');
    expect(res?.cleanTitle).toBe('Comprar fruta');
  });

  it('detecta ciclos mensuales', () => {
    const res = detectTaskSmartSuggestion({
      title: 'Revisar recibos de luz cada mes'
    });
    expect(res).not.toBeNull();
    expect(res?.type).toBe('cycle');
    expect(res?.prompt).toBe('¿Repetir mensualmente?');
    expect(res?.patch.cycle_id).toBe('cycle_month');
    expect(res?.cleanTitle).toBe('Revisar recibos de luz');
  });

  it('detecta duración en minutos o media hora', () => {
    const res1 = detectTaskSmartSuggestion({
      title: 'Meditar durante 20 minutos'
    });
    expect(res1).not.toBeNull();
    expect(res1?.type).toBe('duration');
    expect(res1?.prompt).toBe('¿Fijar duración en 20 min?');
    expect(res1?.patch.duration).toBe(20);
    expect(res1?.cleanTitle).toBe('Meditar');

    const res2 = detectTaskSmartSuggestion({
      title: 'Paseo en bicicleta media hora'
    });
    expect(res2?.patch.duration).toBe(30);
    expect(res2?.cleanTitle).toBe('Paseo en bicicleta');
  });

  it('detecta hábitos con contador (delegado a habitSuggestions)', () => {
    const res = detectTaskSmartSuggestion({
      title: 'Agua 8 vasos al día'
    });
    expect(res).not.toBeNull();
    expect(res?.type).toBe('habit');
    expect(res?.prompt).toBe('¿Convertir en hábito de 8 veces al día?');
    expect(res?.patch.targetCount).toBe(8);
    expect(res?.patch.cycle_id).toBe('cycle_day');
    expect(res?.cleanTitle).toBe('Agua');
  });

  it('detecta ubicación en tiendas o lugares clave', () => {
    const res = detectTaskSmartSuggestion({
      title: 'Comprar leche de avena en Mercadona'
    });
    expect(res).not.toBeNull();
    expect(res?.type).toBe('location');
    expect(res?.prompt).toBe('¿Añadir ubicación "Mercadona"?');
    expect(res?.patch.locationName).toBe('Mercadona');
    expect(res?.cleanTitle).toBe('Comprar leche de avena');
  });

  it('detecta personas involucradas pero no palabras comunes con "con"', () => {
    const resPerson = detectTaskSmartSuggestion({
      title: 'Reunión de balance con Carlos'
    });
    expect(resPerson).not.toBeNull();
    expect(resPerson?.type).toBe('people');
    expect(resPerson?.prompt).toBe('¿Asignar a Carlos?');
    expect(resPerson?.patch.people).toEqual(['Carlos']);
    expect(resPerson?.cleanTitle).toBe('Reunión de balance');

    const resNonPerson = detectTaskSmartSuggestion({
      title: 'Limpiar cristales con cuidado'
    });
    expect(resNonPerson).toBeNull();
  });

  it('detecta precios y costes', () => {
    const res = detectTaskSmartSuggestion({
      title: 'Cena con compañeros por 35€'
    });
    expect(res).not.toBeNull();
    expect(res?.type).toBe('price');
    expect(res?.prompt).toBe('¿Añadir precio de 35€?');
    expect(res?.patch.price).toBe(35);
    expect(res?.cleanTitle).toBe('Cena con compañeros');
  });

  it('NO sugiere funcionalidades si el usuario ya las ha configurado explícitamente', () => {
    // Ya tiene ciclo semanal configurado
    const withCycle = detectTaskSmartSuggestion({
      title: 'Reunión semanal',
      cycle_id: 'cycle_week'
    });
    expect(withCycle).toBeNull();

    // Ya tiene duración configurada
    const withDuration = detectTaskSmartSuggestion({
      title: 'Sesión durante 30 minutos',
      duration: 30
    });
    expect(withDuration).toBeNull();

    // Ya tiene personas configuradas
    const withPeople = detectTaskSmartSuggestion({
      title: 'Reunión con Carlos',
      people: ['Carlos']
    });
    expect(withPeople).toBeNull();

    // Ya tiene ubicación configurada
    const withLocation = detectTaskSmartSuggestion({
      title: 'Hacer compra en Mercadona',
      locationName: 'Mercadona'
    });
    expect(withLocation).toBeNull();
  });
});
