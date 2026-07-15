// Paleta categórica cálida tipo "risografía / almanaque": tonos apagados que
// conviven con el papel del cuaderno y se distinguen entre sí. Se usa igual en
// los sellos de categoría del formulario y en el gráfico de evolución.
export const CATEGORY_COLORS = [
  "#a54322", // arcilla
  "#3a5a49", // pino
  "#9c7328", // ocre
  "#2f6f74", // verde azulado
  "#6b4a63", // ciruela
  "#3f5573", // pizarra
  "#7a7a35", // oliva
  "#b9714c", // teja clara
  "#4a6b57", // salvia oscura
  "#8a6d3b", // mostaza tostada
];

// Color estable para una categoría a partir de su posición en una lista
// ordenada (por sort_order). Cicla si hay más categorías que colores.
export function colorForIndex(index: number): string {
  return CATEGORY_COLORS[((index % CATEGORY_COLORS.length) + CATEGORY_COLORS.length) % CATEGORY_COLORS.length];
}
