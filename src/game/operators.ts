/**
 * Operators: five characters with their own build, face, headgear and default kit.
 * The player picks one on the Soldier page; uniform camo and gear colour are on top.
 * Bots are dressed as operators too, so lobbies look varied.
 */
export type OperatorId = 'ghost' | 'brick' | 'viper' | 'static' | 'jackal';

export type Face = 'balaclava' | 'beard' | 'shemagh' | 'gasmask' | 'bare';
export type Eyes = 'goggles' | 'sunglasses' | 'aviators' | 'none';
export type Headgear = 'nvg' | 'helmet' | 'boonie' | 'cap' | 'hood';

export interface Operator {
  id: OperatorId;
  name: string;
  role: string;
  bio: string;
  face: Face;
  eyes: Eyes;
  head: Headgear;
  /** multiplier on skin texture: light to dark */
  skin: number;
  hair: number;
  /** body proportions: width/depth bulk and height */
  bulk: number;
  height: number;
  /** extra armour: shoulder pauldrons and a neck guard */
  heavy?: boolean;
  /**
   * Body kit, so operators differ below the neck too:
   * plate = plate carrier, heavy = breacher armour + shield, chest = scout chest rig + ruck,
   * suit = CBRN suit + air tank, lowpro = slick carrier over a polo shirt.
   */
  rig: 'plate' | 'heavy' | 'chest' | 'suit' | 'lowpro';
  sleeves: 'long' | 'rolled' | 'short';
  boots: 'combat' | 'desert' | 'rubber';
  /** solid shirt colour instead of the uniform on the torso and arms */
  shirt?: number;
  /** default uniform and gear when first picked */
  uniform: string;
  gear: string;
  /** accent colour for the menu card */
  accent: string;
}

export const OPERATORS: Operator[] = [
  {
    id: 'ghost', name: 'GHOSTWIRE', role: 'RECON', bio: 'Night-raid veteran. Never takes the balaclava off, never misses a door.',
    face: 'balaclava', eyes: 'goggles', head: 'nvg', skin: 0xffffff, hair: 0x2a2018, bulk: 1, height: 1, rig: 'plate', sleeves: 'long', boots: 'combat', uniform: 'desert', gear: 'coyote', accent: '#7ec8ff',
  },
  {
    id: 'brick', name: 'BRICK', role: 'BREACHER', bio: 'Former rugby prop. Carries extra plates and leads every stack.',
    face: 'beard', eyes: 'none', head: 'helmet', skin: 0x8a6650, hair: 0x15100c, bulk: 1.09, height: 1.02, heavy: true, rig: 'heavy', sleeves: 'long', boots: 'combat', uniform: 'woodland', gear: 'ranger', accent: '#e0803a',
  },
  {
    id: 'viper', name: 'VIPER', role: 'SCOUT', bio: 'Desert tracker. Wraps up against the sun and hunts from long range.',
    face: 'shemagh', eyes: 'sunglasses', head: 'boonie', skin: 0xd7b49a, hair: 0x3a2a1c, bulk: 0.94, height: 0.98, rig: 'chest', sleeves: 'rolled', boots: 'desert', uniform: 'desert', gear: 'coyote', accent: '#e8c46a',
  },
  {
    id: 'static', name: 'STATIC', role: 'CBRN SPECIALIST', bio: 'Chemical-warfare specialist. Breathes filtered air and talks through a voice box.',
    face: 'gasmask', eyes: 'none', head: 'hood', skin: 0xffffff, hair: 0x222222, bulk: 1.03, height: 1, rig: 'suit', sleeves: 'long', boots: 'rubber', uniform: 'urban', gear: 'black', accent: '#9fd36b',
  },
  {
    id: 'jackal', name: 'JACKAL', role: 'CONTRACTOR', bio: 'Private contractor. Cap on backwards, aviators on, no plate carrier rules.',
    face: 'bare', eyes: 'aviators', head: 'cap', skin: 0xf2d2bc, hair: 0x6b4a2a, bulk: 0.98, height: 1.01, rig: 'lowpro', sleeves: 'short', boots: 'combat', shirt: 0x3a4048, uniform: 'night', gear: 'black', accent: '#ff7a5a',
  },
];

export const operatorById = (id: string) => OPERATORS.find((o) => o.id === id) ?? OPERATORS[0];
