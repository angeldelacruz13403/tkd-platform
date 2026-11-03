export interface TatamiBoutAssignment {
  tatamiNumber: number;
  matchNumber: number;
}

export function createTatamiMatchAllocator(tatamiNumber: number, tatamiCount: number) {
  if (!Number.isInteger(tatamiNumber) || tatamiNumber < 1 || tatamiNumber > 8) {
    throw new RangeError("El tapiz inicial debe estar entre 1 y 8.");
  }
  if (
    !Number.isInteger(tatamiCount) ||
    tatamiCount < 1 ||
    tatamiNumber + tatamiCount - 1 > 8
  ) {
    throw new RangeError("El número de tapices debe dejar todos los tapices dentro del rango 1–8.");
  }

  let assignedBouts = 0;
  const boutsByTatami = new Map<number, number>();

  return (): TatamiBoutAssignment => {
    const assignedTatami = tatamiNumber + (assignedBouts % tatamiCount);
    assignedBouts += 1;

    const boutSequence = (boutsByTatami.get(assignedTatami) || 0) + 1;
    boutsByTatami.set(assignedTatami, boutSequence);

    return {
      tatamiNumber: assignedTatami,
      matchNumber: assignedTatami * 100 + boutSequence,
    };
  };
}
