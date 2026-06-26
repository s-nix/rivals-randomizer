// Marvel Rivals Hero Roster — as of February 2026 (Season 6.5)
// To add new heroes, simply append to the `heroes` array below.

export type Role = "Vanguard" | "Duelist" | "Strategist";

export interface Hero {
  id: string;
  name: string;
  role: Role | Role[];
}

export const ROLE_COLORS: Record<Role, string> = {
  Vanguard: "#3b82f6",   // blue
  Duelist: "#ef4444",     // red
  Strategist: "#22c55e",  // green
};

export const ROLE_LABELS: Record<Role, string> = {
  Vanguard: "Vanguard",
  Duelist: "Duelist",
  Strategist: "Strategist",
};

export const heroes: Hero[] = [
  // ──────────────────── VANGUARDS (13) ────────────────────
  { id: "bruce-banner",    name: "Bruce Banner",     role: "Vanguard" },
  { id: "captain-america", name: "Captain America",  role: "Vanguard" },
  { id: "doctor-strange",  name: "Doctor Strange",   role: "Vanguard" },
  { id: "groot",           name: "Groot",            role: "Vanguard" },
  { id: "magneto",         name: "Magneto",          role: "Vanguard" },
  { id: "peni-parker",     name: "Peni Parker",      role: "Vanguard" },
  { id: "thor",            name: "Thor",             role: "Vanguard" },
  { id: "venom",           name: "Venom",            role: "Vanguard" },
  { id: "the-thing",       name: "The Thing",        role: "Vanguard" },
  { id: "emma-frost",      name: "Emma Frost",       role: "Vanguard" },
  { id: "angela",          name: "Angela",           role: "Vanguard" },
  { id: "rogue",           name: "Rogue",            role: "Vanguard" },
  { id: "devil-dino",      name: "Devil Dino",       role: "Vanguard" },

  // ──────────────────── DUELISTS (25) ─────────────────────
  { id: "black-panther",   name: "Black Panther",    role: "Duelist" },
  { id: "black-widow",     name: "Black Widow",      role: "Duelist" },
  { id: "hawkeye",         name: "Hawkeye",          role: "Duelist" },
  { id: "hela",            name: "Hela",             role: "Duelist" },
  { id: "iron-fist",       name: "Iron Fist",        role: "Duelist" },
  { id: "iron-man",        name: "Iron Man",         role: "Duelist" },
  { id: "magik",           name: "Magik",            role: "Duelist" },
  { id: "moon-knight",     name: "Moon Knight",      role: "Duelist" },
  { id: "namor",           name: "Namor",            role: "Duelist" },
  { id: "psylocke",        name: "Psylocke",         role: "Duelist" },
  { id: "scarlet-witch",   name: "Scarlet Witch",    role: "Duelist" },
  { id: "spider-man",      name: "Spider-Man",       role: "Duelist" },
  { id: "squirrel-girl",   name: "Squirrel Girl",    role: "Duelist" },
  { id: "star-lord",       name: "Star-Lord",        role: "Duelist" },
  { id: "storm",           name: "Storm",            role: "Duelist" },
  { id: "the-punisher",    name: "The Punisher",     role: "Duelist" },
  { id: "winter-soldier",  name: "Winter Soldier",   role: "Duelist" },
  { id: "wolverine",       name: "Wolverine",        role: "Duelist" },
  { id: "mister-fantastic", name: "Mister Fantastic", role: "Duelist" },
  { id: "human-torch",     name: "Human Torch",      role: "Duelist" },
  { id: "phoenix",         name: "Phoenix",          role: "Duelist" },
  { id: "blade",           name: "Blade",            role: "Duelist" },
  { id: "daredevil",       name: "Daredevil",        role: "Duelist" },
  { id: "elsa-bloodstone", name: "Elsa Bloodstone",  role: "Duelist" },
  { id: "cyclops",         name: "Cyclops",          role: "Duelist" },

  // ──────────────────── STRATEGISTS (10) ──────────────────
  { id: "adam-warlock",     name: "Adam Warlock",     role: "Strategist" },
  { id: "cloak-dagger",    name: "Cloak & Dagger",   role: "Strategist" },
  { id: "jeff",            name: "Jeff the Land Shark", role: "Strategist" },
  { id: "loki",            name: "Loki",             role: "Strategist" },
  { id: "luna-snow",       name: "Luna Snow",        role: "Strategist" },
  { id: "mantis",          name: "Mantis",           role: "Strategist" },
  { id: "rocket-raccoon",  name: "Rocket Raccoon",   role: "Strategist" },
  { id: "invisible-woman", name: "Invisible Woman",  role: "Strategist" },
  { id: "ultron",          name: "Ultron",           role: "Strategist" },
  { id: "gambit",          name: "Gambit",           role: "Strategist" },
  { id: "white-fox",       name: "White Fox",        role: "Strategist" },

  // ──────────────────── MULTI-ROLE (1) ────────────────────
  { id: "deadpool", name: "Deadpool", role: ["Vanguard", "Duelist", "Strategist"] },
];

// ── Convenience helpers ──

export function getHeroRole(hero: Hero): Role {
  return Array.isArray(hero.role) ? hero.role[0] : hero.role;
}

export function heroMatchesRole(hero: Hero, role: Role): boolean {
  return Array.isArray(hero.role) ? hero.role.includes(role) : hero.role === role;
}

export function getHeroesByRole(role: Role): Hero[] {
  return heroes.filter((h) => heroMatchesRole(h, role));
}

export const vanguards = getHeroesByRole("Vanguard");
export const duelists = getHeroesByRole("Duelist");
export const strategists = getHeroesByRole("Strategist");
