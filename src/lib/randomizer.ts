import { Hero, Role, heroes, heroMatchesRole } from "@/data/heroes";

export interface Player {
  id: string;
  name: string;
  team: 1 | 2;
}

export interface RandomizerOptions {
  noDuplicates: boolean;
  roleConstraints: boolean;
  /** Role counts per team when roleConstraints is true. Must sum to team size. */
  roleCounts: Record<Role, number>;
  /** If true, no duplicate heroes across BOTH teams. If false, only within each team. */
  crossTeamUnique: boolean;
}

export interface Assignment {
  player: Player;
  hero: Hero;
  /** The role Deadpool would fill (relevant only for multi-role heroes) */
  assignedRole: Role;
}

export interface RandomizerResult {
  team1: Assignment[];
  team2: Assignment[];
}

export const DEFAULT_OPTIONS: RandomizerOptions = {
  noDuplicates: true,
  roleConstraints: false,
  roleCounts: { Vanguard: 2, Duelist: 2, Strategist: 2 },
  crossTeamUnique: false,
};

/** Fisher-Yates shuffle (in-place, returns same array) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Pick a random element from an array */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Assign random heroes to a list of players for one team.
 * Returns assignments for this team and the set of used hero IDs.
 */
function assignTeam(
  players: Player[],
  options: RandomizerOptions,
  usedHeroIds: Set<string>
): Assignment[] {
  const assignments: Assignment[] = [];

  if (options.roleConstraints) {
    // Build a slot list based on role counts
    const slots: Role[] = [];
    for (const [role, count] of Object.entries(options.roleCounts)) {
      for (let i = 0; i < count; i++) {
        slots.push(role as Role);
      }
    }
    // Trim or pad slots to match player count
    while (slots.length < players.length) slots.push("Duelist");
    while (slots.length > players.length) slots.pop();
    shuffle(slots);

    for (let i = 0; i < players.length; i++) {
      const role = slots[i];
      const pool = heroes.filter(
        (h) =>
          heroMatchesRole(h, role) &&
          (!options.noDuplicates || !usedHeroIds.has(h.id))
      );

      if (pool.length === 0) {
        // Fallback: pick any hero if role pool is exhausted
        const fallback = heroes.filter(
          (h) => !options.noDuplicates || !usedHeroIds.has(h.id)
        );
        const hero = pickRandom(fallback.length > 0 ? fallback : heroes);
        if (options.noDuplicates) usedHeroIds.add(hero.id);
        assignments.push({ player: players[i], hero, assignedRole: role });
      } else {
        const hero = pickRandom(pool);
        if (options.noDuplicates) usedHeroIds.add(hero.id);
        assignments.push({ player: players[i], hero, assignedRole: role });
      }
    }
  } else {
    // No role constraints
    const pool = options.noDuplicates
      ? shuffle([...heroes].filter((h) => !usedHeroIds.has(h.id)))
      : heroes;

    for (let i = 0; i < players.length; i++) {
      let hero: Hero;
      if (options.noDuplicates) {
        // Pop from shuffled pool
        const available = pool.filter((h) => !usedHeroIds.has(h.id));
        hero = available.length > 0 ? available[0] : pickRandom(heroes);
        usedHeroIds.add(hero.id);
      } else {
        hero = pickRandom(pool);
      }
      const assignedRole: Role = Array.isArray(hero.role)
        ? pickRandom(hero.role)
        : hero.role;
      assignments.push({ player: players[i], hero, assignedRole });
    }
  }

  return assignments;
}

/**
 * Main randomizer function.
 * Takes all players (with team assignments) and options,
 * returns hero assignments for both teams.
 */
export function randomizeHeroes(
  players: Player[],
  options: RandomizerOptions = DEFAULT_OPTIONS
): RandomizerResult {
  const team1Players = players.filter((p) => p.team === 1);
  const team2Players = players.filter((p) => p.team === 2);

  const usedHeroIds = new Set<string>();

  const team1 = assignTeam(team1Players, options, usedHeroIds);

  // If not cross-team unique, reset the used set for team 2
  if (!options.crossTeamUnique) {
    usedHeroIds.clear();
  }

  const team2 = assignTeam(team2Players, options, usedHeroIds);

  return { team1, team2 };
}

/**
 * Format results as copyable text.
 */
export function formatResults(result: RandomizerResult): string {
  const lines: string[] = [];
  lines.push("═══ TEAM 1 ═══");
  for (const a of result.team1) {
    const roleTag = Array.isArray(a.hero.role)
      ? `[${a.assignedRole}]`
      : `[${a.assignedRole}]`;
    lines.push(`  ${a.player.name} → ${a.hero.name} ${roleTag}`);
  }
  lines.push("");
  lines.push("═══ TEAM 2 ═══");
  for (const a of result.team2) {
    const roleTag = `[${a.assignedRole}]`;
    lines.push(`  ${a.player.name} → ${a.hero.name} ${roleTag}`);
  }
  return lines.join("\n");
}
