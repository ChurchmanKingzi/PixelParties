// Welche Gebäudewirkungen sind im Prototyp umgesetzt? (für die Anzeige im Inspektor)
export type Impl = 'full' | 'partial' | 'stats';

const FULL = [
  'BS-01', 'BS-02', 'BS-03', 'BS-04', 'BS-05', 'BS-06', 'BS-08', 'BS-09',
  'BT-01', 'BT-02', 'BT-03', 'BT-04', 'BT-06', 'BT-07', 'BT-08',
  'BH-01', 'BH-02', 'BH-03', 'BH-04', 'BH-05', 'BH-06', 'BH-07',
  'BW-01', 'BW-02', 'BW-03', 'BW-04', 'BW-05', 'BW-06', 'BW-07', 'BW-08', 'BW-09', 'BW-10', 'BW-11',
  'BF-01', 'BF-02', 'BF-03', 'BF-04', 'BF-05', 'BF-07', 'BF-08', 'BF-09',
  'BP-01', 'BP-02', 'BP-03', 'BP-06',
  'BU-01', 'BU-02', 'BU-03', 'BU-04', 'BU-06', 'BU-08', 'BU-10', 'BU-11',
  'BA-01', 'BA-02', 'BA-03', 'BA-04', 'BA-05', 'BA-06',
  'BC-01', 'BC-02', 'BC-04', 'BC-05', 'BC-06', 'BC-07', 'BC-08',
];
const PARTIAL = ['BS-07', 'BT-05', 'BF-06', 'BF-10', 'BP-04', 'BP-05', 'BU-05'];

export function buildingImpl(id: string): Impl {
  if (FULL.includes(id)) return 'full';
  if (PARTIAL.includes(id)) return 'partial';
  return 'stats';
}
